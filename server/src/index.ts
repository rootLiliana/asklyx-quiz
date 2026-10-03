import express from "express";
import cors from "cors";
import type {
  Request,
  Response,
  NextFunction,
} from "express";

import { createGame,
   deleteGame,
   joinGame, 
   getGame,
    startGame, 
    getCurrentQuestion,  
     submitAnswer, 
     nextQuestion, 
     getLeaderboard,
  startIcebreaker, 
  getIcebreaker, 
  submitIcebreakerAnswer, 
  closeIcebreaker,
  getGameStats,
  DEFAULT_QUESTION_SECONDS,
  MIN_QUESTION_SECONDS,
  MAX_QUESTION_SECONDS,
 } from "./gameManager.js";
import { loadEnvFile } from "./env.js";
import { checkDatabaseConnection } from "./db.js";
import { createMailer } from "./mailer.js";
import { MysqlAuthSessionRepository } from "./auth/auth-session.repository.js";
import { AuthSessionService } from "./auth/auth-session.service.js";
import { createAuthGuards, getAuthUser } from "./auth/auth.middleware.js";
import { createAuthRouter } from "./auth/auth.routes.js";
import { createUserRouter } from "./users/user.routes.js";
import { MysqlUserRepository } from "./users/user.repository.js";
import { UserService } from "./users/user.service.js";
import { MysqlPasswordResetRepository } from "./users/password-reset.repository.js";
import { PasswordResetService } from "./users/password-reset.service.js";
import { createGroupRouter } from "./groups/group.routes.js";
import { GroupService } from "./groups/group.service.js";
import { MysqlGroupRepository } from "./groups/group.repository.js";
import { createClassRouter, createModuleRouter } from "./classes/class.routes.js";
import { MysqlModuleRepository } from "./modules/module.repository.js";
import { ClassInputError, ClassService } from "./classes/class.service.js";
import { MysqlClassRepository } from "./classes/class.repository.js";
import { createAttendanceRouter } from "./attendance/attendance.routes.js";
import { AttendanceService } from "./attendance/attendance.service.js";
import { MysqlAttendanceRepository } from "./attendance/attendance.repository.js";
import { GameAttendanceService } from "./attendance/game-attendance.service.js";
import { MysqlQuizResultRepository } from "./results/quiz-result.repository.js";
import { createQuizResultRouter } from "./results/quiz-result.routes.js";
import { QuizResultService } from "./results/quiz-result.service.js";
import { PlayerIdentityService } from "./users/player-identity.service.js";
import { toGameManagerQuestions } from "./quizzes/quiz-content.mapper.js";
import { MysqlQuizContentRepository } from "./quizzes/quiz-content.repository.js";
import { createHostQuizRouter } from "./quizzes/quiz-content.routes.js";
import { QuizContentInputError, QuizContentService } from "./quizzes/quiz-content.service.js";
import { MysqlQuizSessionRepository, QuizSessionConflictError, QuizSessionReferenceError } from "./quizSessions/quiz-session.repository.js";
import { QuizSessionInputError, QuizSessionService } from "./quizSessions/quiz-session.service.js";
import { QUIZ_SESSION_MODES, type QuizSessionMode } from "./quizSessions/quiz-session.types.js";

loadEnvFile();

const app = express();
const PORT =
  process.env.PORT || 3001;

const users = new MysqlUserRepository();
const userService = new UserService(users);
const authSessions = new AuthSessionService(new MysqlAuthSessionRepository());
const guards = createAuthGuards(authSessions);
const { requireHost, requireStudent } = guards;
// APP_URL es la URL pública del frontend: ahí vive /reset-password.
const passwordResetService = new PasswordResetService(
  users,
  new MysqlPasswordResetRepository(),
  createMailer(),
  process.env.APP_URL?.trim() || "http://localhost:5173",
  (userId) => {
    authSessions.revokeAllForUser(userId).catch((error: unknown) => {
      console.error("No se pudieron cerrar las sesiones tras restablecer la contraseña", error);
    });
  },
);
const groupRepository = new MysqlGroupRepository();
const classRepository = new MysqlClassRepository();
const attendanceRepository = new MysqlAttendanceRepository();
const quizContentService = new QuizContentService(
  new MysqlQuizContentRepository(),
  classRepository,
);
const quizSessionService = new QuizSessionService(
  new MysqlQuizSessionRepository(),
);
const groupService = new GroupService(groupRepository, users);
const classService = new ClassService(classRepository, groupRepository, new MysqlModuleRepository());
const attendanceService = new AttendanceService(
  attendanceRepository,
  classRepository,
  users,
  groupRepository,
);
const playerIdentityService = new PlayerIdentityService(users);
const gameAttendanceService = new GameAttendanceService(
  quizSessionService,
  quizContentService,
  playerIdentityService,
  attendanceService,
);
const quizResultService = new QuizResultService(
  new MysqlQuizResultRepository(),
  quizSessionService,
  playerIdentityService,
);

