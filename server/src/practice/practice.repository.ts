import type { ResultSetHeader, RowDataPacket } from "mysql2";
import type { PoolConnection } from "mysql2/promise";

import { getDatabasePool } from "../db.js";
import type {
  PracticeAttempt,
  PracticeQuestion,
  PracticeQuestionInput,
  PracticeQuestionType,
  PracticeQuiz,
  PracticeQuizInput,
  PracticeQuizSummary,
  PracticeStudentStat,
  StudentPracticeSummary,
} from "./practice.types.js";

// Ya hay intentos que usan esa pregunta/opción (o el quiz): no se puede borrar.
export class PracticeInUseError extends Error {}
export class PracticeAlreadyAnsweredError extends Error {}

interface QuizRow extends RowDataPacket {
  id: number | string;
  class_id: number | string;
  lesson_id: number | string | null;
  title: string;
  published_at: Date | string | null;
  created_by: number | string;
}

interface QuestionRow extends RowDataPacket {
  id: number | string;
  question_type: string;
  question_text: string;
  explanation: string | null;
  code_snippet: string | null;
  accepted_answers: string[] | string | null;
  model_solution: string | null;
}

interface OptionRow extends RowDataPacket {
  id: number | string;
  question_id: number | string;
  option_text: string;
  is_correct: number | boolean;
}

// Intentos terminados por (quiz, alumno): para estadísticas.
interface BestRow extends RowDataPacket {
  quiz_id: number | string;
  student_id: number | string;
  attempts: number | string;
  best: number | string | null;
}

const ORDER_OFFSET = 100_000;

function toIso(value: Date | string | null): string | null {
  if (value === null) return null;
  return value instanceof Date ? value.toISOString() : value;
}

function toType(value: string): PracticeQuestionType {
  return value === "SHORT_ANSWER" || value === "CODE_OUTPUT" || value === "CODE_WRITING" ? value : "MULTIPLE_CHOICE";
}

function parseAccepted(value: string[] | string | null): string[] {
  if (value === null) return [];
  return typeof value === "string" ? JSON.parse(value) as string[] : value;
}

function isDatabaseError(error: unknown, code: string): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === code;
}

// % de un intento terminado, en SQL.
const PERCENT = "a.correct_answers * 100 / NULLIF(a.total_questions, 0)";

export interface PracticeRepository {
  listForLesson(lessonId: string): Promise<PracticeQuizSummary[]>;
  findById(id: string): Promise<PracticeQuiz | null>;
  create(classId: string, lessonId: string, input: PracticeQuizInput, createdBy: string): Promise<string>;
  update(id: string, input: PracticeQuizInput): Promise<void>;
  // false si no existe. PracticeInUseError si ya tiene intentos.
  delete(id: string): Promise<boolean>;
  studentStats(quizId: string): Promise<PracticeStudentStat[]>;

  listForStudent(userId: string, now: Date): Promise<StudentPracticeSummary[]>;
  // La quiz_session permanente (mode PRACTICE) de ese quiz; la crea si no existe.
  ensureSession(quiz: PracticeQuiz): Promise<string>;
  // ¿La alumna está en algún grupo que tiene una clase de esa sesión?
  isLessonVisibleTo(lessonId: string, userId: string): Promise<boolean>;
  createAttempt(sessionId: string, studentId: string, totalQuestions: number): Promise<string>;
  findAttempt(id: string): Promise<PracticeAttempt | null>;
  saveAnswer(attemptId: string, answer: { questionId: string; optionId: string | null; answerText: string | null; isCorrect: boolean; selfAssessed: boolean }): Promise<void>;
  // Calcula aciertos y marca el intento como terminado.
  finishAttempt(id: string): Promise<{ correctAnswers: number; totalQuestions: number }>;
}

