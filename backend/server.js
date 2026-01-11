// backend/server.js
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const http = require("http");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const connectDB = require("./config/db");
const { initSocket } = require("./socket");
const tus = require("tus-node-server");
const FileStore = tus.FileStore || (tus.stores && tus.stores.FileStore);

// ---------- Route Imports ----------
const authRoutes = require("./routes/auth");
const projectRoutes = require("./routes/projects");
const uploadRoutes = require("./routes/uploads");
const scenesRoutes = require("./routes/scenes");
const activityRoutes = require("./routes/activity");
const collaboratorsRoutes = require("./routes/collaborators");
const app = express();

// ---------- Connect MongoDB ----------
connectDB();

// ---------- Middleware ----------
app.use(express.json({ limit: "200mb" }));
app.use(express.urlencoded({ limit: "200mb", extended: true }));
app.use(morgan("dev"));

// CORS: allow the configured FRONTEND_ORIGIN, and during development allow any localhost origin
const frontendOrigin = process.env.FRONTEND_ORIGIN || null;
if (process.env.NODE_ENV !== "production") {
  app.use(
    cors({
      origin: (origin, callback) => {
        // allow non-browser tools (no origin)
        if (!origin) return callback(null, true);
        if (frontendOrigin && origin === frontendOrigin) return callback(null, true);
        // allow any localhost or 127.0.0.1 origin (any port)
        try {
          if (/^https?:\/\/localhost(:\d+)?$/i.test(origin) || /^https?:\/\/127\.0\.0\.1(:\d+)?$/i.test(origin)) return callback(null, true);
        } catch (e) {}
        return callback(new Error("Not allowed by CORS"));
      },
      credentials: true,
    })
  );
} else {
  app.use(
    cors({ origin: frontendOrigin || "http://localhost:5000", credentials: true })
  );
}

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
});

// ---------- Static Files ----------
app.use("/uploads", express.static(uploadDir));

// ---------- API Routes ----------
app.use("/api/auth", authRoutes);
app.use("/api/projects", projectRoutes);
app.use("/api/uploads", uploadRoutes);
app.use("/api/scenes", scenesRoutes);
app.use("/api/activity", activityRoutes);
app.use("/api/collaborators", collaboratorsRoutes);

// ---------- tus resumable uploads (fallback) ----------
try {
  const tusDataDir = path.join(uploadDir, "tus");
  if (!fs.existsSync(tusDataDir)) fs.mkdirSync(tusDataDir, { recursive: true });
  const tusServer = new tus.Server();
  tusServer.datastore = new FileStore({ directory: tusDataDir });
  const tusApp = express();
  tusApp.all("*", (req, res) => tusServer.handle(req, res));
  app.use("/api/uploads/tus", tusApp);
  console.log("✅ tus server mounted at /api/uploads/tus");
} catch (e) {
  console.warn("⚠️ tus server not mounted:", e.message);
}

// ✅ Direct .glb upload endpoint (for quick uploads/testing)
app.post("/api/upload-glb", (req, res, next) => {
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

// ---------- Error Handler ----------
app.use((err, req, res, next) => {
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

// ---------- Start Server ----------
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 OBJEKTA server + WebSockets running on port ${PORT}`);
});
