// backend/config/validateEnv.js
// Validates required environment variables at startup

const required = [
  "JWT_SECRET",
];

const recommended = [
  "MONGO_URI",
  "PORT",
  "FRONTEND_ORIGIN",
];

function validateEnv() {
  const missing = required.filter(key => !process.env[key]);
  const warns = recommended.filter(key => !process.env[key]);

  if (warns.length > 0) {
    console.warn(`⚠️  Missing recommended env vars: ${warns.join(", ")} — using defaults`);
  }

  if (missing.length > 0) {
    console.error(`❌ Missing REQUIRED env vars: ${missing.join(", ")}`);
    if (process.env.NODE_ENV === "production") {
      process.exit(1);
    }
  }

  // Type/format checks
  if (process.env.PORT && isNaN(Number(process.env.PORT))) {
    console.warn("⚠️  PORT must be a number, got:", process.env.PORT);
  }

  if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 16 && process.env.NODE_ENV === "production") {
    console.warn("⚠️  JWT_SECRET is too short for production (min 16 chars recommended)");
  }

  console.log("✅ Environment validation complete");
}

module.exports = validateEnv;
