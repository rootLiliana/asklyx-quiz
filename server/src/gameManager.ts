import type { Game, IceBreaker } from "./types/Game.js";
import type { Player } from "./types/Player.js";
import type { Question } from "./types/Question.js";


const games = new Map<string, Game>();
const QUESTION_DURATION_SECONDS = 15;
let configuredQuestions: Question[] | null = null;

const defaultQuestions: Question[] = [
  {
    "id": "1",
    "text": "¿Cuál es la principal ventaja de utilizar funciones vectorizadas en Pandas?",
    "options": [
      "Permiten recorrer los datos usando ciclos for.",
      "Aplican operaciones sobre toda la colección de datos de forma eficiente.",
      "Solo funcionan con columnas numéricas.",
      "Eliminan automáticamente los valores nulos."
    ],
    "correctAnswer": 1,
    "explanation": "Las funciones vectorizadas aplican una operación a todos los elementos de una Serie o DataFrame de manera optimizada, evitando recorrer los datos elemento por elemento."
  },
  {
    "id": "2",
    "text": "¿Cuál de las siguientes funciones es una función de agregación en Pandas?",
    "options": [
      "sqrt()",
      "replace()",
      "mean()",
      "astype()"
    ],
    "correctAnswer": 2,
    "explanation": "Las funciones de agregación resumen varios valores en uno solo. mean() calcula el promedio de los datos."
  },
  {
    "id": "3",
    "text": "¿Qué hace Pandas al realizar una operación entre dos DataFrames?",
    "options": [
      "Une las filas según el orden en que aparecen.",
      "Elimina automáticamente las filas con valores nulos.",
      "Alinea los datos utilizando los índices y nombres de las columnas.",
      "Solo permite la operación si ambos DataFrames tienen el mismo tamaño."
    ],
    "correctAnswer": 2,
    "explanation": "Pandas alinea automáticamente las filas y columnas por sus etiquetas antes de realizar operaciones entre DataFrames."
  },
  {
    "id": "4",
    "text": "¿Qué realiza el método dropna(how='any')?",
    "options": [
      "Elimina las columnas que contienen valores nulos.",
      "Reemplaza los valores faltantes por cero.",
      "Elimina las filas que tengan al menos un valor faltante.",
      "Elimina únicamente los registros duplicados."
    ],
    "correctAnswer": 2,
    "explanation": "Con how='any', cualquier fila que contenga al menos un valor faltante (NaN) será eliminada."
  },
  {
    "id": "5",
    "text": "¿Cuál es el objetivo de convertir los nombres de las columnas a snake_case?",
    "options": [
      "Reducir el tamaño del DataFrame.",
      "Mejorar la consistencia y facilitar el acceso a las columnas.",
      "Eliminar automáticamente los espacios y valores nulos.",
      "Ordenar las columnas alfabéticamente."
    ],
    "correctAnswer": 1,
    "explanation": "Utilizar snake_case hace que los nombres de las columnas sean más consistentes y fáciles de utilizar en el código."
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

  const game: Game = { 
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
  return `ANA-${Math.floor(
    1000 + Math.random() * 9000
  )}`;
}

export function joinGame(code: string, playerName: string) {
  const game = games.get(code);

  if (!game) {
    return null;
  }

  // Evitar duplicar el jugador si refresca la pantalla
  const existingPlayer = game.players.find(p => p.name === playerName);
  
  if (!existingPlayer) {
    game.players.push({
      id: crypto.randomUUID(),
      name: playerName,
      score: 0,
      answeredQuestions: []

    });

    
  }

  
  return game; // ¡Asegúrate de retornar todo el objeto game completo aquí!
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

const alreadyAnswered =
  player.answeredQuestions.includes(
    question.id
  );

  if (alreadyAnswered) {
  return {
    correct: false,
    alreadyAnswered: true,
    score: player.score,
    correctAnswer: question.correctAnswer,
    explanation: question.explanation,
  };
}

player.answeredQuestions.push(
  question.id
);


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

// 1. Activa el icebreaker en el juego con una pregunta inicial
export function startIcebreaker(code: string, question: string) {
  const game = games.get(code);
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
  const game = games.get(code);
  if (!game || !game.icebreaker) return null;

  return game.icebreaker;
}

// 3. Guarda la respuesta abierta de un jugador
export function submitIcebreakerAnswer(code: string, playerName: string, text: string) {
  const game = games.get(code);
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
  const game = games.get(code);
  if (!game || !game.icebreaker) return null;

  game.icebreaker.active = false;
  return game.icebreaker;
}
