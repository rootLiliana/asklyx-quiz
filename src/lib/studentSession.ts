import { API } from "../config/api";

const STUDENT_KEYS = ["studentToken", "studentUser", "studentUserId", "studentNickname"] as const;

export function clearStudentSession(): void {
  STUDENT_KEYS.forEach((key) => localStorage.removeItem(key));
}

// Petición del jugador con su sesión. Si la sesión ya no sirve (401), la
// borra. Con 403 (p. ej. debe cambiar su contraseña temporal) la conserva:
// en ambos casos quien llama manda de vuelta a /join, que sabe qué hacer.
export async function studentFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const token = localStorage.getItem("studentToken") ?? "";
  const response = await fetch(`${API}${path}`, {
    ...init,
    headers: { ...init.headers, Authorization: `Bearer ${token}` },
  });

  if (response.status === 401) {
    clearStudentSession();
  }

  return response;
}
