// src/__tests__/lod-generator.test.js
// Phase 3 — Unit tests for LODGenerator engine

import { describe, it, expect } from "vitest";
import * as THREE from "three";
import {
  LOD_TIERS,
  previewLODTiers,
  generateLOD,
  replaceMeshWithLOD,
  revertLODToMesh,
} from "../engine/LODGenerator";

/* ── helpers ────────────────────────────────────────────────── */
function makeTestMesh(tris = 200) {
  const geom = new THREE.BufferGeometry();
  const verts = tris * 3;
  const pos = new Float32Array(verts * 3);
  for (let i = 0; i < verts; i++) {
    pos[i * 3] = Math.random() * 10;
    pos[i * 3 + 1] = Math.random() * 10;
    pos[i * 3 + 2] = Math.random() * 10;
  }
  geom.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const normals = new Float32Array(verts * 3);
  for (let i = 0; i < verts; i++) normals[i * 3 + 1] = 1;
  geom.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
  const mesh = new THREE.Mesh(geom, new THREE.MeshStandardMaterial({ color: 0x00ff00 }));
  mesh.name = "TestMesh";
  mesh.castShadow = true;
  return mesh;
}

/* ── tests ──────────────────────────────────────────────────── */
describe("LODGenerator", () => {
  describe("LOD_TIERS", () => {
    it("has 4 tiers with increasing distances", () => {
      expect(LOD_TIERS).toHaveLength(4);
      for (let i = 1; i < LOD_TIERS.length; i++) {
        expect(LOD_TIERS[i].distance).toBeGreaterThan(LOD_TIERS[i - 1].distance);
      }
    });

    it("has first tier at ratio 1.0 (full detail)", () => {
      expect(LOD_TIERS[0].ratio).toBe(1.0);
    });
  });

  describe("previewLODTiers", () => {
    it("returns tier previews with estimated tri counts", () => {
      const mesh = makeTestMesh(500);
      const preview = previewLODTiers(mesh.geometry);
      expect(preview).toHaveLength(4);
      // First tier (full) should have originalTris = 500
      expect(preview[0].originalTris).toBe(500);
      // Lower tiers should have fewer estimated tris
      expect(preview[2].estimatedTris).toBeLessThanOrEqual(preview[0].estimatedTris);
      expect(preview[3].estimatedTris).toBeLessThanOrEqual(preview[2].estimatedTris);
    });

    it("returns empty for null geometry", () => {
      expect(previewLODTiers(null)).toEqual([]);
    });
  });

  describe("generateLOD", () => {
    it("creates a THREE.LOD with correct number of levels", () => {
      const mesh = makeTestMesh(300);
      const result = generateLOD(mesh);
      expect(result).not.toBeNull();
      expect(result.lod).toBeInstanceOf(THREE.LOD);
      expect(result.tiers).toHaveLength(4);
    });

    it("copies position/rotation/scale from source mesh", () => {
      const mesh = makeTestMesh(100);
      mesh.position.set(5, 10, 15);
      mesh.rotation.set(0.5, 1.0, 0.2);
      mesh.scale.set(2, 2, 2);
      const result = generateLOD(mesh);
      const lod = result.lod;
      expect(lod.position.x).toBeCloseTo(5);
      expect(lod.position.y).toBeCloseTo(10);
      expect(lod.rotation.x).toBeCloseTo(0.5);
      expect(lod.scale.x).toBeCloseTo(2);
    });

    it("highest LOD has same tri count as original", () => {
      const mesh = makeTestMesh(200);
      const result = generateLOD(mesh);
      // First tier is ratio 1.0 = clone
      expect(result.tiers[0].triangles).toBe(200);
    });

    it("lower tiers have fewer triangles", () => {
      const mesh = makeTestMesh(500);
      const result = generateLOD(mesh);
      expect(result.tiers[2].triangles).toBeLessThan(result.tiers[0].triangles);
    });

    it("returns null for non-mesh input", () => {
      expect(generateLOD(null)).toBeNull();
      expect(generateLOD(new THREE.Group())).toBeNull();
    });
  });

  describe("replaceMeshWithLOD", () => {
    it("replaces mesh in parent with LOD", () => {
      const parent = new THREE.Group();
      const mesh = makeTestMesh(200);
      parent.add(mesh);
      expect(parent.children).toHaveLength(1);

      const result = replaceMeshWithLOD(mesh, parent);
      expect(result).not.toBeNull();
      expect(parent.children).toHaveLength(1);
      expect(parent.children[0]).toBeInstanceOf(THREE.LOD);
    });

    it("returns null for non-mesh input", () => {
      expect(replaceMeshWithLOD(null, new THREE.Group())).toBeNull();
    });
  });

  describe("revertLODToMesh", () => {
    it("converts LOD back to a mesh", () => {
      const mesh = makeTestMesh(200);
      const parent = new THREE.Group();
      parent.add(mesh);
      replaceMeshWithLOD(mesh, parent);

      const lodObj = parent.children[0];
      expect(lodObj).toBeInstanceOf(THREE.LOD);

      const reverted = revertLODToMesh(lodObj);
      expect(reverted).toBeInstanceOf(THREE.Mesh);
      expect(reverted.name).toBe("TestMesh");
    });

    it("returns null for non-LOD input", () => {
      expect(revertLODToMesh(null)).toBeNull();
      expect(revertLODToMesh(new THREE.Mesh())).toBeNull();
    });
  });
});
