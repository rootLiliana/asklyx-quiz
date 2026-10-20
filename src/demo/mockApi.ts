// API simulada para la vista previa: responde en el navegador lo mismo que
// respondería el servidor, para poder probar las pantallas sin backend.
import { API } from "../config/api";

export type DemoPhase = "waiting" | "question" | "finished";

interface DemoQuestion {
  id: string;
  text: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
}

const DURATION_SECONDS = 20;

export const DEMO_QUESTIONS: DemoQuestion[] = [
  {
    id: "q1",
    text: "¿Qué JOIN muestra a todas las alumnas, aunque no tengan taller?",
    options: ["INNER JOIN", "LEFT JOIN", "RIGHT JOIN", "JOIN sin ON"],
    correctAnswer: 1,
    explanation: "LEFT JOIN trae todas las filas de la tabla que va en el FROM (la izquierda), tengan pareja o no. Por eso Valeria aparece aunque no tenga taller: esa columna le sale en NULL. Con INNER JOIN, en cambio, se quedaría fuera.",
  },
  {
    id: "q2",
    text: "¿Qué regresa (SELECT AVG(calificacion) FROM alumnas)?",
    options: ["Una lista de calificaciones", "Un solo número", "Los nombres de las alumnas", "Un error"],
    correctAnswer: 1,
    explanation: "AVG suma las calificaciones y divide entre cuántas son: (9 + 7 + 10 + 8) / 4 = 8.5. Toda la subconsulta se convierte en ese solo número, que después puedes usar para comparar en un WHERE.",
  },
  {
    id: "q3",
    text: "Una celda dice “Robótica, Diseño web”. ¿Qué forma normal no se cumple?",
    options: ["1FN", "2FN", "3FN", "Las cumple todas"],
    correctAnswer: 0,
    explanation: "La 1FN pide un solo valor por celda. Con dos talleres juntos no puedes buscar fácil quién está en Diseño web, porque el dato está escondido dentro de un texto. La solución es una fila por cada taller.",
  },
];

const state = {
  phase: "waiting" as DemoPhase,
  index: 0,
  startedAt: Date.now(),
  score: 0,
  answered: new Set<string>(),
};

const listeners = new Set<() => void>();
const emit = () => listeners.forEach((fn) => fn());

export const demo = {
  subscribe(fn: () => void) {
    listeners.add(fn);
    return () => { listeners.delete(fn); };
  },
  get phase() { return state.phase; },
  get index() { return state.index; },
  setPhase(phase: DemoPhase) {
    state.phase = phase;
    if (phase === "question") state.startedAt = Date.now();
    if (phase === "waiting") { state.index = 0; state.score = 0; state.answered.clear(); }
    emit();
  },
  goTo(index: number) {
    state.index = Math.max(0, Math.min(DEMO_QUESTIONS.length - 1, index));
    state.phase = "question";
    state.startedAt = Date.now();
    emit();
  },
  /** Repite la pregunta actual desde cero (borra la respuesta de esa pregunta). */
  restartQuestion() {
    const q = DEMO_QUESTIONS[state.index];
    if (q) state.answered.delete(q.id);
    // Un id nuevo hace que la pantalla del Quiz la trate como pregunta nueva.
    if (q) q.id = `${q.id.split("#")[0]}#${Date.now()}`;
    state.phase = "question";
    state.startedAt = Date.now();
    emit();
  },
};

function remainingMs() {
  return DURATION_SECONDS * 1000 - (Date.now() - state.startedAt);
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function handle(path: string, init?: RequestInit): Response {
  const current = DEMO_QUESTIONS[state.index];

  if (/^\/games\/[^/]+\/question$/.test(path)) {
    if (state.phase === "waiting") return json({ waiting: true });
    if (state.phase === "finished" || !current) return json({ finished: true });
    return json({
      id: current.id,
      text: current.text,
      options: current.options,
      durationSeconds: DURATION_SECONDS,
      remainingSeconds: Math.max(0, Math.ceil(remainingMs() / 1000)),
    });
  }

  if (/^\/games\/[^/]+\/answer$/.test(path) && current) {
    const body = JSON.parse(typeof init?.body === "string" ? init.body : "{}") as { questionId?: string; answer?: number };
    if (body.questionId !== current.id) return json({ code: "STALE_QUESTION" }, 409);
    const reveal = { correctAnswer: current.correctAnswer, explanation: current.explanation };
    if (state.answered.has(current.id)) return json({ correct: false, alreadyAnswered: true, timeUp: false, score: state.score, ...reveal });
    state.answered.add(current.id);
    const remaining = remainingMs();
    const timeUp = remaining <= -1500;
    const correct = !timeUp && body.answer === current.correctAnswer;
    if (correct) state.score += Math.max(0, Math.ceil(remaining / 1000)) * 100;
    return json({ correct, alreadyAnswered: false, timeUp, score: state.score, ...reveal });
  }

  if (/^\/games\/[^/]+\/leaderboard$/.test(path)) {
    return json([
      { id: "1", name: "Sofi", score: state.score || 2600 },
      { id: "2", name: "Vale", score: 2300 },
      { id: "3", name: "Lucy", score: 1900 },
      { id: "4", name: "Ana", score: 1500 },
      { id: "5", name: "Mar", score: 900 },
    ]);
  }

  return json({ message: "No disponible en la vista previa" }, 404);
}

export function installMockApi() {
  const realFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (!url.startsWith(API)) return realFetch(input, init);
    await new Promise((resolve) => setTimeout(resolve, 150)); // un poco de "red"
    return handle(new URL(url).pathname, init);
  };
}
