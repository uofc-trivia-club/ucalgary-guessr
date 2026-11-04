// public/js/ui.js

let sceneImageRequest = 0;
let dailyShareText = "";
let dailyDate = "";
let challengeEndDate = "";
let challengeMode = "daily";
let signedIn = false;

function el(id) {
  return document.getElementById(id);
}

let gameplayView = "photo";
const mobileGameplay = window.matchMedia("(max-width: 820px)");

export function setGameplayView(view) {
  gameplayView = view;
  const mobile = mobileGameplay.matches;
  for (const name of ["photo", "map"]) {
    const tab = el(`${name}-tab`);
    const panel = el(name === "photo" ? "image-panel" : "map-panel");
    const selected = name === view;
    if (tab) {
      tab.setAttribute("aria-selected", String(selected));
      tab.tabIndex = selected ? 0 : -1;
    }
    if (panel) {
      panel.hidden = mobile && !selected;
      if (mobile) {
        panel.setAttribute("role", "tabpanel");
        panel.setAttribute("aria-labelledby", `${name}-tab`);
        panel.tabIndex = 0;
      } else {
        panel.removeAttribute("role");
        panel.removeAttribute("aria-labelledby");
        panel.removeAttribute("tabindex");
      }
    }
  }
  // A narrow viewport already dedicates all available panel space to the map.
  if (mobile) setMapExpanded(false);
}

export function initialiseGameplayTabs() {
  const names = ["photo", "map"];
  for (const name of names) {
    const tab = el(`${name}-tab`);
    tab?.addEventListener("click", () => setGameplayView(name));
    tab?.addEventListener("keydown", (event) => {
      let next;
      if (event.key === "Home") next = "photo";
      else if (event.key === "End") next = "map";
      else if (["ArrowLeft", "ArrowRight"].includes(event.key)) next = name === "photo" ? "map" : "photo";
      else return;
      event.preventDefault();
      setGameplayView(next);
      el(`${next}-tab`)?.focus();
    });
  }
  mobileGameplay.addEventListener("change", () => setGameplayView(gameplayView));
  setGameplayView(gameplayView);
}

export function setSelectedLocation(guess = null) {
  const location = el("selected-location");
  const hint = el("selection-hint");
  if (location) location.textContent = guess?.type === "building"
    ? guess.buildingName : guess ? "Map location selected" : "No location selected";
  if (hint) hint.textContent = guess
    ? "Adjust your selection before submitting."
    : "Select a building or place a pin on the map.";
}

function formatScore(value) {
  return Number(value || 0).toLocaleString();
}

function setDailyShareScore(score = null) {
  dailyShareText = "";
  const container = el("daily-share");
  if (container) container.hidden = true;
  const status = el("daily-share-status");
  if (status) status.textContent = "";
  const text = el("daily-share-text");
  if (text) {
    text.hidden = true;
    text.value = "";
  }

  if (score === null || score === undefined) return;
  const points = Number(score);
  if (!Number.isFinite(points) || points < 0 || points > 5000) return;
  const redCount = Math.floor(points / 1000);
  const period = challengeMode === "weekly"
    ? "Weekly " + formatWeeklyRange(dailyDate, challengeEndDate)
    : dailyDate ? new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" })
      .format(new Date(dailyDate + "T00:00:00Z")) : "";
  dailyShareText = `UCalgaryGuessr${period ? " " + period : ""}\n${points.toLocaleString("en-US")} / 5,000 ${"🔴".repeat(redCount)}${"🟡".repeat(5 - redCount)}\nucalgaryguessr.ca`;
  if (container) container.hidden = false;
}