export class MysqlPracticeRepository implements PracticeRepository {
  async listForLesson(lessonId: string): Promise<PracticeQuizSummary[]> {
    const database = getDatabasePool();
    const [[quizRows], [bestRows]] = await Promise.all([
      database.execute<RowDataPacket[]>(
        `SELECT q.id, q.title, q.published_at, (SELECT COUNT(*) FROM questions qu WHERE qu.quiz_id = q.id) AS question_count
         FROM quizzes q WHERE q.lesson_id = ? AND q.kind = 'PRACTICE' ORDER BY q.id ASC`,
        [lessonId],
      ),
      database.execute<BestRow[]>(
        `SELECT s.quiz_id, a.student_id, COUNT(*) AS attempts, MAX(${PERCENT}) AS best
         FROM quiz_attempts a
         JOIN quiz_sessions s ON s.id = a.session_id AND s.mode = 'PRACTICE'
         JOIN quizzes q ON q.id = s.quiz_id
         WHERE q.lesson_id = ? AND a.completed_at IS NOT NULL
         GROUP BY s.quiz_id, a.student_id`,
        [lessonId],
      ),
    ]);

    return quizRows.map((row) => {
      const best = bestRows.filter((item) => String(item.quiz_id) === String(row.id));
      const average = best.length > 0
        ? Math.round(best.reduce((sum, item) => sum + Number(item.best ?? 0), 0) / best.length)
        : null;
      return {
        id: String(row.id),
        title: row.title,
        publishedAt: toIso(row.published_at),
        questionCount: Number(row.question_count),
        students: best.length,
        attempts: best.reduce((sum, item) => sum + Number(item.attempts), 0),
        averageBestPercentage: average,
      };
    });
  }

  async findById(id: string): Promise<PracticeQuiz | null> {
    const database = getDatabasePool();
    const [quizRows] = await database.execute<QuizRow[]>(
      "SELECT id, class_id, lesson_id, title, published_at, created_by FROM quizzes WHERE id = ? AND kind = 'PRACTICE' LIMIT 1",
      [id],
    );
    const quiz = quizRows[0];
    if (!quiz) return null;

    const [questionRows] = await database.execute<QuestionRow[]>(
      `SELECT id, question_type, question_text, explanation, code_snippet, accepted_answers, model_solution
       FROM questions WHERE quiz_id = ? ORDER BY question_order ASC`,
      [id],
    );
    const questionIds = questionRows.map((row) => String(row.id));
    const [optionRows] = questionIds.length > 0
      ? await database.execute<OptionRow[]>(
          `SELECT id, question_id, option_text, is_correct FROM options
           WHERE question_id IN (${questionIds.map(() => "?").join(", ")}) ORDER BY option_order ASC`,
          questionIds,
        )
      : [[] as OptionRow[]];

    return {
      id: String(quiz.id),
      classId: String(quiz.class_id),
      lessonId: quiz.lesson_id === null ? null : String(quiz.lesson_id),
      title: quiz.title,
      publishedAt: toIso(quiz.published_at),
      createdBy: String(quiz.created_by),
      questions: questionRows.map((row): PracticeQuestion => ({
        id: String(row.id),
        type: toType(row.question_type),
        text: row.question_text,
        explanation: row.explanation,
        code: row.code_snippet,
        options: optionRows
          .filter((option) => String(option.question_id) === String(row.id))
          .map((option) => ({ id: String(option.id), text: option.option_text, isCorrect: option.is_correct === 1 || option.is_correct === true })),
        acceptedAnswers: parseAccepted(row.accepted_answers),
        modelSolution: row.model_solution,
      })),
    };
  }

  async create(classId: string, lessonId: string, input: PracticeQuizInput, createdBy: string): Promise<string> {
    return this.inTransaction(async (connection) => {
      const [result] = await connection.execute<ResultSetHeader>(
        "INSERT INTO quizzes (class_id, lesson_id, title, kind, published_at, created_by) VALUES (?, ?, ?, 'PRACTICE', ?, ?)",
        [classId, lessonId, input.title, input.publishedAt, createdBy],
      );
      const quizId = String(result.insertId);
      for (const [index, question] of input.questions.entries()) {
        await insertQuestion(connection, quizId, question, index + 1);
      }
      return quizId;
    });
  }

