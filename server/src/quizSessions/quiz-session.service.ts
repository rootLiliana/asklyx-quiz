import type { QuizSessionRepository } from "./quiz-session.repository.js";
import { QUIZ_SESSION_MODES, type CreateQuizSessionInput, type QuizSession, type QuizSessionMode } from "./quiz-session.types.js";

export class QuizSessionInputError extends Error {}

export class QuizSessionService {
  constructor(private readonly sessions: QuizSessionRepository) {}

  create(input: CreateQuizSessionInput): Promise<QuizSession> {
    if (!/^\d+$/.test(input.quizId) || !/^\d+$/.test(input.hostId) || !/^\d+$/.test(input.classId)) {
      throw new QuizSessionInputError("quizId, hostId and classId must be positive integers");
    }
    if (input.groupId !== null && !/^\d+$/.test(input.groupId)) {
      throw new QuizSessionInputError("groupId must be a positive integer when provided");
    }
    if (!input.gameCode.trim()) {
      throw new QuizSessionInputError("gameCode is required");
    }
    if (!QUIZ_SESSION_MODES.includes(input.mode as QuizSessionMode)) {
      throw new QuizSessionInputError("mode must be LIVE or PRACTICE");
    }

    return this.sessions.create(input);
  }

  markStarted(gameCode: string): Promise<void> {
    return this.sessions.markStarted(gameCode.trim());
  }

  markFinished(gameCode: string): Promise<void> {
    return this.sessions.markFinished(gameCode.trim());
  }

  findByGameCode(gameCode: string): Promise<QuizSession | null> {
    if (!gameCode.trim()) {
      throw new QuizSessionInputError("gameCode is required");
    }

    return this.sessions.findByGameCode(gameCode.trim());
  }
}
