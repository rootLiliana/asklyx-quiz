// Espejo de server/src/practice/practice.types.ts
export type PracticeQuestionType = "MULTIPLE_CHOICE" | "SHORT_ANSWER" | "CODE_OUTPUT" | "CODE_WRITING";

export interface PracticeQuestion {
  id: string;
  type: PracticeQuestionType;
  text: string;
  explanation: string | null;
  code: string | null;
  options: { id: string; text: string; isCorrect: boolean }[];
  acceptedAnswers: string[];
  modelSolution: string | null;
}

export interface PracticeQuiz {
  id: string;
  classId: string;
  title: string;
  publishedAt: string | null;
  createdBy: string;
  questions: PracticeQuestion[];
}

export interface PracticeQuizSummary {
  id: string;
  title: string;
  publishedAt: string | null;
  questionCount: number;
  students: number;
  attempts: number;
  averageBestPercentage: number | null;
}

export interface PracticeStudentStat {
  studentId: string;
  name: string;
  lastNamePaternal: string | null;
  nickname: string | null;
  attempts: number;
  bestPercentage: number;
  lastAttemptAt: string | null;
}

export interface PublicPracticeQuestion {
  id: string;
  type: PracticeQuestionType;
  text: string;
  code: string | null;
  options: { id: string; text: string }[];
}

export interface PublicPracticeQuiz {
  id: string;
  title: string;
  questions: PublicPracticeQuestion[];
}

export interface StudentPracticeSummary {
  quizId: string;
  lessonId: string;
  // Nombre de la sesión (p. ej. "Sesión 3 - Agrupamientos").
  lessonName: string;
  title: string;
  questionCount: number;
  attempts: number;
  bestPercentage: number | null;
}

export interface AnswerFeedback {
  correct: boolean;
  explanation: string | null;
  correctOptionId?: string;
  expectedAnswer?: string;
  modelSolution?: string;
}

export const PRACTICE_TYPE_LABEL: Record<PracticeQuestionType, string> = {
  MULTIPLE_CHOICE: "🔘 Opción múltiple",
  SHORT_ANSWER: "✍️ Respuesta corta",
  CODE_OUTPUT: "🖨️ ¿Qué imprime este código?",
  CODE_WRITING: "💻 Escribe el código",
};

export interface PracticeSummary {
  correctAnswers: number;
  totalQuestions: number;
  percentage: number;
}

// Quien califica una práctica: el servidor (alumnos) o el navegador (vista
// previa del Host). Si algo falla, lanza un Error con el mensaje a mostrar.
export interface PracticeEngine {
  start(): Promise<PublicPracticeQuiz>;
  answer(input: { questionId: string; optionId: string | null; answerText: string; selfAssessment?: boolean }): Promise<AnswerFeedback>;
  reveal(questionId: string, answerText: string): Promise<{ modelSolution: string; explanation: string | null }>;
  finish(): Promise<PracticeSummary>;
}
