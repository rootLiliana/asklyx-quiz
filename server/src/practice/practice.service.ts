import type { ClassRepository } from "../classes/class.repository.js";
import type { GroupRepository } from "../groups/group.repository.js";
import { gradeAnswer } from "./practice.grading.js";
import type { PracticeRepository } from "./practice.repository.js";
import {
  PRACTICE_QUESTION_TYPES,
  type AnswerFeedback,
  type PracticeAnswerInput,
  type PracticeQuestion,
  type PracticeQuestionInput,
  type PracticeQuestionType,
  type PracticeQuiz,
  type PracticeQuizInput,
  type PracticeQuizSummary,
  type PracticeStudentStat,
  type PublicPracticeQuiz,
  type StudentPracticeSummary,
} from "./practice.types.js";

export class PracticeInputError extends Error {}
export class PracticeNotFoundError extends Error {}
export class PracticeAttemptFinishedError extends Error {}

const MAX_TITLE = 200;
const MAX_QUESTIONS = 100;
const MAX_TEXT = 5_000;
const MAX_CODE = 20_000;
const MAX_OPTION = 500;
const MAX_ACCEPTED = 10;

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? value as Record<string, unknown> : {};
}

function validateId(id: string, name: string): string {
  if (!/^\d+$/.test(id)) throw new PracticeInputError(`${name} must be a positive integer`);
  return id;
}

function optionalId(value: unknown): string | null {
  if (value === undefined || value === null || value === "") return null;
  const id = typeof value === "number" ? String(value) : value;
  return typeof id === "string" && /^\d+$/.test(id) ? id : null;
}

function optionalText(value: unknown, max: number, where: string): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") throw new PracticeInputError(`${where} must be text`);
  if (value.length > max) throw new PracticeInputError(`${where} is too long`);
  return value.trim() ? value : null;
}

function validateQuestion(raw: unknown, index: number): PracticeQuestionInput {
  const question = asRecord(raw);
  const where = `question ${index + 1}`;

  const type = question.type as PracticeQuestionType;
  if (!PRACTICE_QUESTION_TYPES.includes(type)) throw new PracticeInputError(`${where}: unknown type`);

  const text = optionalText(question.text, MAX_TEXT, `${where} text`);
  if (!text) throw new PracticeInputError(`${where}: write the question`);

  const code = optionalText(question.code, MAX_CODE, `${where} code`);
  const explanation = optionalText(question.explanation, MAX_TEXT, `${where} explanation`);
  let options: PracticeQuestionInput["options"] = [];
  let acceptedAnswers: string[] = [];
  let modelSolution: string | null = null;

  if (type === "MULTIPLE_CHOICE") {
    const rawOptions = Array.isArray(question.options) ? question.options : [];
    options = rawOptions.map((rawOption, optionIndex) => {
      const option = asRecord(rawOption);
      const optionText = optionalText(option.text, MAX_OPTION, `${where} option ${optionIndex + 1}`);
      if (!optionText) throw new PracticeInputError(`${where}: option ${optionIndex + 1} is empty`);
      return { id: optionalId(option.id), text: optionText.trim(), isCorrect: option.isCorrect === true };
    });
    if (options.length < 2 || options.length > 6) throw new PracticeInputError(`${where}: use between 2 and 6 options`);
    if (options.filter((option) => option.isCorrect).length !== 1) throw new PracticeInputError(`${where}: mark exactly one correct option`);
  }

  if (type === "SHORT_ANSWER" || type === "CODE_OUTPUT") {
    const rawAccepted = Array.isArray(question.acceptedAnswers) ? question.acceptedAnswers : [];
    acceptedAnswers = rawAccepted
      .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
      .map((value) => (type === "SHORT_ANSWER" ? value.trim() : value))
      .slice(0, MAX_ACCEPTED);
    if (acceptedAnswers.length === 0) throw new PracticeInputError(`${where}: add at least one accepted answer`);
    if (acceptedAnswers.some((value) => value.length > MAX_CODE)) throw new PracticeInputError(`${where}: an accepted answer is too long`);
    if (type === "CODE_OUTPUT" && !code) throw new PracticeInputError(`${where}: add the code whose output they must predict`);
  }

  if (type === "CODE_WRITING") {
    modelSolution = optionalText(question.modelSolution, MAX_CODE, `${where} model solution`);
    if (!modelSolution) throw new PracticeInputError(`${where}: add the model solution`);
  }

  return { id: optionalId(question.id), type, text: text.trim(), explanation: explanation?.trim() ?? null, code, options, acceptedAnswers, modelSolution };
}

