// src/engine/PostFXManager.js
// ---------------------------------------------------------------------------
// Phase 8 — Post-Processing Effects Manager.
// Manages a set of configurable post-processing effects:
// SSAO, Depth of Field, Outline/Selection, Chromatic Aberration,
// Tone Mapping, Color Grading presets, Film Grain, and Vignette.
// Pure data/config layer — the actual Three.js passes are applied by
// the UI or a composer setup function.
// ---------------------------------------------------------------------------

import * as THREE from "three";

const AGX_TONEMAPPING_VALUE =
  Reflect.get(THREE, "AgX" + "ToneMapping") ?? THREE.ACESFilmicToneMapping;

/* ═══════════════════════════════════════════════════════════════════════════
   EFFECT DEFINITIONS
   ═══════════════════════════════════════════════════════════════════════ */

export const EFFECT_TYPES = [
  "bloom",
  "ssao",
  "dof",
  "outline",
  "chromaticAberration",
  "toneMapping",
  "colorGrading",
  "filmGrain",
  "vignette",
];

/* ═══════════════════════════════════════════════════════════════════════════
   DEFAULT CONFIGS
   ═══════════════════════════════════════════════════════════════════════ */

const DEFAULT_BLOOM = {
  enabled: true,
  strength: 0.5,
  radius: 0.4,
  threshold: 0.8,
};

const DEFAULT_SSAO = {
  enabled: false,
  radius: 0.5,
  intensity: 1.0,
  bias: 0.025,
  samples: 16,
  minDistance: 0.005,
  maxDistance: 0.1,
};

const DEFAULT_DOF = {
  enabled: false,
  focusDistance: 5.0,
  focalLength: 50,
  bokehScale: 2.0,
  aperture: 0.025,
};

const DEFAULT_OUTLINE = {
  enabled: false,
  color: "#c084fc",
  thickness: 2.0,
  strength: 3.0,
  pulse: false,
  pulseSpeed: 2.0,
};

const DEFAULT_CHROMATIC = {
  enabled: false,
  offset: 0.002,
  radial: true,
};

const DEFAULT_TONEMAPPING = {
  enabled: true,
  mode: "aces",       // "none" | "linear" | "reinhard" | "cineon" | "aces" | "agx"
  exposure: 1.0,
};

const DEFAULT_COLORGRADING = {
  enabled: false,
  preset: "none",     // "none" | "warm" | "cool" | "vintage" | "noir" | "sunset" | "cyberpunk"
  brightness: 0,
  contrast: 0,
  saturation: 0,
  hueShift: 0,
};

const DEFAULT_FILMGRAIN = {
  enabled: false,
  intensity: 0.15,
  animated: true,
};

const DEFAULT_VIGNETTE = {
  enabled: false,
  darkness: 0.5,
  offset: 0.5,
};

/* ═══════════════════════════════════════════════════════════════════════════
   COLOR GRADING PRESETS
   ═══════════════════════════════════════════════════════════════════════ */

export const COLOR_GRADING_PRESETS = [
  { id: "none",      label: "None",      brightness: 0,    contrast: 0,    saturation: 0,   hueShift: 0 },
  { id: "warm",      label: "Warm",      brightness: 0.05, contrast: 0.1,  saturation: 0.15, hueShift: 10 },
  { id: "cool",      label: "Cool",      brightness: 0,    contrast: 0.05, saturation: -0.1, hueShift: -15 },
  { id: "vintage",   label: "Vintage",   brightness: 0.1,  contrast: -0.05, saturation: -0.3, hueShift: 15 },
  { id: "noir",      label: "Film Noir", brightness: -0.05, contrast: 0.2, saturation: -1.0, hueShift: 0 },
  { id: "sunset",    label: "Sunset",    brightness: 0.08, contrast: 0.15, saturation: 0.2,  hueShift: 20 },
  { id: "cyberpunk", label: "Cyberpunk", brightness: 0,    contrast: 0.25, saturation: 0.3,  hueShift: -30 },
  { id: "forest",    label: "Forest",    brightness: 0.02, contrast: 0.1,  saturation: 0.1,  hueShift: -10 },
];

/* ═══════════════════════════════════════════════════════════════════════════
   TONE MAPPING MODES
   ═══════════════════════════════════════════════════════════════════════ */

export const TONEMAPPING_MODES = [
  { id: "none",     label: "No Tone Mapping", value: THREE.NoToneMapping },
  { id: "linear",   label: "Linear",          value: THREE.LinearToneMapping },
  { id: "reinhard", label: "Reinhard",         value: THREE.ReinhardToneMapping },
  { id: "cineon",   label: "Cineon",           value: THREE.CineonToneMapping },
  { id: "aces",     label: "ACES Filmic",      value: THREE.ACESFilmicToneMapping },
  { id: "agx",      label: "AgX",              value: AGX_TONEMAPPING_VALUE },
];

