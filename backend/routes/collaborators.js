const express = require("express");
const router = express.Router();
const Project = require("../models/Project");
const User = require("../models/User");
const { protect } = require("../middleware/authMiddleware");

router.get("/", protect, async (req, res) => {
  try {
    const projects = await Project.find({
      $or: [{ user: req.userId }, { collaborators: req.userId }],
    })
      .select("user collaborators")
      .limit(200)
      .lean();

    const ids = new Set();
    for (const project of projects) {
      if (project?.user) ids.add(String(project.user));
      if (Array.isArray(project?.collaborators)) {
        for (const collaboratorId of project.collaborators) ids.add(String(collaboratorId));
      }
    }
    ids.delete(String(req.userId));

    if (ids.size === 0) return res.json([]);

    const users = await User.find({ _id: { $in: Array.from(ids) } })
      .select("name email")
      .limit(50)
      .lean();

    const payload = users.map((user) => ({
      id: String(user._id),
      name: user.name || user.email || "Collaborator",
      role: "Collaborator",
    }));

    res.json(payload);
  } catch (err) {
    console.error("GET /api/collaborators error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
