// backend/routes/scenes.js
const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const Scene = require("../models/Scene");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

// uploads folder
const UPLOAD_DIR = path.join(__dirname, "..", "uploads");
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const name = `${Date.now()}-${file.originalname.replace(/\s+/g, "_")}`;
    cb(null, name);
  },
});

const allowedSceneExt = new Set([".glb", ".gltf", ".json"]);
const allowedSceneMime = new Set([
  "application/json",
  "application/octet-stream",
  "application/gltf+json",
  "model/gltf-binary",
]);

const allowedEnvExt = new Set([".hdr", ".exr", ".png", ".jpg", ".jpeg", ".webp"]);
const allowedEnvMime = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/vnd.radiance",
  "application/octet-stream",
]);

const upload = multer({
  storage,
  limits: { fileSize: 300 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase();
    const mime = file.mimetype || "";
    if (file.fieldname === "file") {
      if (allowedSceneExt.has(ext) || allowedSceneMime.has(mime)) return cb(null, true);
      return cb(new Error("Invalid scene file type"));
    }
    if (file.fieldname === "environment") {
      if (allowedEnvExt.has(ext) || allowedEnvMime.has(mime)) return cb(null, true);
      return cb(new Error("Invalid environment file type"));
    }
    return cb(new Error("Invalid upload field"));
  },
});

// POST /api/scenes/save
// fields: name, description, json (stringified), file (optional), environmentMap(optional .hdr/.exr), backgroundColor, bloomEnabled, oceanEnabled, rainEnabled, cameraState
router.post("/save", protect, upload.fields([
  { name: 'file', maxCount: 1 },
  { name: 'environment', maxCount: 1 },
]), async (req, res) => {
  try {
    const { name, description } = req.body;
    let json = null;
    if (req.body.json) {
      try { json = JSON.parse(req.body.json); } catch (e) { json = req.body.json; }
    }
    const sceneDoc = new Scene({
      user: req.userId,
      name: name || `Scene ${Date.now()}`,
      description: description || "",
      json: json || null,
    });
    if (req.files?.file?.[0]) {
      const f = req.files.file[0];
      sceneDoc.filePath = `/uploads/${f.filename}`;
      sceneDoc.fileMime = f.mimetype;
    }
    if (req.files?.environment?.[0]) {
      const efile = req.files.environment[0];
      sceneDoc.environmentMap = `/uploads/${efile.filename}`;
    }
    // optional env + camera state
    if (req.body.backgroundColor) sceneDoc.backgroundColor = req.body.backgroundColor;
    try {
      if (req.body.cameraState) {
        const cam = JSON.parse(req.body.cameraState);
        if (cam && Array.isArray(cam.position) && Array.isArray(cam.quaternion)) sceneDoc.cameraState = cam;
      }
    } catch (e) {}
    sceneDoc.effects = {
      bloomEnabled: req.body.bloomEnabled === 'true' || req.body.bloomEnabled === true,
      oceanEnabled: req.body.oceanEnabled === 'true' || req.body.oceanEnabled === true,
      rainEnabled: req.body.rainEnabled === 'true' || req.body.rainEnabled === true,
    };
    await sceneDoc.save();
    res.json({ ok: true, id: sceneDoc._id, scene: sceneDoc });
  } catch (err) {
    console.error("save scene error:", err);
    res.status(500).json({ ok: false, error: String(err) });
  }
});

// GET /api/scenes
// list scenes (basic metadata)
router.get("/", protect, async (req, res) => {
  try {
    const list = await Scene.find({ user: req.userId }).sort({ updatedAt: -1 }).limit(200).lean();
    // return only minimal fields
    const out = list.map((s) => ({
      _id: s._id,
      name: s.name,
      description: s.description,
      thumbnailUrl: s.thumbnailPath || null,
      fileUrl: s.filePath || null,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
    }));
    res.json(out);
  } catch (err) {
    console.error("list scenes error:", err);
    res.status(500).json({ ok: false, error: String(err) });
  }
});

// GET /api/scenes/:id
// returns scene metadata and json (if stored)
router.get("/:id", protect, async (req, res) => {
  try {
    const id = req.params.id;
    const s = await Scene.findById(id).lean();
    if (!s) return res.status(404).json({ ok: false, error: "not found" });
    if (!s.user || String(s.user) !== String(req.userId)) {
      return res.status(403).json({ ok: false, error: "forbidden" });
    }
    res.json({
      _id: s._id,
      name: s.name,
      description: s.description,
      json: s.json,
      fileUrl: s.filePath || null,
      fileMime: s.fileMime || null,
      thumbnailUrl: s.thumbnailPath || null,
      environmentMap: s.environmentMap || null,
      backgroundColor: s.backgroundColor || null,
      cameraState: s.cameraState || null,
      effects: s.effects || {},
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
    });
  } catch (err) {
    console.error("get scene error:", err);
    res.status(500).json({ ok: false, error: String(err) });
  }
});

// POST /api/scenes/:id/update
// allows partial metadata updates without re-uploading main file
router.post('/:id/update', protect, upload.fields([
  { name: 'environment', maxCount: 1 },
]), async (req, res) => {
  try {
    const id = req.params.id;
    const sceneDoc = await Scene.findById(id);
    if (!sceneDoc) return res.status(404).json({ ok: false, error: 'not found' });
    if (!sceneDoc.user || String(sceneDoc.user) !== String(req.userId)) {
      return res.status(403).json({ ok: false, error: 'forbidden' });
    }
    if (req.body.name) sceneDoc.name = req.body.name;
    if (req.body.description) sceneDoc.description = req.body.description;
    if (req.body.json) {
      try { sceneDoc.json = JSON.parse(req.body.json); } catch { sceneDoc.json = req.body.json; }
    }
    if (req.files?.environment?.[0]) {
      const efile = req.files.environment[0];
      sceneDoc.environmentMap = `/uploads/${efile.filename}`;
    }
    if (req.body.backgroundColor) sceneDoc.backgroundColor = req.body.backgroundColor;
    try {
      if (req.body.cameraState) {
        const cam = JSON.parse(req.body.cameraState);
        if (cam && Array.isArray(cam.position) && Array.isArray(cam.quaternion)) sceneDoc.cameraState = cam;
      }
    } catch (e) {}
    if (typeof req.body.bloomEnabled !== 'undefined') sceneDoc.effects.bloomEnabled = req.body.bloomEnabled === 'true' || req.body.bloomEnabled === true;
    if (typeof req.body.oceanEnabled !== 'undefined') sceneDoc.effects.oceanEnabled = req.body.oceanEnabled === 'true' || req.body.oceanEnabled === true;
    if (typeof req.body.rainEnabled !== 'undefined') sceneDoc.effects.rainEnabled = req.body.rainEnabled === 'true' || req.body.rainEnabled === true;
    await sceneDoc.save();
    res.json({ ok: true, scene: sceneDoc });
  } catch (err) {
    console.error('update scene error:', err);
    res.status(500).json({ ok: false, error: String(err) });
  }
});

// DELETE /api/scenes/:id (optional admin)
// router.delete("/:id", async (req, res) => { ... });

module.exports = router;
