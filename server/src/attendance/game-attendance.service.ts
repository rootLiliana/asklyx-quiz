import type { QuizContentService } from "../quizzes/quiz-content.service.js";
import type { QuizSessionService } from "../quizSessions/quiz-session.service.js";
import type { PlayerIdentityService } from "../users/player-identity.service.js";
import type { AttendanceService } from "./attendance.service.js";

export interface GamePlayer {
  name: string;
  answeredQuestions: string[];
}

// Registra PRESENT en `attendance` cuando un juego termina (la HOST avanza
// después de la última pregunta), para cada player que respondió al menos
// una pregunta: entrar y quedarse sin participar no cuenta como asistencia.
// Solo aplica si el juego tiene una quiz_session persistida. classId sale
// siempre de la sesión:
//   game_code -> quiz_sessions.class_id
// (o de quizzes.class_id para sesiones anteriores a esa columna), nunca de
// un valor externo/del body. Si el juego no tiene quiz_session
// (flujo legado sin quiz guardado), no hay nada que registrar: no es un
// error, simplemente no hace nada.
//
// Cada player se procesa de forma independiente: un nickname inexistente,
// uno que pertenezca a HOST/ADMIN, o cualquier otro fallo puntual al
// registrar asistencia, nunca interrumpe el procesamiento de los demás
// players ni se propaga hacia quien llama a este servicio (quien avanza el
// juego no debe verse afectado).
export class GameAttendanceService {
  constructor(
    private readonly quizSessions: QuizSessionService,
    private readonly quizContent: QuizContentService,
    private readonly playerIdentity: PlayerIdentityService,
    private readonly attendance: AttendanceService,
  ) {}

  async registerAttendanceForFinishedGame(gameCode: string, players: GamePlayer[]): Promise<void> {
    const quizSession = await this.quizSessions.findByGameCode(gameCode);
    if (!quizSession) {
      return;
    }

    const classId = quizSession.classId ?? (await this.quizContent.getById(quizSession.quizId))?.classId;
    if (!classId) {
      return;
    }

    for (const player of players) {
      if (player.answeredQuestions.length === 0) {
        continue;
      }

      await this.registerPresentPlayer(classId, player);
    }
  }

  private async registerPresentPlayer(classId: string, player: GamePlayer): Promise<void> {
    try {
      const identity = await this.playerIdentity.resolveStudentByNickname(player.name);
      await this.attendance.recordQuizCompletion(classId, identity.userId);
    } catch (error: unknown) {
      console.error(`No se pudo registrar asistencia para el player "${player.name}"`, error);
    }
  }
}
