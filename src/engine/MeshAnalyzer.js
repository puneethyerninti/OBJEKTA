// src/engine/MeshAnalyzer.js
// Phase 3 — Mesh analysis utilities for geometry inspection,
// UV coverage analysis, and mesh quality metrics.

import * as THREE from "three";

/* ────────────────────────────────────────────────────────────── *
 *  Helper: count triangles in a geometry                        *
 * ────────────────────────────────────────────────────────────── */
function countTriangles(geometry) {
  if (!geometry) return 0;
  if (geometry.index) return Math.floor(geometry.index.count / 3);
  const pos = geometry.attributes?.position;
  return pos ? Math.floor(pos.count / 3) : 0;
}

/* ────────────────────────────────────────────────────────────── *
 *  Helper: count vertices in a geometry                         *
 * ────────────────────────────────────────────────────────────── */
function countVertices(geometry) {
  return geometry?.attributes?.position?.count ?? 0;
}

/* ────────────────────────────────────────────────────────────── *
 *  Collect all meshes from an Object3D tree                     *
 * ────────────────────────────────────────────────────────────── */
export function collectMeshes(root) {
  const meshes = [];
  if (!root) return meshes;
  root.traverse((n) => {
    if (n.isMesh && n.geometry) meshes.push(n);
  });
  return meshes;
}

/* ────────────────────────────────────────────────────────────── *
 *  Analyze a single mesh                                         *
 * ────────────────────────────────────────────────────────────── */
export function analyzeMesh(mesh) {
  if (!mesh?.isMesh || !mesh.geometry) return null;

  const geom = mesh.geometry;
  const tris = countTriangles(geom);
  const verts = countVertices(geom);
  const hasIndex = !!geom.index;
  const hasNormals = !!geom.attributes?.normal;
  const hasUV = !!geom.attributes?.uv;
  const hasUV2 = !!geom.attributes?.uv2;
  const hasTangents = !!geom.attributes?.tangent;

  // Bounding box
  if (!geom.boundingBox) geom.computeBoundingBox();
  const box = geom.boundingBox;
  const size = new THREE.Vector3();
  box.getSize(size);

  // Bounding sphere
  if (!geom.boundingSphere) geom.computeBoundingSphere();
  const radius = geom.boundingSphere?.radius ?? 0;

  // Triangle density (tris per unit volume, approximation)
  const volume = size.x * size.y * size.z;
  const triDensity = volume > 0.0001 ? tris / volume : 0;

  // UV analysis
  const uvAnalysis = hasUV ? analyzeUVs(geom) : null;

  // Vertex re-use ratio (indexed vs unique)
  const indexCount = geom.index ? geom.index.count : verts;
  const reuseRatio = verts > 0 ? indexCount / verts : 1;

  // Material info
  const mat = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
  const materialType = mat?.type ?? "unknown";
  const materialTextured = !!(mat?.map || mat?.normalMap || mat?.roughnessMap);

  return {
    name: mesh.name || mesh.uuid,
    uuid: mesh.uuid,
    triangles: tris,
    vertices: verts,
    indexed: hasIndex,
    hasNormals,
    hasUV,
    hasUV2,
    hasTangents,
    boundingBox: {
      min: { x: box.min.x, y: box.min.y, z: box.min.z },
      max: { x: box.max.x, y: box.max.y, z: box.max.z },
      size: { x: size.x, y: size.y, z: size.z },
    },
    boundingSphereRadius: radius,
    triDensity: Math.round(triDensity),
    reuseRatio: Math.round(reuseRatio * 100) / 100,
    materialType,
    materialTextured,
    uvAnalysis,
  };
}

/* ────────────────────────────────────────────────────────────── *
 *  Analyze UV coverage & quality                                 *
 * ────────────────────────────────────────────────────────────── */
