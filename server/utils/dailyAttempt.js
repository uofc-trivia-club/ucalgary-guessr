export function beginDailyAttempt(session, date, now = Date.now(), attemptKey = "dailyAttempt") {
  if (!session[attemptKey] || session[attemptKey].date !== date) {
    session[attemptKey] = { date, startedAt: now, revealed: false };
  }
  return session[attemptKey];
}

export function revealDailyAttempt(session, date, result, now = Date.now(), activeElapsedMs = null, attemptKey = "dailyAttempt") {
  const attempt = beginDailyAttempt(session, date, now, attemptKey);
  attempt.revealed = true;
  attempt.elapsedMs = Math.min(Math.max(0, now - attempt.startedAt), activeElapsedMs ?? Infinity);
  attempt.result = result;
  return attempt;
}

export function carryDailyAttempt(oldSession, newSession) {
  for (const key of ["dailyAttempt", "weeklyAttempt"]) {
    if (oldSession?.[key]) newSession[key] = structuredClone(oldSession[key]);
  }
}
