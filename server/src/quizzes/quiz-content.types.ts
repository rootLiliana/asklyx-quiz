import type { Question } from "../types/Question.js";

export interface CreateQuizContentInput {
  classId: string;
  title: string;
  description?: string | undefined;
  timeLimitSeconds?: number | undefined;
  createdBy: string;
  questions: Question[];
}

export interface QuizContent {
  id: string;
  // 'PRACTICE' = quiz de práctica (módulo practice/): este módulo solo
  // maneja los de sesión en vivo.
  kind?: "LIVE" | "PRACTICE";
  classId: string;
  title: string;
  description: string | null;
  timeLimitSeconds: number | null;
  createdBy: string;
  questions: StoredQuestion[];
}

// Vista de lista: cada quiz con la clase (y su fecha) y el grupo al que pertenece.
export interface QuizSummary {
  id: string;
  title: string;
  description: string | null;
  classId: string;
  className: string;
  classDate: string | null;
  groupId: string;
  groupName: string | null;
  questionCount: number;
  // Ya se jugó y tiene resultados guardados: no se edita ni se borra.
  hasResults: boolean;
}

export interface StoredQuestion {
  id: string;
  text: string;
  explanation: string | null;
  questionOrder: number;
  points: number;
  options: StoredOption[];
}

export interface StoredOption {
  id: string;
  text: string;
  optionOrder: number;
  isCorrect: boolean;
}

export interface CreateQuizContent {
  classId: string;
  title: string;
  description: string | null;
  timeLimitSeconds: number | null;
  createdBy: string;
  questions: CreateStoredQuestion[];
}

export interface CreateStoredQuestion {
  text: string;
  explanation: string;
  questionOrder: number;
  points: number;
  options: CreateStoredOption[];
}

export interface CreateStoredOption {
  text: string;
  optionOrder: number;
  isCorrect: boolean;
}
