import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { initializeDatabase } from "../server/db/initialize.js";

const root = fileURLToPath(new URL("..", import.meta.url));

test("legacy scores migrate and ties use distance, then stopwatch time", async (t) => {
  process.env.GUESSR_DB_PATH = ":memory:";
  const connection = (await import("../server/config/db.js")).default;
  t.after(() => {
    connection.close();
    delete process.env.GUESSR_DB_PATH;
  });
  let schema = fs.readFileSync(path.join(root, "server/db/schema.sql"), "utf8");
  schema = schema.replace(/^  result_json.*\n/m, "").replace(/^  elapsed_ms.*\n/m, "").replace(
    "distance_metres ASC, elapsed_ms ASC, ", ""
  );
  // Rebuild only this isolated in-memory fixture in its legacy shape.
  await connection.executeMultiple("DROP TABLE auth_tokens; DROP TABLE daily_scores; DROP TABLE daily_challenges; DROP TABLE users; DROP TABLE photos;");
  await connection.executeMultiple(schema);
  await connection.executeMultiple(fs.readFileSync(path.join(root, "server/db/seed.sql"), "utf8"));
  await connection.execute({ sql: "INSERT INTO daily_challenges (challenge_date, image_id) VALUES (?, ?)", args: ["2026-09-25", "atrium-01"] });
  for (let i = 1; i <= 4; i++) {
    await connection.execute({ sql: "INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)",
      args: ["player" + i, "player" + i + "@test.org", "hash"] });
  }
  await connection.execute({ sql: "INSERT INTO daily_scores (user_id, challenge_date, score, distance_metres) VALUES (?, ?, ?, ?)",
    args: [4, "2026-09-25", 4000, 49] });
  await initializeDatabase(connection);
  const { createDailyScore, getDailyLeaderboard, getDailyRankForUser } =
    await import("../server/models/scoresModel.js");
  assert.equal((await connection.execute("SELECT result_json FROM daily_scores WHERE user_id = 4")).rows[0].result_json, null);
  await createDailyScore({ userId: 1, challengeDate: "2026-09-25", score: 4000, distanceMetres: 50, elapsedMs: 1000 });
  await createDailyScore({ userId: 2, challengeDate: "2026-09-25", score: 4000, distanceMetres: 49, elapsedMs: 90000 });
  await createDailyScore({ userId: 3, challengeDate: "2026-09-25", score: 4000, distanceMetres: 49, elapsedMs: 1000 });
  const entries = await getDailyLeaderboard("2026-09-25");
  assert.deepEqual(entries.map((entry) => entry.userId), [3, 2, 4, 1]);
  assert.deepEqual(entries.map((entry) => entry.elapsedMs), [1000, 90000, null, 1000]);
  assert.deepEqual(await Promise.all([1, 2, 3, 4].map((id) => getDailyRankForUser("2026-09-25", id))), [4, 2, 1, 3]);
});
