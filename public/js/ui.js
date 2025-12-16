// public/js/ui.js

export function setResultText(text) {
  const el = document.getElementById("result");
  if (el) el.textContent = text;
}

export function enableLockButton(enabled) {
  const btn = document.getElementById("make-guess-btn");
  if (btn) btn.disabled = !enabled;
}

export function enableNextButton(enabled) {
  const btn = document.getElementById("next-image-btn");
  if (btn) btn.disabled = !enabled;
}

export function setRoundTitle(text) {
  const el = document.getElementById("round-title");
  if (el) el.textContent = text;
}

export function setSceneImage(src) {
  const img = document.getElementById("scene-image");
  if (!img) return;

  img.style.opacity = 0.2;

  // Remove this _ts param if we use pre-signed URLs
  const url = src + (src.includes("?") ? "&" : "?") + "_ts=" + Date.now();

  const preloader = new Image();

  preloader.onload = () => {
    img.src = url;
    img.style.opacity = 1;
  };

  preloader.onerror = (e) => {
    console.error("Failed to load image", url, e);
    img.style.opacity = 1;
    setResultText("Image failed to load. Click “Next image” to try another.");
  };

  preloader.src = url;
}

export function updateScoreSummary(totalScore, maxScore) {
  const el = document.getElementById("score-summary");
  if (!el) return;
  el.textContent = `Total score: ${totalScore} / ${maxScore}`;
}

export function showRestartButton(show) {
  const btn = document.getElementById("restart-btn");
  if (!btn) return;
  btn.style.display = show ? "inline-block" : "none";
  btn.disabled = !show;
}
