import type { ResultSetHeader, RowDataPacket } from "mysql2";

import { getDatabasePool } from "../db.js";
import type { CreateQuizSessionInput, QuizSession, QuizSessionMode } from "./quiz-session.types.js";

interface QuizSessionRow extends RowDataPacket {
  id: number | string;
  quiz_id: number | string;
  host_id: number | string;
  group_id: number | string | null;
  game_code: string;
  mode: QuizSessionMode;
  status: string;
}

export interface QuizSessionRepository {
  create(input: CreateQuizSessionInput): Promise<QuizSession>;
  findByGameCode(gameCode: string): Promise<QuizSession | null>;
}

export class QuizSessionConflictError extends Error {}
export class QuizSessionReferenceError extends Error {}

function toQuizSession(row: QuizSessionRow): QuizSession {
  return {
    id: String(row.id),
    quizId: String(row.quiz_id),
    hostId: String(row.host_id),
    groupId: row.group_id === null ? null : String(row.group_id),
    gameCode: row.game_code,
    mode: row.mode,
    // El status solo se escribe como 'WAITING' hoy (create() lo hardcodea) y
    // nunca se actualiza; se modela así hasta que exista una transición real.
    status: "WAITING",
  };
}

export class MysqlQuizSessionRepository implements QuizSessionRepository {
  async findByGameCode(gameCode: string): Promise<QuizSession | null> {
    const [rows] = await getDatabasePool().execute<QuizSessionRow[]>(
      "SELECT id, quiz_id, host_id, group_id, game_code, mode, status FROM quiz_sessions WHERE game_code = ? LIMIT 1",
      [gameCode],
    );

    const row = rows[0];
    return row ? toQuizSession(row) : null;
  }

  async create(input: CreateQuizSessionInput): Promise<QuizSession> {
    try {
      const [result] = await getDatabasePool().execute<ResultSetHeader>(
        "INSERT INTO quiz_sessions (quiz_id, host_id, group_id, game_code, mode, status) VALUES (?, ?, ?, ?, ?, 'WAITING')",
        [input.quizId, input.hostId, input.groupId, input.gameCode, input.mode],
      );

      return {
        id: String(result.insertId),
        quizId: input.quizId,
        hostId: input.hostId,
        groupId: input.groupId,
        gameCode: input.gameCode,
        mode: input.mode,
        status: "WAITING",
      };
    } catch (error: unknown) {
      if (isDatabaseError(error, "ER_DUP_ENTRY")) {
        throw new QuizSessionConflictError("game code is already in use");
      }
      if (isDatabaseError(error, "ER_NO_REFERENCED_ROW_2")) {
        throw new QuizSessionReferenceError("quiz, host, or group does not exist");
      }
      throw error;
    }
  }
}

function isDatabaseError(error: unknown, code: string): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === code;
}
