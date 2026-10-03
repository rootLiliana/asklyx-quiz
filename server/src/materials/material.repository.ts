import type { ResultSetHeader, RowDataPacket } from "mysql2";

import { getDatabasePool } from "../db.js";
import type { Material, MaterialBlock, MaterialFields, MaterialViewReport, StudentClassMaterials } from "./material.types.js";

interface MaterialRow extends RowDataPacket {
  id: number | string;
  lesson_id: number | string;
  title: string;
  blocks: MaterialBlock[] | string;
  sort_order: number;
  published_at: Date | string | null;
  created_by: number | string;
  updated_at: Date | string | null;
}

interface StudentClassRow extends RowDataPacket {
  id: number | string;
  name: string;
  class_date: Date | string | null;
  start_time: string | null;
  end_time: string | null;
  group_name: string;
  lesson_id: number | string | null;
}

interface StudentMaterialRow extends RowDataPacket {
  id: number | string;
  lesson_id: number | string;
  title: string;
  published_at: Date | string | null;
}

export interface MaterialRepository {
  findByLesson(lessonId: string): Promise<Material[]>;
  findById(id: string): Promise<Material | null>;
  create(lessonId: string, fields: MaterialFields, createdBy: string): Promise<Material>;
  update(id: string, fields: MaterialFields): Promise<Material | null>;
  delete(id: string): Promise<boolean>;
  // Clases de los grupos de la alumna, con su material publicado hasta `now`.
  findForStudent(userId: string, now: Date): Promise<StudentClassMaterials[]>;
  // ¿La alumna está en algún grupo que tiene una clase de esa sesión?
  isLessonVisibleTo(lessonId: string, userId: string): Promise<boolean>;
  // Anota que la alumna abrió el material (primera vez, última vez y cuántas).
  recordView(materialId: string, studentId: string): Promise<void>;
  viewReport(lessonId: string): Promise<MaterialViewReport>;
}

const COLUMNS = "id, lesson_id, title, blocks, sort_order, published_at, created_by, updated_at";

function toIso(value: Date | string | null): string | null {
  if (value === null) return null;
  return value instanceof Date ? value.toISOString() : value;
}

function toMaterial(row: MaterialRow): Material {
  return {
    id: String(row.id),
    lessonId: String(row.lesson_id),
    title: row.title,
    // mysql2 ya convierte las columnas JSON; por si llega como texto, se parsea.
    blocks: typeof row.blocks === "string" ? JSON.parse(row.blocks) as MaterialBlock[] : row.blocks,
    sortOrder: row.sort_order,
    publishedAt: toIso(row.published_at),
    createdBy: String(row.created_by),
    updatedAt: toIso(row.updated_at),
  };
}

export class MysqlMaterialRepository implements MaterialRepository {
  async findByLesson(lessonId: string): Promise<Material[]> {
    const [rows] = await getDatabasePool().execute<MaterialRow[]>(
      `SELECT ${COLUMNS} FROM class_materials WHERE lesson_id = ? ORDER BY sort_order ASC, id ASC`,
      [lessonId],
    );
    return rows.map(toMaterial);
  }

  async findById(id: string): Promise<Material | null> {
    const [rows] = await getDatabasePool().execute<MaterialRow[]>(
      `SELECT ${COLUMNS} FROM class_materials WHERE id = ? LIMIT 1`,
      [id],
    );
    const row = rows[0];
    return row ? toMaterial(row) : null;
  }

  async create(lessonId: string, fields: MaterialFields, createdBy: string): Promise<Material> {
    // Va al final de los materiales de esa sesión.
    const [result] = await getDatabasePool().execute<ResultSetHeader>(
      `INSERT INTO class_materials (lesson_id, title, blocks, sort_order, published_at, created_by)
       SELECT ?, ?, ?, COALESCE(MAX(sort_order), 0) + 1, ?, ? FROM class_materials WHERE lesson_id = ?`,
      [lessonId, fields.title, JSON.stringify(fields.blocks), fields.publishedAt, createdBy, lessonId],
    );

    const material = await this.findById(String(result.insertId));
    if (!material) {
      throw new Error("Material was created but could not be retrieved");
    }
    return material;
  }

  async update(id: string, fields: MaterialFields): Promise<Material | null> {
    if (!(await this.findById(id))) {
      return null;
    }

    await getDatabasePool().execute<ResultSetHeader>(
      "UPDATE class_materials SET title = ?, blocks = ?, published_at = ? WHERE id = ?",
      [fields.title, JSON.stringify(fields.blocks), fields.publishedAt, id],
    );
    return this.findById(id);
  }

