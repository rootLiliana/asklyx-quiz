import type { ClassRepository } from "../classes/class.repository.js";
import type { Question } from "../types/Question.js";
import { toGameManagerQuestions, toStoredQuestions } from "./quiz-content.mapper.js";
import type { QuizContentRepository } from "./quiz-content.repository.js";
import type { CreateQuizContentInput, QuizContent } from "./quiz-content.types.js";

export class QuizContentInputError extends Error {}
export class QuizContentClassNotFoundError extends Error {}
export class QuizContentGroupMismatchError extends Error {}

export class QuizContentService {
  constructor(
    private readonly quizzes: QuizContentRepository,
    private readonly classes: ClassRepository,
  ) {}

  async create(input: CreateQuizContentInput): Promise<QuizContent> {
    const normalized = normalizeCreateInput(input);

    // classId lo elige la HOST explícitamente entre clases reales ya
    // existentes; aquí solo verificamos que exista, reutilizando
    // ClassRepository (sin SQL nuevo), en vez de dejar que una violación de
    // FK sin capturar llegue como error 500 genérico.
    const classItem = await this.classes.findById(normalized.classId);
    if (!classItem) {
      throw new QuizContentClassNotFoundError("Class not found");
    }

    return this.quizzes.create({
      classId: normalized.classId,
      title: normalized.title,
      description: normalized.description ?? null,
      timeLimitSeconds: normalized.timeLimitSeconds ?? null,
      createdBy: normalized.createdBy,
      questions: toStoredQuestions(normalized.questions),
    });
  }

  // Resuelve el groupId real que corresponde a un quiz ya persistido, a
  // partir de la clase (quiz.classId) a la que quedó asociado al guardarse.
  // Si el llamador propone un groupId (p. ej. porque el frontend lo envía de
  // forma explícita), se verifica que coincida exactamente con el de la
  // clase real: nunca se acepta un groupId arbitrario que no sea el de esa
  // clase. Reutiliza ClassRepository, sin SQL nuevo.
  async resolveGroupIdForQuiz(quiz: QuizContent, requestedGroupId: string | null): Promise<string> {
    const classItem = await this.classes.findById(quiz.classId);
    if (!classItem) {
      throw new QuizContentClassNotFoundError("The quiz's class no longer exists");
    }

    if (requestedGroupId !== null && requestedGroupId !== classItem.groupId) {
      throw new QuizContentGroupMismatchError("groupId does not match the group of the quiz's class");
    }

    return classItem.groupId;
  }

  getById(id: string): Promise<QuizContent | null> {
    if (!/^\d+$/.test(id)) {
      throw new QuizContentInputError("quiz id must be a positive integer");
    }

    return this.quizzes.findById(id);
  }

  async getGameManagerQuestions(id: string): Promise<Question[] | null> {
    const quiz = await this.getById(id);
    return quiz ? toGameManagerQuestions(quiz) : null;
  }
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
