import db from "../config/db.js";

function dateToUtcDayNumber(dateString) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateString);
  if (!match) throw new Error(`Invalid challenge date: ${dateString}`);
  const [, year, month, day] = match.map(Number);
  return Math.floor(Date.UTC(year, month - 1, day) / 86_400_000);
}

export async function getDailyChallengeByDate(date) {
  const { rows } = await db.execute({
    sql: `SELECT dc.challenge_date, p.image_id, p.image_path, p.answer_latitude,
      p.answer_longitude, p.answer_building_name, p.answer_building_latitude,
      p.answer_building_longitude
      FROM daily_challenges AS dc JOIN photos AS p ON p.image_id = dc.image_id
      WHERE dc.challenge_date = ?`,
    args: [date],
  });
  return rows[0] || null;
}

export async function getOrCreateDailyChallenge(date) {
  const existing = await getDailyChallengeByDate(date);
  if (existing) return existing;
  const { rows: [{ count }] } = await db.execute("SELECT COUNT(*) AS count FROM photos WHERE photo_pool = 'standard'");
  if (!count) return null;
  const dayNumber = dateToUtcDayNumber(date);
  const offset = ((dayNumber % count) + count) % count;
  // The date is unique. Concurrent instances all read back the winning row.
  await db.execute({
    sql: `INSERT OR IGNORE INTO daily_challenges (challenge_date, image_id)
      SELECT ?, image_id FROM photos WHERE photo_pool = 'standard' ORDER BY id ASC LIMIT 1 OFFSET ?`,
    args: [date, offset],
  });
  return getDailyChallengeByDate(date);
}
