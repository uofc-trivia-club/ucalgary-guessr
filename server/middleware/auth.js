// server/middleware/auth.js

export function getSessionUserId(req) {
  const userId = req.session?.userId;
  return Number.isInteger(userId) && userId > 0 ? userId : null;
}

export function requireAuth(req, res, next) {
  const userId = getSessionUserId(req);

  if (!userId) {
    return res.status(401).json({ error: "You must be logged in." });
  }

  req.authUserId = userId;
  next();
}
