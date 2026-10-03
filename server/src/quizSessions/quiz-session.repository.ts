import type { ResultSetHeader, RowDataPacket } from "mysql2";

import { getDatabasePool } from "../db.js";
import type { CreateQuizSessionInput, QuizSession, QuizSessionMode, QuizSessionStatus } from "./quiz-session.types.js";

interface QuizSessionRow extends RowDataPacket {
  id: number | string;
  quiz_id: number | string;
  host_id: number | string;
  class_id: number | string | null;
  group_id: number | string | null;
  game_code: string;
  mode: QuizSessionMode;
  status: string;
}

export interface QuizSessionRepository {
  create(input: CreateQuizSessionInput): Promise<QuizSession>;
  findByGameCode(gameCode: string): Promise<QuizSession | null>;
  // WAITING -> IN_PROGRESS (+ started_at). Solo la primera vez.
  markStarted(gameCode: string): Promise<void>;
  // -> FINISHED (+ ended_at). Solo la primera vez.
  markFinished(gameCode: string): Promise<void>;
}

export class QuizSessionConflictError extends Error {}
export class QuizSessionReferenceError extends Error {}

function toQuizSession(row: QuizSessionRow): QuizSession {
  return {
    id: String(row.id),
    quizId: String(row.quiz_id),
    hostId: String(row.host_id),
    classId: row.class_id === null ? null : String(row.class_id),
    groupId: row.group_id === null ? null : String(row.group_id),
    gameCode: row.game_code,
    mode: row.mode,
    status: toStatus(row.status),
  };
}

function toStatus(value: string): QuizSessionStatus {
  return value === "IN_PROGRESS" || value === "FINISHED" ? value : "WAITING";
}

export class MysqlQuizSessionRepository implements QuizSessionRepository {
  async markStarted(gameCode: string): Promise<void> {
    await getDatabasePool().execute<ResultSetHeader>(
      "UPDATE quiz_sessions SET status = 'IN_PROGRESS', started_at = CURRENT_TIMESTAMP WHERE game_code = ? AND status = 'WAITING'",
      [gameCode],
    );
  }

  async markFinished(gameCode: string): Promise<void> {
    await getDatabasePool().execute<ResultSetHeader>(
      "UPDATE quiz_sessions SET status = 'FINISHED', ended_at = CURRENT_TIMESTAMP WHERE game_code = ? AND status <> 'FINISHED'",
      [gameCode],
    );
  }

  async findByGameCode(gameCode: string): Promise<QuizSession | null> {
    const [rows] = await getDatabasePool().execute<QuizSessionRow[]>(
      "SELECT id, quiz_id, host_id, class_id, group_id, game_code, mode, status FROM quiz_sessions WHERE game_code = ? LIMIT 1",
      [gameCode],
    );

    const row = rows[0];
    return row ? toQuizSession(row) : null;
  }

  async create(input: CreateQuizSessionInput): Promise<QuizSession> {
    try {
      const [result] = await getDatabasePool().execute<ResultSetHeader>(
        "INSERT INTO quiz_sessions (quiz_id, host_id, class_id, group_id, game_code, mode, status) VALUES (?, ?, ?, ?, ?, ?, 'WAITING')",
        [input.quizId, input.hostId, input.classId, input.groupId, input.gameCode, input.mode],
      );

      return {
        id: String(result.insertId),
        quizId: input.quizId,
        hostId: input.hostId,
        classId: input.classId,
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
        throw new QuizSessionReferenceError("quiz, host, class, or group does not exist");
      }
      throw error;
    }
  }
}

function isDatabaseError(error: unknown, code: string): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === code;
}
