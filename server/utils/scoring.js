// server/utils/scoring.js

const EARTH_RADIUS_METRES = 6_371_000;

function toRadians(degrees) {
  return (degrees * Math.PI) / 180;
}

export function distanceMetres(a, b) {
  const lat1 = toRadians(a.latitude);
  const lat2 = toRadians(b.latitude);
  const deltaLat = toRadians(b.latitude - a.latitude);
  const deltaLon = toRadians(b.longitude - a.longitude);

  const haversine =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) ** 2;

  return 2 * EARTH_RADIUS_METRES * Math.asin(Math.sqrt(haversine));
}

export function scoreFromDistanceMetres(
  distance,
  maxScore = 5000,
  cutoffMetres = 1000
) {
  const clamped = Math.min(Math.max(distance, 0), cutoffMetres);
  const scaleMetres = cutoffMetres / 5;
  const floor = Math.exp(-cutoffMetres / scaleMetres);
  const fraction = (Math.exp(-clamped / scaleMetres) - floor) / (1 - floor);
  return Math.round(maxScore * fraction);
}
