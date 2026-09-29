import assert from "node:assert/strict";
import test from "node:test";

import type { MailMessage, Mailer } from "../mailer.js";
import { verifyPassword } from "./password.js";
import type { PasswordResetRepository } from "./password-reset.repository.js";
import {
  hashResetToken,
  PasswordResetInputError,
  PasswordResetInvalidTokenError,
  PasswordResetService,
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

class FakeUserRepository implements UserRepository {
  async create(): Promise<User> { return ana; }
  async findById(): Promise<User | null> { return ana; }
  async findByEmail(email: string): Promise<User | null> { return email === ana.email ? ana : null; }
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
  const service = new PasswordResetService(
    new FakeUserRepository(),
    resets,
    mailer,
    "https://lilihoot.example/",
    (userId) => revoked.push(userId),
  );
  return { service, resets, mailer, revoked };
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
