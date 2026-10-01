import type { ResultSetHeader, RowDataPacket } from "mysql2";

import { getDatabasePool } from "../db.js";
import type { UserRole } from "../users/user.types.js";
import type { AuthUser } from "./auth.types.js";

interface SessionUserRow extends RowDataPacket {
  user_id: number | string;
  nickname: string;
  role: UserRole;
  must_change_password: number | boolean;
}

export interface AuthSessionRepository {
  create(tokenHash: string, userId: string, ttlDays: number): Promise<void>;
  // La usuaria dueña de una sesión vigente, con su rol ACTUAL (si le cambian
  // el rol, aplica sin tener que volver a iniciar sesión).
  findUserByTokenHash(tokenHash: string): Promise<AuthUser | null>;
  deleteByTokenHash(tokenHash: string): Promise<void>;
  deleteByUserId(userId: string): Promise<void>;
}

export class MysqlAuthSessionRepository implements AuthSessionRepository {
  async create(tokenHash: string, userId: string, ttlDays: number): Promise<void> {
    await getDatabasePool().execute<ResultSetHeader>(
      `INSERT INTO auth_sessions (token_hash, user_id, expires_at)
       VALUES (?, ?, DATE_ADD(CURRENT_TIMESTAMP, INTERVAL ? DAY))`,
      [tokenHash, userId, ttlDays],
    );
  }

  async findUserByTokenHash(tokenHash: string): Promise<AuthUser | null> {
    const [rows] = await getDatabasePool().execute<SessionUserRow[]>(
      `SELECT s.user_id, u.nickname, u.role, u.must_change_password
       FROM auth_sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = ? AND s.expires_at > CURRENT_TIMESTAMP
       LIMIT 1`,
      [tokenHash],
    );

    const row = rows[0];
    return row
      ? {
          id: String(row.user_id),
          nickname: row.nickname,
          role: row.role,
          mustChangePassword: row.must_change_password === 1 || row.must_change_password === true,
        }
      : null;
  }

  async deleteByTokenHash(tokenHash: string): Promise<void> {
    await getDatabasePool().execute<ResultSetHeader>("DELETE FROM auth_sessions WHERE token_hash = ?", [tokenHash]);
  }

  async deleteByUserId(userId: string): Promise<void> {
    await getDatabasePool().execute<ResultSetHeader>("DELETE FROM auth_sessions WHERE user_id = ?", [userId]);
  }
}
