const express = require("express");
const { sendEmail } = require("../services/emailService");

const router = express.Router();

// POST /api/contact — save contact form submissions (best-effort, no auth required)
router.post("/", async (req, res) => {
  try {
    const { name, email, subject, message } = req.body;

    // Validate
    if (!email || !message || typeof message !== "string" || message.trim().length < 10) {
      return res.status(400).json({ error: "Invalid form data" });
    }

    const receiver = process.env.CONTACT_RECEIVER || process.env.SMTP_FROM || null;
    const subjectLine = subject ? `Contact: ${subject}` : "Contact form submission";

    if (receiver) {
      const result = await sendEmail({
        to: receiver,
        subject: subjectLine,
        replyTo: email,
        html: `
          <div style="font-family:sans-serif;max-width:640px;margin:0 auto;padding:20px;">
            <h2 style="margin:0 0 8px;">New contact message</h2>
            <p><strong>Name:</strong> ${name || "(not provided)"}</p>
            <p><strong>Email:</strong> ${email}</p>
            <p><strong>Subject:</strong> ${subject || "(none)"}</p>
            <pre style="white-space:pre-wrap;background:#f5f5f5;padding:12px;border-radius:8px;">${message}</pre>
          </div>
        `,
        text: `New contact message\nName: ${name || "(not provided)"}\nEmail: ${email}\nSubject: ${subject || "(none)"}\n\n${message}`,
      });

      if (!result.success) {
        return res.status(502).json({ error: "Failed to deliver message" });
      }
    } else {
      console.log(`[Contact Form] ${name} (${email}) - ${subject}:\n${message}\n`);
    }

    res.json({ success: true });
  } catch (err) {
    console.error("Contact form error:", err);
    res.status(500).json({ error: "Failed to process contact form" });
  }
});

module.exports = router;
