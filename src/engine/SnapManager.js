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
  // Smart snap settings (vertex/edge/center snapping)
  vertexSnap: true,
  edgeSnap: true,
  centerSnap: true,
  snapThreshold: 20,   // pixels (screen space threshold)
  showIndicators: true,
  lastSnapTarget: null, // { type, position, distance, targetObj }
};

// Cache for vertex extraction to improve performance
const _vertexCache = new Map();
const _cacheVersion = { value: 0 };

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

/* ═══════════════════════════════════════════════════════════════════════════
   SMART SNAP CONFIGURATION (Vertex/Edge/Center)
   ═══════════════════════════════════════════════════════════════════════ */

/** Enable/disable vertex snapping */
export function setVertexSnap(enabled) {
  state.vertexSnap = !!enabled;
}
export function isVertexSnap() {
  return state.vertexSnap;
}

/** Enable/disable edge snapping */
export function setEdgeSnap(enabled) {
  state.edgeSnap = !!enabled;
}
export function isEdgeSnap() {
  return state.edgeSnap;
}

/** Enable/disable center snapping */
export function setCenterSnap(enabled) {
  state.centerSnap = !!enabled;
}
export function isCenterSnap() {
  return state.centerSnap;
}

/** Set snap threshold in screen pixels */
export function setSnapThreshold(pixels) {
  state.snapThreshold = Math.max(5, Math.min(100, Number(pixels) || 20));
}
export function getSnapThreshold() {
  return state.snapThreshold;
}

/** Toggle snap indicators display */
export function setShowIndicators(show) {
  state.showIndicators = !!show;
}
export function isShowIndicators() {
  return state.showIndicators;
}

/** Get last snap target for visualization */
export function getLastSnapTarget() {
  return state.lastSnapTarget;
}

