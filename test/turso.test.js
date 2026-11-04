import test from "node:test";
import assert from "node:assert/strict";

test("database models are async and login links can only be consumed once", async (t) => {
  process.env.GUESSR_DB_PATH = ":memory:";
  const db = (await import("../server/config/db.js")).default;
  t.after(() => {
    db.close();
    delete process.env.GUESSR_DB_PATH;
  });
  const { createUser } = await import("../server/models/usersModel.js");
  const { createAuthToken, consumeAuthToken } = await import("../server/models/authTokensModel.js");
  const pendingUser = createUser({ username: "turso_user", email: "turso@example.org", passwordHash: "hash" });
  assert.equal(typeof pendingUser.then, "function", "Remote queries must return promises");
  const user = await pendingUser;
  const expiresAt = new Date(Date.now() + 60_000).toISOString();
  await createAuthToken({ userId: user.id, tokenHash: "first", purpose: "magic_login", expiresAt });
  await createAuthToken({ userId: user.id, tokenHash: "second", purpose: "magic_login", expiresAt });
  const consume = tokenHash => consumeAuthToken({ tokenHash, purpose: "magic_login", nowIso: new Date().toISOString() });
  assert.equal(await consume("first"), null, "A new link supersedes the previous link");
  const results = await Promise.all([consume("second"), consume("second")]);
  assert.equal(results.filter(Boolean).length, 1, "Concurrent requests cannot reuse a login token");
  await createAuthToken({ userId: user.id, tokenHash: "expired", purpose: "magic_login", expiresAt: "2000-01-01T00:00:00.000Z" });
  assert.equal(await consume("expired"), null);
});
