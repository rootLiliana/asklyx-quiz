import assert from "node:assert/strict";
import test from "node:test";

import { hashPassword } from "./password.js";
import type { UserRepository } from "./user.repository.js";
import { DuplicateUserError, InvalidCredentialsError, UserInputError, UserRoleChangeForbiddenError, UserService } from "./user.service.js";
import type { RegisterUserInput, User, UserRole, UserWithPasswordHash } from "./user.types.js";

const existingUser: User = {
  id: "1",
  name: "Ana",
  lastNamePaternal: "Pérez",
  lastNameMaternal: "López",
  email: "ana@example.com",
  nickname: "ana123",
  role: "STUDENT",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const VALID_PASSWORD = "Sup3rSecreta!";

class FakeUserRepository implements UserRepository {
  createdInput: RegisterUserInput | undefined;
  private readonly usersByNickname = new Map<string, UserWithPasswordHash>();

  seedAuthUser(user: UserWithPasswordHash) {
    this.usersByNickname.set(user.nickname, user);
  }

  async create(input: RegisterUserInput): Promise<User> {
    this.createdInput = input;
    const user: User = {
      ...existingUser,
      name: input.name,
      lastNamePaternal: input.lastNamePaternal,
      lastNameMaternal: input.lastNameMaternal,
      email: input.email,
      nickname: input.nickname,
      role: "STUDENT",
    };
    this.usersByNickname.set(input.nickname, { ...user, passwordHash: input.passwordHash });
    return user;
  }

  async findById(): Promise<User | null> { return existingUser; }
  async findByEmail(): Promise<User | null> { return null; }
  async findByNickname(): Promise<User | null> { return null; }
  async findAuthByNickname(nickname: string): Promise<UserWithPasswordHash | null> {
    return this.usersByNickname.get(nickname) ?? null;
  }
  async updateRole(_: string, role: UserRole): Promise<User | null> {
    return { ...existingUser, role };
  }
  async findAll(): Promise<User[]> { return [existingUser]; }
}

test("register accepts name + apellido paterno (y materno opcional) and always returns a STUDENT", async () => {
  const repository = new FakeUserRepository();
  const service = new UserService(repository);

  const user = await service.register({
    name: " Ana ",
    lastNamePaternal: " Pérez ",
    lastNameMaternal: " López ",
    email: "ANA@EXAMPLE.COM ",
    nickname: " ana123 ",
    password: VALID_PASSWORD,
  });

  assert.equal(repository.createdInput?.name, "Ana");
  assert.equal(repository.createdInput?.lastNamePaternal, "Pérez");
  assert.equal(repository.createdInput?.lastNameMaternal, "López");
  assert.equal(repository.createdInput?.email, "ana@example.com");
  assert.equal(repository.createdInput?.nickname, "ana123");
  assert.equal(user.role, "STUDENT");

  // Los campos de identidad se devuelven correctamente en la respuesta.
  assert.equal(user.name, "Ana");
  assert.equal(user.lastNamePaternal, "Pérez");
  assert.equal(user.lastNameMaternal, "López");
});

test("register accepts an empty/missing lastNameMaternal and normalizes it to null", async () => {
  const repository = new FakeUserRepository();
  const service = new UserService(repository);

  const user = await service.register({
    name: "Lili",
    lastNamePaternal: "Prueba",
    lastNameMaternal: "   ",
    email: "lili@example.com",
    nickname: "liliprueba",
    password: VALID_PASSWORD,
  });

  assert.equal(repository.createdInput?.lastNameMaternal, null);
  assert.equal(user.lastNameMaternal, null);

  const repository2 = new FakeUserRepository();
  const service2 = new UserService(repository2);
  const user2 = await service2.register({
    name: "Lili",
    lastNamePaternal: "Prueba",
    email: "lili2@example.com",
    nickname: "liliprueba2",
    password: VALID_PASSWORD,
  });

  assert.equal(repository2.createdInput?.lastNameMaternal, null);
  assert.equal(user2.lastNameMaternal, null);
});

test("register rejects a missing name or lastNamePaternal", async () => {
  const service = new UserService(new FakeUserRepository());

  await assert.rejects(
    service.register({ name: "", lastNamePaternal: "Prueba", email: "a@example.com", nickname: "a1", password: VALID_PASSWORD }),
    UserInputError,
  );
  await assert.rejects(
    service.register({ name: "Lili", lastNamePaternal: "", email: "a@example.com", nickname: "a1", password: VALID_PASSWORD }),
    UserInputError,
  );
});

test("register rejects a missing password", async () => {
  const service = new UserService(new FakeUserRepository());

  await assert.rejects(
    service.register({ name: "Ana", lastNamePaternal: "Pérez", email: "ana@example.com", nickname: "ana123", password: "" }),
    UserInputError,
  );
});

test("register rejects a password shorter than 8 characters", async () => {
  const service = new UserService(new FakeUserRepository());

  await assert.rejects(
    service.register({ name: "Ana", lastNamePaternal: "Pérez", email: "ana@example.com", nickname: "ana123", password: "short" }),
    UserInputError,
  );
});

test("register rejects an invalid email", async () => {
  const service = new UserService(new FakeUserRepository());

  await assert.rejects(
    service.register({ name: "Ana", lastNamePaternal: "Pérez", email: "not-an-email", nickname: "ana123", password: VALID_PASSWORD }),
    UserInputError,
  );
});

test("register hashes the password so it never reaches the repository in plain text", async () => {
  const repository = new FakeUserRepository();
  const service = new UserService(repository);

  const user = await service.register({
    name: "Ana",
    lastNamePaternal: "Pérez",
    email: "ana@example.com",
    nickname: "ana123",
    password: VALID_PASSWORD,
  });

  assert.notEqual(repository.createdInput?.passwordHash, VALID_PASSWORD);
  assert.ok(repository.createdInput?.passwordHash.includes(":"));

  // La respuesta pública nunca debe incluir el hash.
  assert.equal((user as unknown as { passwordHash?: string }).passwordHash, undefined);
});

test("changeRole only accepts STUDENT or HOST", async () => {
  const service = new UserService(new FakeUserRepository());

  await assert.rejects(service.changeRole("1", "OWNER"), UserInputError);
  await assert.rejects(service.changeRole("1", "ADMIN"), UserInputError);
  assert.equal((await service.changeRole("1", "HOST"))?.role, "HOST");
});

test("register maps a database duplicate error to a conflict error", async () => {
  const repository: UserRepository = {
    create: async () => { throw { code: "ER_DUP_ENTRY" }; },
    findById: async () => null,
    findByEmail: async () => null,
    findByNickname: async () => null,
    findAuthByNickname: async () => null,
    updateRole: async () => null,
    findAll: async () => [],
  };
  const service = new UserService(repository);

  await assert.rejects(
    service.register({ name: "Ana", lastNamePaternal: "Pérez", email: "ana@example.com", nickname: "ana123", password: VALID_PASSWORD }),
    DuplicateUserError,
  );
});

test("login succeeds with the correct nickname and password", async () => {
  const repository = new FakeUserRepository();
  const service = new UserService(repository);

  await service.register({ name: "Ana", lastNamePaternal: "Pérez", email: "ana@example.com", nickname: "ana123", password: VALID_PASSWORD });
  const user = await service.login("ana123", VALID_PASSWORD);

  assert.equal(user.nickname, "ana123");
  assert.equal(user.role, "STUDENT");
  assert.equal(user.name, "Ana");
  assert.equal(user.lastNamePaternal, "Pérez");
  assert.equal((user as unknown as { passwordHash?: string }).passwordHash, undefined);
});

test("login rejects an incorrect password", async () => {
  const repository = new FakeUserRepository();
  const service = new UserService(repository);

  await service.register({ name: "Ana", lastNamePaternal: "Pérez", email: "ana@example.com", nickname: "ana123", password: VALID_PASSWORD });

  await assert.rejects(service.login("ana123", "wrong-password"), InvalidCredentialsError);
});

test("login rejects a nickname that does not exist", async () => {
  const service = new UserService(new FakeUserRepository());

  await assert.rejects(service.login("nope", VALID_PASSWORD), InvalidCredentialsError);
});

test("login rejects an existing user without password_hash set yet", async () => {
  const repository = new FakeUserRepository();
  repository.seedAuthUser({ ...existingUser, nickname: "sin-password", passwordHash: null });
  const service = new UserService(repository);

  await assert.rejects(service.login("sin-password", VALID_PASSWORD), InvalidCredentialsError);
});

test("login gives the same error for a wrong password, an unknown nickname, and a missing password_hash", async () => {
  const repository = new FakeUserRepository();
  repository.seedAuthUser({ ...existingUser, nickname: "sin-password", passwordHash: null });
  await repository.create({
    name: "Ana",
    lastNamePaternal: "Pérez",
    lastNameMaternal: null,
    email: "ana@example.com",
    nickname: "ana123",
    passwordHash: "irrelevant",
  });

  const service = new UserService(repository);

  const errors = await Promise.all([
    service.login("ana123", "wrong-password").catch((error: unknown) => error),
    service.login("no-existe", VALID_PASSWORD).catch((error: unknown) => error),
    service.login("sin-password", VALID_PASSWORD).catch((error: unknown) => error),
  ]);

  for (const error of errors) {
    assert.ok(error instanceof InvalidCredentialsError);
    assert.equal((error as Error).message, "Invalid nickname or password");
  }
});

test("login requires both nickname and password", async () => {
  const service = new UserService(new FakeUserRepository());

  await assert.rejects(service.login("", VALID_PASSWORD), UserInputError);
  await assert.rejects(service.login("ana123", ""), UserInputError);
});

test("an existing account with last_name_paternal/last_name_maternal still NULL (no migration backfill) keeps its password_hash and logs in correctly", async () => {
  // Simula una cuenta creada ANTES de que existieran las columnas nuevas:
  // como la migración no hace ningún UPDATE, last_name_paternal y
  // last_name_maternal quedan en NULL hasta que se editen manualmente.
  const repository = new FakeUserRepository();
  const existingHash = await hashPassword(VALID_PASSWORD);

  repository.seedAuthUser({
    id: "90001",
    name: "Lili Prueba",
    lastNamePaternal: null,
    lastNameMaternal: null,
    email: "lili.prueba@test.com",
    nickname: "liliprueba",
    role: "STUDENT",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    passwordHash: existingHash,
  });

  const service = new UserService(repository);
  const user = await service.login("liliprueba", VALID_PASSWORD);

  assert.equal(user.id, "90001");
  assert.equal(user.name, "Lili Prueba");
  assert.equal(user.lastNamePaternal, null);
  assert.equal(user.lastNameMaternal, null);

  // La contraseña que ya tenía antes de agregar las columnas sigue siendo válida.
  await assert.rejects(service.login("liliprueba", "otra-contraseña"), InvalidCredentialsError);
});

test("changeRole never changes the role of an ADMIN account from the app", async () => {
  const repository = new FakeUserRepository();
  repository.findById = async () => ({ ...existingUser, role: "ADMIN" });
  const service = new UserService(repository);

  await assert.rejects(service.changeRole("1", "STUDENT"), UserRoleChangeForbiddenError);
});

test("register rejects a name or nickname longer than the users table columns allow", async () => {
  const service = new UserService(new FakeUserRepository());

  await assert.rejects(
    service.register({ name: "A".repeat(151), lastNamePaternal: "Pérez", email: "ana@example.com", nickname: "ana123", password: VALID_PASSWORD }),
    UserInputError,
  );
  await assert.rejects(
    service.register({ name: "Ana", lastNamePaternal: "Pérez", email: "ana@example.com", nickname: "n".repeat(51), password: VALID_PASSWORD }),
    UserInputError,
  );
  await assert.doesNotReject(
    service.register({ name: "A".repeat(150), lastNamePaternal: "Pérez", email: "ana@example.com", nickname: "n".repeat(50), password: VALID_PASSWORD }),
  );
});
