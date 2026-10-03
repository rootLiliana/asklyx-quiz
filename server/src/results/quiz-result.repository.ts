import type { ResultSetHeader, RowDataPacket } from "mysql2";

import { getDatabasePool } from "../db.js";
import type {
  NewAttempt,
  QuestionResult,
  SessionResultSummary,
  StudentHistoryEntry,
  StudentResult,
} from "./quiz-result.types.js";

interface SessionRow extends RowDataPacket {
  id: number | string;
  game_code: string;
  played_at: Date | string | null;
  quiz_id: number | string;
  quiz_title: string;
  class_id: number | string;
  class_name: string;
  class_date: Date | string | null;
  group_id: number | string;
  group_name: string | null;
  students: number | string;
  average_percentage: number | string | null;
}

interface StudentRow extends RowDataPacket {
  id: number | string;
  name: string;
  last_name_paternal: string | null;
  nickname: string | null;
  correct_answers: number;
  total_questions: number;
  score: number | string;
}

interface QuestionRow extends RowDataPacket {
  question_id: number | string;
  question_text: string | null;
  answered: number | string;
  correct: number | string | null;
}

interface HistoryRow extends RowDataPacket {
  session_id: number | string;
  played_at: Date | string | null;
  quiz_title: string;
  class_name: string;
  class_date: Date | string | null;
  correct_answers: number;
  total_questions: number;
}

export interface QuizResultRepository {
  attemptExists(sessionId: string, studentId: string): Promise<boolean>;
  // Intento + respuestas en una sola transacción.
  saveAttempt(attempt: NewAttempt): Promise<void>;
  listSessions(groupId: string | null): Promise<SessionResultSummary[]>;
  findSession(sessionId: string): Promise<SessionResultSummary | null>;
  findStudentResults(sessionId: string): Promise<StudentResult[]>;
  findQuestionResults(sessionId: string): Promise<QuestionResult[]>;
  findStudentHistory(studentId: string): Promise<StudentHistoryEntry[]>;
}

export function percentage(correct: number, total: number): number {
  return total > 0 ? Math.round((correct / total) * 100) : 0;
}

function toIso(value: Date | string | null): string | null {
  if (value === null) return null;
  return value instanceof Date ? value.toISOString() : value;
}

// Juegos en vivo con al menos un resultado guardado. La clase sale de la
// sesión (o del quiz en sesiones anteriores a quiz_sessions.class_id).
const SESSION_SELECT = `
  SELECT qs.id, qs.game_code, COALESCE(qs.ended_at, qs.started_at, qs.created_at) AS played_at,
         q.id AS quiz_id, q.title AS quiz_title,
         c.id AS class_id, c.name AS class_name, c.class_date, c.group_id, g.name AS group_name,
         COUNT(a.id) AS students,
         AVG(a.correct_answers * 100 / NULLIF(a.total_questions, 0)) AS average_percentage
  FROM quiz_sessions qs
  JOIN quizzes q ON q.id = qs.quiz_id
  JOIN classes c ON c.id = COALESCE(qs.class_id, q.class_id)
  LEFT JOIN user_groups g ON g.id = c.group_id
  JOIN quiz_attempts a ON a.session_id = qs.id
  WHERE qs.mode = 'LIVE'`;

const SESSION_GROUP_BY = `
  GROUP BY qs.id, qs.game_code, qs.ended_at, qs.started_at, qs.created_at,
           q.id, q.title, c.id, c.name, c.class_date, c.group_id, g.name`;

function toSessionSummary(row: SessionRow): SessionResultSummary {
  return {
    sessionId: String(row.id),
    gameCode: row.game_code,
    playedAt: toIso(row.played_at),
    quizId: String(row.quiz_id),
    quizTitle: row.quiz_title,
    classId: String(row.class_id),
    className: row.class_name,
    classDate: toIso(row.class_date),
    groupId: String(row.group_id),
    groupName: row.group_name,
    students: Number(row.students),
    averagePercentage: Math.round(Number(row.average_percentage ?? 0)),
  };
}

export class MysqlQuizResultRepository implements QuizResultRepository {
  async attemptExists(sessionId: string, studentId: string): Promise<boolean> {
    const [rows] = await getDatabasePool().execute<RowDataPacket[]>(
      "SELECT 1 FROM quiz_attempts WHERE session_id = ? AND student_id = ? LIMIT 1",
      [sessionId, studentId],
    );
    return rows.length > 0;
  }