export function analyzeUVs(geometry) {
  const uvAttr = geometry.attributes?.uv;
  if (!uvAttr) return null;

  let minU = Infinity, maxU = -Infinity;
  let minV = Infinity, maxV = -Infinity;
  let outOfBounds = 0;
  let overlapping = 0;
  const count = uvAttr.count;

  // Sample up to 10,000 UVs for performance
  const step = Math.max(1, Math.floor(count / 10000));

  for (let i = 0; i < count; i += step) {
    const u = uvAttr.getX(i);
    const v = uvAttr.getY(i);
    if (u < minU) minU = u;
    if (u > maxU) maxU = u;
    if (v < minV) minV = v;
    if (v > maxV) maxV = v;
    if (u < -0.01 || u > 1.01 || v < -0.01 || v > 1.01) outOfBounds++;
  }

  const sampledCount = Math.ceil(count / step);
  const coverage = Math.min(1, (maxU - minU) * (maxV - minV));

  // Simple overlap detection: bin UVs into a grid and check for collisions
  const gridRes = 64;
  const grid = new Uint8Array(gridRes * gridRes);
  const index = geometry.index;
  const triCount = index ? Math.floor(index.count / 3) : Math.floor(count / 3);
  const sampleTris = Math.min(triCount, 5000);
  const triStep = Math.max(1, Math.floor(triCount / sampleTris));

  for (let t = 0; t < triCount; t += triStep) {
    const i0 = index ? index.getX(t * 3) : t * 3;
    const cu = (uvAttr.getX(i0) * gridRes) | 0;
    const cv = (uvAttr.getY(i0) * gridRes) | 0;
    if (cu >= 0 && cu < gridRes && cv >= 0 && cv < gridRes) {
      const idx = cv * gridRes + cu;
      if (grid[idx]) overlapping++;
      else grid[idx] = 1;
    }
  }

  const overlapRatio = sampleTris > 0 ? overlapping / Math.ceil(triCount / triStep) : 0;

  return {
    coverage: Math.round(coverage * 100),
    outOfBoundsPercent: Math.round((outOfBounds / sampledCount) * 100),
    overlapEstimate: Math.round(overlapRatio * 100),
    bounds: {
      minU: Math.round(minU * 1000) / 1000,
      maxU: Math.round(maxU * 1000) / 1000,
      minV: Math.round(minV * 1000) / 1000,
      maxV: Math.round(maxV * 1000) / 1000,
    },
  };
}

/* ────────────────────────────────────────────────────────────── *
 *  Analyze an entire scene (all meshes)                         *
 * ────────────────────────────────────────────────────────────── */
export function analyzeScene(sceneObjects) {
  if (!sceneObjects || sceneObjects.length === 0) {
    return { meshCount: 0, totalTriangles: 0, totalVertices: 0, meshes: [], issues: [] };
  }

  const allMeshes = [];
  sceneObjects.forEach((obj) => {
    collectMeshes(obj).forEach((m) => allMeshes.push(m));
  });

  let totalTris = 0;
  let totalVerts = 0;
  const meshResults = [];
  const issues = [];

  for (const mesh of allMeshes) {
    const info = analyzeMesh(mesh);
    if (!info) continue;
    totalTris += info.triangles;
    totalVerts += info.vertices;
    meshResults.push(info);

    // Flag issues
    if (info.triangles > 100000) {
      issues.push({ severity: "warning", mesh: info.name, message: `High poly (${(info.triangles / 1000).toFixed(1)}k tris) — consider decimation` });
    }
    if (info.triangles > 500000) {
      issues.push({ severity: "error", mesh: info.name, message: `Very high poly (${(info.triangles / 1000).toFixed(1)}k tris) — will cause performance issues` });
    }
    if (!info.indexed) {
      issues.push({ severity: "info", mesh: info.name, message: "Non-indexed geometry — indexing could save memory" });
    }
    if (!info.hasNormals) {
      issues.push({ severity: "info", mesh: info.name, message: "Missing normals" });
    }
    if (!info.hasUV) {
      issues.push({ severity: "warning", mesh: info.name, message: "No UV coordinates — textures will not map correctly" });
    }
    if (info.uvAnalysis) {
      if (info.uvAnalysis.outOfBoundsPercent > 20) {
        issues.push({ severity: "warning", mesh: info.name, message: `${info.uvAnalysis.outOfBoundsPercent}% UVs out of 0-1 bounds` });
      }
      if (info.uvAnalysis.overlapEstimate > 30) {
        issues.push({ severity: "warning", mesh: info.name, message: `~${info.uvAnalysis.overlapEstimate}% estimated UV overlap` });
      }
      if (info.uvAnalysis.coverage < 15) {
        issues.push({ severity: "info", mesh: info.name, message: `Low UV coverage (${info.uvAnalysis.coverage}%) — UV island layout may be inefficient` });
      }
    }
  }

  if (totalTris > 500000) {
    issues.unshift({ severity: "warning", mesh: "*scene*", message: `Scene total: ${(totalTris / 1000).toFixed(1)}k tris — consider reducing for web` });
  }
  if (totalTris > 2000000) {
    issues.unshift({ severity: "error", mesh: "*scene*", message: `Scene total: ${(totalTris / 1000000).toFixed(2)}M tris — very heavy for real-time` });
  }

  return {
    meshCount: allMeshes.length,
    totalTriangles: totalTris,
    totalVertices: totalVerts,
    meshes: meshResults,
    issues,
  };
}

