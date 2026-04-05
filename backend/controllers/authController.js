// backend/controllers/authController.js
const User = require("../models/User");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { sendEmail, verificationEmail, resetPasswordEmail } = require("../services/emailService");

const FRONTEND_URL = process.env.FRONTEND_URL || process.env.FRONTEND_ORIGIN?.split(",")[0] || "http://localhost:5173";

const COOKIE_SECURE = process.env.COOKIE_SECURE
  ? process.env.COOKIE_SECURE === "true"
  : process.env.NODE_ENV === "production";

const rawSameSite = (process.env.COOKIE_SAMESITE || (COOKIE_SECURE ? "none" : "lax")).toLowerCase();
const COOKIE_SAMESITE = ["lax", "strict", "none"].includes(rawSameSite) ? rawSameSite : "lax";
const COOKIE_DOMAIN = process.env.COOKIE_DOMAIN || undefined;

// Environment-aware token expiration (longer in dev mode)
const ACCESS_TOKEN_EXPIRY = process.env.NODE_ENV === "production" ? "15m" : (process.env.ACCESS_TOKEN_EXPIRY || "7d");
const REFRESH_TOKEN_EXPIRY = process.env.NODE_ENV === "production" ? "7d" : (process.env.REFRESH_TOKEN_EXPIRY || "30d");

const generateAccessToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY });
};

const generateRefreshToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRY });
};

// Set refresh token as httpOnly cookie
const setRefreshCookie = (res, token, expiresAt) => {
  const sameSite = COOKIE_SAMESITE === "none" && !COOKIE_SECURE ? "lax" : COOKIE_SAMESITE;
  res.cookie("refreshToken", token, {
    httpOnly: true,
    secure: COOKIE_SECURE,
    sameSite,
    expires: expiresAt,
    path: "/api/auth/refresh",
    ...(COOKIE_DOMAIN ? { domain: COOKIE_DOMAIN } : {}),
  });
};

