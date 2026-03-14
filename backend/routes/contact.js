const express = require("express");

const router = express.Router();

// POST /api/contact — save contact form submissions (best-effort, no auth required)
router.post("/", async (req, res) => {
  try {
    const { name, email, subject, message } = req.body;

    // Validate
    if (!email || !message || typeof message !== "string" || message.trim().length < 10) {
      return res.status(400).json({ error: "Invalid form data" });
    }

    // TODO: Send email or store to database
    // For now, log to console
    console.log(`[Contact Form] ${name} (${email}) - ${subject}:\n${message}\n`);

    res.json({ success: true });
  } catch (err) {
    console.error("Contact form error:", err);
    res.status(500).json({ error: "Failed to process contact form" });
  }
});

module.exports = router;
