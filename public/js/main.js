// public/js/main.js

import {
  getRandomRound,
  submitGuess,
  getDailyChallenge,
  submitDailyGuess,
  getDailyLeaderboard,
  getWeeklyChallenge,
  submitWeeklyGuess,
  getWeeklyLeaderboard,
  getCurrentUser,
  register,
  login,
  logout,
  requestMagicLogin,
  requestPasswordReset,
  resetPassword,
} from "./api.js";

import {
  showPageView,
  setLandingStatus,
  setGamePageMode,
  setResultText,
  showGuessSelected,
  showGuessResult,
  showCompletedDaily,
  copyDailyScore,
  enableLockButton,
  enableNextButton,
  showNextButton,
  showRestartButton,
  setRoundTitle,
  setRoundProgress,
  setSceneImage,
  updateScoreSummary,
  setMapExpanded,
  setAuthUI,
  openAuthDialog,
  closeAuthDialog,
  setAuthDialogMode,
  setAuthMessage,
  setResetMessage,
  openLeaderboardDialog,
  closeLeaderboardDialog,
  renderLeaderboard,
  setLeaderboardMessage,
  setStopwatch,
  initialiseGameplayTabs,
  initialiseSceneZoom,
  setGameplayView,
  setSelectedLocation,
} from "./ui.js";

import {
  setGameMode,
  getGameMode,
  setCurrentUser,
  getCurrentUserState,
  setDailyChallenge,
  setDailyCompleted,
  setRound,
  getCurrentRound,
  getCurrentImage,
  incrementImageIndex,
  isLastImage,
  addScore,
  setTotalScore,
  getTotalScore,
  getRoundMaxScore,
  getUnusedImages,
  rememberImagesUsed,
  setLastGuess,
  getLastGuess,
  clearLastGuess,
  resetRoundState,
} from "./gameState.js";

import {
  initMap,
  setGuessingEnabled,
  clearGuessAndAnswer,
  showAnswerOnMap,
} from "./map.js";

import { createActiveTimer } from "./dailyTimer.js";

const LEADERBOARD_LIMIT = 10;
const isChallengeMode = () => ["daily", "weekly"].includes(getGameMode());
const challengeName = () => getGameMode() === "weekly" ? "Weekly" : "Daily";
let mapInitialised = false;
let stopwatchInterval = null;
let challengeTimer = null;
let challengeSubmissionPending = false;

function stopChallengeStopwatch(elapsedMs = null) {
  challengeTimer?.pause();
  challengeTimer = null;
  challengeSubmissionPending = false;
  if (stopwatchInterval) clearInterval(stopwatchInterval);
  stopwatchInterval = null;
  setStopwatch(elapsedMs);
}

function updateChallengeTimerActivity() {
  if (!challengeTimer) return;
  if (document.visibilityState === "hidden" || currentPath() !== "/" + getGameMode() || challengeSubmissionPending) {
    challengeTimer.pause();
  } else {
    challengeTimer.resume();
  }
  setStopwatch(challengeTimer.elapsed());
  challengeTimer.checkpoint();
}

function startChallengeStopwatch(challenge) {
  stopChallengeStopwatch();
  let storage = null;
  try { storage = window.sessionStorage; } catch { /* Storage can be blocked. */ }
  challengeTimer = createActiveTimer({ storage });
  challengeTimer.start((getGameMode() === "weekly" ? "weekly:" : "") + challenge.date + ":" + challenge.startedAt);
  updateChallengeTimerActivity();
  stopwatchInterval = setInterval(updateChallengeTimerActivity, 250);
}

document.addEventListener("visibilitychange", updateChallengeTimerActivity);
window.addEventListener("pagehide", () => challengeTimer?.pause());
window.addEventListener("pageshow", updateChallengeTimerActivity);

function normaliseUserResponse(payload) {
  if (!payload) return null;
  if (Object.prototype.hasOwnProperty.call(payload, "user")) {
    return payload.user || null;
  }
  return payload;
}

function normaliseChallengeImage(challenge) {
  if (!challenge) return null;

  const image = challenge.image || challenge.photo || null;
  if (image) {
    return {
      id: image.id || image.imageId || image.image_id,
      imagePath: image.imagePath || image.image_path,
    };
  }

  if (challenge.imageId || challenge.imagePath) {
    return {
      id: challenge.imageId,
      imagePath: challenge.imagePath,
    };
  }

  return null;
}

