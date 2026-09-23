import type { RowDataPacket } from "mysql2";

import { getDatabasePool } from "../db.js";
import type { ClassItem } from "./class.types.js";

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
}

export interface ClassRepository {
  findAll(): Promise<ClassItem[]>;
  findById(id: string): Promise<ClassItem | null>;
  findByGroup(groupId: string): Promise<ClassItem[]>;
}

const SELECT_COLUMNS =
  "id, module_id, group_id, name, description, class_date, start_time, end_time, status";

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
  };
}

export class MysqlClassRepository implements ClassRepository {
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
