// src/__tests__/export-pipeline.test.js
// Phase 4 — ExportPipeline engine tests

import { describe, it, expect } from "vitest";
import * as THREE from "three";
import {
  estimateExportSize,
  stripMetadata,
  prepareExportGroup,
  formatBytes,
  EXPORT_PRESETS,
} from "../engine/ExportPipeline";

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

function makeMesh(name, tris = 100) {
  const geom = makeGeometry(tris);
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff });
  const mesh = new THREE.Mesh(geom, mat);
  mesh.name = name;
  return mesh;
}

/* ═══════════════════════════════════════════════════════════════
   estimateExportSize
   ═══════════════════════════════════════════════════════════════ */
describe("estimateExportSize", () => {
  it("returns zero for empty scene", () => {
    const est = estimateExportSize([]);
    expect(est.totalBytes).toBe(0);
    expect(est.meshCount).toBe(0);
  });

  it("estimates geometry size for a mesh", () => {
    const est = estimateExportSize([makeMesh("Cube", 100)]);
    expect(est.totalBytes).toBeGreaterThan(0);
    expect(est.geometryBytes).toBeGreaterThan(0);
    expect(est.meshCount).toBe(1);
    expect(est.breakdown.length).toBe(1);
  });

  it("does not double-count shared geometries", () => {
    const sharedGeom = makeGeometry(100);
    const m1 = new THREE.Mesh(sharedGeom, new THREE.MeshStandardMaterial());
    const m2 = new THREE.Mesh(sharedGeom, new THREE.MeshStandardMaterial());
    m1.name = "M1";
    m2.name = "M2";
    const est = estimateExportSize([m1, m2]);
    // Only one geometry should be counted
    expect(est.breakdown.filter((b) => b.geometryBytes > 0).length).toBe(1);
  });
});

/* ═══════════════════════════════════════════════════════════════
   stripMetadata
   ═══════════════════════════════════════════════════════════════ */
describe("stripMetadata", () => {
  it("removes editor metadata", () => {
    const mesh = makeMesh("A", 10);
    mesh.userData = {
      _internal: true,
      __helper: true,
      debugInfo: "test",
      editorData: { foo: 1 },
      animation: "keep-this",
    };
    const result = stripMetadata([mesh]);
    expect(result.cleaned).toBe(4); // 4 keys removed
    expect(mesh.userData.animation).toBe("keep-this");
    expect(mesh.userData._internal).toBeUndefined();
  });

  it("handles objects with no userData", () => {
    const mesh = makeMesh("B", 10);
    mesh.userData = {};
    const result = stripMetadata([mesh]);
    expect(result.cleaned).toBe(0);
  });
});

/* ═══════════════════════════════════════════════════════════════
   prepareExportGroup
   ═══════════════════════════════════════════════════════════════ */
describe("prepareExportGroup", () => {
  it("clones visible objects into export group", () => {
    const meshes = [makeMesh("A", 10), makeMesh("B", 20)];
    const group = prepareExportGroup(meshes);
    expect(group.name).toBe("ExportRoot");
    expect(group.children.length).toBe(2);
  });

  it("excludes invisible objects by default", () => {
    const m1 = makeMesh("Visible", 10);
    const m2 = makeMesh("Invisible", 10);
    m2.visible = false;
    const group = prepareExportGroup([m1, m2]);
    expect(group.children.length).toBe(1);
  });

  it("includes invisible when option set", () => {
    const m1 = makeMesh("Visible", 10);
    const m2 = makeMesh("Invisible", 10);
    m2.visible = false;
    const group = prepareExportGroup([m1, m2], { includeInvisible: true });
    expect(group.children.length).toBe(2);
  });

  it("filters out helper objects", () => {
    const m1 = makeMesh("Good", 10);
    const helper = new THREE.AxesHelper(1);
    const group = prepareExportGroup([m1, helper]);
    expect(group.children.length).toBe(1);
  });
});

/* ═══════════════════════════════════════════════════════════════
   formatBytes
   ═══════════════════════════════════════════════════════════════ */
describe("formatBytes", () => {
  it("formats bytes correctly", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(1024)).toBe("1 KB");
    expect(formatBytes(1048576)).toBe("1 MB");
    expect(formatBytes(1500)).toBe("1.46 KB");
  });
});

/* ═══════════════════════════════════════════════════════════════
   EXPORT_PRESETS
   ═══════════════════════════════════════════════════════════════ */
describe("EXPORT_PRESETS", () => {
  it("contains all expected presets", () => {
    expect(EXPORT_PRESETS).toHaveProperty("high");
    expect(EXPORT_PRESETS).toHaveProperty("medium");
    expect(EXPORT_PRESETS).toHaveProperty("low");
    expect(EXPORT_PRESETS).toHaveProperty("web");
  });

  it("each preset has required fields", () => {
    for (const [, preset] of Object.entries(EXPORT_PRESETS)) {
      expect(preset).toHaveProperty("label");
      expect(preset).toHaveProperty("description");
      expect(preset).toHaveProperty("maxTextureSize");
    }
  });
});
