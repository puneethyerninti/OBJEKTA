// src/engine/SceneOptimizer.js
// ---------------------------------------------------------------------------
// Phase 4 — Scene Optimization Engine
//
// Provides analysis and optimization utilities for Three.js scenes:
// - Scene statistics & performance budgets
// - Duplicate geometry / material detection
// - Material deduplication (merge identical materials)
// - Geometry merging for static meshes
// - Texture size analysis & recommendations
// ---------------------------------------------------------------------------

import * as THREE from "three";

// ── Helpers ───────────────────────────────────────────────────────────

/** Collect every mesh from a list of scene children. */
export function collectAllMeshes(children) {
  const meshes = [];
  for (const root of children) {
    if (!root || typeof root.traverse !== "function") continue;
    root.traverse((node) => {
      if (node.isMesh) meshes.push(node);
    });
  }
  return meshes;
}

/** Return triangle count for a geometry. */
function triCount(geometry) {
  if (!geometry) return 0;
  if (geometry.index) return Math.floor(geometry.index.count / 3);
  const pos = geometry.attributes?.position;
  return pos ? Math.floor(pos.count / 3) : 0;
}

/** Return vertex count for a geometry. */
function vertCount(geometry) {
  return geometry?.attributes?.position?.count || 0;
}

/** Compute a fast hash of a material for dedup comparisons. */
function materialHash(mat) {
  if (!mat) return "null";
  const parts = [
    mat.type || "?",
    mat.color ? mat.color.getHexString() : "no-color",
    mat.roughness != null ? mat.roughness.toFixed(3) : "-",
    mat.metalness != null ? mat.metalness.toFixed(3) : "-",
    mat.opacity != null ? mat.opacity.toFixed(3) : "-",
    mat.transparent ? "T" : "O",
    mat.side ?? "-",
    mat.map ? "map" : "",
    mat.normalMap ? "nmap" : "",
    mat.roughnessMap ? "rmap" : "",
    mat.metalnessMap ? "mmap" : "",
    mat.emissiveMap ? "emap" : "",
    mat.aoMap ? "aomap" : "",
  ];
  return parts.join("|");
}

/** Compute a fingerprint for a geometry (vertex count + a selection of vertex positions). */
function geometryFingerprint(geom) {
  if (!geom) return "null";
  const pos = geom.attributes?.position;
  if (!pos) return `nopos-${geom.uuid}`;
  const n = pos.count;
  // Sample a few verts for fast comparison
  const samples = [];
  const step = Math.max(1, Math.floor(n / 8));
  for (let i = 0; i < n && samples.length < 16; i += step) {
    samples.push(
      pos.getX(i).toFixed(4),
      pos.getY(i).toFixed(4),
      pos.getZ(i).toFixed(4)
    );
  }
  const idxCount = geom.index ? geom.index.count : 0;
  return `v${n}_i${idxCount}_${samples.join(",")}`;
}

// ═══════════════════════════════════════════════════════════════════════
//  PUBLIC API
// ═══════════════════════════════════════════════════════════════════════

/**
 * Comprehensive scene statistics.
 * @param {THREE.Object3D[]} children - top-level scene children
 * @param {THREE.Scene} [scene] - optional scene root (for lights)
 * @returns {object}
 */
