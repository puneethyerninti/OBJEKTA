// backend/routes/auth.js
const express = require("express");
const router = express.Router();
const { registerUser, loginUser, getMe, oauthLogin } = require("../controllers/authController");
const { protect } = require("../middleware/authMiddleware");

router.post("/register", registerUser);
router.post("/login", loginUser);
router.post("/oauth", oauthLogin);
router.get("/me", protect, getMe);

module.exports = router;