/** Clear vertex cache (call when scene changes) */
export function clearCache() {
  _vertexCache.clear();
  _cacheVersion.value++;
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
   SMART SNAP — Vertex/Edge/Center Snapping
   ═══════════════════════════════════════════════════════════════════════ */

const _tempVec = new THREE.Vector3();
const _tempVec2 = new THREE.Vector3();

/**
 * Extract vertices from a mesh (with caching for performance).
 * @param {THREE.Mesh} mesh
 * @returns {THREE.Vector3[]}
 */
function extractVertices(mesh) {
  if (!mesh || !mesh.geometry) return [];
  
  const cacheKey = mesh.uuid + "_" + _cacheVersion.value;
  if (_vertexCache.has(cacheKey)) {
    return _vertexCache.get(cacheKey);
  }
  
  const vertices = [];
  const geometry = mesh.geometry;
  const positions = geometry.attributes?.position;
  
  if (!positions) return vertices;
  
  // Sample vertices (limit to 100 for performance)
  const step = Math.max(1, Math.floor(positions.count / 100));
  for (let i = 0; i < positions.count; i += step) {
    const v = new THREE.Vector3(
      positions.getX(i),
      positions.getY(i),
      positions.getZ(i)
    );
    v.applyMatrix4(mesh.matrixWorld);
    vertices.push(v);
  }
  
  // Add bounding box corners for better edge detection
  if (geometry.boundingBox === null) {
    geometry.computeBoundingBox();
  }
  const bb = geometry.boundingBox;
  if (bb) {
    const corners = [
      new THREE.Vector3(bb.min.x, bb.min.y, bb.min.z),
      new THREE.Vector3(bb.max.x, bb.min.y, bb.min.z),
      new THREE.Vector3(bb.min.x, bb.max.y, bb.min.z),
      new THREE.Vector3(bb.max.x, bb.max.y, bb.min.z),
      new THREE.Vector3(bb.min.x, bb.min.y, bb.max.z),
      new THREE.Vector3(bb.max.x, bb.min.y, bb.max.z),
      new THREE.Vector3(bb.min.x, bb.max.y, bb.max.z),
      new THREE.Vector3(bb.max.x, bb.max.y, bb.max.z),
    ];
    corners.forEach(c => {
      c.applyMatrix4(mesh.matrixWorld);
      vertices.push(c);
    });
  }
  
  _vertexCache.set(cacheKey, vertices);
  return vertices;
}

/**
 * Find closest point on a line segment to a given point.
 * @param {THREE.Vector3} point
 * @param {THREE.Vector3} lineStart
 * @param {THREE.Vector3} lineEnd
 * @returns {THREE.Vector3}
 */
function closestPointOnLine(point, lineStart, lineEnd) {
  const PA = _tempVec.subVectors(point, lineStart);
  const BA = _tempVec2.subVectors(lineEnd, lineStart);
  const lengthSq = BA.lengthSq();
  if (lengthSq === 0) return lineStart.clone();
  
  const t = Math.max(0, Math.min(1, PA.dot(BA) / lengthSq));
  return new THREE.Vector3().addVectors(
    lineStart,
    BA.clone().multiplyScalar(t)
  );
}

/**
 * Extract edges from mesh bounding box.
 * @param {THREE.Mesh} mesh
 * @returns {{ start: THREE.Vector3, end: THREE.Vector3 }[]}
 */
function extractEdges(mesh) {
  if (!mesh || !mesh.geometry) return [];
  
  if (mesh.geometry.boundingBox === null) {
    mesh.geometry.computeBoundingBox();
  }
  const bb = mesh.geometry.boundingBox;
  if (!bb) return [];
  
  const corners = [
    new THREE.Vector3(bb.min.x, bb.min.y, bb.min.z),
    new THREE.Vector3(bb.max.x, bb.min.y, bb.min.z),
    new THREE.Vector3(bb.min.x, bb.max.y, bb.min.z),
    new THREE.Vector3(bb.max.x, bb.max.y, bb.min.z),
    new THREE.Vector3(bb.min.x, bb.min.y, bb.max.z),
    new THREE.Vector3(bb.max.x, bb.min.y, bb.max.z),
    new THREE.Vector3(bb.min.x, bb.max.y, bb.max.z),
    new THREE.Vector3(bb.max.x, bb.max.y, bb.max.z),
  ];
  
  // Apply world transform
  corners.forEach(c => c.applyMatrix4(mesh.matrixWorld));
  
  // 12 edges of a box
  const edgeIndices = [
    [0, 1], [2, 3], [4, 5], [6, 7], // bottom & top horizontal
    [0, 2], [1, 3], [4, 6], [5, 7], // front & back vertical
    [0, 4], [1, 5], [2, 6], [3, 7], // connecting edges
  ];
  
  return edgeIndices.map(([i, j]) => ({
    start: corners[i],
    end: corners[j]
  }));
}

/**
 * Convert screen pixel distance to world distance at a given depth.
 * @param {number} screenPixels
 * @param {THREE.Camera} camera
 * @param {number} [depth] - Distance from camera (default: 10)
 * @returns {number}
 */
function screenToWorldDistance(screenPixels, camera, depth = 10) {
  if (!camera || !camera.isPerspectiveCamera) {
    return screenPixels * 0.01; // Fallback for orthographic
  }
  const vFov = camera.fov * Math.PI / 180;
  const height = 2 * Math.tan(vFov / 2) * depth;
  return (height * screenPixels) / window.innerHeight;
}

/**
 * Smart snap to geometry (vertices, edges, centers).
 * @param {THREE.Object3D} movingObject - The object being transformed
 * @param {THREE.Object3D[]} targetObjects - Other objects to snap to
 * @param {THREE.Camera} camera - Camera for screen-space threshold
 * @param {number} [threshold] - Pixel threshold (default: state.snapThreshold)
 * @returns {{ type: string, position: THREE.Vector3, distance: number, targetObj: THREE.Object3D }|null}
 */
export function snapToGeometry(movingObject, targetObjects, camera, threshold) {
  if (!state.enabled || !movingObject || !Array.isArray(targetObjects)) {
    state.lastSnapTarget = null;
    return null;
  }
  
  const pixelThreshold = threshold ?? state.snapThreshold;
  const snapTargets = [];
  const movingPos = movingObject.position;
  
  // Calculate world-space threshold based on distance from camera
  const distToCamera = camera ? camera.position.distanceTo(movingPos) : 10;
  const worldThreshold = screenToWorldDistance(pixelThreshold, camera, distToCamera);
  
  for (const otherObj of targetObjects) {
    if (!otherObj || otherObj === movingObject) continue;
    if (otherObj.uuid === movingObject.uuid) continue;
    
    // Skip non-mesh objects or helper objects
    if (!otherObj.isMesh && !otherObj.isGroup) continue;
    if (otherObj.userData?.__helper) continue;
    
    // 1. Snap to object center
    if (state.centerSnap) {
      const centerDist = movingPos.distanceTo(otherObj.position);
      if (centerDist < worldThreshold && centerDist > 0.001) {
        snapTargets.push({
          type: "center",
          position: otherObj.position.clone(),
          distance: centerDist,
          targetObj: otherObj
        });
      }
    }
    
    // For meshes, also check vertices and edges
    if (otherObj.isMesh) {
      // 2. Snap to vertices
      if (state.vertexSnap) {
        const vertices = extractVertices(otherObj);
        for (const vertex of vertices) {
          const dist = movingPos.distanceTo(vertex);
          if (dist < worldThreshold && dist > 0.001) {
            snapTargets.push({
              type: "vertex",
              position: vertex.clone(),
              distance: dist,
              targetObj: otherObj
            });
          }
        }
      }
      
      // 3. Snap to edges
      if (state.edgeSnap) {
        const edges = extractEdges(otherObj);
        for (const edge of edges) {
          const closestPoint = closestPointOnLine(movingPos, edge.start, edge.end);
          const dist = movingPos.distanceTo(closestPoint);
          if (dist < worldThreshold && dist > 0.001) {
            snapTargets.push({
              type: "edge",
              position: closestPoint,
              distance: dist,
              targetObj: otherObj
            });
          }
        }
      }
    }
  }
  
  // Return nearest snap target
  if (snapTargets.length > 0) {
    snapTargets.sort((a, b) => a.distance - b.distance);
    state.lastSnapTarget = snapTargets[0];
    return snapTargets[0];
  }
  
  state.lastSnapTarget = null;
  return null;
}

/**
 * Apply smart snap to an object's position.
 * @param {THREE.Object3D} object - Object to snap
 * @param {THREE.Object3D[]} targetObjects - Objects to snap to
 * @param {THREE.Camera} camera - Camera for threshold calculation
 * @returns {boolean} - Whether snap was applied
 */
export function applySmartSnap(object, targetObjects, camera) {
  const snapTarget = snapToGeometry(object, targetObjects, camera);
  if (snapTarget) {
    object.position.copy(snapTarget.position);
    return true;
  }
  return false;
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
  // Smart snap settings
  setVertexSnap,
  isVertexSnap,
  setEdgeSnap,
  isEdgeSnap,
  setCenterSnap,
  isCenterSnap,
  setSnapThreshold,
  getSnapThreshold,
  setShowIndicators,
  isShowIndicators,
  getLastSnapTarget,
  clearCache,
  // Core functions
  applyPreset,
  getState,
  snapScalar,
  snapPosition,
  snapAngle,
  snapRotation,
  snapScale,
  snapToSurface,
  // Smart snap functions
  snapToGeometry,
  applySmartSnap,
  // Helpers
  createSnapGrid,
  applyToTransformControls,
};
