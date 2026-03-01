// src/engine/ExportPipeline.js
// ---------------------------------------------------------------------------
// Phase 4 — Export Pipeline Engine
//
// Provides optimized export utilities for Three.js scenes:
// - Estimate file size before exporting
// - Strip unnecessary metadata
// - Clone & clean scene for export
// - Produce optimized GLB blob
// ---------------------------------------------------------------------------

import * as THREE from "three";
import { collectAllMeshes } from "./SceneOptimizer";

// ── Helpers ───────────────────────────────────────────────────────────

/** Rough byte-size estimate for a BufferGeometry. */
function estimateGeometryBytes(geom) {
  if (!geom) return 0;
  let bytes = 0;
  const attrs = geom.attributes;
  if (attrs) {
    for (const key of Object.keys(attrs)) {
      const attr = attrs[key];
      if (attr?.array) bytes += attr.array.byteLength || 0;
    }
  }
  if (geom.index?.array) bytes += geom.index.array.byteLength || 0;
  return bytes;
}

/** Rough byte-size estimate for a texture. */
function estimateTextureBytes(tex) {
  if (!tex?.image) return 0;
  const w = tex.image.width || 0;
  const h = tex.image.height || 0;
  // Assume 4 bytes per pixel (RGBA) — encoded JPEG/PNG will be smaller
  return w * h * 4;
}

// ═══════════════════════════════════════════════════════════════════════
//  PUBLIC API
// ═══════════════════════════════════════════════════════════════════════

/**
 * Estimate the approximate export size (in bytes) before actually exporting.
 * This is a rough estimate — actual GLB will be smaller due to compression.
 * @param {THREE.Object3D[]} children
 * @returns {{ totalBytes: number, geometryBytes: number, textureBytes: number, meshCount: number, breakdown: object[] }}
 */
export function estimateExportSize(children) {
  const meshes = collectAllMeshes(children);
  const seenGeom = new Set();
  const seenTex = new Set();
  let geometryBytes = 0;
  let textureBytes = 0;
  const breakdown = [];

  for (const mesh of meshes) {
    let meshGeomBytes = 0;
    let meshTexBytes = 0;

    // Geometry
    const geom = mesh.geometry;
    if (geom && !seenGeom.has(geom.uuid)) {
      seenGeom.add(geom.uuid);
      meshGeomBytes = estimateGeometryBytes(geom);
      geometryBytes += meshGeomBytes;
    }

    // Textures
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const mat of mats) {
      if (!mat) continue;
      const texSlots = ["map", "normalMap", "roughnessMap", "metalnessMap", "emissiveMap", "aoMap"];
      for (const slot of texSlots) {
        const tex = mat[slot];
        if (tex && !seenTex.has(tex.uuid)) {
          seenTex.add(tex.uuid);
          const tBytes = estimateTextureBytes(tex);
          textureBytes += tBytes;
          meshTexBytes += tBytes;
        }
      }
    }

    breakdown.push({
      name: mesh.name || mesh.uuid.slice(0, 8),
      geometryBytes: meshGeomBytes,
      textureBytes: meshTexBytes,
    });
  }

  const totalBytes = geometryBytes + textureBytes;
  return { totalBytes, geometryBytes, textureBytes, meshCount: meshes.length, breakdown };
}

/**
 * Strip unnecessary userData and metadata from scene objects (in-place).
 * Preserves essential animation/user data keys.
 * @param {THREE.Object3D[]} children
 * @returns {{ cleaned: number }}
 */
export function stripMetadata(children) {
  const KEEP_KEYS = new Set(["name", "visible", "castShadow", "receiveShadow"]);
  let cleaned = 0;

  for (const root of children) {
    if (!root || typeof root.traverse !== "function") continue;
    root.traverse((node) => {
      if (node.userData && typeof node.userData === "object") {
        const keys = Object.keys(node.userData);
        for (const key of keys) {
          // Keep animation data, remove debug/editor metadata
          if (key.startsWith("_") || key === "__helper" || key === "debugInfo" || key === "editorData") {
            delete node.userData[key];
            cleaned++;
          }
        }
      }
    });
  }

  return { cleaned };
}

/**
 * Prepare a clean clone of scene children for export.
 * Removes helpers, grid objects, internal markers, and optionally strips metadata.
 * @param {THREE.Object3D[]} children
 * @param {object} [options]
 * @returns {THREE.Group}
 */
export function prepareExportGroup(children, options = {}) {
  const { stripMeta = true, includeInvisible = false } = options;
  const exportGroup = new THREE.Group();
  exportGroup.name = "ExportRoot";

  const isHelper = (obj) => {
    if (!obj) return false;
    if (obj.name?.startsWith("_")) return true;
    if (["GridHelper", "AxesHelper", "BoxHelper", "CameraHelper"].includes(obj.type)) return true;
    if (obj.userData?.__helper) return true;
    return false;
  };

  for (const child of children) {
    if (!child) continue;
    if (!includeInvisible && child.visible === false) continue;
    if (isHelper(child)) continue;

    try {
      const clone = child.clone(true);

      // Remove helpers from clone
      const removeList = [];
      clone.traverse((n) => {
        if (isHelper(n)) removeList.push(n);
        if (!includeInvisible && n.visible === false && n !== clone) removeList.push(n);
      });
      removeList.forEach((n) => {
        if (n.parent) n.parent.remove(n);
      });

      if (stripMeta) {
        clone.traverse((n) => {
          if (n.userData) {
            const keys = Object.keys(n.userData);
            for (const key of keys) {
              if (key.startsWith("_") || key === "__helper" || key === "debugInfo") {
                delete n.userData[key];
              }
            }
          }
        });
      }

      exportGroup.add(clone);
    } catch (err) {
      console.warn("[ExportPipeline] Failed to clone object:", err);
    }
  }

  exportGroup.updateMatrixWorld(true);
  return exportGroup;
}

/**
 * Format bytes into a human-readable string.
 * @param {number} bytes
 * @returns {string}
 */
export function formatBytes(bytes) {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

/**
 * Quality presets for export optimization.
 */
export const EXPORT_PRESETS = {
  high: {
    label: "High Quality",
    description: "Full resolution textures, maximum detail",
    maxTextureSize: 4096,
    embedImages: true,
    stripMeta: false,
  },
  medium: {
    label: "Balanced",
    description: "Good quality with reduced file size",
    maxTextureSize: 2048,
    embedImages: true,
    stripMeta: true,
  },
  low: {
    label: "Performance",
    description: "Small file size, fast loading",
    maxTextureSize: 1024,
    embedImages: true,
    stripMeta: true,
  },
  web: {
    label: "Web Optimized",
    description: "Optimized for web delivery and fast first paint",
    maxTextureSize: 1024,
    embedImages: true,
    stripMeta: true,
  },
};
