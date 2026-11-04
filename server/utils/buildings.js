import { readFileSync } from "node:fs";

const { buildings } = JSON.parse(readFileSync(new URL("../data/campus-buildings.json", import.meta.url), "utf8"));

export function normaliseBuildingName(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[’']/g, "")
    .replace(/\([^)]*\)/g, " ")
    .replace(/&/g, "and")
    .replace(/\b(building|block|hall|centre|center)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

const aliases = new Map();
for (const building of buildings) {
  const names = [building.name, building.code];
  if (building.code === "EEEL") names.push("Energy Environment and Experiential Learning");
  for (const name of names) {
    const key = normaliseBuildingName(name);
    // Some campuses reuse codes (SS/ST). Require the full name for ambiguous
    // aliases rather than treating distinct buildings as the same answer.
    if (!aliases.has(key)) aliases.set(key, building);
    else if (aliases.get(key)?.id !== building.id) aliases.set(key, null);
  }
}

export function findBuilding(name) {
  return aliases.get(normaliseBuildingName(name)) || null;
}
