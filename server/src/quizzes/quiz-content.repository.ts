import type { ResultSetHeader, RowDataPacket } from "mysql2";

import { getDatabasePool } from "../db.js";
import type {
  CreateQuizContent,
  QuizContent,
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
}

export class QuizContentConflictError extends Error {}

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

      for (const question of content.questions) {
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

  async findById(id: string): Promise<QuizContent | null> {
    const [quizRows] = await getDatabasePool().execute<QuizRow[]>(
      "SELECT id, class_id, title, description, time_limit_seconds, created_by FROM quizzes WHERE id = ? LIMIT 1",
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

function isDuplicateEntryError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ER_DUP_ENTRY";
}
