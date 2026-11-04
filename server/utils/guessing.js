// server/utils/guessing.js

import { distanceMetres, scoreFromDistanceMetres } from "./scoring.js";
import { findBuilding, normaliseBuildingName } from "./buildings.js";

export { normaliseBuildingName } from "./buildings.js";

function validCoordinate(value, min, max) {
  return typeof value === "number" && Number.isFinite(value) && value >= min && value <= max;
}

export function readGuess(body) {
  const value = body?.guess ?? body;
  if (!value || typeof value !== "object") return null;

  const latitude = value.latitude;
  const longitude = value.longitude;
  if (!validCoordinate(latitude, -90, 90) || !validCoordinate(longitude, -180, 180)) {
    return null;
  }

  if (value.type === "building") {
    const buildingName = typeof value.buildingName === "string" ? value.buildingName.trim() : "";
    if (!buildingName || buildingName.length > 160) return null;

    const buildingId = typeof value.buildingId === "string" ? value.buildingId.trim().slice(0, 200) : null;
    const buildingLayerId = typeof value.buildingLayerId === "string"
      ? value.buildingLayerId.trim().slice(0, 200)
      : null;

    return {
      type: "building",
      buildingId: buildingId || null,
      buildingName,
      buildingLayerId: buildingLayerId || null,
      latitude,
      longitude,
    };
  }

  if (value.type === undefined || value.type === "point") {
    return { type: "point", latitude, longitude };
  }

  return null;
}

export function answerFromPhoto(photo) {
  const building = findBuilding(photo.answer_building_name);
  return {
    type: photo.answer_building_name ? "building" : "point",
    latitude: building?.latitude ?? photo.answer_building_latitude ?? photo.answer_latitude,
    longitude: building?.longitude ?? photo.answer_building_longitude ?? photo.answer_longitude,
    ...(photo.answer_building_name
      ? { buildingName: building?.name ?? photo.answer_building_name }
      : {}),
  };
}

export function scoreGuess(guess, photo) {
  const answer = answerFromPhoto(photo);
  const guessedBuilding = guess.type === "building" ? findBuilding(guess.buildingName) : null;
  const correctBuilding = findBuilding(photo.answer_building_name);
  if (guessedBuilding) {
    guess = { ...guess, buildingId: guessedBuilding.id, buildingName: guessedBuilding.name,
      latitude: guessedBuilding.latitude, longitude: guessedBuilding.longitude };
  }
  const answerName = normaliseBuildingName(answer.buildingName);
  const exactBuilding = Boolean(
    answerName &&
    guess.type === "building" &&
    (guessedBuilding && correctBuilding
      ? guessedBuilding.id === correctBuilding.id
      : normaliseBuildingName(guess.buildingName) === answerName)
  );

  if (exactBuilding) {
    return {
      distanceMetres: 0,
      score: 5000,
      exactBuilding: true,
      answer,
      guess,
    };
  }

  const distance = distanceMetres(guess, answer);
  return {
    distanceMetres: distance,
    score: Math.min(answer.buildingName ? 4999 : 5000, scoreFromDistanceMetres(distance)),
    exactBuilding: false,
    answer,
    guess,
  };
}
