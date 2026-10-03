// LIVE = juego en vivo con host; PRACTICE = práctica individual (Fase 3).
export const QUIZ_SESSION_MODES = ["LIVE", "PRACTICE"] as const;
export type QuizSessionMode = (typeof QUIZ_SESSION_MODES)[number];

export type QuizSessionStatus = "WAITING" | "IN_PROGRESS" | "FINISHED";

export interface CreateQuizSessionInput {
  quizId: string;
  hostId: string;
  classId: string;
  groupId: string | null;
  gameCode: string;
  mode: QuizSessionMode;
}

export interface QuizSession {
  id: string;
  quizId: string;
  hostId: string;
  // null solo en sesiones anteriores a la columna class_id.
  classId: string | null;
  groupId: string | null;
  gameCode: string;
  mode: QuizSessionMode;
  status: QuizSessionStatus;
}
