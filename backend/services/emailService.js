// backend/services/emailService.js
// Email sending abstraction — uses SMTP (nodemailer) or logs to console in dev.
// Set EMAIL_PROVIDER=console (default) for dev, or configure SMTP_* env vars for production.

const PROVIDER = process.env.EMAIL_PROVIDER || "console";

/**
 * Send an email.
 * @param {{ to: string, subject: string, html: string, text?: string }} opts
 */
async function sendEmail({ to, subject, html, text }) {
  if (PROVIDER === "console" || !process.env.SMTP_HOST) {
    console.log(`\n📧 EMAIL [${subject}] → ${to}`);
    console.log(text || html);
    console.log("---\n");
    return { success: true, provider: "console" };
  }

  // Real SMTP via nodemailer
  try {
    const nodemailer = require("nodemailer");
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || "587"),
      secure: process.env.SMTP_SECURE === "true",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    await transporter.sendMail({
      from: process.env.SMTP_FROM || `"OBJEKTA" <noreply@objekta.io>`,
      to,
      subject,
      html,
      text: text || html.replace(/<[^>]*>/g, ""),
    });

    return { success: true, provider: "smtp" };
  } catch (err) {
    console.error("Email send error:", err);
    return { success: false, error: err.message };
  }
}

/**
 * Build a verification email.
 */
function verificationEmail(name, verifyUrl) {
  return {
    subject: "Verify your OBJEKTA account",
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px;">
        <h2 style="color:#7f5af0;">Welcome to OBJEKTA, ${name}!</h2>
        <p>Please verify your email address by clicking the link below:</p>
        <a href="${verifyUrl}" style="display:inline-block;padding:12px 24px;background:#7f5af0;color:#fff;border-radius:8px;text-decoration:none;font-weight:600;">
          Verify Email
        </a>
        <p style="margin-top:16px;color:#888;font-size:13px;">This link expires in 24 hours. If you didn't create an account, ignore this email.</p>
      </div>
    `,
    text: `Welcome to OBJEKTA, ${name}! Verify your email: ${verifyUrl} (expires in 24 hours)`,
  };
}

/**
 * Build a password reset email.
 */
function resetPasswordEmail(name, resetUrl) {
  return {
    subject: "Reset your OBJEKTA password",
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px;">
        <h2 style="color:#7f5af0;">Password Reset</h2>
        <p>Hi ${name}, you requested a password reset. Click below to set a new password:</p>
        <a href="${resetUrl}" style="display:inline-block;padding:12px 24px;background:#7f5af0;color:#fff;border-radius:8px;text-decoration:none;font-weight:600;">
          Reset Password
        </a>
        <p style="margin-top:16px;color:#888;font-size:13px;">This link expires in 1 hour. If you didn't request this, ignore this email.</p>
      </div>
    `,
    text: `Hi ${name}, reset your OBJEKTA password: ${resetUrl} (expires in 1 hour)`,
  };
}

module.exports = { sendEmail, verificationEmail, resetPasswordEmail };
