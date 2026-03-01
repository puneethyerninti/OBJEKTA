// src/engine/MeshDecimator.js
// Phase 3 — Mesh decimation using vertex-clustering algorithm.
// Runs entirely in the browser — no external backends or paid APIs.
//
// Strategy: subdivide space into a uniform voxel grid → cluster vertices
// that fall into the same cell → rebuild indexed geometry.
// This is O(n) and works on arbitrary geometry.

import * as THREE from "three";

/* ────────────────────────────────────────────────────────────── *
 *  decimateGeometry                                              *
 *  @param {THREE.BufferGeometry} srcGeom                        *
 *  @param {number} ratio – target ratio, 0.0 … 1.0             *
 *         0.5 = keep ~50% of triangles                          *
 *  @returns {THREE.BufferGeometry} new decimated geometry        *
 * ────────────────────────────────────────────────────────────── */
export function decimateGeometry(srcGeom, ratio = 0.5) {
  if (!srcGeom || ratio >= 1) return srcGeom.clone();
  ratio = Math.max(0.01, Math.min(1, ratio));

  // Ensure we have a bounding box
  if (!srcGeom.boundingBox) srcGeom.computeBoundingBox();
  const box = srcGeom.boundingBox;
  const size = new THREE.Vector3();
  box.getSize(size);

  const posAttr = srcGeom.attributes.position;
  if (!posAttr) return srcGeom.clone();
  const vertCount = posAttr.count;
  const index = srcGeom.index;

  // Calculate grid resolution from ratio
  // Lower ratio → fewer grid cells → more vertex merging
  const targetVerts = Math.max(4, Math.floor(vertCount * ratio));
  const gridRes = Math.max(2, Math.ceil(Math.cbrt(targetVerts)));

  const cellSize = new THREE.Vector3(
    (size.x || 0.001) / gridRes,
    (size.y || 0.001) / gridRes,
    (size.z || 0.001) / gridRes,
  );

  // Map each vertex → cell ID, and accumulate positions per cell
  const cellMap = new Map(); // cellKey -> { sumPos, sumNorm, sumUV, count, newIndex }
  const hasNormals = !!srcGeom.attributes.normal;
  const hasUV = !!srcGeom.attributes.uv;
  const normAttr = srcGeom.attributes.normal;
  const uvAttr = srcGeom.attributes.uv;

  const vertToCell = new Int32Array(vertCount); // vertex → cell index

  for (let i = 0; i < vertCount; i++) {
    const x = posAttr.getX(i);
    const y = posAttr.getY(i);
    const z = posAttr.getZ(i);

    const cx = Math.min(gridRes - 1, Math.max(0, Math.floor((x - box.min.x) / cellSize.x)));
    const cy = Math.min(gridRes - 1, Math.max(0, Math.floor((y - box.min.y) / cellSize.y)));
    const cz = Math.min(gridRes - 1, Math.max(0, Math.floor((z - box.min.z) / cellSize.z)));

    const key = cx + cy * gridRes + cz * gridRes * gridRes;
    vertToCell[i] = key;

    let cell = cellMap.get(key);
    if (!cell) {
      cell = { sx: 0, sy: 0, sz: 0, snx: 0, sny: 0, snz: 0, su: 0, sv: 0, count: 0, newIndex: -1 };
      cellMap.set(key, cell);
    }
    cell.sx += x;
    cell.sy += y;
    cell.sz += z;
    if (hasNormals) {
      cell.snx += normAttr.getX(i);
      cell.sny += normAttr.getY(i);
      cell.snz += normAttr.getZ(i);
    }
    if (hasUV) {
      cell.su += uvAttr.getX(i);
      cell.sv += uvAttr.getY(i);
    }
    cell.count++;
  }

  // Build new vertex list
  const newPositions = [];
  const newNormals = [];
  const newUVs = [];
  let newIdx = 0;

  for (const cell of cellMap.values()) {
    const inv = 1 / cell.count;
    newPositions.push(cell.sx * inv, cell.sy * inv, cell.sz * inv);
    if (hasNormals) {
      const nx = cell.snx * inv;
      const ny = cell.sny * inv;
      const nz = cell.snz * inv;
      const len = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
      newNormals.push(nx / len, ny / len, nz / len);
    }
    if (hasUV) {
      newUVs.push(cell.su * inv, cell.sv * inv);
    }
    cell.newIndex = newIdx++;
  }

  // Build index remapping
  const cellKeys = Array.from(cellMap.keys());
  const keyToNewIdx = new Map();
  for (const key of cellKeys) {
    keyToNewIdx.set(key, cellMap.get(key).newIndex);
  }

  // Rebuild triangles, skipping degenerate ones
  const newIndices = [];
  const triCount = index ? Math.floor(index.count / 3) : Math.floor(vertCount / 3);

  for (let t = 0; t < triCount; t++) {
    const i0 = index ? index.getX(t * 3) : t * 3;
    const i1 = index ? index.getX(t * 3 + 1) : t * 3 + 1;
    const i2 = index ? index.getX(t * 3 + 2) : t * 3 + 2;

    const n0 = keyToNewIdx.get(vertToCell[i0]);
    const n1 = keyToNewIdx.get(vertToCell[i1]);
    const n2 = keyToNewIdx.get(vertToCell[i2]);

    // Skip degenerate triangles (all 3 vertices collapsed to same cell)
    if (n0 === n1 && n1 === n2) continue;
    // Skip if two vertices collapsed
    if (n0 === n1 || n1 === n2 || n0 === n2) continue;

    newIndices.push(n0, n1, n2);
  }

  // Build new BufferGeometry
  const newGeom = new THREE.BufferGeometry();
  newGeom.setAttribute("position", new THREE.Float32BufferAttribute(newPositions, 3));
  if (hasNormals && newNormals.length > 0) {
    newGeom.setAttribute("normal", new THREE.Float32BufferAttribute(newNormals, 3));
  }
  if (hasUV && newUVs.length > 0) {
    newGeom.setAttribute("uv", new THREE.Float32BufferAttribute(newUVs, 2));
  }
  if (newIndices.length > 0) {
    newGeom.setIndex(newIndices);
  }

  newGeom.computeBoundingBox();
  newGeom.computeBoundingSphere();

  return newGeom;
}

