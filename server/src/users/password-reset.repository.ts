import type { ResultSetHeader, RowDataPacket } from "mysql2";

import { getDatabasePool } from "../db.js";

interface ResetTokenRow extends RowDataPacket {
  id: number | string;
  user_id: number | string;
}

export interface PasswordResetRepository {
  // Crea un token nuevo e invalida los anteriores sin usar de esa usuaria:
  // solo el enlace más reciente sirve.
  create(userId: string, tokenHash: string, ttlMinutes: number): Promise<void>;
  // Marca el token como usado y actualiza password_hash en una sola
  // transacción. Devuelve el userId, o null si el token no existe, ya se usó
  // o expiró.
  consumeAndSetPassword(tokenHash: string, passwordHash: string): Promise<string | null>;
  // Cambio directo. mustChange = true cuando es una contraseña temporal.
  setPasswordHash(userId: string, passwordHash: string, mustChange: boolean): Promise<void>;
}

export class MysqlPasswordResetRepository implements PasswordResetRepository {
  async create(userId: string, tokenHash: string, ttlMinutes: number): Promise<void> {
    const connection = await getDatabasePool().getConnection();

    try {
      await connection.beginTransaction();
      await connection.execute<ResultSetHeader>(
        "UPDATE password_reset_tokens SET used_at = CURRENT_TIMESTAMP WHERE user_id = ? AND used_at IS NULL",
        [userId],
      );
      // La expiración se calcula en la base de datos para no depender de la
      // zona horaria del servidor Node.
      await connection.execute<ResultSetHeader>(
        `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
         VALUES (?, ?, DATE_ADD(CURRENT_TIMESTAMP, INTERVAL ? MINUTE))`,
        [userId, tokenHash, ttlMinutes],
      );
      await connection.commit();
    } catch (error: unknown) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async setPasswordHash(userId: string, passwordHash: string, mustChange: boolean): Promise<void> {
    await getDatabasePool().execute<ResultSetHeader>(
      "UPDATE users SET password_hash = ?, must_change_password = ? WHERE id = ?",
      [passwordHash, mustChange ? 1 : 0, userId],
    );
  }

  async consumeAndSetPassword(tokenHash: string, passwordHash: string): Promise<string | null> {
    const connection = await getDatabasePool().getConnection();

    try {
      await connection.beginTransaction();
      const [rows] = await connection.execute<ResetTokenRow[]>(
        `SELECT id, user_id FROM password_reset_tokens
         WHERE token_hash = ? AND used_at IS NULL AND expires_at > CURRENT_TIMESTAMP
         LIMIT 1 FOR UPDATE`,
        [tokenHash],
      );
      const row = rows[0];

      if (!row) {
        await connection.rollback();
        return null;
      }

      await connection.execute<ResultSetHeader>(
        "UPDATE password_reset_tokens SET used_at = CURRENT_TIMESTAMP WHERE id = ?",
        [row.id],
      );
      await connection.execute<ResultSetHeader>(
        "UPDATE users SET password_hash = ?, must_change_password = 0 WHERE id = ?",
        [passwordHash, row.user_id],
      );
      await connection.commit();

      return String(row.user_id);
    } catch (error: unknown) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
}
