import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const migrationPath = path.resolve(
  __dirname,
  "../../migrations/20260926_add_last_name_columns_to_users.sql",
);

test("the pending migration only adds last_name_paternal and last_name_maternal", () => {
  const sql = readFileSync(migrationPath, "utf8");
  const normalized = sql.toLowerCase();

  assert.ok(normalized.includes("last_name_paternal"));
  assert.ok(normalized.includes("last_name_maternal"));

  // No debe tocar password_hash, ni first_name, ni renombrar/eliminar `name`.
  assert.ok(!normalized.includes("password_hash"));
  assert.ok(!normalized.includes("first_name"));
  assert.ok(!/drop\s+column\s+`?name`?/i.test(sql));
  assert.ok(!/rename\s+column\s+`?name`?/i.test(sql));
});

test("the pending migration does not transform existing data", () => {
  const sql = readFileSync(migrationPath, "utf8");
  const normalized = sql.toLowerCase();

  // No debe haber ningún UPDATE/INSERT/DELETE: los registros existentes deben
  // quedar con last_name_paternal/last_name_maternal en NULL hasta que se
  // editen manualmente, sin ninguna transformación automática de `name`.
  assert.ok(!normalized.includes("update "));
  assert.ok(!normalized.includes("insert "));
  assert.ok(!normalized.includes("delete "));
});
