import db from "../config/db.js";

export async function createAuthToken({ userId, tokenHash, purpose, expiresAt }) {
  // A new link supersedes older unused links atomically.
  const results = await db.batch([
    { sql: "DELETE FROM auth_tokens WHERE user_id = ? AND purpose = ? AND used_at IS NULL",
      args: [userId, purpose] },
    { sql: "INSERT INTO auth_tokens (user_id, token_hash, purpose, expires_at) VALUES (?, ?, ?, ?)",
      args: [userId, tokenHash, purpose, expiresAt] },
  ], "write");
  return Number(results[1].lastInsertRowid);
}

export async function consumeAuthToken({ tokenHash, purpose, nowIso }) {
  // One conditional write prevents two instances from consuming the same link.
  const { rows } = await db.execute({
    sql: `UPDATE auth_tokens SET used_at = ?
      WHERE token_hash = ? AND purpose = ? AND used_at IS NULL AND expires_at > ?
      RETURNING id, user_id, token_hash, purpose, expires_at, created_at`,
    args: [nowIso, tokenHash, purpose, nowIso],
  });
  return rows[0] || null;
}

export async function invalidateAuthTokens(userId, purpose, nowIso = new Date().toISOString()) {
  await db.execute({
    sql: "UPDATE auth_tokens SET used_at = ? WHERE user_id = ? AND purpose = ? AND used_at IS NULL",
    args: [nowIso, userId, purpose],
  });
}

export async function cleanupAuthTokens(now = new Date()) {
  await db.execute({
    sql: "DELETE FROM auth_tokens WHERE expires_at < ? OR (used_at IS NOT NULL AND used_at < ?)",
    args: [now.toISOString(), new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()],
  });
}
