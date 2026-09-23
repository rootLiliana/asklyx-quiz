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
  classId: string;
  title: string;
  description: string | null;
  timeLimitSeconds: number | null;
  createdBy: string;
  questions: StoredQuestion[];
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
