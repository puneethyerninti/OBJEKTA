// src/engine/MaterialLibrary.js
// ---------------------------------------------------------------------------
// Phase 6 — PBR Material Library engine.
// Comprehensive collection of physically-based material presets organised by
// category.  Each preset stores MeshStandardMaterial parameters + optional
// procedural texture descriptors.  The library supports:
//   • Browsing by category / search / tag
//   • Applying a preset to any Mesh
//   • Creating user-defined custom presets
//   • Undo-safe application (returns rollback data)
// ---------------------------------------------------------------------------

import * as THREE from "three";

/* ═══════════════════════════════════════════════════════════════════════════
   CATEGORIES
   ═══════════════════════════════════════════════════════════════════════ */

export const MATERIAL_CATEGORIES = [
  { id: "metals",   label: "Metals",   icon: "⚙️" },
  { id: "woods",    label: "Woods",    icon: "🪵" },
  { id: "stones",   label: "Stones",   icon: "🪨" },
  { id: "plastics", label: "Plastics", icon: "🧴" },
  { id: "glass",    label: "Glass",    icon: "🔮" },
  { id: "fabric",   label: "Fabrics",  icon: "🧵" },
  { id: "organic",  label: "Organic",  icon: "🌿" },
  { id: "emissive", label: "Emissive", icon: "💡" },
  { id: "special",  label: "Special",  icon: "✨" },
];

/* ═══════════════════════════════════════════════════════════════════════════
   PRESETS
   Every preset is a plain object with:
     id, name, category, tags[], params{}, texture? {}
   params maps directly to MeshStandardMaterial constructor arguments.
   texture (optional) is a descriptor for TextureGenerator.
   ═══════════════════════════════════════════════════════════════════════ */

