// src/__tests__/scene-optimizer.test.js
// Phase 4 — SceneOptimizer engine tests

import { describe, it, expect } from "vitest";
import * as THREE from "three";
import {
  getSceneStats,
  findDuplicateGeometries,
  findDuplicateMaterials,
  deduplicateMaterials,
  checkPerformanceBudget,
  getOptimizationRecommendations,
  collectAllMeshes,
  analyzeTextures,
} from "../engine/SceneOptimizer";

/* ── Factories ─────────────────────────────────────────────── */
function makeGeometry(tris = 100) {
  const count = tris * 3;
  const geom = new THREE.BufferGeometry();
  const pos = new Float32Array(count * 3);
  for (let i = 0; i < pos.length; i++) pos[i] = Math.random();
  geom.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geom.setIndex(Array.from({ length: count }, (_, i) => i));
  return geom;
}

function makeMesh(name, tris = 100, opts = {}) {
  const geom = makeGeometry(tris);
  const mat = new THREE.MeshStandardMaterial({
    color: opts.color ?? 0xffffff,
    roughness: opts.roughness ?? 0.5,
    metalness: opts.metalness ?? 0.0,
  });
  const mesh = new THREE.Mesh(geom, mat);
  mesh.name = name;
  return mesh;
}

function makeScene(lights = []) {
  const scene = new THREE.Scene();
  for (const l of lights) scene.add(l);
  return scene;
}

/* ═══════════════════════════════════════════════════════════════
   getSceneStats
   ═══════════════════════════════════════════════════════════════ */
describe("getSceneStats", () => {
  it("returns zeroes for an empty scene", () => {
    const stats = getSceneStats([], makeScene());
    expect(stats.meshCount).toBe(0);
    expect(stats.triangles).toBe(0);
    expect(stats.vertices).toBe(0);
  });

  it("counts meshes, tris, and verts correctly", () => {
    const meshes = [makeMesh("A", 200), makeMesh("B", 300)];
    const stats = getSceneStats(meshes, makeScene());
    expect(stats.meshCount).toBe(2);
    expect(stats.triangles).toBe(500);
    expect(stats.vertices).toBe(200 * 3 + 300 * 3);
    expect(stats.drawCalls).toBe(2);
  });

  it("counts lights when scene is provided", () => {
    const light1 = new THREE.PointLight(0xffffff, 1);
    const light2 = new THREE.DirectionalLight(0xffffff, 0.5);
    const scene = makeScene([light1, light2]);
    const stats = getSceneStats([makeMesh("X", 10)], scene);
    expect(stats.lights).toBe(2);
  });

  it("counts unique materials", () => {
    const mat = new THREE.MeshStandardMaterial({ color: 0xff0000 });
    const m1 = new THREE.Mesh(makeGeometry(10), mat);
    const m2 = new THREE.Mesh(makeGeometry(10), mat);
    m1.name = "M1";
    m2.name = "M2";
    const stats = getSceneStats([m1, m2], makeScene());
    expect(stats.uniqueMaterials).toBe(1); // same material ref
  });
});

/* ═══════════════════════════════════════════════════════════════
   findDuplicateGeometries
   ═══════════════════════════════════════════════════════════════ */
describe("findDuplicateGeometries", () => {
  it("returns empty for unique geometries", () => {
    const meshes = [makeMesh("A", 100), makeMesh("B", 200)];
    const dups = findDuplicateGeometries(meshes);
    expect(dups.length).toBe(0);
  });

  it("detects meshes sharing the same geometry", () => {
    const sharedGeom = makeGeometry(100);
    const m1 = new THREE.Mesh(sharedGeom, new THREE.MeshStandardMaterial());
    const m2 = new THREE.Mesh(sharedGeom, new THREE.MeshStandardMaterial());
    m1.name = "Clone1";
    m2.name = "Clone2";
    const dups = findDuplicateGeometries([m1, m2]);
    expect(dups.length).toBe(1);
    expect(dups[0].meshes.length).toBe(2);
  });
});

/* ═══════════════════════════════════════════════════════════════
   findDuplicateMaterials
   ═══════════════════════════════════════════════════════════════ */