  async update(id: string, input: PracticeQuizInput): Promise<void> {
    await this.inTransaction(async (connection) => {
      await connection.execute<ResultSetHeader>(
        "UPDATE quizzes SET title = ?, published_at = ? WHERE id = ? AND kind = 'PRACTICE'",
        [input.title, input.publishedAt, id],
      );

      const [existingRows] = await connection.execute<RowDataPacket[]>("SELECT id FROM questions WHERE quiz_id = ?", [id]);
      const existingIds = new Set(existingRows.map((row) => String(row.id)));
      const keptIds = new Set(input.questions.map((question) => question.id).filter((value): value is string => value !== null && existingIds.has(value)));

      // Preguntas quitadas (falla si alguien ya las contestó).
      for (const questionId of existingIds) {
        if (!keptIds.has(questionId)) {
          await connection.execute<ResultSetHeader>("DELETE FROM options WHERE question_id = ?", [questionId]);
          await connection.execute<ResultSetHeader>("DELETE FROM questions WHERE id = ?", [questionId]);
        }
      }

      // Libera los números de orden para poder reordenar sin chocar con los índices únicos.
      await connection.execute<ResultSetHeader>(
        "UPDATE questions SET question_order = question_order + ? WHERE quiz_id = ?",
        [ORDER_OFFSET, id],
      );

      for (const [index, question] of input.questions.entries()) {
        if (question.id !== null && keptIds.has(question.id)) {
          await connection.execute<ResultSetHeader>(
            `UPDATE questions SET question_type = ?, question_text = ?, explanation = ?, code_snippet = ?,
               accepted_answers = ?, model_solution = ?, question_order = ? WHERE id = ?`,
            [
              question.type, question.text, question.explanation, question.code,
              question.type === "SHORT_ANSWER" || question.type === "CODE_OUTPUT" ? JSON.stringify(question.acceptedAnswers) : null,
              question.modelSolution, index + 1, question.id,
            ],
          );
          await syncOptions(connection, question.id, question.type === "MULTIPLE_CHOICE" ? question.options : []);
        } else {
          await insertQuestion(connection, id, question, index + 1);
        }
      }
    });
  }

  async delete(id: string): Promise<boolean> {
    const [attemptRows] = await getDatabasePool().execute<RowDataPacket[]>(
      `SELECT 1 FROM quiz_attempts a JOIN quiz_sessions s ON s.id = a.session_id WHERE s.quiz_id = ? LIMIT 1`,
      [id],
    );
    if (attemptRows.length > 0) {
      throw new PracticeInUseError("The practice quiz already has attempts");
    }

    return this.inTransaction(async (connection) => {
      const [quizRows] = await connection.execute<RowDataPacket[]>(
        "SELECT id FROM quizzes WHERE id = ? AND kind = 'PRACTICE' FOR UPDATE",
        [id],
      );
      if (quizRows.length === 0) return false;

      await connection.execute<ResultSetHeader>("DELETE FROM quiz_sessions WHERE quiz_id = ? AND mode = 'PRACTICE'", [id]);
      await connection.execute<ResultSetHeader>(
        "DELETE FROM options WHERE question_id IN (SELECT id FROM questions WHERE quiz_id = ?)",
        [id],
      );
      await connection.execute<ResultSetHeader>("DELETE FROM questions WHERE quiz_id = ?", [id]);
      await connection.execute<ResultSetHeader>("DELETE FROM quizzes WHERE id = ?", [id]);
      return true;
    });
  }

  async studentStats(quizId: string): Promise<PracticeStudentStat[]> {
    const [rows] = await getDatabasePool().execute<RowDataPacket[]>(
      `SELECT u.id, u.name, u.last_name_paternal, u.nickname, COUNT(*) AS attempts,
              MAX(${PERCENT}) AS best, MAX(a.completed_at) AS last_attempt
       FROM quiz_attempts a
       JOIN quiz_sessions s ON s.id = a.session_id AND s.mode = 'PRACTICE'
       JOIN users u ON u.id = a.student_id
       WHERE s.quiz_id = ? AND a.completed_at IS NOT NULL
       GROUP BY u.id, u.name, u.last_name_paternal, u.nickname
       ORDER BY best DESC, u.name ASC`,
      [quizId],
    );

    return rows.map((row) => ({
      studentId: String(row.id),
      name: row.name,
      lastNamePaternal: row.last_name_paternal,
      nickname: row.nickname,
      attempts: Number(row.attempts),
      bestPercentage: Math.round(Number(row.best ?? 0)),
      lastAttemptAt: toIso(row.last_attempt),
    }));
  }

