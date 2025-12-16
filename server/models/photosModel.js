// server/models/photosModel.js

import db from "../config/db.js";

export function getRandomPhotos(limit = 5) {
  const stmt = db.prepare(`
    SELECT image_id, image_path
    FROM photos
    ORDER BY RANDOM()
    LIMIT ?
  `);
  return stmt.all(limit);
}

export function getPhotoByImageId(imageId) {
  const stmt = db.prepare(`
    SELECT image_id, image_path, answer_x, answer_y
    FROM photos
    WHERE image_id = ?
  `);
  return stmt.get(imageId);
}
