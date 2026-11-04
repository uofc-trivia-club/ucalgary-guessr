import test from "node:test";
import assert from "node:assert/strict";
import { createClient } from "@libsql/client";
import { promisify } from "node:util";
import LibsqlSessionStore from "../server/services/sessionStore.js";
import { initializeDatabase } from "../server/db/initialize.js";

test("sessions survive store recreation, expire, and can be destroyed", async (t) => {
  const db = createClient({ url: ":memory:" });
  t.after(() => db.close());
  await initializeDatabase(db);
  const first = new LibsqlSessionStore(db);
  const second = new LibsqlSessionStore(db);
  const call = (store, method, ...args) => promisify(store[method]).call(store, ...args);
  const value = { userId: 12, dailyAttempt: { date: "2026-10-20", revealed: true },
    cookie: { expires: new Date(Date.now() + 60_000).toISOString() } };
  await call(first, "set", "sid", value);
  await initializeDatabase(db);
  assert.deepEqual(await call(second, "get", "sid"), value);
  await call(second, "touch", "sid", { ...value, userId: 99 });
  assert.equal((await call(first, "get", "sid")).userId, 12, "Touch only updates the expiry");
  await call(second, "destroy", "sid");
  assert.equal(await call(first, "get", "sid"), null);
  await call(first, "set", "expired", { cookie: { expires: "2000-01-01T00:00:00Z" } });
  assert.equal(await call(second, "get", "expired"), null);
  await call(first, "set", "fresh", value);
  assert.equal((await db.execute("SELECT COUNT(*) AS count FROM sessions WHERE sid = 'expired'")).rows[0].count, 0);
});

test("session database and JSON errors reach the callback", async (t) => {
  const db = createClient({ url: ":memory:" });
  t.after(() => db.close());
  await initializeDatabase(db);
  const store = new LibsqlSessionStore(db);
  await db.execute({ sql: "INSERT INTO sessions VALUES (?, ?, ?)", args: ["broken", "invalid-json", Date.now() + 60_000] });
  await assert.rejects(promisify(store.get).call(store, "broken"), SyntaxError);
  db.close();
  await assert.rejects(promisify(store.get).call(store, "sid"), /closed/i);
});

test("stale overlapping saves cannot undo Daily reveals or random image claims", async (t) => {
  const db = createClient({ url: ":memory:" });
  t.after(() => db.close());
  await initializeDatabase(db);
  const store = new LibsqlSessionStore(db);
  const save = value => promisify(store.set).call(store, "sid", value);
  const load = () => promisify(store.get).call(store, "sid");
  const initial = { cookie: {}, dailyAttempt: { date: "2026-10-20", startedAt: 1000, revealed: false },
    randomRound: { id: "round", expiresAt: Date.now() + 60_000, imageIds: ["a", "b"], guessedIds: [] } };
  await save(initial);
  const stale = await load();
  const revealed = structuredClone(stale);
  revealed.dailyAttempt = { ...revealed.dailyAttempt, revealed: true, result: { score: 1234, guess: null }, elapsedMs: 50 };
  revealed.randomRound.guessedIds = ["a"];
  await save(revealed);
  stale.randomRound.guessedIds = ["b"];
  await save(stale);
  const merged = await load();
  assert.equal(merged.dailyAttempt.revealed, true);
  assert.deepEqual(merged.dailyAttempt.result, { score: 1234, guess: null });
  assert.deepEqual(new Set(merged.randomRound.guessedIds), new Set(["a", "b"]));
  const nextDay = structuredClone(merged);
  nextDay.dailyAttempt = { date: "2026-10-21", startedAt: 2000, revealed: false };
  await save(nextDay);
  await save(revealed);
  assert.deepEqual((await load()).dailyAttempt, nextDay.dailyAttempt, "A late request cannot roll the date backward");
});

test("random image claims are atomic across overlapping requests", async (t) => {
  const db = createClient({ url: ":memory:" });
  t.after(() => db.close());
  await initializeDatabase(db);
  const store = new LibsqlSessionStore(db);
  await promisify(store.set).call(store, "sid", { cookie: {}, randomRound: {
    id: "round", expiresAt: Date.now() + 60_000, imageIds: ["a", "b"], guessedIds: [],
  } });
  const claims = await Promise.all([
    store.claimRoundImage("sid", "round", "a"), store.claimRoundImage("sid", "round", "a"),
  ]);
  assert.deepEqual(claims.sort(), [false, true]);
  assert.equal(await store.claimRoundImage("sid", "other-round", "b"), false);
  assert.equal(await store.claimRoundImage("sid", "round", "unknown"), false);
  assert.equal(await store.claimRoundImage("sid", "round", "b"), true);
});
