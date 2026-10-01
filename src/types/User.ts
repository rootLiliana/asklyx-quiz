export type UserRole = "STUDENT" | "HOST" | "ADMIN";

export interface RegisterUserInput {
  name: string;
  lastNamePaternal: string;
  lastNameMaternal?: string;
  email: string;
  nickname: string;
  password: string;
}

export interface LoginUserInput {
  nickname: string;
  password: string;
}

export interface PublicUser {
  id: string;
  name: string;
  lastNamePaternal: string | null;
  lastNameMaternal: string | null;
  // Nullables en la tabla `users` (cuentas antiguas pueden no tenerlos).
  email: string | null;
  nickname: string | null;
  role: UserRole;
  // La admin restableció su contraseña: debe elegir una nueva antes de seguir.
  mustChangePassword?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface LoginResponse {
  token: string;
  user: PublicUser;
}
