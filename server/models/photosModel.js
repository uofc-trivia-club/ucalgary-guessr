import db from "../config/db.js";

export async function getRandomPhotos(limit = 5) {
  const { rows } = await db.execute({
    sql: "SELECT image_id, image_path FROM photos WHERE photo_pool = 'standard' ORDER BY RANDOM() LIMIT ?",
    args: [limit],
  });
  return rows;
}

export async function getPhotoByImageId(imageId) {
  const { rows } = await db.execute({
    sql: `SELECT image_id, image_path, answer_latitude, answer_longitude,
      answer_building_name, answer_building_latitude, answer_building_longitude
      FROM photos WHERE image_id = ?`,
    args: [imageId],
  });
  return rows[0];
}
