import crypto from "node:crypto";
import type { Game } from "./types/Game.js";
import type { Player } from "./types/Player.js";
import type { Question } from "./types/Question.js";


const games = new Map<string, Game>();
export const DEFAULT_QUESTION_SECONDS = 22;
export const MIN_QUESTION_SECONDS = 5;
export const MAX_QUESTION_SECONDS = 300;

function cloneQuestions(
  questions: Question[]
) {
  return questions.map(question => ({
    ...question,
    options: [...question.options],
    answers: [...question.answers],
  }));
}

// Las preguntas siempre vienen de un quiz guardado en la BD.
// La host elige los segundos por pregunta al crear el juego (más tiempo =
// más puntos posibles, es intencional).
export function createGame(
  suppliedQuestions: Question[],
  questionDurationSeconds: number = DEFAULT_QUESTION_SECONDS,
) {
  const questions = cloneQuestions(suppliedQuestions);

  const code = generateCode();

  const game: Game = { 
  code,
  players: [],
  questions,
  currentQuestion: -1,
  questionDurationSeconds,
};

  games.set(code, game);

  return game;
}

function generateCode() {
  return `ANA-${Math.floor(
    1000 + Math.random() * 9000
  )}`;
}

// Normaliza lo que teclea el alumno ("ana-1234 " -> "ANA-1234").
export function normalizeGameCode(code: string): string {
  return code.trim().toUpperCase();
}

function findGame(code: string): Game | undefined {
  return games.get(normalizeGameCode(code));
}

// Se permite contestar un poco después de que el cronómetro llega a 0, para
// compensar la latencia de red; esa respuesta vale 0 puntos.
const ANSWER_GRACE_MS = 1500;

export function joinGame(code: string, playerName: string) {
  const game = findGame(code);

  if (!game) {
    return null;
  }

  // Evitar duplicar el jugador si refresca la pantalla o entra desde otro dispositivo.
  let player = game.players.find(p => p.name === playerName);

  if (!player) {
    player = {
      id: crypto.randomUUID(),
      name: playerName,
      score: 0,
      answeredQuestions: [],
    };
    game.players.push(player);
  }

  // Nunca se devuelve el juego completo: incluye las respuestas correctas.
  return { code: game.code, player: { id: player.id, name: player.name } };
}

export function startGame(code: string, now: number = Date.now()) {
  const game = findGame(code);

  if (!game) {
    return null;
  }

  // Un doble clic en "Iniciar" no debe regresar el juego a la pregunta 1.
  if (game.currentQuestion < 0) {
    game.currentQuestion = 0;
    game.questionStartedAt = now;
  }

  return game;
}

function remainingMs(game: Game, now: number): number {
  const startedAt = game.questionStartedAt ?? now;
  return game.questionDurationSeconds * 1000 - (now - startedAt);
}

// Lo que ve el alumno: sin respuesta correcta, explicación ni conteos.
export function getCurrentQuestion(
  code: string,
  now: number = Date.now(),
) {
  const game = findGame(code);

  if (!game) {
    return null;
  }

  if (game.currentQuestion < 0) {
    return {
      waiting: true
    };
  }

  if (
    game.currentQuestion >=
    game.questions.length
  ) {
    return {
      finished: true
    };
  }

  const question =
    game.questions[game.currentQuestion];

  if (!question) {
    return null;
  }

  return {
    id: question.id,
    text: question.text,
    options: [...question.options],
    durationSeconds: game.questionDurationSeconds,
    remainingSeconds: Math.max(0, Math.ceil(remainingMs(game, now) / 1000)),
  };
}

export type SubmitAnswerResult =
  | { status: "NOT_FOUND" }
  // La pregunta ya cambió (la host avanzó): no se cuenta en la siguiente.
  | { status: "STALE_QUESTION" }
  | {
      status: "OK";
      correct: boolean;
      alreadyAnswered: boolean;
      timeUp: boolean;
      score: number;
      correctAnswer: number;
      explanation: string;
    };