export function validatePracticeInput(input: unknown): PracticeQuizInput {
  const body = asRecord(input);

  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (!title) throw new PracticeInputError("title is required");
  if (title.length > MAX_TITLE) throw new PracticeInputError(`title must be at most ${MAX_TITLE} characters`);

  if (!Array.isArray(body.questions) || body.questions.length === 0) throw new PracticeInputError("add at least one question");
  if (body.questions.length > MAX_QUESTIONS) throw new PracticeInputError(`at most ${MAX_QUESTIONS} questions`);

  let publishedAt: Date | null = null;
  if (body.publishedAt !== undefined && body.publishedAt !== null) {
    const date = typeof body.publishedAt === "string" ? new Date(body.publishedAt) : null;
    if (!date || Number.isNaN(date.getTime())) throw new PracticeInputError("publishedAt must be a valid date or null");
    publishedAt = date;
  }

  return { title, publishedAt, questions: body.questions.map(validateQuestion) };
}

function toPublicQuiz(quiz: PracticeQuiz): PublicPracticeQuiz {
  return {
    id: quiz.id,
    title: quiz.title,
    questions: quiz.questions.map((question) => ({
      id: question.id,
      type: question.type,
      text: question.text,
      code: question.code,
      options: question.type === "MULTIPLE_CHOICE" ? question.options.map((option) => ({ id: option.id, text: option.text })) : [],
    })),
  };
}

function feedbackFor(question: PracticeQuestion, correct: boolean): AnswerFeedback {
  const feedback: AnswerFeedback = { correct, explanation: question.explanation };
  if (question.type === "MULTIPLE_CHOICE") {
    const correctOption = question.options.find((option) => option.isCorrect);
    if (correctOption) feedback.correctOptionId = correctOption.id;
  }
  if ((question.type === "SHORT_ANSWER" || question.type === "CODE_OUTPUT") && question.acceptedAnswers[0] !== undefined) {
    feedback.expectedAnswer = question.acceptedAnswers[0];
  }
  if (question.type === "CODE_WRITING" && question.modelSolution) {
    feedback.modelSolution = question.modelSolution;
  }
  return feedback;
}

export class PracticeService {
  constructor(
    private readonly practice: PracticeRepository,
    private readonly classes: ClassRepository,
    private readonly groups: GroupRepository,
    private readonly now: () => Date = () => new Date(),
  ) {}

  // --- Hosts y admin ---

  async listForClass(classId: string): Promise<PracticeQuizSummary[]> {
    const validClassId = validateId(classId, "classId");
    if (!(await this.classes.findById(validClassId))) throw new PracticeNotFoundError("Class not found");
    return this.practice.listForClass(validClassId);
  }

  async getForHost(id: string): Promise<PracticeQuiz> {
    const quiz = await this.practice.findById(validateId(id, "id"));
    if (!quiz) throw new PracticeNotFoundError("Practice quiz not found");
    return quiz;
  }

  async create(classId: string, input: unknown, createdBy: string): Promise<PracticeQuiz> {
    const validClassId = validateId(classId, "classId");
    const fields = validatePracticeInput(input);
    if (!(await this.classes.findById(validClassId))) throw new PracticeNotFoundError("Class not found");
    const id = await this.practice.create(validClassId, fields, createdBy);
    return this.getForHost(id);
  }

  async update(id: string, input: unknown): Promise<PracticeQuiz> {
    const quiz = await this.getForHost(id);
    const fields = validatePracticeInput(input);
    // Solo ids que de verdad pertenecen a este quiz se actualizan en su lugar.
    const ownQuestionIds = new Set(quiz.questions.map((question) => question.id));
    const ownOptionIds = new Set(quiz.questions.flatMap((question) => question.options.map((option) => option.id)));
    fields.questions = fields.questions.map((question) => ({
      ...question,
      id: question.id && ownQuestionIds.has(question.id) ? question.id : null,
      options: question.options.map((option) => ({ ...option, id: option.id && ownOptionIds.has(option.id) ? option.id : null })),
    }));
    await this.practice.update(quiz.id, fields);
    return this.getForHost(quiz.id);
  }

  async delete(id: string): Promise<void> {
    if (!(await this.practice.delete(validateId(id, "id")))) throw new PracticeNotFoundError("Practice quiz not found");
  }

  async studentStats(id: string): Promise<PracticeStudentStat[]> {
    const quiz = await this.getForHost(id);
    return this.practice.studentStats(quiz.id);
  }

  // --- Alumnas ---

  listForStudent(userId: string): Promise<StudentPracticeSummary[]> {
    return this.practice.listForStudent(userId, this.now());
  }

