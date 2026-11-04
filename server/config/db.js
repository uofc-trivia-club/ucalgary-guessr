import { createDatabaseClient } from "./databaseClient.js";
import { initializeDatabase } from "../db/initialize.js";

const db = createDatabaseClient();
await initializeDatabase(db);
export default db;
