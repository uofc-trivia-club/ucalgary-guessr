import express from "express";
import { getSessionUserId } from "../middleware/auth.js";
import { readGuess, scoreGuess, answerFromPhoto } from "../utils/guessing.js";
import { beginDailyAttempt, revealDailyAttempt } from "../utils/dailyAttempt.js";
import { isUniqueConstraintError } from "../utils/databaseErrors.js";

export function createChallengeRouter({ mode, getPeriod, getChallenge, getScoreForUser, createScore, getLeaderboard, getRankForUser }) {
  const router = express.Router();
  const attemptKey = mode + "Attempt";
  router.get("/leaderboard", async (req, res) => {
    const parsedLimit = Number.parseInt(req.query.limit, 10);
    const limit = Number.isFinite(parsedLimit)
      ? Math.max(1, Math.min(parsedLimit, 100))
      : 10;

    const { date, endDate } = getPeriod();

    try {
      const entries = await getLeaderboard(date, limit);
      return res.json({ date, endDate, entries });
    } catch (error) {
      console.error("Challenge leaderboard error:", error);
      return res.status(500).json({ error: "Failed to load leaderboard." });
    }
  });

  router.get("/", async (req, res) => {
    const { date, endDate } = getPeriod();

    try {
      const challenge = await getChallenge(date);
      if (!challenge) {
        return res.status(404).json({ error: "No photos are available for this challenge." });
      }

      const userId = getSessionUserId(req);
      const previousScore = userId ? await getScoreForUser(userId, date) : null;
      const rank = previousScore ? await getRankForUser(date, userId) : null;
      const attempt = beginDailyAttempt(req.session, date, Date.now(), attemptKey);
      const guestResult = attempt.revealed ? attempt.result : null;
      let result = null;
      if (previousScore) {
        const stored = previousScore.result_json ? JSON.parse(previousScore.result_json) : null;
        result = {
          ...stored,
          score: previousScore.score,
          distanceMetres: previousScore.distance_metres,
          guess: stored?.guess ?? null,
          answer: stored?.answer ?? answerFromPhoto(challenge),
          exactBuilding: stored?.exactBuilding ?? false,
        };
      } else if (guestResult) {
        result = {
          ...guestResult,
          guess: guestResult.guess ?? null,
          answer: guestResult.answer ?? answerFromPhoto(challenge),
          distanceMetres: guestResult.distanceMetres ?? null,
        };
      }

      return res.json({
        date,
        endDate,
        image: {
          id: challenge.image_id,
          imagePath: challenge.image_path,
        },
        completed: Boolean(previousScore || guestResult),
        startedAt: attempt.startedAt,
        elapsedMs: previousScore?.elapsed_ms ?? attempt.elapsedMs ?? null,
        saved: Boolean(previousScore),
        ...(result ? { result } : {}),
        ...(previousScore
          ? {
              score: previousScore.score,
              rank,
            }
          : guestResult ? { score: guestResult.score, rank: null } : {}),
      });
    } catch (error) {
      console.error("Challenge load error:", error);
      return res.status(500).json({ error: "Failed to load this challenge." });
    }
  });

  router.post("/guess", async (req, res) => {
    const guess = readGuess(req.body);
    const activeElapsedMs = req.body?.elapsedMs;
    if (activeElapsedMs !== undefined && (!Number.isSafeInteger(activeElapsedMs) || activeElapsedMs < 0)) {
      return res.status(400).json({ error: "Invalid elapsed time." });
    }
    if (!guess) {
      return res.status(400).json({ error: "Invalid guess." });
    }

    const { date, endDate } = getPeriod();
    // The shared session may have advanced in another tab since this photo loaded.
    if (req.body?.challengeDate !== undefined && req.body.challengeDate !== date) {
      return res.status(409).json({ error: "This challenge has changed. Reload before guessing." });
    }


    try {
      const challenge = await getChallenge(date);
      if (!challenge) {
        return res.status(404).json({ error: "No photos are available for this challenge." });
      }

      const userId = getSessionUserId(req);
      const attempt = req.session[attemptKey];

      if (!attempt || attempt.date !== date) {
        return res.status(409).json({ error: "Load this challenge before guessing." });
      }

      if (attempt.revealed) {
        return res.status(409).json({ error: "This challenge's answer has already been revealed in this session." });
      }

      if (userId && await getScoreForUser(userId, date)) {
        return res.status(409).json({ error: "Your ranked challenge attempt has already been submitted." });
      }

      const scored = scoreGuess(guess, challenge);
      const { distanceMetres: distance, score, answer, exactBuilding } = scored;
      const now = Date.now();
      const wallElapsedMs = Math.max(0, now - attempt.startedAt);
      const elapsedMs = Math.min(wallElapsedMs, activeElapsedMs ?? wallElapsedMs);

      if (!userId) {
        revealDailyAttempt(req.session, date, scored, now, elapsedMs, attemptKey);
        return res.json({
          date,
        endDate,
          distanceMetres: distance,
          score,
          elapsedMs,
          answer,
          guess: scored.guess,
          exactBuilding,
          saved: false,
          rank: null,
        });
      }

      try {
        await createScore({
          userId,
          challengeDate: date,
          score,
          distanceMetres: distance,
          elapsedMs,
          result: scored,
        });
      } catch (error) {
        if (isUniqueConstraintError(error)) {
          return res.status(409).json({
            error: "Your ranked challenge attempt has already been submitted.",
          });
        }
        throw error;
      }

      const rank = await getRankForUser(date, userId);
      revealDailyAttempt(req.session, date, scored, now, elapsedMs, attemptKey);

      return res.json({
        date,
        endDate,
        distanceMetres: distance,
        score,
        elapsedMs,
        answer,
        guess: scored.guess,
        exactBuilding,
        saved: true,
        rank,
      });
    } catch (error) {
      console.error("Challenge guess error:", error);
      return res.status(500).json({ error: "Failed to score daily guess." });
    }
  });


  return router;
}
