// backend/server/index.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import mongoose from "mongoose";
import { Server } from "socket.io";
import http from "http";

dotenv.config();

const PORT = process.env.PORT || 5000;
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || "http://localhost:5173";

const app = express();

// larger payloads (3D scene JSONs can be big)
app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ extended: true, limit: "20mb" }));

// simple request logger for debugging
app.use((req, res, next) => {
  console.log(`[API] ${req.method} ${req.url}`);
  next();
});

// CORS: accept frontend + common localhost aliases
const allowed = new Set([
  FRONTEND_ORIGIN,
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
]);
app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true); // allow non-browser (curl/postman)
      if (allowed.has(origin)) return cb(null, true);
      cb(new Error("CORS blocked: " + origin));
    },
    credentials: true,
  })
);

// MongoDB connection
mongoose
  .connect(process.env.MONGO_URI, { })
  .then(() => console.log("✅ MongoDB Connected"))
  .catch((err) => {
    console.error("❌ MongoDB Connection Error:", err);
    // do not crash — backend can still respond with errors
  });

// Project schema (make name optional to avoid validation 500s)
const projectSchema = new mongoose.Schema({
  name: { type: String, default: "Untitled" },
  data: { type: Object, default: {} },
  updatedAt: { type: Date, default: Date.now },
});
const Project = mongoose.model("Project", projectSchema);

/* ---------- Helpers ---------- */
const safeHandler = (fn) => async (req, res) => {
  try {
    await fn(req, res);
  } catch (err) {
    console.error("[ERROR]", req.method, req.url, err);
    const errMsg = err?.message || "Server error";
    res.status(500).json({ success: false, error: errMsg });
  }
};

/* ---------- Routes ---------- */
app.get(
  "/api/projects",
  safeHandler(async (req, res) => {
    const list = await Project.find().sort({ updatedAt: -1 }).limit(200).lean();
    res.json({ success: true, projects: list });
  })
);

app.get(
  "/api/projects/:id",
  safeHandler(async (req, res) => {
    const p = await Project.findById(req.params.id).lean();
    if (!p) return res.status(404).json({ success: false, error: "Not found" });
    res.json({ success: true, project: p });
  })
);
// POST /api/projects  (robust)
app.post("/api/projects", async (req, res) => {
  try {
    // Defensive: accept either { name, data } or whole body
    let { name, data } = req.body ?? {};
    if (!name) name = `Project_${new Date().toISOString()}`;
    // create
    const newProject = await Project.create({ name, data: data ?? {} });
    return res.status(201).json(newProject);
  } catch (err) {
    console.error("Save error:", err);
    // return error details (safe message + brief detail)
    return res.status(500).json({ error: "Save failed", details: err.message });
  }
});


app.put(
  "/api/projects/:id",
  safeHandler(async (req, res) => {
    const { name, data } = req.body || {};
    await Project.findByIdAndUpdate(
      req.params.id,
      { name: name ?? undefined, data: data ?? undefined, updatedAt: Date.now() },
      { new: true, upsert: false }
    );
    res.json({ success: true });
  })
);

app.delete(
  "/api/projects/:id",
  safeHandler(async (req, res) => {
    await Project.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  })
);

/* ---------- Socket.io (real-time) ---------- */
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: Array.from(allowed),
    credentials: true,
  },
});

// log connections for debugging
io.on("connection", (socket) => {
  console.log("🧩 socket connected:", socket.id);

  socket.on("joinProject", ({ projectId }) => {
    try {
      if (projectId) socket.join(projectId);
    } catch (e) {}
  });

  socket.on("leaveProject", ({ projectId }) => {
    try {
      if (projectId) socket.leave(projectId);
    } catch (e) {}
  });

  socket.on("project:update", (payload) => {
    // broadcast to others
    if (payload?.projectId) socket.to(payload.projectId).emit("project:patched", payload);
    else socket.broadcast.emit("project:patched", payload);
  });

  socket.on("disconnect", () => console.log("🧩 socket disconnected:", socket.id));
});

server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

// generic error handler (add just before server.listen)
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ error: "Server error", message: err?.message || '' });
});
