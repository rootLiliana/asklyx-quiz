import { hashPassword, verifyPassword, DUMMY_PASSWORD_HASH } from "./password.js";
import type { UserRepository } from "./user.repository.js";
import { ASSIGNABLE_USER_ROLES, USER_ROLES, type AssignableUserRole, type RegisterUserPayload, type User, type UserRole } from "./user.types.js";

export class UserInputError extends Error {}
export class DuplicateUserError extends Error {}
export class InvalidCredentialsError extends Error {}

export class UserService {
  constructor(private readonly users: UserRepository) {}

  async register(input: RegisterUserPayload): Promise<User> {
    const normalized = normalizeRegistration(input);
    const [emailOwner, nicknameOwner] = await Promise.all([
      this.users.findByEmail(normalized.email),
      this.users.findByNickname(normalized.nickname),
    ]);

    if (emailOwner || nicknameOwner) {
      throw new DuplicateUserError("Email or nickname is already in use");
    }

    const passwordHash = await hashPassword(normalized.password);

    try {
      return await this.users.create({
        name: normalized.name,
        lastNamePaternal: normalized.lastNamePaternal,
        lastNameMaternal: normalized.lastNameMaternal,
        email: normalized.email,
        nickname: normalized.nickname,
        passwordHash,
      });
    } catch (error: unknown) {
      if (isDuplicateEntryError(error)) {
        throw new DuplicateUserError("Email or nickname is already in use");
      }

      throw error;
    }
  }

  async login(nickname: unknown, password: unknown): Promise<User> {
    if (typeof nickname !== "string" || !nickname.trim() || typeof password !== "string" || !password) {
      throw new UserInputError("nickname and password are required");
    }

    const user = await this.users.findAuthByNickname(nickname.trim());

    if (!user || !user.passwordHash) {
      // Ejecutamos una verificación contra un hash de referencia para que el
      // tiempo de respuesta no delate si el nickname existe o no.
      await verifyPassword(password, DUMMY_PASSWORD_HASH);
      throw new InvalidCredentialsError("Invalid nickname or password");
    }

    const isValid = await verifyPassword(password, user.passwordHash);

    if (!isValid) {
      throw new InvalidCredentialsError("Invalid nickname or password");
    }

    const { passwordHash: _passwordHash, ...publicUser } = user;
    return publicUser;
  }

  getById(id: string): Promise<User | null> {
    return this.users.findById(validateId(id));
  }

  getByNickname(nickname: string): Promise<User | null> {
    return this.users.findByNickname(nickname);
  }

  listUsers(role?: unknown): Promise<User[]> {
    if (role === undefined) {
      return this.users.findAll();
    }

    if (typeof role !== "string" || !USER_ROLES.includes(role as UserRole)) {
      throw new UserInputError(`role filter must be one of ${USER_ROLES.join(", ")}`);
    }

    return this.users.findAll(role as UserRole);
  }

  async changeRole(id: string, role: unknown): Promise<User | null> {
    if (typeof role !== "string" || !ASSIGNABLE_USER_ROLES.includes(role as AssignableUserRole)) {
      throw new UserInputError("role must be STUDENT or HOST");
    }

    return this.users.updateRole(validateId(id), role as AssignableUserRole);
  }
}

interface NormalizedRegistration {
  name: string;
  lastNamePaternal: string;
  lastNameMaternal: string | null;
  email: string;
  nickname: string;
  password: string;
}

function normalizeRegistration(input: RegisterUserPayload): NormalizedRegistration {
  const name = input.name?.trim();
  const lastNamePaternal = input.lastNamePaternal?.trim();
  const lastNameMaternalRaw = input.lastNameMaternal?.trim();
  const lastNameMaternal = lastNameMaternalRaw ? lastNameMaternalRaw : null;
  const email = input.email?.trim().toLowerCase();
  const nickname = input.nickname?.trim();
  const password = input.password ?? "";

  if (!name || !lastNamePaternal || !email || !nickname || !password) {
    throw new UserInputError("name, lastNamePaternal, email, nickname, and password are required");
  }

  if (!/^\S+@\S+\.\S+$/.test(email)) {
    throw new UserInputError("email must be valid");
  }

  if (name.length > 255 || lastNamePaternal.length > 100 || (lastNameMaternal?.length ?? 0) > 100) {
    throw new UserInputError("name, lastNamePaternal, or lastNameMaternal is too long");
  }

  if (email.length > 255 || nickname.length > 100) {
    throw new UserInputError("email or nickname is too long");
  }

  if (password.length < 8) {
    throw new UserInputError("password must be at least 8 characters");
  }

  return { name, lastNamePaternal, lastNameMaternal, email, nickname, password };
}

function validateId(id: string): string {
  if (!/^\d+$/.test(id)) {
    throw new UserInputError("id must be a positive integer");
  }

  return id;
}

function isDuplicateEntryError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ER_DUP_ENTRY";
}
