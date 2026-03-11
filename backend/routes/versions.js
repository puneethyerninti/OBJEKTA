// backend/routes/versions.js
const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authMiddleware");
const Project = require("../models/Project");
const {
  createVersion,
  reconstructVersion,
  getVersionHistory,
  getVersionDiff,
} = require("../services/versioningService");

router.use(protect);

// Helper: check project access
async function checkAccess(req, res) {
  const project = await Project.findById(req.params.projectId).lean();
  if (!project) { res.status(404).json({ success: false, message: "Project not found" }); return null; }
  const uid = req.userId.toString();
  const isOwner = project.user?.toString() === uid;
  const isCollab = project.collaborators?.some((c) => c.toString() === uid);
  if (!isOwner && !isCollab) { res.status(403).json({ success: false, message: "Access denied" }); return null; }
  return project;
}

// GET /api/versions/:projectId — list version history
router.get("/:projectId", async (req, res) => {
  try {
    const project = await checkAccess(req, res);
    if (!project) return;

    const { page = 1, limit = 20 } = req.query;
    const result = await getVersionHistory(req.params.projectId, {
      page: Number(page),
      limit: Number(limit),
    });

    res.json({ success: true, ...result });
  } catch (err) {
    console.error("Get version history error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/versions/:projectId/:versionNumber — get a specific version's data
router.get("/:projectId/:versionNumber", async (req, res) => {
  try {
    const project = await checkAccess(req, res);
    if (!project) return;

    const versionNumber = Number(req.params.versionNumber);
    const data = await reconstructVersion(req.params.projectId, versionNumber);

    res.json({ success: true, versionNumber, data });
  } catch (err) {
    console.error("Get version data error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/versions/:projectId/diff/:from/:to — get diff between two versions
router.get("/:projectId/diff/:from/:to", async (req, res) => {
  try {
    const project = await checkAccess(req, res);
    if (!project) return;

    const from = Number(req.params.from);
    const to = Number(req.params.to);
    const diff = await getVersionDiff(req.params.projectId, from, to);

    res.json({ success: true, ...diff });
  } catch (err) {
    console.error("Get version diff error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/versions/:projectId/restore/:versionNumber — restore project to a version
router.post("/:projectId/restore/:versionNumber", async (req, res) => {
  try {
    const project = await checkAccess(req, res);
    if (!project) return;

    const versionNumber = Number(req.params.versionNumber);
    const data = await reconstructVersion(req.params.projectId, versionNumber);

    // Update the project's scene data
    await Project.findByIdAndUpdate(req.params.projectId, {
      data,
      lastSavedAt: new Date(),
    });

    // Create a new version for the restore action
    await createVersion(
      req.params.projectId,
      req.userId,
      data,
      `Restored to version #${versionNumber}`
    );

    res.json({ success: true, message: `Restored to version #${versionNumber}`, data });
  } catch (err) {
    console.error("Restore version error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
