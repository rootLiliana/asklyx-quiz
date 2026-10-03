import type { ResultSetHeader, RowDataPacket } from "mysql2";
import type { PoolConnection } from "mysql2/promise";

import { getDatabasePool } from "../db.js";
import type { ClassFields, ClassItem } from "./class.types.js";

interface ClassRow extends RowDataPacket {
  id: number | string;
  module_id: number | string;
  group_id: number | string;
  name: string;
  description: string | null;
  class_date: Date | string | null;
  start_time: string | null;
  end_time: string | null;
  status: string;
  lesson_id: number | string | null;
}

export interface ClassRepository {
  findAll(): Promise<ClassItem[]>;
  findById(id: string): Promise<ClassItem | null>;
  findByGroup(groupId: string): Promise<ClassItem[]>;
}

// Escritura (pestaña "Clases" del Host). Separada de ClassRepository para
// que quien solo lee clases no dependa de ella.
export interface ClassWriteRepository extends ClassRepository {
  // Todas o ninguna (una transacción).
  createMany(classes: ClassFields[]): Promise<ClassItem[]>;
  // null si la clase no existe.
  update(id: string, fields: ClassFields): Promise<ClassItem | null>;
  // false si la clase no existe.
  delete(id: string): Promise<boolean>;
}

// La clase ya tiene quizzes, sesiones de juego o asistencia ligados.
export class ClassInUseError extends Error {}

const SELECT_COLUMNS =
  "id, module_id, group_id, name, description, class_date, start_time, end_time, status, lesson_id";

function serializeNullableDate(value: Date | string | null): string | null {
  if (value === null) {
    return null;
  }

  return value instanceof Date ? value.toISOString() : value;
}

function toClassItem(row: ClassRow): ClassItem {
  return {
    id: String(row.id),
    moduleId: String(row.module_id),
    groupId: String(row.group_id),
    name: row.name,
    description: row.description,
    classDate: serializeNullableDate(row.class_date),
    startTime: row.start_time,
    endTime: row.end_time,
    status: row.status,
    lessonId: row.lesson_id === null ? null : String(row.lesson_id),
  };
}

// La sesión de (módulo, nombre); la crea si no existe. Las clases de
// distintos grupos con el mismo módulo y nombre comparten sesión.
async function findOrCreateLesson(connection: PoolConnection, moduleId: string, name: string): Promise<string> {
  const [rows] = await connection.execute<RowDataPacket[]>(
    "SELECT id FROM lessons WHERE module_id = ? AND name = ? LIMIT 1",
    [moduleId, name],
  );
  if (rows[0]) return String(rows[0].id);

  const [result] = await connection.execute<ResultSetHeader>(
    "INSERT INTO lessons (module_id, name) VALUES (?, ?)",
    [moduleId, name],
  );
  return String(result.insertId);
}

export class MysqlClassRepository implements ClassWriteRepository {
  async createMany(classes: ClassFields[]): Promise<ClassItem[]> {
    const connection = await getDatabasePool().getConnection();
    const ids: string[] = [];

    try {
      await connection.beginTransaction();
      for (const fields of classes) {
        const lessonId = await findOrCreateLesson(connection, fields.moduleId, fields.name);
        const [result] = await connection.execute<ResultSetHeader>(
          `INSERT INTO classes (module_id, group_id, name, description, class_date, start_time, end_time, lesson_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [fields.moduleId, fields.groupId, fields.name, fields.description, fields.classDate, fields.startTime, fields.endTime, lessonId],
        );
        ids.push(String(result.insertId));
      }
      await connection.commit();
    } catch (error: unknown) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

    const created = await Promise.all(ids.map((id) => this.findById(id)));
    return created.filter((classItem): classItem is ClassItem => classItem !== null);
  }

  // Si cambian el módulo o el nombre, la clase pasa a la sesión de ese
  // (módulo, nombre). Excepción: si era la única clase de su sesión y no
  // existe otra con el nombre nuevo, se renombra la sesión misma, para que su
  // material y su práctica la sigan acompañando.
  async update(id: string, fields: ClassFields): Promise<ClassItem | null> {
    const current = await this.findById(id);
    if (!current) {
      return null;
    }

    const connection = await getDatabasePool().getConnection();
    try {
      await connection.beginTransaction();

      let lessonId = current.lessonId ?? null;
      const renamed = current.moduleId !== fields.moduleId || current.name !== fields.name;
      if (renamed || !lessonId) {
        const [targetRows] = await connection.execute<RowDataPacket[]>(
          "SELECT id FROM lessons WHERE module_id = ? AND name = ? LIMIT 1",
          [fields.moduleId, fields.name],
        );
        const [siblingRows] = lessonId
          ? await connection.execute<RowDataPacket[]>("SELECT COUNT(*) AS total FROM classes WHERE lesson_id = ? AND id <> ?", [lessonId, id])
          : [[{ total: 1 }] as RowDataPacket[]];
        const isAlone = Number(siblingRows[0]?.total ?? 0) === 0;

        if (targetRows[0]) {
          lessonId = String(targetRows[0].id);
        } else if (lessonId && isAlone) {
          await connection.execute<ResultSetHeader>(
            "UPDATE lessons SET module_id = ?, name = ? WHERE id = ?",
            [fields.moduleId, fields.name, lessonId],
          );
        } else {
          lessonId = await findOrCreateLesson(connection, fields.moduleId, fields.name);
        }
      }

      await connection.execute<ResultSetHeader>(
        `UPDATE classes
         SET module_id = ?, group_id = ?, name = ?, description = ?, class_date = ?, start_time = ?, end_time = ?, lesson_id = ?
         WHERE id = ?`,
        [fields.moduleId, fields.groupId, fields.name, fields.description, fields.classDate, fields.startTime, fields.endTime, lessonId, id],
      );
      await connection.commit();
    } catch (error: unknown) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

    return this.findById(id);
  }

  async delete(id: string): Promise<boolean> {
    try {
      const [result] = await getDatabasePool().execute<ResultSetHeader>("DELETE FROM classes WHERE id = ?", [id]);
      return result.affectedRows > 0;
    } catch (error: unknown) {
      if (typeof error === "object" && error !== null && "code" in error && error.code === "ER_ROW_IS_REFERENCED_2") {
        throw new ClassInUseError("The class already has quizzes, game sessions or attendance");
      }
      throw error;
    }
  }

  async findAll(): Promise<ClassItem[]> {
    const [rows] = await getDatabasePool().execute<ClassRow[]>(
      `SELECT ${SELECT_COLUMNS} FROM classes ORDER BY class_date DESC, id DESC`,
    );

    return rows.map(toClassItem);
  }

  async findById(id: string): Promise<ClassItem | null> {
    const [rows] = await getDatabasePool().execute<ClassRow[]>(
      `SELECT ${SELECT_COLUMNS} FROM classes WHERE id = ? LIMIT 1`,
      [id],
    );

    const row = rows[0];
    return row ? toClassItem(row) : null;
  }

  async findByGroup(groupId: string): Promise<ClassItem[]> {
    const [rows] = await getDatabasePool().execute<ClassRow[]>(
      `SELECT ${SELECT_COLUMNS} FROM classes WHERE group_id = ? ORDER BY class_date DESC, id DESC`,
      [groupId],
    );

    return rows.map(toClassItem);
  }
}
