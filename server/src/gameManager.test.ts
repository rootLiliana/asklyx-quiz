import assert from "node:assert/strict";
import test from "node:test";

import {
  createGame,
  getCurrentQuestion,
  getLeaderboard,
  joinGame,
  nextQuestion,
  startGame,
  submitAnswer,
} from "./gameManager.js";
import type { Question } from "./types/Question.js";

const question = (id: string): Question => ({
  id,
  text: `Pregunta ${id}`,
  options: ["A", "B", "C"],
  correctAnswer: 1,
  explanation: `Explicación ${id}`,
  answers: [0, 0, 0],
});

function newGame() {
  const game = createGame([question("q1"), question("q2")]);
  return game.code;
}

test("join never exposes the questions or the correct answers", () => {
  const code = newGame();
  const joined = joinGame(code, "ana");

  assert.deepEqual(Object.keys(joined ?? {}).sort(), ["code", "player"]);
  assert.equal(JSON.stringify(joined).includes("correctAnswer"), false);
  assert.equal(joined?.player.name, "ana");
});

test("the game code typed by a student is case and space insensitive", () => {
  const code = newGame();
  assert.ok(joinGame(`  ${code.toLowerCase()} `, "ana"));
});

test("the current question sent to students has no correct answer, explanation or vote counts", () => {
  const code = newGame();
  startGame(code, 0);

  const current = getCurrentQuestion(code, 0);

  assert.ok(current && "text" in current);
  assert.deepEqual(Object.keys(current).sort(), ["durationSeconds", "id", "options", "remainingSeconds", "text"]);
  assert.equal(current.remainingSeconds, 22);
});

test("remaining time comes from the server clock", () => {
  const code = newGame();
  startGame(code, 0);

  const current = getCurrentQuestion(code, 10_000);
  assert.ok(current && "remainingSeconds" in current);
  assert.equal(current.remainingSeconds, 12);
});

test("points are computed with server time, not with a value sent by the browser", () => {
  const code = newGame();
  joinGame(code, "ana");
  startGame(code, 0);

  const result = submitAnswer(code, "ana", "q1", 1, 5_000);

  assert.equal(result.status, "OK");
  assert.ok(result.status === "OK" && result.correct);
  assert.equal(result.status === "OK" && result.score, 1700); // 17 s restantes x 100
});

test("an answer after the time is up (beyond the grace period) scores nothing", () => {
  const code = newGame();
  joinGame(code, "ana");
  startGame(code, 0);

  const result = submitAnswer(code, "ana", "q1", 1, 30_000);

  assert.ok(result.status === "OK" && result.timeUp);
  assert.equal(result.status === "OK" && result.score, 0);
});

test("an answer meant for a question that already changed is rejected, not counted on the next one", () => {
  const code = newGame();
  joinGame(code, "ana");
  startGame(code, 0);
  nextQuestion(code, 1_000);

  const result = submitAnswer(code, "ana", "q1", 1, 1_500);

  assert.equal(result.status, "STALE_QUESTION");
});

test("a second answer to the same question does not add points again", () => {
  const code = newGame();
  joinGame(code, "ana");
  startGame(code, 0);

  submitAnswer(code, "ana", "q1", 1, 1_000);
  const second = submitAnswer(code, "ana", "q1", 1, 2_000);

  assert.ok(second.status === "OK" && second.alreadyAnswered);
  assert.equal(second.status === "OK" && second.score, 2100);
});

test("an invalid answer index is not counted and scores nothing", () => {
  const code = newGame();
  joinGame(code, "ana");
  startGame(code, 0);

  const result = submitAnswer(code, "ana", "q1", 99, 1_000);

  assert.ok(result.status === "OK" && !result.correct);
  assert.equal(result.status === "OK" && result.score, 0);
});

test("pressing start twice does not send the game back to the first question", () => {
  const code = newGame();
  startGame(code, 0);
  nextQuestion(code, 1_000);

  const game = startGame(code, 2_000);

  assert.equal(game?.currentQuestion, 1);
});

test("nextQuestion reports the end of the quiz exactly once and never goes out of range", () => {
  const code = newGame();

  assert.equal(nextQuestion(code)?.justFinished, false); // sin iniciar: no avanza
  assert.equal(nextQuestion(code)?.game.currentQuestion, -1);

  startGame(code, 0);
  assert.equal(nextQuestion(code, 1)?.justFinished, false);
  assert.equal(nextQuestion(code, 2)?.justFinished, true);
  assert.equal(nextQuestion(code, 3)?.justFinished, false);
  assert.equal(nextQuestion(code, 4)?.game.currentQuestion, 2);
});

test("the public leaderboard only has id, name and score, sorted by score", () => {
  const code = newGame();
  joinGame(code, "ana");
  joinGame(code, "luis");
  startGame(code, 0);
  submitAnswer(code, "luis", "q1", 1, 0);

  const leaderboard = getLeaderboard(code);

  assert.deepEqual(leaderboard?.map((player) => player.name), ["luis", "ana"]);
  assert.deepEqual(Object.keys(leaderboard?.[0] ?? {}).sort(), ["id", "name", "score"]);
});