  async listForStudent(userId: string, now: Date): Promise<StudentPracticeSummary[]> {
    const database = getDatabasePool();
    const [[quizRows], [bestRows]] = await Promise.all([
      // `now` sale de Node, igual que en el material (misma zona horaria).
      database.execute<RowDataPacket[]>(
        `SELECT DISTINCT q.id, q.lesson_id, l.name AS lesson_name, q.title, (SELECT COUNT(*) FROM questions qu WHERE qu.quiz_id = q.id) AS question_count
         FROM quizzes q
         JOIN lessons l ON l.id = q.lesson_id
         JOIN classes c ON c.lesson_id = q.lesson_id
         JOIN group_members gm ON gm.group_id = c.group_id
         WHERE gm.user_id = ? AND q.kind = 'PRACTICE' AND q.published_at IS NOT NULL AND q.published_at <= ?
         ORDER BY q.id ASC`,
        [userId, now],
      ),
      database.execute<BestRow[]>(
        `SELECT s.quiz_id, a.student_id, COUNT(*) AS attempts, MAX(${PERCENT}) AS best
         FROM quiz_attempts a
         JOIN quiz_sessions s ON s.id = a.session_id AND s.mode = 'PRACTICE'
         WHERE a.student_id = ? AND a.completed_at IS NOT NULL
         GROUP BY s.quiz_id, a.student_id`,
        [userId],
      ),
    ]);

    return quizRows.map((row) => {
      const best = bestRows.find((item) => String(item.quiz_id) === String(row.id));
      return {
        quizId: String(row.id),
        lessonId: String(row.lesson_id),
        lessonName: String(row.lesson_name),
        title: row.title,
        questionCount: Number(row.question_count),
        attempts: best ? Number(best.attempts) : 0,
        bestPercentage: best ? Math.round(Number(best.best ?? 0)) : null,
      };
    });
  }

  async isLessonVisibleTo(lessonId: string, userId: string): Promise<boolean> {
    const [rows] = await getDatabasePool().execute<RowDataPacket[]>(
      `SELECT 1 FROM classes c JOIN group_members gm ON gm.group_id = c.group_id
       WHERE c.lesson_id = ? AND gm.user_id = ? LIMIT 1`,
      [lessonId, userId],
    );
    return rows.length > 0;
  }

  async ensureSession(quiz: PracticeQuiz): Promise<string> {
    const find = async () => {
      const [rows] = await getDatabasePool().execute<RowDataPacket[]>(
        "SELECT id FROM quiz_sessions WHERE quiz_id = ? AND mode = 'PRACTICE' LIMIT 1",
        [quiz.id],
      );
      return rows[0] ? String(rows[0].id) : null;
    };

    const existing = await find();
    if (existing) return existing;

    try {
      const [result] = await getDatabasePool().execute<ResultSetHeader>(
        // De todos los grupos de la sesión: sin grupo ni clase concretos.
        `INSERT INTO quiz_sessions (quiz_id, host_id, group_id, class_id, game_code, mode, status)
         VALUES (?, ?, NULL, NULL, ?, 'PRACTICE', 'IN_PROGRESS')`,
        [quiz.id, quiz.createdBy, `PRAC-${quiz.id}`],
      );
      return String(result.insertId);
    } catch (error: unknown) {
      // Otra alumna la creó al mismo tiempo: se usa esa.
      if (isDatabaseError(error, "ER_DUP_ENTRY")) {
        const created = await find();
        if (created) return created;
      }
      throw error;
    }
  }

  async createAttempt(sessionId: string, studentId: string, totalQuestions: number): Promise<string> {
    const [result] = await getDatabasePool().execute<ResultSetHeader>(
      `INSERT INTO quiz_attempts (session_id, student_id, score, correct_answers, total_questions, started_at)
       VALUES (?, ?, 0, 0, ?, ?)`,
      [sessionId, studentId, totalQuestions, new Date()],
    );
    return String(result.insertId);
  }

  async findAttempt(id: string): Promise<PracticeAttempt | null> {
    const [rows] = await getDatabasePool().execute<RowDataPacket[]>(
      `SELECT a.id, a.session_id, s.quiz_id, a.student_id, a.total_questions, a.completed_at
       FROM quiz_attempts a JOIN quiz_sessions s ON s.id = a.session_id AND s.mode = 'PRACTICE'
       WHERE a.id = ? LIMIT 1`,
      [id],
    );
    const row = rows[0];
    return row
      ? {
          id: String(row.id),
          sessionId: String(row.session_id),
          quizId: String(row.quiz_id),
          studentId: String(row.student_id),
          totalQuestions: Number(row.total_questions),
          completedAt: toIso(row.completed_at),
        }
      : null;
  }

