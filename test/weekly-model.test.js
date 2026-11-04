import test from "node:test";
import assert from "node:assert/strict";

test("Weekly stores one randomly selected pool image for everyone and preserves it on restart", async t => {
  process.env.GUESSR_DB_PATH = ":memory:";
  const db = (await import("../server/config/db.js")).default;
  t.after(() => { db.close(); delete process.env.GUESSR_DB_PATH; });
  const { initializeDatabase } = await import("../server/db/initialize.js");
  const { getOrCreateWeeklyChallenge } = await import("../server/models/weeklyModel.js");
  const { getOrCreateDailyChallenge } = await import("../server/models/dailyModel.js");
  const daily = await getOrCreateDailyChallenge("2026-10-25");
  const candidates = await Promise.all(Array.from({ length: 8 }, () => getOrCreateWeeklyChallenge("2026-10-25")));
  assert.ok(candidates[0].image_id);
  assert.equal(new Set(candidates.map(row => row.image_id)).size, 1);
  assert.equal((await db.execute("SELECT COUNT(*) AS count FROM weekly_challenges")).rows[0].count, 1);
  assert.ok((await db.execute({ sql: "SELECT image_id FROM photos WHERE image_id = ?", args: [candidates[0].image_id] })).rows[0]);
  await getOrCreateWeeklyChallenge("2026-11-01");
  assert.equal((await db.execute("SELECT COUNT(*) AS count FROM weekly_challenges")).rows[0].count, 2);
  await initializeDatabase(db);
  assert.deepEqual(await getOrCreateWeeklyChallenge("2026-10-25"), candidates[0]);
  assert.deepEqual(await getOrCreateDailyChallenge("2026-10-25"), daily);
});
