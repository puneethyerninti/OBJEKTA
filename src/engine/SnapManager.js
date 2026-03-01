// src/engine/SnapManager.js
// ---------------------------------------------------------------------------
// Phase 7 — Snap Manager engine.
// Provides grid snapping, angle snapping, and surface snapping utilities
// for the 3D editor. Works with TransformControls integration.
// ---------------------------------------------------------------------------

import * as THREE from "three";

/* ═══════════════════════════════════════════════════════════════════════════
   SNAP PRESETS
   ═══════════════════════════════════════════════════════════════════════ */

export const SNAP_PRESETS = [
  { id: "none",    label: "No Snap",    grid: 0,    angle: 0 },
  { id: "fine",    label: "Fine",       grid: 0.1,  angle: 5 },
  { id: "small",   label: "Small",      grid: 0.25, angle: 15 },
  { id: "medium",  label: "Medium",     grid: 0.5,  angle: 15 },
  { id: "large",   label: "Large",      grid: 1.0,  angle: 45 },
  { id: "xlarge",  label: "Extra Large", grid: 2.0, angle: 90 },
];

/* ═══════════════════════════════════════════════════════════════════════════
   SNAP STATE
   ═══════════════════════════════════════════════════════════════════════ */

const state = {
  enabled: false,
  gridSize: 0.5,
  angleStep: 15,       // degrees
  scaleStep: 0.1,
  surfaceSnap: false,
  axisConstraint: null, // null | "x" | "y" | "z"
};

/* ═══════════════════════════════════════════════════════════════════════════
   CONFIGURATION
   ═══════════════════════════════════════════════════════════════════════ */

/**
 * Enable or disable snapping globally.
 * @param {boolean} enabled
 */
export function setEnabled(enabled) {
  state.enabled = !!enabled;
}

/** @returns {boolean} */
export function isEnabled() {
  return state.enabled;
}

/**
 * Set grid snap size.
 * @param {number} size
 */
export function setGridSize(size) {
  state.gridSize = Math.max(0, Number(size) || 0);
}

/** @returns {number} */
export function getGridSize() {
  return state.gridSize;
}

/**
 * Set rotation angle step in degrees.
 * @param {number} degrees
 */
export function setAngleStep(degrees) {
  state.angleStep = Math.max(0, Number(degrees) || 0);
}

/** @returns {number} */
export function getAngleStep() {
  return state.angleStep;
}

/**
 * Set scale snap step.
 * @param {number} step
 */
export function setScaleStep(step) {
  state.scaleStep = Math.max(0, Number(step) || 0);
}

/** @returns {number} */
export function getScaleStep() {
  return state.scaleStep;
}

/**
 * Enable/disable surface snapping.
 * @param {boolean} enabled
 */
export function setSurfaceSnap(enabled) {
  state.surfaceSnap = !!enabled;
}

/** @returns {boolean} */
export function isSurfaceSnap() {
  return state.surfaceSnap;
}

/**
 * Constrain snapping to a single axis.
 * @param {null|"x"|"y"|"z"} axis
 */
export function setAxisConstraint(axis) {
  state.axisConstraint = axis === "x" || axis === "y" || axis === "z" ? axis : null;
}

/** @returns {null|"x"|"y"|"z"} */
export function getAxisConstraint() {
  return state.axisConstraint;
}

/**
 * Apply a snap preset by id.
 * @param {string} presetId
 */
export function applyPreset(presetId) {
  const preset = SNAP_PRESETS.find((p) => p.id === presetId);
  if (!preset) return;
  state.enabled = preset.grid > 0;
  state.gridSize = preset.grid;
  state.angleStep = preset.angle;
}

/**
 * Get the full current state (read-only copy).
 * @returns {{ enabled: boolean, gridSize: number, angleStep: number, scaleStep: number, surfaceSnap: boolean, axisConstraint: string|null }}
 */
export function getState() {
  return { ...state };
}

/* ═══════════════════════════════════════════════════════════════════════════
   SNAP FUNCTIONS
   ═══════════════════════════════════════════════════════════════════════ */

/**
 * Snap a scalar value to the nearest grid increment.
 * @param {number} value
 * @param {number} [step] — defaults to state.gridSize
 * @returns {number}
 */
export function snapScalar(value, step) {
  const s = step ?? state.gridSize;
  if (!state.enabled || s <= 0) return value;
  return Math.round(value / s) * s;
}

/**
 * Snap a Vector3 to the grid.
 * Respects axis constraint if set.
 * @param {THREE.Vector3} vec — mutated in place
 * @param {number} [step]
 * @returns {THREE.Vector3}
 */
export function snapPosition(vec, step) {
  if (!state.enabled || !vec) return vec;
  const s = step ?? state.gridSize;
  if (s <= 0) return vec;

  const axis = state.axisConstraint;
  if (!axis || axis === "x") vec.x = Math.round(vec.x / s) * s;
  if (!axis || axis === "y") vec.y = Math.round(vec.y / s) * s;
  if (!axis || axis === "z") vec.z = Math.round(vec.z / s) * s;

  return vec;
}

/**
 * Snap an angle (in radians) to the nearest step.
 * @param {number} radians
 * @param {number} [stepDegrees] — defaults to state.angleStep
 * @returns {number}
 */
