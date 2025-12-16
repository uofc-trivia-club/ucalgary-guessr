// public/js/api.js

const BASE_URL = "/api";

export async function getRandomRound() {
  const res = await fetch(`${BASE_URL}/rounds/random`);
  if (!res.ok) {
    console.error("Random round status:", res.status);
    throw new Error("Failed to load round");
  }
  return res.json(); // { roundId, name, images: [...] }
}

export async function submitGuess(roundId, imageId, guess) {
  const res = await fetch(`${BASE_URL}/rounds/${roundId}/guess`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      imageId,
      x: guess.x,
      y: guess.y,
    }),
  });

  if (!res.ok) {
    console.error("Submit guess status:", res.status);
    throw new Error("Failed to submit guess");
  }
  return res.json(); // { imageId, distancePx, score, answer }
}
