// Un intento terminado (quiz_attempts) con sus respuestas (quiz_answers).
export interface NewAttempt {
  sessionId: string;
  studentId: string;
  score: number;
  correctAnswers: number;
  totalQuestions: number;
  startedAt: Date | null;
  completedAt: Date;
  answers: NewAnswer[];
}

export interface NewAnswer {
  questionId: string;
  selectedOptionId: string | null;
  isCorrect: boolean;
  pointsEarned: number;
  responseMs: number;
}

// El promedio es el % de aciertos: cada alumna pesa igual, sin importar
// cuántos puntos sacó (los puntos dependen de la velocidad y del tiempo por
// pregunta, así que no sirven para comparar).
export interface SessionResultSummary {
  sessionId: string;
  gameCode: string;
  playedAt: string | null;
  quizId: string;
  quizTitle: string;
  classId: string;
  className: string;
  classDate: string | null;
  groupId: string;
  groupName: string | null;
  students: number;
  averagePercentage: number;
}

export interface StudentResult {
  studentId: string;
  name: string;
  lastNamePaternal: string | null;
  nickname: string | null;
  correctAnswers: number;
  totalQuestions: number;
  percentage: number;
  score: number;
}

export interface QuestionResult {
  questionId: string;
  // null si la pregunta se editó o borró después de la sesión.
  text: string | null;
  answered: number;
  correct: number;
  percentage: number;
}

export interface SessionResultDetail {
  session: SessionResultSummary;
  students: StudentResult[];
  // De la más fallada a la más acertada.
  questions: QuestionResult[];
}

export interface StudentHistoryEntry {
  sessionId: string;
  playedAt: string | null;
  quizTitle: string;
  className: string;
  classDate: string | null;
  correctAnswers: number;
  totalQuestions: number;
  percentage: number;
}

export interface StudentHistory {
  averagePercentage: number | null;
  entries: StudentHistoryEntry[];
}
