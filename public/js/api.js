// public/js/api.js

const BASE_URL = "/api";

async function parseJsonResponse(res) {
  const contentType = res.headers.get("content-type") || "";
  const data = contentType.includes("application/json")
    ? await res.json()
    : null;

  if (!res.ok) {
    const message = data?.error || data?.message || `Request failed (${res.status})`;
    const error = new Error(message);
    error.status = res.status;
    error.data = data;
    throw error;
  }

  return data;
}

async function request(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    credentials: "same-origin",
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers || {}),
    },
  });

  return parseJsonResponse(res);
}

// ---------- Random mode ----------

export function getRandomRound() {
  return request("/rounds/random");
}

export function submitGuess(roundId, imageId, guess) {
  return request(`/rounds/${encodeURIComponent(roundId)}/guess`, {
    method: "POST",
    body: JSON.stringify({
      imageId,
      guess,
    }),
  });
}

// ---------- Daily mode ----------

export function getDailyChallenge() {
  return request("/daily");
}

export function submitDailyGuess(guess, elapsedMs, challengeDate) {
  return request("/daily/guess", {
    method: "POST",
    body: JSON.stringify({ guess, elapsedMs, challengeDate }),
  });
}

export function getDailyLeaderboard(limit = 10) {
  const safeLimit = Math.max(1, Math.min(Number(limit) || 10, 100));
  return request(`/daily/leaderboard?limit=${safeLimit}`);
}

// ---------- Weekly mode ----------

export function getWeeklyChallenge() { return request("/weekly"); }
export function submitWeeklyGuess(guess, elapsedMs, challengeDate) {
  return request("/weekly/guess", { method: "POST", body: JSON.stringify({ guess, elapsedMs, challengeDate }) });
}
export function getWeeklyLeaderboard(limit = 10) {
  const safeLimit = Math.max(1, Math.min(Number(limit) || 10, 100));
  return request(`/weekly/leaderboard?limit=${safeLimit}`);
}

// ---------- Authentication ----------

export function getCurrentUser() {
  return request("/auth/me");
}

export function register({ username, email, password }) {
  return request("/auth/register", {
    method: "POST",
    body: JSON.stringify({ username, email, password }),
  });
}

export function login({ identifier, password }) {
  return request("/auth/login", {
    method: "POST",
    body: JSON.stringify({ identifier, password }),
  });
}

export function logout() {
  return request("/auth/logout", {
    method: "POST",
  });
}

export function requestMagicLogin(email) {
  return request("/auth/magic-link", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export function requestPasswordReset(identifier) {
  return request("/auth/forgot-password", {
    method: "POST",
    body: JSON.stringify({ identifier }),
  });
}

export function resetPassword({ token, password }) {
  return request("/auth/reset-password", {
    method: "POST",
    body: JSON.stringify({ token, password }),
  });
}
