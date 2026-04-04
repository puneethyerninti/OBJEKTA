// backend/routes/auth.js
const express = require("express");
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

// Public
router.post("/register", registerUser);
router.post("/login", loginUser);
router.post("/oauth", oauthLogin);
router.post("/refresh", refreshToken);
router.get("/verify-email", verifyEmail);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);

// OTP-based login (passwordless or as 2FA)
router.post("/login/otp/request", requestLoginOTP);
router.post("/login/otp/verify", verifyLoginOTP);

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
