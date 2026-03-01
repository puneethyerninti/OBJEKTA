// src/engine/EnvironmentManager.js
// ---------------------------------------------------------------------------
// Phase 8 — Environment Manager.
// Manages environment presets, fog, background, ground plane, and lighting
// defaults.  Pure state/config layer — components read this config and apply
// it to the Three.js scene.
// ---------------------------------------------------------------------------

import * as THREE from "three";

/* ═══════════════════════════════════════════════════════════════════════════
   ENVIRONMENT PRESETS
   ═══════════════════════════════════════════════════════════════════════ */

export const ENV_PRESETS = [
  {
    id: "studio",
    label: "Studio",
    backgroundColor: "#1a1a2e",
    ambientColor: "#ffffff",
    ambientIntensity: 0.6,
    envMapIntensity: 1.0,
    envRotation: 0,
    fog: { enabled: false, type: "linear", color: "#1a1a2e", near: 10, far: 50, density: 0.02 },
    groundPlane: false,
    groundColor: "#333333",
  },
  {
    id: "sunset",
    label: "Sunset",
    backgroundColor: "#2d1b3d",
    ambientColor: "#ffa07a",
    ambientIntensity: 0.5,
    envMapIntensity: 1.2,
    envRotation: 45,
    fog: { enabled: true, type: "exponential", color: "#3d2244", near: 15, far: 80, density: 0.015 },
    groundPlane: true,
    groundColor: "#3d2244",
  },
  {
    id: "warehouse",
    label: "Warehouse",
    backgroundColor: "#0f0f0f",
    ambientColor: "#e0d8c8",
    ambientIntensity: 0.3,
    envMapIntensity: 0.8,
    envRotation: 0,
    fog: { enabled: false, type: "linear", color: "#0f0f0f", near: 20, far: 100, density: 0.01 },
    groundPlane: true,
    groundColor: "#2a2a2a",
  },
  {
    id: "forest",
    label: "Forest",
    backgroundColor: "#0b3d0b",
    ambientColor: "#90ee90",
    ambientIntensity: 0.4,
    envMapIntensity: 0.9,
    envRotation: 120,
    fog: { enabled: true, type: "exponential", color: "#1a3d1a", near: 8, far: 40, density: 0.025 },
    groundPlane: true,
    groundColor: "#2d4a2d",
  },
  {
    id: "night",
    label: "Night",
    backgroundColor: "#000011",
    ambientColor: "#4444aa",
    ambientIntensity: 0.15,
    envMapIntensity: 0.3,
    envRotation: 0,
    fog: { enabled: true, type: "exponential", color: "#000011", near: 5, far: 30, density: 0.03 },
    groundPlane: false,
    groundColor: "#111122",
  },
  {
    id: "city",
    label: "City",
    backgroundColor: "#1a1a2e",
    ambientColor: "#c8c0b0",
    ambientIntensity: 0.5,
    envMapIntensity: 1.0,
    envRotation: 90,
    fog: { enabled: true, type: "linear", color: "#2a2a3e", near: 20, far: 120, density: 0.008 },
    groundPlane: true,
    groundColor: "#333340",
  },
  {
    id: "arctic",
    label: "Arctic",
    backgroundColor: "#c8d8e8",
    ambientColor: "#ddeeff",
    ambientIntensity: 0.7,
    envMapIntensity: 1.1,
    envRotation: 0,
    fog: { enabled: true, type: "exponential", color: "#c8d8e8", near: 10, far: 60, density: 0.02 },
    groundPlane: true,
    groundColor: "#e0e8f0",
  },
  {
    id: "custom",
    label: "Custom",
    backgroundColor: "#111111",
    ambientColor: "#ffffff",
    ambientIntensity: 0.5,
    envMapIntensity: 1.0,
    envRotation: 0,
    fog: { enabled: false, type: "linear", color: "#111111", near: 10, far: 50, density: 0.02 },
    groundPlane: false,
    groundColor: "#333333",
  },
];

/* ═══════════════════════════════════════════════════════════════════════════
   FOG TYPES
   ═══════════════════════════════════════════════════════════════════════ */

export const FOG_TYPES = [
  { id: "linear",      label: "Linear" },
  { id: "exponential",  label: "Exponential" },
];

/* ═══════════════════════════════════════════════════════════════════════════
   INTERNAL STATE
   ═══════════════════════════════════════════════════════════════════════ */

const _defaults = {
  preset: "studio",
  backgroundColor: "#1a1a2e",
  ambientColor: "#ffffff",
  ambientIntensity: 0.6,
  envMapIntensity: 1.0,
  envRotation: 0,
  fog: {
    enabled: false,
    type: "linear",
    color: "#1a1a2e",
    near: 10,
    far: 50,
    density: 0.02,
  },
  groundPlane: false,
  groundColor: "#333333",
};

const _state = { ..._defaults, fog: { ..._defaults.fog } };

let _listeners = new Set();

