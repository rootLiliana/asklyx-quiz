import assert from "node:assert/strict";
import test from "node:test";

import { hashPassword, verifyPassword } from "./password.js";

const PASSWORD = "Sup3rSecreta!";

test("hashPassword never returns the plaintext password", async () => {
  const hash = await hashPassword(PASSWORD);

  assert.notEqual(hash, PASSWORD);
  assert.ok(hash.includes(":"));
});

test("hashPassword salts each call so the same password produces different hashes", async () => {
  const [first, second] = await Promise.all([hashPassword(PASSWORD), hashPassword(PASSWORD)]);

  assert.notEqual(first, second);
});

test("verifyPassword accepts the correct password and rejects an incorrect one", async () => {
  const hash = await hashPassword(PASSWORD);

  assert.equal(await verifyPassword(PASSWORD, hash), true);
  assert.equal(await verifyPassword("otra-contraseña", hash), false);
});

test("verifyPassword rejects a malformed stored hash safely instead of throwing", async () => {
  assert.equal(await verifyPassword(PASSWORD, "not-a-valid-hash"), false);
  assert.equal(await verifyPassword(PASSWORD, ""), false);
});
