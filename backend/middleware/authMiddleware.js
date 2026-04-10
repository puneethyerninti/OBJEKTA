// backend/middleware/authMiddleware.js
const jwt = require("jsonwebtoken");

function extractToken(req, { allowQueryToken = false } = {}) {
  let token = null;

  // Accept token from Authorization header "Bearer <token>"
  if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
    token = req.headers.authorization.split(" ")[1];
  }

  // Fallback: check cookies (accessToken or objekta_token)
  if (!token && req.cookies) {
    token = req.cookies.accessToken || req.cookies.objekta_token || null;
  }

  // Optional fallback: query param token (websocket-only compatibility)
  if (!token && allowQueryToken && req.query && req.query.token) {
    token = req.query.token;
  }

  return token;
}

function verifyAccessToken(token) {
  if (!token) return null;
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch (_err) {
    return null;
  }
}

exports.protect = (req, res, next) => {
  const token = extractToken(req);

  if (!token) return res.status(401).json({ message: "Not authorized, token missing" });

  const decoded = verifyAccessToken(token);
  if (!decoded) {
    return res.status(401).json({ message: "Not authorized, token invalid" });
  }

  req.userId = decoded.id;
  req.user = { id: decoded.id, _id: decoded.id };
  next();
};

/**
 * Role-based authorization middleware.
 * Usage: authorize("admin") or authorize("admin", "seller")
 */
exports.authorize = (...roles) => {
  return async (req, res, next) => {
    try {
      // req.userId must be set by protect middleware
      if (!req.userId) return res.status(401).json({ message: "Not authorized" });

      const User = require("../models/User");
      const user = await User.findById(req.userId).select("role suspended").lean();
      if (!user) return res.status(404).json({ message: "User not found" });

      if (user.suspended) {
        return res.status(403).json({ message: "Account suspended" });
      }

      if (!roles.includes(user.role)) {
        return res.status(403).json({ message: `Access denied. Required role: ${roles.join(" or ")}` });
      }

      req.userRole = user.role;
      next();
    } catch (err) {
      return res.status(500).json({ message: "Authorization error" });
    }
  };
};

exports.extractToken = extractToken;
exports.verifyAccessToken = verifyAccessToken;