function normaliseLeaderboard(payload) {
  if (Array.isArray(payload)) {
    return { date: "", entries: payload };
  }

  return {
    date: payload?.date || payload?.challengeDate || "",
    entries: payload?.entries || payload?.leaderboard || payload?.scores || [],
  };
}

function currentPath() {
  const path = window.location.pathname.replace(/\/+$/, "");
  return path || "/";
}

function resetGameVisuals() {
  setSelectedLocation();
  setGameplayView("photo");
  stopChallengeStopwatch();
  resetRoundState();
  clearGuessAndAnswer();
  clearLastGuess();
  setGuessingEnabled(false);
  enableLockButton(false);
  enableNextButton(false);
  showRestartButton(false);
  setRoundProgress(0, 0);
}

function loadCurrentImage() {
  const round = getCurrentRound();
  const image = getCurrentImage();

  if (!round || !image) {
    setResultText("No image is available for this game.", "error");
    setGuessingEnabled(false);
    return;
  }

  const total = round.images.length;
  const current = round.images.findIndex((item) => item.id === image.id) + 1;
  const number = current > 0 ? current : 1;

  if (isChallengeMode()) {
    setGamePageMode(getGameMode(), round.date, round.endDate);
    setRoundTitle("");
  } else {
    setRoundTitle(`Photo ${number} of ${total}`);
  }

  setRoundProgress(number, total);
  setSceneImage(image.imagePath);
  updateScoreSummary(getTotalScore(), getRoundMaxScore());

  clearLastGuess();
  clearGuessAndAnswer();
  setSelectedLocation();
  setGameplayView("photo");
  setGuessingEnabled(true);
  enableLockButton(false);
  enableNextButton(false);
  showRestartButton(false);
  setResultText("Make a guess by clicking the map.");
}

async function loadRandomRound() {
  resetGameVisuals();
  setGamePageMode("random");
  showNextButton(true);
  setRoundTitle("Loading random round…");
  setSceneImage("", { loading: true });
  updateScoreSummary(0, 25_000);
  setResultText("Loading random round…");

  try {
    const MAX_TRIES = 10;
    let round = null;
    let filteredImages = [];

    for (let attempt = 0; attempt < MAX_TRIES; attempt += 1) {
      const candidate = await getRandomRound();
      if (!candidate || !Array.isArray(candidate.images)) continue;

      const unused = getUnusedImages(candidate.images);
      // Keep the full server-issued round: filtering a partially seen candidate
      // would shrink the game below five photos when the pool grows.
      if (unused.length > 0 && unused.length === candidate.images.length) {
        round = { ...candidate, images: unused };
        filteredImages = unused;
        break;
      }
    }

    if (!round) {
      round = await getRandomRound();
      if (!round || !Array.isArray(round.images) || round.images.length === 0) {
        throw new Error("No random images are available.");
      }
      filteredImages = round.images;
    }

    rememberImagesUsed(filteredImages);
    setRound(round);
    loadCurrentImage();
  } catch (error) {
    console.error("loadRandomRound error:", error);
    setSceneImage("");
    setResultText(error.message || "Failed to load random round.", "error");
  }
}

async function loadChallenge() {
  resetGameVisuals();
  const mode = getGameMode();
  setGamePageMode(mode);
  showNextButton(false);
  setRoundTitle("");
  setSceneImage("", { loading: true });
  updateScoreSummary(0, 5_000);
  setResultText(mode === "weekly" ? "Loading this week's challenge…" : "Loading today's challenge…");

  try {
    const challenge = mode === "weekly" ? await getWeeklyChallenge() : await getDailyChallenge();
    setDailyChallenge(challenge);
    setGamePageMode(mode, challenge.date || "", challenge.endDate || "");

    const image = normaliseChallengeImage(challenge);
    if (!image?.id || !image?.imagePath) {
      throw new Error("This challenge does not contain a valid image.");
    }

    const round = {
      roundId: `${mode}-${challenge.date || "current"}`,
      name: `${challengeName()} Challenge`,
      date: challenge.date || "",
      endDate: challenge.endDate || "",
      images: [image],
    };

    setRound(round);

    if (challenge.completed) {
      const previous = challenge.result ?? challenge.score ?? {};
      const score = typeof previous === "number" ? previous : previous.score;
      const rank = challenge.rank ?? previous.rank ?? null;

      setTotalScore(Number(score) || 0);
      setRoundTitle("");
      setRoundProgress(1, 1);
      setSceneImage(image.imagePath);
      updateScoreSummary(getTotalScore(), 5_000);
      setGuessingEnabled(false);
      enableLockButton(false);
      stopChallengeStopwatch(challenge.elapsedMs);
      showCompletedDaily({ ...previous, score, rank, saved: challenge.saved, elapsedMs: challenge.elapsedMs });
      if (previous.answer) showAnswerOnMap(previous.answer, previous.guess);
      return;
    }

    setDailyCompleted(false);
    loadCurrentImage();
    startChallengeStopwatch(challenge);
  } catch (error) {
    console.error("loadChallenge error:", error);
    setSceneImage("");
    setResultText(error.message || "Failed to load this challenge.", "error");
  }
}

