import { createDatabaseClient } from "../config/databaseClient.js";
import { initializeDatabase } from "./initialize.js";

const db = createDatabaseClient();
try {
  await initializeDatabase(db);
  console.log("Database schema and bundled photos initialized; existing accounts and scores preserved.");
} finally {
  db.close();
}