export const MATERIAL_PRESETS = [
  // ── METALS ───────────────────────────────────────────────────────────
  {
    id: "polished-steel",
    name: "Polished Steel",
    category: "metals",
    tags: ["metal", "steel", "shiny", "reflective"],
    params: { color: "#c8c8cc", roughness: 0.12, metalness: 0.95 },
  },
  {
    id: "brushed-aluminum",
    name: "Brushed Aluminum",
    category: "metals",
    tags: ["metal", "aluminum", "brushed", "matte"],
    params: { color: "#d4d4d8", roughness: 0.35, metalness: 0.9 },
    texture: { type: "noise", scale: 80, intensity: 0.04, channel: "roughness" },
  },
  {
    id: "copper",
    name: "Copper",
    category: "metals",
    tags: ["metal", "copper", "warm", "reddish"],
    params: { color: "#b87333", roughness: 0.25, metalness: 0.95 },
  },
  {
    id: "gold",
    name: "Gold",
    category: "metals",
    tags: ["metal", "gold", "luxury", "shiny"],
    params: { color: "#ffd700", roughness: 0.15, metalness: 1.0 },
  },
  {
    id: "bronze",
    name: "Bronze",
    category: "metals",
    tags: ["metal", "bronze", "antique"],
    params: { color: "#cd7f32", roughness: 0.4, metalness: 0.85 },
  },
  {
    id: "iron-raw",
    name: "Raw Iron",
    category: "metals",
    tags: ["metal", "iron", "raw", "dark"],
    params: { color: "#48494b", roughness: 0.6, metalness: 0.8 },
    texture: { type: "noise", scale: 30, intensity: 0.1, channel: "roughness" },
  },
  {
    id: "chrome",
    name: "Chrome",
    category: "metals",
    tags: ["metal", "chrome", "mirror", "reflective"],
    params: { color: "#e8e8ea", roughness: 0.05, metalness: 1.0 },
  },
  {
    id: "titanium",
    name: "Titanium",
    category: "metals",
    tags: ["metal", "titanium", "aerospace"],
    params: { color: "#878681", roughness: 0.3, metalness: 0.9 },
  },

  // ── WOODS ────────────────────────────────────────────────────────────
  {
    id: "oak",
    name: "Oak Wood",
    category: "woods",
    tags: ["wood", "oak", "warm", "natural"],
    params: { color: "#a0724a", roughness: 0.7, metalness: 0 },
    texture: { type: "wood", scale: 10, intensity: 0.15 },
  },
  {
    id: "walnut",
    name: "Walnut",
    category: "woods",
    tags: ["wood", "walnut", "dark", "rich"],
    params: { color: "#5b3a22", roughness: 0.65, metalness: 0 },
    texture: { type: "wood", scale: 12, intensity: 0.12 },
  },
  {
    id: "pine",
    name: "Pine",
    category: "woods",
    tags: ["wood", "pine", "light", "soft"],
    params: { color: "#d4b87a", roughness: 0.75, metalness: 0 },
    texture: { type: "wood", scale: 8, intensity: 0.1 },
  },
  {
    id: "cherry",
    name: "Cherry Wood",
    category: "woods",
    tags: ["wood", "cherry", "reddish", "warm"],
    params: { color: "#8b3a3a", roughness: 0.6, metalness: 0 },
    texture: { type: "wood", scale: 10, intensity: 0.1 },
  },
  {
    id: "bamboo",
    name: "Bamboo",
    category: "woods",
    tags: ["wood", "bamboo", "natural", "light"],
    params: { color: "#c8ad7f", roughness: 0.55, metalness: 0 },
  },
  {
    id: "ebony",
    name: "Ebony",
    category: "woods",
    tags: ["wood", "ebony", "dark", "luxury"],
    params: { color: "#2a1f14", roughness: 0.45, metalness: 0.02 },
  },

  // ── STONES ───────────────────────────────────────────────────────────
  {
    id: "marble-white",
    name: "White Marble",
    category: "stones",
    tags: ["stone", "marble", "white", "luxury"],
    params: { color: "#f0ebe3", roughness: 0.2, metalness: 0.02 },
    texture: { type: "marble", scale: 4, intensity: 0.08 },
  },
  {
    id: "marble-black",
    name: "Black Marble",
    category: "stones",
    tags: ["stone", "marble", "black", "luxury"],
    params: { color: "#1a1a1e", roughness: 0.15, metalness: 0.03 },
    texture: { type: "marble", scale: 5, intensity: 0.06 },
  },
  {
    id: "granite",
    name: "Granite",
    category: "stones",
    tags: ["stone", "granite", "speckled"],
    params: { color: "#808080", roughness: 0.55, metalness: 0.02 },
    texture: { type: "noise", scale: 40, intensity: 0.12, channel: "color" },
  },
  {
    id: "sandstone",
    name: "Sandstone",
    category: "stones",
    tags: ["stone", "sandstone", "warm", "natural"],
    params: { color: "#c2a882", roughness: 0.8, metalness: 0 },
    texture: { type: "noise", scale: 25, intensity: 0.06, channel: "roughness" },
  },
  {
    id: "concrete",
    name: "Concrete",
    category: "stones",
    tags: ["stone", "concrete", "urban", "rough"],
    params: { color: "#999999", roughness: 0.85, metalness: 0 },
    texture: { type: "noise", scale: 20, intensity: 0.08, channel: "roughness" },
  },
  {
    id: "slate",
    name: "Slate",
    category: "stones",
    tags: ["stone", "slate", "dark", "layered"],
    params: { color: "#4a5055", roughness: 0.7, metalness: 0.01 },
  },

  // ── PLASTICS ─────────────────────────────────────────────────────────
  {
    id: "glossy-plastic",
    name: "Glossy Plastic",
    category: "plastics",
    tags: ["plastic", "glossy", "shiny", "smooth"],
    params: { color: "#e63946", roughness: 0.1, metalness: 0 },
  },
  {
    id: "matte-plastic",
    name: "Matte Plastic",
    category: "plastics",
    tags: ["plastic", "matte", "soft"],
    params: { color: "#f1faee", roughness: 0.6, metalness: 0 },
  },
  {
    id: "rubber",
    name: "Rubber",
    category: "plastics",
    tags: ["plastic", "rubber", "grip", "dark"],
    params: { color: "#2b2b2b", roughness: 0.9, metalness: 0 },
  },
  {
    id: "silicone",
    name: "Silicone",
    category: "plastics",
    tags: ["plastic", "silicone", "soft", "translucent"],
    params: { color: "#c9e4de", roughness: 0.4, metalness: 0, opacity: 0.85, transparent: true },
  },
  {
    id: "acrylic",
    name: "Acrylic",
    category: "plastics",
    tags: ["plastic", "acrylic", "clear", "hard"],
    params: { color: "#ffffff", roughness: 0.05, metalness: 0, opacity: 0.7, transparent: true },
  },

  // ── GLASS ────────────────────────────────────────────────────────────
  {
    id: "clear-glass",
    name: "Clear Glass",
    category: "glass",
    tags: ["glass", "clear", "transparent"],
    params: { color: "#ffffff", roughness: 0.0, metalness: 0.1, opacity: 0.2, transparent: true },
  },
  {
    id: "frosted-glass",
    name: "Frosted Glass",
    category: "glass",
    tags: ["glass", "frosted", "diffuse"],
    params: { color: "#e8f0f0", roughness: 0.5, metalness: 0.05, opacity: 0.35, transparent: true },
  },
  {
    id: "tinted-glass",
    name: "Tinted Glass",
    category: "glass",
    tags: ["glass", "tinted", "dark"],
    params: { color: "#1a3a3a", roughness: 0.05, metalness: 0.1, opacity: 0.3, transparent: true },
  },
  {
    id: "stained-glass",
    name: "Stained Glass",
    category: "glass",
    tags: ["glass", "stained", "colorful"],
    params: { color: "#4a90e2", roughness: 0.1, metalness: 0.05, opacity: 0.45, transparent: true },
  },

  // ── FABRICS ──────────────────────────────────────────────────────────
  {
    id: "cotton",
    name: "Cotton",
    category: "fabric",
    tags: ["fabric", "cotton", "soft", "natural"],
    params: { color: "#f5f5dc", roughness: 0.95, metalness: 0 },
  },
  {
    id: "silk",
    name: "Silk",
    category: "fabric",
    tags: ["fabric", "silk", "shiny", "smooth"],
    params: { color: "#fffff0", roughness: 0.3, metalness: 0.02 },
  },
  {
    id: "denim",
    name: "Denim",
    category: "fabric",
    tags: ["fabric", "denim", "blue", "casual"],
    params: { color: "#3d5a80", roughness: 0.85, metalness: 0 },
    texture: { type: "noise", scale: 60, intensity: 0.03, channel: "color" },
  },
  {
    id: "leather",
    name: "Leather",
    category: "fabric",
    tags: ["fabric", "leather", "luxury", "warm"],
    params: { color: "#6b3a2a", roughness: 0.65, metalness: 0 },
    texture: { type: "noise", scale: 35, intensity: 0.05, channel: "roughness" },
  },
  {
    id: "velvet",
    name: "Velvet",
    category: "fabric",
    tags: ["fabric", "velvet", "luxury", "soft"],
    params: { color: "#5e1f6b", roughness: 0.85, metalness: 0 },
  },
  {
    id: "canvas",
    name: "Canvas",
    category: "fabric",
    tags: ["fabric", "canvas", "rough", "natural"],
    params: { color: "#c4b998", roughness: 0.92, metalness: 0 },
    texture: { type: "checkerboard", scale: 50, intensity: 0.03, channel: "roughness" },
  },

  // ── ORGANIC ──────────────────────────────────────────────────────────
  {
    id: "skin",
    name: "Skin",
    category: "organic",
    tags: ["organic", "skin", "subsurface"],
    params: { color: "#e8b89d", roughness: 0.55, metalness: 0 },
  },
  {
    id: "clay",
    name: "Clay",
    category: "organic",
    tags: ["organic", "clay", "earthy", "sculpted"],
    params: { color: "#c48a5a", roughness: 0.8, metalness: 0 },
  },
  {
    id: "moss",
    name: "Moss",
    category: "organic",
    tags: ["organic", "moss", "green", "nature"],
    params: { color: "#3a5a2a", roughness: 0.95, metalness: 0 },
    texture: { type: "noise", scale: 15, intensity: 0.1, channel: "color" },
  },
  {
    id: "bark",
    name: "Tree Bark",
    category: "organic",
    tags: ["organic", "bark", "tree", "rough"],
    params: { color: "#5a3a1f", roughness: 0.92, metalness: 0 },
    texture: { type: "noise", scale: 10, intensity: 0.15, channel: "roughness" },
  },
  {
    id: "ice",
    name: "Ice",
    category: "organic",
    tags: ["organic", "ice", "cold", "translucent"],
    params: { color: "#c8e6f0", roughness: 0.08, metalness: 0.02, opacity: 0.6, transparent: true },
  },

  // ── EMISSIVE ─────────────────────────────────────────────────────────
  {
    id: "neon-blue",
    name: "Neon Blue",
    category: "emissive",
    tags: ["emissive", "neon", "blue", "glow"],
    params: { color: "#0a1628", roughness: 0.2, metalness: 0, emissive: "#00d4ff", emissiveIntensity: 2.0 },
  },
  {
    id: "neon-pink",
    name: "Neon Pink",
    category: "emissive",
    tags: ["emissive", "neon", "pink", "glow"],
    params: { color: "#280a20", roughness: 0.2, metalness: 0, emissive: "#ff00aa", emissiveIntensity: 2.0 },
  },
  {
    id: "neon-green",
    name: "Neon Green",
    category: "emissive",
    tags: ["emissive", "neon", "green", "glow"],
    params: { color: "#0a2810", roughness: 0.2, metalness: 0, emissive: "#00ff66", emissiveIntensity: 2.0 },
  },
  {
    id: "lava",
    name: "Lava",
    category: "emissive",
    tags: ["emissive", "lava", "hot", "glow"],
    params: { color: "#1a0500", roughness: 0.7, metalness: 0.1, emissive: "#ff4500", emissiveIntensity: 1.5 },
    texture: { type: "noise", scale: 6, intensity: 0.2, channel: "emissive" },
  },
  {
    id: "hologram",
    name: "Hologram",
    category: "emissive",
    tags: ["emissive", "hologram", "sci-fi", "futuristic"],
    params: { color: "#0a0a14", roughness: 0.1, metalness: 0.3, emissive: "#4af0f0", emissiveIntensity: 1.2, opacity: 0.55, transparent: true },
  },

  // ── SPECIAL ──────────────────────────────────────────────────────────
  {
    id: "wireframe",
    name: "Wireframe",
    category: "special",
    tags: ["special", "wireframe", "debug"],
    params: { color: "#00ff00", roughness: 0.5, metalness: 0, wireframe: true },
  },
  {
    id: "toon",
    name: "Toon / Flat",
    category: "special",
    tags: ["special", "toon", "flat", "cartoon"],
    params: { color: "#ff6b6b", roughness: 1.0, metalness: 0, flatShading: true },
  },
  {
    id: "mirror",
    name: "Mirror",
    category: "special",
    tags: ["special", "mirror", "reflective"],
    params: { color: "#f5f5f5", roughness: 0.0, metalness: 1.0 },
  },
  {
    id: "invisible",
    name: "Invisible (debug)",
    category: "special",
    tags: ["special", "invisible", "debug"],
    params: { color: "#000000", roughness: 0, metalness: 0, opacity: 0.05, transparent: true },
  },
  {
    id: "checker-uv",
    name: "UV Checker",
    category: "special",
    tags: ["special", "uv", "checker", "debug"],
    params: { color: "#ffffff", roughness: 0.5, metalness: 0 },
    texture: { type: "checkerboard", scale: 8, intensity: 1.0, channel: "color", colorA: "#ffffff", colorB: "#444444" },
  },
];

