import test from "node:test";
import assert from "node:assert/strict";
import { hasPhotos, missingPhotosReason, photoFiles } from "../tests/fixtures/photo-files.js";
const needsPhotos = { skip: hasPhotos ? false : missingPhotosReason };

// Models use their real in-memory database, never the developer's accounts/data.
process.env.GUESSR_DB_PATH = ":memory:";
const db = (await import("../server/config/db.js")).default;
const { getRandomPhotos } = await import("../server/models/photosModel.js");
const { getOrCreateDailyChallenge } = await import("../server/models/dailyModel.js");
const { getOrCreateWeeklyChallenge } = await import("../server/models/weeklyModel.js");
test.after(() => { db.close(); delete process.env.GUESSR_DB_PATH; });

const standard = photoFiles().filter(file => !file.startsWith("weekly-images/"));
const weekly = photoFiles().filter(file => file.startsWith("weekly-images/"));

test("Random and Daily use every ordinary photo and never use a Weekly-only image", needsPhotos, async () => {
  const random = await getRandomPhotos(10000);
  assert.deepEqual(new Set(random.map(row => row.image_path)), new Set(standard.map(file => "/assets/photos/" + file)));
  assert.equal((await getRandomPhotos()).length, 5);
  const dailyImages = new Set();
  for (let index = 0; index < standard.length; index++) {
    const date = new Date(Date.UTC(2030, 0, index + 1)).toISOString().slice(0, 10);
    const challenge = await getOrCreateDailyChallenge(date);
    assert.ok(!challenge.image_path.includes("/weekly-images/"));
    dailyImages.add(challenge.image_id);
    assert.equal((await getOrCreateDailyChallenge(date)).image_id, challenge.image_id);
  }
  assert.deepEqual(dailyImages, new Set(random.map(row => row.image_id)));
});

test("Weekly selects only from weekly-images and every Weekly photo is eligible", needsPhotos, async () => {
  const placeholders = weekly.map(() => "?").join(",");
  const { rows: candidates } = await db.execute({ sql: "SELECT * FROM photos WHERE image_path IN (" + placeholders + ")", args: weekly.map(file => "/assets/photos/" + file) });
  assert.equal(candidates.length, weekly.length);
  assert.ok(candidates.every(row => row.photo_pool === "weekly"));
  for (let index = 0; index < candidates.length; index++) {
    // With one eligible weekly row, selection must return it, never a standard photo.
    await db.execute("UPDATE photos SET photo_pool = 'standard' WHERE photo_pool = 'weekly'");
    await db.execute({ sql: "UPDATE photos SET photo_pool = 'weekly' WHERE image_id = ?", args: [candidates[index].image_id] });
    const date = new Date(Date.UTC(2040, 0, 1 + index * 7)).toISOString().slice(0, 10);
    assert.equal((await getOrCreateWeeklyChallenge(date)).image_id, candidates[index].image_id);
  }
  await db.execute({ sql: "UPDATE photos SET photo_pool = 'weekly' WHERE image_path IN (" + placeholders + ")", args: weekly.map(file => "/assets/photos/" + file) });
  await db.execute("UPDATE photos SET photo_pool = 'standard' WHERE photo_pool = 'weekly'");
  assert.equal(await getOrCreateWeeklyChallenge("2099-01-04"), null, "An empty Weekly pool must not fall back to ordinary photos");
});
