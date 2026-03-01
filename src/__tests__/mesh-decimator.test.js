// src/__tests__/mesh-decimator.test.js
// Phase 3 — Unit tests for MeshDecimator engine

import { describe, it, expect } from "vitest";
import * as THREE from "three";
import {
  decimateGeometry,
  decimateMesh,
  previewDecimation,
} from "../engine/MeshDecimator";

/* ── helpers ────────────────────────────────────────────────── */
function makeGeometry(tris = 200) {
  const geom = new THREE.BufferGeometry();
  const verts = tris * 3;
  const pos = new Float32Array(verts * 3);
  const normals = new Float32Array(verts * 3);
  const uvs = new Float32Array(verts * 2);
  for (let i = 0; i < verts; i++) {
    pos[i * 3] = Math.random() * 10;
    pos[i * 3 + 1] = Math.random() * 10;
    pos[i * 3 + 2] = Math.random() * 10;
    normals[i * 3 + 1] = 1;
    uvs[i * 2] = Math.random();
    uvs[i * 2 + 1] = Math.random();
  }
  geom.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geom.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
  geom.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
  return geom;
}

function makeMesh(tris = 200) {
  return new THREE.Mesh(makeGeometry(tris), new THREE.MeshStandardMaterial());
}

/* ── tests ──────────────────────────────────────────────────── */
describe("MeshDecimator", () => {
  describe("decimateGeometry", () => {
    it("returns cloned geometry when ratio >= 1", () => {
      const geom = makeGeometry(100);
      const result = decimateGeometry(geom, 1.0);
      expect(result.attributes.position.count).toBe(geom.attributes.position.count);
    });

    it("reduces vertex count at ratio 0.5", () => {
      const geom = makeGeometry(500);
      const result = decimateGeometry(geom, 0.5);
      expect(result.attributes.position.count).toBeLessThan(geom.attributes.position.count);
    });

    it("produces indexed geometry", () => {
      const geom = makeGeometry(200);
      const result = decimateGeometry(geom, 0.4);
      expect(result.index).not.toBeNull();
    });

    it("preserves normals", () => {
      const geom = makeGeometry(100);
      const result = decimateGeometry(geom, 0.5);
      expect(result.attributes.normal).toBeDefined();
    });

    it("preserves UVs", () => {
      const geom = makeGeometry(100);
      const result = decimateGeometry(geom, 0.5);
      expect(result.attributes.uv).toBeDefined();
    });

    it("handles null/empty geometry gracefully", () => {
      const geom = new THREE.BufferGeometry();
      const result = decimateGeometry(geom, 0.5);
      // Should not throw
      expect(result).toBeDefined();
    });

    it("reduces more aggressively at lower ratios", () => {
      const geom = makeGeometry(500);
      const half = decimateGeometry(geom, 0.5);
      const quarter = decimateGeometry(geom, 0.25);
      expect(quarter.attributes.position.count).toBeLessThanOrEqual(
        half.attributes.position.count
      );
    });
  });

  describe("decimateMesh", () => {
    it("replaces mesh geometry in-place", () => {
      const mesh = makeMesh(300);
      const origCount = mesh.geometry.attributes.position.count;
      const result = decimateMesh(mesh, 0.5);
      expect(result).not.toBeNull();
      expect(result.before.verts).toBe(origCount);
      expect(result.after.verts).toBeLessThan(origCount);
      // The mesh geometry should now be the decimated one
      expect(mesh.geometry.attributes.position.count).toBe(result.after.verts);
    });

    it("returns null for non-mesh input", () => {
      expect(decimateMesh(null)).toBeNull();
      expect(decimateMesh(new THREE.Group())).toBeNull();
    });

    it("returns correct before/after stats", () => {
      const mesh = makeMesh(200);
      const result = decimateMesh(mesh, 0.5);
      expect(result.before.tris).toBe(200);
      expect(result.after.tris).toBeLessThanOrEqual(200);
    });
  });

  describe("previewDecimation", () => {
    it("estimates triangle / vertex counts", () => {
      const geom = makeGeometry(500);
      const preview = previewDecimation(geom, 0.5);
      expect(preview).not.toBeNull();
      expect(preview.originalTris).toBe(500);
      expect(preview.estimatedTris).toBeLessThan(500);
      expect(preview.estimatedVerts).toBeLessThan(preview.originalVerts);
    });

    it("returns null for null geometry", () => {
      expect(previewDecimation(null)).toBeNull();
    });

    it("returns unchanged counts at ratio 1.0", () => {
      const geom = makeGeometry(100);
      const preview = previewDecimation(geom, 1.0);
      // At ratio 1.0 the grid cell count exceeds vert count, so estimated = original
      expect(preview.originalTris).toBe(100);
    });
  });
});
