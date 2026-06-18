import express from "express";
import cors from "cors";

import { createGame, joinGame, getGame, startGame, getCurrentQuestion,   submitAnswer, nextQuestion, getLeaderboard } from "./gameManager";


const app = express();
const PORT = 3001;

app.listen(PORT, () => {
  console.log(`Server running on ${PORT}`);
});


app.use(cors());
app.use(express.json());

app.get("/health", (_, res) => {
  res.json({
    status: "ok",
  });
});

app.post("/games", (_, res) => {
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


app.get("/games/:code", (req, res) => {
  const { code } = req.params;

  const game = getGame(code);

  if (!game) {
    return res.status(404).json({
      message: "Game not found",
    });
  }

  res.json(game);
});

app.post("/games/:code/start", (req, res) => {
  const game = startGame(req.params.code);

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

app.post("/games/:code/next", (req, res) => {
  const game = nextQuestion(
    req.params.code
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


