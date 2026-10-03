import assert from "node:assert/strict";
import test from "node:test";

import type { ClassRepository } from "../classes/class.repository.js";
import type { ClassItem } from "../classes/class.types.js";
import type { GroupRepository } from "../groups/group.repository.js";
import { PracticeAlreadyAnsweredError, type PracticeRepository } from "./practice.repository.js";
import {
  PracticeAttemptFinishedError,
  PracticeInputError,
  PracticeNotFoundError,
  PracticeService,
  validatePracticeInput,
} from "./practice.service.js";
import type { PracticeAttempt, PracticeQuiz, PracticeQuizInput } from "./practice.types.js";

const NOW = new Date("2026-10-04T12:00:00Z");
const classCdd1: ClassItem = {
  id: "1", moduleId: "1", groupId: "10", name: "Sesión 3", description: null,
  classDate: "2026-10-05", startTime: null, endTime: null, status: "SCHEDULED",
};
const classes = { findById: async (id: string) => (id === "1" ? classCdd1 : null) } as unknown as ClassRepository;
// ana (25) y sofi (27) están en el grupo 10; luis (26) no.
const groups = { hasMember: async (groupId: string, userId: string) => groupId === "10" && ["25", "27"].includes(userId) } as unknown as GroupRepository;

class FakePractice implements PracticeRepository {
  quizzes = new Map<string, PracticeQuiz>();
  attempts = new Map<string, PracticeAttempt & { answers: Map<string, boolean> }>();
  lastUpdate: PracticeQuizInput | null = null;
  private nextId = 100;

  async listForClass() { return []; }
  async findById(id: string) { return this.quizzes.get(id) ?? null; }
  async create(classId: string, input: PracticeQuizInput, createdBy: string) {
    const id = String(this.nextId++);
    this.quizzes.set(id, {
      id, classId, title: input.title, publishedAt: input.publishedAt?.toISOString() ?? null, createdBy,
      questions: input.questions.map((question) => ({
        ...question,
        id: String(this.nextId++),
        options: question.options.map((option) => ({ ...option, id: String(this.nextId++) })),
      })),
    });
    return id;
  }
  async update(_id: string, input: PracticeQuizInput) { this.lastUpdate = input; }
  async delete(id: string) { return this.quizzes.delete(id); }
  async studentStats() { return []; }
  async listForStudent() { return []; }
  async ensureSession() { return "900"; }
  async createAttempt(sessionId: string, studentId: string, totalQuestions: number) {
    const id = String(this.nextId++);
    const quizId = [...this.quizzes.keys()][0] ?? "";
    this.attempts.set(id, { id, sessionId, quizId, studentId, totalQuestions, completedAt: null, answers: new Map() });
    return id;
  }
  async findAttempt(id: string) { return this.attempts.get(id) ?? null; }
  async saveAnswer(attemptId: string, answer: { questionId: string; isCorrect: boolean }) {
    const attempt = this.attempts.get(attemptId)!;
    if (attempt.answers.has(answer.questionId)) throw new PracticeAlreadyAnsweredError("dup");
    attempt.answers.set(answer.questionId, answer.isCorrect);
  }
  async finishAttempt(id: string) {
    const attempt = this.attempts.get(id)!;
    attempt.completedAt = NOW.toISOString();
    return { correctAnswers: [...attempt.answers.values()].filter(Boolean).length, totalQuestions: attempt.totalQuestions };
  }
}

const input = (publishedAt: string | null) => ({
  title: " Práctica: groupby ",
  publishedAt,
  questions: [
    { type: "MULTIPLE_CHOICE", text: "¿Qué agrupa?", options: [{ text: "merge" }, { text: "groupby", isCorrect: true }] },
    { type: "SHORT_ANSWER", text: "¿Cuántas filas?", acceptedAnswers: ["42"], explanation: "Hay 42." },
    { type: "CODE_OUTPUT", text: "¿Qué imprime?", code: "print(1 + 1)", acceptedAnswers: ["2"] },
    { type: "CODE_WRITING", text: "Promedio por ciudad", modelSolution: "df.groupby('ciudad').mean()" },
  ],
});

function build() {
  const repository = new FakePractice();
  return { repository, service: new PracticeService(repository, classes, groups, () => NOW) };
}

