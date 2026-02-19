// backend/models/Scene.js
const mongoose = require("mongoose");

const SceneSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: false, index: true },
  name: { type: String, required: true },
  description: { type: String, default: "" },
  json: { type: Object, default: null }, // store exported scene JSON snapshot (Array or Object)
  filePath: { type: String, default: null }, // local path for uploaded glb/gltf
  fileMime: { type: String, default: null },
  thumbnailPath: { type: String, default: null },
  // Extended environment & camera/effects metadata
  environmentMap: { type: String, default: null }, // relative path to .hdr/.exr
  backgroundColor: { type: String, default: null },
  cameraState: {
    position: { type: [Number], default: undefined }, // [x,y,z]
    quaternion: { type: [Number], default: undefined }, // [x,y,z,w]
    fov: { type: Number, default: undefined },
  },
  effects: {
    bloomEnabled: { type: Boolean, default: false },
    oceanEnabled: { type: Boolean, default: false },
    rainEnabled: { type: Boolean, default: false },
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

SceneSchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model("Scene", SceneSchema);