function getCodeParam(req: Request) {
  const { code } = req.params;

  return typeof code === "string"
    ? code
    : "";
}

interface CreateGameRequest {
  quizId: string;
  classId: string;
  mode: QuizSessionMode;
  durationSeconds: number;
}

class CreateGameRequestError extends Error {}

function parseCreateGameRequest(body: unknown): CreateGameRequest {
  const record = typeof body === "object" && body !== null
    ? body as Record<string, unknown>
    : {};

  const quizId = parsePositiveId(record.quizId, "quizId");
  const classId = parsePositiveId(record.classId, "classId");
  const mode = record.mode === undefined ? "LIVE" : record.mode;

  if (typeof mode !== "string" || !QUIZ_SESSION_MODES.includes(mode as QuizSessionMode)) {
    throw new CreateGameRequestError("mode must be LIVE or PRACTICE");
  }

  const durationSeconds = record.durationSeconds === undefined ? DEFAULT_QUESTION_SECONDS : record.durationSeconds;
  if (
    typeof durationSeconds !== "number" ||
    !Number.isInteger(durationSeconds) ||
    durationSeconds < MIN_QUESTION_SECONDS ||
    durationSeconds > MAX_QUESTION_SECONDS
  ) {
    throw new CreateGameRequestError(`durationSeconds must be an integer between ${MIN_QUESTION_SECONDS} and ${MAX_QUESTION_SECONDS}`);
  }

  return { quizId, classId, mode: mode as QuizSessionMode, durationSeconds };
}

function parsePositiveId(value: unknown, name: string): string {
  const normalized = typeof value === "number" ? String(value) : value;

  if (typeof normalized !== "string" || !/^\d+$/.test(normalized)) {
    throw new CreateGameRequestError(`${name} must be a positive integer`);
  }

  return normalized;
}

app.listen(PORT, () => {
  console.log(
    `Server running on ${PORT}`
  );
});

app.use(cors({
    origin: "*"
  }));
app.use(express.json());

app.get("/health", (_, res) => {
  res.json({
    status: "ok",
  });
});

app.get("/health/db", async (_, res) => {
  try {
    await checkDatabaseConnection();
    res.json({ database: "connected" });
  } catch (error: unknown) {
    console.error("Database health check failed", error);
    res.status(503).json({ database: "unavailable" });
  }
});

app.use(createAuthRouter(userService, authSessions, passwordResetService));
app.use("/users", createUserRouter(guards, userService, passwordResetService, authSessions));
app.use("/groups", createGroupRouter(guards, groupService, classService));
app.use("/classes", createClassRouter(guards, classService));
app.use("/modules", createModuleRouter(guards, classService));
app.use(createAttendanceRouter(guards, attendanceService));
app.use(createQuizResultRouter(guards, quizResultService));
app.use("/host/quizzes", createHostQuizRouter(requireHost, (req) => getAuthUser(req)?.id ?? null, quizContentService));