export function getSceneStats(children, scene) {
  const meshes = collectAllMeshes(children);
  let totalTris = 0;
  let totalVerts = 0;
  let totalTextures = 0;
  const textureSet = new Set();
  const materialSet = new Set();
  const geometrySet = new Set();
  let drawCalls = 0;

  for (const mesh of meshes) {
    const geom = mesh.geometry;
    totalTris += triCount(geom);
    totalVerts += vertCount(geom);
    drawCalls++; // each mesh = at least one draw call

    if (geom) geometrySet.add(geom.uuid);

    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const mat of mats) {
      if (!mat) continue;
      materialSet.add(mat.uuid);
      // Count unique textures
      const texSlots = ["map", "normalMap", "roughnessMap", "metalnessMap", "emissiveMap", "aoMap", "bumpMap", "displacementMap", "envMap", "lightMap"];
      for (const slot of texSlots) {
        const tex = mat[slot];
        if (tex && !textureSet.has(tex.uuid)) {
          textureSet.add(tex.uuid);
          totalTextures++;
        }
      }
    }
  }

  // Count lights
  let lights = 0;
  if (scene && typeof scene.traverse === "function") {
    scene.traverse((n) => { if (n.isLight) lights++; });
  }

  return {
    meshCount: meshes.length,
    triangles: totalTris,
    vertices: totalVerts,
    drawCalls,
    uniqueGeometries: geometrySet.size,
    uniqueMaterials: materialSet.size,
    uniqueTextures: totalTextures,
    lights,
    objects: children.length,
  };
}

/**
 * Find groups of meshes that share the same geometry (candidates for instancing).
 * @returns {{ fingerprint: string, meshes: THREE.Mesh[] }[]}
 */
export function findDuplicateGeometries(children) {
  const meshes = collectAllMeshes(children);
  const fpMap = new Map();

  for (const mesh of meshes) {
    const fp = geometryFingerprint(mesh.geometry);
    if (!fpMap.has(fp)) fpMap.set(fp, []);
    fpMap.get(fp).push(mesh);
  }

  return Array.from(fpMap.entries())
    .filter(([, list]) => list.length > 1)
    .map(([fingerprint, meshes]) => ({ fingerprint, meshes }));
}

/**
 * Find materials that are identical (candidates for sharing).
 * @returns {{ hash: string, materials: THREE.Material[], meshes: THREE.Mesh[] }[]}
 */
export function findDuplicateMaterials(children) {
  const meshes = collectAllMeshes(children);
  const hashMap = new Map();

  for (const mesh of meshes) {
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const mat of mats) {
      if (!mat) continue;
      const h = materialHash(mat);
      if (!hashMap.has(h)) hashMap.set(h, { materials: [], meshes: [] });
      const entry = hashMap.get(h);
      if (!entry.materials.includes(mat)) entry.materials.push(mat);
      if (!entry.meshes.includes(mesh)) entry.meshes.push(mesh);
    }
  }

  return Array.from(hashMap.entries())
    .filter(([, val]) => val.materials.length > 1)
    .map(([hash, val]) => ({ hash, materials: val.materials, meshes: val.meshes }));
}

/**
 * Deduplicate materials — replace identical materials with a single shared reference.
 * Mutates the meshes in-place.
 * @returns {{ merged: number }} count of materials merged
 */
export function deduplicateMaterials(children) {
  const meshes = collectAllMeshes(children);
  const hashToCanonical = new Map();
  let merged = 0;

  for (const mesh of meshes) {
    if (Array.isArray(mesh.material)) {
      mesh.material = mesh.material.map((mat) => {
        const h = materialHash(mat);
        if (hashToCanonical.has(h)) {
          if (mat !== hashToCanonical.get(h)) merged++;
          return hashToCanonical.get(h);
        }
        hashToCanonical.set(h, mat);
        return mat;
      });
    } else if (mesh.material) {
      const h = materialHash(mesh.material);
      if (hashToCanonical.has(h)) {
        if (mesh.material !== hashToCanonical.get(h)) merged++;
        mesh.material = hashToCanonical.get(h);
      } else {
        hashToCanonical.set(h, mesh.material);
      }
    }
  }

  return { merged };
}

/**
 * Collect texture info for analysis.
 * @returns {{ uuid: string, name: string, slot: string, width: number, height: number, meshName: string }[]}
 */
