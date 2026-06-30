import type { Game } from "./types/Game.js";
import type { Player } from "./types/Player.js";
import type { Question } from "./types/Question.js";

const games = new Map<string, Game>();
const QUESTION_DURATION_SECONDS = 15;
let configuredQuestions: Question[] | null = null;

const defaultQuestions: Question[] = [
{
"id": "1",
"text": "¿Qué método HTTP se utiliza comúnmente para obtener datos de una API en Python?",
"options": [
"POST",
"GET",
"PUT",
"DELETE"
],
"correctAnswer": 1,
 "explanation":
    "GET se utiliza para obtener información del servidor. POST se usa para enviar datos."

},
{
"id": "2",
"text": "¿Qué significa API?",
"options": [
"Advanced Programming Interface",
"Application Programming Interface",
"Application Processing Interface",
"Automated Programming Interface"
],
"correctAnswer": 1,
 "explanation":
    "GET se utiliza para obtener información del servidor. POST se usa para enviar datos."
},
{
"id": "3",
"text": "En Python para interactuar con bases de datos MySQL y PostgreSQL, ¿qué biblioteca se utiliza para PostgreSQL?",
"options": [
"PyMySQL",
"MySQLdb",
"SQLite3",
"psycopg2"
],
"correctAnswer": 3,
 "explanation":
    "GET se utiliza para obtener información del servidor. POST se usa para enviar datos."
},
{
"id": "4",
"text": "¿Qué cursor se utiliza para ejecutar una consulta SQL en una base de datos MySQL?",
"options": [
"cursor.execute()",
"cursor.query()",
"cursor.run()",
"cursor.commit()"
],
"correctAnswer": 0,
 "explanation":
    "GET se utiliza para obtener información del servidor. POST se usa para enviar datos."
},
{
"id": "5",
"text": "¿En MongoDB qué método se utiliza para insertar un documento en una colección?",
"options": [
"insert_one()",
"add_one()",
"insert_document()",
"add_document()"
],
"correctAnswer": 0,
 "explanation":
    "GET se utiliza para obtener información del servidor. POST se usa para enviar datos."
},
{
"id": "6",
"text": "¿Cuál de los siguientes NO es un método HTTP?",
"options": [
"GET",
"POST",
"FETCH",
"DELETE"
],
"correctAnswer": 2,
 "explanation":
    "GET se utiliza para obtener información del servidor. POST se usa para enviar datos."
}
];

function cloneQuestions(questions: Question[]) {
  return questions.map((question) => ({
    ...question,
    options: [...question.options],
  }));
}

export function getConfiguredQuestions() {
  return cloneQuestions(
    configuredQuestions ??
      defaultQuestions
  );
}

export function setConfiguredQuestions(
  questions: Question[]
) {
  configuredQuestions =
    cloneQuestions(questions);

  return getConfiguredQuestions();
}

export function createGame() {
  const questions =
    getConfiguredQuestions();

  const code = generateCode();

 const game = {
  code,
  players: [],
  questions,
  currentQuestion: -1,
  questionDurationSeconds: QUESTION_DURATION_SECONDS,
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

  const question =
    game.questions[game.currentQuestion];

  if (!question) {
    return null;
  }

  return {
    ...question,
    durationSeconds: game.questionDurationSeconds,
  };
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
    const safeTimeLeft = Math.max(
      0,
      Math.min(
        Math.ceil(timeLeft),
        game.questionDurationSeconds
      )
    );

    console.log("timeLeft:", safeTimeLeft);
    player.score += safeTimeLeft * 100;
  }

    return {
      correct: isCorrect,
      score: player.score,
      correctAnswer: question.correctAnswer,
      explanation: question.explanation,
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
