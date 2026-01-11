// src/utils/validator.js
import * as THREE from "three";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils";

/*
  Lightweight client-side mesh validator.
  Returns a report: [{ name, uuid, issues: [...] }]
*/

const EPS_AREA = 1e-8;
const LARGE_TRIANGLE_COUNT = 200000; // tune for warning
const SMALL_BBOX = 1e-3;
const LARGE_BBOX = 1000;

function getPosAttr(geom) {
  return geom.attributes?.position || null;
}
function getIndexAttr(geom) {
  return geom.index || null;
}

function triCount(geom) {
  const idx = getIndexAttr(geom);
  if (idx) return idx.count / 3;
  const pos = getPosAttr(geom);
  return pos ? pos.count / 3 : 0;
}

function areaOfTriangle(a, b, c) {
  const v0 = new THREE.Vector3(), v1 = new THREE.Vector3(), cross = new THREE.Vector3();
  v0.subVectors(b, a);
  v1.subVectors(c, a);
  cross.crossVectors(v0, v1);
  return 0.5 * cross.length();
}

function computeZeroAreaFaces(geom) {
  const positions = geom.attributes.position.array;
  const idx = geom.index ? geom.index.array : null;
  const zeroFaces = [];
  if (!positions) return zeroFaces;

  const getV = (i, target) => {
    const offset = i * 3;
    target.set(positions[offset], positions[offset + 1], positions[offset + 2]);
  };

  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  if (idx) {
    for (let i = 0; i < idx.length; i += 3) {
      getV(idx[i], a); getV(idx[i+1], b); getV(idx[i+2], c);
      if (areaOfTriangle(a, b, c) <= EPS_AREA) zeroFaces.push(i / 3);
    }
  } else {
    for (let i = 0; i < positions.length; i += 9) {
      a.set(positions[i], positions[i+1], positions[i+2]);
      b.set(positions[i+3], positions[i+4], positions[i+5]);
      c.set(positions[i+6], positions[i+7], positions[i+8]);
      if (areaOfTriangle(a, b, c) <= EPS_AREA) zeroFaces.push(i/9);
    }
  }
  return zeroFaces;
}

function findDuplicateVertices(geom) {
  const pos = geom.attributes.position;
  if (!pos) return 0;
  const map = new Map();
  let dupCount = 0;
  for (let i = 0; i < pos.count; i++) {
    const key = `${pos.getX(i).toFixed(6)}|${pos.getY(i).toFixed(6)}|${pos.getZ(i).toFixed(6)}`;
    if (map.has(key)) dupCount++;
    else map.set(key, i);
  }
  return dupCount;
}

function computeNonManifoldEdges(geom) {
  // edges map: "minIdx-maxIdx" -> count
  const edges = new Map();
  const idx = geom.index ? geom.index.array : null;
  if (!idx) return { boundaryEdges: 0, nonManifoldEdges: 0 };

  for (let i = 0; i < idx.length; i += 3) {
    const a = idx[i], b = idx[i+1], c = idx[i+2];
    const faceEdges = [[a,b],[b,c],[c,a]];
    for (const [u,v] of faceEdges) {
      const [mn, mx] = u < v ? [u, v] : [v, u];
      const k = `${mn}-${mx}`;
      edges.set(k, (edges.get(k) || 0) + 1);
    }
  }
  let boundary = 0, nonManifold = 0;
  for (const count of edges.values()) {
    if (count === 1) boundary++;
    else if (count > 2) nonManifold++;
  }
  return { boundaryEdges: boundary, nonManifoldEdges: nonManifold };
}

function hasUVs(geom) {
  return !!(geom.attributes && geom.attributes.uv);
}

function hasNormals(geom) {
  return !!(geom.attributes && geom.attributes.normal);
}

function simpleSkinnedMeshCheck(obj) {
  if (!obj.isSkinnedMesh) return null;
  const skeleton = obj.skeleton;
  if (!skeleton) return { code: 'skinned-missing-skeleton', severity: 'error', message: 'Skinned mesh missing skeleton' };
  if (skeleton.bones.length > 128) return { code: 'skinned-many-bones', severity: 'warn', message: `High bone count: ${skeleton.bones.length}` };
  return null;
}

