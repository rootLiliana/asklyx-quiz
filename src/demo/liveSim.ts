// Juego en vivo simulado para la vista previa del Control Center: alumnas de
// ejemplo entran solas, contestan con distintas velocidades y llenan el rompehielos.
import { DEMO_QUESTIONS } from "./mockApi";

interface SimPlayer {
  id: string;
  name: string;
  score: number;
  answeredQuestions: string[];
  joinAt: number;
  skill: number; // probabilidad de acertar
  speed: number; // 0..1, qué tan rápido contesta
}

interface SimGame {
  code: string;
  createdAt: number;
  durationSeconds: number;
  currentQuestion: number;
  questionStartedAt: number;
  questions: { id: string; text: string; options: string[]; correctAnswer: number; explanation: string; answers: number[] }[];
  players: SimPlayer[];
  icebreaker: { active: boolean; question: string; answers: { id: string; text: string; playerName: string }[]; startedAt: number } | null;
}

const NAMES = ["vale_dev", "xime", "renata.py", "cam", "dani_sql", "fer", "regi", "mar", "sofi", "andy"];
const SKILL = [0.9, 0.8, 0.75, 0.7, 0.65, 0.6, 0.55, 0.5, 0.45, 0.4];
const ICE_ANSWERS = ["Con chile y limón", "¡Esquite siempre!", "Con mayonesa y queso", "Solo con sal", "Con Takis encima", "Asado y con mantequilla"];

let game: SimGame | null = null;
let seed = 42;
const rand = () => {
  seed = (seed * 9301 + 49297) % 233280;
  return seed / 233280;
};

export function simCreate(durationSeconds: number) {
  seed = 42;
  const now = Date.now();
  game = {
    code: "ANA-4821",
    createdAt: now,
    durationSeconds,
    currentQuestion: -1,
    questionStartedAt: now,
    questions: DEMO_QUESTIONS.map((q) => ({ ...q, id: q.id.split("#")[0] ?? q.id, answers: q.options.map(() => 0) })),
    players: NAMES.map((name, i) => ({
      id: `p${i}`,
      name,
      score: 0,
      answeredQuestions: [],
      joinAt: now + 600 + i * 900,
      skill: SKILL[i] ?? 0.5,
      speed: 0.25 + rand() * 0.6,
    })),
    icebreaker: null,
  };
  return publicGame();
}

// Avanza la simulación hasta "ahora": quién ya entró y quién ya contestó.
function tick() {
  if (!game) return;
  const now = Date.now();
  const question = game.questions[game.currentQuestion];
  if (!question) return;
  const elapsed = (now - game.questionStartedAt) / 1000;
  for (const p of joined()) {
    if (p.answeredQuestions.includes(question.id)) continue;
    const answerAfter = 2 + p.speed * (game.durationSeconds - 4);
    if (elapsed < answerAfter) continue;
    p.answeredQuestions.push(question.id);
    const correct = rand() < p.skill;
    const wrongOptions = question.options.map((_, i) => i).filter((i) => i !== question.correctAnswer);
    const choice = correct ? question.correctAnswer : wrongOptions[Math.floor(rand() * rand() * wrongOptions.length)] ?? 0;
    question.answers[choice] = (question.answers[choice] ?? 0) + 1;
    if (correct) p.score += Math.max(0, Math.ceil(game.durationSeconds - answerAfter)) * 100;
  }
}

function joined() {
  if (!game) return [];
  // Ya iniciado el juego, todas cuentan como dentro.
  return game.currentQuestion >= 0 ? game.players : game.players.filter((p) => p.joinAt <= Date.now());
}

function publicGame() {
  if (!game) return null;
  tick();
  return {
    code: game.code,
    currentQuestion: game.currentQuestion,
    questionDurationSeconds: game.durationSeconds,
    questions: game.questions,
    players: joined().map(({ id, name, score, answeredQuestions }) => ({ id, name, score, answeredQuestions: [...answeredQuestions] })),
  };
}

export function simGet() {
  return publicGame();
}

export function simStart() {
  if (!game) return null;
  if (game.currentQuestion < 0) {
    game.currentQuestion = 0;
    game.questionStartedAt = Date.now();
  }
  return publicGame();
}

export function simNext() {
  if (!game) return null;
  tick();
  if (game.currentQuestion >= 0 && game.currentQuestion < game.questions.length) {
    game.currentQuestion++;
    game.questionStartedAt = Date.now();
  }
  return publicGame();
}

export function simStats() {
  if (!game) return null;
  tick();
  return game.questions.map((q) => {
    const total = q.answers.reduce((a, b) => a + b, 0);
    const correct = q.answers[q.correctAnswer] ?? 0;
    return { id: q.id, text: q.text, options: q.options, answers: q.answers, correctAnswer: q.correctAnswer, correct, incorrect: total - correct, total, percentage: total ? Math.round((correct / total) * 100) : 0 };
  }).filter((q) => q.total > 0);
}

export function simLeaderboard() {
  if (!game) return null;
  return [...game.players].sort((a, b) => b.score - a.score).map(({ id, name, score }) => ({ id, name, score }));
}

export function simIcebreakerStart(question: string) {
  if (!game) return null;
  game.icebreaker = { active: true, question, answers: [], startedAt: Date.now() };
  return simIcebreakerGet();
}

export function simIcebreakerGet() {
  if (!game?.icebreaker) return null;
  const ice = game.icebreaker;
  if (ice.active) {
    const shown = Math.min(ICE_ANSWERS.length, Math.floor((Date.now() - ice.startedAt) / 1500));
    while (ice.answers.length < shown) {
      const i = ice.answers.length;
      ice.answers.push({ id: `ice${i}`, text: ICE_ANSWERS[i] ?? "", playerName: NAMES[i] ?? "alumna" });
    }
  }
  return { active: ice.active, question: ice.question, answers: [...ice.answers] };
}

export function simIcebreakerClose() {
  if (!game?.icebreaker) return null;
  game.icebreaker.active = false;
  return simIcebreakerGet();
}
