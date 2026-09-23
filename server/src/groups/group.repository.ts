import type { ResultSetHeader, RowDataPacket } from "mysql2";

import { getDatabasePool } from "../db.js";
import type { CreateGroupInput, Group, GroupStudent } from "./group.types.js";

interface GroupRow extends RowDataPacket {
  id: number | string;
  name: string;
  created_at: Date | string;
}

interface GroupStudentRow extends RowDataPacket {
  id: number | string;
  name: string;
  nickname: string;
  email: string;
}

export interface GroupRepository {
  create(input: CreateGroupInput): Promise<Group>;
  findById(id: string): Promise<Group | null>;
  findByName(name: string): Promise<Group | null>;
  findAll(): Promise<Group[]>;
  findMembers(groupId: string): Promise<GroupStudent[]>;
  hasMember(groupId: string, userId: string): Promise<boolean>;
  addMember(groupId: string, userId: string): Promise<void>;
  removeMember(groupId: string, userId: string): Promise<boolean>;
}

export class GroupConflictError extends Error {}
export class GroupMembershipConflictError extends Error {}

function serializeDate(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : value;
}

function toGroup(row: GroupRow): Group {
  return {
    id: String(row.id),
    name: row.name,
    createdAt: serializeDate(row.created_at),
  };
}

export class MysqlGroupRepository implements GroupRepository {
  async create(input: CreateGroupInput): Promise<Group> {
    try {
      const [result] = await getDatabasePool().execute<ResultSetHeader>(
        "INSERT INTO user_groups (name) VALUES (?)",
        [input.name],
      );

      const group = await this.findById(String(result.insertId));

      if (!group) {
        throw new Error("Group was created but could not be retrieved");
      }

      return group;
    } catch (error: unknown) {
      if (isDuplicateEntryError(error)) {
        throw new GroupConflictError("A group with that name already exists");
      }

      throw error;
    }
  }

  async findById(id: string): Promise<Group | null> {
    const [rows] = await getDatabasePool().execute<GroupRow[]>(
      "SELECT id, name, created_at FROM user_groups WHERE id = ? LIMIT 1",
      [id],
    );

    const row = rows[0];
    return row ? toGroup(row) : null;
  }

  async findByName(name: string): Promise<Group | null> {
    const [rows] = await getDatabasePool().execute<GroupRow[]>(
      "SELECT id, name, created_at FROM user_groups WHERE name = ? LIMIT 1",
      [name],
    );

    const row = rows[0];
    return row ? toGroup(row) : null;
  }

  async findAll(): Promise<Group[]> {
    const [rows] = await getDatabasePool().execute<GroupRow[]>(
      "SELECT id, name, created_at FROM user_groups ORDER BY name ASC",
    );

    return rows.map(toGroup);
  }

  async findMembers(groupId: string): Promise<GroupStudent[]> {
    const [rows] = await getDatabasePool().execute<GroupStudentRow[]>(
      `SELECT u.id, u.name, u.nickname, u.email
       FROM group_members gm
       JOIN users u ON u.id = gm.user_id
       WHERE gm.group_id = ?
       ORDER BY u.name ASC`,
      [groupId],
    );

    return rows.map((row) => ({
      id: String(row.id),
      name: row.name,
      nickname: row.nickname,
      email: row.email,
    }));
  }

  async hasMember(groupId: string, userId: string): Promise<boolean> {
    const [rows] = await getDatabasePool().execute<RowDataPacket[]>(
      "SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ? LIMIT 1",
      [groupId, userId],
    );

    return rows.length > 0;
  }

  async addMember(groupId: string, userId: string): Promise<void> {
    try {
      await getDatabasePool().execute<ResultSetHeader>(
        "INSERT INTO group_members (group_id, user_id) VALUES (?, ?)",
        [groupId, userId],
      );
    } catch (error: unknown) {
      if (isDuplicateEntryError(error)) {
        throw new GroupMembershipConflictError("The student already belongs to this group");
      }

      throw error;
    }
  }

  async removeMember(groupId: string, userId: string): Promise<boolean> {
    const [result] = await getDatabasePool().execute<ResultSetHeader>(
      "DELETE FROM group_members WHERE group_id = ? AND user_id = ?",
      [groupId, userId],
    );

    return result.affectedRows > 0;
  }
}

function isDuplicateEntryError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ER_DUP_ENTRY";
}
