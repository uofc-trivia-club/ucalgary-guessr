import test from "node:test";
import assert from "node:assert/strict";
import { createDatabaseClient } from "../server/config/databaseClient.js";

test("remote databases require a token and production cannot use a local file", () => {
  assert.throws(() => createDatabaseClient({ TURSO_DATABASE_URL: "libsql://example.turso.io" }), /TURSO_AUTH_TOKEN/);
  assert.throws(() => createDatabaseClient({ NODE_ENV: "production" }), /remote database/);
  assert.throws(() => createDatabaseClient({ VERCEL: "1", TURSO_DATABASE_URL: "file:local.db" }), /remote database/);
  const db = createDatabaseClient({ GUESSR_DB_PATH: ":memory:", TURSO_DATABASE_URL: "libsql://example.turso.io" });
  assert.equal(db.protocol, "file", "Explicit test databases override the local .env configuration");
  db.close();
});
