import type { QuizSessionService } from "../quizSessions/quiz-session.service.js";
import type { Game } from "../types/Game.js";
import type { PlayerIdentityService } from "../users/player-identity.service.js";
import type { QuizResultRepository } from "./quiz-result.repository.js";
import type { NewAnswer, SessionResultDetail, SessionResultSummary, StudentHistory } from "./quiz-result.types.js";

export class QuizResultInputError extends Error {}

function validateId(id: string, name: string): string {
  if (!/^\d+$/.test(id)) {
    throw new QuizResultInputError(`${name} must be a positive integer`);
  }
  return id;
}

export class QuizResultService {
  constructor(
    private readonly results: QuizResultRepository,
    private readonly quizSessions: QuizSessionService,
    private readonly playerIdentity: PlayerIdentityService,
    private readonly now: () => Date = () => new Date(),
  ) {}

  // Al terminar un juego en vivo: un intento por jugador que contestó al
  // menos una pregunta (igual que la asistencia), con todas sus respuestas.
  // Cada jugador se procesa aparte: un nickname que no es de alumno o un
  // fallo puntual no impide guardar a los demás. Si ya existe su intento
  // (p. ej. se reintentó), no lo duplica.
  async saveLiveGameResults(game: Game): Promise<void> {
    const session = await this.quizSessions.findByGameCode(game.code);
    if (!session || session.mode !== "LIVE") {
      return;
    }

    const questionsById = new Map(game.questions.map((question) => [question.id, question]));
    const startedAt = game.startedAt ? new Date(game.startedAt) : null;
    const completedAt = this.now();

    for (const player of game.players) {
      if (player.answers.length === 0) continue;

      try {
        const { userId } = await this.playerIdentity.resolveStudentByNickname(player.name);
        if (await this.results.attemptExists(session.id, userId)) continue;

        const answers: NewAnswer[] = player.answers.map((answer) => ({
          questionId: answer.questionId,
          selectedOptionId: answer.optionIndex === null
            ? null
            : questionsById.get(answer.questionId)?.optionIds?.[answer.optionIndex] ?? null,
          isCorrect: answer.correct,
          pointsEarned: answer.points,
          responseMs: answer.responseMs,
        }));

        await this.results.saveAttempt({
          sessionId: session.id,
          studentId: userId,
          score: player.score,
          correctAnswers: answers.filter((answer) => answer.isCorrect).length,
          totalQuestions: game.questions.length,
          startedAt,
          completedAt,
          answers,
        });
      } catch (error: unknown) {
        console.error(`No se pudo guardar el resultado del player "${player.name}"`, error);
      }
    }
  }

  async listSessions(groupId?: string): Promise<SessionResultSummary[]> {
    return this.results.listSessions(groupId ? validateId(groupId, "groupId") : null);
  }

  async getSessionDetail(sessionId: string): Promise<SessionResultDetail | null> {
    const validId = validateId(sessionId, "sessionId");
    const session = await this.results.findSession(validId);
    if (!session) return null;

    const [students, questions] = await Promise.all([
      this.results.findStudentResults(validId),
      this.results.findQuestionResults(validId),
    ]);
    return { session, students, questions };
  }

  async getStudentHistory(studentId: string): Promise<StudentHistory> {
    const entries = await this.results.findStudentHistory(validateId(studentId, "studentId"));
    const averagePercentage = entries.length > 0
      ? Math.round(entries.reduce((sum, entry) => sum + entry.percentage, 0) / entries.length)
      : null;
    return { averagePercentage, entries };
  }
}
