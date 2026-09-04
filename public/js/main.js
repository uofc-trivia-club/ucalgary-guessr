// public/js/main.js

import {
  getRandomRound,
  submitGuess,
} from "./api.js";

import {
  setResultText,
  setResultCard,
  showGuessSelected,
  showGuessResult,
  enableLockButton,
  enableNextButton,
  setRoundTitle,
  setRoundProgress,
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

      if (!candidate || !Array.isArray(candidate.images)) {
        continue;
      }

      const newImages = getUnusedImages(candidate.images);

      if (newImages.length > 0) {
        round = {
          ...candidate,
          images: newImages,
        };

        filteredImages = newImages;
        break;
      }
    }

    // Fallback if we can't find unused images.
    if (!round) {
      console.warn(
        "Could not find a round with unused images after several attempts."
      );

      round = await getRandomRound();

      if (
        !round ||
        !Array.isArray(round.images) ||
        round.images.length === 0
      ) {
        setResultText("No images available.", "error");
        return;
      }

      filteredImages = round.images;
    }

    rememberImagesUsed(filteredImages);

    setRound(round);
    clearLastGuess();

    showRestartButton(false);
    updateScoreSummary(
      getTotalScore(),
      getRoundMaxScore()
    );

    loadCurrentImage();
  } catch (err) {
    console.error("loadRandomRound error:", err);

    setResultText(
      "Failed to load a round.",
      "error"
    );
  }
}

function loadCurrentImage() {
  const round = getCurrentRound();
  const imgInfo = getCurrentImage();

  if (!round || !imgInfo) {
    setResultText(
      "No images found in this round.",
      "error"
    );
    return;
  }

  const idx = round.images.findIndex(
    (img) => img.id === imgInfo.id
  );

  const currentNumber =
    idx >= 0 ? idx + 1 : 1;

  const total = round.images.length;

  setRoundTitle(
    `Round ${currentNumber} of ${total}`
  );

  setRoundProgress(
    currentNumber,
    total
  );

  setSceneImage(
    imgInfo.imagePath
  );

  setResultCard({
    kicker: "Your turn",
    primary: "Click the map to place your guess.",
    secondary:
      "You can move your marker before locking it in.",
    state: "prompt",
  });

  clearLastGuess();
  clearGuessAndAnswer();

  enableLockButton(false);
  enableNextButton(false);

  // The map may have changed dimensions
  // after the layout/image update.
  requestAnimationFrame(() => {
    invalidateMapSize();
  });
}

async function onLockGuess() {
  const round = getCurrentRound();

  if (!round) {
    return;
  }

  const lastGuess = getLastGuess();

  if (!lastGuess) {
    setResultCard({
      kicker: "No guess yet",
      primary: "Click the map first.",
      secondary:
        "Place a marker anywhere on campus, then make your guess.",
      state: "error",
    });

    return;
  }

  const imgInfo = getCurrentImage();

  if (!imgInfo) {
    return;
  }

  try {
    const result = await submitGuess(
      round.roundId,
      imgInfo.id,
      lastGuess
    );

    console.log(
      "Guess result:",
      result
    );

    const {
      distancePx,
      score,
      answer,
    } = result;

    addScore(score);

    updateScoreSummary(
      getTotalScore(),
      getRoundMaxScore()
    );

    showAnswerOnMap(answer);

    const last =
      isLastImage();

    const maxScore =
      getRoundMaxScore();

    showGuessResult({
      score,
      distancePx,
      totalScore: getTotalScore(),
      maxScore,
      isFinal: last,
    });

    enableLockButton(false);

    if (last) {
      enableNextButton(false);
      showRestartButton(true);
    } else {
      enableNextButton(true);
    }
  } catch (err) {
    console.error(
      "onLockGuess error:",
      err
    );

    setResultText(
      "Your guess could not be submitted.",
      "error"
    );
  }
}

function onNextImage() {
  const round =
    getCurrentRound();

  if (
    !round ||
    isLastImage()
  ) {
    return;
  }

  incrementImageIndex();
  loadCurrentImage();
}

function onRestart() {
  clearGuessAndAnswer();
  clearLastGuess();
  loadRandomRound();
}

// ---------- Bootstrapping ----------

window.addEventListener(
  "DOMContentLoaded",
  () => {
    initMap((xy) => {
      setLastGuess(xy);

      showGuessSelected();

      enableLockButton(true);
    });

    const lockBtn =
      document.getElementById(
        "make-guess-btn"
      );

    const nextBtn =
      document.getElementById(
        "next-image-btn"
      );

    const restartBtn =
      document.getElementById(
        "restart-btn"
      );

    if (lockBtn) {
      lockBtn.addEventListener(
        "click",
        onLockGuess
      );

      enableLockButton(false);
    }

    if (nextBtn) {
      nextBtn.addEventListener(
        "click",
        onNextImage
      );

      enableNextButton(false);
    }

    if (restartBtn) {
      restartBtn.addEventListener(
        "click",
        onRestart
      );

      showRestartButton(false);
    }

    window.addEventListener(
      "resize",
      () => {
        invalidateMapSize();
      }
    );

    loadRandomRound();
  }
);