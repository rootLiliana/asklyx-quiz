import type { ResultSetHeader, RowDataPacket } from "mysql2";

import { getDatabasePool } from "../db.js";
import type { Material, MaterialBlock, MaterialFields, StudentClassMaterials } from "./material.types.js";

interface MaterialRow extends RowDataPacket {
  id: number | string;
  class_id: number | string;
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
}

interface StudentMaterialRow extends RowDataPacket {
  id: number | string;
  class_id: number | string;
  title: string;
  published_at: Date | string | null;
}

export interface MaterialRepository {
  findByClass(classId: string): Promise<Material[]>;
  findById(id: string): Promise<Material | null>;
  create(classId: string, fields: MaterialFields, createdBy: string): Promise<Material>;
  update(id: string, fields: MaterialFields): Promise<Material | null>;
  delete(id: string): Promise<boolean>;
  // Clases de los grupos de la alumna, con su material publicado hasta `now`.
  findForStudent(userId: string, now: Date): Promise<StudentClassMaterials[]>;
}

const COLUMNS = "id, class_id, title, blocks, sort_order, published_at, created_by, updated_at";

function toIso(value: Date | string | null): string | null {
  if (value === null) return null;
  return value instanceof Date ? value.toISOString() : value;
}

function toMaterial(row: MaterialRow): Material {
  return {
    id: String(row.id),
    classId: String(row.class_id),
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
  async findByClass(classId: string): Promise<Material[]> {
    const [rows] = await getDatabasePool().execute<MaterialRow[]>(
      `SELECT ${COLUMNS} FROM class_materials WHERE class_id = ? ORDER BY sort_order ASC, id ASC`,
      [classId],
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

  async create(classId: string, fields: MaterialFields, createdBy: string): Promise<Material> {
    // Va al final de los materiales de esa clase.
    const [result] = await getDatabasePool().execute<ResultSetHeader>(
      `INSERT INTO class_materials (class_id, title, blocks, sort_order, published_at, created_by)
       SELECT ?, ?, ?, COALESCE(MAX(sort_order), 0) + 1, ?, ? FROM class_materials WHERE class_id = ?`,
      [classId, fields.title, JSON.stringify(fields.blocks), fields.publishedAt, createdBy, classId],
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

  async findForStudent(userId: string, now: Date): Promise<StudentClassMaterials[]> {
    const database = getDatabasePool();
    const [[classRows], [materialRows]] = await Promise.all([
      database.execute<StudentClassRow[]>(
        `SELECT c.id, c.name, c.class_date, c.start_time, c.end_time, g.name AS group_name
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
        `SELECT m.id, m.class_id, m.title, m.published_at
         FROM class_materials m
         JOIN classes c ON c.id = m.class_id
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
      materials: materialRows
        .filter((material) => String(material.class_id) === String(row.id))
        .map((material) => ({ id: String(material.id), title: material.title, publishedAt: toIso(material.published_at) })),
    }));
  }
}
