import type { UserRole } from "../users/user.types.js";

// Identidad de quien hace la petición, resuelta siempre desde su token de
// sesión (nunca desde el body).
export interface AuthUser {
  id: string;
  nickname: string;
  role: UserRole;
}
