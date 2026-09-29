export const QUIZ_SESSION_MODES = ["OFFICIAL", "PRACTICE"] as const;
export type QuizSessionMode = (typeof QUIZ_SESSION_MODES)[number];

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
  status: "WAITING";
}
