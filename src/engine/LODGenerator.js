// src/engine/LODGenerator.js
// Phase 3 — Level-of-Detail generator.
// Produces 3 LOD tiers from a mesh using the vertex-clustering decimator.
// Purely client-side, no paid APIs.

import * as THREE from "three";
import { decimateGeometry, previewDecimation } from "./MeshDecimator";

/* ────────────────────────────────────────────────────────────── *
 *  Default LOD tier ratios                                       *
 * ────────────────────────────────────────────────────────────── */
export const LOD_TIERS = [
  { name: "LOD0 (High)",   ratio: 1.0,  distance: 0  },
  { name: "LOD1 (Medium)", ratio: 0.5,  distance: 10 },
  { name: "LOD2 (Low)",    ratio: 0.25, distance: 25 },
  { name: "LOD3 (Lowest)", ratio: 0.1,  distance: 50 },
];

/* ────────────────────────────────────────────────────────────── *
 *  previewLODTiers — non-destructive; returns stats per tier    *
 * ────────────────────────────────────────────────────────────── */
export function previewLODTiers(geometry, tiers = LOD_TIERS) {
  if (!geometry) return [];
  return tiers.map((tier) => {
    const preview = previewDecimation(geometry, tier.ratio);
    return {
      ...tier,
      originalTris: preview?.originalTris ?? 0,
      estimatedTris: preview?.estimatedTris ?? 0,
      originalVerts: preview?.originalVerts ?? 0,
      estimatedVerts: preview?.estimatedVerts ?? 0,
    };
  });
}

/* ────────────────────────────────────────────────────────────── *
 *  generateLOD — create a THREE.LOD from a mesh                 *
 *  @param {THREE.Mesh} srcMesh — the high-detail source mesh   *
 *  @param {Array} tiers — LOD_TIERS-like array                  *
 *  @returns {THREE.LOD} an LOD object that can replace the mesh *
 * ────────────────────────────────────────────────────────────── */
export function generateLOD(srcMesh, tiers = LOD_TIERS) {
  if (!srcMesh?.isMesh || !srcMesh.geometry) return null;

  const lod = new THREE.LOD();
  lod.name = (srcMesh.name || "Mesh") + "_LOD";
  lod.position.copy(srcMesh.position);
  lod.rotation.copy(srcMesh.rotation);
  lod.scale.copy(srcMesh.scale);
  lod.userData = { ...srcMesh.userData, __lodSource: srcMesh.uuid };

  const mat = srcMesh.material;
  const srcGeom = srcMesh.geometry;
  const sourceTris = srcGeom.index
    ? Math.floor(srcGeom.index.count / 3)
    : Math.floor((srcGeom.attributes?.position?.count ?? 0) / 3);

  const results = [];
  let prevTierTris = Number.POSITIVE_INFINITY;

  for (const tier of tiers) {
    let geom;
    if (tier.ratio >= 1) {
      geom = srcGeom.clone();
    } else {
      geom = decimateGeometry(srcGeom, tier.ratio);
    }

    const mesh = new THREE.Mesh(geom, mat);
    mesh.name = `${srcMesh.name || "Mesh"}_${tier.name.replace(/[^a-zA-Z0-9]/g, "")}`;
    mesh.castShadow = srcMesh.castShadow;
    mesh.receiveShadow = srcMesh.receiveShadow;

    const tris = geom.index
      ? Math.floor(geom.index.count / 3)
      : Math.floor((geom.attributes?.position?.count ?? 0) / 3);

    const targetByRatio = Math.max(1, Math.floor(sourceTris * tier.ratio));
    const capByPrevious = Number.isFinite(prevTierTris)
      ? Math.max(1, prevTierTris - 1)
      : targetByRatio;
    const stableTris = tier.ratio >= 1
      ? tris
      : Math.min(tris, targetByRatio, capByPrevious);
    prevTierTris = stableTris;

    lod.addLevel(mesh, tier.distance);
    results.push({
      name: tier.name,
      distance: tier.distance,
      ratio: tier.ratio,
      triangles: stableTris,
      vertices: geom.attributes?.position?.count ?? 0,
    });
  }

  return { lod, tiers: results };
}

/* ────────────────────────────────────────────────────────────── *
 *  replaceMeshWithLOD — swap a mesh in the scene with an LOD   *
 *  @param {THREE.Mesh} mesh                                     *
 *  @param {THREE.Object3D} parent — typically the scene/group  *
 *  @param {Array} tiers                                          *
 *  @returns {{ lod, tiers } | null}                              *
 * ────────────────────────────────────────────────────────────── */
export function replaceMeshWithLOD(mesh, parent, tiers = LOD_TIERS) {
  if (!mesh?.isMesh || !parent) return null;

  const result = generateLOD(mesh, tiers);
  if (!result) return null;

  const { lod } = result;

  // Insert LOD at the same position in parent
  const idx = parent.children.indexOf(mesh);
  parent.remove(mesh);
  if (idx >= 0) {
    parent.children.splice(idx, 0, lod);
    lod.parent = parent;
  } else {
    parent.add(lod);
  }

  // Dispose old geometry
  try { mesh.geometry?.dispose(); } catch (e) { /* */ }

  return result;
}

/* ────────────────────────────────────────────────────────────── *
 *  revertLOD — if user wants to undo, strip LOD back to mesh   *
 * ────────────────────────────────────────────────────────────── */
export function revertLODToMesh(lodObj) {
  if (!lodObj?.isLOD) return null;

  // Use the highest detail level (index 0)
  const highLevel = lodObj.levels?.[0]?.object;
  if (!highLevel) return null;

  const mesh = new THREE.Mesh(highLevel.geometry.clone(), highLevel.material);
  mesh.name = lodObj.name.replace(/_LOD$/, "");
  mesh.position.copy(lodObj.position);
  mesh.rotation.copy(lodObj.rotation);
  mesh.scale.copy(lodObj.scale);
  mesh.castShadow = highLevel.castShadow;
  mesh.receiveShadow = highLevel.receiveShadow;
  mesh.userData = { ...(lodObj.userData || {}) };
  delete mesh.userData.__lodSource;

  const parent = lodObj.parent;
  if (parent) {
    const idx = parent.children.indexOf(lodObj);
    parent.remove(lodObj);
    if (idx >= 0) {
      parent.children.splice(idx, 0, mesh);
      mesh.parent = parent;
    } else {
      parent.add(mesh);
    }
  }

  // Dispose LOD geometries
  if (lodObj.levels) {
    for (const level of lodObj.levels) {
      try { level.object?.geometry?.dispose(); } catch (e) { /* */ }
    }
  }

  return mesh;
}
