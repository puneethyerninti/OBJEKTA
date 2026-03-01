// src/__tests__/material-library.test.js
// Phase 6 — MaterialLibrary engine tests

import { describe, it, expect } from "vitest";
import * as THREE from "three";
import {
  MATERIAL_CATEGORIES,
  MATERIAL_PRESETS,
  getAllPresets,
  getPresetsByCategory,
  getPreset,
  searchPresets,
  buildMaterial,
  applyPreset,
  rollbackPreset,
  extractMaterialParams,
  createCustomPreset,
} from "../engine/MaterialLibrary";

/* ═══════════════════════════════════════════════════════════════════════
   MATERIAL_CATEGORIES
   ═══════════════════════════════════════════════════════════════════ */
describe("MATERIAL_CATEGORIES", () => {
  it("is a non-empty array of category objects", () => {
    expect(Array.isArray(MATERIAL_CATEGORIES)).toBe(true);
    expect(MATERIAL_CATEGORIES.length).toBeGreaterThanOrEqual(8);
  });

  it("each category has id, label, and icon", () => {
    for (const cat of MATERIAL_CATEGORIES) {
      expect(cat).toHaveProperty("id");
      expect(cat).toHaveProperty("label");
      expect(cat).toHaveProperty("icon");
      expect(typeof cat.id).toBe("string");
    }
  });

  it("has unique category ids", () => {
    const ids = MATERIAL_CATEGORIES.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

/* ═══════════════════════════════════════════════════════════════════════
   MATERIAL_PRESETS
   ═══════════════════════════════════════════════════════════════════ */
describe("MATERIAL_PRESETS", () => {
  it("contains 40+ presets", () => {
    expect(MATERIAL_PRESETS.length).toBeGreaterThanOrEqual(40);
  });

  it("each preset has required fields", () => {
    for (const p of MATERIAL_PRESETS) {
      expect(p).toHaveProperty("id");
      expect(p).toHaveProperty("name");
      expect(p).toHaveProperty("category");
      expect(p).toHaveProperty("tags");
      expect(p).toHaveProperty("params");
      expect(Array.isArray(p.tags)).toBe(true);
    }
  });

  it("every preset category exists in MATERIAL_CATEGORIES", () => {
    const catIds = new Set(MATERIAL_CATEGORIES.map((c) => c.id));
    for (const p of MATERIAL_PRESETS) {
      expect(catIds.has(p.category)).toBe(true);
    }
  });

  it("has unique preset ids", () => {
    const ids = MATERIAL_PRESETS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("each preset has a color param", () => {
    for (const p of MATERIAL_PRESETS) {
      expect(p.params).toHaveProperty("color");
    }
  });
});

/* ═══════════════════════════════════════════════════════════════════════
   getAllPresets
   ═══════════════════════════════════════════════════════════════════ */
describe("getAllPresets", () => {
  it("returns same set as MATERIAL_PRESETS", () => {
    expect(getAllPresets()).toEqual(MATERIAL_PRESETS);
  });
});

/* ═══════════════════════════════════════════════════════════════════════
   getPresetsByCategory
   ═══════════════════════════════════════════════════════════════════ */
describe("getPresetsByCategory", () => {
  it("returns only presets from the given category", () => {
    const metals = getPresetsByCategory("metals");
    expect(metals.length).toBeGreaterThan(0);
    for (const p of metals) {
      expect(p.category).toBe("metals");
    }
  });

  it("returns empty array for unknown category", () => {
    expect(getPresetsByCategory("nonexistent")).toEqual([]);
  });

  it("covers every category", () => {
    for (const cat of MATERIAL_CATEGORIES) {
      const items = getPresetsByCategory(cat.id);
      expect(items.length).toBeGreaterThan(0);
    }
  });
});

/* ═══════════════════════════════════════════════════════════════════════
   getPreset
   ═══════════════════════════════════════════════════════════════════ */
describe("getPreset", () => {
  it("retrieves a preset by id", () => {
    const p = getPreset("polished-steel");
    expect(p).toBeDefined();
    expect(p.name).toBe("Polished Steel");
  });

  it("returns null for unknown id", () => {
    expect(getPreset("does-not-exist")).toBeNull();
  });
});

/* ═══════════════════════════════════════════════════════════════════════
   searchPresets
   ═══════════════════════════════════════════════════════════════════ */
describe("searchPresets", () => {
  it("finds presets by name", () => {
    const results = searchPresets("gold");
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results.some((p) => p.id === "gold")).toBe(true);
  });

  it("finds presets by tag", () => {
    const results = searchPresets("shiny");
    expect(results.length).toBeGreaterThan(0);
  });

  it("case-insensitive search", () => {
    const r1 = searchPresets("COPPER");
    const r2 = searchPresets("copper");
    expect(r1.length).toBe(r2.length);
  });

  it("empty query returns all presets", () => {
    expect(searchPresets("").length).toBe(MATERIAL_PRESETS.length);
  });

  it("no match returns empty array", () => {
    expect(searchPresets("xyzzyplugh")).toEqual([]);
  });
});

/* ═══════════════════════════════════════════════════════════════════════
   buildMaterial
   ═══════════════════════════════════════════════════════════════════ */
describe("buildMaterial", () => {
  it("creates a MeshStandardMaterial from preset id", () => {
    const mat = buildMaterial("polished-steel");
    expect(mat).toBeInstanceOf(THREE.MeshStandardMaterial);
    expect(mat.metalness).toBeCloseTo(0.95, 2);
  });

  it("creates material from preset object", () => {
    const preset = getPreset("oak");
    const mat = buildMaterial(preset);
    expect(mat).toBeInstanceOf(THREE.MeshStandardMaterial);
    expect(mat.roughness).toBeGreaterThan(0);
  });

  it("handles transparent materials (clear glass)", () => {
    const mat = buildMaterial("clear-glass");
    expect(mat.transparent).toBe(true);
    expect(mat.opacity).toBeLessThan(1);
  });

  it("handles emissive materials (neon-blue)", () => {
    const mat = buildMaterial("neon-blue");
    expect(mat.emissiveIntensity).toBeGreaterThan(0);
  });

  it("stores preset id in userData", () => {
    const mat = buildMaterial("gold");
    expect(mat.userData.__preset).toBe("gold");
  });

  it("handles wireframe material", () => {
    const mat = buildMaterial("wireframe");
    expect(mat.wireframe).toBe(true);
  });

  it("throws on unknown id", () => {
    expect(() => buildMaterial("unknown-id")).toThrow();
  });
});

/* ═══════════════════════════════════════════════════════════════════════
   applyPreset / rollbackPreset
   ═══════════════════════════════════════════════════════════════════ */
describe("applyPreset / rollbackPreset", () => {
  function makeMesh() {
    const geo = new THREE.BoxGeometry(1, 1, 1);
    const mat = new THREE.MeshStandardMaterial({ color: 0xff0000, roughness: 0.5 });
    return new THREE.Mesh(geo, mat);
  }

  it("applies material params to a mesh", () => {
    const mesh = makeMesh();
    applyPreset(mesh, "gold");
    expect(mesh.material.metalness).toBeCloseTo(1.0, 1);
    expect(mesh.material.userData.__preset).toBe("gold");
  });

  it("returns rollback data with previous material", () => {
    const mesh = makeMesh();
    const rollback = applyPreset(mesh, "polished-steel");
    expect(rollback).toHaveProperty("mesh", mesh);
    expect(rollback).toHaveProperty("previousMaterial");
    expect(rollback.previousMaterial).toBeInstanceOf(THREE.MeshStandardMaterial);
  });

  it("rollback reverts the material", () => {
    const mesh = makeMesh();
    const origMaterial = mesh.material;
    const rollback = applyPreset(mesh, "gold");
    expect(mesh.material).not.toBe(origMaterial);
    rollbackPreset(rollback);
    expect(mesh.material).toBe(origMaterial);
  });

  it("accepts preset object as well as id", () => {
    const mesh = makeMesh();
    const preset = getPreset("copper");
    const rollback = applyPreset(mesh, preset);
    expect(rollback).toBeTruthy();
  });
});

/* ═══════════════════════════════════════════════════════════════════════
   extractMaterialParams
   ═══════════════════════════════════════════════════════════════════ */
describe("extractMaterialParams", () => {
  it("extracts color, roughness, metalness from a mesh", () => {
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(1),
      new THREE.MeshStandardMaterial({ color: 0x00ff00, roughness: 0.3, metalness: 0.8 }),
    );
    const params = extractMaterialParams(mesh);
    expect(params.color).toBeDefined();
    expect(params.roughness).toBeCloseTo(0.3, 1);
    expect(params.metalness).toBeCloseTo(0.8, 1);
  });

  it("extracts emissive when present", () => {
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(1),
      new THREE.MeshStandardMaterial({ emissive: 0xff0000, emissiveIntensity: 2 }),
    );
    const params = extractMaterialParams(mesh);
    expect(params.emissive).toBeDefined();
    expect(params.emissiveIntensity).toBe(2);
  });

  it("returns null for mesh without material", () => {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(1));
    mesh.material = null;
    const params = extractMaterialParams(mesh);
    expect(params).toBeNull();
  });
});

/* ═══════════════════════════════════════════════════════════════════════
   createCustomPreset
   ═══════════════════════════════════════════════════════════════════ */
describe("createCustomPreset", () => {
  it("creates a preset from a mesh", () => {
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(1),
      new THREE.MeshStandardMaterial({ color: 0x3366ff, roughness: 0.4, metalness: 0.9 }),
    );
    const preset = createCustomPreset(mesh, "My Blue Metal");
    expect(preset.name).toBe("My Blue Metal");
    expect(preset.id).toContain("custom-");
    expect(preset.category).toBe("special");
    expect(preset.params.roughness).toBeCloseTo(0.4, 1);
    expect(preset.params.metalness).toBeCloseTo(0.9, 1);
  });

  it("custom presets can be applied back", () => {
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(1),
      new THREE.MeshStandardMaterial({ color: 0xff8800, roughness: 0.2 }),
    );
    const preset = createCustomPreset(mesh, "Orange");
    const target = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshStandardMaterial({ color: 0x000000 }),
    );
    applyPreset(target, preset);
    expect(target.material.roughness).toBeCloseTo(0.2, 1);
  });
});
