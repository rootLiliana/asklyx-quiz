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
  description: string | null;
  classDate: string | null;
  startTime: string | null;
  endTime: string | null;
  status: string;
}

// GET /modules
export interface ModuleSummary {
  id: string;
  name: string;
  orderNumber: number;
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

// GET /groups/:groupId/attendance: alumnos x clases del grupo.
export interface GroupAttendanceMatrix {
  classes: { id: string; name: string; classDate: string | null }[];
  students: { id: string; name: string; lastNamePaternal: string | null; nickname: string | null }[];
  records: { classId: string; studentId: string; status: AttendanceStatus }[];
}

// Hace una petición autenticada al backend. Si la sesión ya no es válida
// (401), cierra la sesión del Host.
export type HostFetch = (path: string, init?: RequestInit) => Promise<Response>;
