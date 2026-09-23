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
  email: string;
  nickname: string;
  role: UserRole;
  createdAt: string;
  updatedAt: string;
}

export interface LoginResponse {
  token: string;
  user: PublicUser;
}
