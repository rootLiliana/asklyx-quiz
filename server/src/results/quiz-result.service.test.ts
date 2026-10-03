import assert from "node:assert/strict";
import test from "node:test";

import { createGame, joinGame, nextQuestion, startGame, submitAnswer } from "../gameManager.js";
import type { QuizSessionRepository } from "../quizSessions/quiz-session.repository.js";
import { QuizSessionService } from "../quizSessions/quiz-session.service.js";
import type { CreateQuizSessionInput, QuizSession, QuizSessionMode } from "../quizSessions/quiz-session.types.js";
import type { Question } from "../types/Question.js";
import type { UserRepository } from "../users/user.repository.js";
import { PlayerIdentityService } from "../users/player-identity.service.js";
import type { User } from "../users/user.types.js";
import type { QuizResultRepository } from "./quiz-result.repository.js";
import { QuizResultInputError, QuizResultService } from "./quiz-result.service.js";
import type { NewAttempt, StudentHistoryEntry } from "./quiz-result.types.js";

const student = (id: string, nickname: string, role: User["role"] = "STUDENT"): User => ({
  id,
  name: nickname,
  lastNamePaternal: null,
  lastNameMaternal: null,
  email: `${nickname}@example.com`,
  nickname,
  role,
  createdAt: "",
  updatedAt: "",
});
const people = [student("25", "ana"), student("26", "luis"), student("27", "sofi"), student("1", "profe", "HOST")];

const users = {
  findByNickname: async (nickname: string) => people.find((user) => user.nickname === nickname) ?? null,
} as unknown as UserRepository;

class FakeSessions implements QuizSessionRepository {
  mode: QuizSessionMode = "LIVE";
  constructor(private readonly gameCode: string) {}
  async create(input: CreateQuizSessionInput): Promise<QuizSession> { return { id: "900", ...input, status: "WAITING" }; }
  async findByGameCode(code: string): Promise<QuizSession | null> {
    return code === this.gameCode
      ? { id: "900", quizId: "5", hostId: "1", classId: "3", groupId: "10", gameCode: code, mode: this.mode, status: "IN_PROGRESS" }
      : null;
  }
  async markStarted(): Promise<void> {}
  async markFinished(): Promise<void> {}
}

class FakeResults implements QuizResultRepository {
  saved: NewAttempt[] = [];
  history: StudentHistoryEntry[] = [];
  async attemptExists(sessionId: string, studentId: string) {
    return this.saved.some((attempt) => attempt.sessionId === sessionId && attempt.studentId === studentId);
  }
  async saveAttempt(attempt: NewAttempt) { this.saved.push(attempt); }
  async listSessions() { return []; }
  async findSession() { return null; }
  async findStudentResults() { return []; }
  async findQuestionResults() { return []; }
  async findStudentHistory() { return this.history; }
}

const question = (id: string): Question => ({
  id,
  text: `Pregunta ${id}`,
  options: ["A", "B", "C"],
  optionIds: [`${id}-a`, `${id}-b`, `${id}-c`],
  correctAnswer: 1,
  explanation: "",
  answers: [0, 0, 0],
});

// Juego de 2 preguntas: ana contesta las dos (1 bien, 1 mal), luis solo la
// primera (bien), sofi entra pero no contesta, profe (HOST) contesta.
function playGame() {
  const game = createGame([question("q1"), question("q2")], 22);
  ["ana", "luis", "sofi", "profe"].forEach((name) => joinGame(game.code, name));
  startGame(game.code, 0);
  submitAnswer(game.code, "ana", "q1", 1, 2_000);
  submitAnswer(game.code, "luis", "q1", 1, 5_000);
  submitAnswer(game.code, "profe", "q1", 1, 1_000);
  nextQuestion(game.code, 10_000);
  submitAnswer(game.code, "ana", "q2", 0, 12_000);
  nextQuestion(game.code, 20_000);
  return game;
}

function build(gameCode: string) {
  const sessions = new FakeSessions(gameCode);
  const results = new FakeResults();
  const service = new QuizResultService(
    results,
    new QuizSessionService(sessions),
    new PlayerIdentityService(users),
    () => new Date("2026-10-02T18:00:00Z"),
  );
  return { service, results, sessions };
}

test("at the end of a live game, saves one attempt per student who answered, with % data and every answer", async () => {
  const game = playGame();
  const { service, results } = build(game.code);

  await service.saveLiveGameResults(game);

  assert.deepEqual(results.saved.map((attempt) => attempt.studentId).sort(), ["25", "26"]);

  const ana = results.saved.find((attempt) => attempt.studentId === "25");
  assert.equal(ana?.correctAnswers, 1);
  assert.equal(ana?.totalQuestions, 2);
  assert.equal(ana?.sessionId, "900");
  assert.deepEqual(ana?.answers.map((answer) => [answer.questionId, answer.selectedOptionId, answer.isCorrect]), [
    ["q1", "q1-b", true],
    ["q2", "q2-a", false],
  ]);
  assert.deepEqual(ana?.answers.map((answer) => answer.responseMs), [2_000, 2_000]);

  // luis no contestó la segunda: cuenta sobre el total de preguntas del quiz.
  const luis = results.saved.find((attempt) => attempt.studentId === "26");
  assert.equal(luis?.correctAnswers, 1);
  assert.equal(luis?.totalQuestions, 2);
});

test("saving twice does not duplicate attempts", async () => {
  const game = playGame();
  const { service, results } = build(game.code);

  await service.saveLiveGameResults(game);
  await service.saveLiveGameResults(game);

  assert.equal(results.saved.length, 2);
});

test("a game without a LIVE session saves nothing", async () => {
  const game = playGame();
  const { service, results, sessions } = build(game.code);
  sessions.mode = "PRACTICE";

  await service.saveLiveGameResults(game);
  assert.equal(results.saved.length, 0);

  const other = build("OTRO-CODIGO");
  await other.service.saveLiveGameResults(game);
  assert.equal(other.results.saved.length, 0);
});

test("the student average is the mean of her % per quiz", async () => {
  const { service, results } = build("X");
  const entry = (percentage: number): StudentHistoryEntry => ({
    sessionId: "1", playedAt: null, quizTitle: "Q", className: "C", classDate: null, correctAnswers: 0, totalQuestions: 0, percentage,
  });
  results.history = [entry(100), entry(50), entry(75)];

  assert.equal((await service.getStudentHistory("25")).averagePercentage, 75);

  results.history = [];
  assert.equal((await service.getStudentHistory("25")).averagePercentage, null);
});

test("invalid ids are rejected", async () => {
  const { service } = build("X");
  await assert.rejects(service.getStudentHistory("abc"), QuizResultInputError);
  await assert.rejects(service.getSessionDetail("1; DROP"), QuizResultInputError);
  await assert.rejects(service.listSessions("x"), QuizResultInputError);
});