/* ═══════════════════════════════════════════════════════════════════════════
   LIBRARY API
   ═══════════════════════════════════════════════════════════════════════ */

/** Get all presets. */
export function getAllPresets() {
  return MATERIAL_PRESETS;
}

/** Get presets for a category. */
export function getPresetsByCategory(categoryId) {
  return MATERIAL_PRESETS.filter((p) => p.category === categoryId);
}

/** Find a preset by id. */
export function getPreset(id) {
  return MATERIAL_PRESETS.find((p) => p.id === id) || null;
}

/** Search presets by query (name / tags). */
export function searchPresets(query) {
  if (!query || !query.trim()) return MATERIAL_PRESETS;
  const q = query.toLowerCase().trim();
  return MATERIAL_PRESETS.filter(
    (p) =>
      p.name.toLowerCase().includes(q) ||
      p.category.includes(q) ||
      p.tags.some((t) => t.includes(q)),
  );
}

/**
 * Build a THREE.MeshStandardMaterial from a preset.
 * @param {string|object} presetOrId
 * @returns {THREE.MeshStandardMaterial}
 */
export function buildMaterial(presetOrId) {
  const preset = typeof presetOrId === "string" ? getPreset(presetOrId) : presetOrId;
  if (!preset) throw new Error(`Unknown material preset: ${presetOrId}`);

  const p = { ...preset.params };
  const matOpts = {};

  // Map color fields
  if (p.color) { matOpts.color = new THREE.Color(p.color); delete p.color; }
  if (p.emissive) { matOpts.emissive = new THREE.Color(p.emissive); delete p.emissive; }

  // Copy scalar params
  for (const [k, v] of Object.entries(p)) {
    matOpts[k] = v;
  }

  const mat = new THREE.MeshStandardMaterial(matOpts);
  mat.name = preset.name || preset.id;
  mat.userData.__preset = preset.id;
  return mat;
}