  async delete(id: string): Promise<boolean> {
    const [result] = await getDatabasePool().execute<ResultSetHeader>("DELETE FROM class_materials WHERE id = ?", [id]);
    return result.affectedRows > 0;
  }

  async isLessonVisibleTo(lessonId: string, userId: string): Promise<boolean> {
    const [rows] = await getDatabasePool().execute<RowDataPacket[]>(
      `SELECT 1 FROM classes c JOIN group_members gm ON gm.group_id = c.group_id
       WHERE c.lesson_id = ? AND gm.user_id = ? LIMIT 1`,
      [lessonId, userId],
    );
    return rows.length > 0;
  }

  async recordView(materialId: string, studentId: string): Promise<void> {
    await getDatabasePool().execute<ResultSetHeader>(
      `INSERT INTO material_views (material_id, student_id) VALUES (?, ?)
       ON DUPLICATE KEY UPDATE last_viewed_at = CURRENT_TIMESTAMP, view_count = view_count + 1`,
      [materialId, studentId],
    );
  }

  async viewReport(lessonId: string): Promise<MaterialViewReport> {
    const database = getDatabasePool();
    const [[studentRows], [viewRows]] = await Promise.all([
      database.execute<RowDataPacket[]>(
        `SELECT DISTINCT u.id, u.name, u.last_name_paternal, u.nickname, g.id AS group_id, g.name AS group_name
         FROM classes c
         JOIN user_groups g ON g.id = c.group_id
         JOIN group_members gm ON gm.group_id = c.group_id
         JOIN users u ON u.id = gm.user_id
         WHERE c.lesson_id = ? AND u.role = 'STUDENT'
         ORDER BY g.name ASC, u.name ASC`,
        [lessonId],
      ),
      database.execute<RowDataPacket[]>(
        `SELECT v.material_id, v.student_id, v.first_viewed_at, v.last_viewed_at, v.view_count
         FROM material_views v
         JOIN class_materials m ON m.id = v.material_id
         WHERE m.lesson_id = ?`,
        [lessonId],
      ),
    ]);

    return {
      students: studentRows.map((row) => ({
        id: String(row.id),
        name: String(row.name),
        lastNamePaternal: row.last_name_paternal === null ? null : String(row.last_name_paternal),
        nickname: String(row.nickname),
        groupId: String(row.group_id),
        groupName: String(row.group_name),
      })),
      views: viewRows.map((row) => ({
        materialId: String(row.material_id),
        studentId: String(row.student_id),
        firstViewedAt: toIso(row.first_viewed_at as Date | string | null),
        lastViewedAt: toIso(row.last_viewed_at as Date | string | null),
        viewCount: Number(row.view_count),
      })),
    };
  }

  async findForStudent(userId: string, now: Date): Promise<StudentClassMaterials[]> {
    const database = getDatabasePool();
    const [[classRows], [materialRows]] = await Promise.all([
      database.execute<StudentClassRow[]>(
        `SELECT c.id, c.name, c.class_date, c.start_time, c.end_time, g.name AS group_name, c.lesson_id
         FROM group_members gm
         JOIN classes c ON c.group_id = gm.group_id
         JOIN user_groups g ON g.id = gm.group_id
         WHERE gm.user_id = ?
         ORDER BY c.class_date ASC, c.id ASC`,
        [userId],
      ),
      // `now` sale de Node (no de CURRENT_TIMESTAMP) para comparar en la misma
      // zona horaria con la que se guardó published_at.
      database.execute<StudentMaterialRow[]>(
        `SELECT DISTINCT m.id, m.lesson_id, m.title, m.published_at, m.sort_order
         FROM class_materials m
         JOIN classes c ON c.lesson_id = m.lesson_id
         JOIN group_members gm ON gm.group_id = c.group_id
         WHERE gm.user_id = ? AND m.published_at IS NOT NULL AND m.published_at <= ?
         ORDER BY m.sort_order ASC, m.id ASC`,
        [userId, now],
      ),
    ]);

    return classRows.map((row) => ({
      id: String(row.id),
      name: row.name,
      classDate: toIso(row.class_date),
      startTime: row.start_time,
      endTime: row.end_time,
      groupName: row.group_name,
      lessonId: row.lesson_id === null ? null : String(row.lesson_id),
      materials: materialRows
        .filter((material) => row.lesson_id !== null && String(material.lesson_id) === String(row.lesson_id))
        .map((material) => ({ id: String(material.id), title: material.title, publishedAt: toIso(material.published_at) })),
    }));
  }
}
