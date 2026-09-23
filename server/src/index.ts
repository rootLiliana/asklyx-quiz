import express from "express";
import cors from "cors";
import crypto from "node:crypto";
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
      getConfiguredQuestions, 
  setConfiguredQuestions, 
  startIcebreaker, 
  getIcebreaker, 
  submitIcebreakerAnswer, 
  closeIcebreaker,
  getGameStats
 } from "./gameManager.js";
import { loadEnvFile } from "./env.js";
import { checkDatabaseConnection } from "./db.js";
import { createUserRouter, findConfiguredAdmin } from "./users/user.routes.js";
import { MysqlUserRepository } from "./users/user.repository.js";
import { requireStudentAuth } from "./users/student-session.js";
import { createGroupRouter } from "./groups/group.routes.js";
import { GroupService } from "./groups/group.service.js";
import { MysqlGroupRepository } from "./groups/group.repository.js";
import { createClassRouter } from "./classes/class.routes.js";
import { ClassService } from "./classes/class.service.js";
import { MysqlClassRepository } from "./classes/class.repository.js";
import { createAttendanceRouter } from "./attendance/attendance.routes.js";
import { AttendanceService } from "./attendance/attendance.service.js";
import { MysqlAttendanceRepository } from "./attendance/attendance.repository.js";
import { GameAttendanceService } from "./attendance/game-attendance.service.js";
import { PlayerIdentityService } from "./users/player-identity.service.js";
import { toGameManagerQuestions } from "./quizzes/quiz-content.mapper.js";
import { MysqlQuizContentRepository, QuizContentConflictError } from "./quizzes/quiz-content.repository.js";
import { QuizContentClassNotFoundError, QuizContentGroupMismatchError, QuizContentInputError, QuizContentService } from "./quizzes/quiz-content.service.js";
import { MysqlQuizSessionRepository, QuizSessionConflictError, QuizSessionReferenceError } from "./quizSessions/quiz-session.repository.js";
import { QuizSessionInputError, QuizSessionService } from "./quizSessions/quiz-session.service.js";
import { QUIZ_SESSION_MODES, type QuizSessionMode } from "./quizSessions/quiz-session.types.js";
import type { Question } from "./types/Question.js";

loadEnvFile();

if (
  !process.env.HOST_USERNAME ||
  !process.env.HOST_PASSWORD
) {
  console.error(
    "❌ HOST_USERNAME o HOST_PASSWORD no están configurados."
  );

  process.exit(1);
}else {
  console.log(
    "✅ HOST_USERNAME y HOST_PASSWORD están configurados."
  );
}


const app = express();
const PORT =
  process.env.PORT || 3001;
interface HostSession {
  userId?: string;
}

const hostSessions = new Map<string, HostSession>();
const users = new MysqlUserRepository();
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
const classService = new ClassService(classRepository, groupRepository);
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

function getHostCredentials() {
  return {
    username:
      process.env.HOST_USERNAME ?? "",
    password:
      process.env.HOST_PASSWORD ?? "",
  };
}

function requireHostAuth(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const authHeader =
    req.headers.authorization;
  const token =
    authHeader?.startsWith("Bearer ")
      ? authHeader.slice(7)
      : "";

  if (!token || !hostSessions.has(token)) {
    return res.status(401).json({
      message: "Unauthorized",
    });
  }

  next();
}

function getHostSession(req: Request): HostSession | null {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : "";

  return token ? hostSessions.get(token) ?? null : null;
}

async function resolveConfiguredHostSession(): Promise<HostSession> {
  const configuredHostUserId = process.env.HOST_USER_ID?.trim();

  if (!configuredHostUserId) {
    return {};
  }
  if (!/^\d+$/.test(configuredHostUserId)) {
    throw new HostIdentityConfigurationError("HOST_USER_ID must be a positive integer");
  }

  const host = await users.findById(configuredHostUserId);
  if (!host || (host.role !== "HOST" && host.role !== "ADMIN")) {
    throw new HostIdentityConfigurationError("Configured host user must have HOST or ADMIN role");
  }

  return { userId: host.id };
}

