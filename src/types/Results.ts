// Espejo de server/src/results/quiz-result.types.ts

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
  text: string | null;
  answered: number;
  correct: number;
  percentage: number;
}

export interface SessionResultDetail {
  session: SessionResultSummary;
  students: StudentResult[];
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
