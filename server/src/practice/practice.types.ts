export const PRACTICE_QUESTION_TYPES = ["MULTIPLE_CHOICE", "SHORT_ANSWER", "CODE_OUTPUT", "CODE_WRITING"] as const;
export type PracticeQuestionType = (typeof PRACTICE_QUESTION_TYPES)[number];

export interface PracticeOption {
  id: string;
  text: string;
  isCorrect: boolean;
}

// Pregunta completa (Host): incluye las respuestas correctas.
export interface PracticeQuestion {
  id: string;
  type: PracticeQuestionType;
  text: string;
  explanation: string | null;
  // Código que se muestra con la pregunta (obligatorio en CODE_OUTPUT).
  code: string | null;
  options: PracticeOption[];
  // SHORT_ANSWER y CODE_OUTPUT: cualquiera de estas cuenta como correcta.
  acceptedAnswers: string[];
  // CODE_WRITING: la solución con la que la alumna se compara.
  modelSolution: string | null;
}

// La práctica es de la sesión (lesson): la ven todos los grupos que la tienen.
// classId = clase desde donde se creó (dato de referencia).
export interface PracticeQuiz {
  id: string;
  classId: string;
  lessonId: string | null;
  title: string;
  publishedAt: string | null;
  createdBy: string;
  questions: PracticeQuestion[];
}

// Lo que manda el Host al crear/editar. `id` presente = pregunta/opción que
// ya existe (se actualiza en su lugar para conservar el historial).
export interface PracticeQuestionInput {
  id: string | null;
  type: PracticeQuestionType;
  text: string;
  explanation: string | null;
  code: string | null;
  options: { id: string | null; text: string; isCorrect: boolean }[];
  acceptedAnswers: string[];
  modelSolution: string | null;
}

export interface PracticeQuizInput {
  title: string;
  publishedAt: Date | null;
  questions: PracticeQuestionInput[];
}

export interface PracticeQuizSummary {
  id: string;
  title: string;
  publishedAt: string | null;
  questionCount: number;
  // Alumnos que terminaron al menos un intento, intentos terminados y el
  // promedio del MEJOR % de cada alumno.
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

// --- Vista de la alumna (nunca incluye respuestas correctas) ---

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

export interface PracticeAttempt {
  id: string;
  sessionId: string;
  quizId: string;
  studentId: string;
  totalQuestions: number;
  completedAt: string | null;
}

// Lo que contesta la alumna a una pregunta.
export interface PracticeAnswerInput {
  questionId: string;
  optionId: string | null;
  answerText: string | null;
  // Solo CODE_WRITING: ¿le salió? (después de ver la solución modelo).
  selfAssessment: boolean | null;
}

export interface AnswerFeedback {
  correct: boolean;
  explanation: string | null;
  correctOptionId?: string;
  // Una respuesta aceptada (para mostrarla si falló).
  expectedAnswer?: string;
  modelSolution?: string;
}