function analyzeMesh(mesh) {
  const issues = [];
  const geom = mesh.geometry;
  if (!geom) {
    issues.push({ code: 'no-geometry', severity: 'error', message: 'Mesh has no geometry', fixAvailable: false });
    return issues;
  }

  // triangle count
  const tris = triCount(geom);
  if (tris > LARGE_TRIANGLE_COUNT) issues.push({ code: 'large-triangle-count', severity: 'warn', message: `High triangle count: ${tris}`, fixAvailable: true });

  // normals
  if (!hasNormals(geom)) issues.push({ code: 'missing-normals', severity: 'warn', message: 'Missing normals', fixAvailable: true });

  // UVs
  if (!hasUVs(geom)) issues.push({ code: 'missing-uvs', severity: 'warn', message: 'Missing UV coordinates (no texture mapping)', fixAvailable: false });

  // material
  if (!mesh.material) issues.push({ code: 'missing-material', severity: 'warn', message: 'No material assigned', fixAvailable: false });
  else {
    // check if material expects a map but none set
    if ((mesh.material.map == null) && (mesh.material.userData && mesh.material.userData.expectTexture)) {
      issues.push({ code: 'missing-texture', severity: 'info', message: 'Material likely expects a texture but none found', fixAvailable: false });
    }
  }

  // zero area faces
  const zeroFaces = computeZeroAreaFaces(geom);
  if (zeroFaces.length) issues.push({ code: 'zero-area-faces', severity: 'error', message: `Zero-area / degenerate faces: ${zeroFaces.length}`, fixAvailable: true, detail: { sampleFaces: zeroFaces.slice(0,5) } });

  // duplicate vertices
  const dupVerts = findDuplicateVertices(geom);
  if (dupVerts > 0) issues.push({ code: 'duplicate-vertices', severity: 'warn', message: `Duplicate vertices detected: approx ${dupVerts}`, fixAvailable: true });

  // non-manifold / boundary edges
  if (geom.index) {
    const { boundaryEdges, nonManifoldEdges } = computeNonManifoldEdges(geom);
    if (boundaryEdges > 0) issues.push({ code: 'boundary-edges', severity: 'info', message: `Boundary edges: ${boundaryEdges}`, fixAvailable: false });
    if (nonManifoldEdges > 0) issues.push({ code: 'non-manifold-edges', severity: 'error', message: `Non-manifold edges: ${nonManifoldEdges}`, fixAvailable: false });
  }

  // bounding box
  const bbox = new THREE.Box3().setFromObject(mesh);
  const size = bbox.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z);
  if (maxDim > LARGE_BBOX) issues.push({ code: 'large-bbox', severity: 'warn', message: `Large bounding box (${maxDim.toFixed(3)}) — might be scale mismatch`, fixAvailable: false });
  if (maxDim > 0 && maxDim < SMALL_BBOX) issues.push({ code: 'small-bbox', severity: 'warn', message: `Very small object (${maxDim.toFixed(6)}) — might be scale mismatch`, fixAvailable: false });

  // skinned mesh quick checks
  const sk = simpleSkinnedMeshCheck(mesh);
  if (sk) issues.push(sk);

  return issues;
}

// ---------- Autofixes ----------
function fixRecomputeNormals(mesh) {
  try {
    const geom = mesh.geometry;
    if (!geom) return { ok: false, message: "No geometry" };
    geom.computeVertexNormals();
    geom.attributes.normal.needsUpdate = true;
    return { ok: true, message: "Recomputed normals" };
  } catch (e) { return { ok: false, message: String(e) }; }
}

function fixMergeVertices(mesh) {
  try {
    const geom = mesh.geometry;
    if (!geom) return { ok: false, message: "No geometry" };
    const merged = mergeVertices(geom, 1e-6);
    // mergeVertices returns a new geometry with attribute arrays; to keep original reference we copy attributes
    // but easiest is to replace geometry on mesh
    mesh.geometry = merged;
    return { ok: true, message: "Merged duplicate vertices" };
  } catch (e) { return { ok: false, message: String(e) }; }
}

function fixRemoveZeroAreaFaces(mesh) {
  try {
    const geom = mesh.geometry;
    if (!geom || !geom.index) return { ok: false, message: "No indexed geometry (skipped)" };
    const pos = geom.attributes.position.array;
    const idx = geom.index.array;
    const newIdx = [];
    const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
    for (let i = 0; i < idx.length; i += 3) {
      const iA = idx[i], iB = idx[i+1], iC = idx[i+2];
      const offA = iA * 3, offB = iB * 3, offC = iC * 3;
      a.set(pos[offA], pos[offA+1], pos[offA+2]);
      b.set(pos[offB], pos[offB+1], pos[offB+2]);
      c.set(pos[offC], pos[offC+1], pos[offC+2]);
      if (areaOfTriangle(a,b,c) > EPS_AREA) {
        newIdx.push(iA, iB, iC);
      }
    }
    geom.setIndex(newIdx);
    geom.index.needsUpdate = true;
    return { ok: true, message: `Removed ${ (idx.length/3) - (newIdx.length/3) } degenerate faces` };
  } catch (e) { return { ok: false, message: String(e) }; }
}

// ---------- Scene-level validator ----------
export function validateScene(scene) {
  if (!scene) return [];
  const userGroup = scene._user_group || scene._userGroup || scene;
  const list = (userGroup.children || []).slice();
  const report = [];

  for (const obj of list) {
    const entry = { name: obj.name || obj.uuid, uuid: obj.uuid, type: obj.type, issues: [] };
    // recursively analyze meshes inside
    obj.traverse((child) => {
      if (child.isMesh) {
        const iss = analyzeMesh(child);
        if (iss.length) {
          entry.issues.push({ mesh: child.name || child.uuid, issues: iss });
        }
      }
    });
    if (entry.issues.length) report.push(entry);
  }
  return report;
}

export const fixes = {
  recomputeNormals: fixRecomputeNormals,
  mergeVertices: fixMergeVertices,
  removeZeroAreaFaces: fixRemoveZeroAreaFaces,
};

export default {
  validateScene,
  fixes,
};
