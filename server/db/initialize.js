import { readFileSync } from "node:fs";

export async function initializeDatabase(db) {
  // Upgrade old databases before creating indexes that reference newer columns.
  for (const [table, additions] of Object.entries({
    daily_scores: { elapsed_ms: "INTEGER CHECK (elapsed_ms >= 0)", result_json: "TEXT" },
    photos: { photo_pool: "TEXT NOT NULL DEFAULT 'standard' CHECK (photo_pool IN ('standard', 'weekly'))", answer_building_name: "TEXT", answer_building_latitude: "REAL", answer_building_longitude: "REAL" },
  })) {
    const { rows } = await db.execute(`PRAGMA table_info(${table})`);
    if (!rows.length) continue;
    for (const [name, type] of Object.entries(additions)) {
      if (rows.some(column => column.name === name)) continue;
      try {
        await db.execute(`ALTER TABLE ${table} ADD COLUMN ${name} ${type}`);
      } catch (error) {
        // Another cold start may have applied the same additive migration.
        const current = await db.execute(`PRAGMA table_info(${table})`);
        if (!current.rows.some(column => column.name === name)) throw error;
      }
    }
  }
  await db.executeMultiple(readFileSync(new URL("./schema.sql", import.meta.url), "utf8"));
  // Bundled photo IDs stay stable: upsert paths, answers, and pools without
  // replacing rows or touching custom photos, accounts, challenges, or scores.
  await db.executeMultiple(readFileSync(new URL("./seed.sql", import.meta.url), "utf8"));
}