  // Publicado y de una clase de su grupo; si no, "no encontrado" (no revela
  // que existe).
  private async accessibleQuiz(quizId: string, userId: string): Promise<{ quiz: PracticeQuiz; groupId: string }> {
    const quiz = await this.practice.findById(validateId(quizId, "quizId"));
    const isPublished = quiz?.publishedAt !== null && quiz?.publishedAt !== undefined
      && new Date(quiz.publishedAt).getTime() <= this.now().getTime();
    const classItem = quiz ? await this.classes.findById(quiz.classId) : null;
    const isMember = classItem ? await this.groups.hasMember(classItem.groupId, userId) : false;

    if (!quiz || !isPublished || !classItem || !isMember) throw new PracticeNotFoundError("Practice quiz not found");
    return { quiz, groupId: classItem.groupId };
  }

  async getForStudent(quizId: string, userId: string): Promise<PublicPracticeQuiz> {
    return toPublicQuiz((await this.accessibleQuiz(quizId, userId)).quiz);
  }

  async startAttempt(quizId: string, userId: string): Promise<{ attemptId: string; quiz: PublicPracticeQuiz }> {
    const { quiz, groupId } = await this.accessibleQuiz(quizId, userId);
    const sessionId = await this.practice.ensureSession(quiz, groupId);
    const attemptId = await this.practice.createAttempt(sessionId, userId, quiz.questions.length);
    return { attemptId, quiz: toPublicQuiz(quiz) };
  }

  // Intento propio y sin terminar, con su quiz y la pregunta pedida.
  private async ownOpenAttempt(attemptId: string, userId: string, questionId: unknown) {
    const attempt = await this.practice.findAttempt(validateId(attemptId, "attemptId"));
    if (!attempt || attempt.studentId !== userId) throw new PracticeNotFoundError("Attempt not found");
    if (attempt.completedAt) throw new PracticeAttemptFinishedError("This attempt is already finished");

    const quiz = await this.practice.findById(attempt.quizId);
    const question = quiz?.questions.find((item) => item.id === (typeof questionId === "number" ? String(questionId) : questionId));
    return { attempt, question };
  }

  // CODE_WRITING: después de escribir su código, ve la solución modelo para
  // autoevaluarse. No guarda nada todavía.
  async revealSolution(attemptId: string, userId: string, input: unknown): Promise<{ modelSolution: string; explanation: string | null }> {
    const body = asRecord(input);
    const { question } = await this.ownOpenAttempt(attemptId, userId, body.questionId);
    if (!question || question.type !== "CODE_WRITING" || !question.modelSolution) throw new PracticeNotFoundError("Question not found");
    if (typeof body.answerText !== "string" || !body.answerText.trim()) throw new PracticeInputError("write your code first");
    return { modelSolution: question.modelSolution, explanation: question.explanation };
  }

  async answer(attemptId: string, userId: string, input: unknown): Promise<AnswerFeedback> {
    const body = asRecord(input);
    const { attempt, question } = await this.ownOpenAttempt(attemptId, userId, body.questionId);
    if (!question) throw new PracticeNotFoundError("Question not found");

    const answer: PracticeAnswerInput = {
      questionId: question.id,
      optionId: optionalId(body.optionId),
      answerText: typeof body.answerText === "string" ? body.answerText.slice(0, MAX_CODE) : null,
      selfAssessment: typeof body.selfAssessment === "boolean" ? body.selfAssessment : null,
    };

    let correct: boolean;
    try {
      correct = gradeAnswer(question, answer);
    } catch (error: unknown) {
      throw new PracticeInputError(error instanceof Error ? error.message : "invalid answer");
    }

    await this.practice.saveAnswer(attempt.id, {
      questionId: question.id,
      optionId: question.type === "MULTIPLE_CHOICE" ? answer.optionId : null,
      answerText: question.type === "MULTIPLE_CHOICE" ? null : answer.answerText,
      isCorrect: correct,
      selfAssessed: question.type === "CODE_WRITING",
    });
    return feedbackFor(question, correct);
  }

  async finishAttempt(attemptId: string, userId: string): Promise<{ correctAnswers: number; totalQuestions: number; percentage: number }> {
    const attempt = await this.practice.findAttempt(validateId(attemptId, "attemptId"));
    if (!attempt || attempt.studentId !== userId) throw new PracticeNotFoundError("Attempt not found");

    const { correctAnswers, totalQuestions } = await this.practice.finishAttempt(attempt.id);
    return { correctAnswers, totalQuestions, percentage: totalQuestions > 0 ? Math.round((correctAnswers / totalQuestions) * 100) : 0 };
  }
}
