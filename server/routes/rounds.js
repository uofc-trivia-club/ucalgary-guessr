// server/routes/rounds.js

import express from "express";
import { pixelDistance, scoreFromPixelDistance } from "../utils/scoring.js";
import { getRandomPhotos, getPhotoByImageId } from "../models/photosModel.js";

const router = express.Router();

router.get("/random", (req, res) => {
  try {
    const rows = getRandomPhotos(5);
    const roundId = Date.now();

    res.json({
      roundId,
      name: "Random Campus Round",
      images: rows.map((row) => ({
        id: row.image_id,
        imagePath: row.image_path,
      })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load round" });
  }
});

router.post("/:roundId/guess", (req, res) => {
  const { imageId, x, y } = req.body || {};

  if (typeof imageId !== "string") {
    return res.status(400).json({ error: "imageId is required" });
  }
  if (typeof x !== "number" || typeof y !== "number") {
    return res.status(400).json({ error: "Invalid guess coordinates" });
  }

  try {
    const photo = getPhotoByImageId(imageId);
    if (!photo) return res.status(404).json({ error: "Image not found" });

    const guess = { x, y };
    const answer = { x: photo.answer_x, y: photo.answer_y };

    const distancePx = pixelDistance(guess, answer);
    const score = scoreFromPixelDistance(distancePx);

    res.json({ imageId, distancePx, score, answer });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to score guess" });
  }
});

export default router;
