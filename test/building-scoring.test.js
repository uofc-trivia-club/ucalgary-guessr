import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import Database from "better-sqlite3";
import { createClient } from "@libsql/client";
import { initializeDatabase } from "../server/db/initialize.js";
import { scoreGuess } from "../server/utils/guessing.js";

const assignments = [
  ["31st-terminal.jpg", "EEEL", "Energy Environment Experiential Learning", 51.08107265, -114.12946261],
  ["atrium-admin.jpeg", "AD", "Administration", 51.07818792, -114.12710165],
  ["EEEL-facing-ES.jpg", "EEEL", "Energy Environment Experiential Learning", 51.08107265, -114.12946261],
  ["MH-south.jpg", "MH", "MacEwan Hall", 51.07859427, -114.13046071],
  ["tfdl-floor-2.jpg", "TFDL", "Taylor Family Digital Library", 51.07745172, -114.12989818],
  ["BI.jpg", "BI", "Biological Sciences", 51.07993429, -114.1256099],
  ["CrowsnestHall.jpg", "CR", "Crowsnest Hall", 51.0791777, -114.13493205],
  ["EEEL.jpg", "EEEL", "Energy Environment Experiential Learning", 51.08107265, -114.12946261],
  ["ENA.jpg", "ENA", "Engineering Block A", 51.08029647, -114.13142676],
  ["ENC.jpg", "ENC", "Engineering Block C", 51.08084054, -114.13189756],
  ["ENE.jpeg", "ENE", "Engineering Block E", 51.07994458, -114.13249381],
  ["Education.jpeg", "EDC", "Education Classroom Block", 51.07672112, -114.1265515],
  ["KNB-rocks.jpg", "KNB", "Kinesiology Block B", 51.07795659, -114.13374001],
  ["KNA (2).jpg", "KNA", "Kinesiology Block A", 51.07712939, -114.13296332],
  ["KNB.jpg", "KNB", "Kinesiology Block B", 51.07795659, -114.13374001],
  ["KNA-cafe.jpg", "KNA", "Kinesiology Block A", 51.07712939, -114.13296332],
  ["MFH 160.jpg", "MFH", "Murray Fraser Hall", 51.07706237, -114.12832517],
  ["MT.jpg", "MT", "MacKimmie Tower", 51.07747931, -114.12886686],
  ["MathisonHall.jpeg", "MTH", "Mathison Hall", 51.07677619, -114.12469203],
  ["RC.jpg", "RC", "Rozsa Centre", 51.07638246, -114.13149132],
  ["SB.jpg", "SB", "Science B", 51.07938608, -114.1294413],
  ["SS.jpg", "Social Sciences", "Social Sciences", 51.07913269, -114.12695816],
  ["TFDL.jpg", "TFDL", "Taylor Family Digital Library", 51.07745172, -114.12989818],
  ["TaylorInstitute.jpeg", "TI", "Taylor Institute for Teaching and Learning", 51.07911839, -114.13122994],
  ["mac-hall.jpg", "MH", "MacEwan Hall", 51.07859427, -114.13046071],
  ["scienceA.jpeg", "SA", "Science A", 51.07913657, -114.12818583],
  ["st-140.jpg", "Science Theatres", "Science Theatres", 51.07962186, -114.12716548],
];
const photo = (buildingName) => ({ answer_building_name: buildingName, answer_latitude: 0, answer_longitude: 0 });
const guess = (buildingName) => ({ type: "building", buildingName, latitude: 0, longitude: 0 });

test("building codes and their map names receive full credit for the same building", () => {
  for (const [, code, name] of assignments) {
    const result = scoreGuess(guess(name), photo(code));
    assert.equal(result.exactBuilding, true, code);
    assert.equal(result.score, 5000, code);
    assert.equal(result.distanceMetres, 0);
    assert.equal(result.answer.buildingName, name);
  }
});

test("MH means MacEwan Hall and does not award full credit to Mathison Hall", () => {
  const result = scoreGuess(guess("Mathison Hall"), photo("MH"));
  assert.equal(result.exactBuilding, false);
  assert.ok(result.score < 5000);
  assert.ok(result.distanceMetres > 400);
});

test("Earth Sciences scores higher than Kinesiology A when ICT is correct", () => {
  const nearby = scoreGuess(guess("Earth Sciences"), photo("ICT"));
  const distant = scoreGuess(guess("Kinesiology Block A"), photo("ICT"));
  assert.ok(nearby.distanceMetres > 80 && nearby.distanceMetres < 100);
  assert.ok(distant.distanceMetres > 350 && distant.distanceMetres < 450);
  assert.ok(nearby.score > distant.score);
  assert.ok(nearby.score < 5000);
});

test("building distance depends on building centres rather than submitted click coordinates", () => {
  const first = scoreGuess(guess("ES"), photo("ICT"));
  const second = scoreGuess({ ...guess("ES"), latitude: 51.08020255, longitude: -114.13035595 }, photo("ICT"));
  assert.ok(first.distanceMetres > 80);
  assert.equal(first.distanceMetres, second.distanceMetres);
  assert.equal(first.score, second.score);
});

test("maximum points are reserved for a matching building on building-answer photos", () => {
  const answer = { answer_building_name: "ICT", answer_latitude: 51.08020255, answer_longitude: -114.13035595 };
  assert.ok(scoreGuess({ type: "point", latitude: 51.08020255, longitude: -114.13035595 }, answer).score < 5000);
  assert.equal(scoreGuess({ type: "point", latitude: 51.08020255, longitude: -114.13035595 }, {
    answer_latitude: 51.08020255, answer_longitude: -114.13035595,
  }).score, 5000);
});
