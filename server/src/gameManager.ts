import crypto from "node:crypto";
import type { Game, IceBreaker } from "./types/Game.js";
import type { Player } from "./types/Player.js";
import type { Question } from "./types/Question.js";


const games = new Map<string, Game>();
const QUESTION_DURATION_SECONDS = 22;

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
export function createGame(
  suppliedQuestions: Question[],
) {
  const questions = cloneQuestions(suppliedQuestions);

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

// ✅ Contamos la respuesta UNA sola vez
if (
  answer >= 0 &&
  answer < question.answers.length &&
  question.answers[answer] !== undefined
) {
  question.answers[answer]++;
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

export function deleteGame(code: string): void {
  games.delete(code);
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

export function getGameStats(
  code: string
){

  const game = games.get(code);

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
