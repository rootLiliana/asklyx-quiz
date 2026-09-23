import type { ResultSetHeader, RowDataPacket } from "mysql2";

import { getDatabasePool } from "../db.js";
import type { RegisterUserInput, User, UserRole, UserWithPasswordHash } from "./user.types.js";

interface UserRow extends RowDataPacket {
  id: number | string;
  name: string;
  last_name_paternal: string | null;
  last_name_maternal: string | null;
  email: string;
  nickname: string;
  role: UserRole;
  created_at: Date | string;
  updated_at: Date | string;
}

interface UserAuthRow extends UserRow {
  password_hash: string | null;
}

export interface UserRepository {
  create(input: RegisterUserInput): Promise<User>;
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  findByNickname(nickname: string): Promise<User | null>;
  findAuthByNickname(nickname: string): Promise<UserWithPasswordHash | null>;
  updateRole(id: string, role: UserRole): Promise<User | null>;
  findAll(role?: UserRole): Promise<User[]>;
}

const USER_COLUMNS = "id, name, last_name_paternal, last_name_maternal, email, nickname, role, created_at, updated_at";

function serializeDate(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : value;
}

function toUser(row: UserRow): User {
  return {
    id: String(row.id),
    name: row.name,
    lastNamePaternal: row.last_name_paternal,
    lastNameMaternal: row.last_name_maternal,
    email: row.email,
    nickname: row.nickname,
    role: row.role,
    createdAt: serializeDate(row.created_at),
    updatedAt: serializeDate(row.updated_at),
  };
}

function toUserWithPasswordHash(row: UserAuthRow): UserWithPasswordHash {
  return {
    ...toUser(row),
    passwordHash: row.password_hash,
  };
}

export class MysqlUserRepository implements UserRepository {
  async create(input: RegisterUserInput): Promise<User> {
    const database = getDatabasePool();
    const [result] = await database.execute<ResultSetHeader>(
      `INSERT INTO users (name, last_name_paternal, last_name_maternal, email, nickname, password_hash, role)
       VALUES (?, ?, ?, ?, ?, ?, 'STUDENT')`,
      [input.name, input.lastNamePaternal, input.lastNameMaternal, input.email, input.nickname, input.passwordHash],
    );

    const user = await this.findById(String(result.insertId));

    if (!user) {
      throw new Error("User was created but could not be retrieved");
    }

    return user;
  }

  async findById(id: string): Promise<User | null> {
    const [rows] = await getDatabasePool().execute<UserRow[]>(
      `SELECT ${USER_COLUMNS} FROM users WHERE id = ? LIMIT 1`,
      [id],
    );

    const row = rows[0];
    return row ? toUser(row) : null;
  }

  async findByNickname(nickname: string): Promise<User | null> {
    const [rows] = await getDatabasePool().execute<UserRow[]>(
      `SELECT ${USER_COLUMNS} FROM users WHERE nickname = ? LIMIT 1`,
      [nickname],
    );

    const row = rows[0];
    return row ? toUser(row) : null;
  }

  async findAuthByNickname(nickname: string): Promise<UserWithPasswordHash | null> {
    const [rows] = await getDatabasePool().execute<UserAuthRow[]>(
      `SELECT ${USER_COLUMNS}, password_hash FROM users WHERE nickname = ? LIMIT 1`,
      [nickname],
    );

    const row = rows[0];
    return row ? toUserWithPasswordHash(row) : null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const [rows] = await getDatabasePool().execute<UserRow[]>(
      `SELECT ${USER_COLUMNS} FROM users WHERE email = ? LIMIT 1`,
      [email],
    );

    const row = rows[0];
    return row ? toUser(row) : null;
  }

  async updateRole(id: string, role: UserRole): Promise<User | null> {
    const [result] = await getDatabasePool().execute<ResultSetHeader>(
      "UPDATE users SET role = ? WHERE id = ?",
      [role, id],
    );

    if (result.affectedRows === 0) {
      return null;
    }

    return this.findById(id);
  }

  async findAll(role?: UserRole): Promise<User[]> {
    const [rows] = role
      ? await getDatabasePool().execute<UserRow[]>(
          `SELECT ${USER_COLUMNS} FROM users WHERE role = ? ORDER BY name ASC`,
          [role],
        )
      : await getDatabasePool().execute<UserRow[]>(
          `SELECT ${USER_COLUMNS} FROM users ORDER BY name ASC`,
        );

    return rows.map(toUser);
  }
}
