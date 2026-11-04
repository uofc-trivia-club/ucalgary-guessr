import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import express from "express";
import { placeholderPhoto } from "./fixtures/photo-files.js";

// Never rebuild the user's database or reuse their accounts and sessions.
fs.mkdirSync(".tmp", { recursive: true });
const directory = fs.mkdtempSync(path.resolve(".tmp", "guessr-browser-"));
process.env.GUESSR_DB_PATH = path.join(directory, "game.db");
const db = new Database(process.env.GUESSR_DB_PATH);
try {
  db.exec(fs.readFileSync("server/db/schema.sql", "utf8"));
  db.exec(fs.readFileSync("server/db/seed.sql", "utf8"));
} finally {
  db.close();
}

const { default: app } = await import("../app.js");

// Game photos are not distributed with the public repository. When a
// registered photo is missing locally, serve a placeholder so gameplay tests
// still exercise loading, zooming, and results. Real photos are used when present.
const photoDir = path.resolve("public/assets/photos");

const server = express();
server.use("/assets/photos", (req, res, next) => {
  const file = path.join(photoDir, decodeURIComponent(req.path));
  if (!file.startsWith(photoDir + path.sep) || fs.existsSync(file)) return next();
  res.type("image/svg+xml").send(placeholderPhoto);
});
server.use(app);

const PORT = process.env.PORT || 3000;
server.listen(PORT, "0.0.0.0", () => {
  console.log(`Test server running on http://localhost:${PORT}`);
});
