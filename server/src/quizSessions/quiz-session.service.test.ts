import assert from "node:assert/strict";
import test from "node:test";

import type { QuizSessionRepository } from "./quiz-session.repository.js";
import { QuizSessionInputError, QuizSessionService } from "./quiz-session.service.js";
import type { CreateQuizSessionInput, QuizSession } from "./quiz-session.types.js";

class FakeQuizSessionRepository implements QuizSessionRepository {
  input: CreateQuizSessionInput | undefined;
  private readonly sessionsByGameCode = new Map<string, QuizSession>();

  async create(input: CreateQuizSessionInput): Promise<QuizSession> {
    this.input = input;
    const session: QuizSession = { id: "1", ...input, status: "WAITING" };
    this.sessionsByGameCode.set(input.gameCode, session);
    return session;
  }

  async findByGameCode(gameCode: string): Promise<QuizSession | null> {
    return this.sessionsByGameCode.get(gameCode) ?? null;
  }

  async markStarted(gameCode: string): Promise<void> {
    const session = this.sessionsByGameCode.get(gameCode);
    if (session?.status === "WAITING") session.status = "IN_PROGRESS";
  }

  async markFinished(gameCode: string): Promise<void> {
    const session = this.sessionsByGameCode.get(gameCode);
    if (session) session.status = "FINISHED";
  }
}

test("creates a PRACTICE session with the Game Manager code", async () => {
  const repository = new FakeQuizSessionRepository();
  const service = new QuizSessionService(repository);

  await service.create({
    quizId: "10",
    hostId: "20",
    classId: "3",
    groupId: null,
    gameCode: "ANA-4821",
    mode: "PRACTICE",
  });

  assert.equal(repository.input?.gameCode, "ANA-4821");
  assert.equal(repository.input?.mode, "PRACTICE");
});

test("rejects unsupported session modes", () => {
  const service = new QuizSessionService(new FakeQuizSessionRepository());

  assert.throws(
    () => service.create({ quizId: "10", hostId: "20", classId: "3", groupId: null, gameCode: "ANA-4821", mode: "OFFICIAL" as "PRACTICE" }),
    QuizSessionInputError,
  );
});

test("findByGameCode returns the session created for that gameCode", async () => {
  const repository = new FakeQuizSessionRepository();
  const service = new QuizSessionService(repository);

  await service.create({ quizId: "10", hostId: "20", classId: "3", groupId: "5", gameCode: "ANA-4821", mode: "PRACTICE" });
  const session = await service.findByGameCode("ANA-4821");

  assert.equal(session?.quizId, "10");
  assert.equal(session?.groupId, "5");
});

test("findByGameCode returns null for an unknown gameCode", async () => {
  const service = new QuizSessionService(new FakeQuizSessionRepository());

  assert.equal(await service.findByGameCode("ANA-0000"), null);
});

test("rejects a session without a valid classId", () => {
  const service = new QuizSessionService(new FakeQuizSessionRepository());

  assert.throws(
    () => service.create({ quizId: "10", hostId: "20", classId: "", groupId: null, gameCode: "ANA-4821", mode: "PRACTICE" }),
    QuizSessionInputError,
  );
});

test("a live session goes WAITING -> IN_PROGRESS -> FINISHED", async () => {
  const service = new QuizSessionService(new FakeQuizSessionRepository());
  await service.create({ quizId: "10", hostId: "20", classId: "3", groupId: null, gameCode: "ANA-4821", mode: "LIVE" });

  await service.markStarted("ANA-4821");
  assert.equal((await service.findByGameCode("ANA-4821"))?.status, "IN_PROGRESS");

  await service.markFinished("ANA-4821");
  assert.equal((await service.findByGameCode("ANA-4821"))?.status, "FINISHED");
});
