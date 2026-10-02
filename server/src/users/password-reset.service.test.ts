import assert from "node:assert/strict";
import test from "node:test";

import type { MailMessage, Mailer } from "../mailer.js";
import { verifyPassword } from "./password.js";
import type { PasswordResetRepository } from "./password-reset.repository.js";
import {
  hashResetToken,
  MAX_DIRECT_RESET_FAILURES,
  PasswordResetIdentityMismatchError,
  PasswordResetInputError,
  PasswordResetInvalidTokenError,
  PasswordResetService,
  PasswordChangeWrongPasswordError,
  PasswordResetForbiddenError,
  PasswordResetTooManyAttemptsError,
  PasswordResetUserNotFoundError,
} from "./password-reset.service.js";
import type { UserRepository } from "./user.repository.js";
import type { User, UserRole, UserWithPasswordHash } from "./user.types.js";

const ana: User = {
  id: "25",
  name: "Ana",
  lastNamePaternal: "Pérez",
  lastNameMaternal: null,
  email: "ana@example.com",
  nickname: "ana123",
  role: "STUDENT",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

// Host con correo y nickname conocidos: nunca debe poder recuperarse sin enlace.
const hostProfe: User = { ...ana, id: "2", email: "profe@example.com", nickname: "profe", role: "HOST" };

class FakeUserRepository implements UserRepository {
  async create(): Promise<User> { return ana; }
  async findById(): Promise<User | null> { return ana; }
  async findByEmail(email: string): Promise<User | null> {
    return [ana, hostProfe].find((user) => user.email === email) ?? null;
  }
  async findByNickname(): Promise<User | null> { return null; }
  async findAuthByNickname(): Promise<UserWithPasswordHash | null> { return null; }
  async updateRole(_: string, role: UserRole): Promise<User | null> { return { ...ana, role }; }
  async findAll(): Promise<User[]> { return [ana]; }
}

class FakeResetRepository implements PasswordResetRepository {
  tokens = new Map<string, { userId: string; used: boolean }>();
  passwordHashes = new Map<string, string>();

  async create(userId: string, tokenHash: string): Promise<void> {
    for (const entry of this.tokens.values()) {
      if (entry.userId === userId) entry.used = true;
    }
    this.tokens.set(tokenHash, { userId, used: false });
  }

  mustChange = new Map<string, boolean>();

  async setPasswordHash(userId: string, passwordHash: string, mustChange: boolean): Promise<void> {
    this.passwordHashes.set(userId, passwordHash);
    this.mustChange.set(userId, mustChange);
  }

  async consumeAndSetPassword(tokenHash: string, passwordHash: string): Promise<string | null> {
    const entry = this.tokens.get(tokenHash);
    if (!entry || entry.used) return null;
    entry.used = true;
    this.passwordHashes.set(entry.userId, passwordHash);
    return entry.userId;
  }
}

class FakeMailer implements Mailer {
  sent: MailMessage[] = [];
  async send(message: MailMessage): Promise<void> { this.sent.push(message); }
}

function buildService() {
  const resets = new FakeResetRepository();
  const mailer = new FakeMailer();
  const revoked: string[] = [];
  let now = 0;
  const service = new PasswordResetService(
    new FakeUserRepository(),
    resets,
    mailer,
    "https://lilihoot.example/",
    (userId) => revoked.push(userId),
    () => now,
  );
  return { service, resets, mailer, revoked, advance: (ms: number) => { now += ms; } };
}

function extractToken(message: MailMessage | undefined): string {
  const match = message?.text.match(/reset-password\?token=([\w-]+)/);
  assert.ok(match?.[1], "the email must contain a reset link");
  return match[1];
}

test("requestReset emails a link to the registered address and stores only the token hash", async () => {
  const { service, resets, mailer } = buildService();

  await service.requestReset("  ANA@example.com ");

  assert.equal(mailer.sent.length, 1);
  assert.equal(mailer.sent[0]?.to, ana.email);
  assert.ok(mailer.sent[0]?.text.includes("https://lilihoot.example/reset-password?token="));

  const token = extractToken(mailer.sent[0]);
  assert.equal(resets.tokens.has(token), false);
  assert.equal(resets.tokens.has(hashResetToken(token)), true);
});

test("requestReset for an unknown email sends nothing and does not fail", async () => {
  const { service, mailer, resets } = buildService();

  await assert.doesNotReject(service.requestReset("nadie@example.com"));
  assert.equal(mailer.sent.length, 0);
  assert.equal(resets.tokens.size, 0);
});

test("requestReset rejects an invalid email", async () => {
  const { service } = buildService();
  await assert.rejects(service.requestReset("no-es-correo"), PasswordResetInputError);
});

test("resetPassword stores a hash of the new password and revokes open sessions", async () => {
  const { service, resets, mailer, revoked } = buildService();
  await service.requestReset(ana.email);
  const token = extractToken(mailer.sent[0]);

  await service.resetPassword(token, "NuevaClave123");

  const storedHash = resets.passwordHashes.get(ana.id);
  assert.ok(storedHash);
  assert.notEqual(storedHash, "NuevaClave123");
  assert.equal(await verifyPassword("NuevaClave123", storedHash), true);
  assert.deepEqual(revoked, [ana.id]);
});

test("a reset link can only be used once", async () => {
  const { service, mailer } = buildService();
  await service.requestReset(ana.email);
  const token = extractToken(mailer.sent[0]);

  await service.resetPassword(token, "NuevaClave123");
  await assert.rejects(service.resetPassword(token, "OtraClave456"), PasswordResetInvalidTokenError);
});

test("requesting a new link invalidates the previous one", async () => {
  const { service, mailer } = buildService();
  await service.requestReset(ana.email);
  await service.requestReset(ana.email);
  const firstToken = extractToken(mailer.sent[0]);
  const secondToken = extractToken(mailer.sent[1]);

  await assert.rejects(service.resetPassword(firstToken, "NuevaClave123"), PasswordResetInvalidTokenError);
  await assert.doesNotReject(service.resetPassword(secondToken, "NuevaClave123"));
});

test("resetPassword rejects an unknown token and a short password", async () => {
  const { service } = buildService();
  await assert.rejects(service.resetPassword("token-inventado", "NuevaClave123"), PasswordResetInvalidTokenError);
  await assert.rejects(service.resetPassword("token-inventado", "corta"), PasswordResetInputError);
  await assert.rejects(service.resetPassword("", "NuevaClave123"), PasswordResetInputError);
});

test("resetWithIdentity changes the password when email and nickname belong to the same student", async () => {
  const { service, resets, revoked } = buildService();

  await service.resetWithIdentity(" ANA@example.com ", " ANA123 ", "NuevaClave123");

  const storedHash = resets.passwordHashes.get(ana.id);
  assert.ok(storedHash);
  assert.equal(await verifyPassword("NuevaClave123", storedHash), true);
  assert.deepEqual(revoked, [ana.id]);
});

test("resetWithIdentity rejects a nickname that does not match the email, or an unknown email, with the same error", async () => {
  const { service, resets } = buildService();

  await assert.rejects(service.resetWithIdentity(ana.email, "otra", "NuevaClave123"), PasswordResetIdentityMismatchError);
  await assert.rejects(service.resetWithIdentity("nadie@example.com", ana.nickname, "NuevaClave123"), PasswordResetIdentityMismatchError);
  assert.equal(resets.passwordHashes.size, 0);
});

test("resetWithIdentity never works for HOST/ADMIN accounts, even with the right email and nickname", async () => {
  const { service, resets } = buildService();

  await assert.rejects(
    service.resetWithIdentity(hostProfe.email, hostProfe.nickname, "NuevaClave123"),
    PasswordResetIdentityMismatchError,
  );
  assert.equal(resets.passwordHashes.size, 0);
});

test("resetWithIdentity validates email, nickname and password length", async () => {
  const { service } = buildService();

  await assert.rejects(service.resetWithIdentity("no-es-correo", ana.nickname, "NuevaClave123"), PasswordResetInputError);
  await assert.rejects(service.resetWithIdentity(ana.email, "  ", "NuevaClave123"), PasswordResetInputError);
  await assert.rejects(service.resetWithIdentity(ana.email, ana.nickname, "corta"), PasswordResetInputError);
});

test("resetWithIdentity locks an email after too many failed attempts, even with the right data, until the window passes", async () => {
  const { service, resets, advance } = buildService();

  for (let attempt = 0; attempt < MAX_DIRECT_RESET_FAILURES; attempt++) {
    await assert.rejects(service.resetWithIdentity(ana.email, "adivinando", "NuevaClave123"), PasswordResetIdentityMismatchError);
  }

  await assert.rejects(service.resetWithIdentity(ana.email, ana.nickname, "NuevaClave123"), PasswordResetTooManyAttemptsError);
  assert.equal(resets.passwordHashes.size, 0);

  advance(15 * 60_000);
  await assert.doesNotReject(service.resetWithIdentity(ana.email, ana.nickname, "NuevaClave123"));
});

test("adminReset gives a readable temporary password, stores only its hash and closes open sessions", async () => {
  const { service, resets, revoked } = buildService();

  const { temporaryPassword } = await service.adminReset(ana.id);

  assert.match(temporaryPassword, /^lili-[a-z2-9]{6}$/);
  assert.equal(resets.mustChange.get(ana.id), true);
  const storedHash = resets.passwordHashes.get(ana.id);
  assert.ok(storedHash);
  assert.notEqual(storedHash, temporaryPassword);
  assert.equal(await verifyPassword(temporaryPassword, storedHash), true);
  assert.deepEqual(revoked, [ana.id]);
});

test("adminReset never applies to ADMIN accounts and rejects unknown users", async () => {
  const users = new FakeUserRepository();
  users.findById = async (id?: string): Promise<User | null> => (id === "1" ? { ...ana, id: "1", role: "ADMIN" } : null);
  const service = new PasswordResetService(users, new FakeResetRepository(), new FakeMailer(), "https://x");

  await assert.rejects(service.adminReset("1"), PasswordResetForbiddenError);
  await assert.rejects(service.adminReset("999"), PasswordResetUserNotFoundError);
  await assert.rejects(service.adminReset("abc"), PasswordResetInputError);
});

// Usuario cuya contraseña vive en el FakeResetRepository (para changeOwnPassword).
function buildWithStoredPassword() {
  const resets = new FakeResetRepository();
  const users = new FakeUserRepository();
  users.findAuthByNickname = async (): Promise<UserWithPasswordHash | null> => ({ ...ana, passwordHash: resets.passwordHashes.get(ana.id) ?? null });
  const service = new PasswordResetService(users, resets, new FakeMailer(), "https://x");
  return { service, resets };
}

test("after an admin reset, changeOwnPassword sets the new password and clears the temporary mark", async () => {
  const { service, resets } = buildWithStoredPassword();
  const { temporaryPassword } = await service.adminReset(ana.id);

  await service.changeOwnPassword(ana.id, temporaryPassword, "MiClaveNueva9");

  assert.equal(resets.mustChange.get(ana.id), false);
  assert.equal(await verifyPassword("MiClaveNueva9", resets.passwordHashes.get(ana.id) ?? ""), true);
});

test("changeOwnPassword requires the current password and a different, long enough new one", async () => {
  const { service } = buildWithStoredPassword();
  const { temporaryPassword } = await service.adminReset(ana.id);

  await assert.rejects(service.changeOwnPassword(ana.id, "equivocada", "MiClaveNueva9"), PasswordChangeWrongPasswordError);
  await assert.rejects(service.changeOwnPassword(ana.id, temporaryPassword, "corta"), PasswordResetInputError);
  await assert.rejects(service.changeOwnPassword(ana.id, temporaryPassword, temporaryPassword), PasswordResetInputError);
});

test("the email + nickname recovery never leaves the password marked as temporary", async () => {
  const { service, resets } = buildService();
  await service.resetWithIdentity(ana.email, ana.nickname, "NuevaClave123");
  assert.equal(resets.mustChange.get(ana.id), false);
});

test("a host can reset a student's password but never another host's", async () => {
  const users = new FakeUserRepository();
  const hostAccount: User = { ...ana, id: "2", role: "HOST" };
  users.findById = async (id?: string): Promise<User | null> => (id === ana.id ? ana : id === "2" ? hostAccount : null);
  const service = new PasswordResetService(users, new FakeResetRepository(), new FakeMailer(), "https://x");

  await assert.doesNotReject(service.adminReset(ana.id, "HOST"));
  await assert.rejects(service.adminReset("2", "HOST"), PasswordResetForbiddenError);
  await assert.doesNotReject(service.adminReset("2", "ADMIN"));
});
