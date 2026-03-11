// backend/models/Version.js
const mongoose = require("mongoose");

const versionSchema = new mongoose.Schema(
  {
    project: { type: mongoose.Schema.Types.ObjectId, ref: "Project", required: true },
    versionNumber: { type: Number, required: true },
    author: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    message: { type: String, default: "" },

    // Diff from previous version (JSON patch RFC 6902 format)
    diff: { type: mongoose.Schema.Types.Mixed, default: null },
    diffSize: { type: Number, default: 0 },

    // Full snapshot (stored periodically for fast restore)
    snapshot: { type: mongoose.Schema.Types.Mixed, default: null },
    snapshotSize: { type: Number, default: 0 },
    isSnapshot: { type: Boolean, default: false },

    // Metadata
    objectCount: { type: Number, default: 0 },
    addedObjects: [String],
    removedObjects: [String],
    modifiedObjects: [String],
  },
  { timestamps: true }
);

versionSchema.index({ project: 1, versionNumber: -1 });
versionSchema.index({ project: 1, createdAt: -1 });

module.exports = mongoose.model("Version", versionSchema);