/* ═══════════════════════════════════════════════════════════════════════════
   POST-FX PRESETS — bundles of effect settings
   ═══════════════════════════════════════════════════════════════════════ */

export const POSTFX_PRESETS = [
  {
    id: "default",
    label: "Default",
    config: {
      bloom: { ...DEFAULT_BLOOM },
      toneMapping: { ...DEFAULT_TONEMAPPING },
    },
  },
  {
    id: "cinematic",
    label: "Cinematic",
    config: {
      bloom: { enabled: true, strength: 0.3, radius: 0.5, threshold: 0.7 },
      dof: { enabled: true, focusDistance: 8, focalLength: 35, bokehScale: 3, aperture: 0.02 },
      vignette: { enabled: true, darkness: 0.6, offset: 0.4 },
      filmGrain: { enabled: true, intensity: 0.1, animated: true },
      toneMapping: { enabled: true, mode: "aces", exposure: 1.1 },
      colorGrading: { enabled: true, preset: "warm", brightness: 0.05, contrast: 0.1, saturation: 0.1, hueShift: 5 },
    },
  },
  {
    id: "stylized",
    label: "Stylized",
    config: {
      bloom: { enabled: true, strength: 0.8, radius: 0.6, threshold: 0.5 },
      outline: { enabled: true, color: "#ffffff", thickness: 1.5, strength: 3, pulse: false },
      colorGrading: { enabled: true, preset: "cyberpunk", brightness: 0, contrast: 0.2, saturation: 0.3, hueShift: -20 },
      toneMapping: { enabled: true, mode: "aces", exposure: 1.2 },
    },
  },
  {
    id: "clean",
    label: "Clean Studio",
    config: {
      bloom: { enabled: false },
      ssao: { enabled: true, radius: 0.4, intensity: 0.8, samples: 16 },
      toneMapping: { enabled: true, mode: "aces", exposure: 1.0 },
    },
  },
  {
    id: "horror",
    label: "Horror",
    config: {
      bloom: { enabled: true, strength: 0.2, radius: 0.3, threshold: 0.9 },
      ssao: { enabled: true, radius: 0.8, intensity: 1.5, samples: 24 },
      vignette: { enabled: true, darkness: 0.8, offset: 0.3 },
      filmGrain: { enabled: true, intensity: 0.25, animated: true },
      colorGrading: { enabled: true, preset: "noir", brightness: -0.1, contrast: 0.3, saturation: -0.8, hueShift: 0 },
      toneMapping: { enabled: true, mode: "cineon", exposure: 0.8 },
    },
  },
  {
    id: "arch-viz",
    label: "Arch Viz",
    config: {
      bloom: { enabled: true, strength: 0.15, radius: 0.3, threshold: 0.85 },
      ssao: { enabled: true, radius: 0.3, intensity: 1.0, samples: 32 },
      dof: { enabled: true, focusDistance: 12, focalLength: 50, bokehScale: 2, aperture: 0.015 },
      toneMapping: { enabled: true, mode: "aces", exposure: 1.05 },
      vignette: { enabled: true, darkness: 0.3, offset: 0.6 },
    },
  },
];

/* ═══════════════════════════════════════════════════════════════════════════
   STATE
   ═══════════════════════════════════════════════════════════════════════ */

const _config = {
  bloom:               { ...DEFAULT_BLOOM },
  ssao:                { ...DEFAULT_SSAO },
  dof:                 { ...DEFAULT_DOF },
  outline:             { ...DEFAULT_OUTLINE },
  chromaticAberration: { ...DEFAULT_CHROMATIC },
  toneMapping:         { ...DEFAULT_TONEMAPPING },
  colorGrading:        { ...DEFAULT_COLORGRADING },
  filmGrain:           { ...DEFAULT_FILMGRAIN },
  vignette:            { ...DEFAULT_VIGNETTE },
};

let _listeners = new Set();

