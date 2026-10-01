import { API } from "../config/api";

export const PASSWORD_HINT = "La contraseña distingue mayúsculas, minúsculas y signos.";

// Cambia la contraseña de quien tiene la sesión `token`. Devuelve "" si todo
// salió bien, o el mensaje de error para mostrar.
export async function changePassword(token: string, currentPassword: string, newPassword: string, confirmPassword: string): Promise<string> {
  if (!currentPassword) return "Escribe tu contraseña temporal.";
  if (newPassword.length < 8) return "La contraseña nueva debe tener al menos 8 caracteres.";
  if (newPassword !== confirmPassword) return "Las contraseñas no coinciden.";
  if (newPassword === currentPassword) return "La contraseña nueva debe ser distinta a la temporal.";

  try {
    const response = await fetch(`${API}/auth/change-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ currentPassword, newPassword }),
    });

    if (response.ok) return "";
    if (response.status === 401) return "Tu sesión expiró. Vuelve a iniciar sesión.";

    const body = await response.json().catch(() => null);
    if (body?.code === "WRONG_PASSWORD") return "La contraseña temporal no es correcta.";
    return "No pudimos cambiar tu contraseña. Intenta otra vez.";
  } catch (error) {
    console.error("Error cambiando contraseña:", error);
    return "No pudimos conectarnos con el servidor.";
  }
}