// El jugador se identifica por su nickname de sesión (no por un playerId que
// cualquiera puede ver) y los puntos se calculan con el reloj del servidor.
export function submitAnswer(
  code: string,
  playerName: string,
  questionId: string,
  answer: number,
  now: number = Date.now(),
): SubmitAnswerResult {
  const game = findGame(code);
  const player = game?.players.find((p: Player) => p.name === playerName);
  const question = game?.questions[game.currentQuestion];

  if (!game || !player || !question) {
    return { status: "NOT_FOUND" };
  }

  if (question.id !== questionId) {
    return { status: "STALE_QUESTION" };
  }

  const reveal = { correctAnswer: question.correctAnswer, explanation: question.explanation };

  if (player.answeredQuestions.includes(question.id)) {
    return { status: "OK", correct: false, alreadyAnswered: true, timeUp: false, score: player.score, ...reveal };
  }

  const remaining = remainingMs(game, now);
  const timeUp = remaining <= -ANSWER_GRACE_MS;
  const validAnswer = Number.isInteger(answer) && answer >= 0 && answer < question.options.length;

  player.answeredQuestions.push(question.id);

  if (timeUp || !validAnswer) {
    return { status: "OK", correct: false, alreadyAnswered: false, timeUp, score: player.score, ...reveal };
  }

  // Cada respuesta se cuenta UNA sola vez en las estadísticas.
  question.answers[answer] = (question.answers[answer] ?? 0) + 1;

  const correct = answer === question.correctAnswer;
  if (correct) {
    const secondsLeft = Math.min(Math.max(0, Math.ceil(remaining / 1000)), game.questionDurationSeconds);
    player.score += secondsLeft * 100;
  }

  return { status: "OK", correct, alreadyAnswered: false, timeUp: false, score: player.score, ...reveal };
}

// Devuelve el juego y si con este paso terminó el quiz (solo una vez).
export function nextQuestion(code: string, now: number = Date.now()) {
  const game = findGame(code);

  if (!game) {
    return null;
  }

  // Sin iniciar o ya terminado: no avanza (evita índices fuera de rango).
  if (game.currentQuestion < 0 || game.currentQuestion >= game.questions.length) {
    return { game, justFinished: false };
  }

  game.currentQuestion++;
  game.questionStartedAt = now;

  return { game, justFinished: game.currentQuestion === game.questions.length };
}

// Público (lo usa el podio): solo nombre y puntos.
export function getLeaderboard(
  code: string
) {
  const game = findGame(code);

  if (!game) {
    return null;
  }

  return [...game.players]
    .sort((a: Player, b: Player) => b.score - a.score)
    .map(({ id, name, score }) => ({ id, name, score }));
}


export function getGame(code: string) {
  return findGame(code);
}

export function deleteGame(code: string): void {
  games.delete(normalizeGameCode(code));
}

// 1. Activa el icebreaker en el juego con una pregunta inicial
export function startIcebreaker(code: string, question: string) {
  const game = findGame(code);
  if (!game) return null;

  game.icebreaker = {
    active: true,
    question: question,
    answers: []
  };

  return game.icebreaker;
}

// 2. Obtiene el estado actual del icebreaker
export function getIcebreaker(code: string) {
  const game = findGame(code);
  if (!game || !game.icebreaker) return null;

  return game.icebreaker;
}

// 3. Guarda la respuesta abierta de un jugador
export function submitIcebreakerAnswer(code: string, playerName: string, text: string) {
  const game = findGame(code);
  if (!game || !game.icebreaker || !game.icebreaker.active) return null;

  // Evitar respuestas duplicadas del mismo jugador (opcional)
  const alreadyAnswered = game.icebreaker.answers.some(a => a.playerName === playerName);
  if (alreadyAnswered) return { error: "Player already answered" };

  const newAnswer = {
    id: crypto.randomUUID(),
    text,
    playerName
  };

  game.icebreaker.answers.push(newAnswer);
  return newAnswer;
}

// 4. Desactiva o cierra el icebreaker
export function closeIcebreaker(code: string) {
  const game = findGame(code);
  if (!game || !game.icebreaker) return null;

  game.icebreaker.active = false;
  return game.icebreaker;
}

export function getGameStats(
  code: string
){

  const game = findGame(code);

if (!game) {
  return null;
}

return game.questions.map(question => {
const total =
question.answers.reduce(
  (sum, value) => sum + value,
  0
);

const correct =
  question.answers[
    question.correctAnswer
  ] ?? 0;

const incorrect =
total - correct;

const percentage =
total === 0
? 0
: Math.round(
(correct / total) * 100
);
return {

 id: question.id,

  text: question.text,

  options: [...question.options],

  answers: [...question.answers],

  correctAnswer:
    question.correctAnswer,

  correct,

  incorrect,

  total,

  percentage,

};
});


}
