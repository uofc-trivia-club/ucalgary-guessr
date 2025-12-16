// server/db/init.js

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import Database from "better-sqlite3";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, "dev.db");
const schemaPath = path.join(__dirname, "schema.sql");
const seedPath = path.join(__dirname, "seed.sql");

const schemaSQL = fs.readFileSync(schemaPath, "utf8");
const seedSQL = fs.readFileSync(seedPath, "utf8");

const db = new Database(dbPath);

db.exec(schemaSQL);
db.exec(seedSQL);

console.log("SQLite dev.db initialised with schema + seed data.");
db.close();
