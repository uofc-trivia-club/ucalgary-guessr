// public/js/gameState.js

// How many points each perfect guess is worth
const MAX_SCORE_PER_IMAGE = 5000;

// Core state
let currentRound = null;     // { roundId, name, images: [...] }
let currentIndex = 0;        // 0..images.length-1
let totalScore = 0;

// Track images already shown this browser session
const usedImagePaths = new Set();

// Track the last guess in image coordinates { x, y }
let lastGuess = null;

// ---- Round / image state ----

export function setRound(round) {
  currentRound = round;
  currentIndex = 0;
  totalScore = 0;
}

export function getCurrentRound() {
  return currentRound;
}

export function getCurrentIndex() {
  return currentIndex;
}

export function getCurrentImage() {
  if (!currentRound || !Array.isArray(currentRound.images)) return null;
  return currentRound.images[currentIndex] || null;
}

export function incrementImageIndex() {
  currentIndex += 1;
}

export function isLastImage() {
  if (!currentRound || !Array.isArray(currentRound.images)) return true;
  return currentIndex >= currentRound.images.length - 1;
}

// ---- Scoring ----

export function addScore(score) {
  totalScore += score;
}

export function getTotalScore() {
  return totalScore;
}

export function getRoundMaxScore() {
  if (!currentRound || !Array.isArray(currentRound.images)) return 0;
  return currentRound.images.length * MAX_SCORE_PER_IMAGE;
}

// ---- Used images ----

export function getUnusedImages(images) {
  if (!Array.isArray(images)) return [];
  return images.filter(
    (img) => img && img.imagePath && !usedImagePaths.has(img.imagePath)
  );
}

export function rememberImagesUsed(images) {
  if (!Array.isArray(images)) return;
  images.forEach((img) => {
    if (img && img.imagePath) {
      usedImagePaths.add(img.imagePath);
    }
  });
}

// ---- Last guess ----

export function setLastGuess(guess) {
  // guess is { x, y } in image coordinates
  lastGuess = guess;
}

export function getLastGuess() {
  return lastGuess;
}

export function clearLastGuess() {
  lastGuess = null;
}

// ---- Full restart ----

export function resetSession() {
  currentRound = null;
  currentIndex = 0;
  totalScore = 0;
  lastGuess = null;
  usedImagePaths.clear();
}
