// server/routes/auth.js

import crypto from "crypto";
import express from "express";
import bcrypt from "bcrypt";
import {
  createUser,
  getUserByEmail,
  getUserById,
  getUserByIdentifier,
  getUserByUsername,
  getUserWithPasswordByIdentifier,
  toPublicUser,
  updateUserPassword,
} from "../models/usersModel.js";
import {
  cleanupAuthTokens,
  consumeAuthToken,
  createAuthToken,
  invalidateAuthTokens,
} from "../models/authTokensModel.js";
import {
  sendMagicLoginEmail,
  sendPasswordResetEmail,
} from "../services/emailService.js";
import { getSessionUserId } from "../middleware/auth.js";
import { carryDailyAttempt } from "../utils/dailyAttempt.js";
import { isUniqueConstraintError } from "../utils/databaseErrors.js";

const router = express.Router();
const BCRYPT_ROUNDS = 12;
const SESSION_COOKIE_NAME = "ucalgary_guessr.sid";
const USERNAME_PATTERN = /^[A-Za-z0-9_-]{3,30}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAGIC_LINK_TTL_MS = 15 * 60 * 1000;
const PASSWORD_RESET_TTL_MS = 30 * 60 * 1000;

const MAGIC_LINK_RESPONSE =
  "If an account matches that email, a login link has been sent.";
const PASSWORD_RESET_RESPONSE =
  "If an account matches that username or email, a password-reset link has been sent.";

function establishSession(req, userId) {
  return new Promise((resolve, reject) => {
    const previousSession = req.session;
    req.session.regenerate((error) => {
      if (error) {
        reject(error);
        return;
      }

      req.session.userId = userId;
      carryDailyAttempt(previousSession, req.session);
      req.session.save((saveError) => {
        if (saveError) reject(saveError);
        else resolve();
      });
    });
  });
}

function randomToken() {
  return crypto.randomBytes(32).toString("base64url");
}

function hashToken(token) {
  return crypto.createHash("sha256").update(token, "utf8").digest("hex");
}

function buildBaseUrl(req) {
  const configured = String(process.env.APP_BASE_URL || "").trim();
  if (configured) return configured.replace(/\/+$/, "");
  return `${req.protocol}://${req.get("host")}`;
}

async function createStoredToken({ userId, purpose, ttlMs }) {
  await cleanupAuthTokens();

  const token = randomToken();
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + ttlMs).toISOString();

  await createAuthToken({
    userId,
    tokenHash,
    purpose,
    expiresAt,
  });

  return token;
}

router.get("/me", async (req, res) => {
  const userId = getSessionUserId(req);
  if (!userId) {
    return res.json({ user: null });
  }

  const user = await getUserById(userId);
  if (!user) {
    req.session.destroy(() => {});
    return res.json({ user: null });
  }

  return res.json({ user: toPublicUser(user) });
});

router.post("/register", async (req, res) => {
  const username = String(req.body?.username || "").trim();
  const email = String(req.body?.email || "").trim().toLowerCase();
  const password = typeof req.body?.password === "string" ? req.body.password : "";

  if (!USERNAME_PATTERN.test(username)) {
    return res.status(400).json({
      error: "Username must be 3–30 characters using letters, numbers, underscores, or hyphens.",
    });
  }

  if (!EMAIL_PATTERN.test(email) || email.length > 254) {
    return res.status(400).json({ error: "Enter a valid email address." });
  }

  if (password.length < 8 || password.length > 128) {
    return res.status(400).json({ error: "Password must be 8–128 characters." });
  }

  if (await getUserByUsername(username)) {
    return res.status(409).json({ error: "That username is already in use." });
  }

  if (await getUserByEmail(email)) {
    return res.status(409).json({ error: "An account with that email already exists." });
  }

  try {
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const user = await createUser({ username, email, passwordHash });
    await establishSession(req, user.id);

    return res.status(201).json({ user: toPublicUser(user) });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return res.status(409).json({ error: "That username or email is already in use." });
    }

    console.error("Register error:", error);
    return res.status(500).json({ error: "Failed to create account." });
  }
});

router.post("/login", async (req, res) => {
  const identifier = String(req.body?.identifier || "").trim();
  const password = typeof req.body?.password === "string" ? req.body.password : "";

  if (!identifier || !password) {
    return res.status(400).json({ error: "Username/email and password are required." });
  }

  try {
    const user = await getUserWithPasswordByIdentifier(identifier);
    const valid = user ? await bcrypt.compare(password, user.password_hash) : false;

    if (!valid) {
      return res.status(401).json({ error: "Invalid username/email or password." });
    }

    await establishSession(req, user.id);
    return res.json({ user: toPublicUser(user) });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({ error: "Failed to log in." });
  }
});

