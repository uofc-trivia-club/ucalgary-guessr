import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createClient } from "@libsql/client";
import { initializeDatabase } from "../server/db/initialize.js";
import { hasPhotos, missingPhotosReason, photoFiles } from "../tests/fixtures/photo-files.js";
const needsPhotos = { skip: hasPhotos ? false : missingPhotosReason };
import path from "node:path";
import { scoreGuess } from "../server/utils/guessing.js";

const schema = fs.readFileSync(new URL("../server/db/schema.sql", import.meta.url), "utf8");
const { buildings } = JSON.parse(fs.readFileSync(new URL("../server/data/campus-buildings.json", import.meta.url), "utf8"));
const byFile = (rows, file) => rows.find(row => row.image_path === "/assets/photos/" + file);

test("the full nested photo inventory is registered once with resolvable map answers", needsPhotos, async () => {
  const db = createClient({ url: ":memory:" });
  try {
    await initializeDatabase(db);
    const { rows } = await db.execute("SELECT * FROM photos");
    assert.deepEqual(new Set(rows.map(row => row.image_path)), new Set(photoFiles().map(file => "/assets/photos/" + file)));
    assert.equal(rows.length, photoFiles().length);
    for (const row of rows) {
      assert.ok(row.image_path.endsWith(".webp"), row.image_path + " uses WebP");
      const code = path.basename(row.image_path).match(/^[A-Za-z]+/)[0].toUpperCase();
      const expected = code === "SS" ? buildings.find(building => building.name === "Social Sciences")
        : code === "ST" ? buildings.find(building => building.name === "Science Theatres")
        : buildings.find(building => building.code === code);
      assert.ok(expected, row.image_path + " has a map code");
      assert.equal(row.answer_building_name, expected.name, row.image_path);
      assert.equal(row.answer_building_latitude, expected.latitude, row.image_path);
      assert.equal(row.answer_building_longitude, expected.longitude, row.image_path);
      const result = scoreGuess({ type: "building", buildingName: row.answer_building_name, latitude: 0, longitude: 0 }, row);
      assert.equal(result.score, 5000, row.image_path);
      assert.equal(result.exactBuilding, true, row.image_path);
      assert.equal(result.answer.latitude, row.answer_building_latitude);
      assert.equal(result.answer.longitude, row.answer_building_longitude);
    }
    for (const [file, name, latitude, longitude] of [
      ["sciences/classrooms/SS 06.webp", "Social Sciences", 51.07913269, -114.12695816],
      ["sciences/classrooms/ST 140.webp", "Science Theatres", 51.07962186, -114.12716548],
      ["weekly-images/SS-staircase.webp", "Social Sciences", 51.07913269, -114.12695816],
      ["education/general/EDT-Basement.webp", "Education Tower", 51.07707392, -114.12599993],
      ["non-main campus/CSB.webp", "Clinical Skills Building", 51.16002788, -114.21690201],
      ["non-main campus/DTC-234.webp", "Downtown Campus", 51.04636503, -114.0821271],
    ]) {
      const row = byFile(rows, file);
      assert.ok(row, file);
      assert.equal(row.answer_building_name, name);
      assert.equal(row.answer_building_latitude, latitude);
      assert.equal(row.answer_building_longitude, longitude);
    }
  } finally { db.close(); }
});

test("WebP migration updates all bundled paths while preserving photo rows, answers, and assigned challenges", needsPhotos, async () => {
  const db = createClient({ url: ":memory:" });
  try {
    await db.executeMultiple(schema);
    await db.executeMultiple(fs.readFileSync(new URL("./fixtures/pre-webp-photo-seed.sql", import.meta.url), "utf8"));
    const oldRows = (await db.execute("SELECT * FROM photos ORDER BY id")).rows;
    const dailyId = oldRows.find(row => row.photo_pool === "standard" && row.image_id.startsWith("photo-")).image_id;
    const weeklyId = oldRows.find(row => row.photo_pool === "weekly").image_id;
    await db.execute({ sql: "INSERT INTO daily_challenges (challenge_date, image_id) VALUES ('2030-01-01', ?)", args: [dailyId] });
    await db.execute({ sql: "INSERT INTO weekly_challenges (challenge_date, image_id) VALUES ('2030-01-06', ?)", args: [weeklyId] });
    await initializeDatabase(db);
    const currentRows = (await db.execute("SELECT * FROM photos ORDER BY id")).rows;
    assert.equal(currentRows.length, oldRows.length, "Conversion must not create duplicate photo rows");
    for (const old of oldRows) {
      const expectedPath = old.image_path.replace(/\.[^/.]+$/, ".webp");
      const current = currentRows.find(row => row.image_id === old.image_id);
      assert.deepEqual(current, { ...old, image_path: expectedPath }, old.image_id);
      assert.ok(fs.existsSync(new URL("../public" + expectedPath, import.meta.url)), expectedPath);
    }
    assert.equal((await db.execute("SELECT image_id FROM daily_challenges")).rows[0].image_id, dailyId);
    assert.equal((await db.execute("SELECT image_id FROM weekly_challenges")).rows[0].image_id, weeklyId);
  } finally { db.close(); }
});

