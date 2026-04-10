// backend/routes/projects.js
const express = require("express");
const router = express.Router();
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const zlib = require("zlib");
const Project = require("../models/Project");
const { getIO } = require("../socket");
const { protect } = require("../middleware/authMiddleware");
const { processScenePayload, hydrateSceneFromFile, approxBytes } = require("../utils/sceneStorage");
const { createVersion } = require("../services/versioningService");

// ensure uploads dir exists
const uploadsDir = path.resolve(__dirname, "..", "uploads");
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

// ensure thumbnails subdir exists
const thumbnailsDir = path.resolve(uploadsDir, "thumbnails");
if (!fs.existsSync(thumbnailsDir)) fs.mkdirSync(thumbnailsDir, { recursive: true });

// ensure scenes subdir exists
const scenesDir = path.resolve(uploadsDir, "scenes");
if (!fs.existsSync(scenesDir)) fs.mkdirSync(scenesDir, { recursive: true });

// multer storage for general uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || ".bin";
    const safeBase = Date.now() + "-" + Math.random().toString(36).slice(2, 8);
    cb(null, `${safeBase}${ext}`);
  },
});
const upload = multer({ storage });

// Combined storage for thumbnail + environment
const combinedStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (file.fieldname === 'thumbnail') return cb(null, thumbnailsDir);
    if (file.fieldname === 'scene') return cb(null, scenesDir);
    // environment or other extra files → generic uploads dir
    return cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.bin';
    const safeBase = Date.now() + '-' + Math.random().toString(36).slice(2, 8);
    cb(null, `${safeBase}${ext}`);
  }
});

const allowedThumbTypes = new Set([
  'image/png','image/jpeg','image/jpg','image/pjpeg','image/webp','image/x-png'
]);

const allowedSceneExt = new Set(['.json', '.glb', '.gltf']);
const allowedSceneMime = new Set([
  'application/json',
  'application/octet-stream',
  'application/gltf+json',
  'model/gltf-binary',
]);

const allowedEnvExt = new Set(['.hdr', '.exr', '.png', '.jpg', '.jpeg', '.webp']);
const allowedEnvMime = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/vnd.radiance',
  'application/octet-stream',
]);

const uploadProjectFiles = multer({
  storage: combinedStorage,
  limits: {
    fields: 400,
    fieldSize: 180 * 1024 * 1024,
    fileSize: 300 * 1024 * 1024, // allow big scenes/hdr if needed
  },
  fileFilter: (req, file, cb) => {
    if (file.fieldname === 'thumbnail') {
      if (!file.mimetype || allowedThumbTypes.has(file.mimetype)) return cb(null, true);
      return cb(new Error('Invalid thumbnail MIME type'));
    }
    if (file.fieldname === 'scene') {
      const ext = path.extname(file.originalname || '').toLowerCase();
      const mime = file.mimetype || '';
      if (allowedSceneExt.has(ext) || allowedSceneMime.has(mime)) return cb(null, true);
      return cb(new Error('Invalid scene file type'));
    }
    if (file.fieldname === 'environment') {
      const ext = path.extname(file.originalname || '').toLowerCase();
      const mime = file.mimetype || '';
      if (allowedEnvExt.has(ext) || allowedEnvMime.has(mime)) return cb(null, true);
      return cb(new Error('Invalid environment file type'));
    }
    cb(null, true);
  }
});

function handleProjectFiles(req, res, next) {
  uploadProjectFiles.fields([
    { name: 'thumbnail', maxCount: 1 },
    { name: 'environment', maxCount: 1 },
    { name: 'scene', maxCount: 1 },
  ])(req, res, function(err){
    if (err) {
      const code = err?.code || '';
      if (code === 'LIMIT_FILE_SIZE') return res.status(413).json({ message: 'Uploaded file too large', error: err.message });
      return res.status(400).json({ message: 'File upload error', error: err.message });
    }
    next();
  });
}

const MAX_INLINE_DATA_BYTES = 12 * 1024 * 1024; // 12MB keeps BSON under 16MB limit