async function refreshLeaderboard() {
  setLeaderboardMessage("Loading scores…");

  try {
    const mode = getGameMode() === "weekly" ? "weekly" : "daily";
    const payload = mode === "weekly" ? await getWeeklyLeaderboard(LEADERBOARD_LIMIT) : await getDailyLeaderboard(LEADERBOARD_LIMIT);
    const { date, entries } = normaliseLeaderboard(payload);
    const user = getCurrentUserState();

    renderLeaderboard({
      mode,
      endDate: payload?.endDate || "",
      date,
      entries,
      currentUserId: user?.id ?? null,
    });
  } catch (error) {
    console.error("refreshLeaderboard error:", error);
    setLeaderboardMessage("Could not load the leaderboard.");
  }
}

async function onLockGuess() {
  const guess = getLastGuess();
  if (!guess) {
    setResultText("Make a guess by clicking the map first.");
    return;
  }

  const focusResult = document.activeElement?.id === "make-guess-btn";
  enableLockButton(false);
  setGuessingEnabled(false);

  try {
    if (isChallengeMode()) {
      challengeSubmissionPending = true;
      const elapsedMs = challengeTimer?.pause() ?? 0;
      const result = getGameMode() === "weekly"
        ? await submitWeeklyGuess(guess, elapsedMs, getCurrentRound()?.date)
        : await submitDailyGuess(guess, elapsedMs, getCurrentRound()?.date);
      const { distanceMetres, score, answer } = result;

      setTotalScore(score);
      setDailyCompleted(true);
      stopChallengeStopwatch(result.elapsedMs);
      updateScoreSummary(score, 5_000);
      showGuessResult({
        score,
        distanceMetres,
        totalScore: score,
        maxScore: 5_000,
        isFinal: true,
        rank: result.rank ?? null,
        daily: true,
        saved: Boolean(result.saved),
        elapsedMs: result.elapsedMs,
        guess: result.guess ?? guess,
        answer: result.answer ?? null,
        exactBuilding: Boolean(result.exactBuilding),
        focusResult,
        animate: true,
      });
      if (answer) showAnswerOnMap(answer, result.guess ?? guess);
      return;
    }

    const round = getCurrentRound();
    const image = getCurrentImage();
    if (!round || !image) return;

    const result = await submitGuess(round.roundId, image.id, guess);
    const { distanceMetres, score, answer } = result;

    addScore(score);
    updateScoreSummary(getTotalScore(), getRoundMaxScore());
    const finalImage = isLastImage();

    showGuessResult({
      score,
      distanceMetres,
      totalScore: getTotalScore(),
      maxScore: getRoundMaxScore(),
      isFinal: finalImage,
      guess: result.guess ?? guess,
      answer: result.answer ?? null,
      exactBuilding: Boolean(result.exactBuilding),
      focusResult,
      animate: true,
    });
    if (answer) showAnswerOnMap(answer, result.guess ?? guess);

    if (finalImage) {
      enableNextButton(false);
      showRestartButton(true);
    } else {
      enableNextButton(true);
    }
  } catch (error) {
    console.error("onLockGuess error:", error);
    challengeSubmissionPending = false;
    updateChallengeTimerActivity();

    if (error.status === 409 && isChallengeMode()) {
      setResultText("This challenge changed or your attempt has already been submitted. Reloading…", "error");
      await loadChallenge();
      return;
    }

    setResultText(error.message || "Error submitting guess.", "error");
    setGuessingEnabled(true);
    enableLockButton(Boolean(getLastGuess()));
  }
}

function onNextImage() {
  if (getGameMode() !== "random") return;
  if (isLastImage()) return;

  incrementImageIndex();
  loadCurrentImage();
}

function onRestart() {
  if (getGameMode() !== "random") return;
  loadRandomRound();
}

