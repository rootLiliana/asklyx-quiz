import type { RowDataPacket } from "mysql2";

import { getDatabasePool } from "../db.js";

export interface Module {
  id: string;
  name: string;
  description: string | null;
  orderNumber: number;
}

interface ModuleRow extends RowDataPacket {
  id: number | string;
  name: string;
  description: string | null;
  order_number: number;
}

export interface ModuleRepository {
  findAll(): Promise<Module[]>;
  findById(id: string): Promise<Module | null>;
}

function toModule(row: ModuleRow): Module {
  return {
    id: String(row.id),
    name: row.name,
    description: row.description,
    orderNumber: Number(row.order_number),
  };
}

export class MysqlModuleRepository implements ModuleRepository {
  async findAll(): Promise<Module[]> {
    const [rows] = await getDatabasePool().execute<ModuleRow[]>(
      "SELECT id, name, description, order_number FROM modules ORDER BY order_number ASC",
    );
    return rows.map(toModule);
  }

  async findById(id: string): Promise<Module | null> {
    const [rows] = await getDatabasePool().execute<ModuleRow[]>(
      "SELECT id, name, description, order_number FROM modules WHERE id = ? LIMIT 1",
      [id],
    );
    const row = rows[0];
    return row ? toModule(row) : null;
  }
}
