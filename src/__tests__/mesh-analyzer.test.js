// src/__tests__/mesh-analyzer.test.js
// Phase 3 — Unit tests for MeshAnalyzer engine

import { describe, it, expect } from "vitest";
import * as THREE from "three";
import {
  analyzeMesh,
  analyzeScene,
  collectMeshes,
  analyzeUVs,
  suggestUVStrategy,
} from "../engine/MeshAnalyzer";

/* ── helpers ────────────────────────────────────────────────── */
function makeMesh(tris = 100, withUV = true, withNormals = true) {
  const geom = new THREE.BufferGeometry();
  const verts = tris * 3;
  const pos = new Float32Array(verts * 3);
  for (let i = 0; i < verts; i++) {
    pos[i * 3] = Math.random() * 10;
    pos[i * 3 + 1] = Math.random() * 10;
    pos[i * 3 + 2] = Math.random() * 10;
  }
  geom.setAttribute("position", new THREE.BufferAttribute(pos, 3));

  if (withNormals) {
    const norms = new Float32Array(verts * 3);
    for (let i = 0; i < verts; i++) { norms[i * 3 + 1] = 1; }
    geom.setAttribute("normal", new THREE.BufferAttribute(norms, 3));
  }
  if (withUV) {
    const uvs = new Float32Array(verts * 2);
    for (let i = 0; i < verts; i++) {
      uvs[i * 2] = Math.random();
      uvs[i * 2 + 1] = Math.random();
    }
    geom.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
  }

  return new THREE.Mesh(geom, new THREE.MeshStandardMaterial({ color: 0xff0000 }));
}

function makeIndexedMesh(tris = 100) {
  const geom = new THREE.BufferGeometry();
  const uniqueVerts = Math.max(3, Math.ceil(tris * 1.5));
  const pos = new Float32Array(uniqueVerts * 3);
  for (let i = 0; i < uniqueVerts; i++) {
    pos[i * 3] = Math.random() * 5;
    pos[i * 3 + 1] = Math.random() * 5;
    pos[i * 3 + 2] = Math.random() * 5;
  }
  geom.setAttribute("position", new THREE.BufferAttribute(pos, 3));

  const indices = [];
  for (let t = 0; t < tris; t++) {
    indices.push(
      t % uniqueVerts,
      (t + 1) % uniqueVerts,
      (t + 2) % uniqueVerts
    );
  }
  geom.setIndex(indices);
  return new THREE.Mesh(geom, new THREE.MeshBasicMaterial());
}

/* ── tests ──────────────────────────────────────────────────── */
describe("MeshAnalyzer", () => {
  describe("collectMeshes", () => {
    it("finds all meshes in a tree", () => {
      const group = new THREE.Group();
      group.add(makeMesh(10));
      group.add(makeMesh(20));
      const child = new THREE.Group();
      child.add(makeMesh(5));
      group.add(child);
      expect(collectMeshes(group)).toHaveLength(3);
    });

    it("returns empty for null / non-mesh", () => {
      expect(collectMeshes(null)).toEqual([]);
      expect(collectMeshes(new THREE.Group())).toEqual([]);
    });
  });

  describe("analyzeMesh", () => {
    it("returns correct stats for a non-indexed mesh", () => {
      const mesh = makeMesh(50, true, true);
      mesh.name = "TestBox";
      const info = analyzeMesh(mesh);
      expect(info).not.toBeNull();
      expect(info.name).toBe("TestBox");
      expect(info.triangles).toBe(50);
      expect(info.vertices).toBe(150);
      expect(info.indexed).toBe(false);
      expect(info.hasNormals).toBe(true);
      expect(info.hasUV).toBe(true);
      expect(info.materialType).toBe("MeshStandardMaterial");
    });

    it("handles indexed geometry", () => {
      const mesh = makeIndexedMesh(80);
      const info = analyzeMesh(mesh);
      expect(info.triangles).toBe(80);
      expect(info.indexed).toBe(true);
    });

    it("returns null for non-mesh input", () => {
      expect(analyzeMesh(null)).toBeNull();
      expect(analyzeMesh(new THREE.Group())).toBeNull();
    });

    it("detects missing UVs", () => {
      const mesh = makeMesh(10, false, true);
      const info = analyzeMesh(mesh);
      expect(info.hasUV).toBe(false);
      expect(info.uvAnalysis).toBeNull();
    });

    it("includes UV analysis when UVs exist", () => {
      const mesh = makeMesh(100, true, true);
      const info = analyzeMesh(mesh);
      expect(info.uvAnalysis).not.toBeNull();
      expect(typeof info.uvAnalysis.coverage).toBe("number");
      expect(typeof info.uvAnalysis.overlapEstimate).toBe("number");
    });
  });

  describe("analyzeScene", () => {
    it("aggregates mesh stats across scene objects", () => {
      const objs = [makeMesh(100), makeMesh(200)];
      const result = analyzeScene(objs);
      expect(result.meshCount).toBe(2);
      expect(result.totalTriangles).toBe(300);
      expect(result.totalVertices).toBe(900);
    });

    it("returns zeros for empty scene", () => {
      const result = analyzeScene([]);
      expect(result.meshCount).toBe(0);
      expect(result.totalTriangles).toBe(0);
    });

    it("flags high-poly meshes", () => {
      const mesh = makeMesh(200000);
      const result = analyzeScene([mesh]);
      const warnings = result.issues.filter((i) => i.severity === "warning");
      expect(warnings.length).toBeGreaterThan(0);
    });
  });

  describe("analyzeUVs", () => {
    it("returns null for geometry without UVs", () => {
      const geom = new THREE.BufferGeometry();
      geom.setAttribute("position", new THREE.BufferAttribute(new Float32Array(9), 3));
      expect(analyzeUVs(geom)).toBeNull();
    });

    it("detects out-of-bounds UVs", () => {
      const geom = new THREE.BufferGeometry();
      const pos = new Float32Array(9);
      geom.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      // Put UVs way out of bounds
      const uvs = new Float32Array([2, 2, -1, -1, 5, 5]);
      geom.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
      const analysis = analyzeUVs(geom);
      expect(analysis.outOfBoundsPercent).toBeGreaterThan(0);
    });
  });

  describe("suggestUVStrategy", () => {
    it("suggests planar projection for flat meshes", () => {
      const geom = new THREE.PlaneGeometry(10, 10);
      // Remove existing UVs to trigger projection suggestion
      geom.deleteAttribute("uv");
      const mesh = new THREE.Mesh(geom, new THREE.MeshBasicMaterial());
      const result = suggestUVStrategy(mesh);
      expect(result).not.toBeNull();
      expect(result.shapeProfile).toBe("flat");
      expect(result.hints.some((h) => h.method === "planar")).toBe(true);
    });

    it("returns hints for meshes with UVs", () => {
      const mesh = makeMesh(100, true);
      const result = suggestUVStrategy(mesh);
      expect(result).not.toBeNull();
      expect(result.hasExistingUV).toBe(true);
    });

    it("returns null for non-mesh input", () => {
      expect(suggestUVStrategy(null)).toBeNull();
    });
  });
});
