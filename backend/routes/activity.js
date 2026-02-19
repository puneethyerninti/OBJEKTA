const express = require("express");
const router = express.Router();
const Project = require("../models/Project");
const { protect } = require("../middleware/authMiddleware");

function formatWhen(dateLike) {
  const d = new Date(dateLike || Date.now());
  if (Number.isNaN(d.getTime())) return "Recently";
  const delta = Date.now() - d.getTime();
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (delta < minute) return "Just now";
  if (delta < hour) return `${Math.max(1, Math.floor(delta / minute))} min ago`;
  if (delta < day) return `${Math.max(1, Math.floor(delta / hour))} hr ago`;
  if (delta < 7 * day) return `${Math.max(1, Math.floor(delta / day))} day${Math.floor(delta / day) > 1 ? "s" : ""} ago`;
  return d.toLocaleDateString();
}

router.get("/", protect, async (req, res) => {
  try {
    const projects = await Project.find({
      $or: [{ user: req.userId }, { collaborators: req.userId }],
    })
      .select("title createdAt updatedAt lastSavedAt")
      .sort({ updatedAt: -1 })
      .limit(20)
      .lean();

    const activity = projects.map((project, idx) => {
      const ts = project.lastSavedAt || project.updatedAt || project.createdAt;
      return {
        id: String(project._id || idx),
        text: `Updated project ${project.title || "Untitled"}`,
        when: formatWhen(ts),
      };
    });

    res.json(activity);
  } catch (err) {
    console.error("GET /api/activity error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
