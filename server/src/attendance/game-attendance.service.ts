import type { QuizContentService } from "../quizzes/quiz-content.service.js";
import type { QuizSessionService } from "../quizSessions/quiz-session.service.js";
import type { PlayerIdentityService } from "../users/player-identity.service.js";
import type { AttendanceService } from "./attendance.service.js";

const PRESENT_STATUS = "PRESENT";

export interface GamePlayer {
  name: string;
}

// Registra PRESENT en `attendance` para cada player que actualmente está
// dentro del juego (Game Manager), cuando ese juego tiene una quiz_session
// persistida. classId sale siempre de:
//   game_code -> quiz_sessions.quiz_id -> quizzes.class_id
// nunca de un valor externo/del body. Si el juego no tiene quiz_session
// (flujo legado sin quiz guardado), no hay nada que registrar: no es un
// error, simplemente no hace nada.
//
// Cada player se procesa de forma independiente: un nickname inexistente,
// uno que pertenezca a HOST/ADMIN, uno que no pertenezca al grupo de la
// clase, o cualquier otro fallo puntual al registrar asistencia, nunca
// interrumpe el procesamiento de los demás players ni se propaga hacia quien
// llama a este servicio (quien inicia el juego no debe verse afectado).
export class GameAttendanceService {
  constructor(
    private readonly quizSessions: QuizSessionService,
    private readonly quizContent: QuizContentService,
    private readonly playerIdentity: PlayerIdentityService,
    private readonly attendance: AttendanceService,
  ) {}

  async registerPresentPlayersForGame(gameCode: string, players: GamePlayer[]): Promise<void> {
    const quizSession = await this.quizSessions.findByGameCode(gameCode);
    if (!quizSession) {
      return;
    }

    const quiz = await this.quizContent.getById(quizSession.quizId);
    if (!quiz) {
      return;
    }

    const classId = quiz.classId;

    for (const player of players) {
      await this.registerPresentPlayer(classId, player);
    }
  }

  private async registerPresentPlayer(classId: string, player: GamePlayer): Promise<void> {
    try {
      const identity = await this.playerIdentity.resolveStudentByNickname(player.name);
      await this.attendance.record(classId, identity.userId, PRESENT_STATUS);
    } catch (error: unknown) {
      console.error(`No se pudo registrar asistencia para el player "${player.name}"`, error);
    }
  }
}
