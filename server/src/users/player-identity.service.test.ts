import assert from "node:assert/strict";
import test from "node:test";

import type { UserRepository } from "./user.repository.js";
import {
  PlayerIdentityNotAStudentError,
  PlayerIdentityNotFoundError,
  PlayerIdentityService,
} from "./player-identity.service.js";
import type { User, UserRole, UserWithPasswordHash } from "./user.types.js";

const studentUser: User = {
  id: "25",
  name: "Ana",
  lastNamePaternal: "Pérez",
  lastNameMaternal: null,
  email: "ana@example.com",
  nickname: "ana_prueba",
  role: "STUDENT",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const hostUser: User = { ...studentUser, id: "1", nickname: "lilis", role: "HOST" };

class FakeUserRepository implements UserRepository {
  private readonly usersByNickname = new Map<string, User>([
    [studentUser.nickname, studentUser],
    [hostUser.nickname, hostUser],
  ]);

  async create(): Promise<User> { return studentUser; }
  async findById(id: string): Promise<User | null> {
    return [studentUser, hostUser].find((user) => user.id === id) ?? null;
  }
  async findByEmail(): Promise<User | null> { return null; }
  async findByNickname(nickname: string): Promise<User | null> {
    return this.usersByNickname.get(nickname) ?? null;
  }
  async findAuthByNickname(): Promise<UserWithPasswordHash | null> { return null; }
  async updateRole(_: string, role: UserRole): Promise<User | null> { return { ...studentUser, role }; }
  async findAll(): Promise<User[]> { return [studentUser, hostUser]; }
}

test("resolveStudentByNickname resolves an existing nickname to the correct userId", async () => {
  const service = new PlayerIdentityService(new FakeUserRepository());

  const identity = await service.resolveStudentByNickname(studentUser.nickname);

  assert.equal(identity.userId, studentUser.id);
  assert.equal(identity.nickname, studentUser.nickname);
});

test("resolveStudentByNickname rejects an unknown nickname in a controlled way", async () => {
  const service = new PlayerIdentityService(new FakeUserRepository());

  await assert.rejects(service.resolveStudentByNickname("no-existe"), PlayerIdentityNotFoundError);
});

test("resolveStudentByNickname succeeds when the nickname belongs to a STUDENT", async () => {
  const service = new PlayerIdentityService(new FakeUserRepository());

  const identity = await service.resolveStudentByNickname(studentUser.nickname);

  assert.equal(identity.userId, studentUser.id);
});

test("resolveStudentByNickname rejects a nickname that belongs to HOST/ADMIN instead of treating it as a student", async () => {
  const service = new PlayerIdentityService(new FakeUserRepository());

  await assert.rejects(service.resolveStudentByNickname(hostUser.nickname), PlayerIdentityNotAStudentError);
});

test("resolveStudentByNickname never accepts a userId: its only input is the nickname, treated purely as a lookup key", async () => {
  const service = new PlayerIdentityService(new FakeUserRepository());

  // Pasar algo que "parece" un id (el propio userId de la alumna, como string)
  // no debe resolver nada a menos que ese valor exista literalmente como
  // nickname: la función jamás interpreta su argumento como un id directo.
  await assert.rejects(service.resolveStudentByNickname(studentUser.id), PlayerIdentityNotFoundError);
});