  async saveAnswer(attemptId: string, answer: { questionId: string; optionId: string | null; answerText: string | null; isCorrect: boolean; selfAssessed: boolean }): Promise<void> {
    try {
      await getDatabasePool().execute<ResultSetHeader>(
        `INSERT INTO quiz_answers (attempt_id, question_id, selected_option_id, answer_text, is_correct, self_assessed, points_earned)
         VALUES (?, ?, ?, ?, ?, ?, 0)`,
        [attemptId, answer.questionId, answer.optionId, answer.answerText, answer.isCorrect, answer.selfAssessed],
      );
    } catch (error: unknown) {
      if (isDatabaseError(error, "ER_DUP_ENTRY")) {
        throw new PracticeAlreadyAnsweredError("This question was already answered in this attempt");
      }
      throw error;
    }
  }

  async finishAttempt(id: string): Promise<{ correctAnswers: number; totalQuestions: number }> {
    const database = getDatabasePool();
    const [rows] = await database.execute<RowDataPacket[]>(
      "SELECT COALESCE(SUM(is_correct), 0) AS correct FROM quiz_answers WHERE attempt_id = ?",
      [id],
    );
    const correctAnswers = Number(rows[0]?.correct ?? 0);

    await database.execute<ResultSetHeader>(
      "UPDATE quiz_attempts SET correct_answers = ?, completed_at = ? WHERE id = ? AND completed_at IS NULL",
      [correctAnswers, new Date(), id],
    );
    const [attemptRows] = await database.execute<RowDataPacket[]>("SELECT total_questions FROM quiz_attempts WHERE id = ?", [id]);
    return { correctAnswers, totalQuestions: Number(attemptRows[0]?.total_questions ?? 0) };
  }

  private async inTransaction<T>(work: (connection: PoolConnection) => Promise<T>): Promise<T> {
    const connection = await getDatabasePool().getConnection();
    try {
      await connection.beginTransaction();
      const result = await work(connection);
      await connection.commit();
      return result;
    } catch (error: unknown) {
      await connection.rollback();
      if (isDatabaseError(error, "ER_ROW_IS_REFERENCED_2")) {
        throw new PracticeInUseError("A question or option that was already answered cannot be removed");
      }
      throw error;
    } finally {
      connection.release();
    }
  }
}

async function insertQuestion(connection: PoolConnection, quizId: string, question: PracticeQuestionInput, order: number): Promise<void> {
  const [result] = await connection.execute<ResultSetHeader>(
    `INSERT INTO questions (quiz_id, question_type, question_text, explanation, code_snippet, accepted_answers, model_solution, question_order, points)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`,
    [
      quizId, question.type, question.text, question.explanation, question.code,
      question.type === "SHORT_ANSWER" || question.type === "CODE_OUTPUT" ? JSON.stringify(question.acceptedAnswers) : null,
      question.modelSolution, order,
    ],
  );
  if (question.type === "MULTIPLE_CHOICE") {
    await syncOptions(connection, String(result.insertId), question.options);
  }
}

// Deja las opciones de una pregunta como `options`: actualiza por id las que
// ya existen, agrega las nuevas y quita las demás (falla si ya se eligieron).
async function syncOptions(connection: PoolConnection, questionId: string, options: PracticeQuestionInput["options"]): Promise<void> {
  const [existingRows] = await connection.execute<RowDataPacket[]>("SELECT id FROM options WHERE question_id = ?", [questionId]);
  const existingIds = new Set(existingRows.map((row) => String(row.id)));
  const keptIds = new Set(options.map((option) => option.id).filter((value): value is string => value !== null && existingIds.has(value)));

  for (const optionId of existingIds) {
    if (!keptIds.has(optionId)) {
      await connection.execute<ResultSetHeader>("DELETE FROM options WHERE id = ?", [optionId]);
    }
  }
  await connection.execute<ResultSetHeader>(
    "UPDATE options SET option_order = option_order + ? WHERE question_id = ?",
    [ORDER_OFFSET, questionId],
  );

  for (const [index, option] of options.entries()) {
    if (option.id !== null && keptIds.has(option.id)) {
      await connection.execute<ResultSetHeader>(
        "UPDATE options SET option_text = ?, is_correct = ?, option_order = ? WHERE id = ?",
        [option.text, option.isCorrect, index + 1, option.id],
      );
    } else {
      await connection.execute<ResultSetHeader>(
        "INSERT INTO options (question_id, option_text, option_order, is_correct) VALUES (?, ?, ?, ?)",
        [questionId, option.text, index + 1, option.isCorrect],
      );
    }
  }
}