describe("findDuplicateMaterials", () => {
  it("returns empty when all materials differ", () => {
    const m1 = makeMesh("A", 10, { color: 0xff0000 });
    const m2 = makeMesh("B", 10, { color: 0x00ff00 });
    const dups = findDuplicateMaterials([m1, m2]);
    expect(dups.length).toBe(0);
  });

  it("detects identical materials on different meshes", () => {
    const mat1 = new THREE.MeshStandardMaterial({ color: 0xaabbcc, roughness: 0.5, metalness: 0.0 });
    const mat2 = new THREE.MeshStandardMaterial({ color: 0xaabbcc, roughness: 0.5, metalness: 0.0 });
    const m1 = new THREE.Mesh(makeGeometry(10), mat1);
    const m2 = new THREE.Mesh(makeGeometry(10), mat2);
    m1.name = "M1";
    m2.name = "M2";
    const dups = findDuplicateMaterials([m1, m2]);
    expect(dups.length).toBe(1);
    expect(dups[0].materials.length).toBe(2);
  });
});

/* ═══════════════════════════════════════════════════════════════
   deduplicateMaterials
   ═══════════════════════════════════════════════════════════════ */
describe("deduplicateMaterials", () => {
  it("merges identical materials in-place", () => {
    const mat1 = new THREE.MeshStandardMaterial({ color: 0xaabbcc, roughness: 0.5, metalness: 0.0 });
    const mat2 = new THREE.MeshStandardMaterial({ color: 0xaabbcc, roughness: 0.5, metalness: 0.0 });
    const m1 = new THREE.Mesh(makeGeometry(10), mat1);
    const m2 = new THREE.Mesh(makeGeometry(10), mat2);
    m1.name = "M1";
    m2.name = "M2";
    expect(m1.material).not.toBe(m2.material); // different refs before
    const result = deduplicateMaterials([m1, m2]);
    expect(result.merged).toBe(1);
    expect(m1.material).toBe(m2.material); // same ref after
  });

  it("does nothing when materials are already unique", () => {
    const m1 = makeMesh("A", 10, { color: 0xff0000 });
    const m2 = makeMesh("B", 10, { color: 0x00ff00 });
    const result = deduplicateMaterials([m1, m2]);
    expect(result.merged).toBe(0);
  });
});

/* ═══════════════════════════════════════════════════════════════
   checkPerformanceBudget
   ═══════════════════════════════════════════════════════════════ */
describe("checkPerformanceBudget", () => {
  it("returns 100% score for a simple scene", () => {
    const meshes = [makeMesh("Cube", 12)];
    const result = checkPerformanceBudget(meshes, makeScene());
    expect(result.score).toBe(100);
    expect(result.details.every((d) => d.ok)).toBe(true);
  });

  it("flags exceeded budgets", () => {
    const meshes = [makeMesh("Heavy", 1000)];
    const result = checkPerformanceBudget(meshes, makeScene(), { triangles: 500 });
    expect(result.score).toBeLessThan(100);
    const triDetail = result.details.find((d) => d.category === "Triangles");
    expect(triDetail.ok).toBe(false);
  });
});

/* ═══════════════════════════════════════════════════════════════
   getOptimizationRecommendations
   ═══════════════════════════════════════════════════════════════ */
describe("getOptimizationRecommendations", () => {
  it("returns well-optimized for simple scenes", () => {
    const recs = getOptimizationRecommendations([makeMesh("X", 100)], makeScene());
    expect(recs.length).toBe(1);
    expect(recs[0]).toMatch(/well-optimized/i);
  });

  it("recommends instancing for duplicate geometries", () => {
    const sharedGeom = makeGeometry(100);
    const m1 = new THREE.Mesh(sharedGeom, new THREE.MeshStandardMaterial());
    const m2 = new THREE.Mesh(sharedGeom, new THREE.MeshStandardMaterial());
    const recs = getOptimizationRecommendations([m1, m2], makeScene());
    const inst = recs.find((r) => r.includes("duplicate") || r.includes("Instance"));
    expect(inst).toBeTruthy();
  });
});

/* ═══════════════════════════════════════════════════════════════
   collectAllMeshes
   ═══════════════════════════════════════════════════════════════ */
describe("collectAllMeshes", () => {
  it("collects meshes from nested groups", () => {
    const group = new THREE.Group();
    group.add(makeMesh("Inner1", 10));
    group.add(makeMesh("Inner2", 20));
    const meshes = collectAllMeshes([group]);
    expect(meshes.length).toBe(2);
  });
});
