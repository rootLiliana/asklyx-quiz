import express from "express";
import cors from "cors";
import type {
  Request,
  Response,
  NextFunction,
} from "express";

import { createGame, joinGame, getGame, startGame, getCurrentQuestion,   submitAnswer, nextQuestion, getLeaderboard, getConfiguredQuestions, setConfiguredQuestions } from "./gameManager.js";
import { loadEnvFile } from "./env.js";
import type { Question } from "./types/Question.js";

loadEnvFile();

const app = express();
const PORT =
  process.env.PORT || 3001;
const hostSessions = new Set<string>();

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

app.listen(PORT, () => {
  console.log(
    `Server running on ${PORT}`
  );
});

app.use(cors());
app.use(express.json());

app.get("/health", (_, res) => {
  res.json({
    status: "ok",
  });
});

app.post("/host/login", (req, res) => {
  const { username, password } = req.body;
  const credentials =
    getHostCredentials();

  if (
    !credentials.username ||
    !credentials.password
  ) {
    return res.status(500).json({
      message:
        "Host credentials are not configured",
    });
  }

  if (
    username !== credentials.username ||
    password !== credentials.password
  ) {
    return res.status(401).json({
      message: "Invalid credentials",
    });
  }

  const token = crypto.randomUUID();

  hostSessions.add(token);

  res.json({ token });
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
        })
      );

    res.json(
      setConfiguredQuestions(
        sanitizedQuestions
      )
    );
  }
);

app.post("/games", requireHostAuth, (_, res) => {
  const game = createGame();

  res.json(game);
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

app.post("/games/:code/start", requireHostAuth, (req, res) => {
  const game = startGame(
    getCodeParam(req)
  );

  if (!game) {
    return res.status(404).json({
      message: "Game not found",
    });
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
