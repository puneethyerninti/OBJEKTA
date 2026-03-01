// src/components/workspace/cameraUtils.js
// Pure camera math utilities extracted from Workspace.jsx
// These functions have zero React dependencies — pure THREE.js math.

import * as THREE from "three";

/**
 * Compute a quaternion that "looks at" the target from the given position.
 * @param {THREE.Vector3} pos  – camera/eye position
 * @param {THREE.Vector3} target – look-at point
 * @param {THREE.Vector3} [up] – world-up vector (default: Y-up)
 * @returns {THREE.Quaternion}
 */
export function computeLookAtQuat(pos, target, up = new THREE.Vector3(0, 1, 0)) {
  const m = new THREE.Matrix4();
  m.lookAt(pos, target, up);
  const q = new THREE.Quaternion();
  q.setFromRotationMatrix(m);
  return q;
}

/**
 * Compute a new camera position for a given view preset relative to
 * the current orbit target and distance.
 * @param {"front"|"back"|"left"|"right"|"top"|"bottom"|"iso"} preset
 * @param {THREE.Vector3} target  – orbit target
 * @param {number} dist           – distance from target
 * @returns {{ position: THREE.Vector3, up: THREE.Vector3 }}
 */
export function presetCameraPosition(preset, target, dist) {
  const dir = new THREE.Vector3();
  switch (preset) {
    case "back":    dir.set(0, 0, -1); break;
    case "left":    dir.set(1, 0, 0);  break;
    case "right":   dir.set(-1, 0, 0); break;
    case "top":     dir.set(0, 1, 0);  break;
    case "bottom":  dir.set(0, -1, 0); break;
    case "iso":
    case "isometric": dir.set(1, 0.9, 1); break;
    default:        dir.set(0, 0, 1); // front
  }
  dir.normalize();
  const position = target.clone().addScaledVector(dir, dist);
  const up =
    preset === "top"    ? new THREE.Vector3(0, 0, -1) :
    preset === "bottom" ? new THREE.Vector3(0, 0, 1)  :
    new THREE.Vector3(0, 1, 0);
  return { position, up };
}

/**
 * Compute a bounding-box–based framing distance for a camera.
 * @param {THREE.Box3} box     – world-space bounding box
 * @param {number} fovDeg      – camera FOV in degrees
 * @param {number} [padding=1.25] – breathing room multiplier
 * @returns {{ center: THREE.Vector3, dist: number, size: THREE.Vector3 }}
 */
export function computeFramingDistance(box, fovDeg = 60, padding = 1.25) {
  const size   = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z, 0.0001);
  const fov    = fovDeg * (Math.PI / 180);
  const dist   = Math.abs((maxDim * padding) / Math.sin(fov / 2));
  return { center, dist, size };
}

/* ---- Camera bookmark serialization (pure data, no refs) ---- */

/**
 * Serialize a camera bookmark snapshot to a plain JSON-safe object.
 */
export function serializeBookmark(snap) {
  return {
    p: snap.position  ? [snap.position.x, snap.position.y, snap.position.z] : null,
    q: snap.quaternion ? [snap.quaternion.x, snap.quaternion.y, snap.quaternion.z, snap.quaternion.w] : null,
    z: typeof snap.zoom === "number" ? snap.zoom : 1,
    t: snap.target     ? [snap.target.x, snap.target.y, snap.target.z] : null,
  };
}

/**
 * Deserialize a previously-serialized camera bookmark.
 * Returns a snapshot with THREE.Vector3 / THREE.Quaternion instances, or null.
 */
export function deserializeBookmark(b) {
  if (!b) return null;
  try {
    return {
      position:   Array.isArray(b.p) ? new THREE.Vector3(b.p[0], b.p[1], b.p[2]) : null,
      quaternion: Array.isArray(b.q) ? new THREE.Quaternion(b.q[0], b.q[1], b.q[2], b.q[3]) : null,
      zoom:       typeof b.z === "number" ? b.z : 1,
      target:     Array.isArray(b.t) ? new THREE.Vector3(b.t[0], b.t[1], b.t[2]) : null,
    };
  } catch {
    return null;
  }
}

/**
 * Cubic ease-in-out for smooth camera transitions.
 * @param {number} t – normalised time [0, 1]
 * @returns {number}
 */
export function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}