  async saveAttempt(attempt: NewAttempt): Promise<void> {
    const connection = await getDatabasePool().getConnection();

    try {
      await connection.beginTransaction();
      const [result] = await connection.execute<ResultSetHeader>(
        `INSERT INTO quiz_attempts (session_id, student_id, score, correct_answers, total_questions, started_at, completed_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          attempt.sessionId,
          attempt.studentId,
          attempt.score,
          attempt.correctAnswers,
          attempt.totalQuestions,
          attempt.startedAt,
          attempt.completedAt,
        ],
      );
      const attemptId = result.insertId;

      for (const answer of attempt.answers) {
        await connection.execute<ResultSetHeader>(
          `INSERT INTO quiz_answers (attempt_id, question_id, selected_option_id, is_correct, points_earned, response_ms)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [attemptId, answer.questionId, answer.selectedOptionId, answer.isCorrect, answer.pointsEarned, answer.responseMs],
        );
      }

      await connection.commit();
    } catch (error: unknown) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async listSessions(groupId: string | null): Promise<SessionResultSummary[]> {
    const [rows] = groupId
      ? await getDatabasePool().execute<SessionRow[]>(
          `${SESSION_SELECT} AND c.group_id = ? ${SESSION_GROUP_BY} ORDER BY played_at DESC`,
          [groupId],
        )
      : await getDatabasePool().execute<SessionRow[]>(`${SESSION_SELECT} ${SESSION_GROUP_BY} ORDER BY played_at DESC`);

    return rows.map(toSessionSummary);
  }

  async findSession(sessionId: string): Promise<SessionResultSummary | null> {
    const [rows] = await getDatabasePool().execute<SessionRow[]>(
      `${SESSION_SELECT} AND qs.id = ? ${SESSION_GROUP_BY}`,
      [sessionId],
    );
    const row = rows[0];
    return row ? toSessionSummary(row) : null;
  }

  async findStudentResults(sessionId: string): Promise<StudentResult[]> {
    const [rows] = await getDatabasePool().execute<StudentRow[]>(
      `SELECT u.id, u.name, u.last_name_paternal, u.nickname, a.correct_answers, a.total_questions, a.score
       FROM quiz_attempts a
       JOIN users u ON u.id = a.student_id
       WHERE a.session_id = ?`,
      [sessionId],
    );

    return rows
      .map((row) => ({
        studentId: String(row.id),
        name: row.name,
        lastNamePaternal: row.last_name_paternal,
        nickname: row.nickname,
        correctAnswers: row.correct_answers,
        totalQuestions: row.total_questions,
        percentage: percentage(row.correct_answers, row.total_questions),
        score: Number(row.score),
      }))
      .sort((a, b) => b.percentage - a.percentage || b.score - a.score);
  }

  async findQuestionResults(sessionId: string): Promise<QuestionResult[]> {
    // Parte de las respuestas (no de las preguntas actuales): si el quiz se
    // editó después, la estadística sigue ahí aunque el texto ya no exista.
    const [rows] = await getDatabasePool().execute<QuestionRow[]>(
      `SELECT ans.question_id, qu.question_text, COUNT(*) AS answered, SUM(ans.is_correct) AS correct
       FROM quiz_answers ans
       JOIN quiz_attempts a ON a.id = ans.attempt_id
       LEFT JOIN questions qu ON qu.id = ans.question_id
       WHERE a.session_id = ?
       GROUP BY ans.question_id, qu.question_text`,
      [sessionId],
    );

    return rows
      .map((row) => {
        const answered = Number(row.answered);
        const correct = Number(row.correct ?? 0);
        return {
          questionId: String(row.question_id),
          text: row.question_text,
          answered,
          correct,
          percentage: percentage(correct, answered),
        };
      })
      .sort((a, b) => a.percentage - b.percentage);
  }

  async findStudentHistory(studentId: string): Promise<StudentHistoryEntry[]> {
    const [rows] = await getDatabasePool().execute<HistoryRow[]>(
      `SELECT qs.id AS session_id, COALESCE(qs.ended_at, qs.started_at, qs.created_at) AS played_at,
              q.title AS quiz_title, c.name AS class_name, c.class_date,
              a.correct_answers, a.total_questions
       FROM quiz_attempts a
       JOIN quiz_sessions qs ON qs.id = a.session_id
       JOIN quizzes q ON q.id = qs.quiz_id
       JOIN classes c ON c.id = COALESCE(qs.class_id, q.class_id)
       WHERE a.student_id = ? AND qs.mode = 'LIVE'
       ORDER BY played_at DESC`,
      [studentId],
    );

    return rows.map((row) => ({
      sessionId: String(row.session_id),
      playedAt: toIso(row.played_at),
      quizTitle: row.quiz_title,
      className: row.class_name,
      classDate: toIso(row.class_date),
      correctAnswers: row.correct_answers,
      totalQuestions: row.total_questions,
      percentage: percentage(row.correct_answers, row.total_questions),
    }));
  }
}
