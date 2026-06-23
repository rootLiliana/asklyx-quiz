import type { Game } from "./types/Game.js";
import type { Player } from "./types/Player.js";

const games = new Map<string, Game>();
export function createGame() {

 const questions = [
{
"id": "1",
"text": "¿Qué significa API?",
"options": [
"Advanced Programming Interface",
"Application Programming Interface",
"Application Processing Interface",
"Automated Programming Interface"
],
"correctAnswer": 1
},
{
"id": "2",
"text": "¿Cuál es el propósito principal de una API?",
"options": [
"Ejecutar código más rápido",
"Permitir la comunicación entre aplicaciones",
"Crear interfaces gráficas",
"Almacenar datos"
],
"correctAnswer": 1
},
{
"id": "3",
"text": "¿Qué código HTTP indica que una solicitud fue exitosa?",
"options": [
"404",
"500",
"403",
"200"
],
"correctAnswer": 3
},
{
"id": "4",
"text": "¿Cuál de las siguientes opciones es una base de datos NoSQL?",
"options": [
"MySQL",
"PostgreSQL",
"SQLite",
"MongoDB"
],
"correctAnswer": 3
},
{
"id": "5",
"text": "¿Qué comando SQL se utiliza para recuperar datos de una base de datos?",
"options": [
"INSERT",
"UPDATE",
"SELECT",
"DELETE"
],
"correctAnswer": 2
}
];


  const code = generateCode();

 const game = {
  code,
  players: [],
  questions,
  currentQuestion: -1,
};

  games.set(code, game);

  return game;
}

function generateCode() {
  return `BEDU-${Math.floor(
    1000 + Math.random() * 9000
  )}`;
}

export function joinGame(
  code: string,
  playerName: string
) {
  const game = games.get(code);

  if (!game) {
    return null;
  }

  game.players.push({
    id: crypto.randomUUID(),
    name: playerName,
    score: 0,
  });

  return game;
}

export function startGame(code: string) {
  const game = games.get(code);

  if (!game) {
    return null;
  }

  game.currentQuestion = 0;

  return game;
}


export function getCurrentQuestion(
  code: string
) {
  const game = games.get(code);

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

  return game.questions[
    game.currentQuestion
  ];
}

export function submitAnswer(
  code: string,
  playerId: string,
  answer: number,
  timeLeft: number
) {
  console.log("code:", code);
  console.log("playerId:", playerId);

  const game = games.get(code);

  console.log("game:", game);

  if (!game) {
    return null;
  }

  const player = game.players.find(
  (p: Player) => p.id === playerId
);

  if (!player) {
    return null;
  }

  const question =
    game.questions[game.currentQuestion];

  if (!question) {
    return null;
  }

  const isCorrect =
    answer === question.correctAnswer;

  if (isCorrect) {
    console.log("timeLeft:", timeLeft);
    player.score += timeLeft * 100;
  }

  return {
    correct: isCorrect,
    score: player.score,
  };
}


export function nextQuestion(code: string) {
  const game = games.get(code);

  if (!game) {
    return null;
  }

 game.currentQuestion++;

  return game;
}

export function getLeaderboard(
  code: string
) {
  const game = games.get(code);

  if (!game) {
    return null;
  }

 return [...game.players].sort(
  (a: Player, b: Player) =>
    b.score - a.score
);
}


export function getGame(code: string) {
  return games.get(code);
}