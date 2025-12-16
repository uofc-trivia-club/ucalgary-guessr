-- server/db/schema.sql

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS photos (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  image_id   TEXT NOT NULL UNIQUE,
  image_path TEXT NOT NULL,
  answer_x   REAL NOT NULL,
  answer_y   REAL NOT NULL
);
