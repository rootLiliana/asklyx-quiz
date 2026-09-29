import { API } from "../config/api";

const STUDENT_KEYS = ["studentToken", "studentUser", "studentUserId", "studentNickname"] as const;

export function clearStudentSession(): void {
  STUDENT_KEYS.forEach((key) => localStorage.removeItem(key));
}

// Petición del jugador con su sesión. Si la sesión ya no sirve (401/403), la
// borra: quien llama decide mandar de vuelta a /join.
export async function studentFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const token = localStorage.getItem("studentToken") ?? "";
  const response = await fetch(`${API}${path}`, {
    ...init,
    headers: { ...init.headers, Authorization: `Bearer ${token}` },
  });

  if (response.status === 401 || response.status === 403) {
    clearStudentSession();
  }

  return response;
}
