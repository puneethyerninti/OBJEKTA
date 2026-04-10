// backend/server.js
require("dotenv").config();
require("./config/validateEnv")();
const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const helmet = require("helmet");
const compression = require("compression");
const rateLimit = require("express-rate-limit");
const http = require("http");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const crypto = require("crypto");
const mongoose = require("mongoose");
const connectDB = require("./config/db");
const { initSocket } = require("./socket");
const { initYjs } = require("./yjs");
const { protect } = require("./middleware/authMiddleware");
const cookieParser = require("cookie-parser");
const swaggerUi = require("swagger-ui-express");
const swaggerSpec = require("./config/swagger");
const tus = require("tus-node-server");
const FileStore = tus.FileStore || (tus.stores && tus.stores.FileStore);

// ---------- Route Imports ----------
const authRoutes = require("./routes/auth");
const projectRoutes = require("./routes/projects");
const uploadRoutes = require("./routes/uploads");
const scenesRoutes = require("./routes/scenes");
const activityRoutes = require("./routes/activity");
const collaboratorsRoutes = require("./routes/collaborators");
const aiRoutes = require("./routes/ai");
const marketplaceRoutes = require("./routes/marketplace");
const versionsRoutes = require("./routes/versions");
const contactRoutes = require("./routes/contact");
const app = express();
app.disable("x-powered-by");

const parseOrigins = (value) =>
  (value || "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);

const envOrigins = parseOrigins(process.env.FRONTEND_ORIGIN);
const extraOrigins = parseOrigins(process.env.EXTRA_CORS_ORIGINS);
const allowLocalhost = process.env.NODE_ENV !== "production";
const allowedOrigins = new Set([...envOrigins, ...extraOrigins]);
const isLocalOrigin = (origin) => {
  if (!origin) return false;
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin);
};

// ---------- Connect MongoDB ----------
connectDB();

// ---------- Middleware ----------
app.set("trust proxy", process.env.TRUST_PROXY === "true");

app.use((req, res, next) => {
  const id = (crypto.randomUUID && crypto.randomUUID()) || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  req.id = id;
  res.setHeader("x-request-id", id);
  next();
});

morgan.token("id", (req) => req.id || "-");
app.use(morgan(":id :method :url :status :response-time ms"));

app.use(compression());

const rawBodySaver = (req, _res, buf) => {
  if (req.originalUrl === "/api/marketplace/payments/webhook") {
    req.rawBody = buf;
  }
};

app.use(express.json({ limit: "200mb", verify: rawBodySaver }));
app.use(express.urlencoded({ limit: "200mb", extended: true }));
app.use(cookieParser());

// CORS: allow configured origins (comma-separated), optional extras, and localhost in non-prod
const isAllowedOrigin = (origin) => {
  if (!origin) return true; // allow curl/postman
  if (allowedOrigins.has(origin)) return true;
  if (allowLocalhost && isLocalOrigin(origin)) return true;
  return false;
};

app.use(
  cors({
    origin: (origin, callback) => {
      if (isAllowedOrigin(origin)) return callback(null, true);
      return callback(new Error(`Not allowed by CORS: ${origin || "<unknown>"}`));
    },
    credentials: true,
  })
);

app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        "script-src": ["'self'", "https://accounts.google.com"],
        "frame-src": ["'self'", "https://accounts.google.com"],
        "connect-src": [
          "'self'",
          "https://accounts.google.com",
          "https://oauth2.googleapis.com",
          "https://www.googleapis.com",
          "https://*.gstatic.com",
          "https://*.googleusercontent.com",
          "ws:",
          "wss:",
        ],
        "style-src": ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        "font-src": ["'self'", "https://fonts.gstatic.com", "data:"],
        "img-src": ["'self'", "data:", "blob:", "https:"],
        "worker-src": ["'self'", "blob:"],
      },
    },
    // Allow cross-origin resource loading for model assets
    crossOriginResourcePolicy: { policy: "cross-origin" },
    // Do NOT enforce Cross-Origin-Opener-Policy here — some identity providers
    // rely on window.postMessage and will fail if COOP is forced.
    // Keep COOP disabled unless you explicitly require cross-origin isolation.
    crossOriginOpenerPolicy: false,
  })
);

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number.parseInt(process.env.RATE_LIMIT_MAX || "300", 10),
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many requests" },
});

const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number.parseInt(process.env.UPLOAD_RATE_LIMIT_MAX || "120", 10),
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.path.startsWith("/tus"),
  message: { success: false, message: "Upload rate limit exceeded" },
});

// ---------- Ensure uploads directory exists ----------
const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const distDir = path.resolve(__dirname, "..", "dist");
const serveFrontend = process.env.SERVE_FRONTEND !== "false" && fs.existsSync(distDir);

// ---------- Multer Storage ----------
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname)),
});

const upload = multer({
  storage,
  limits: { fileSize: 200 * 1024 * 1024 }, // 200 MB
  fileFilter: (req, file, cb) => {
    const allowed = [
      "model/gltf-binary",
      "application/octet-stream",
      "application/gltf+json",
    ];
    const ext = path.extname(file?.originalname || "").toLowerCase();
    const extAllowed = ext === ".glb" || ext === ".gltf";
    const mimeAllowed = allowed.includes(file?.mimetype || "");
    if (extAllowed || mimeAllowed) return cb(null, true);
    return cb(new Error("Invalid file type. Only GLB/GLTF allowed."));
  },
});