function hydrateData(doc) {
  if (!doc) return doc;
  const obj = doc.toObject ? doc.toObject() : doc;
  if (obj && (!obj.data || (typeof obj.data === 'string' && obj.data.length === 0)) && obj.dataBlob) {
    try {
      if (obj.dataEncoding === 'deflate-base64') {
        const inflated = zlib.inflateSync(Buffer.from(obj.dataBlob, 'base64')).toString('utf8');
        obj.data = JSON.parse(inflated);
      } else {
        obj.data = JSON.parse(obj.dataBlob);
      }
    } catch (e) {
      obj.data = null;
      obj.dataError = `Failed to inflate scene: ${e.message}`;
    }
  }
  return hydrateSceneFromFile(obj);
}

// helper to convert mongoose doc to plain object with string _id
// helper: build absolute URL for a stored path (uploads)
function makeAbsolute(req, pathValue) {
  try {
    if (!pathValue) return null;
    if (/^https?:\/\//i.test(pathValue)) return pathValue;
    const hostBase = `${req.protocol}://${req.get("host")}`.replace(/\/+$/, "");
    const p = pathValue.startsWith("/") ? pathValue : `/${pathValue}`;
    return `${hostBase}${p}`;
  } catch (e) {
    return pathValue || null;
  }
}

// helper to convert mongoose doc to plain object with string _id
function toPublic(req, p) {
  if (!p) return p;
  const obj = p.toObject ? p.toObject() : p;
  obj._id = String(obj._id);

  const thumb = obj.thumbnailUrl || obj.thumbnail || null;
  obj.thumbnailUrl = makeAbsolute(req, thumb);

    // do not leak absolute scene file paths to clients
    if (obj.sceneFilePath) delete obj.sceneFilePath;

  if (Object.prototype.hasOwnProperty.call(obj, 'dataBlob')) delete obj.dataBlob;

  return obj;
}

// Helper: access check (owner or collaborator)
function canAccess(p, userId) {
  if (!p) return false;
  const uid = String(userId || "");
  if (!uid || uid === "undefined" || uid === "null") return false;

  // Owner check — handle both raw ObjectId and populated { _id } shapes
  const ownerId = p.user?._id ? String(p.user._id) : p.user ? String(p.user) : null;
  if (ownerId && ownerId === uid) return true;

  // Collaborator check — handle both ObjectId array and populated objects
  if (Array.isArray(p.collaborators) && p.collaborators.some(c => {
    const cid = c?._id ? String(c._id) : String(c);
    return cid === uid;
  })) return true;

  // Debug log when access is denied (only in development)
  if (process.env.NODE_ENV !== 'production') {
    console.warn(`[canAccess] DENIED — userId=${uid} ownerId=${ownerId} collaborators=[${(p.collaborators || []).map(c => String(c?._id || c)).join(',')}]`);
  }
  return false;
}

function safeIO() {
  try {
    return getIO();
  } catch (e) {
    return null;
  }
}

function getProjectParticipantIds(project) {
  const ids = new Set();
  if (!project) return ids;

  const ownerId = project.user?._id ? String(project.user._id) : project.user ? String(project.user) : null;
  if (ownerId) ids.add(ownerId);

  if (Array.isArray(project.collaborators)) {
    project.collaborators.forEach((c) => {
      const cid = c?._id ? String(c._id) : String(c);
      if (cid) ids.add(cid);
    });
  }

  return ids;
}

function emitProjectEvent(project, eventName, payload) {
  const io = safeIO();
  if (!io || !project) return;
  for (const uid of getProjectParticipantIds(project)) {
    io.to(`dashboard:${uid}`).emit(eventName, payload);
    io.to(`user:${uid}`).emit(eventName, payload);
  }
}

function emitProjectRoom(projectId, eventName, payload) {
  const io = safeIO();
  if (!io || !projectId) return;
  io.to(String(projectId)).emit(eventName, payload);
}

// GET /api/projects - list (auth required)
router.get("/", protect, async (req, res) => {
  try {
    const uid = req.userId;
    // Only return projects where the requesting user is owner or collaborator
    const projects = await Project.find({
      $or: [ { user: uid }, { collaborators: uid } ]
    })
      .select("title description user collaborators progress assets thumbnail lastSavedAt environmentMap environmentColor cameraState effects dataCompressed dataSize createdAt updatedAt")
      .sort({ updatedAt: -1 })
      .lean();
    return res.status(200).json({ success: true, projects: projects.map((p) => toPublic(req, p)) });
  } catch (err) {
    console.error("GET /api/projects error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// GET /api/projects/:id - single (auth required)
router.get("/:id", protect, async (req, res) => {
  try {
    const p = await Project.findById(req.params.id).lean();
    if (!p) return res.status(404).json({ message: "Project not found" });
    if (!canAccess(p, req.userId)) return res.status(403).json({ message: "Forbidden" });
    return res.json(toPublic(req, hydrateData(p)));
  } catch (err) {
    console.error("GET /api/projects/:id error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// POST /api/projects - create
router.post("/", protect, handleProjectFiles, async (req, res) => {
  try {
    const { title, name, lastSavedAt } = req.body;
    const scenePayload = await processScenePayload({
      sceneFile: req.files?.scene?.[0] || null,
      inlineData: req.body.data,
      maxInlineBytes: MAX_INLINE_DATA_BYTES,
      sceneDir: scenesDir,
    });

    const projectTitle = (title || name || "").trim();
    if (!projectTitle) return res.status(400).json({ message: "Missing title" });

    const isDiskScene = scenePayload.sceneStorageType === 'disk';
    const proj = new Project({
      title: projectTitle,
      description: req.body.description || "",
      progress: Number(req.body.progress) || 0,
      data: isDiskScene ? null : (scenePayload.inlineData || {}),
      dataBlob: null,
      dataEncoding: scenePayload.dataEncoding || null,
      dataCompressed: scenePayload.dataCompressed || false,
      dataSize: isDiskScene ? 0 : (scenePayload.inlineSize || approxBytes(scenePayload.inlineData || {})),
      sceneStorageType: scenePayload.sceneStorageType,
      sceneFilePath: scenePayload.sceneFilePath,
      sceneOriginalSize: scenePayload.sceneOriginalSize,
      sceneCompressedSize: scenePayload.sceneCompressedSize,
      lastSavedAt: lastSavedAt ? new Date(lastSavedAt) : new Date(),
      assets: [],
      thumbnail: "",
      user: req.userId,
      collaborators: [],
      environmentColor: req.body.environmentColor || null,
      effects: {
        bloomEnabled: req.body.bloomEnabled === 'true' || req.body.bloomEnabled === true,
        oceanEnabled: req.body.oceanEnabled === 'true' || req.body.oceanEnabled === true,
        rainEnabled: req.body.rainEnabled === 'true' || req.body.rainEnabled === true,
      },
    });

    const saved = await proj.save();

    if (req.files?.thumbnail?.[0]) {
      const thumbFile = req.files.thumbnail[0];
      const publicUrl = `/uploads/thumbnails/${thumbFile.filename}`;
      saved.thumbnail = publicUrl;
      saved.assets.push({
        key: thumbFile.filename,
        url: publicUrl,
        contentType: thumbFile.mimetype || null,
      });
      await saved.save();

      emitProjectEvent(saved, "project_thumbnail_updated", {
        projectId: String(saved._id),
        thumbnailUrl: makeAbsolute(req, publicUrl),
      });
    }

    if (req.files?.environment?.[0]) {
      const envFile = req.files.environment[0];
      saved.environmentMap = `/uploads/${envFile.filename}`;
      saved.assets.push({
        key: envFile.filename,
        url: `/uploads/${envFile.filename}`,
        contentType: envFile.mimetype || null,
      });
      await saved.save();
    }

    // Build public object with normalized absolute thumbnail URL
    const publicObj = toPublic(req, saved);

    emitProjectEvent(saved, "project_created", {
      ...publicObj,
      thumbnailUrl: makeAbsolute(req, publicObj.thumbnailUrl)
    });
    emitProjectEvent(saved, "projects:changed", { projectId: String(saved._id) });

    res.status(201).json(publicObj);
  } catch (err) {
    console.error("POST /api/projects error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// ✅ NEW: POST /api/projects/:id/assets - upload .glb or other files
router.post("/:id/assets", protect, upload.single("file"), async (req, res) => {
  try {
    const { id } = req.params;
    const project = await Project.findById(id);
    if (!project) return res.status(404).json({ message: "Project not found" });
    if (!canAccess(project, req.userId)) return res.status(403).json({ message: "Forbidden" });
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });

    const publicUrl = `/uploads/${req.file.filename}`;
    const asset = {
      key: req.file.filename,
      url: publicUrl,
      contentType: req.file.mimetype || "application/octet-stream",
    };

    project.assets = project.assets || [];
    project.assets.push(asset);
    project.lastSavedAt = new Date();
    await project.save();

    emitProjectEvent(project, "project_asset_added", {
      projectId: String(project._id),
      asset,
    });
    emitProjectRoom(String(project._id), "project_asset_added", {
      projectId: String(project._id),
      asset,
    });

    res.status(201).json({
      success: true,
      message: "Asset uploaded successfully",
      asset,
      project: toPublic(req, project),
    });
  } catch (err) {
    console.error("POST /api/projects/:id/assets error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});
// NEW: POST /api/projects/:id/assets/s3 - register S3 or external/tus assets
// Body: { key, url, filename, contentType, size }
router.post("/:id/assets/s3", protect, async (req, res) => {
  try {
    const { id } = req.params;
    const { key = null, url = null, filename = null, contentType = null, size = null } = req.body || {};
    const project = await Project.findById(id);
    if (!project) return res.status(404).json({ message: "Project not found" });
    if (!canAccess(project, req.userId)) return res.status(403).json({ message: "Forbidden" });
    if (!key && !url) return res.status(400).json({ message: "key or url required" });

    const asset = {
      key: key || null,
      url: url || (key ? `${process.env.S3_PUBLIC_BASE ? (process.env.S3_PUBLIC_BASE.replace(/\/$/, "") + "/" + key) : null}` : null),
      filename: filename || null,
      contentType: contentType || null,
      size: typeof size === "number" ? size : (Number.isFinite(parseInt(size)) ? parseInt(size) : null),
      createdAt: new Date(),
      source: null,
    };

    // determine source
    try {
      if (key) asset.source = "s3";
      else if (url && /\/api\/uploads\/tus\//i.test(String(url))) asset.source = "tus";
      else asset.source = "url";
    } catch (e) { asset.source = null; }

    project.assets = project.assets || [];
    project.assets.push(asset);
    project.lastSavedAt = new Date();
    const saved = await project.save();

    // emit socket event
    emitProjectEvent(saved, "project_asset_added", { projectId: String(saved._id), asset });
    emitProjectRoom(String(saved._id), "project_asset_added", { projectId: String(saved._id), asset });
    emitProjectEvent(saved, "project_updated", toPublic(req, saved));
    emitProjectRoom(String(saved._id), "project_updated", toPublic(req, saved));

    res.status(201).json({ success: true, project: toPublic(req, saved), asset });
  } catch (err) {
    console.error("POST /api/projects/:id/assets/s3 error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// PUT /api/projects/:id - update project
router.put("/:id", protect, handleProjectFiles, async (req, res) => {
  try {
    const { id } = req.params;
    const updates = {};

    if (typeof req.body.title === "string") updates.title = req.body.title.trim();
    if (typeof req.body.description === "string") updates.description = req.body.description;
    if (typeof req.body.progress !== "undefined" && !isNaN(parseFloat(req.body.progress))) {
      updates.progress = Math.max(0, Math.min(100, Number(req.body.progress)));
    }
    const hasSceneUpdate = (req.files?.scene?.[0]) || (typeof req.body.data !== 'undefined');
    const scenePayload = hasSceneUpdate ? await processScenePayload({
      sceneFile: req.files?.scene?.[0] || null,
      inlineData: typeof req.body.data !== 'undefined' ? req.body.data : undefined,
      maxInlineBytes: MAX_INLINE_DATA_BYTES,
      sceneDir: scenesDir,
    }) : null;
    if (scenePayload) {
      if (scenePayload.inlineData !== null) {
        updates.data = scenePayload.inlineData;
        updates.dataBlob = null;
        updates.dataEncoding = scenePayload.dataEncoding || null;
        updates.dataCompressed = scenePayload.dataCompressed || false;
        updates.dataSize = scenePayload.inlineSize || approxBytes(scenePayload.inlineData || {});
        updates.sceneStorageType = 'inline';
        updates.sceneFilePath = null;
        updates.sceneOriginalSize = scenePayload.sceneOriginalSize;
        updates.sceneCompressedSize = scenePayload.sceneCompressedSize;
      } else if (scenePayload.sceneStorageType === 'disk') {
        updates.data = null;
        updates.dataBlob = null;
        updates.dataEncoding = scenePayload.dataEncoding || null;
        updates.dataCompressed = scenePayload.dataCompressed || false;
        updates.dataSize = 0;
        updates.sceneStorageType = 'disk';
        updates.sceneFilePath = scenePayload.sceneFilePath;
        updates.sceneOriginalSize = scenePayload.sceneOriginalSize;
        updates.sceneCompressedSize = scenePayload.sceneCompressedSize;
      }
    }

    updates.lastSavedAt = new Date();

    // get existing project BEFORE update so we know the previous thumbnail
    const existing = await Project.findById(id);
    if (!existing) return res.status(404).json({ message: "Project not found" });
    if (!canAccess(existing, req.userId)) return res.status(403).json({ message: "Forbidden" });

    // if new thumbnail uploaded
    if (req.files?.thumbnail?.[0]) {
      const f = req.files.thumbnail[0];
      const newUrl = `/uploads/thumbnails/${f.filename}`;
      updates.thumbnail = newUrl;
    }
    if (req.files?.environment?.[0]) {
      const f = req.files.environment[0];
      updates.environmentMap = `/uploads/${f.filename}`;
    }
    if (req.body.environmentColor) updates.environmentColor = req.body.environmentColor;
    updates.effects = {
      bloomEnabled: req.body.bloomEnabled === 'true' || req.body.bloomEnabled === true,
      oceanEnabled: req.body.oceanEnabled === 'true' || req.body.oceanEnabled === true,
      rainEnabled: req.body.rainEnabled === 'true' || req.body.rainEnabled === true,
    };
    if (req.body.cameraState) {
      try { updates.cameraState = JSON.parse(req.body.cameraState); } catch (e) {}
    }

    const updated = await Project.findByIdAndUpdate(id, updates, { new: true });
    if (!updated) return res.status(404).json({ message: "Project not found" });

    // auto-version on scene data changes
    if (hasSceneUpdate) {
      try {
        const sceneData = updates.data || (updated.sceneStorageType === 'disk' ? await hydrateSceneFromFile(updated) : updated.data);
        if (sceneData) await createVersion(id, req.userId, sceneData, req.body.versionMessage);
      } catch (e) { console.error("Auto-version error:", e); }
    }

    // cleanup previous scene file when replaced
    if (scenePayload && scenePayload.sceneStorageType === 'disk' && existing.sceneFilePath && existing.sceneFilePath !== scenePayload.sceneFilePath) {
      try { if (fs.existsSync(existing.sceneFilePath)) fs.unlinkSync(existing.sceneFilePath); } catch (e) {}
    }

    // delete previous thumbnail
    if (req.files?.thumbnail?.[0] && existing.thumbnail) {
      const prevName = path.basename(existing.thumbnail);
      const prevPath = path.join(thumbnailsDir, prevName);
      if (fs.existsSync(prevPath)) fs.unlinkSync(prevPath);
    }

    if (req.files?.thumbnail?.[0]) {
      const f = req.files.thumbnail[0];
      updated.assets = updated.assets || [];
      updated.assets.push({
        key: f.filename,
        url: `/uploads/thumbnails/${f.filename}`,
        contentType: f.mimetype || null,
      });
      await updated.save();
    }
    if (req.files?.environment?.[0]) {
      const f = req.files.environment[0];
      updated.assets = updated.assets || [];
      updated.assets.push({
        key: f.filename,
        url: `/uploads/${f.filename}`,
        contentType: f.mimetype || null,
      });
      await updated.save();
    }

    const publicObj = toPublic(req, updated);

    emitProjectEvent(updated, "project_updated", {
      ...publicObj,
      thumbnailUrl: makeAbsolute(req, publicObj.thumbnailUrl)
    });
    emitProjectRoom(id, "project_updated", {
      ...publicObj,
      thumbnailUrl: makeAbsolute(req, publicObj.thumbnailUrl),
    });
    emitProjectEvent(updated, "projects:changed", { projectId: String(id) });
    if (publicObj.thumbnailUrl)
      emitProjectEvent(updated, "project_thumbnail_updated", {
        projectId: publicObj._id,
        thumbnailUrl: makeAbsolute(req, publicObj.thumbnailUrl),
      });

    res.json(publicObj);
  } catch (err) {
    console.error("PUT /api/projects/:id error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// DELETE /api/projects/:id
router.delete("/:id", protect, async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await Project.findById(id);
    if (!existing) return res.status(404).json({ message: "Project not found" });
    if (!canAccess(existing, req.userId)) return res.status(403).json({ message: "Forbidden" });

    await Project.deleteOne({ _id: id });

    emitProjectEvent(existing, "project_deleted", String(id));
    emitProjectEvent(existing, "projects:changed", { projectId: String(id) });
    res.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/projects/:id error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

module.exports = router;
