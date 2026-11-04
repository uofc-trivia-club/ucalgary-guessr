import session from "express-session";

// Game progress must survive a later save from an overlapping request that
// loaded an older snapshot. Merge these fields inside SQLite's atomic upsert.
function challengeProgress(field) {
  return `CASE
  WHEN json_type(sessions.sess, '$.${field}') = 'object' AND (
    json_type(excluded.sess, '$.${field}') IS NULL OR
    json_extract(sessions.sess, '$.${field}.date') > json_extract(excluded.sess, '$.${field}.date') OR (
      json_extract(sessions.sess, '$.${field}.date') = json_extract(excluded.sess, '$.${field}.date') AND
      (json_extract(sessions.sess, '$.${field}.revealed') = 1 OR
        json_extract(excluded.sess, '$.${field}.revealed') = 0)
    )
  ) THEN json_object('${field}', json_extract(sessions.sess, '$.${field}'))
  WHEN json_type(excluded.sess, '$.${field}') = 'object'
  THEN json_object('${field}', json_extract(excluded.sess, '$.${field}'))
  ELSE '{}' END`;
}
const dailyProgress = challengeProgress("dailyAttempt");
const weeklyProgress = challengeProgress("weeklyAttempt");

const roundProgress = `CASE
  WHEN json_type(sessions.sess, '$.randomRound') = 'object' AND (
    json_type(excluded.sess, '$.randomRound') IS NULL OR
    json_extract(sessions.sess, '$.randomRound.expiresAt') > json_extract(excluded.sess, '$.randomRound.expiresAt')
  ) THEN json_object('randomRound', json_extract(sessions.sess, '$.randomRound'))
  WHEN json_extract(sessions.sess, '$.randomRound.id') = json_extract(excluded.sess, '$.randomRound.id')
  THEN json_object('randomRound', json_set(json_extract(excluded.sess, '$.randomRound'), '$.guessedIds', json((
    SELECT json_group_array(value) FROM (
      SELECT value FROM json_each(sessions.sess, '$.randomRound.guessedIds')
      UNION SELECT value FROM json_each(excluded.sess, '$.randomRound.guessedIds')
    )
  ))))
  WHEN json_type(excluded.sess, '$.randomRound') = 'object'
  THEN json_object('randomRound', json_extract(excluded.sess, '$.randomRound'))
  ELSE '{}' END`;

function replaceProgress(sessionJson, field, progress) {
  // Replace the entire field: JSON merge-patch would discard nested nulls or
  // retain yesterday's result when today's attempt has no result yet.
  return `CASE WHEN json_type(${progress}, '$.${field}') IS NOT NULL
    THEN json_set(${sessionJson}, '$.${field}', json_extract(${progress}, '$.${field}'))
    ELSE ${sessionJson} END`;
}

const mergedSession = replaceProgress(
  replaceProgress(replaceProgress("excluded.sess", "dailyAttempt", dailyProgress), "weeklyAttempt", weeklyProgress), "randomRound", roundProgress
);

export default class LibsqlSessionStore extends session.Store {
  constructor(db) {
    super();
    this.db = db;
  }

  get(sid, callback) {
    this.db.execute({
      sql: "SELECT sess FROM sessions WHERE sid = ? AND expires_at > ?",
      args: [sid, Date.now()],
    }).then(({ rows }) => rows[0] ? JSON.parse(rows[0].sess) : null)
      .then(value => callback(null, value), callback);
  }

  async claimRoundImage(sid, roundId, imageId, now = Date.now()) {
    const result = await this.db.execute({
      sql: `UPDATE sessions SET sess = json_insert(sess, '$.randomRound.guessedIds[#]', ?)
        WHERE sid = ? AND expires_at > ?
          AND json_extract(sess, '$.randomRound.id') = ?
          AND json_extract(sess, '$.randomRound.expiresAt') > ?
          AND EXISTS (SELECT 1 FROM json_each(sess, '$.randomRound.imageIds') WHERE value = ?)
          AND NOT EXISTS (SELECT 1 FROM json_each(sess, '$.randomRound.guessedIds') WHERE value = ?)`,
      args: [imageId, sid, now, roundId, now, imageId, imageId],
    });
    return result.rowsAffected === 1;
  }

  set(sid, value, callback = () => {}) {
    Promise.resolve().then(() => {
      const expiry = value.cookie?.expires ? new Date(value.cookie.expires).getTime()
        : Date.now() + 30 * 24 * 60 * 60 * 1000;
      return this.db.batch([
        { sql: "DELETE FROM sessions WHERE expires_at <= ?", args: [Date.now()] },
        { sql: `INSERT INTO sessions (sid, sess, expires_at) VALUES (?, ?, ?)
          ON CONFLICT(sid) DO UPDATE SET
            sess = ${mergedSession},
            expires_at = excluded.expires_at`,
          args: [sid, JSON.stringify(value), expiry] },
      ], "write");
    }).then(() => callback(null), callback);
  }

  touch(sid, value, callback = () => {}) {
    const expiry = value.cookie?.expires ? new Date(value.cookie.expires).getTime()
      : Date.now() + 30 * 24 * 60 * 60 * 1000;
    this.db.execute({ sql: "UPDATE sessions SET expires_at = ? WHERE sid = ?", args: [expiry, sid] })
      .then(() => callback(null), callback);
  }

  destroy(sid, callback = () => {}) {
    this.db.execute({ sql: "DELETE FROM sessions WHERE sid = ?", args: [sid] })
      .then(() => callback(null), callback);
  }
}
