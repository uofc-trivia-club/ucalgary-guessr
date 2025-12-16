// public/js/main.js

import { 
  getRandomRound, 
  submitGuess 
} from "./api.js";
import {
  setResultText,
  enableLockButton,
  enableNextButton,
  setRoundTitle,
  setSceneImage,
  updateScoreSummary,
  showRestartButton,
} from "./ui.js";
import {
  getUnusedImages,
  rememberImagesUsed,
  setRound,
  getCurrentRound,
  getCurrentImage,
  incrementImageIndex,
  isLastImage,
  addScore,
  getTotalScore,
  getRoundMaxScore,
  setLastGuess,
  getLastGuess,
  clearLastGuess,
} from "./gameState.js";
import {
  initMap,
  clearGuessAndAnswer,
  showAnswerOnMap,
  invalidateMapSize,
} from "./map.js";

// ---------- Game flow ----------

async function loadRandomRound() {
  try {
    const MAX_TRIES = 10;
    let round = null;
    let filteredImages = [];

    for (let attempt = 0; attempt < MAX_TRIES; attempt++) {
      const candidate = await getRandomRound();
      if (!candidate || !Array.isArray(candidate.images)) continue;

      const newImages = getUnusedImages(candidate.images);
      if (newImages.length > 0) {
        round = { ...candidate, images: newImages };
        filteredImages = newImages;
        break;
      }
    }

    // Fallback if we can't find any unused images
    if (!round) {
      console.warn(
        "Could not find a round with unused images after several attempts."
      );
      round = await getRandomRound();
      if (!round || !Array.isArray(round.images) || round.images.length === 0) {
        setResultText("No images available.");
        return;
      }
      filteredImages = round.images;
    }

    rememberImagesUsed(filteredImages);
    setRound(round);
    clearLastGuess();
    showRestartButton(false);
    updateScoreSummary(getTotalScore(), getRoundMaxScore());

    loadCurrentImage();
  } catch (err) {
    console.error("loadRandomRound error:", err);
    setResultText("Failed to load round.");
  }
}

function loadCurrentImage() {
  const round = getCurrentRound();
  const imgInfo = getCurrentImage();

  if (!round || !imgInfo) {
    setResultText("No images found in this round.");
    return;
  }

  // compute "Round X/Y"
  const idx = round.images.findIndex((img) => img.id === imgInfo.id);
  const currentNumber = idx >= 0 ? idx + 1 : 1;
  const total = round.images.length;
  setRoundTitle(`Round ${currentNumber}/${total}`);

  setSceneImage(imgInfo.imagePath);
  setResultText("Click on the map to place your guess.");
  clearLastGuess();
  clearGuessAndAnswer();
  enableLockButton(false);
  enableNextButton(false);
}

async function onLockGuess() {
  const round = getCurrentRound();
  if (!round) return;

  const lastGuess = getLastGuess();
  if (!lastGuess) {
    setResultText("Click on the map to place a guess first.");
    return;
  }

  const imgInfo = getCurrentImage();
  if (!imgInfo) return;

  try {
    const result = await submitGuess(round.roundId, imgInfo.id, lastGuess);
    console.log("Guess result:", result);

    const { distancePx, score, answer } = result;
    addScore(score);
    updateScoreSummary(getTotalScore(), getRoundMaxScore());

    // Show markers + line on the map
    showAnswerOnMap(answer);

    const last = isLastImage();
    const maxScore = getRoundMaxScore();

    let message = `You were ${distancePx.toFixed(
      0
    )} pixels away and scored ${score} points.`;

    if (last) {
      message += ` Round complete! Final score: ${getTotalScore()} / ${maxScore}. Thanks for playing 🎉`;
    }

    setResultText(message);

    enableLockButton(false);

    if (last) {
      enableNextButton(false);
      showRestartButton(true);
    } else {
      enableNextButton(true);
    }
  } catch (err) {
    console.error("onLockGuess error:", err);
    setResultText("Error submitting guess.");
  }
}

function onNextImage() {
  const round = getCurrentRound();
  if (!round) return;

  if (isLastImage()) return;

  incrementImageIndex();
  loadCurrentImage();
}

function onRestart() {
  clearGuessAndAnswer();
  clearLastGuess();
  setResultText("");
  loadRandomRound();
}

// ---------- Bootstrapping ----------

window.addEventListener("DOMContentLoaded", () => {
  // Initialise map and wire click → lastGuess
  initMap((xy) => {
    setLastGuess(xy);
    setResultText(
      `Guess at x=${xy.x.toFixed(0)}, y=${xy.y.toFixed(0)}.`
    );
    enableLockButton(true);
  });

  const lockBtn = document.getElementById("make-guess-btn");
  const nextBtn = document.getElementById("next-image-btn");
  const restartBtn = document.getElementById("restart-btn");
  const layout = document.getElementById("layout");
  const mapPanel = document.getElementById("map-panel");

  if (lockBtn) {
    lockBtn.addEventListener("click", onLockGuess);
    enableLockButton(false);
  }

  if (nextBtn) {
    nextBtn.addEventListener("click", onNextImage);
    enableNextButton(false);
  }

  if (restartBtn) {
    restartBtn.addEventListener("click", onRestart);
    showRestartButton(false);
  }

  // Hover-to-grow map
  if (layout && mapPanel) {
    mapPanel.addEventListener("mouseenter", () => {
      layout.classList.add("map-big");
      setTimeout(() => {
        invalidateMapSize();
      }, 260);
    });

    mapPanel.addEventListener("mouseleave", () => {
      layout.classList.remove("map-big");
      setTimeout(() => {
        invalidateMapSize();
      }, 260);
    });
  }

  loadRandomRound();
});
