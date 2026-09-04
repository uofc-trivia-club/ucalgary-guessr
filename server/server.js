// server/server.js

import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import roundsRouter from "./routes/rounds.js";  

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.use(express.static(path.join(__dirname, "..", "public")));

app.use("/api/rounds", roundsRouter);

app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});
