import db from "../config/db.js";

export async function getWeeklyChallengeByDate(date) {
  const { rows } = await db.execute({
    sql: `SELECT wc.challenge_date, p.image_id, p.image_path, p.answer_latitude,
      p.answer_longitude, p.answer_building_name, p.answer_building_latitude,
      p.answer_building_longitude
      FROM weekly_challenges AS wc JOIN photos AS p ON p.image_id = wc.image_id
      WHERE wc.challenge_date = ?`,
    args: [date],
  });
  return rows[0] || null;
}

export async function getOrCreateWeeklyChallenge(date) {
  const existing = await getWeeklyChallengeByDate(date);
  // Grandfather stored assignments so old attempts and leaderboards keep their
  // original photo. Every new assignment below is restricted to Weekly assets.
  if (existing) return existing;
  // A Sunday key is unique. Concurrent requests read back the one winning image.
  await db.execute({
    sql: `INSERT OR IGNORE INTO weekly_challenges (challenge_date, image_id)
      SELECT ?, image_id FROM photos WHERE photo_pool = 'weekly' ORDER BY RANDOM() LIMIT 1`,
    args: [date],
  });
  return getWeeklyChallengeByDate(date);
}
