import assert from "node:assert/strict";
import test from "node:test";
import type { Request, Response } from "express";

import { createStudentSession, getAuthenticatedStudentUserId, requireStudentAuth } from "./student-session.js";

function buildResponse() {
  const state: { statusCode?: number; body?: unknown } = {};
  const res = {
    status(code: number) {
      state.statusCode = code;
      return res;
    },
    json(payload: unknown) {
      state.body = payload;
    },
  } as unknown as Response;

  return { res, state };
}

test("requireStudentAuth rejects a request with no Authorization header", () => {
  const req = { headers: {} } as unknown as Request;
  const { res, state } = buildResponse();
  let nextCalled = false;

  requireStudentAuth(req, res, () => { nextCalled = true; });

  assert.equal(nextCalled, false);
  assert.equal(state.statusCode, 401);
});

test("requireStudentAuth rejects an unknown or invalid token", () => {
  const req = { headers: { authorization: "Bearer not-a-real-token" } } as unknown as Request;
  const { res, state } = buildResponse();
  let nextCalled = false;

  requireStudentAuth(req, res, () => { nextCalled = true; });

  assert.equal(nextCalled, false);
  assert.equal(state.statusCode, 401);
});

test("requireStudentAuth accepts a valid session token and exposes the userId from the session, never from the body", () => {
  const token = createStudentSession("777");
  // El body intenta suplantar a otro usuario; debe ser ignorado por completo.
  const req = { headers: { authorization: `Bearer ${token}` }, body: { userId: "999" } } as unknown as Request;
  const { res } = buildResponse();
  let nextCalled = false;

  requireStudentAuth(req, res, () => { nextCalled = true; });

  assert.equal(nextCalled, true);
  assert.equal(getAuthenticatedStudentUserId(req), "777");
});
