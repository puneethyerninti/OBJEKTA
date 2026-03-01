// src/__tests__/scene-presets.test.js
// Phase 5 — ScenePresets engine tests

import { describe, it, expect } from "vitest";
import * as THREE from "three";
import {
  presetStudioLighting,
  presetOutdoor,
  presetProductShowcase,
  presetArchitectural,
  presetLowPolyNature,
  PRESET_CATALOG,
} from "../engine/ScenePresets";

/* helper to count all descendants recursively */
function countDescendants(obj) {
  let count = 0;
  obj.traverse(() => count++);
  return count - 1; // exclude root
}

function findLights(group) {
  const lights = [];
  group.traverse((c) => { if (c.isLight) lights.push(c); });
  return lights;
}

function findMeshes(group) {
  const meshes = [];
  group.traverse((c) => { if (c.isMesh) meshes.push(c); });
  return meshes;
}

/* ═══════════════════════════════════════════════════════════════════════
   Studio Lighting preset
   ═══════════════════════════════════════════════════════════════════ */
describe("presetStudioLighting", () => {
  it("returns a named group", () => {
    const result = presetStudioLighting();
    expect(result).toBeInstanceOf(THREE.Group);
    expect(result.name).toBe("Preset_StudioLighting");
  });

  it("contains at least 3 lights (key, fill, rim)", () => {
    const result = presetStudioLighting();
    const lights = findLights(result);
    expect(lights.length).toBeGreaterThanOrEqual(3);
  });

  it("contains a backdrop and floor mesh", () => {
    const result = presetStudioLighting();
    const meshes = findMeshes(result);
    const names = meshes.map((m) => m.name);
    expect(names.some((n) => n.includes("Backdrop"))).toBe(true);
    expect(names.some((n) => n.includes("Floor"))).toBe(true);
  });

  it("key light casts shadows", () => {
    const result = presetStudioLighting();
    const lights = findLights(result);
    const key = lights.find((l) => l.name.includes("Key"));
    expect(key.castShadow).toBe(true);
  });
});

/* ═══════════════════════════════════════════════════════════════════════
   Outdoor preset
   ═══════════════════════════════════════════════════════════════════ */
describe("presetOutdoor", () => {
  it("returns a named group", () => {
    const result = presetOutdoor();
    expect(result).toBeInstanceOf(THREE.Group);
    expect(result.name).toBe("Preset_Outdoor");
  });

  it("has a sun directional light", () => {
    const result = presetOutdoor();
    const lights = findLights(result);
    const sun = lights.find((l) => l instanceof THREE.DirectionalLight);
    expect(sun).toBeTruthy();
    expect(sun.castShadow).toBe(true);
  });

  it("has a hemisphere light for sky", () => {
    const result = presetOutdoor();
    const lights = findLights(result);
    const hemi = lights.find((l) => l instanceof THREE.HemisphereLight);
    expect(hemi).toBeTruthy();
  });

  it("includes trees", () => {
    const result = presetOutdoor();
    let treeCount = 0;
    result.traverse((c) => { if (c.name && c.name.includes("Tree")) treeCount++; });
    expect(treeCount).toBeGreaterThanOrEqual(3);
  });
});

/* ═══════════════════════════════════════════════════════════════════════
   Product Showcase preset
   ═══════════════════════════════════════════════════════════════════ */
describe("presetProductShowcase", () => {
  it("returns a named group", () => {
    const result = presetProductShowcase();
    expect(result).toBeInstanceOf(THREE.Group);
    expect(result.name).toBe("Preset_ProductShowcase");
  });

  it("has a pedestal mesh", () => {
    const result = presetProductShowcase();
    const meshes = findMeshes(result);
    const pedestal = meshes.find((m) => m.name.includes("Pedestal"));
    expect(pedestal).toBeTruthy();
    expect(pedestal.geometry).toBeInstanceOf(THREE.CylinderGeometry);
  });

  it("has a spotlight", () => {
    const result = presetProductShowcase();
    const lights = findLights(result);
    const spot = lights.find((l) => l instanceof THREE.SpotLight);
    expect(spot).toBeTruthy();
  });
});

/* ═══════════════════════════════════════════════════════════════════════
   Architectural Interior preset
   ═══════════════════════════════════════════════════════════════════ */
describe("presetArchitectural", () => {
  it("returns a named group", () => {
    const result = presetArchitectural();
    expect(result).toBeInstanceOf(THREE.Group);
    expect(result.name).toBe("Preset_Architectural");
  });

  it("has columns", () => {
    const result = presetArchitectural();
    let colCount = 0;
    result.traverse((c) => { if (c.name && c.name.includes("Column")) colCount++; });
    expect(colCount).toBeGreaterThanOrEqual(4);
  });

  it("has warm lighting", () => {
    const result = presetArchitectural();
    const lights = findLights(result);
    expect(lights.length).toBeGreaterThanOrEqual(2); // ceiling + sconces + ambient
  });
});

/* ═══════════════════════════════════════════════════════════════════════
   Low-Poly Nature preset
   ═══════════════════════════════════════════════════════════════════ */
describe("presetLowPolyNature", () => {
  it("returns a named group", () => {
    const result = presetLowPolyNature();
    expect(result).toBeInstanceOf(THREE.Group);
    expect(result.name).toBe("Preset_LowPolyNature");
  });

  it("has a terrain mesh", () => {
    const result = presetLowPolyNature();
    const meshes = findMeshes(result);
    const terrain = meshes.find((m) => m.name.includes("Terrain"));
    expect(terrain).toBeTruthy();
    expect(terrain.material.flatShading).toBe(true);
  });

  it("has trees and rocks", () => {
    const result = presetLowPolyNature();
    let trees = 0, rocks = 0;
    result.traverse((c) => {
      if (c.name?.includes("Tree")) trees++;
      if (c.name?.includes("Rock")) rocks++;
    });
    expect(trees).toBeGreaterThanOrEqual(5);
    expect(rocks).toBeGreaterThanOrEqual(3);
  });

  it("has natural lighting (sun + hemisphere)", () => {
    const result = presetLowPolyNature();
    const lights = findLights(result);
    const dir = lights.find((l) => l instanceof THREE.DirectionalLight);
    const hemi = lights.find((l) => l instanceof THREE.HemisphereLight);
    expect(dir).toBeTruthy();
    expect(hemi).toBeTruthy();
  });
});

/* ═══════════════════════════════════════════════════════════════════════
   PRESET_CATALOG
   ═══════════════════════════════════════════════════════════════════ */
describe("PRESET_CATALOG", () => {
  it("has at least 5 presets", () => {
    expect(PRESET_CATALOG.length).toBeGreaterThanOrEqual(5);
  });

  it("each entry has required fields", () => {
    for (const preset of PRESET_CATALOG) {
      expect(preset.id).toBeTruthy();
      expect(preset.label).toBeTruthy();
      expect(preset.icon).toBeTruthy();
      expect(preset.description).toBeTruthy();
      expect(typeof preset.fn).toBe("function");
    }
  });

  it("all presets produce valid Three.js groups", () => {
    for (const preset of PRESET_CATALOG) {
      const result = preset.fn();
      expect(result).toBeTruthy();
      expect(result.isObject3D).toBe(true);
      expect(countDescendants(result)).toBeGreaterThan(0);
    }
  });
});