// ---------- Static Files ----------
app.use("/uploads/marketplace", (req, res, next) => {
  const normalized = (req.path || "").replace(/\\/g, "/");
  if (normalized === "/thumbnails" || normalized.startsWith("/thumbnails/")) {
    return next();
  }
  return res.status(403).json({ success: false, message: "Direct marketplace asset URLs are disabled" });
});

app.use(
  "/uploads",
  express.static(uploadDir, {
    dotfiles: "deny",
    fallthrough: true,
  })
);

if (serveFrontend) {
  app.use(
    express.static(distDir, {
      fallthrough: true,
      setHeaders: (res, filePath) => {
        if (filePath.endsWith(".html")) {
          res.setHeader("Cache-Control", "no-store");
          return;
        }
        if (filePath.includes(`${path.sep}assets${path.sep}`)) {
          res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
          return;
        }
        res.setHeader("Cache-Control", "public, max-age=3600");
      },
    })
  );
}

// ---------- API Documentation ----------
const exposeApiDocs = process.env.EXPOSE_API_DOCS === "true" || process.env.NODE_ENV !== "production";
if (exposeApiDocs) {
  app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec, { customSiteTitle: "OBJEKTA API Docs" }));
  app.get("/api/docs.json", (req, res) => res.json(swaggerSpec));
} else {
  app.use("/api/docs", (_req, res) => res.status(404).json({ success: false, message: "Not found" }));
  app.get("/api/docs.json", (_req, res) => res.status(404).json({ success: false, message: "Not found" }));
}

// ---------- API Routes ----------
app.use("/api", apiLimiter);
app.get("/api/runtime-config", (_req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.json({
    googleClientId: process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID || "",
  });
});
app.use("/api/contact", contactRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/projects", projectRoutes);
app.use("/api/uploads", uploadLimiter, uploadRoutes);
app.use("/api/scenes", scenesRoutes);
app.use("/api/activity", activityRoutes);
app.use("/api/collaborators", collaboratorsRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/marketplace", marketplaceRoutes);
app.use("/api/versions", versionsRoutes);

// ---------- tus resumable uploads (fallback) ----------
try {
  const tusDataDir = path.join(uploadDir, "tus");
  if (!fs.existsSync(tusDataDir)) fs.mkdirSync(tusDataDir, { recursive: true });
  const tusServer = new tus.Server({
    path: '/api/uploads/tus', // or whatever path
    datastore: new FileStore({ directory: tusDataDir })
  });
  const tusApp = express();
  tusApp.all("*", (req, res) => tusServer.handle(req, res));
  app.use("/api/uploads/tus", tusApp);
  console.log("✅ tus server mounted at /api/uploads/tus");
} catch (e) {
  console.warn("⚠️ tus server not mounted:", e.message);
}

if (serveFrontend) {
  app.get("*", (req, res, next) => {
    if (
      req.path.startsWith("/api") ||
      req.path.startsWith("/uploads") ||
      req.path.startsWith("/socket.io") ||
      req.path.startsWith("/health")
    ) {
      return next();
    }
    return res.sendFile(path.join(distDir, "index.html"));
  });
}

// ✅ Direct .glb upload endpoint (for quick uploads/testing)
app.post("/api/upload-glb", protect, (req, res, _next) => {
  upload.single("file")(req, res, function (err) {
    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return res
          .status(413)
          .json({ success: false, message: "File too large (max 200MB)." });
      }
      return res.status(400).json({ success: false, message: err.message });
    } else if (err) {
      console.error("Upload error:", err);
      return res.status(500).json({ success: false, message: "Server error", error: err.message });
    }

    if (!req.file)
      return res.status(400).json({ success: false, message: "No file uploaded" });

    res.status(201).json({
      success: true,
      message: "File uploaded successfully",
      filename: req.file.filename,
      path: `/uploads/${req.file.filename}`,
    });
  });
});

// ---------- Health Check ----------
if (!serveFrontend) {
  app.get("/", (req, res) => res.send("🧠 OBJEKTA backend is running 🚀"));
}
app.get("/api/test", (req, res) => res.json({ message: "Backend OK ✅" }));
app.get("/health", async (req, res) => {
  const checks = { status: "ok", uptime: process.uptime(), timestamp: new Date().toISOString() };
  try {
    const dbState = mongoose.connection.readyState;
    checks.database = dbState === 1 ? "connected" : dbState === 2 ? "connecting" : "disconnected";
    if (dbState !== 1) checks.status = "degraded";
  } catch (e) {
    checks.database = "error";
    checks.status = "degraded";
  }
  const code = checks.status === "ok" ? 200 : 503;
  res.status(code).json(checks);
});

// ---------- Error Handler ----------
app.use((err, req, res, _next) => {
  console.error("❌ Unhandled error:", err);

  if (err.type === "entity.too.large" || err.code === "LIMIT_FILE_SIZE") {
    return res.status(413).json({
      success: false,
      message: "Uploaded data too large. Try compressing your model.",
    });
  }

  const payload = { success: false, message: "Server error" };
  if (process.env.NODE_ENV !== "production") {
    payload.error = err.message;
  }
  res.status(500).json(payload);
});

// ---------- Create HTTP + WebSocket Server ----------
const server = http.createServer(app);
initSocket(server);
initYjs(server);

// ---------- Start Server ----------
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 OBJEKTA server + WebSockets running on port ${PORT}`);
});

const shutdown = (signal) => {
  console.log(`Received ${signal}. Shutting down gracefully...`);
  server.close(() => {
    mongoose.connection.close(false).finally(() => process.exit(0));
  });
  setTimeout(() => process.exit(1), 10000).unref();
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
