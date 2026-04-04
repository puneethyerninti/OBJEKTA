// backend/models/User.js
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, minlength: 2 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: false },
  avatar: { type: String, required: false },
  oauthProvider: { type: String, required: false },
  role: { type: String, enum: ["buyer", "seller", "admin"], default: "buyer" },

  // Email verification
  emailVerified: { type: Boolean, default: false },
  verificationToken: { type: String, default: null },
  verificationTokenExpires: { type: Date, default: null },

  // Password reset
  resetPasswordToken: { type: String, default: null },
  resetPasswordExpires: { type: Date, default: null },

  // OTP for passwordless/2FA login (6 digits, 30 sec expiry)
  loginOTP: { type: String, default: null },
  loginOTPExpires: { type: Date, default: null },
  otpAttempts: { type: Number, default: 0 }, // Rate limiting

  // Refresh tokens (store hashed tokens for rotation)
  refreshTokens: [{ token: String, expiresAt: Date, createdAt: { type: Date, default: Date.now } }],

  // 2FA (TOTP)
  twoFactorEnabled: { type: Boolean, default: false },
  twoFactorSecret: { type: String, default: null },
  twoFactorBackupCodes: [String],

  // Account status
  suspended: { type: Boolean, default: false },
  suspendedAt: { type: Date, default: null },
  suspendedReason: { type: String, default: null },
}, { timestamps: true });

// Pre-save hash password
userSchema.pre("save", async function (next) {
  if (!this.isModified("password") || !this.password) return next();
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    return next();
  } catch (err) {
    return next(err);
  }
});

// Compare password method
userSchema.methods.matchPassword = async function (enteredPassword) {
  if (!this.password) return false;
  return await bcrypt.compare(enteredPassword, this.password);
};

// Generate email verification token
userSchema.methods.generateVerificationToken = function () {
  const token = crypto.randomBytes(32).toString("hex");
  this.verificationToken = crypto.createHash("sha256").update(token).digest("hex");
  this.verificationTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24hrs
  return token;
};

// Generate password reset token
userSchema.methods.generateResetToken = function () {
  const token = crypto.randomBytes(32).toString("hex");
  this.resetPasswordToken = crypto.createHash("sha256").update(token).digest("hex");
  this.resetPasswordExpires = new Date(Date.now() + 60 * 60 * 1000); // 1hr
  return token;
};

// Generate refresh token
userSchema.methods.generateRefreshToken = function () {
  const token = crypto.randomBytes(40).toString("hex");
  const hashed = crypto.createHash("sha256").update(token).digest("hex");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
  // Keep max 5 refresh tokens per user
  if (this.refreshTokens.length >= 5) {
    this.refreshTokens.shift();
  }
  this.refreshTokens.push({ token: hashed, expiresAt });
  return { token, expiresAt };
};

// Verify refresh token
userSchema.methods.verifyRefreshToken = function (token) {
  const hashed = crypto.createHash("sha256").update(token).digest("hex");
  const idx = this.refreshTokens.findIndex(
    (rt) => rt.token === hashed && rt.expiresAt > new Date()
  );
  if (idx === -1) return false;
  // Remove used token (rotation)
  this.refreshTokens.splice(idx, 1);
  return true;
};

// Generate 2FA backup codes
userSchema.methods.generateBackupCodes = function () {
  const codes = [];
  for (let i = 0; i < 8; i++) {
    codes.push(crypto.randomBytes(4).toString("hex"));
  }
  this.twoFactorBackupCodes = codes.map((c) =>
    crypto.createHash("sha256").update(c).digest("hex")
  );
  return codes; // Return plaintext codes to show user once
};

// Verify backup code
userSchema.methods.verifyBackupCode = function (code) {
  const hashed = crypto.createHash("sha256").update(code).digest("hex");
  const idx = this.twoFactorBackupCodes.indexOf(hashed);
  if (idx === -1) return false;
  this.twoFactorBackupCodes.splice(idx, 1); // consume the code
  return true;
};

// Generate OTP (6 digits, 30 second expiry)
userSchema.methods.generateLoginOTP = function () {
  const otp = Math.floor(100000 + Math.random() * 900000).toString(); // 6 digits
  this.loginOTP = crypto.createHash("sha256").update(otp).digest("hex");
  this.loginOTPExpires = new Date(Date.now() + 30 * 1000); // 30 seconds
  this.otpAttempts = 0;
  return otp; // Return plaintext OTP to send via email/SMS
};

// Verify OTP
userSchema.methods.verifyLoginOTP = function (otp) {
  if (!this.loginOTP || !this.loginOTPExpires) return false;
  if (this.loginOTPExpires < new Date()) return false; // Expired
  if (this.otpAttempts >= 5) return false; // Rate limit

  const hashed = crypto.createHash("sha256").update(otp).digest("hex");
  this.otpAttempts += 1;

  if (hashed === this.loginOTP) {
    this.loginOTP = null;
    this.loginOTPExpires = null;
    this.otpAttempts = 0;
    return true;
  }
  return false;
};

module.exports = mongoose.model("User", userSchema);
