// backend/routes/auth.js
const express = require("express");
const rateLimit = require("express-rate-limit");
const router = express.Router();
const {
  registerUser, loginUser, getMe, oauthLogin,
  refreshToken, verifyEmail, resendVerification,
  forgotPassword, resetPassword,
  requestLoginOTP, verifyLoginOTP,
  setup2FA, verify2FA, disable2FA,
  adminListUsers, adminSetRole, adminSuspendUser, adminStats,
} = require("../controllers/authController");
const { protect, authorize } = require("../middleware/authMiddleware");

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number.parseInt(process.env.AUTH_RATE_LIMIT_MAX || "60", 10),
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many auth attempts" },
});

const strictAuthLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number.parseInt(process.env.AUTH_STRICT_RATE_LIMIT_MAX || "20", 10),
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many sensitive auth requests" },
});

// Public
router.post("/register", authLimiter, registerUser);
router.post("/login", strictAuthLimiter, loginUser);
router.post("/oauth", strictAuthLimiter, oauthLogin);
router.post("/refresh", strictAuthLimiter, refreshToken);
router.get("/verify-email", verifyEmail);
router.post("/forgot-password", strictAuthLimiter, forgotPassword);
router.post("/reset-password", strictAuthLimiter, resetPassword);

// OTP-based login (passwordless or as 2FA)
router.post("/login/otp/request", strictAuthLimiter, requestLoginOTP);
router.post("/login/otp/verify", strictAuthLimiter, verifyLoginOTP);

// Protected
router.get("/me", protect, getMe);
router.post("/resend-verification", protect, resendVerification);

// 2FA
router.post("/2fa/setup", protect, setup2FA);
router.post("/2fa/verify", protect, verify2FA);
router.post("/2fa/disable", protect, disable2FA);

// Admin
router.get("/admin/users", protect, authorize("admin"), adminListUsers);
router.get("/admin/stats", protect, authorize("admin"), adminStats);
router.put("/admin/users/:id/role", protect, authorize("admin"), adminSetRole);
router.put("/admin/users/:id/suspend", protect, authorize("admin"), adminSuspendUser);

module.exports = router;
