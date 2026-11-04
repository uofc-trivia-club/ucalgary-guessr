import "dotenv/config";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import { createClient } from "@libsql/client";

export function createDatabaseClient(env = process.env) {
  // Explicit paths keep tests isolated even when .env contains Turso credentials.
  const localPath = env.GUESSR_DB_PATH;
  const url = localPath === ":memory:" ? ":memory:"
    : localPath ? pathToFileURL(path.resolve(localPath)).href
    : env.TURSO_DATABASE_URL?.trim();
  if (env.VERCEL || env.NODE_ENV === "production") {
    if (!url || url.startsWith("file:") || url === ":memory:") {
      throw new Error("TURSO_DATABASE_URL must point to a remote database in production.");
    }
  }
  if (url && !url.startsWith("file:") && url !== ":memory:" && !env.TURSO_AUTH_TOKEN?.trim()) {
    throw new Error("TURSO_AUTH_TOKEN must be set when using a remote Turso database.");
  }
  return createClient({
    url: url || pathToFileURL(fileURLToPath(new URL("../db/dev.db", import.meta.url))).href,
    authToken: localPath ? undefined : env.TURSO_AUTH_TOKEN?.trim() || undefined,
    intMode: "number",
  });
}