/* ────────────────────────────────────────────────────────────── *
 *  UV Unwrap Hints                                               *
 *  Analyze mesh topology and suggest a UV strategy               *
 * ────────────────────────────────────────────────────────────── */
export function suggestUVStrategy(mesh) {
  if (!mesh?.isMesh || !mesh.geometry) return null;

  const geom = mesh.geometry;
  const tris = countTriangles(geom);
  const verts = countVertices(geom);
  const hasUV = !!geom.attributes?.uv;

  if (!geom.boundingBox) geom.computeBoundingBox();
  const size = new THREE.Vector3();
  geom.boundingBox.getSize(size);

  const aspect = Math.max(size.x, size.y, size.z) / (Math.min(size.x, size.y, size.z) || 0.001);
  const isFlat = (size.y < 0.01 * Math.max(size.x, size.z)) || (size.x < 0.01 * Math.max(size.y, size.z)) || (size.z < 0.01 * Math.max(size.x, size.y));
  const isElongated = aspect > 5;

  const hints = [];

  if (!hasUV) {
    if (isFlat) {
      hints.push({ type: "projection", method: "planar", reason: "Flat shape — planar projection is optimal" });
    } else if (isElongated) {
      hints.push({ type: "projection", method: "cylindrical", reason: "Elongated shape — cylindrical projection recommended" });
    } else if (aspect < 2) {
      hints.push({ type: "projection", method: "spherical", reason: "Near-cuboid shape — try spherical or box projection" });
    } else {
      hints.push({ type: "projection", method: "box", reason: "Mixed proportions — box projection is a safe starting point" });
    }
  }

  if (hasUV) {
    const uvInfo = analyzeUVs(geom);
    if (uvInfo) {
      if (uvInfo.overlapEstimate > 25) {
        hints.push({ type: "fix", issue: "overlap", reason: `~${uvInfo.overlapEstimate}% overlap detected — re-pack UV islands` });
      }
      if (uvInfo.outOfBoundsPercent > 10) {
        hints.push({ type: "fix", issue: "outOfBounds", reason: `${uvInfo.outOfBoundsPercent}% UVs outside 0-1 — clamp or rescale` });
      }
      if (uvInfo.coverage < 20) {
        hints.push({ type: "fix", issue: "wastefulLayout", reason: `Only ${uvInfo.coverage}% UV space used — repack for higher density` });
      }
    }
  }

  if (tris > 50000 && !hasUV) {
    hints.push({ type: "tip", reason: "High poly + no UVs — consider auto-UV after decimation for better perf" });
  }

  if (verts > 0 && tris / verts > 2) {
    hints.push({ type: "tip", reason: "High tri/vert ratio — geometry might benefit from vertex merging before UV" });
  }

  return {
    meshName: mesh.name || mesh.uuid,
    triangles: tris,
    vertices: verts,
    hasExistingUV: hasUV,
    boundingSize: { x: +size.x.toFixed(3), y: +size.y.toFixed(3), z: +size.z.toFixed(3) },
    shapeProfile: isFlat ? "flat" : isElongated ? "elongated" : aspect < 2 ? "compact" : "mixed",
    hints,
  };
}
