import assert from "node:assert/strict";
import test from "node:test";
import type { Request, RequestHandler, Response } from "express";

import type { AuthSessionRepository } from "./auth-session.repository.js";
import { AuthSessionService } from "./auth-session.service.js";
import { createAuthGuards, getAuthUser } from "./auth.middleware.js";
import type { AuthUser } from "./auth.types.js";

const ana: AuthUser = { id: "25", nickname: "ana", role: "STUDENT" };
const host: AuthUser = { id: "2", nickname: "profe", role: "HOST" };
const admin: AuthUser = { id: "1", nickname: "lilis", role: "ADMIN" };

class FakeSessionRepository implements AuthSessionRepository {
  readonly users = new Map<string, AuthUser>([[ana.id, ana], [host.id, host], [admin.id, admin]]);
  readonly sessions = new Map<string, string>();
  lookups = 0;

  async create(tokenHash: string, userId: string): Promise<void> { this.sessions.set(tokenHash, userId); }
  async findUserByTokenHash(tokenHash: string): Promise<AuthUser | null> {
    this.lookups++;
    const userId = this.sessions.get(tokenHash);
    return userId ? this.users.get(userId) ?? null : null;
  }
  async deleteByTokenHash(tokenHash: string): Promise<void> { this.sessions.delete(tokenHash); }
  async deleteByUserId(userId: string): Promise<void> {
    for (const [tokenHash, owner] of this.sessions) {
      if (owner === userId) this.sessions.delete(tokenHash);
    }
  }
}

function build() {
  const repository = new FakeSessionRepository();
  let now = 0;
  const service = new AuthSessionService(repository, () => now);
  return { repository, service, advance: (ms: number) => { now += ms; } };
}

async function runGuard(guard: RequestHandler, token: string | null, body: unknown = {}) {
  const req = { headers: token ? { authorization: `Bearer ${token}` } : {}, body } as unknown as Request;
  const state: { status?: number; nextCalled: boolean } = { nextCalled: false };
  const res = {
    status(code: number) { state.status = code; return res; },
    json() { return res; },
  } as unknown as Response;
  await guard(req, res, () => { state.nextCalled = true; });
  return { ...state, req };
}

test("a session token is stored only as a hash and resolves to its user", async () => {
  const { repository, service } = build();
  const token = await service.create(ana.id);

  assert.equal(repository.sessions.has(token), false);
  assert.deepEqual(await service.resolve(token), ana);
});

test("sessions survive a server restart because they live in the repository, not in memory", async () => {
  const { repository, service } = build();
  const token = await service.create(ana.id);

  const afterRestart = new AuthSessionService(repository);
  assert.deepEqual(await afterRestart.resolve(token), ana);
});

test("resolve caches lookups but a logout applies immediately", async () => {
  const { repository, service } = build();
  const token = await service.create(ana.id);

  await service.resolve(token);
  await service.resolve(token);
  assert.equal(repository.lookups, 1);

  await service.revoke(token);
  assert.equal(await service.resolve(token), null);
});

test("revokeAllForUser closes every session of that user and no one else's", async () => {
  const { service } = build();
  const first = await service.create(ana.id);
  const second = await service.create(ana.id);
  const hostToken = await service.create(host.id);
  await service.resolve(first);

  await service.revokeAllForUser(ana.id);

  assert.equal(await service.resolve(first), null);
  assert.equal(await service.resolve(second), null);
  assert.deepEqual(await service.resolve(hostToken), host);
});

test("a role change applies once the cache expires, or at once after forgetCachedUser", async () => {
  const { repository, service, advance } = build();
  const token = await service.create(ana.id);
  await service.resolve(token);

  repository.users.set(ana.id, { ...ana, role: "HOST" });
  assert.equal((await service.resolve(token))?.role, "STUDENT");

  service.forgetCachedUser(ana.id);
  assert.equal((await service.resolve(token))?.role, "HOST");

  repository.users.set(ana.id, ana);
  advance(61_000);
  assert.equal((await service.resolve(token))?.role, "STUDENT");
});

test("guards: students can only play, hosts and admin share host access, only admin passes requireAdmin", async () => {
  const { service } = build();
  const guards = createAuthGuards(service);
  const tokens = {
    student: await service.create(ana.id),
    host: await service.create(host.id),
    admin: await service.create(admin.id),
  };

  const expectations: Array<[keyof typeof guards, keyof typeof tokens, boolean]> = [
    ["requireStudent", "student", true],
    ["requireStudent", "host", false],
    ["requireStudent", "admin", false],
    ["requireHost", "student", false],
    ["requireHost", "host", true],
    ["requireHost", "admin", true],
    ["requireAdmin", "student", false],
    ["requireAdmin", "host", false],
    ["requireAdmin", "admin", true],
  ];

  for (const [guard, who, allowed] of expectations) {
    const result = await runGuard(guards[guard], tokens[who]);
    assert.equal(result.nextCalled, allowed, `${guard} with ${who}`);
    if (!allowed) assert.equal(result.status, 403, `${guard} with ${who}`);
  }
});

test("guards reject a missing or unknown token with 401", async () => {
  const { service } = build();
  const guards = createAuthGuards(service);

  assert.equal((await runGuard(guards.requireHost, null)).status, 401);
  assert.equal((await runGuard(guards.requireHost, "token-inventado")).status, 401);
});

test("the authenticated user comes from the session, never from the body", async () => {
  const { service } = build();
  const guards = createAuthGuards(service);
  const token = await service.create(ana.id);

  const { req } = await runGuard(guards.requireStudent, token, { userId: admin.id, nickname: admin.nickname });

  assert.deepEqual(getAuthUser(req), ana);
});

test("with a temporary password, every guard answers PASSWORD_CHANGE_REQUIRED until it is changed", async () => {
  const { repository, service } = build();
  repository.users.set(ana.id, { ...ana, mustChangePassword: true });
  const guards = createAuthGuards(service);
  const token = await service.create(ana.id);

  const blocked = await runGuard(guards.requireStudent, token);
  assert.equal(blocked.nextCalled, false);
  assert.equal(blocked.status, 403);

  repository.users.set(ana.id, ana);
  service.forgetCachedUser(ana.id);
  assert.equal((await runGuard(guards.requireStudent, token)).nextCalled, true);
});
