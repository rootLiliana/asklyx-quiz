import type { ResultSetHeader, RowDataPacket } from "mysql2";
import type { PoolConnection } from "mysql2/promise";

import { getDatabasePool } from "../db.js";
import type {
  CreateQuizContent,
  CreateStoredQuestion,
  QuizContent,
  QuizSummary,
  StoredOption,
  StoredQuestion,
} from "./quiz-content.types.js";

interface QuizRow extends RowDataPacket {
  id: number | string;
  class_id: number | string;
  title: string;
  description: string | null;
  time_limit_seconds: number | null;
  created_by: number | string;
  kind: string;
}

interface QuizSummaryRow extends RowDataPacket {
  id: number | string;
  title: string;
  description: string | null;
  class_id: number | string;
  class_name: string;
  class_date: Date | string | null;
  group_id: number | string;
  group_name: string | null;
  question_count: number | string;
  has_results: number | string | boolean;
}

interface QuestionRow extends RowDataPacket {
  id: number | string;
  question_text: string;
  explanation: string | null;
  question_order: number;
  points: number | string;
}

interface OptionRow extends RowDataPacket {
  id: number | string;
  question_id: number | string;
  option_text: string;
  option_order: number;
  is_correct: number | boolean;
}

export interface QuizContentRepository {
  create(content: CreateQuizContent): Promise<QuizContent>;
  findById(id: string): Promise<QuizContent | null>;
  findAll(classId?: string): Promise<QuizSummary[]>;
  // ¿Alguna sesión de este quiz tiene resultados guardados (quiz_attempts)?
  hasResults(id: string): Promise<boolean>;
  // Reemplaza datos y preguntas del quiz. null si el quiz no existe.
  update(id: string, content: CreateQuizContent): Promise<QuizContent | null>;
  // false si el quiz no existe.
  delete(id: string): Promise<boolean>;
}

export class QuizContentConflictError extends Error {}
// El quiz ya se usó en alguna sesión (quiz_sessions lo referencia), así que
// no se puede borrar sin perder ese historial.
export class QuizContentInUseError extends Error {}

const SUMMARY_SELECT = `
  SELECT q.id, q.title, q.description, q.class_id,
         c.name AS class_name, c.class_date, c.group_id, g.name AS group_name,
         (SELECT COUNT(*) FROM questions qu WHERE qu.quiz_id = q.id) AS question_count,
         EXISTS (
           SELECT 1 FROM quiz_sessions qs JOIN quiz_attempts a ON a.session_id = qs.id WHERE qs.quiz_id = q.id
         ) AS has_results
  FROM quizzes q
  JOIN classes c ON c.id = q.class_id
  LEFT JOIN user_groups g ON g.id = c.group_id`;

export class MysqlQuizContentRepository implements QuizContentRepository {
  async create(content: CreateQuizContent): Promise<QuizContent> {
    const connection = await getDatabasePool().getConnection();

    try {
      await connection.beginTransaction();
      const [quizResult] = await connection.execute<ResultSetHeader>(
        "INSERT INTO quizzes (class_id, title, description, time_limit_seconds, created_by) VALUES (?, ?, ?, ?, ?)",
        [content.classId, content.title, content.description, content.timeLimitSeconds, content.createdBy],
      );
      const quizId = String(quizResult.insertId);

      await insertQuestions(connection, quizId, content.questions);
      await connection.commit();
      const quiz = await this.findById(quizId);

      if (!quiz) {
        throw new Error("Quiz was created but could not be retrieved");
      }

      return quiz;
    } catch (error: unknown) {
      await connection.rollback();

      if (isDuplicateEntryError(error)) {
        throw new QuizContentConflictError("Question or option order is already in use");
      }

      throw error;
    } finally {
      connection.release();
    }
  }

  async update(id: string, content: CreateQuizContent): Promise<QuizContent | null> {
    const connection = await getDatabasePool().getConnection();

    try {
      await connection.beginTransaction();
      const [existing] = await connection.execute<RowDataPacket[]>(
        "SELECT id FROM quizzes WHERE id = ? LIMIT 1 FOR UPDATE",
        [id],
      );

      if (existing.length === 0) {
        await connection.rollback();
        return null;
      }

      await connection.execute<ResultSetHeader>(
        "UPDATE quizzes SET class_id = ?, title = ?, description = ?, time_limit_seconds = ? WHERE id = ?",
        [content.classId, content.title, content.description, content.timeLimitSeconds, id],
      );
      await deleteQuestions(connection, id);
      await insertQuestions(connection, id, content.questions);
      await connection.commit();
    } catch (error: unknown) {
      await connection.rollback();

      if (isDuplicateEntryError(error)) {
        throw new QuizContentConflictError("Question or option order is already in use");
      }
      if (isReferencedRowError(error)) {
        throw new QuizContentInUseError("The quiz questions are referenced by other records and cannot be replaced");
      }

      throw error;
    } finally {
      connection.release();
    }

    return this.findById(id);
  }

  async delete(id: string): Promise<boolean> {
    const connection = await getDatabasePool().getConnection();

    try {
      await connection.beginTransaction();
      await deleteQuestions(connection, id);
      const [result] = await connection.execute<ResultSetHeader>("DELETE FROM quizzes WHERE id = ?", [id]);
      await connection.commit();

      return result.affectedRows > 0;
    } catch (error: unknown) {
      await connection.rollback();

      if (isReferencedRowError(error)) {
        throw new QuizContentInUseError("The quiz has already been used in a session and cannot be deleted");
      }

      throw error;
    } finally {
      connection.release();
    }
  }