function _notify() {
  const snapshot = getState();
  for (const fn of _listeners) {
    try { fn(snapshot); } catch (e) { /* ignore */ }
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   SUBSCRIBE
   ═══════════════════════════════════════════════════════════════════════ */

export function subscribe(listener) {
  _listeners.add(listener);
  return () => _listeners.delete(listener);
}

/* ═══════════════════════════════════════════════════════════════════════════
   GETTERS
   ═══════════════════════════════════════════════════════════════════════ */

export function getState() {
  return {
    ..._state,
    fog: { ..._state.fog },
  };
}

export function getPresetId() {
  return _state.preset;
}

/* ═══════════════════════════════════════════════════════════════════════════
   SETTERS
   ═══════════════════════════════════════════════════════════════════════ */

export function applyPreset(presetId) {
  const p = ENV_PRESETS.find((pr) => pr.id === presetId);
  if (!p) return;
  _state.preset = p.id;
  _state.backgroundColor = p.backgroundColor;
  _state.ambientColor = p.ambientColor;
  _state.ambientIntensity = p.ambientIntensity;
  _state.envMapIntensity = p.envMapIntensity;
  _state.envRotation = p.envRotation;
  _state.fog = { ...p.fog };
  _state.groundPlane = p.groundPlane;
  _state.groundColor = p.groundColor;
  _notify();
}

export function setBackgroundColor(hex) {
  _state.backgroundColor = hex;
  _state.preset = "custom";
  _notify();
}

export function setAmbientColor(hex) {
  _state.ambientColor = hex;
  _state.preset = "custom";
  _notify();
}

export function setAmbientIntensity(val) {
  _state.ambientIntensity = Math.max(0, Math.min(2, val));
  _state.preset = "custom";
  _notify();
}

export function setEnvMapIntensity(val) {
  _state.envMapIntensity = Math.max(0, Math.min(3, val));
  _state.preset = "custom";
  _notify();
}

export function setEnvRotation(degrees) {
  _state.envRotation = ((degrees % 360) + 360) % 360;
  _state.preset = "custom";
  _notify();
}

/* ═══════════════════════════════════════════════════════════════════════════
   FOG
   ═══════════════════════════════════════════════════════════════════════ */

export function setFogEnabled(enabled) {
  _state.fog.enabled = !!enabled;
  _notify();
}

export function setFogType(type) {
  if (type === "linear" || type === "exponential") {
    _state.fog.type = type;
    _notify();
  }
}

export function setFogColor(hex) {
  _state.fog.color = hex;
  _notify();
}

export function setFogNear(val) {
  _state.fog.near = Math.max(0, val);
  _notify();
}

export function setFogFar(val) {
  _state.fog.far = Math.max(_state.fog.near + 1, val);
  _notify();
}

export function setFogDensity(val) {
  _state.fog.density = Math.max(0.001, Math.min(1, val));
  _notify();
}

export function updateFog(updates) {
  Object.assign(_state.fog, updates);
  _notify();
}

/* ═══════════════════════════════════════════════════════════════════════════
   GROUND PLANE
   ═══════════════════════════════════════════════════════════════════════ */

export function setGroundPlane(enabled) {
  _state.groundPlane = !!enabled;
  _notify();
}

export function setGroundColor(hex) {
  _state.groundColor = hex;
  _notify();
}

/* ═══════════════════════════════════════════════════════════════════════════
   SCENE APPLICATION — apply state to a THREE.Scene and camera
   ═══════════════════════════════════════════════════════════════════════ */

/**
 * Apply the current environment state to a Three.js scene.
 * @param {THREE.Scene} scene
 */
export function applyToScene(scene) {
  if (!scene) return;

  // Background color
  scene.background = new THREE.Color(_state.backgroundColor);

  // Fog
  if (_state.fog.enabled) {
    const fogColor = new THREE.Color(_state.fog.color);
    if (_state.fog.type === "exponential") {
      scene.fog = new THREE.FogExp2(fogColor, _state.fog.density);
    } else {
      scene.fog = new THREE.Fog(fogColor, _state.fog.near, _state.fog.far);
    }
  } else {
    scene.fog = null;
  }

  // Environment map intensity (applied per material later)
  scene.userData.__envMapIntensity = _state.envMapIntensity;
  scene.userData.__envRotation = _state.envRotation;
}

/**
 * Create a Fog instance from current config (for external use).
 * @returns {THREE.Fog|THREE.FogExp2|null}
 */
export function createFog() {
  if (!_state.fog.enabled) return null;
  const fogColor = new THREE.Color(_state.fog.color);
  if (_state.fog.type === "exponential") {
    return new THREE.FogExp2(fogColor, _state.fog.density);
  }
  return new THREE.Fog(fogColor, _state.fog.near, _state.fog.far);
}

/**
 * Create a ground plane mesh.
 * @param {number} size - Ground plane size (default 50).
 * @returns {THREE.Mesh}
 */
export function createGroundPlane(size = 50) {
  const geom = new THREE.PlaneGeometry(size, size);
  const mat = new THREE.ShadowMaterial({
    color: new THREE.Color(_state.groundColor),
    opacity: 0.4,
  });
  const mesh = new THREE.Mesh(geom, mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.receiveShadow = true;
  mesh.name = "__groundPlane";
  mesh.userData.__helper = true;
  return mesh;
}

/* ═══════════════════════════════════════════════════════════════════════════
   RESET
   ═══════════════════════════════════════════════════════════════════════ */

export function resetAll() {
  Object.assign(_state, { ..._defaults, fog: { ..._defaults.fog } });
  _notify();
}

/* ═══════════════════════════════════════════════════════════════════════════
   DEFAULT EXPORT
   ═══════════════════════════════════════════════════════════════════════ */

export default {
  ENV_PRESETS,
  FOG_TYPES,
  subscribe,
  getState,
  getPresetId,
  applyPreset,
  setBackgroundColor,
  setAmbientColor,
  setAmbientIntensity,
  setEnvMapIntensity,
  setEnvRotation,
  setFogEnabled,
  setFogType,
  setFogColor,
  setFogNear,
  setFogFar,
  setFogDensity,
  updateFog,
  setGroundPlane,
  setGroundColor,
  applyToScene,
  createFog,
  createGroundPlane,
  resetAll,
};
