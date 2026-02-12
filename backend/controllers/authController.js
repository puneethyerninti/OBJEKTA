// backend/controllers/authController.js
const User = require("../models/User");
const jwt = require("jsonwebtoken");

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || "7d" });
};

// POST /api/auth/oauth (verify provider tokens like Google)
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
      user = await User.create({ name, email, password: null, avatar, oauthProvider: 'google' });
    }

    const token = generateToken(user._id);
    res.json({ user: { id: user._id, name: user.name, email: user.email, avatar }, token });
  } catch (err) {
    console.error('oauthLogin error:', err);
    res.status(500).json({ message: 'OAuth verification failed' });
  }
};

// POST /api/auth/register
exports.registerUser = async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) return res.status(400).json({ message: "Name, email and password are required" });

    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ message: "Email already in use" });

    const user = await User.create({ name, email, password });
    const token = generateToken(user._id);

    res.status(201).json({ user: { id: user._id, name: user.name, email: user.email }, token });
  } catch (err) {
    console.error("registerUser error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// POST /api/auth/login
exports.loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: "Email and password are required" });

    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ message: "Invalid credentials" });

    const isMatch = await user.matchPassword(password);
    if (!isMatch) return res.status(401).json({ message: "Invalid credentials" });

    const token = generateToken(user._id);
    res.json({ user: { id: user._id, name: user.name, email: user.email }, token });
  } catch (err) {
    console.error("loginUser error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// GET /api/auth/me
exports.getMe = async (req, res) => {
  try {
    // auth middleware set req.userId
    const user = await User.findById(req.userId).select("-password");
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json({ user });
  } catch (err) {
    console.error("getMe error:", err);
    res.status(500).json({ message: "Server error" });
  }
};