class HostIdentityConfigurationError extends Error {}

async function requireAdminAuth(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : "";

  if (!token || !hostSessions.has(token)) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  try {
    const administrator = await findConfiguredAdmin();

    if (!administrator || administrator.role !== "ADMIN") {
      res.status(403).json({ message: "Administrator role required" });
      return;
    }

    next();
  } catch (error: unknown) {
    next(error);
  }
}

function isValidQuestion(
  question: unknown
): question is Question {
  if (
    typeof question !== "object" ||
    question === null
  ) {
    return false;
  }

  const candidate =
    question as Partial<Question>;

  return (
    typeof candidate.text === "string" &&
    candidate.text.trim().length > 0 &&

    typeof candidate.explanation === "string" &&
    candidate.explanation.trim().length > 0 &&

    Array.isArray(candidate.options) &&
    candidate.options.length >= 2 &&
    candidate.options.every(
      (option) =>
        typeof option === "string" &&
        option.trim().length > 0
    ) &&

    typeof candidate.correctAnswer ===
      "number" &&
    Number.isInteger(
      candidate.correctAnswer
    ) &&
    candidate.correctAnswer >= 0 &&
    candidate.correctAnswer <
      candidate.options.length
  );
}

function getCodeParam(req: Request) {
  const { code } = req.params;

  return typeof code === "string"
    ? code
    : "";
}

interface PersistentGameRequest {
  quizId: string;
  groupId: string | null;
  mode: QuizSessionMode;
}

class PersistentGameRequestError extends Error {}

function parsePersistentGameRequest(body: unknown): PersistentGameRequest | null {
  const record = typeof body === "object" && body !== null
    ? body as Record<string, unknown>
    : {};

  if (record.quizId === undefined) {
    return null;
  }

  const quizId = parsePositiveId(record.quizId, "quizId");
  const groupId = record.groupId === undefined || record.groupId === null
    ? null
    : parsePositiveId(record.groupId, "groupId");
  const mode = record.mode === undefined ? "PRACTICE" : record.mode;

  if (typeof mode !== "string" || !QUIZ_SESSION_MODES.includes(mode as QuizSessionMode)) {
    throw new PersistentGameRequestError("mode must be OFFICIAL or PRACTICE");
  }

  return { quizId, groupId, mode: mode as QuizSessionMode };
}