/**
 * Apply a preset to a mesh, returning rollback data for undo.
 * @param {THREE.Mesh} mesh
 * @param {string|object} presetOrId
 * @returns {{ mesh: THREE.Mesh, previousMaterial: THREE.Material, newMaterial: THREE.Material }}
 */
export function applyPreset(mesh, presetOrId) {
  if (!mesh?.isMesh) throw new Error("applyPreset requires a Mesh");

  const previousMaterial = mesh.material;
  const newMaterial = buildMaterial(presetOrId);
  mesh.material = newMaterial;
  mesh.material.needsUpdate = true;

  return { mesh, previousMaterial, newMaterial };
}

/**
 * Rollback a preset application using the data from applyPreset.
 * @param {{ mesh: THREE.Mesh, previousMaterial: THREE.Material }} rollback
 */
export function rollbackPreset(rollback) {
  if (!rollback?.mesh || !rollback.previousMaterial) return;
  rollback.mesh.material = rollback.previousMaterial;
  rollback.mesh.material.needsUpdate = true;
}

/**
 * Extract the current material parameters from a mesh as a preset-compatible object.
 * Useful for saving user custom presets.
 * @param {THREE.Mesh} mesh
 * @returns {object}
 */
export function extractMaterialParams(mesh) {
  if (!mesh?.isMesh || !mesh.material) return null;
  const m = mesh.material;
  const params = {};

  if (m.color) params.color = "#" + m.color.getHexString();
  if (m.roughness != null) params.roughness = m.roughness;
  if (m.metalness != null) params.metalness = m.metalness;
  if (m.emissive && m.emissive.getHex() !== 0) params.emissive = "#" + m.emissive.getHexString();
  if (m.emissiveIntensity != null && m.emissiveIntensity !== 1) params.emissiveIntensity = m.emissiveIntensity;
  if (m.opacity != null && m.opacity < 1) params.opacity = m.opacity;
  if (m.transparent) params.transparent = true;
  if (m.wireframe) params.wireframe = true;
  if (m.flatShading) params.flatShading = true;
  if (m.side === THREE.DoubleSide) params.side = "double";

  return params;
}