export async function copyDailyScore() {
  if (!dailyShareText) return;
  const scoreText = dailyShareText;
  const status = el("daily-share-status");
  const text = el("daily-share-text");
  try {
    await navigator.clipboard.writeText(scoreText);
    if (scoreText !== dailyShareText) return;
    if (status) status.textContent = "Score copied!";
    if (text) text.hidden = true;
  } catch {
    if (scoreText !== dailyShareText) return;
    if (status) status.textContent = "Couldn't copy automatically. Select and copy your score below.";
    if (text) {
      text.value = scoreText;
      text.hidden = false;
      text.focus();
      text.select();
    }
  }
}

export function formatElapsedTime(milliseconds) {
  if (!Number.isFinite(milliseconds) || milliseconds < 0) return "—";
  const seconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  return `${String(minutes).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

export function setStopwatch(milliseconds = null) {
  const row = el("daily-stopwatch");
  if (row) row.hidden = milliseconds === null;
  const value = el("stopwatch-value");
  if (value && milliseconds !== null) value.textContent = formatElapsedTime(milliseconds);
}

export function showPageView(view) {
  const views = {
    landing: el("landing-view"),
    game: el("game-view"),
    reset: el("reset-view"),
  };

  for (const [name, node] of Object.entries(views)) {
    if (node) node.hidden = name !== view;
  }

  document.body.dataset.view = view;
}

export function setLandingStatus(message = "", isError = false) {
  const target = el("landing-status");
  if (!target) return;
  target.textContent = message;
  target.style.color = isError ? "var(--error)" : "var(--success)";
}

function formatDailyDate(dateString) {
  if (!dateString) return "Daily challenge";

  const [year, month, day] = dateString.split("-").map(Number);
  if (![year, month, day].every(Number.isFinite)) return dateString;

  return new Intl.DateTimeFormat("en-CA", {
    month: "long",
    day: "numeric",
  }).format(new Date(year, month - 1, day));
}

function formatWeeklyRange(date, endDate = "") {
  if (!date) return "";
  const start = new Date(date + "T00:00:00Z");
  const end = endDate ? new Date(endDate + "T00:00:00Z") : new Date(start.getTime() + 7 * 86400000);
  const format = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  return format.format(start) + " – " + format.format(end);
}

function currentChallengeTitle() {
  if (challengeMode === "weekly") return "Weekly Challenge" + (dailyDate ? " · " + formatWeeklyRange(dailyDate, challengeEndDate) : "");
  return "Daily Challenge" + (dailyDate ? " · " + formatDailyDate(dailyDate) : "");
}

export function setGamePageMode(mode, date = "", endDate = "") {
  challengeMode = mode;
  const scheduled = mode === "daily" || mode === "weekly";
  const label = el("mode-label");
  const title = el("game-page-title");
  if (label) label.textContent = mode === "weekly" ? "Weekly" : mode === "daily" ? "Daily" : "Play";
  dailyDate = scheduled ? date : "";
  challengeEndDate = scheduled ? endDate : "";
  document.body.dataset.gameMode = mode;
  if (title) title.textContent = scheduled ? currentChallengeTitle() : "Random game";
}

export function setResultCard({
  kicker = "",
  primary = "",
  secondary = "",
  state = "prompt",
} = {}) {
  const card = el("result");
  const kickerEl = el("result-kicker");
  const primaryEl = el("result-primary");
  const secondaryEl = el("result-secondary");

  setDailyShareScore();
  if (card) {
    card.dataset.state = state;
    card.dataset.perfect = "false";
    card.dataset.celebrate = "false";
  }
  document.body.dataset.dailyCompleted = "false";
  if (el("result-feedback-block")) el("result-feedback-block").hidden = true;
  if (el("result-time-row")) el("result-time-row").hidden = true;
  if (el("result-ranking-row")) el("result-ranking-row").hidden = true;
  if (el("daily-guest-note")) el("daily-guest-note").hidden = true;
  if (el("map-result-legend")) el("map-result-legend").hidden = true;
  el("map-legend-btn")?.setAttribute("aria-expanded", "false");
  const panel = el("status-panel");
  if (panel) panel.hidden = state !== "success" && state !== "error";
  if (el("result-details")) el("result-details").hidden = true;
  if (state !== "success" && el("map-result-summary")) el("map-result-summary").hidden = true;
  if (el("game-view")) el("game-view").dataset.resultState = state;
  if (kickerEl) kickerEl.textContent = kicker;
  if (primaryEl) primaryEl.textContent = primary;
  if (secondaryEl) secondaryEl.textContent = secondary;
  const announcement = el("game-announcement");
  if (announcement) announcement.textContent = state === "error" ? primary : "";
}

export function setResultText(text, state = "prompt", secondary = "") {
  setResultCard({
    kicker: state === "error" ? "Something went wrong" : "UCalgaryGuessr",
    primary: text,
    secondary,
    state,
  });
}

export function showGuessSelected(guess) {
  setSelectedLocation(guess);
  if (guess?.type === "building") {
    setResultCard({
      kicker: "Building selected",
      primary: `${guess.buildingName} selected.`,
      secondary: "Click elsewhere to change your guess, or press Submit guess to submit.",
      state: "selected",
    });
    return;
  }

  setResultCard({
    kicker: "Location selected",
    primary: "Location selected.",
    secondary: "Click elsewhere to change your guess, or press Submit guess to submit.",
    state: "selected",
  });
}

export function showGuessResult({
  score,
  distanceMetres,
  totalScore,
  maxScore,
  isFinal,
  rank = null,
  daily = false,
  saved = false,
  elapsedMs = null,
  guess = null,
  answer = null,
  exactBuilding = false,
  focusResult = false,
  animate = false,
}) {
  const perfect = Number(score) === 5000;
  const exactMatch = Boolean(guess && answer && (exactBuilding ||
    (perfect && distanceMetres === 0)));
  const feedback = perfect ? exactMatch ? "Perfect guess!" : "Perfect score!" : "Good attempt!";
  const scoreText = daily ? `${formatScore(score)} / 5,000` : `${formatScore(score)} pts`;
  const details = [];

  if (!daily && isFinal) {
    details.push(`Final score ${formatScore(totalScore)} / ${formatScore(maxScore)}`);
  }
  if (!guess) details.push("The original guess was not recorded for this older attempt.");

  setResultCard({
    kicker: daily ? currentChallengeTitle()
      : isFinal ? "Round complete" : "Photo result",
    primary: scoreText,
    secondary: details.join(" · "),
    state: "success",
  });
  const card = el("result");
  if (card) {
    card.dataset.perfect = String(perfect);
    card.dataset.celebrate = String(perfect && animate && !window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }
  if (el("result-feedback-block")) el("result-feedback-block").hidden = false;
  if (el("result-feedback")) el("result-feedback").textContent = feedback;
  if (el("result-feedback-detail")) el("result-feedback-detail").textContent = perfect && exactMatch
    ? "You know campus well :)" : "";
  if (daily) {
    document.body.dataset.dailyCompleted = "true";
    setDailyShareScore(score);
    if (el("result-time-row")) el("result-time-row").hidden = false;
    if (el("result-ranking-row")) el("result-ranking-row").hidden = false;
    if (el("result-time")) el("result-time").textContent = formatElapsedTime(elapsedMs);
    if (el("result-ranking")) el("result-ranking").textContent = saved
      ? `${Number.isInteger(rank) && rank > 0 ? `#${rank} · ` : ""}Score saved`
      : signedIn ? "Unranked" : "Guest · Unranked";
    if (el("daily-guest-note")) el("daily-guest-note").hidden = saved;
    const name = challengeMode === "weekly" ? "Weekly" : "Daily";
    if (el("daily-guest-message")) el("daily-guest-message").textContent = signedIn
      ? `This attempt stays unranked. Your next ${name} can count toward the leaderboard.`
      : `This attempt is unranked. Sign in before playing future ${name} challenges to compete.`;
    if (el("result-login-btn")) el("result-login-btn").textContent = challengeMode === "weekly"
      ? "Sign in for future Weeklies" : "Sign in for future Dailies";
    if (el("result-login-btn")) el("result-login-btn").hidden = signedIn;
  }
  const guessText = guess ? guess.buildingName || "Map pin" : "Not recorded";
  const answerText = answer?.buildingName || "Photo location";
  const distanceText = Number.isFinite(distanceMetres) ? `${Math.round(distanceMetres).toLocaleString()} m` : "Not recorded";
  if (el("result-guess")) el("result-guess").textContent = guessText;
  if (el("result-answer")) el("result-answer").textContent = answer?.buildingName || "Photo location";
  if (el("result-guess-row")) el("result-guess-row").hidden = exactMatch;
  if (el("result-answer-label")) el("result-answer-label").textContent = exactMatch ? "Exact match" : "Correct location";
  if (el("result-distance")) el("result-distance").textContent = Number.isFinite(distanceMetres)
    ? `${distanceText} away` : distanceText;
  if (el("result-details")) el("result-details").hidden = false;
  if (el("map-result-guess")) el("map-result-guess").textContent = guessText;
  if (el("map-result-answer")) el("map-result-answer").textContent = answerText;
  if (el("map-result-distance")) el("map-result-distance").textContent = Number.isFinite(distanceMetres)
    ? `${distanceText} apart` : "Distance not recorded";
  const coincident = guess && answer && Math.abs(guess.latitude - answer.latitude) < 1e-8 &&
    Math.abs(guess.longitude - answer.longitude) < 1e-8;
  if (el("map-result-summary")) el("map-result-summary").hidden = Boolean(coincident);
  if (mobileGameplay.matches) setGameplayView("map");
  if (el("game-announcement")) el("game-announcement").textContent = `${feedback} ${scoreText}. ${distanceText}.`;
  if (focusResult && [document.body, el("make-guess-btn")].includes(document.activeElement)) {
    el("result-primary")?.focus({ preventScroll: true });
  }
}

export function showCompletedDaily({ score, rank = null, saved = true, elapsedMs = null,
  guess = null, answer = null, distanceMetres = null, exactBuilding = false } = {}) {
  showGuessResult({ score, rank, saved, elapsedMs, guess, answer, distanceMetres,
    exactBuilding, totalScore: score, maxScore: 5000, isFinal: true, daily: true });
  if (!answer && el("result-answer")) el("result-answer").textContent = "Not recorded";
}

export function enableLockButton(enabled) {
  const button = el("make-guess-btn");
  if (button) button.disabled = !enabled;
}

export function enableNextButton(enabled) {
  const button = el("next-image-btn");
  if (button) button.disabled = !enabled;
}

export function showNextButton(show) {
  const button = el("next-image-btn");
  if (button) button.hidden = !show;
}

export function showRestartButton(show) {
  const button = el("restart-btn");
  if (button) {
    button.hidden = !show;
    button.disabled = !show;
  }
}

export function setRoundTitle(text) {
  const target = el("round-title");
  if (!target) return;

  target.textContent = text || "";

  const heading = target.closest(".round-heading");
  if (heading) heading.hidden = !text;
}

export function setRoundProgress(current, total) {
  const container = el("round-progress");
  if (!container) return;

  container.replaceChildren();

  if (total <= 1) {
    container.setAttribute("aria-hidden", "true");
    return;
  }

  container.setAttribute("aria-hidden", "false");

  for (let i = 1; i <= total; i += 1) {
    const dot = document.createElement("span");
    dot.className = "progress-dot";

    if (i < current) dot.classList.add("complete");
    else if (i === current) dot.classList.add("current");

    container.appendChild(dot);
  }

  container.setAttribute("aria-label", `Photo ${current} of ${total}`);
}

let sceneZoom = 1;
let scenePanX = 0;
let scenePanY = 0;
const zoomFrames = new WeakSet();
let sceneDrag = null;

function stopScenePan() {
  if (!sceneDrag) return;
  const { frame, pointerId } = sceneDrag;
  sceneDrag = null;
  frame.classList.remove("is-panning");
  if (frame.hasPointerCapture(pointerId)) frame.releasePointerCapture(pointerId);
}

function applySceneTransform(image, frame) {
  // Keep enlarged image edges from exposing new empty space inside the frame.
  const maxX = Math.max(0, (image.offsetWidth * sceneZoom - frame.clientWidth) / 2);
  const maxY = Math.max(0, (image.offsetHeight * sceneZoom - frame.clientHeight) / 2);
  scenePanX = Math.max(-maxX, Math.min(maxX, scenePanX));
  scenePanY = Math.max(-maxY, Math.min(maxY, scenePanY));
  image.style.setProperty("--photo-zoom", String(sceneZoom));
  image.style.setProperty("--photo-pan-x", scenePanX + "px");
  image.style.setProperty("--photo-pan-y", scenePanY + "px");
  frame.classList.toggle("is-zoomed", sceneZoom > 1);
}

function resetSceneZoom() {
  stopScenePan();
  sceneZoom = 1;
  scenePanX = 0;
  scenePanY = 0;
  const image = el("scene-image");
  image?.closest(".scene-frame")?.classList.remove("is-zoomed");
  for (const property of ["--photo-zoom", "--photo-pan-x", "--photo-pan-y"]) {
    image?.style.removeProperty(property);
  }
}

export function initialiseSceneZoom() {
  const frame = el("scene-image")?.closest(".scene-frame");
  const image = el("scene-image");
  if (!frame || !image || zoomFrames.has(frame)) return;
  zoomFrames.add(frame);
  frame.addEventListener("wheel", event => {
    // Preserve browser zoom gestures and ignore unloaded photos/horizontal scrolling.
    if (event.ctrlKey || !event.deltaY || image.hidden || !image.getAttribute("src")) return;
    event.preventDefault();
    stopScenePan();
    const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? frame.clientHeight : 1;
    const delta = Math.max(-300, Math.min(300, event.deltaY * unit));
    const nextZoom = Math.max(1, Math.min(4, sceneZoom * Math.exp(-delta * 0.002)));
    const bounds = frame.getBoundingClientRect();
    const x = event.clientX - (bounds.left + bounds.width / 2);
    const y = event.clientY - (bounds.top + bounds.height / 2);
    const ratio = nextZoom / sceneZoom;
    scenePanX = x - (x - scenePanX) * ratio;
    scenePanY = y - (y - scenePanY) * ratio;
    sceneZoom = nextZoom;
    applySceneTransform(image, frame);
  }, { passive: false });
  frame.addEventListener("pointerdown", event => {
    if (event.button !== 0 || !event.isPrimary || sceneDrag || sceneZoom <= 1 || image.hidden || !image.getAttribute("src")) return;
    event.preventDefault();
    sceneDrag = { frame, pointerId: event.pointerId, x: event.clientX, y: event.clientY, panX: scenePanX, panY: scenePanY };
    frame.setPointerCapture(event.pointerId);
    frame.classList.add("is-panning");
  });
  frame.addEventListener("pointermove", event => {
    if (!sceneDrag || sceneDrag.pointerId !== event.pointerId) return;
    scenePanX = sceneDrag.panX + event.clientX - sceneDrag.x;
    scenePanY = sceneDrag.panY + event.clientY - sceneDrag.y;
    applySceneTransform(image, frame);
  });
  for (const type of ["pointerup", "pointercancel", "lostpointercapture"]) {
    frame.addEventListener(type, event => {
      if (sceneDrag?.pointerId === event.pointerId) stopScenePan();
    });
  }
  window.addEventListener("blur", stopScenePan);
  window.addEventListener("resize", resetSceneZoom);
}

export function setSceneImage(src, { loading = false } = {}) {
  const img = el("scene-image");
  const placeholder = el("scene-placeholder");
  if (!img) return;

  resetSceneZoom();
  const request = ++sceneImageRequest;
  img.hidden = true;
  img.removeAttribute("src");
  img.setAttribute("aria-busy", String(Boolean(src)));

  function showPlaceholder(isLoading) {
    if (!placeholder) return;
    placeholder.hidden = false;
    placeholder.textContent = isLoading ? "Image loading" : "No image available.";
    placeholder.classList.toggle("is-loading", isLoading);
    placeholder.setAttribute("role", "status");
    placeholder.setAttribute("aria-busy", String(isLoading));
  }

  if (!src) {
    img.hidden = true;
    img.removeAttribute("src");
    showPlaceholder(loading);
    img.setAttribute("aria-busy", String(loading));
    return;
  }

  showPlaceholder(true);

  const preloader = new Image();

  const onError = (error) => {
    if (request !== sceneImageRequest) return;
    console.error("Failed to load image", src, error);
    img.hidden = true;
    img.setAttribute("aria-busy", "false");
    showPlaceholder(false);
    setResultText("Image failed to load.", "error");
  };

  preloader.onload = async () => {
    try {
      await preloader.decode();
    } catch (error) {
      onError(error);
      return;
    }
    if (request !== sceneImageRequest) return;
    img.style.setProperty("--photo-aspect", String(preloader.naturalWidth / preloader.naturalHeight));
    img.src = src;
    img.style.opacity = 1;
    img.hidden = false;
    img.setAttribute("aria-busy", "false");
    if (placeholder) {
      placeholder.hidden = true;
      placeholder.classList.remove("is-loading");
      placeholder.setAttribute("aria-busy", "false");
    }
  };

  preloader.onerror = onError;
  preloader.src = src;
}

export function updateScoreSummary(totalScore, maxScore) {
  const target = el("score-summary");
  if (!target) return;
  target.textContent = `${formatScore(totalScore)} / ${formatScore(maxScore)}`;
}

export function setMapExpanded(expanded) {
  const layout = el("layout");
  const button = el("map-expand-btn");
  if (!layout || !button) return;

  layout.classList.toggle("map-expanded", expanded);
  button.classList.toggle("is-expanded", expanded);
  button.setAttribute("aria-pressed", String(expanded));

  const label = expanded ? "Shrink map" : "Expand map";
  button.setAttribute("aria-label", label);
  button.setAttribute("title", label);
}

// ---------- Authentication UI ----------

export function setAuthUI(user) {
  signedIn = Boolean(user);
  const status = el("user-status");
  const loginButton = el("login-btn");
  const signupButton = el("signup-btn");
  const logoutButton = el("logout-btn");

  if (user) {
    if (status) status.textContent = `Logged in as ${user.username}`;
    if (loginButton) loginButton.hidden = true;
    if (signupButton) signupButton.hidden = true;
    if (logoutButton) logoutButton.hidden = false;
  } else {
    if (status) status.textContent = "Playing as guest";
    if (loginButton) loginButton.hidden = false;
    if (signupButton) signupButton.hidden = false;
    if (logoutButton) logoutButton.hidden = true;
  }
}

export function openAuthDialog(mode = "login") {
  const dialog = el("auth-dialog");
  if (!dialog) return;
  setAuthDialogMode(mode);
  setAuthMessage("");
  if (!dialog.open) dialog.showModal();
}

export function closeAuthDialog() {
  const dialog = el("auth-dialog");
  if (dialog?.open) dialog.close();
}

export function setAuthDialogMode(mode) {
  const login = mode === "login";
  const signup = mode === "signup";
  const magic = mode === "magic";
  const forgot = mode === "forgot";

  const loginView = el("auth-login-view");
  const signupForm = el("signup-form");
  const magicForm = el("magic-link-form");
  const forgotForm = el("forgot-password-form");
  const loginTab = el("auth-login-tab");
  const signupTab = el("auth-signup-tab");

  if (loginView) loginView.hidden = !login;
  if (signupForm) signupForm.hidden = !signup;
  if (magicForm) magicForm.hidden = !magic;
  if (forgotForm) forgotForm.hidden = !forgot;

  if (loginTab) {
    loginTab.classList.toggle("active", login || magic || forgot);
    loginTab.setAttribute("aria-selected", String(login || magic || forgot));
  }

  if (signupTab) {
    signupTab.classList.toggle("active", signup);
    signupTab.setAttribute("aria-selected", String(signup));
  }

  setAuthMessage("");
}

export function setAuthMessage(message, isError = true) {
  const target = el("auth-message");
  if (!target) return;
  target.textContent = message || "";
  target.style.color = isError ? "var(--error)" : "var(--success)";
}

export function setResetMessage(message, isError = true) {
  const target = el("reset-message");
  if (!target) return;
  target.textContent = message || "";
  target.style.color = isError ? "var(--error)" : "var(--success)";
}

// ---------- Leaderboard ----------

function setLeaderboardContext(mode) {
  const name = mode === "weekly" ? "Weekly" : "Daily";
  if (el("leaderboard-mode")) el("leaderboard-mode").textContent = name;
  if (el("leaderboard-title")) el("leaderboard-title").textContent = name + " leaderboard";
  if (el("leaderboard-note")) el("leaderboard-note").textContent = "Only logged-in " + name.toLowerCase() + " scores are recorded.";
  el("leaderboard-list")?.setAttribute("aria-label", name + " leaderboard");
  return name;
}

export function openLeaderboardDialog() {
  setLeaderboardContext(challengeMode);
  const dialog = el("leaderboard-dialog");
  if (dialog && !dialog.open) dialog.showModal();
}

export function closeLeaderboardDialog() {
  const dialog = el("leaderboard-dialog");
  if (dialog?.open) dialog.close();
}

export function renderLeaderboard({ date = "", endDate = "", mode = "daily", entries = [], currentUserId = null } = {}) {
  const list = el("leaderboard-list");
  const message = el("leaderboard-message");
  const dateEl = el("leaderboard-date");

  const name = setLeaderboardContext(mode);
  if (dateEl) dateEl.textContent = mode === "weekly" ? formatWeeklyRange(date, endDate) : date;
  if (!list || !message) return;

  list.replaceChildren();

  if (!Array.isArray(entries) || entries.length === 0) {
    message.textContent = mode === "weekly" ? "No ranked scores yet this week." : "No ranked scores yet today.";
    return;
  }

  message.textContent = "";

  entries.forEach((entry, index) => {
    const item = document.createElement("li");
    item.className = "leaderboard-entry";

    const rank = Number.isInteger(entry.rank) ? entry.rank : index + 1;
    const isMe = currentUserId != null && entry.userId === currentUserId;
    if (isMe) item.classList.add("me");

    const rankEl = document.createElement("span");
    rankEl.className = "leaderboard-rank";
    rankEl.textContent = `#${rank}`;

    const nameEl = document.createElement("span");
    nameEl.className = "leaderboard-name";
    nameEl.textContent = entry.username || "Player";

    const scoreEl = document.createElement("span");
    scoreEl.className = "leaderboard-score";
    scoreEl.textContent = formatScore(entry.score);
    const detail = document.createElement("small");
    detail.className = "leaderboard-detail";
    const distance = Number(entry.distanceMetres);
    detail.textContent = `${Number.isFinite(distance) ? `${distance.toFixed(2)} m` : "—"} · ${formatElapsedTime(entry.elapsedMs)}`;
    scoreEl.appendChild(detail);

    item.append(rankEl, nameEl, scoreEl);
    list.appendChild(item);
  });
}

export function setLeaderboardMessage(message) {
  const target = el("leaderboard-message");
  const list = el("leaderboard-list");
  if (target) target.textContent = message;
  if (list) list.replaceChildren();
}