async function initialiseAuth() {
  try {
    const payload = await getCurrentUser();
    const user = normaliseUserResponse(payload);
    setCurrentUser(user);
    setAuthUI(user);
  } catch (error) {
    console.error("initialiseAuth error:", error);
    setCurrentUser(null);
    setAuthUI(null);
  }
}

async function refreshChallengeAfterAuthChange() {
  if (["/daily", "/weekly"].includes(currentPath()) && mapInitialised) {
    await loadChallenge();
  }
}

async function handleLogin(event) {
  event.preventDefault();
  setAuthMessage("");

  const identifier = document.getElementById("login-identifier")?.value.trim() || "";
  const password = document.getElementById("login-password")?.value || "";

  try {
    const payload = await login({ identifier, password });
    const user = normaliseUserResponse(payload);
    setCurrentUser(user);
    setAuthUI(user);
    closeAuthDialog();
    await refreshChallengeAfterAuthChange();
  } catch (error) {
    setAuthMessage(error.message || "Failed to log in.");
  }
}

async function handleSignup(event) {
  event.preventDefault();
  setAuthMessage("");

  const username = document.getElementById("signup-username")?.value.trim() || "";
  const email = document.getElementById("signup-email")?.value.trim() || "";
  const password = document.getElementById("signup-password")?.value || "";

  try {
    const payload = await register({ username, email, password });
    const user = normaliseUserResponse(payload);
    setCurrentUser(user);
    setAuthUI(user);
    closeAuthDialog();
    await refreshChallengeAfterAuthChange();
  } catch (error) {
    setAuthMessage(error.message || "Failed to create account.");
  }
}

async function handleLogout() {
  try {
    await logout();
  } catch (error) {
    console.error("logout error:", error);
  } finally {
    setCurrentUser(null);
    setAuthUI(null);
    await refreshChallengeAfterAuthChange();
  }
}

async function handleMagicLinkRequest(event) {
  event.preventDefault();
  setAuthMessage("");

  const email = document.getElementById("magic-email")?.value.trim() || "";

  try {
    const result = await requestMagicLogin(email);
    setAuthMessage(
      result?.message || "If an account matches that email, a login link has been sent.",
      false
    );
  } catch (error) {
    setAuthMessage(error.message || "Failed to request a login link.");
  }
}

async function handleForgotPassword(event) {
  event.preventDefault();
  setAuthMessage("");

  const identifier = document.getElementById("forgot-identifier")?.value.trim() || "";

  try {
    const result = await requestPasswordReset(identifier);
    setAuthMessage(
      result?.message || "If an account matches, a password-reset link has been sent.",
      false
    );
  } catch (error) {
    setAuthMessage(error.message || "Failed to request a password reset.");
  }
}

async function handleResetPassword(event) {
  event.preventDefault();
  setResetMessage("");

  const params = new URLSearchParams(window.location.search);
  const token = params.get("token") || "";
  const password = document.getElementById("reset-password")?.value || "";
  const confirmation = document.getElementById("reset-password-confirm")?.value || "";

  if (!token) {
    setResetMessage("This password-reset link is missing its token.");
    return;
  }

  if (password !== confirmation) {
    setResetMessage("The passwords do not match.");
    return;
  }

  try {
    const payload = await resetPassword({ token, password });
    const user = normaliseUserResponse(payload);
    if (user) {
      setCurrentUser(user);
      setAuthUI(user);
    }
    window.location.assign("/?password=reset");
  } catch (error) {
    setResetMessage(error.message || "Failed to reset password.");
  }
}

function wireDialogBackdrop(dialogId, close) {
  const dialog = document.getElementById(dialogId);
  dialog?.addEventListener("click", (event) => {
    if (event.target === dialog) close();
  });
}

