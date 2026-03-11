// backend/middleware/authMiddleware.js
const jwt = require("jsonwebtoken");

exports.protect = (req, res, next) => {
  let token = null;

  // Accept token from Authorization header "Bearer <token>"
  if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
    token = req.headers.authorization.split(" ")[1];
  }

  if (!token) return res.status(401).json({ message: "Not authorized, token missing" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.id;
    next();
  } catch (err) {
    return res.status(401).json({ message: "Not authorized, token invalid" });
  }
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
