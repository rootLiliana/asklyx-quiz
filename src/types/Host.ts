import type { Question } from "./Question";

export interface GroupSummary {
  id: string;
  name: string;
}

export interface ClassSummary {
  id: string;
  name: string;
  moduleId: string;
  groupId: string;
  classDate: string | null;
  startTime: string | null;
}

// GET /host/quizzes
export interface SavedQuizSummary {
  id: string;
  title: string;
  classId: string;
  className: string;
  classDate: string | null;
  groupId: string;
  groupName: string | null;
  questionCount: number;
}

// GET/POST/PUT /host/quizzes/:id
export interface EditableQuiz {
  id: string;
  classId: string;
  title: string;
  questions: Question[];
}

export type AttendanceStatus = "PRESENT" | "ABSENT" | "LATE" | "JUSTIFIED";

// GET /classes/:id/attendance
export interface AttendanceEntry {
  studentId: string;
  name: string;
  nickname: string;
  status: AttendanceStatus | null;
}

// Hace una petición autenticada al backend. Si la sesión ya no es válida
// (401), cierra la sesión del Host.
export type HostFetch = (path: string, init?: RequestInit) => Promise<Response>;
