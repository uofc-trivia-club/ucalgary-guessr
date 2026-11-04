import test from "node:test";
import assert from "node:assert/strict";
import { scoreFromDistanceMetres } from "../server/utils/scoring.js";
import { beginDailyAttempt, revealDailyAttempt, carryDailyAttempt } from "../server/utils/dailyAttempt.js";
import { createRound, claimRoundImage } from "../server/utils/randomRound.js";

test("campus scoring rewards precision and reaches zero at the cutoff", () => {
  assert.equal(scoreFromDistanceMetres(0), 5000);
  assert.equal(scoreFromDistanceMetres(1000), 0);
  assert.equal(scoreFromDistanceMetres(2000), 0);
  assert.ok(scoreFromDistanceMetres(5) - scoreFromDistanceMetres(50) >
    scoreFromDistanceMetres(700) - scoreFromDistanceMetres(745));
});

test("daily timer survives refresh and a revealed guest result survives login", () => {
  const guest = {};
  beginDailyAttempt(guest, "2026-09-25", 1000);
  beginDailyAttempt(guest, "2026-09-25", 4000);
  assert.equal(guest.dailyAttempt.startedAt, 1000);
  revealDailyAttempt(guest, "2026-09-25", { score: 4000 }, 5000);
  const loggedIn = {};
  carryDailyAttempt(guest, loggedIn);
  assert.equal(loggedIn.dailyAttempt.revealed, true);
  assert.equal(loggedIn.dailyAttempt.result.score, 4000);
  assert.equal(loggedIn.dailyAttempt.elapsedMs, 4000);
  beginDailyAttempt(loggedIn, "2026-09-26", 10000);
  assert.equal(loggedIn.dailyAttempt.revealed, false);
});

test("random rounds reject foreign images and duplicate guesses", () => {
  const session = {};
  const round = createRound(session, ["a", "b"], 1000);
  assert.equal(claimRoundImage(session, "made-up", "a", 1100), false);
  assert.equal(claimRoundImage(session, round.id, "c", 1100), false);
  assert.equal(claimRoundImage(session, round.id, "a", 1100), true);
  assert.equal(claimRoundImage(session, round.id, "a", 1200), false);
  assert.equal(claimRoundImage(session, round.id, "b", 1000 + 60 * 60 * 1000 + 1), false);
});

test("building guesses receive full credit for the correct building and distance scoring otherwise", async () => {
  const { readGuess, scoreGuess } = await import("../server/utils/guessing.js");
  const photo = {
    answer_latitude: 51.078,
    answer_longitude: -114.128,
    answer_building_name: "Kinesiology Block A",
    answer_building_latitude: 51.078,
    answer_building_longitude: -114.128,
  };

  const exact = readGuess({
    guess: {
      type: "building",
      buildingId: "KA",
      buildingName: "Kinesiology A Building",
      latitude: 51.079,
      longitude: -114.129,
    },
  });
  const exactResult = scoreGuess(exact, photo);
  assert.equal(exactResult.exactBuilding, true);
  assert.equal(exactResult.distanceMetres, 0);
  assert.equal(exactResult.score, 5000);

  const nearby = readGuess({
    guess: {
      type: "building",
      buildingId: "KB",
      buildingName: "Kinesiology Block B",
      latitude: 51.0784,
      longitude: -114.1284,
    },
  });
  const nearbyResult = scoreGuess(nearby, photo);
  assert.equal(nearbyResult.exactBuilding, false);
  assert.ok(nearbyResult.distanceMetres > 0);
  assert.ok(nearbyResult.score < 5000);

  const point = readGuess({ guess: { type: "point", latitude: 51.079, longitude: -114.129 } });
  assert.equal(point.type, "point");
  assert.ok(scoreGuess(point, photo).distanceMetres > 0);
});