function wireUI() {
  initialiseSceneZoom();
  // Deter casual image copying without disabling controls elsewhere on the page.
  const photoPanel = document.getElementById("image-panel");
  for (const type of ["contextmenu", "dragstart", "copy"]) {
    photoPanel?.addEventListener(type, event => event.preventDefault(), { capture: true });
  }

  const helpDialog = document.getElementById("help-dialog");
  document.getElementById("help-btn")?.addEventListener("click", () => helpDialog?.showModal());
  document.getElementById("help-close-btn")?.addEventListener("click", () => helpDialog?.close());
  wireDialogBackdrop("help-dialog", () => helpDialog?.close());
  document.getElementById("login-btn")?.addEventListener("click", () => openAuthDialog("login"));
  document.getElementById("signup-btn")?.addEventListener("click", () => openAuthDialog("signup"));
  document.getElementById("logout-btn")?.addEventListener("click", handleLogout);

  document.getElementById("auth-close-btn")?.addEventListener("click", closeAuthDialog);
  document.getElementById("auth-login-tab")?.addEventListener("click", () => setAuthDialogMode("login"));
  document.getElementById("auth-signup-tab")?.addEventListener("click", () => setAuthDialogMode("signup"));
  document.getElementById("forgot-password-btn")?.addEventListener("click", () => setAuthDialogMode("forgot"));
  document.getElementById("magic-login-btn")?.addEventListener("click", () => setAuthDialogMode("magic"));

  document.querySelectorAll("[data-auth-back]").forEach((button) => {
    button.addEventListener("click", () => setAuthDialogMode("login"));
  });

  document.getElementById("login-form")?.addEventListener("submit", handleLogin);
  document.getElementById("signup-form")?.addEventListener("submit", handleSignup);
  document.getElementById("magic-link-form")?.addEventListener("submit", handleMagicLinkRequest);
  document.getElementById("forgot-password-form")?.addEventListener("submit", handleForgotPassword);
  document.getElementById("reset-password-form")?.addEventListener("submit", handleResetPassword);

  document.getElementById("make-guess-btn")?.addEventListener("click", onLockGuess);
  document.getElementById("next-image-btn")?.addEventListener("click", onNextImage);
  document.getElementById("restart-btn")?.addEventListener("click", onRestart);
  document.getElementById("daily-share-btn")?.addEventListener("click", copyDailyScore);
  document.getElementById("result-login-btn")?.addEventListener("click", () => openAuthDialog("login"));
  document.getElementById("result-leaderboard-btn")?.addEventListener("click", async () => {
    openLeaderboardDialog();
    await refreshLeaderboard();
  });
  document.getElementById("map-legend-btn")?.addEventListener("click", (event) => {
    const legend = document.getElementById("map-result-legend");
    if (!legend) return;
    legend.hidden = !legend.hidden;
    event.currentTarget.setAttribute("aria-expanded", String(!legend.hidden));
  });

  document.getElementById("leaderboard-btn")?.addEventListener("click", async () => {
    openLeaderboardDialog();
    await refreshLeaderboard();
  });
  document.getElementById("leaderboard-close-btn")?.addEventListener("click", closeLeaderboardDialog);

  document.getElementById("map-expand-btn")?.addEventListener("click", () => {
    const expanded = document.getElementById("layout")?.classList.contains("map-expanded") || false;
    setMapExpanded(!expanded);
  });

  wireDialogBackdrop("auth-dialog", closeAuthDialog);
  wireDialogBackdrop("leaderboard-dialog", closeLeaderboardDialog);
}

async function initialiseGame(mode) {
  showPageView("game");
  setGameMode(mode);
  setGamePageMode(mode);
  setMapExpanded(false);

  if (!mapInitialised) {
    try {
      await initMap((guess) => {
        setLastGuess(guess);
        showGuessSelected(guess);
        enableLockButton(true);
      });
      mapInitialised = true;
    } catch (error) {
      console.error("Map initialisation error:", error);
      setResultText("Failed to load campus map.", "error");
      return;
    }
  }

  initialiseGameplayTabs();

  if (mode === "daily" || mode === "weekly") await loadChallenge();
  else await loadRandomRound();
}

function initialiseLanding() {
  showPageView("landing");
  const params = new URLSearchParams(window.location.search);

  if (params.get("login") === "magic") {
    setLandingStatus("Login link accepted. You are now logged in.");
  } else if (params.get("login") === "invalid") {
    setLandingStatus("That login link is invalid or has expired.", true);
  } else if (params.get("password") === "reset") {
    setLandingStatus("Your password has been reset. You are now logged in.");
  } else {
    setLandingStatus("");
  }
}

function initialiseResetPage() {
  showPageView("reset");
  const token = new URLSearchParams(window.location.search).get("token");
  if (!token) {
    setResetMessage("This password-reset link is incomplete or invalid.");
  }
}

window.addEventListener("DOMContentLoaded", async () => {
  wireUI();
  setAuthUI(null);
  await initialiseAuth();

  const path = currentPath();

  if (path === "/") {
    initialiseLanding();
    return;
  }

  if (path === "/play") {
    await initialiseGame("random");
    return;
  }

  if (path === "/daily" || path === "/weekly") {
    await initialiseGame(path.slice(1));
    return;
  }

  if (path === "/reset-password") {
    initialiseResetPage();
    return;
  }

  window.location.replace("/");
});
