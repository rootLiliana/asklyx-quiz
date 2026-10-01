export const USER_ROLES = ["STUDENT", "HOST", "ADMIN"] as const;

export type UserRole = (typeof USER_ROLES)[number];
export const ASSIGNABLE_USER_ROLES = ["STUDENT", "HOST"] as const;
export type AssignableUserRole = (typeof ASSIGNABLE_USER_ROLES)[number];

export interface User {
  id: string;
  name: string;
  // Nullable: los registros que existían antes de la migración que agrega
  // estas columnas se quedan en NULL, ya que no se hace ningún backfill.
  lastNamePaternal: string | null;
  lastNameMaternal: string | null;
  email: string;
  nickname: string;
  role: UserRole;
  // La admin restableció su contraseña: debe elegir una nueva para continuar.
  mustChangePassword?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface RegisterUserInput {
  name: string;
  lastNamePaternal: string;
  lastNameMaternal: string | null;
  email: string;
  nickname: string;
  passwordHash: string;
}

export interface RegisterUserPayload {
  name: string;
  lastNamePaternal: string;
  lastNameMaternal?: string | undefined;
  email: string;
  nickname: string;
  password: string;
}

export interface UserWithPasswordHash extends User {
  passwordHash: string | null;
}
