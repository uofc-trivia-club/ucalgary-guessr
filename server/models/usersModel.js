import db from "../config/db.js";

const PUBLIC_USER_COLUMNS = "id, username, email, created_at";

export async function createUser({ username, email, passwordHash }) {
  const { rows } = await db.execute({
    sql: `INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)
      RETURNING ${PUBLIC_USER_COLUMNS}`,
    args: [username, email, passwordHash],
  });
  return rows[0];
}

async function findUser(where, args, columns = PUBLIC_USER_COLUMNS) {
  const { rows } = await db.execute({ sql: `SELECT ${columns} FROM users WHERE ${where} LIMIT 1`, args });
  return rows[0];
}

export function getUserById(id) {
  return findUser("id = ?", [id]);
}

export function getUserByUsername(username) {
  return findUser("username = ? COLLATE NOCASE", [username]);
}

export function getUserByEmail(email) {
  return findUser("email = ? COLLATE NOCASE", [email]);
}

export function getUserByIdentifier(identifier) {
  return findUser("username = ? COLLATE NOCASE OR email = ? COLLATE NOCASE", [identifier, identifier]);
}

export function getUserWithPasswordByIdentifier(identifier) {
  return findUser("username = ? COLLATE NOCASE OR email = ? COLLATE NOCASE",
    [identifier, identifier], `${PUBLIC_USER_COLUMNS}, password_hash`);
}

export async function updateUserPassword(userId, passwordHash) {
  const { rows } = await db.execute({
    sql: `UPDATE users SET password_hash = ? WHERE id = ? RETURNING ${PUBLIC_USER_COLUMNS}`,
    args: [passwordHash, userId],
  });
  return rows[0] || null;
}

export function toPublicUser(user) {
  if (!user) return null;
  return { id: user.id, username: user.username, email: user.email, createdAt: user.created_at };
}
