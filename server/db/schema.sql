-- server/db/schema.sql

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS photos (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  image_id         TEXT NOT NULL UNIQUE,
  image_path                TEXT NOT NULL,
  photo_pool                TEXT NOT NULL DEFAULT 'standard' CHECK (photo_pool IN ('standard', 'weekly')),
  answer_latitude           REAL NOT NULL,
  answer_longitude          REAL NOT NULL,
  answer_building_name      TEXT,
  answer_building_latitude  REAL,
  answer_building_longitude REAL,

  CHECK (
    (answer_building_latitude IS NULL AND answer_building_longitude IS NULL) OR
    (answer_building_latitude IS NOT NULL AND answer_building_longitude IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_photos_pool ON photos (photo_pool, id);

CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  username      TEXT NOT NULL COLLATE NOCASE UNIQUE,
  email         TEXT NOT NULL COLLATE NOCASE UNIQUE,
  password_hash TEXT NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS auth_tokens (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  purpose    TEXT NOT NULL CHECK (purpose IN ('magic_login', 'password_reset')),
  expires_at TEXT NOT NULL,
  used_at    TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),

  FOREIGN KEY (user_id) REFERENCES users(id)
    ON UPDATE CASCADE
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_auth_tokens_lookup
  ON auth_tokens (token_hash, purpose, used_at, expires_at);

CREATE INDEX IF NOT EXISTS idx_auth_tokens_user_purpose
  ON auth_tokens (user_id, purpose, used_at);

CREATE TABLE IF NOT EXISTS daily_challenges (
  challenge_date TEXT PRIMARY KEY,
  image_id       TEXT NOT NULL,
  created_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),

  FOREIGN KEY (image_id) REFERENCES photos(image_id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS daily_scores (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id           INTEGER NOT NULL,
  challenge_date    TEXT NOT NULL,
  score             INTEGER NOT NULL CHECK (score BETWEEN 0 AND 5000),
  distance_metres   REAL NOT NULL CHECK (distance_metres >= 0),
  elapsed_ms        INTEGER CHECK (elapsed_ms >= 0),
  result_json       TEXT,
  submitted_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),

  FOREIGN KEY (user_id) REFERENCES users(id)
    ON UPDATE CASCADE
    ON DELETE CASCADE,

  FOREIGN KEY (challenge_date) REFERENCES daily_challenges(challenge_date)
    ON UPDATE CASCADE
    ON DELETE CASCADE,

  UNIQUE (user_id, challenge_date)
);

CREATE INDEX IF NOT EXISTS idx_daily_scores_leaderboard
  ON daily_scores (challenge_date, score DESC, distance_metres ASC, elapsed_ms ASC, submitted_at ASC, id ASC);

CREATE TABLE IF NOT EXISTS sessions (
  sid TEXT PRIMARY KEY,
  sess TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_expiry ON sessions (expires_at);

-- Weekly challenge_date is the Sunday starting the Mountain-time week.
CREATE TABLE IF NOT EXISTS weekly_challenges (
  challenge_date TEXT PRIMARY KEY,
  image_id       TEXT NOT NULL,
  created_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),

  FOREIGN KEY (image_id) REFERENCES photos(image_id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS weekly_scores (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id           INTEGER NOT NULL,
  challenge_date    TEXT NOT NULL,
  score             INTEGER NOT NULL CHECK (score BETWEEN 0 AND 5000),
  distance_metres   REAL NOT NULL CHECK (distance_metres >= 0),
  elapsed_ms        INTEGER CHECK (elapsed_ms >= 0),
  result_json       TEXT,
  submitted_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),

  FOREIGN KEY (user_id) REFERENCES users(id)
    ON UPDATE CASCADE
    ON DELETE CASCADE,

  FOREIGN KEY (challenge_date) REFERENCES weekly_challenges(challenge_date)
    ON UPDATE CASCADE
    ON DELETE CASCADE,

  UNIQUE (user_id, challenge_date)
);

CREATE INDEX IF NOT EXISTS idx_weekly_scores_leaderboard
  ON weekly_scores (challenge_date, score DESC, distance_metres ASC, elapsed_ms ASC, submitted_at ASC, id ASC);
