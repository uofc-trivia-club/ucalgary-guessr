import crypto from "node:crypto";

const ROUND_TTL_MS = 60 * 60 * 1000;

export function createRound(session, imageIds, now = Date.now()) {
  const round = {
    id: crypto.randomUUID(),
    imageIds: [...imageIds],
    guessedIds: [],
    expiresAt: now + ROUND_TTL_MS,
  };
  session.randomRound = round;
  return round;
}

export function claimRoundImage(session, roundId, imageId, now = Date.now()) {
  const round = session?.randomRound;
  if (!round || round.id !== roundId || now >= round.expiresAt ||
      !round.imageIds.includes(imageId) || round.guessedIds.includes(imageId)) {
    return false;
  }
  round.guessedIds.push(imageId);
  return true;
}