// Una sesión de juego = un quiz guardado + la clase (y por lo tanto el grupo
// y la fecha) en la que se juega. El juego siempre sale de la BD: la
// quiz_session guarda la clase, y al terminar se registra la asistencia en
// ella. El grupo se deriva de la clase real, nunca del body.
app.post("/games", requireHost, async (req, res, next) => {
  try {
    const request = parseCreateGameRequest(req.body);
    const hostId = getAuthUser(req)?.id;
    if (!hostId) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    const [quiz, classItem] = await Promise.all([
      quizContentService.getById(request.quizId),
      classService.getClass(request.classId),
    ]);
    if (!quiz) {
      res.status(404).json({ code: "QUIZ_NOT_FOUND", message: "Quiz not found" });
      return;
    }
    if (!classItem) {
      res.status(404).json({ code: "CLASS_NOT_FOUND", message: "Class not found" });
      return;
    }
    if (quiz.questions.length === 0) {
      res.status(400).json({ message: "The quiz has no questions" });
      return;
    }

    const createdGame = createGame(toGameManagerQuestions(quiz), request.durationSeconds);

    try {
      await quizSessionService.create({
        quizId: quiz.id,
        hostId,
        classId: classItem.id,
        groupId: classItem.groupId,
        gameCode: createdGame.code,
        mode: request.mode,
      });
    } catch (error: unknown) {
      deleteGame(createdGame.code);
      throw error;
    }

    res.json(createdGame);
  } catch (error: unknown) {
    if (
      error instanceof CreateGameRequestError ||
      error instanceof QuizContentInputError ||
      error instanceof ClassInputError ||
      error instanceof QuizSessionInputError ||
      error instanceof QuizSessionReferenceError
    ) {
      res.status(400).json({ message: error.message });
      return;
    }
    if (error instanceof QuizSessionConflictError) {
      res.status(409).json({ message: error.message });
      return;
    }
    next(error);
  }
});

// Solo alumnas con sesión: el nombre en el juego es SIEMPRE su nickname de
// la sesión (nunca uno enviado en el body), para que nadie pueda unirse
// haciéndose pasar por otra y registrarle asistencia.
app.post("/games/:code/join", requireStudent, (req, res) => {
  const nickname = getAuthUser(req)?.nickname ?? "";
  const joined = joinGame(getCodeParam(req), nickname);

  if (!joined) {
    return res.status(404).json({
      message: "Game not found",
    });
  }

  // { code, player: { id, name } }: nunca el juego completo (tiene las respuestas).
  res.json(joined);
});


app.get("/games/:code", requireHost, (req, res) => {
  const code = getCodeParam(req);

  const game = getGame(code);

  if (!game) {
    return res.status(404).json({
      message: "Game not found",
    });
  }

  res.json(game);
});

app.post("/games/:code/start", requireHost, async (req, res) => {
  const game = startGame(getCodeParam(req));

  if (!game) {
    return res.status(404).json({
      message: "Game not found",
    });
  }

  // Best-effort: si falla, el juego sigue igual.
  await quizSessionService.markStarted(game.code).catch((error: unknown) => {
    console.error("No se pudo marcar la sesión como iniciada", error);
  });

  res.json(game);
});

app.get("/games/:code/question", (req, res) => {
  const question =
    getCurrentQuestion(req.params.code);

  if (!question) {
    return res.status(404).json({
      message: "Question not found",
    });
  }

  res.json(question);
});

// Solo alumnos con sesión: el jugador es SIEMPRE el nickname de la sesión.
// Body: { questionId, answer }. Los puntos los calcula el servidor con su
// propio reloj (el navegador ya no manda el tiempo restante).
app.post("/games/:code/answer", requireStudent, (req, res) => {
  const body = typeof req.body === "object" && req.body !== null ? req.body as Record<string, unknown> : {};
  const result = submitAnswer(
    getCodeParam(req),
    getAuthUser(req)?.nickname ?? "",
    typeof body.questionId === "string" ? body.questionId : "",
    typeof body.answer === "number" ? body.answer : -1,
  );

  if (result.status === "NOT_FOUND") {
    return res.status(404).json({ message: "Unable to submit answer" });
  }
  if (result.status === "STALE_QUESTION") {
    return res.status(409).json({ code: "STALE_QUESTION", message: "The question already changed" });
  }

  res.json({
    correct: result.correct,
    alreadyAnswered: result.alreadyAnswered,
    timeUp: result.timeUp,
    score: result.score,
    correctAnswer: result.correctAnswer,
    explanation: result.explanation,
  });
});