router.post("/magic-link", async (req, res) => {
  const email = String(req.body?.email || "").trim().toLowerCase();

  if (!EMAIL_PATTERN.test(email) || email.length > 254) {
    return res.status(400).json({ error: "Enter a valid email address." });
  }

  try {
    const user = await getUserByEmail(email);

    if (user) {
      const token = await createStoredToken({
        userId: user.id,
        purpose: "magic_login",
        ttlMs: MAGIC_LINK_TTL_MS,
      });

      const loginUrl = `${buildBaseUrl(req)}/api/auth/magic?token=${encodeURIComponent(token)}`;
      await sendMagicLoginEmail({ to: user.email, loginUrl });
    }

    return res.json({ message: MAGIC_LINK_RESPONSE });
  } catch (error) {
    console.error("Magic-link request error:", error);
    return res.status(500).json({ error: "Failed to request a login link." });
  }
});

router.get("/magic", async (req, res) => {
  const token = String(req.query?.token || "");
  if (!token) {
    return res.redirect(303, "/?login=invalid");
  }

  try {
    const record = await consumeAuthToken({
      tokenHash: hashToken(token),
      purpose: "magic_login",
      nowIso: new Date().toISOString(),
    });

    if (!record) {
      return res.redirect(303, "/?login=invalid");
    }

    const user = await getUserById(record.user_id);
    if (!user) {
      return res.redirect(303, "/?login=invalid");
    }

    await establishSession(req, user.id);
    return res.redirect(303, "/?login=magic");
  } catch (error) {
    console.error("Magic-login error:", error);
    return res.redirect(303, "/?login=invalid");
  }
});

router.post("/forgot-password", async (req, res) => {
  const identifier = String(req.body?.identifier || "").trim();

  if (!identifier || identifier.length > 254) {
    return res.status(400).json({ error: "Enter your username or email address." });
  }

  try {
    const user = await getUserByIdentifier(identifier);

    if (user) {
      const token = await createStoredToken({
        userId: user.id,
        purpose: "password_reset",
        ttlMs: PASSWORD_RESET_TTL_MS,
      });

      const resetUrl = `${buildBaseUrl(req)}/reset-password?token=${encodeURIComponent(token)}`;
      await sendPasswordResetEmail({ to: user.email, resetUrl });
    }

    return res.json({ message: PASSWORD_RESET_RESPONSE });
  } catch (error) {
    console.error("Password-reset request error:", error);
    return res.status(500).json({ error: "Failed to request a password reset." });
  }
});

router.post("/reset-password", async (req, res) => {
  const token = String(req.body?.token || "");
  const password = typeof req.body?.password === "string" ? req.body.password : "";

  if (!token) {
    return res.status(400).json({ error: "Password-reset token is required." });
  }

  if (password.length < 8 || password.length > 128) {
    return res.status(400).json({ error: "Password must be 8–128 characters." });
  }

  try {
    const record = await consumeAuthToken({
      tokenHash: hashToken(token),
      purpose: "password_reset",
      nowIso: new Date().toISOString(),
    });

    if (!record) {
      return res.status(400).json({ error: "This password-reset link is invalid or has expired." });
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const user = await updateUserPassword(record.user_id, passwordHash);

    if (!user) {
      return res.status(400).json({ error: "This password-reset link is invalid." });
    }

    await invalidateAuthTokens(user.id, "password_reset");
    await invalidateAuthTokens(user.id, "magic_login");
    await establishSession(req, user.id);

    return res.json({ user: toPublicUser(user) });
  } catch (error) {
    console.error("Password-reset error:", error);
    return res.status(500).json({ error: "Failed to reset password." });
  }
});

router.post("/logout", (req, res) => {
  if (!req.session) {
    res.clearCookie(SESSION_COOKIE_NAME);
    return res.json({ ok: true });
  }

  const previousSession = req.session;
  req.session.regenerate((error) => {
    if (error) {
      console.error("Logout error:", error);
      return res.status(500).json({ error: "Failed to log out." });
    }

    carryDailyAttempt(previousSession, req.session);
    req.session.save((saveError) => {
      if (saveError) return res.status(500).json({ error: "Failed to log out." });
      return res.json({ ok: true });
    });
  });
});

export default router;
