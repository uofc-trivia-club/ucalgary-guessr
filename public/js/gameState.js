// public/js/gameState.js

const MAX_SCORE_PER_IMAGE = 5000;

let gameMode = "daily"; // "daily" | "weekly" | "random"
let currentUser = null;
let dailyChallenge = null;
let dailyCompleted = false;

let currentRound = null;
let currentIndex = 0;
let totalScore = 0;
let lastGuess = null;

const usedImagePaths = new Set();

// ---------- Mode ----------

export function setGameMode(mode) {
  if (!["daily", "weekly", "random"].includes(mode)) {
    throw new Error(`Unsupported game mode: ${mode}`);
  }
  gameMode = mode;
}

export function getGameMode() {
  return gameMode;
}

// ---------- Authentication ----------

export function setCurrentUser(user) {
  currentUser = user || null;
}

export function getCurrentUserState() {
  return currentUser;
}

// ---------- Daily challenge ----------

export function setDailyChallenge(challenge) {
  dailyChallenge = challenge || null;
  dailyCompleted = Boolean(challenge?.completed);
}

export function getDailyChallengeState() {
  return dailyChallenge;
}

export function setDailyCompleted(completed) {
  dailyCompleted = Boolean(completed);
}

export function isDailyCompleted() {
  return dailyCompleted;
}

// ---------- Round / image state ----------

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

// ---------- Scoring ----------

export function addScore(score) {
  totalScore += Number(score) || 0;
}

export function setTotalScore(score) {
  totalScore = Number(score) || 0;
}

export function getTotalScore() {
  return totalScore;
}

export function getRoundMaxScore() {
  if (!currentRound || !Array.isArray(currentRound.images)) return 0;
  return currentRound.images.length * MAX_SCORE_PER_IMAGE;
}

// ---------- Used random images ----------

export function getUnusedImages(images) {
  if (!Array.isArray(images)) return [];
  return images.filter(
    (img) => img && img.imagePath && !usedImagePaths.has(img.imagePath)
  );
}

export function rememberImagesUsed(images) {
  if (!Array.isArray(images)) return;
  for (const img of images) {
    if (img?.imagePath) usedImagePaths.add(img.imagePath);
  }
}

// ---------- Last guess ----------

export function setLastGuess(guess) {
  lastGuess = guess;
}

export function getLastGuess() {
  return lastGuess;
}

export function clearLastGuess() {
  lastGuess = null;
}

// ---------- Reset helpers ----------

export function resetRoundState() {
  currentRound = null;
  currentIndex = 0;
  totalScore = 0;
  lastGuess = null;
}

export function resetSession() {
  resetRoundState();
  dailyChallenge = null;
  dailyCompleted = false;
  usedImagePaths.clear();
}