function _notify() {
  for (const fn of _listeners) {
    try { fn({ ..._config }); } catch (e) { /* ignore */ }
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   API
   ═══════════════════════════════════════════════════════════════════════ */

/**
 * Subscribe to config changes.
 * @param {(config: object) => void} listener
 * @returns {() => void} unsubscribe
 */
export function subscribe(listener) {
  _listeners.add(listener);
  return () => _listeners.delete(listener);
}

/**
 * Get the full config (read-only snapshot).
 * @returns {object}
 */
export function getConfig() {
  return JSON.parse(JSON.stringify(_config));
}

/**
 * Get config for one effect.
 * @param {string} effect
 * @returns {object|null}
 */
export function getEffectConfig(effect) {
  if (!_config[effect]) return null;
  return { ..._config[effect] };
}

/**
 * Update one or more properties of an effect.
 * @param {string} effect
 * @param {object} updates
 */
export function updateEffect(effect, updates) {
  if (!_config[effect]) return;
  Object.assign(_config[effect], updates);
  _notify();
}

/**
 * Enable or disable an effect.
 * @param {string} effect
 * @param {boolean} enabled
 */
export function setEffectEnabled(effect, enabled) {
  if (!_config[effect]) return;
  _config[effect].enabled = !!enabled;
  _notify();
}

/**
 * Check if an effect is enabled.
 * @param {string} effect
 * @returns {boolean}
 */
export function isEffectEnabled(effect) {
  return !!_config[effect]?.enabled;
}

/**
 * Reset an effect to defaults.
 * @param {string} effect
 */
export function resetEffect(effect) {
  const defaults = {
    bloom: DEFAULT_BLOOM,
    ssao: DEFAULT_SSAO,
    dof: DEFAULT_DOF,
    outline: DEFAULT_OUTLINE,
    chromaticAberration: DEFAULT_CHROMATIC,
    toneMapping: DEFAULT_TONEMAPPING,
    colorGrading: DEFAULT_COLORGRADING,
    filmGrain: DEFAULT_FILMGRAIN,
    vignette: DEFAULT_VIGNETTE,
  };
  if (defaults[effect]) {
    _config[effect] = { ...defaults[effect] };
    _notify();
  }
}

/**
 * Reset all effects to defaults.
 */
export function resetAll() {
  resetEffect("bloom");
  resetEffect("ssao");
  resetEffect("dof");
  resetEffect("outline");
  resetEffect("chromaticAberration");
  resetEffect("toneMapping");
  resetEffect("colorGrading");
  resetEffect("filmGrain");
  resetEffect("vignette");
}

/**
 * Apply a post-FX preset (overwrites matching effects, leaves others).
 * @param {string} presetId
 */
export function applyPreset(presetId) {
  const p = POSTFX_PRESETS.find((pr) => pr.id === presetId);
  if (!p) return;

  // First disable all effects
  for (const key of EFFECT_TYPES) {
    if (_config[key]) _config[key].enabled = false;
  }

  // Then apply preset config
  for (const [key, val] of Object.entries(p.config)) {
    if (_config[key]) {
      Object.assign(_config[key], val);
    }
  }
  _notify();
}

/**
 * Apply a color grading preset by id.
 * @param {string} gradingPresetId
 */
export function applyColorGrading(gradingPresetId) {
  const gp = COLOR_GRADING_PRESETS.find((p) => p.id === gradingPresetId);
  if (!gp) return;
  _config.colorGrading.preset = gp.id;
  _config.colorGrading.brightness = gp.brightness;
  _config.colorGrading.contrast = gp.contrast;
  _config.colorGrading.saturation = gp.saturation;
  _config.colorGrading.hueShift = gp.hueShift;
  if (gp.id !== "none") _config.colorGrading.enabled = true;
  _notify();
}

/**
 * Apply tone mapping settings to a WebGLRenderer.
 * @param {THREE.WebGLRenderer} renderer
 */
export function applyToneMapping(renderer) {
  if (!renderer) return;
  const tm = _config.toneMapping;
  if (!tm.enabled) {
    renderer.toneMapping = THREE.NoToneMapping;
    return;
  }
  const mode = TONEMAPPING_MODES.find((m) => m.id === tm.mode);
  renderer.toneMapping = mode?.value ?? THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = tm.exposure ?? 1.0;
}

/**
 * Get the THREE tone mapping constant for current mode.
 * @returns {number}
 */
export function getToneMappingValue() {
  const tm = _config.toneMapping;
  if (!tm.enabled) return THREE.NoToneMapping;
  const mode = TONEMAPPING_MODES.find((m) => m.id === tm.mode);
  return mode?.value ?? THREE.ACESFilmicToneMapping;
}

export default {
  EFFECT_TYPES,
  COLOR_GRADING_PRESETS,
  TONEMAPPING_MODES,
  POSTFX_PRESETS,
  subscribe,
  getConfig,
  getEffectConfig,
  updateEffect,
  setEffectEnabled,
  isEffectEnabled,
  resetEffect,
  resetAll,
  applyPreset,
  applyColorGrading,
  applyToneMapping,
  getToneMappingValue,
};
