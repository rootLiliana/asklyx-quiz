import type { ClassRepository } from "../classes/class.repository.js";
import type { Question } from "../types/Question.js";
import { toGameManagerQuestions, toStoredQuestions } from "./quiz-content.mapper.js";
import type { QuizContentRepository } from "./quiz-content.repository.js";
import type { CreateQuizContent, CreateQuizContentInput, QuizContent, QuizSummary } from "./quiz-content.types.js";

export class QuizContentInputError extends Error {}
export class QuizContentNotFoundError extends Error {}
export class QuizContentClassNotFoundError extends Error {}

export class QuizContentService {
  constructor(
    private readonly quizzes: QuizContentRepository,
    private readonly classes: ClassRepository,
  ) {}

  async create(input: CreateQuizContentInput): Promise<QuizContent> {
    return this.quizzes.create(await this.prepareContent(input));
  }

  // Reemplaza título, clase y preguntas de un quiz ya guardado. createdBy se
  // conserva tal cual quedó al crearlo (no se modifica en la tabla).
  async update(id: string, input: CreateQuizContentInput): Promise<QuizContent> {
    const quiz = await this.quizzes.update(validateQuizId(id), await this.prepareContent(input));

    if (!quiz) {
      throw new QuizContentNotFoundError("Quiz not found");
    }

    return quiz;
  }

  async delete(id: string): Promise<void> {
    const deleted = await this.quizzes.delete(validateQuizId(id));

    if (!deleted) {
      throw new QuizContentNotFoundError("Quiz not found");
    }
  }

  list(classId?: string): Promise<QuizSummary[]> {
    if (classId !== undefined && !/^\d+$/.test(classId)) {
      throw new QuizContentInputError("classId must be a positive integer");
    }

    return this.quizzes.findAll(classId);
  }

  private async prepareContent(input: CreateQuizContentInput): Promise<CreateQuizContent> {
    const normalized = normalizeCreateInput(input);

    // classId lo elige la HOST explícitamente entre clases reales ya
    // existentes; aquí solo verificamos que exista, reutilizando
    // ClassRepository (sin SQL nuevo), en vez de dejar que una violación de
    // FK sin capturar llegue como error 500 genérico.
    const classItem = await this.classes.findById(normalized.classId);
    if (!classItem) {
      throw new QuizContentClassNotFoundError("Class not found");
    }

    return {
      classId: normalized.classId,
      title: normalized.title.trim(),
      description: normalized.description?.trim() || null,
      timeLimitSeconds: normalized.timeLimitSeconds ?? null,
      createdBy: normalized.createdBy,
      questions: toStoredQuestions(normalized.questions),
    };
  }

  getById(id: string): Promise<QuizContent | null> {
    return this.quizzes.findById(validateQuizId(id));
  }

  async getGameManagerQuestions(id: string): Promise<Question[] | null> {
    const quiz = await this.getById(id);
    return quiz ? toGameManagerQuestions(quiz) : null;
  }
}

function validateQuizId(id: string): string {
  if (!/^\d+$/.test(id)) {
    throw new QuizContentInputError("quiz id must be a positive integer");
  }

  return id;
}

function normalizeCreateInput(input: CreateQuizContentInput): CreateQuizContentInput {
  if (!/^\d+$/.test(input.classId) || !/^\d+$/.test(input.createdBy)) {
    throw new QuizContentInputError("classId and createdBy must be positive integers");
  }

  if (!input.title.trim()) {
    throw new QuizContentInputError("title is required");
  }

  if (input.timeLimitSeconds !== undefined && (!Number.isInteger(input.timeLimitSeconds) || input.timeLimitSeconds <= 0)) {
    throw new QuizContentInputError("timeLimitSeconds must be a positive integer");
  }

  input.questions.forEach(validateQuestion);

  return input;
}

function validateQuestion(question: Question): void {
  if (question.options.length === 0) {
    throw new QuizContentInputError("a question must have at least one option");
  }

  const correctOptionCount = question.options.reduce(
    (count, _, optionIndex) => count + Number(optionIndex === question.correctAnswer),
    0,
  );

  if (correctOptionCount !== 1) {
    throw new QuizContentInputError("a question must have exactly one correct option");
  }

  if (typeof question.explanation !== "string") {
    throw new QuizContentInputError("a question explanation is required");
  }
}