// POST /api/auth/register
exports.registerUser = async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) return res.status(400).json({ message: "Name, email and password are required" });
    if (password.length < 8) return res.status(400).json({ message: "Password must be at least 8 characters" });

    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ message: "Email already in use" });

    const user = await User.create({ name, email, password });

    // Generate email verification token
    const verifyToken = user.generateVerificationToken();
    await user.save({ validateBeforeSave: false });

    // Send verification email
    const verifyUrl = `${FRONTEND_URL}/verify-email?token=${verifyToken}`;
    const emailContent = verificationEmail(name, verifyUrl);
    await sendEmail({ to: email, ...emailContent });

    // Generate tokens
    const accessToken = generateAccessToken(user._id);
    const { token: refreshToken, expiresAt } = user.generateRefreshToken();
    await user.save({ validateBeforeSave: false });

    setRefreshCookie(res, refreshToken, expiresAt);

    res.status(201).json({
      user: { id: user._id, name: user.name, email: user.email, emailVerified: false },
      token: accessToken,
      message: "Registration successful. Please check your email to verify your account.",
    });
  } catch (err) {
    console.error("registerUser error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// POST /api/auth/login
exports.loginUser = async (req, res) => {
  try {
    const { email, password, totpCode } = req.body;
    if (!email || !password) return res.status(400).json({ message: "Email and password are required" });

    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ message: "Invalid credentials" });

    if (user.suspended) {
      return res.status(403).json({ message: "Account suspended", reason: user.suspendedReason });
    }

    const isMatch = await user.matchPassword(password);
    if (!isMatch) return res.status(401).json({ message: "Invalid credentials" });

    // Check 2FA
    if (user.twoFactorEnabled) {
      if (!totpCode) {
        return res.status(200).json({ requiresTwoFactor: true, message: "2FA code required" });
      }
      // Verify TOTP
      const { TOTP } = require("otpauth");
      const totp = new TOTP({ secret: user.twoFactorSecret, algorithm: "SHA1", digits: 6, period: 30 });
      const valid = totp.validate({ token: totpCode, window: 1 }) !== null;
      if (!valid) {
        // Try backup code
        const backupValid = user.verifyBackupCode(totpCode);
        if (!backupValid) {
          return res.status(401).json({ message: "Invalid 2FA code" });
        }
        await user.save({ validateBeforeSave: false });
      }
    }

    // Generate tokens
    const accessToken = generateAccessToken(user._id);
    const { token: refreshToken, expiresAt } = user.generateRefreshToken();
    await user.save({ validateBeforeSave: false });

    setRefreshCookie(res, refreshToken, expiresAt);

    res.json({
      user: {
        id: user._id, name: user.name, email: user.email,
        role: user.role, emailVerified: user.emailVerified,
        twoFactorEnabled: user.twoFactorEnabled,
      },
      token: accessToken,
    });
  } catch (err) {
    console.error("loginUser error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// POST /api/auth/oauth (Google)
exports.oauthLogin = async (req, res) => {
  try {
    const { provider, id_token } = req.body || {};
    if (!provider || !id_token) return res.status(400).json({ message: "provider and id_token required" });
    if (provider !== 'google') return res.status(400).json({ message: 'unsupported provider' });

    const { OAuth2Client } = require('google-auth-library');
    const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
    const ticket = await client.verifyIdToken({ idToken: id_token, audience: process.env.GOOGLE_CLIENT_ID });
    const payload = ticket.getPayload();
    if (!payload || !payload.email) return res.status(400).json({ message: 'invalid token payload' });

    const email = payload.email;
    const name = payload.name || payload.email.split('@')[0];
    const avatar = payload.picture || null;

    let user = await User.findOne({ email });
    if (!user) {
      user = await User.create({
        name, email, password: null, avatar,
        oauthProvider: 'google', emailVerified: true,
      });
    } else if (user.suspended) {
      return res.status(403).json({ message: "Account suspended", reason: user.suspendedReason });
    }

    // OAuth users are auto-verified
    if (!user.emailVerified) {
      user.emailVerified = true;
      await user.save({ validateBeforeSave: false });
    }

    const accessToken = generateAccessToken(user._id);
    const { token: refreshToken, expiresAt } = user.generateRefreshToken();
    await user.save({ validateBeforeSave: false });

    setRefreshCookie(res, refreshToken, expiresAt);

    res.json({
      user: { id: user._id, name: user.name, email: user.email, avatar, role: user.role, emailVerified: true },
      token: accessToken,
    });
  } catch (err) {
    console.error('oauthLogin error:', err);
    res.status(500).json({ message: 'OAuth verification failed' });
  }
};

// POST /api/auth/refresh — exchange refresh token for new access + refresh tokens
exports.refreshToken = async (req, res) => {
  try {
    const token = req.cookies?.refreshToken || req.body?.refreshToken;
    if (!token) return res.status(401).json({ message: "Refresh token required" });

    // Find user with this refresh token
    const hashed = crypto.createHash("sha256").update(token).digest("hex");
    const user = await User.findOne({ "refreshTokens.token": hashed });
    if (!user) return res.status(401).json({ message: "Invalid refresh token" });

    if (user.suspended) {
      return res.status(403).json({ message: "Account suspended" });
    }

    // Verify & rotate
    const valid = user.verifyRefreshToken(token);
    if (!valid) return res.status(401).json({ message: "Expired or invalid refresh token" });

    // Issue new tokens
    const accessToken = generateAccessToken(user._id);
    const { token: newRefreshToken, expiresAt } = user.generateRefreshToken();
    await user.save({ validateBeforeSave: false });

    setRefreshCookie(res, newRefreshToken, expiresAt);

    res.json({
      token: accessToken,
      user: { id: user._id, name: user.name, email: user.email, role: user.role },
    });
  } catch (err) {
    console.error("refreshToken error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// GET /api/auth/verify-email?token=xxx
exports.verifyEmail = async (req, res) => {
  try {
    const { token } = req.query;
    if (!token) return res.status(400).json({ message: "Token required" });

    const hashed = crypto.createHash("sha256").update(token).digest("hex");
    const user = await User.findOne({
      verificationToken: hashed,
      verificationTokenExpires: { $gt: new Date() },
    });

    if (!user) return res.status(400).json({ message: "Invalid or expired verification token" });

    user.emailVerified = true;
    user.verificationToken = null;
    user.verificationTokenExpires = null;
    await user.save({ validateBeforeSave: false });

    res.json({ message: "Email verified successfully" });
  } catch (err) {
    console.error("verifyEmail error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// POST /api/auth/resend-verification
exports.resendVerification = async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: "User not found" });
    if (user.emailVerified) return res.json({ message: "Email already verified" });

    const verifyToken = user.generateVerificationToken();
    await user.save({ validateBeforeSave: false });

    const verifyUrl = `${FRONTEND_URL}/verify-email?token=${verifyToken}`;
    const emailContent = verificationEmail(user.name, verifyUrl);
    await sendEmail({ to: user.email, ...emailContent });

    res.json({ message: "Verification email sent" });
  } catch (err) {
    console.error("resendVerification error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// POST /api/auth/forgot-password
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: "Email required" });

    const user = await User.findOne({ email });
    // Always return success to prevent email enumeration
    if (!user) return res.json({ message: "If that email exists, a reset link has been sent" });

    const resetToken = user.generateResetToken();
    await user.save({ validateBeforeSave: false });

    const resetUrl = `${FRONTEND_URL}/reset-password?token=${resetToken}`;
    const emailContent = resetPasswordEmail(user.name, resetUrl);
    await sendEmail({ to: user.email, ...emailContent });

    res.json({ message: "If that email exists, a reset link has been sent" });
  } catch (err) {
    console.error("forgotPassword error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// POST /api/auth/reset-password
exports.resetPassword = async (req, res) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) return res.status(400).json({ message: "Token and password required" });
    if (password.length < 8) return res.status(400).json({ message: "Password must be at least 8 characters" });

    const hashed = crypto.createHash("sha256").update(token).digest("hex");
    const user = await User.findOne({
      resetPasswordToken: hashed,
      resetPasswordExpires: { $gt: new Date() },
    });

    if (!user) return res.status(400).json({ message: "Invalid or expired reset token" });

    user.password = password;
    user.resetPasswordToken = null;
    user.resetPasswordExpires = null;
    user.refreshTokens = []; // Invalidate all sessions
    await user.save();

    res.json({ message: "Password reset successful. Please log in." });
  } catch (err) {
    console.error("resetPassword error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// GET /api/auth/me
exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.userId).select("-password -twoFactorSecret -twoFactorBackupCodes -refreshTokens -verificationToken -resetPasswordToken");
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json({ user });
  } catch (err) {
    console.error("getMe error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// POST /api/auth/2fa/setup — generate TOTP secret + QR code
exports.setup2FA = async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: "User not found" });
    if (user.twoFactorEnabled) return res.status(400).json({ message: "2FA already enabled" });

    const { TOTP, Secret } = require("otpauth");
    const secret = new Secret({ size: 20 });

    const totp = new TOTP({
      issuer: "OBJEKTA",
      label: user.email,
      algorithm: "SHA1",
      digits: 6,
      period: 30,
      secret,
    });

    const uri = totp.toString();

    // Generate QR code as data URL
    const QRCode = require("qrcode");
    const qrDataUrl = await QRCode.toDataURL(uri);

    // Store secret temporarily (not enabled until verified)
    user.twoFactorSecret = secret.base32;
    await user.save({ validateBeforeSave: false });

    res.json({
      secret: secret.base32,
      qrCode: qrDataUrl,
      message: "Scan QR code with your authenticator app, then verify with a code.",
    });
  } catch (err) {
    console.error("setup2FA error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// POST /api/auth/2fa/verify — verify TOTP code and enable 2FA
exports.verify2FA = async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) return res.status(400).json({ message: "Code required" });

    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: "User not found" });
    if (user.twoFactorEnabled) return res.status(400).json({ message: "2FA already enabled" });
    if (!user.twoFactorSecret) return res.status(400).json({ message: "Run setup first" });

    const { TOTP } = require("otpauth");
    const totp = new TOTP({
      secret: user.twoFactorSecret,
      algorithm: "SHA1",
      digits: 6,
      period: 30,
    });

    const valid = totp.validate({ token: code, window: 1 }) !== null;
    if (!valid) return res.status(400).json({ message: "Invalid code. Try again." });

    user.twoFactorEnabled = true;
    const backupCodes = user.generateBackupCodes();
    await user.save({ validateBeforeSave: false });

    res.json({
      message: "2FA enabled successfully",
      backupCodes,
    });
  } catch (err) {
    console.error("verify2FA error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// POST /api/auth/2fa/disable — disable 2FA
exports.disable2FA = async (req, res) => {
  try {
    const { password } = req.body;
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    // Require password to disable 2FA
    if (user.password) {
      if (!password) return res.status(400).json({ message: "Password required to disable 2FA" });
      const isMatch = await user.matchPassword(password);
      if (!isMatch) return res.status(401).json({ message: "Invalid password" });
    }

    user.twoFactorEnabled = false;
    user.twoFactorSecret = null;
    user.twoFactorBackupCodes = [];
    await user.save({ validateBeforeSave: false });

    res.json({ message: "2FA disabled" });
  } catch (err) {
    console.error("disable2FA error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// POST /api/auth/login/otp/request — send OTP to email
exports.requestLoginOTP = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: "Email required" });

    const user = await User.findOne({ email });
    if (!user) {
      // Don't reveal if email exists (security)
      return res.json({ message: "If email exists, OTP has been sent", success: true });
    }

    if (user.suspended) {
      return res.status(403).json({ message: "Account suspended" });
    }

    // Generate 6-digit OTP
    const otp = user.generateLoginOTP();
    await user.save({ validateBeforeSave: false });

    // Send OTP via email (with simple fallback for dev)
    const { sendEmail, otpEmail } = require("../services/emailService");
    try {
      const emailContent = otpEmail(user.name, otp);
      await sendEmail({ to: email, ...emailContent });
    } catch (emailErr) {
      console.warn("[DEV] Email service failed, OTP:", otp);
      // In dev, still succeed but log OTP
    }

    res.json({
      message: "OTP sent to email",
      success: true,
      // For development/testing only - remove in production
      ...(process.env.NODE_ENV !== "production" && { otp })
    });
  } catch (err) {
    console.error("requestLoginOTP error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// POST /api/auth/login/otp/verify — verify OTP and login
exports.verifyLoginOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) return res.status(400).json({ message: "Email and OTP required" });

    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ message: "Invalid credentials" });

    if (user.suspended) {
      return res.status(403).json({ message: "Account suspended" });
    }

    // Verify OTP
    if (!user.verifyLoginOTP(otp)) {
      const remaining = 5 - user.otpAttempts;
      if (remaining <= 0) {
        return res.status(429).json({
          message: "Too many attempts. Request new OTP.",
          locked: true
        });
      }
      return res.status(401).json({
        message: "Invalid OTP",
        attemptsRemaining: remaining
      });
    }

    // Generate tokens
    const accessToken = generateAccessToken(user._id);
    const { token: refreshToken, expiresAt } = user.generateRefreshToken();
    await user.save({ validateBeforeSave: false });

    setRefreshCookie(res, refreshToken, expiresAt);

    res.json({
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        emailVerified: user.emailVerified,
      },
      token: accessToken,
      message: "Logged in successfully",
    });
  } catch (err) {
    console.error("verifyLoginOTP error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// ---------- Admin Endpoints ----------

// GET /api/auth/admin/users — list all users (admin only)
exports.adminListUsers = async (req, res) => {
  try {
    const { page = 1, limit = 20, search, role } = req.query;
    const filter = {};
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];
    }
    if (role) filter.role = role;

    const skip = (Math.max(1, Number(page)) - 1) * Number(limit);
    const [users, total] = await Promise.all([
      User.find(filter)
        .select("-password -twoFactorSecret -twoFactorBackupCodes -refreshTokens -verificationToken -resetPasswordToken")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      User.countDocuments(filter),
    ]);

    res.json({
      users,
      page: Number(page),
      totalPages: Math.ceil(total / Number(limit)),
      totalCount: total,
    });
  } catch (err) {
    console.error("adminListUsers error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// PUT /api/auth/admin/users/:id/role — change user role
exports.adminSetRole = async (req, res) => {
  try {
    const { role } = req.body;
    if (!["buyer", "seller", "admin"].includes(role)) {
      return res.status(400).json({ message: "Invalid role" });
    }
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { role },
      { new: true }
    ).select("-password -twoFactorSecret -twoFactorBackupCodes -refreshTokens");
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json({ user });
  } catch (err) {
    console.error("adminSetRole error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// PUT /api/auth/admin/users/:id/suspend — suspend/unsuspend user
exports.adminSuspendUser = async (req, res) => {
  try {
    const { suspended, reason } = req.body;
    const update = {
      suspended: !!suspended,
      suspendedAt: suspended ? new Date() : null,
      suspendedReason: suspended ? (reason || "Suspended by admin") : null,
    };
    // Clear refresh tokens when suspending
    if (suspended) update.refreshTokens = [];

    const user = await User.findByIdAndUpdate(req.params.id, update, { new: true })
      .select("-password -twoFactorSecret -twoFactorBackupCodes -refreshTokens");
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json({ user });
  } catch (err) {
    console.error("adminSuspendUser error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// GET /api/auth/admin/stats — admin metrics
exports.adminStats = async (req, res) => {
  try {
    const [totalUsers, roleBreakdown, recentUsers, suspendedCount] = await Promise.all([
      User.countDocuments(),
      User.aggregate([{ $group: { _id: "$role", count: { $sum: 1 } } }]),
      User.countDocuments({ createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } }),
      User.countDocuments({ suspended: true }),
    ]);

    const roles = {};
    for (const r of roleBreakdown) roles[r._id] = r.count;

    res.json({
      totalUsers,
      roles,
      newUsersLast7Days: recentUsers,
      suspendedCount,
    });
  } catch (err) {
    console.error("adminStats error:", err);
    res.status(500).json({ message: "Server error" });
  }
};