export function analyzeTextures(children) {
  const meshes = collectAllMeshes(children);
  const seen = new Set();
  const results = [];
  const texSlots = ["map", "normalMap", "roughnessMap", "metalnessMap", "emissiveMap", "aoMap", "bumpMap"];

  for (const mesh of meshes) {
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const mat of mats) {
      if (!mat) continue;
      for (const slot of texSlots) {
        const tex = mat[slot];
        if (!tex) continue;
        const key = `${tex.uuid}_${slot}`;
        if (seen.has(key)) continue;
        seen.add(key);

        const img = tex.image;
        results.push({
          uuid: tex.uuid,
          name: tex.name || tex.uuid.slice(0, 8),
          slot,
          width: img?.width || 0,
          height: img?.height || 0,
          meshName: mesh.name || mesh.uuid.slice(0, 8),
        });
      }
    }
  }

  return results;
}

/**
 * Performance budget check.
 * @param {THREE.Object3D[]} children
 * @param {THREE.Scene} [scene]
 * @param {object} [targets] - optional budget targets
 * @returns {{ score: number, details: {category: string, value: number, target: number, ok: boolean}[] }}
 */
export function checkPerformanceBudget(children, scene, targets = {}) {
  const stats = getSceneStats(children, scene);
  const budget = {
    triangles: targets.triangles ?? 500_000,
    drawCalls: targets.drawCalls ?? 200,
    materials: targets.materials ?? 50,
    textures: targets.textures ?? 30,
    lights: targets.lights ?? 8,
  };

  const details = [
    { category: "Triangles", value: stats.triangles, target: budget.triangles, ok: stats.triangles <= budget.triangles },
    { category: "Draw Calls", value: stats.drawCalls, target: budget.drawCalls, ok: stats.drawCalls <= budget.drawCalls },
    { category: "Materials", value: stats.uniqueMaterials, target: budget.materials, ok: stats.uniqueMaterials <= budget.materials },
    { category: "Textures", value: stats.uniqueTextures, target: budget.textures, ok: stats.uniqueTextures <= budget.textures },
    { category: "Lights", value: stats.lights, target: budget.lights, ok: stats.lights <= budget.lights },
  ];

  const passing = details.filter((d) => d.ok).length;
  const score = Math.round((passing / details.length) * 100);

  return { score, details, stats };
}

/**
 * Generate a human-readable optimization report.
 * @param {THREE.Object3D[]} children
 * @param {THREE.Scene} [scene]
 * @returns {string[]} array of recommendation strings
 */
export function getOptimizationRecommendations(children, scene) {
  const stats = getSceneStats(children, scene);
  const dupGeoms = findDuplicateGeometries(children);
  const dupMats = findDuplicateMaterials(children);
  const textures = analyzeTextures(children);
  const recommendations = [];

  if (stats.triangles > 1_000_000) {
    recommendations.push(`High triangle count (${(stats.triangles / 1000).toFixed(0)}k). Use the Mesh tab to decimate heavy objects or enable LOD.`);
  } else if (stats.triangles > 500_000) {
    recommendations.push(`Triangle count is moderate (${(stats.triangles / 1000).toFixed(0)}k). Consider decimation for mobile targets.`);
  }

  if (dupGeoms.length > 0) {
    const instanceCount = dupGeoms.reduce((s, g) => s + g.meshes.length, 0);
    recommendations.push(`${dupGeoms.length} group(s) of duplicate geometries detected (${instanceCount} meshes). Consider using InstancedMesh for better performance.`);
  }

  if (dupMats.length > 0) {
    recommendations.push(`${dupMats.length} group(s) of identical materials. Use "Merge Materials" to reduce draw calls.`);
  }

  const largeTextures = textures.filter((t) => t.width > 2048 || t.height > 2048);
  if (largeTextures.length > 0) {
    recommendations.push(`${largeTextures.length} texture(s) exceed 2048px. Consider downsizing for faster load times.`);
  }

  if (stats.lights > 6) {
    recommendations.push(`${stats.lights} lights in scene. Real-time performance is best with ≤6 lights. Consider baking lighting.`);
  }

  if (stats.drawCalls > 200) {
    recommendations.push(`${stats.drawCalls} draw calls. Merge static meshes or use instancing to reduce below 200.`);
  }

  if (recommendations.length === 0) {
    recommendations.push("Scene is well-optimized! No major issues detected.");
  }

  return recommendations;
}
