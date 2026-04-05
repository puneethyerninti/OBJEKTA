// backend/config/validateEnv.js
// Validates required environment variables at startup

const required = ["JWT_SECRET"];

const recommended = [
  "MONGO_URI",
  "PORT",
  "FRONTEND_ORIGIN",
  "FRONTEND_URL",
  "BACKEND_URL",
  "DOWNLOAD_SECRET",
];

function validateEnv() {
  const isProd = process.env.NODE_ENV === "production";
  const missing = required.filter(key => !process.env[key]);
  const warns = recommended.filter(key => !process.env[key]);

  if (warns.length > 0) {
    console.warn(`⚠️  Missing recommended env vars: ${warns.join(", ")} — using defaults`);
  }

  if (missing.length > 0) {
    console.error(`❌ Missing REQUIRED env vars: ${missing.join(", ")}`);
    if (isProd) process.exit(1);
  }

  if (isProd) {
    const prodRequired = ["MONGO_URI", "FRONTEND_ORIGIN", "FRONTEND_URL", "BACKEND_URL"];
    const prodMissing = prodRequired.filter((key) => !process.env[key]);
    if (prodMissing.length > 0) {
      console.error(`❌ Missing production env vars: ${prodMissing.join(", ")}`);
      process.exit(1);
    }

    if ((process.env.PAYMENT_PROVIDER || "stripe").toLowerCase() !== "mock") {
      const payMissing = ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"].filter((k) => !process.env[k]);
      if (payMissing.length > 0) {
        console.error(`❌ Stripe is enabled but missing: ${payMissing.join(", ")}`);
        process.exit(1);
      }
    }

    if ((process.env.EMAIL_PROVIDER || "console").toLowerCase() !== "console") {
      const smtpMissing = ["SMTP_HOST", "SMTP_USER", "SMTP_PASS"].filter((k) => !process.env[k]);
      if (smtpMissing.length > 0) {
        console.error(`❌ SMTP email enabled but missing: ${smtpMissing.join(", ")}`);
        process.exit(1);
      }
    }
  }

  if (process.env.S3_BUCKET) {
    const awsMissing = ["AWS_REGION", "AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY"].filter((k) => !process.env[k]);
    if (awsMissing.length > 0) {
      console.warn(`⚠️  S3 bucket configured but missing: ${awsMissing.join(", ")}`);
    }
  }

  // Type/format checks
  if (process.env.PORT && isNaN(Number(process.env.PORT))) {
    console.warn("⚠️  PORT must be a number, got:", process.env.PORT);
  }

  if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 16 && process.env.NODE_ENV === "production") {
    console.warn("⚠️  JWT_SECRET is too short for production (min 16 chars recommended)");
  }

  if (process.env.COOKIE_SAMESITE === "none" && process.env.COOKIE_SECURE !== "true") {
    console.warn("⚠️  COOKIE_SAMESITE=none requires COOKIE_SECURE=true to work in modern browsers");
  }

  console.log("✅ Environment validation complete");
}

module.exports = validateEnv;
