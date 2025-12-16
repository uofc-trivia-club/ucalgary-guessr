// server/utils/scoring.js

export function pixelDistance(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

export function scoreFromPixelDistance(d, maxScore = 5000, cutoff = 800) {
  const clamped = Math.min(d, cutoff);
  const fraction = 1 - clamped / cutoff;
  return Math.round(maxScore * Math.max(fraction, 0));
}
