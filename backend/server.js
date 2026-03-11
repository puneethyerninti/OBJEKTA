// backend/server.js
require("dotenv").config();
require("./config/validateEnv")();
const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const http = require("http");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const crypto = require("crypto");
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
const app = express();
app.disable("x-powered-by");

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

app.use(express.json({ limit: "200mb" }));
app.use(express.urlencoded({ limit: "200mb", extended: true }));
app.use(cookieParser());

// CORS: allow configured origins (comma-separated), common production frontends, and localhost
const envOrigins = (process.env.FRONTEND_ORIGIN || "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);
const defaultProdOrigins = [
  "https://objekta-frontend.onrender.com",
  "https://objekta5465.vercel.app",
  "https://objekta-wy7g.vercel.app",
];

const isAllowedOrigin = (origin) => {
  if (!origin) return true; // allow curl/postman
  if (envOrigins.includes(origin)) return true;
  if (defaultProdOrigins.includes(origin)) return true;
  if (/^https?:\/\/localhost(:\d+)?$/i.test(origin)) return true;
  if (/^https?:\/\/127\.0\.0\.1(:\d+)?$/i.test(origin)) return true;
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
app.use("/uploads", express.static(uploadDir));

// ---------- API Documentation ----------
app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec, { customSiteTitle: "OBJEKTA API Docs" }));
app.get("/api/docs.json", (req, res) => res.json(swaggerSpec));

// ---------- API Routes ----------
app.use("/api", apiLimiter);
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
app.get("/", (req, res) => res.send("🧠 OBJEKTA backend is running 🚀"));
app.get("/api/test", (req, res) => res.json({ message: "Backend OK ✅" }));
app.get("/health", async (req, res) => {
  const checks = { status: "ok", uptime: process.uptime(), timestamp: new Date().toISOString() };
  try {
    const mongoose = require("mongoose");
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

  res.status(500).json({
    success: false,
    message: "Server error",
    error: err.message,
  });
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
