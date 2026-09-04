// public/js/ui.js

function getResultElements() {
  return {
    card:
      document.getElementById(
        "result"
      ),

    kicker:
      document.getElementById(
        "result-kicker"
      ),

    primary:
      document.getElementById(
        "result-primary"
      ),

    secondary:
      document.getElementById(
        "result-secondary"
      ),
  };
}

export function setResultCard({
  kicker = "",
  primary = "",
  secondary = "",
  state = "prompt",
} = {}) {
  const {
    card,
    kicker: kickerEl,
    primary: primaryEl,
    secondary: secondaryEl,
  } = getResultElements();

  if (card) {
    card.dataset.state = state;
  }

  if (kickerEl) {
    kickerEl.textContent = kicker;
  }

  if (primaryEl) {
    primaryEl.textContent = primary;
  }

  if (secondaryEl) {
    secondaryEl.textContent =
      secondary;
  }
}

// Simple wrapper for generic
// status/error messages.
export function setResultText(
  text,
  state = "prompt"
) {
  const isError =
    state === "error";

  setResultCard({
    kicker: isError
      ? "Something went wrong"
      : "UCalgary Guessr",

    primary: text,
    secondary: "",
    state,
  });
}

export function showGuessSelected() {
  setResultCard({
    kicker: "Guess placed",
    primary:
      "Ready to lock it in?",
    secondary:
      "Click the map again if you want to adjust your marker.",
    state: "selected",
  });
}

export function showGuessResult({
  score,
  distancePx,
  totalScore,
  maxScore,
  isFinal,
}) {
  const scoreText =
    `${score.toLocaleString()} pts`;

  const distanceText =
    `${Math.round(
      distancePx
    ).toLocaleString()} px away`;

  const totalText =
    `${totalScore.toLocaleString()} / ${maxScore.toLocaleString()}`;

  setResultCard({
    kicker: isFinal
      ? "Round complete"
      : "Guess scored",

    primary: scoreText,

    secondary: isFinal
      ? `${distanceText} · Final score ${totalText}`
      : `${distanceText} · Total score ${totalText}`,

    state: "success",
  });
}

export function enableLockButton(
  enabled
) {
  const btn =
    document.getElementById(
      "make-guess-btn"
    );

  if (btn) {
    btn.disabled = !enabled;
  }
}

export function enableNextButton(
  enabled
) {
  const btn =
    document.getElementById(
      "next-image-btn"
    );

  if (btn) {
    btn.disabled = !enabled;
  }
}

export function setRoundTitle(
  text
) {
  const el =
    document.getElementById(
      "round-title"
    );

  if (el) {
    el.textContent = text;
  }
}

export function setRoundProgress(
  current,
  total
) {
  const el =
    document.getElementById(
      "round-progress"
    );

  if (!el) {
    return;
  }

  el.replaceChildren();

  for (
    let i = 1;
    i <= total;
    i++
  ) {
    const dot =
      document.createElement(
        "span"
      );

    dot.className =
      "progress-dot";

    if (i < current) {
      dot.classList.add(
        "complete"
      );
    } else if (i === current) {
      dot.classList.add(
        "current"
      );
    }

    el.appendChild(dot);
  }

  el.setAttribute(
    "aria-label",
    `Round ${current} of ${total}`
  );
}

export function setSceneImage(
  src
) {
  const img =
    document.getElementById(
      "scene-image"
    );

  if (!img) {
    return;
  }

  img.style.opacity = 0.2;

  // Remove this _ts param if
  // we use pre-signed URLs.
  const url =
    src +
    (
      src.includes("?")
        ? "&"
        : "?"
    ) +
    "_ts=" +
    Date.now();

  const preloader =
    new Image();

  preloader.onload = () => {
    img.src = url;
    img.style.opacity = 1;
  };

  preloader.onerror = (e) => {
    console.error(
      "Failed to load image",
      url,
      e
    );

    img.style.opacity = 1;

    setResultText(
      "Image failed to load. Try the next image.",
      "error"
    );
  };

  preloader.src = url;
}

export function updateScoreSummary(
  totalScore,
  maxScore
) {
  const el =
    document.getElementById(
      "score-summary"
    );

  if (!el) {
    return;
  }

  el.textContent =
    `${totalScore.toLocaleString()} / ${maxScore.toLocaleString()}`;
}

export function showRestartButton(
  show
) {
  const btn =
    document.getElementById(
      "restart-btn"
    );

  if (!btn) {
    return;
  }

  btn.style.display =
    show
      ? "inline-block"
      : "none";

  btn.disabled = !show;
}