test("validates every question type", () => {
  const fields = validatePracticeInput(input(null));
  assert.equal(fields.title, "Práctica: groupby");
  assert.deepEqual(fields.questions.map((question) => question.type), ["MULTIPLE_CHOICE", "SHORT_ANSWER", "CODE_OUTPUT", "CODE_WRITING"]);

  const withQuestion = (question: unknown) => ({ title: "x", questions: [question] });
  assert.throws(() => validatePracticeInput(withQuestion({ type: "MULTIPLE_CHOICE", text: "?", options: [{ text: "a", isCorrect: true }] })), PracticeInputError);
  assert.throws(() => validatePracticeInput(withQuestion({ type: "MULTIPLE_CHOICE", text: "?", options: [{ text: "a" }, { text: "b" }] })), PracticeInputError);
  assert.throws(() => validatePracticeInput(withQuestion({ type: "SHORT_ANSWER", text: "?", acceptedAnswers: [" "] })), PracticeInputError);
  assert.throws(() => validatePracticeInput(withQuestion({ type: "CODE_OUTPUT", text: "?", acceptedAnswers: ["2"] })), PracticeInputError);
  assert.throws(() => validatePracticeInput(withQuestion({ type: "CODE_WRITING", text: "?" })), PracticeInputError);
  assert.throws(() => validatePracticeInput(withQuestion({ type: "ESSAY", text: "?" })), PracticeInputError);
  assert.throws(() => validatePracticeInput({ title: "x", questions: [] }), PracticeInputError);
});

test("students only reach published practice of their own group, and never see the answers", async () => {
  const { service } = build();
  const published = await service.create("1", input("2026-10-01T00:00:00Z"), "1");
  const draft = await service.create("1", input(null), "1");

  const visible = await service.getForStudent(published.id, "25");
  assert.equal(JSON.stringify(visible).includes("isCorrect"), false);
  assert.equal(JSON.stringify(visible).includes("groupby('ciudad')"), false);
  assert.equal(JSON.stringify(visible).includes("acceptedAnswers"), false);

  await assert.rejects(service.getForStudent(draft.id, "25"), PracticeNotFoundError);
  await assert.rejects(service.getForStudent(published.id, "26"), PracticeNotFoundError);
});

test("a full attempt: answers are graded on the server, then the attempt is finished", async () => {
  const { service } = build();
  const quiz = await service.create("1", input("2026-10-01T00:00:00Z"), "1");
  const [mc, short, output, writing] = quiz.questions;
  const { attemptId } = await service.startAttempt(quiz.id, "25");

  const mcFeedback = await service.answer(attemptId, "25", { questionId: mc!.id, optionId: mc!.options[0]!.id });
  assert.equal(mcFeedback.correct, false);
  assert.equal(mcFeedback.correctOptionId, mc!.options[1]!.id);

  const shortFeedback = await service.answer(attemptId, "25", { questionId: short!.id, answerText: " 42.0 " });
  assert.equal(shortFeedback.correct, true);
  assert.equal(shortFeedback.explanation, "Hay 42.");

  assert.equal((await service.answer(attemptId, "25", { questionId: output!.id, answerText: "2\n" })).correct, true);

  // Escribe el código: primero ve la solución, luego se autoevalúa.
  await assert.rejects(service.revealSolution(attemptId, "25", { questionId: writing!.id, answerText: " " }), PracticeInputError);
  const revealed = await service.revealSolution(attemptId, "25", { questionId: writing!.id, answerText: "df.mean()" });
  assert.equal(revealed.modelSolution, "df.groupby('ciudad').mean()");
  assert.equal((await service.answer(attemptId, "25", { questionId: writing!.id, answerText: "df.mean()", selfAssessment: false })).correct, false);

  await assert.rejects(service.answer(attemptId, "25", { questionId: mc!.id, optionId: mc!.options[1]!.id }), PracticeAlreadyAnsweredError);

  assert.deepEqual(await service.finishAttempt(attemptId, "25"), { correctAnswers: 2, totalQuestions: 4, percentage: 50 });
  await assert.rejects(service.answer(attemptId, "25", { questionId: short!.id, answerText: "42" }), PracticeAttemptFinishedError);
});

test("a student cannot use another student's attempt", async () => {
  const { service } = build();
  const quiz = await service.create("1", input("2026-10-01T00:00:00Z"), "1");
  const { attemptId } = await service.startAttempt(quiz.id, "25");

  await assert.rejects(service.answer(attemptId, "27", { questionId: quiz.questions[1]!.id, answerText: "42" }), PracticeNotFoundError);
  await assert.rejects(service.finishAttempt(attemptId, "27"), PracticeNotFoundError);
});

test("on update, only question/option ids that belong to that quiz are kept (others become new rows)", async () => {
  const { service, repository } = build();
  const quiz = await service.create("1", input(null), "1");
  const [mc] = quiz.questions;

  await service.update(quiz.id, {
    title: "Editada",
    questions: [
      { id: mc!.id, type: "MULTIPLE_CHOICE", text: "¿Qué agrupa? (corregida)", options: [
        { id: mc!.options[0]!.id, text: "merge" },
        { id: "999999", text: "groupby", isCorrect: true },
      ] },
      { id: "888888", type: "SHORT_ANSWER", text: "Nueva", acceptedAnswers: ["x"] },
    ],
  });

  const sent = repository.lastUpdate!;
  assert.equal(sent.questions[0]!.id, mc!.id);
  assert.equal(sent.questions[0]!.options[0]!.id, mc!.options[0]!.id);
  assert.equal(sent.questions[0]!.options[1]!.id, null);
  assert.equal(sent.questions[1]!.id, null);
});
