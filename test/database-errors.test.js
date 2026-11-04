import test from "node:test";
import assert from "node:assert/strict";
import { createClient } from "@libsql/client";
import { isUniqueConstraintError } from "../server/utils/databaseErrors.js";

test("unique constraint errors are recognized for local and remote libSQL clients", async (t) => {
  const db = createClient({ url: ":memory:" });
  t.after(() => db.close());
  await db.execute("CREATE TABLE example (id INTEGER PRIMARY KEY, name TEXT UNIQUE)");
  await db.execute("INSERT INTO example (name) VALUES ('name')");
  await assert.rejects(db.execute("INSERT INTO example (name) VALUES ('name')"), error => isUniqueConstraintError(error));
  assert.equal(isUniqueConstraintError({ code: "SQLITE_CONSTRAINT_UNIQUE" }), true);
  assert.equal(isUniqueConstraintError({ code: "SQLITE_CONSTRAINT", message: "SQLITE_CONSTRAINT: UNIQUE constraint failed: users.email" }), true);
  assert.equal(isUniqueConstraintError({ code: "SQLITE_CONSTRAINT", message: "CHECK constraint failed: score" }), false);
  assert.equal(isUniqueConstraintError(new Error("Network error")), false);
});
