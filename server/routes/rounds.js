// server/routes/rounds.js

import express from "express";
import { readGuess, scoreGuess } from "../utils/guessing.js";
import { getRandomPhotos, getPhotoByImageId } from "../models/photosModel.js";
import { createRound, claimRoundImage } from "../utils/randomRound.js";

const router = express.Router();

router.get("/random", async (req, res) => {
  try {
    const rows = await getRandomPhotos(5);
    const roundId = createRound(req.session, rows.map((row) => row.image_id)).id;

    res.json({
      roundId,
      name: "Random Campus Round",
      images: rows.map((row) => ({
        id: row.image_id,
        imagePath: row.image_path,
      })),
    });
  } catch (error) {
    console.error("Random round error:", error);
    res.status(500).json({ error: "Failed to load round." });
  }
});

router.post("/:roundId/guess", async (req, res) => {
  const { imageId } = req.body || {};
  const guess = readGuess(req.body);

  if (typeof imageId !== "string" || !imageId) {
    return res.status(400).json({ error: "imageId is required." });
  }

  if (!guess) {
    return res.status(400).json({ error: "Invalid guess." });
  }

  try {
    if (!claimRoundImage(req.session, req.params.roundId, imageId)
        || !await req.sessionStore.claimRoundImage(req.sessionID, req.params.roundId, imageId)) {
      return res.status(409).json({ error: "This image is not available in the current round or has already been guessed." });
    }

    const photo = await getPhotoByImageId(imageId);
    if (!photo) {
      return res.status(404).json({ error: "Image not found." });
    }

    const scored = scoreGuess(guess, photo);

    return res.json({
      imageId,
      distanceMetres: scored.distanceMetres,
      score: scored.score,
      answer: scored.answer,
      guess: scored.guess,
      exactBuilding: scored.exactBuilding,
    });
  } catch (error) {
    console.error("Random guess error:", error);
    return res.status(500).json({ error: "Failed to score guess." });
  }
});

export default router;
