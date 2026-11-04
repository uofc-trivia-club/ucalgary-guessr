import db from "../config/db.js";

const leaderboardOrder = `ds.score DESC, ds.distance_metres ASC, ds.elapsed_ms IS NULL ASC,
  ds.elapsed_ms ASC, ds.submitted_at ASC, ds.id ASC`;

export function createChallengeScoresModel(table) {
  if (!["daily_scores", "weekly_scores"].includes(table)) throw new Error("Unsupported score table");
  return {
    async getScoreForUser(userId, challengeDate) {
      const { rows } = await db.execute({
        sql: `SELECT * FROM ${table} WHERE user_id = ? AND challenge_date = ?`,
        args: [userId, challengeDate],
      });
      return rows[0] || null;
    },
    async createScore({ userId, challengeDate, score, distanceMetres, elapsedMs, result = null }) {
      const { rows } = await db.execute({
        sql: `INSERT INTO ${table}
          (user_id, challenge_date, score, distance_metres, elapsed_ms, result_json)
          VALUES (?, ?, ?, ?, ?, ?) RETURNING *`,
        args: [userId, challengeDate, score, distanceMetres, elapsedMs ?? null, result ? JSON.stringify(result) : null],
      });
      return rows[0];
    },
    async getLeaderboard(challengeDate, limit = 10) {
      const { rows } = await db.execute({
        sql: `SELECT ds.id, ds.user_id, u.username, ds.score, ds.distance_metres,
          ds.elapsed_ms, ds.submitted_at FROM ${table} AS ds JOIN users AS u ON u.id = ds.user_id
          WHERE ds.challenge_date = ? ORDER BY ${leaderboardOrder} LIMIT ?`,
        args: [challengeDate, limit],
      });
      return rows.map((row, index) => ({
        rank: index + 1, userId: row.user_id, username: row.username, score: row.score,
        distanceMetres: row.distance_metres, elapsedMs: row.elapsed_ms, submittedAt: row.submitted_at,
      }));
    },
    async getRankForUser(challengeDate, userId) {
      const { rows } = await db.execute({
        sql: `SELECT place FROM (SELECT ds.user_id, ROW_NUMBER() OVER (ORDER BY ${leaderboardOrder}) AS place
          FROM ${table} AS ds WHERE ds.challenge_date = ?) WHERE user_id = ?`,
        args: [challengeDate, userId],
      });
      return rows[0]?.place ?? null;
    },
  };
}