app.post("/games/:code/next", requireHost, async (req, res) => {
  const code = getCodeParam(req);
  const result = nextQuestion(code);

  if (!result) {
    return res.status(404).json({
      message: "Game not found",
    });
  }

  const { game, justFinished } = result;

  // Fin del quiz (best-effort): justo cuando la HOST avanza después de la
  // última pregunta se registran la asistencia y los resultados de quienes
  // participaron, y la sesión queda FINISHED. justFinished solo es true en
  // ese paso, así que ocurre una vez por juego. Las tres partes corren en
  // paralelo e independientes; nunca bloquean ni rompen el avance.
  if (justFinished) {
    const outcomes = await Promise.allSettled([
      gameAttendanceService.registerAttendanceForFinishedGame(game.code, game.players),
      quizResultService.saveLiveGameResults(game),
      quizSessionService.markFinished(game.code),
    ]);
    outcomes.forEach((outcome, index) => {
      if (outcome.status === "rejected") {
        const what = ["la asistencia", "los resultados", "el fin de la sesión"][index];
        console.error(`Error guardando ${what} al terminar el juego`, outcome.reason);
      }
    });
  }

  res.json(game);
});

app.get(
  "/games/:code/leaderboard",
  (req, res) => {

    const leaderboard =
      getLeaderboard(
        req.params.code
      );

    if (!leaderboard) {
      return res.status(404).json({
        message: "Game not found"
      });
    }

    res.json(leaderboard);
  }
);

// 1. POST: El administrador/host inicia el Icebreaker con una pregunta abierta
app.post("/games/:code/icebreaker", requireHost, (req, res) => {
  const { question } = req.body; // Ej: { "question": "¿Cuál es tu comida favorita?" }

  if (!question) {
    return res.status(400).json({ message: "Question is required" });
  }

  const icebreaker = startIcebreaker(getCodeParam(req), question);

  if (!icebreaker) {
    return res.status(404).json({ message: "Game not found" });
  }

  res.status(201).json(icebreaker);
});

// 2. GET: Para que tanto el host como los jugadores vean la pregunta y las respuestas actuales
app.get("/games/:code/icebreaker", (req, res) => {
  const icebreaker = getIcebreaker(req.params.code);

  if (!icebreaker) {
    return res.status(404).json({ message: "Game or Icebreaker not found" });
  }

  res.json(icebreaker);
});

// 3. POST: El jugador envía su respuesta abierta cuando se une o mientras está activo el rompehielos
// Solo alumnos con sesión; el nombre sale de la sesión. Body: { text }
app.post("/games/:code/icebreaker/answer", requireStudent, (req, res) => {
  const playerName = getAuthUser(req)?.nickname ?? "";
  const text = typeof req.body?.text === "string" ? req.body.text.trim() : "";

  if (!playerName || !text) {
    return res.status(400).json({ message: "text is required" });
  }

  const result = submitIcebreakerAnswer(getCodeParam(req), playerName, text.slice(0, 500));

  if (!result) {
    return res.status(404).json({ message: "Game not found or Icebreaker is not active" });
  }

  // Si la función retornó el objeto de error por duplicado
  if ('error' in result) {
    return res.status(400).json({ message: result.error });
  }

  res.status(201).json(result);
});

// 4. PUT: El host decide cerrar el icebreaker para proceder con las preguntas de trivia de Pandas
app.put("/games/:code/icebreaker/close", requireHost, (req, res) => {
  const icebreaker = closeIcebreaker(getCodeParam(req));

  if (!icebreaker) {
    return res.status(404).json({ message: "Game or Icebreaker not found" });
  }

  res.json({ message: "Icebreaker closed successfully", icebreaker });
});

app.get(
  "/games/:code/stats",
  requireHost,
  (req, res) => {

    const stats =
      getGameStats(getCodeParam(req));

    if (!stats) {
      return res.status(404).json({
        message: "Game not found",
      });
    }

    res.json(stats);
  }
);

app.use((error: unknown, _: Request, res: Response, __: NextFunction) => {
  console.error("Unhandled request error", error);
  res.status(500).json({ message: "Internal server error" });
});