/* ────────────────────────────────────────────────────────────── *
 *  decimateMesh — applies decimation to a mesh (mutating)       *
 *  @param {THREE.Mesh} mesh                                     *
 *  @param {number} ratio                                         *
 *  @returns {{ before: {tris, verts}, after: {tris, verts} }}   *
 * ────────────────────────────────────────────────────────────── */
export function decimateMesh(mesh, ratio = 0.5) {
  if (!mesh?.isMesh || !mesh.geometry) return null;

  const before = {
    tris: mesh.geometry.index
      ? Math.floor(mesh.geometry.index.count / 3)
      : Math.floor((mesh.geometry.attributes?.position?.count ?? 0) / 3),
    verts: mesh.geometry.attributes?.position?.count ?? 0,
  };

  const oldGeom = mesh.geometry;
  const newGeom = decimateGeometry(oldGeom, ratio);

  const after = {
    tris: newGeom.index
      ? Math.floor(newGeom.index.count / 3)
      : Math.floor((newGeom.attributes?.position?.count ?? 0) / 3),
    verts: newGeom.attributes?.position?.count ?? 0,
  };

  // Replace geometry
  mesh.geometry = newGeom;
  oldGeom.dispose();

  return { before, after };
}

/* ────────────────────────────────────────────────────────────── *
 *  previewDecimation — non-destructive: returns stats only      *
 *  @param {THREE.BufferGeometry} geom                           *
 *  @param {number} ratio                                         *
 *  @returns {{ originalTris, estimatedTris, originalVerts,       *
 *             estimatedVerts }}                                   *
 * ────────────────────────────────────────────────────────────── */
export function previewDecimation(geom, ratio = 0.5) {
  if (!geom) return null;
  const originalTris = geom.index
    ? Math.floor(geom.index.count / 3)
    : Math.floor((geom.attributes?.position?.count ?? 0) / 3);
  const originalVerts = geom.attributes?.position?.count ?? 0;

  // Quick estimate based on vertex clustering grid resolution
  const targetVerts = Math.max(4, Math.floor(originalVerts * ratio));
  const gridRes = Math.max(2, Math.ceil(Math.cbrt(targetVerts)));
  const maxCells = gridRes ** 3;
  const estimatedVerts = Math.min(originalVerts, maxCells);
  // Estimated tris after removing degenerates (rough: proportional to vert reduction)
  const vertRatio = estimatedVerts / (originalVerts || 1);
  const estimatedTris = Math.max(0, Math.round(originalTris * vertRatio * vertRatio));

  return { originalTris, estimatedTris, originalVerts, estimatedVerts, ratio };
}
