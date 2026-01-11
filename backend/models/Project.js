// backend/models/Project.js
const mongoose = require("mongoose");

const projectSchema = new mongoose.Schema(
  {
    title: { type: String, required: true }, // renamed from name → title
    description: { type: String, default: "" },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: false },
    collaborators: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    progress: { type: Number, default: 0 },
    assets: { type: Array, default: [] },
    thumbnail: { type: String, default: "" },

    // NEW: store full scene data / snapshot (mixed because it can be nested)
    data: { type: mongoose.Schema.Types.Mixed, default: {} },
    dataBlob: { type: String, default: null }, // base64 deflate payload for huge scenes
    dataEncoding: { type: String, default: null },
    dataCompressed: { type: Boolean, default: false },
    dataSize: { type: Number, default: 0 },

    // scene storage metadata
    sceneStorageType: { type: String, default: 'inline' }, // inline | disk | s3
    sceneFilePath: { type: String, default: null },
    sceneOriginalSize: { type: Number, default: 0 },
    sceneCompressedSize: { type: Number, default: 0 },

    // NEW: last saved timestamp to be used by Studio/Dashboard display
    lastSavedAt: { type: Date, default: Date.now },

    // Extended studio metadata (environment & effects)
    environmentMap: { type: String, default: null }, // path to .hdr/.exr
    environmentColor: { type: String, default: null },
    cameraState: {
      position: { type: [Number], default: undefined },
      quaternion: { type: [Number], default: undefined },
      fov: { type: Number, default: undefined },
    },
    effects: {
      bloomEnabled: { type: Boolean, default: false },
      oceanEnabled: { type: Boolean, default: false },
      rainEnabled: { type: Boolean, default: false },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Project", projectSchema);
