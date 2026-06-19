import type { Game } from "./types/Game.js";
import type { Player } from "./types/Player.js";

const games = new Map<string, Game>();
export function createGame() {

  const questions = [
{
"id": "1",
"text": "¿Qué método HTTP se utiliza comúnmente para obtener datos de una API en Python?",
"options": [
"POST",
"GET",
"PUT",
"DELETE"
],
"correctAnswer": 1
},
{
"id": "2",
"text": "En Python para interactuar con bases de datos MySQL y PostgreSQL, ¿qué biblioteca se utiliza para PostgreSQL?",
"options": [
"PyMySQL",
"MySQLdb",
"SQLite3",
"psycopg2"
],
"correctAnswer": 3
},
{
"id": "3",
"text": "¿Qué cursor se utiliza para ejecutar una consulta SQL en una base de datos MySQL?",
"options": [
"cursor.execute()",
"cursor.query()",
"cursor.run()",
"cursor.commit()"
],
"correctAnswer": 0
},
{
"id": "4",
"text": "¿En MongoDB qué método se utiliza para insertar un documento en una colección?",
"options": [
"insert_one()",
"add_one()",
"insert_document()",
"add_document()"
],
"correctAnswer": 0
},
{
"id": "5",
"text": "¿Cuál es un motor de base de datos que se utiliza para interactuar con MongoDB desde Python?",
"options": [
"SQLAlchemy",
"PyMongo",
"DjangoORM",
"PySQLite"
],
"correctAnswer": 1
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