  async hasResults(id: string): Promise<boolean> {
    const [rows] = await getDatabasePool().execute<RowDataPacket[]>(
      `SELECT 1 FROM quiz_sessions qs JOIN quiz_attempts a ON a.session_id = qs.id
       WHERE qs.quiz_id = ? LIMIT 1`,
      [id],
    );
    return rows.length > 0;
  }

  async findAll(classId?: string): Promise<QuizSummary[]> {
    const [rows] = classId
      ? await getDatabasePool().execute<QuizSummaryRow[]>(
          `${SUMMARY_SELECT} WHERE q.kind = 'LIVE' AND q.class_id = ? ORDER BY c.class_date DESC, q.id DESC`,
          [classId],
        )
      : await getDatabasePool().execute<QuizSummaryRow[]>(
          `${SUMMARY_SELECT} WHERE q.kind = 'LIVE' ORDER BY c.class_date DESC, q.id DESC`,
        );

    return rows.map(toQuizSummary);
  }

  async findById(id: string): Promise<QuizContent | null> {
    const [quizRows] = await getDatabasePool().execute<QuizRow[]>(
      "SELECT id, class_id, title, description, time_limit_seconds, created_by, kind FROM quizzes WHERE id = ? LIMIT 1",
      [id],
    );
    const quizRow = quizRows[0];

    if (!quizRow) {
      return null;
    }

    const [questionRows] = await getDatabasePool().execute<QuestionRow[]>(
      "SELECT id, question_text, explanation, question_order, points FROM questions WHERE quiz_id = ? ORDER BY question_order ASC",
      [id],
    );
    const questions = questionRows.map(toStoredQuestion);
    const optionsByQuestion = await this.findOptionsByQuestion(questions.map((question) => question.id));

    return {
      id: String(quizRow.id),
      classId: String(quizRow.class_id),
      title: quizRow.title,
      description: quizRow.description,
      timeLimitSeconds: quizRow.time_limit_seconds,
      createdBy: String(quizRow.created_by),
      kind: quizRow.kind === "PRACTICE" ? "PRACTICE" : "LIVE",
      questions: questions.map((question) => ({
        ...question,
        options: optionsByQuestion.get(question.id) ?? [],
      })),
    };
  }

  private async findOptionsByQuestion(questionIds: string[]): Promise<Map<string, StoredOption[]>> {
    const optionsByQuestion = new Map<string, StoredOption[]>();

    if (questionIds.length === 0) {
      return optionsByQuestion;
    }

    const placeholders = questionIds.map(() => "?").join(", ");
    const [optionRows] = await getDatabasePool().execute<OptionRow[]>(
      `SELECT id, question_id, option_text, option_order, is_correct FROM options WHERE question_id IN (${placeholders}) ORDER BY question_id ASC, option_order ASC`,
      questionIds,
    );

    for (const row of optionRows) {
      const questionId = String(row.question_id);
      const currentOptions = optionsByQuestion.get(questionId) ?? [];
      currentOptions.push({
        id: String(row.id),
        text: row.option_text,
        optionOrder: row.option_order,
        isCorrect: row.is_correct === 1 || row.is_correct === true,
      });
      optionsByQuestion.set(questionId, currentOptions);
    }

    return optionsByQuestion;
  }
}

function toStoredQuestion(row: QuestionRow): StoredQuestion {
  return {
    id: String(row.id),
    text: row.question_text,
    explanation: row.explanation,
    questionOrder: row.question_order,
    points: Number(row.points),
    options: [],
  };
}

async function insertQuestions(connection: PoolConnection, quizId: string, questions: CreateStoredQuestion[]): Promise<void> {
  for (const question of questions) {
    const [questionResult] = await connection.execute<ResultSetHeader>(
      "INSERT INTO questions (quiz_id, question_text, explanation, question_order, points) VALUES (?, ?, ?, ?, ?)",
      [quizId, question.text, question.explanation, question.questionOrder, question.points],
    );
    const questionId = String(questionResult.insertId);

    for (const option of question.options) {
      await connection.execute<ResultSetHeader>(
        "INSERT INTO options (question_id, option_text, option_order, is_correct) VALUES (?, ?, ?, ?)",
        [questionId, option.text, option.optionOrder, option.isCorrect],
      );
    }
  }
}

async function deleteQuestions(connection: PoolConnection, quizId: string): Promise<void> {
  await connection.execute<ResultSetHeader>(
    "DELETE FROM options WHERE question_id IN (SELECT id FROM questions WHERE quiz_id = ?)",
    [quizId],
  );
  await connection.execute<ResultSetHeader>("DELETE FROM questions WHERE quiz_id = ?", [quizId]);
}

function toQuizSummary(row: QuizSummaryRow): QuizSummary {
  return {
    id: String(row.id),
    title: row.title,
    description: row.description,
    classId: String(row.class_id),
    className: row.class_name,
    classDate: row.class_date instanceof Date ? row.class_date.toISOString() : row.class_date,
    groupId: String(row.group_id),
    groupName: row.group_name,
    questionCount: Number(row.question_count),
    hasResults: Number(row.has_results) === 1 || row.has_results === true,
  };
}

function isReferencedRowError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ER_ROW_IS_REFERENCED_2";
}

function isDuplicateEntryError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ER_DUP_ENTRY";
}