/**
 * Create a custom preset from a mesh's current material.
 * @param {THREE.Mesh} mesh
 * @param {string} name
 * @param {string} category
 * @returns {object} preset definition
 */
export function createCustomPreset(mesh, name, category = "special") {
  const params = extractMaterialParams(mesh);
  if (!params) throw new Error("Cannot extract material params");
  const id = "custom-" + Date.now().toString(36);
  return {
    id,
    name: name || "Custom Material",
    category,
    tags: ["custom", category],
    params,
    custom: true,
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
   PREVIEW — tiny sphere preview render for UI thumbnails
   ═══════════════════════════════════════════════════════════════════════ */

let _previewRenderer = null;
let _previewScene = null;
let _previewCamera = null;
let _previewSphere = null;

function ensurePreviewSetup() {
  if (_previewRenderer) return;

  _previewRenderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  _previewRenderer.setSize(96, 96);
  _previewRenderer.setPixelRatio(1);
  _previewRenderer.outputColorSpace = THREE.SRGBColorSpace;

  _previewScene = new THREE.Scene();

  _previewCamera = new THREE.PerspectiveCamera(35, 1, 0.1, 10);
  _previewCamera.position.set(0, 0, 3);

  const geo = new THREE.SphereGeometry(0.85, 48, 48);
  _previewSphere = new THREE.Mesh(geo, new THREE.MeshStandardMaterial());
  _previewScene.add(_previewSphere);

  // Lights
  const key = new THREE.DirectionalLight("#fff5e6", 1.2);
  key.position.set(2, 3, 3);
  _previewScene.add(key);

  const fill = new THREE.DirectionalLight("#e0e8ff", 0.4);
  fill.position.set(-2, 1, 2);
  _previewScene.add(fill);

  const ambient = new THREE.AmbientLight("#303040", 0.3);
  _previewScene.add(ambient);
}

/**
 * Render a preset material onto a preview sphere and return a data URL.
 * @param {string|object} presetOrId
 * @returns {string} data:image/png base64
 */
export function renderPreview(presetOrId) {
  ensurePreviewSetup();
  const mat = buildMaterial(presetOrId);
  _previewSphere.material.dispose();
  _previewSphere.material = mat;
  _previewRenderer.render(_previewScene, _previewCamera);
  return _previewRenderer.domElement.toDataURL("image/png");
}

/** Clean up the offscreen preview renderer. */
export function disposePreview() {
  if (_previewRenderer) {
    _previewRenderer.dispose();
    _previewRenderer = null;
    _previewScene = null;
    _previewCamera = null;
    _previewSphere = null;
  }
}

export default {
  MATERIAL_CATEGORIES,
  MATERIAL_PRESETS,
  getAllPresets,
  getPresetsByCategory,
  getPreset,
  searchPresets,
  buildMaterial,
  applyPreset,
  rollbackPreset,
  extractMaterialParams,
  createCustomPreset,
  renderPreview,
  disposePreview,
};