export function snapAngle(radians, stepDegrees) {
  const deg = stepDegrees ?? state.angleStep;
  if (!state.enabled || deg <= 0) return radians;
  const stepRad = (deg * Math.PI) / 180;
  return Math.round(radians / stepRad) * stepRad;
}

/**
 * Snap an Euler rotation.
 * @param {THREE.Euler} euler — mutated in place
 * @param {number} [stepDegrees]
 * @returns {THREE.Euler}
 */
export function snapRotation(euler, stepDegrees) {
  if (!state.enabled || !euler) return euler;

  const axis = state.axisConstraint;
  if (!axis || axis === "x") euler.x = snapAngle(euler.x, stepDegrees);
  if (!axis || axis === "y") euler.y = snapAngle(euler.y, stepDegrees);
  if (!axis || axis === "z") euler.z = snapAngle(euler.z, stepDegrees);

  return euler;
}

/**
 * Snap a scale vector.
 * @param {THREE.Vector3} scale — mutated in place
 * @param {number} [step] — defaults to state.scaleStep
 * @returns {THREE.Vector3}
 */
export function snapScale(scale, step) {
  if (!state.enabled || !scale) return scale;
  const s = step ?? state.scaleStep;
  if (s <= 0) return scale;

  const axis = state.axisConstraint;
  if (!axis || axis === "x") scale.x = Math.max(s, Math.round(scale.x / s) * s);
  if (!axis || axis === "y") scale.y = Math.max(s, Math.round(scale.y / s) * s);
  if (!axis || axis === "z") scale.z = Math.max(s, Math.round(scale.z / s) * s);

  return scale;
}

/* ═══════════════════════════════════════════════════════════════════════════
   SURFACE SNAP — project position onto a surface via raycasting
   ═══════════════════════════════════════════════════════════════════════ */

const _raycaster = new THREE.Raycaster();
const _downDir = new THREE.Vector3(0, -1, 0);

/**
 * Snap a position to the nearest surface below it.
 * @param {THREE.Vector3} position
 * @param {THREE.Object3D[]} surfaces — array of meshes to test against
 * @param {THREE.Vector3} [direction] — ray direction (default: downward)
 * @returns {{ hit: boolean, point: THREE.Vector3, normal: THREE.Vector3 }}
 */
export function snapToSurface(position, surfaces, direction) {
  if (!position || !Array.isArray(surfaces) || surfaces.length === 0) {
    return { hit: false, point: position?.clone() || new THREE.Vector3(), normal: new THREE.Vector3(0, 1, 0) };
  }

  const dir = direction || _downDir;
  const origin = position.clone().add(new THREE.Vector3(0, 10, 0)); // lift up to cast down
  _raycaster.set(origin, dir.clone().normalize());

  const intersections = _raycaster.intersectObjects(surfaces, true);
  if (intersections.length > 0) {
    const hit = intersections[0];
    return {
      hit: true,
      point: hit.point.clone(),
      normal: hit.face?.normal?.clone() || new THREE.Vector3(0, 1, 0),
    };
  }

  return { hit: false, point: position.clone(), normal: new THREE.Vector3(0, 1, 0) };
}

/* ═══════════════════════════════════════════════════════════════════════════
   GRID VISUALIZATION HELPERS
   ═══════════════════════════════════════════════════════════════════════ */

/**
 * Create a THREE.GridHelper sized to the current snap grid.
 * @param {number} [size] — total grid size
 * @param {string} [color1]
 * @param {string} [color2]
 * @returns {THREE.GridHelper}
 */
export function createSnapGrid(size = 20, color1 = "#444444", color2 = "#222222") {
  const divisions = state.gridSize > 0 ? Math.round(size / state.gridSize) : 20;
  const grid = new THREE.GridHelper(size, divisions, color1, color2);
  grid.name = "__snapGrid";
  grid.userData.__helper = true;
  return grid;
}

/* ═══════════════════════════════════════════════════════════════════════════
   TRANSFORM CONTROLS INTEGRATION
   ═══════════════════════════════════════════════════════════════════════ */

/**
 * Apply current snap settings to a TransformControls instance.
 * @param {import("three/examples/jsm/controls/TransformControls").TransformControls} tc
 */
export function applyToTransformControls(tc) {
  if (!tc) return;
  try {
    if (state.enabled) {
      tc.setTranslationSnap(state.gridSize > 0 ? state.gridSize : null);
      tc.setRotationSnap(state.angleStep > 0 ? (state.angleStep * Math.PI) / 180 : null);
      tc.setScaleSnap(state.scaleStep > 0 ? state.scaleStep : null);
    } else {
      tc.setTranslationSnap(null);
      tc.setRotationSnap(null);
      tc.setScaleSnap(null);
    }
  } catch (e) {
    // TransformControls may not support setScaleSnap in older versions
  }
}

export default {
  SNAP_PRESETS,
  setEnabled,
  isEnabled,
  setGridSize,
  getGridSize,
  setAngleStep,
  getAngleStep,
  setScaleStep,
  getScaleStep,
  setSurfaceSnap,
  isSurfaceSnap,
  setAxisConstraint,
  getAxisConstraint,
  applyPreset,
  getState,
  snapScalar,
  snapPosition,
  snapAngle,
  snapRotation,
  snapScale,
  snapToSurface,
  createSnapGrid,
  applyToTransformControls,
};