function parsePositiveId(value: unknown, name: string): string {
  const normalized = typeof value === "number" ? String(value) : value;

  if (typeof normalized !== "string" || !/^\d+$/.test(normalized)) {
    throw new PersistentGameRequestError(`${name} must be a positive integer`);
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

app.use("/users", createUserRouter(requireAdminAuth));
app.use("/groups", createGroupRouter(requireAdminAuth, requireStudentAuth, groupService, classService));
app.use("/classes", createClassRouter(classService));
app.use(createAttendanceRouter(requireAdminAuth, attendanceService));

app.post("/host/login", async (req, res, next) => {
  const { username, password } = req.body;
  const credentials =
    getHostCredentials();

  if (
    !credentials.username ||
    !credentials.password
  ) {
    return res.status(500).json({
      code: "ENV_NOT_CONFIGURED",
  message:
    "El servidor no tiene configuradas las credenciales del host.",
    });
  }

  if (
    username !== credentials.username ||
    password !== credentials.password
  ) {
   return res.status(401).json({
  code: "INVALID_CREDENTIALS",
  message:
    "Usuario o contraseña incorrectos.",
});
  }

  try {
    const hostSession = await resolveConfiguredHostSession();
    const token = crypto.randomUUID();
    hostSessions.set(token, hostSession);

    res.json({ token });
  } catch (error: unknown) {
    if (error instanceof HostIdentityConfigurationError) {
      res.status(503).json({
        code: "HOST_IDENTITY_NOT_CONFIGURED",
        message: "El servidor no tiene una identidad de host válida configurada.",
      });
      return;
    }
    next(error);
  }
});

app.get(
  "/host/questions",
  requireHostAuth,
  (_, res) => {
    res.json(getConfiguredQuestions());
  }
);

app.post(
  "/host/questions",
  requireHostAuth,
  (req, res) => {
    const { questions } = req.body;

    if (
      !Array.isArray(questions) ||
      questions.length === 0 ||
      !questions.every(isValidQuestion)
    ) {
      return res.status(400).json({
        message:
          "Questions must include text, at least two options, and one valid correct answer.",
      });
    }

    const sanitizedQuestions =
      questions.map(
        (question) => ({
          id:
            typeof question.id ===
              "string" &&
            question.id.trim()
              ? question.id
              : crypto.randomUUID(),
          text: question.text.trim(),
          options: question.options.map(
            (option: string) =>
              option.trim()
          ),
          correctAnswer:
            question.correctAnswer,
            explanation:
          question.explanation.trim(),

           answers:
      new Array(
        question.options.length
      ).fill(0),
      
        })
      );

    res.json(
      setConfiguredQuestions(
        sanitizedQuestions
      )
    );
  }
);

// Persiste el quiz configurado por la HOST en quizzes/questions/options
// (QuizContentService, infraestructura ya existente). classId lo elige la
// HOST entre clases reales (GET /classes); createdBy sale de la sesión de
// HOST ya autenticada, nunca del body.
app.post("/host/quizzes", requireHostAuth, async (req, res, next) => {
  try {
    const hostSession = getHostSession(req);
    if (!hostSession?.userId) {
      res.status(503).json({
        code: "HOST_IDENTITY_NOT_CONFIGURED",
        message: "Configura HOST_USER_ID para poder guardar quizzes.",
      });
      return;
    }

    const body = req.body as Record<string, unknown>;
    const classId = typeof body.classId === "number" ? String(body.classId) : body.classId;
    const title = typeof body.title === "string" ? body.title : "";
    const description = typeof body.description === "string" ? body.description : undefined;
    const timeLimitSeconds = typeof body.timeLimitSeconds === "number" ? body.timeLimitSeconds : undefined;
    const questions = body.questions;

    if (
      !Array.isArray(questions) ||
      questions.length === 0 ||
      !questions.every(isValidQuestion)
    ) {
      res.status(400).json({
        message: "Questions must include text, at least two options, and one valid correct answer.",
      });
      return;
    }

    const quiz = await quizContentService.create({
      classId: typeof classId === "string" ? classId : "",
      title,
      description,
      timeLimitSeconds,
      createdBy: hostSession.userId,
      questions,
    });

    res.status(201).json(quiz);
  } catch (error: unknown) {
    if (error instanceof QuizContentInputError) {
      res.status(400).json({ message: error.message });
      return;
    }
    if (error instanceof QuizContentClassNotFoundError) {
      res.status(404).json({ message: error.message });
      return;
    }
    if (error instanceof QuizContentConflictError) {
      res.status(409).json({ message: error.message });
      return;
    }
    next(error);
  }
});

app.post("/games", requireHostAuth, async (req, res, next) => {
  let createdGame: ReturnType<typeof createGame> | undefined;

  try {
    const persistentRequest = parsePersistentGameRequest(req.body);

    // Compatibilidad: el frontend actual no envía quizId y conserva el flujo en memoria.
    if (!persistentRequest) {
      res.json(createGame());
      return;
    }

    const hostSession = getHostSession(req);
    if (!hostSession?.userId) {
      res.status(503).json({
        code: "HOST_IDENTITY_NOT_CONFIGURED",
        message: "Configura HOST_USER_ID para crear sesiones persistentes.",
      });
      return;
    }

    const quiz = await quizContentService.getById(persistentRequest.quizId);
    if (!quiz) {
      res.status(404).json({
        code: "QUIZ_NOT_FOUND",
        message: "Quiz not found",
      });
      return;
    }

    // El groupId real sale siempre de la clase del quiz (quiz.classId), nunca
    // se acepta un valor arbitrario: si el body propone uno, debe coincidir
    // exactamente con el de esa clase.
    const resolvedGroupId = await quizContentService.resolveGroupIdForQuiz(
      quiz,
      persistentRequest.groupId,
    );

    const questions = toGameManagerQuestions(quiz);
    createdGame = createGame(questions);

    try {
      await quizSessionService.create({
        quizId: persistentRequest.quizId,
        hostId: hostSession.userId,
        groupId: resolvedGroupId,
        gameCode: createdGame.code,
        mode: persistentRequest.mode,
      });
    } catch (error: unknown) {
      deleteGame(createdGame.code);
      throw error;
    }

    res.json(createdGame);
  } catch (error: unknown) {
    if (error instanceof QuizContentGroupMismatchError) {
      res.status(400).json({ message: error.message });
      return;
    }
    if (error instanceof QuizContentClassNotFoundError) {
      res.status(409).json({ message: error.message });
      return;
    }
    if (error instanceof PersistentGameRequestError || error instanceof QuizContentInputError || error instanceof QuizSessionInputError) {
      res.status(400).json({ message: error.message });
      return;
    }
    if (error instanceof QuizSessionConflictError) {
      res.status(409).json({ message: error.message });
      return;
    }
    if (error instanceof QuizSessionReferenceError) {
      res.status(400).json({ message: error.message });
      return;
    }
    next(error);
  }
});


app.post("/games/:code/join", (req, res) => {
  const { code } = req.params;
  const { name } = req.body;

  const game = joinGame(code, name);

  if (!game) {
    return res.status(404).json({
      message: "Game not found",
    });
  }

  res.json(game);
});


app.get("/games/:code", requireHostAuth, (req, res) => {
  const code = getCodeParam(req);

  const game = getGame(code);

  if (!game) {
    return res.status(404).json({
      message: "Game not found",
    });
  }

  res.json(game);
});

app.post("/games/:code/start", requireHostAuth, async (req, res) => {
  const code = getCodeParam(req);
  const game = startGame(code);

  if (!game) {
    return res.status(404).json({
      message: "Game not found",
    });
  }

  // Asistencia automática (best-effort): registra PRESENT para las alumnas
  // que ya están en el juego, si este juego tiene una quiz_session persistida
  // (creada al usar un quiz guardado). Nunca bloquea ni rompe el inicio del
  // juego: cualquier fallo queda solo logueado.
  try {
    await gameAttendanceService.registerPresentPlayersForGame(code, game.players);
  } catch (error: unknown) {
    console.error("Error registrando asistencia automática al iniciar el juego", error);
  }

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

app.post("/games/:code/answer", (req, res) => {
  const { code } = req.params;

  const {
    playerId,
    answer,
    timeLeft
  } = req.body;

  const result = submitAnswer(
    code,
    playerId,
    answer,
    timeLeft
  );

  if (!result) {
    return res.status(404).json({
      message: "Unable to submit answer"
    });
  }

  res.json(result);
});

app.post("/games/:code/next", requireHostAuth, (req, res) => {
  const game = nextQuestion(
    getCodeParam(req)
  );

  if (!game) {
    return res.status(404).json({
      message: "Game not found",
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
app.post("/games/:code/icebreaker", (req, res) => {
  const { question } = req.body; // Ej: { "question": "¿Cuál es tu comida favorita?" }

  if (!question) {
    return res.status(400).json({ message: "Question is required" });
  }

  const icebreaker = startIcebreaker(req.params.code, question);

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
app.post("/games/:code/icebreaker/answer", (req, res) => {
  const { playerName, text } = req.body; // Ej: { "playerName": "Juan", "text": "Pizza" }

  if (!playerName || !text) {
    return res.status(400).json({ message: "playerName and text are required" });
  }

  const result = submitIcebreakerAnswer(req.params.code, playerName, text);

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
app.put("/games/:code/icebreaker/close", (req, res) => {
  const icebreaker = closeIcebreaker(req.params.code);

  if (!icebreaker) {
    return res.status(404).json({ message: "Game or Icebreaker not found" });
  }

  res.json({ message: "Icebreaker closed successfully", icebreaker });
});

app.get(
  "/games/:code/stats",
  (req, res) => {

    const stats =
      getGameStats(req.params.code);

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
