// Express application shared by Vercel and the local server.

import "dotenv/config";
import express from "express";
import session from "express-session";
import path from "path";
import { fileURLToPath } from "url";
import authRouter from "./server/routes/auth.js";
import dailyRouter from "./server/routes/daily.js";
import weeklyRouter from "./server/routes/weekly.js";
import roundsRouter from "./server/routes/rounds.js";
import { validateEmailConfiguration } from "./server/services/emailService.js";
import LibsqlSessionStore from "./server/services/sessionStore.js";
import db from "./server/config/db.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.join(__dirname, "public");
const indexPath = path.join(publicDir, "index.html");

const app = express();
const IS_PRODUCTION = process.env.NODE_ENV === "production";
const SESSION_COOKIE_NAME = "ucalgary_guessr.sid";

const sessionSecret = process.env.SESSION_SECRET || "dev-only-change-me-before-production";

if (IS_PRODUCTION && !process.env.SESSION_SECRET) {
  throw new Error("SESSION_SECRET must be set in production.");
}

if (!IS_PRODUCTION && !process.env.SESSION_SECRET) {
  console.warn("Using development SESSION_SECRET. Set SESSION_SECRET before deploying.");
}

validateEmailConfiguration();

if (IS_PRODUCTION) {
  app.set("trust proxy", 1);
}

app.disable("x-powered-by");
app.use(express.json({ limit: "16kb" }));

app.use(
  session({
    name: SESSION_COOKIE_NAME,
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    store: new LibsqlSessionStore(db),
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: IS_PRODUCTION,
      maxAge: 30 * 24 * 60 * 60 * 1000,
    },
  })
);

app.use("/api/auth", authRouter);
app.use("/api/daily", dailyRouter);
app.use("/api/weekly", weeklyRouter);
app.use("/api/rounds", roundsRouter);

app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

app.use(express.static(publicDir));

// These are real browser routes. They all render the same frontend shell,
// and main.js selects the correct view from window.location.pathname.
app.get(["/", "/play", "/weekly", "/daily", "/reset-password"], (req, res) => {
  res.sendFile(indexPath);
});

app.use("/api", (req, res) => {
  res.status(404).json({ error: "API route not found." });
});

app.use((error, req, res, next) => {
  console.error("Request error:", error);
  if (res.headersSent) return next(error);
  return res.status(500).json({ error: "An unexpected server error occurred." });
});

export default app;