test("legacy photo paths migrate without losing IDs, outdoor answers, custom photos, or scores", needsPhotos, async () => {
  const db = createClient({ url: ":memory:" });
  try {
    await db.executeMultiple(schema.replace(/^.*photo_pool.*\n/gm, ""));
    await db.executeMultiple(fs.readFileSync(new URL("./fixtures/legacy-photo-seed.sql", import.meta.url), "utf8"));
    const oldRows = (await db.execute("SELECT * FROM photos ORDER BY id")).rows;
    await db.executeMultiple(
      "INSERT INTO users (username, email, password_hash) VALUES ('legacy', 'legacy@test.org', 'hash');" +
      "INSERT INTO daily_challenges (challenge_date, image_id) VALUES ('2026-10-01', 'mh-01');" +
      "INSERT INTO daily_scores (user_id, challenge_date, score, distance_metres) VALUES (1, '2026-10-01', 4321, 100);" +
      "INSERT INTO weekly_challenges (challenge_date, image_id) VALUES ('2026-10-18', 'mh-01');" +
      "INSERT INTO weekly_scores (user_id, challenge_date, score, distance_metres) VALUES (1, '2026-10-18', 3456, 125);" +
      "INSERT INTO photos (image_id, image_path, answer_latitude, answer_longitude) VALUES ('custom', '/custom.jpg', 51, -114);"
    );
    await initializeDatabase(db);
    const { rows } = await db.execute("SELECT * FROM photos");
    for (const old of oldRows) {
      const current = rows.find(row => row.image_id === old.image_id);
      assert.ok(current, old.image_id);
      assert.equal(current.id, old.id);
      assert.ok(fs.existsSync(new URL("../public" + current.image_path, import.meta.url)), current.image_path);
      if (["eeel-01", "mh-01", "terminal-01"].includes(old.image_id)) {
        for (const field of ["answer_latitude", "answer_longitude", "answer_building_name", "answer_building_latitude", "answer_building_longitude"]) assert.equal(current[field], old[field], old.image_id + " " + field);
      }
    }
    assert.equal((await db.execute("SELECT score FROM daily_scores")).rows[0].score, 4321);
    assert.equal((await db.execute("SELECT image_id FROM weekly_challenges")).rows[0].image_id, "mh-01", "Grandfather assigned weeks instead of changing the photo beneath saved scores");
    assert.equal((await db.execute("SELECT score FROM weekly_scores")).rows[0].score, 3456);
    assert.equal((await db.execute("SELECT image_id FROM daily_challenges")).rows[0].image_id, "mh-01");
    assert.equal(rows.find(row => row.image_id === "custom").image_path, "/custom.jpg");
    const beforeRestart = (await db.execute("SELECT * FROM photos ORDER BY id")).rows;
    await initializeDatabase(db);
    assert.deepEqual((await db.execute("SELECT * FROM photos ORDER BY id")).rows, beforeRestart);
  } finally { db.close(); }
});

test("the older KNA/KNB mislabels are corrected without replacing challenge IDs", async () => {
  const db = createClient({ url: ":memory:" });
  try {
    await db.executeMultiple(schema);
    await db.executeMultiple(fs.readFileSync(new URL("./fixtures/legacy-photo-seed.sql", import.meta.url), "utf8"));
    await db.executeMultiple("UPDATE photos SET image_path = '/assets/photos/KNA.jpg', answer_building_name = 'Kinesiology Block A' WHERE image_id = 'kna-01';" +
      "UPDATE photos SET image_path = '/assets/photos/KNB-2.jpg', answer_building_name = 'Kinesiology Block B' WHERE image_id = 'knb-02';" +
      "INSERT INTO daily_challenges (challenge_date, image_id) VALUES ('2030-01-01', 'kna-01');");
    await initializeDatabase(db);
    for (const [id, file, name] of [
      ["kna-01", "kinesiology/general/KNB-rocks.webp", "Kinesiology Block B"],
      ["knb-02", "kinesiology/general/KNA-cafe.webp", "Kinesiology Block A"],
    ]) {
      const row = (await db.execute({ sql: "SELECT * FROM photos WHERE image_id = ?", args: [id] })).rows[0];
      assert.equal(row.image_path, "/assets/photos/" + file);
      assert.equal(row.answer_building_name, name);
      assert.equal(scoreGuess({ type: "building", buildingName: name, latitude: 0, longitude: 0 }, row).score, 5000);
    }
    assert.equal((await db.execute("SELECT image_id FROM daily_challenges")).rows[0].image_id, "kna-01");
  } finally { db.close(); }
});
