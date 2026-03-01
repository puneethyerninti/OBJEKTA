// src/__tests__/ai-scene-analyzer.test.js
// Unit tests for the rule-based AI scene assistant (no model needed).

import { describe, it, expect } from "vitest";
import {
  analyzeSceneOptimizations,
  describeScene,
  suggestNames,
  suggestMaterial,
  askAboutScene,
} from "../engine/AISceneAnalyzer";

/* ── Shared mock factories ─────────────────────────────────────────── */
function makeObj(name, tris = 100, opts = {}) {
  const color = opts.color || "ffffff";
  const roughness = opts.roughness ?? 0.5;
  const metalness = opts.metalness ?? 0.0;
  const geomType = opts.geomType || "BufferGeometry";
  return {
    uuid: opts.uuid || `uuid-${name}`,
    name,
    type: "Mesh",
    isMesh: true,
    position: { x: opts.x ?? 0, y: opts.y ?? 0, z: opts.z ?? 0 },
    rotation: { x: 0, y: 0, z: 0 },
    scale: { x: 1, y: 1, z: 1 },
    userData: {},
    traverse(fn) {
      fn({
        isMesh: true,
        geometry: {
          type: geomType,
          index: { count: tris * 3 },
          attributes: { position: { count: tris * 3 } },
        },
        material: {
          color: { getHexString: () => color },
          roughness,
          metalness,
        },
      });
    },
  };
}

function makeLightObj(name, intensity = 1.0) {
  return {
    uuid: `light-${name}`,
    name,
    type: "PointLight",
    isLight: true,
    color: 0xffffff,
    intensity,
    position: { x: 0, y: 2, z: 0 },
  };
}

function makeScene(lights = []) {
  return {
    traverse(fn) {
      for (const l of lights) fn(l);
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════
//  analyzeSceneOptimizations
// ═══════════════════════════════════════════════════════════════════════
describe("analyzeSceneOptimizations", () => {
  it("returns all-clear for a simple, small scene", async () => {
    const objs = [makeObj("Cube", 100)];
    const scene = makeScene([]);
    const suggestions = await analyzeSceneOptimizations(objs, scene);
    expect(Array.isArray(suggestions)).toBe(true);
    // small scene → only an all-clear message
    expect(suggestions.length).toBe(1);
    expect(suggestions[0].summary).toMatch(/well-optimized/i);
  });

  it("warns about high-poly scene (>500k tris total)", async () => {
    const objs = [makeObj("BigMesh", 600_000)];
    const scene = makeScene([]);
    const suggestions = await analyzeSceneOptimizations(objs, scene);
    const triWarn = suggestions.find((s) => s.summary.includes("triangles"));
    expect(triWarn).toBeTruthy();
  });

  it("warns about individual high-poly objects (>100k tris)", async () => {
    const objs = [makeObj("HeavyMesh", 150_000)];
    const scene = makeScene([]);
    const suggestions = await analyzeSceneOptimizations(objs, scene);
    const objWarn = suggestions.find((s) => s.summary.includes("HeavyMesh"));
    expect(objWarn).toBeTruthy();
  });

  it("warns about too many lights (>8)", async () => {
    const lights = Array.from({ length: 10 }, (_, i) => makeLightObj(`L${i}`));
    const objs = [makeObj("Cube", 100)];
    const scene = makeScene(lights);
    const suggestions = await analyzeSceneOptimizations(objs, scene);
    const lightWarn = suggestions.find((s) => s.summary.includes("lights"));
    expect(lightWarn).toBeTruthy();
  });

  it("warns about zero-intensity lights", async () => {
    const lights = [makeLightObj("DeadLight", 0)];
    const objs = [makeObj("Cube", 100)];
    const scene = makeScene(lights);
    const suggestions = await analyzeSceneOptimizations(objs, scene);
    const deadWarn = suggestions.find((s) => s.summary.includes("0 intensity"));
    expect(deadWarn).toBeTruthy();
  });

  it("suggests adding objects for empty scene", async () => {
    const suggestions = await analyzeSceneOptimizations([], makeScene([]));
    const emptyWarn = suggestions.find((s) => s.summary.includes("empty"));
    expect(emptyWarn).toBeTruthy();
  });

  it("detects potential duplicates at same position", async () => {
    const objs = [
      makeObj("Box1", 200, { x: 1, y: 0, z: 0 }),
      makeObj("Box2", 200, { x: 1, y: 0, z: 0 }),
    ];
    const suggestions = await analyzeSceneOptimizations(objs, makeScene([]));
    const dupWarn = suggestions.find((s) => s.summary.includes("duplicate"));
    expect(dupWarn).toBeTruthy();
  });
});

// ═══════════════════════════════════════════════════════════════════════
//  describeScene
// ═══════════════════════════════════════════════════════════════════════
describe("describeScene", () => {
  it("describes an empty scene", async () => {
    const text = await describeScene([], makeScene([]));
    expect(text).toMatch(/empty/i);
  });

  it("describes a scene with objects", async () => {
    const objs = [
      makeObj("RedCube", 12, { color: "ff0000", geomType: "BoxGeometry" }),
      makeObj("BlueSphere", 450, { color: "0000ff", geomType: "SphereGeometry" }),
    ];
    const text = await describeScene(objs, makeScene([]));
    expect(text).toMatch(/2 object/);
    expect(text).toMatch(/triangle/);
  });

  it("mentions lighting when lights are present", async () => {
    const objs = [makeObj("Cube", 12)];
    const lights = [makeLightObj("Sun", 1.5)];
    const text = await describeScene(objs, makeScene(lights));
    expect(text).toMatch(/light/i);
  });

  it("notes high poly count for heavy scenes", async () => {
    const objs = [makeObj("Heavy", 600_000)];
    const text = await describeScene(objs, makeScene([]));
    expect(text).toMatch(/heavy|decimat/i);
  });
});

// ═══════════════════════════════════════════════════════════════════════
//  suggestNames
// ═══════════════════════════════════════════════════════════════════════
describe("suggestNames", () => {
  it("suggests names for generically-named objects", async () => {
    const objs = [
      makeObj("Mesh", 12, { color: "ff0000", geomType: "BoxGeometry" }),
      makeObj("Object3D", 100, { color: "0000ff", geomType: "SphereGeometry" }),
    ];
    const results = await suggestNames(objs);
    expect(results.length).toBe(2);
    expect(results[0].suggestedName).toBeTruthy();
    expect(results[0].suggestedName).not.toBe("Mesh");
  });

  it("returns empty array when all objects have descriptive names", async () => {
    const objs = [
      makeObj("MyCustomCube", 12),
      makeObj("FloorPlane", 2),
    ];
    const results = await suggestNames(objs);
    expect(results.length).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════
//  suggestMaterial
// ═══════════════════════════════════════════════════════════════════════
describe("suggestMaterial", () => {
  it("suggests material values for a gray metallic object", async () => {
    const obj = makeObj("MetalThing", 200, { color: "888888", roughness: 0.3, metalness: 0.8 });
    const result = await suggestMaterial(obj);
    expect(result).toHaveProperty("roughness");
    expect(result).toHaveProperty("metalness");
    expect(result).toHaveProperty("colorHex");
    expect(result).toHaveProperty("description");
    expect(typeof result.roughness).toBe("number");
  });

  it("returns a preset name when matched", async () => {
    const obj = makeObj("GoldBar", 100, { color: "ffff00", roughness: 0.2, metalness: 0.5, geomType: "BoxGeometry" });
    const result = await suggestMaterial(obj);
    expect(result.presetName).toBeTruthy();
  });

  it("returns enhanced PBR when no preset matches", async () => {
    const obj = makeObj("Weird", 500, { color: "12ab34", roughness: 0.5, metalness: 0.1 });
    const result = await suggestMaterial(obj);
    expect(result.presetName).toBeTruthy();
    expect(result.description.length).toBeGreaterThan(10);
  });
});

// ═══════════════════════════════════════════════════════════════════════
//  askAboutScene
// ═══════════════════════════════════════════════════════════════════════
describe("askAboutScene", () => {
  it("answers 'how many triangles' accurately", async () => {
    const objs = [makeObj("Cube", 500), makeObj("Sphere", 300)];
    const answer = await askAboutScene("How many triangles?", objs, makeScene([]));
    expect(answer).toMatch(/800/);
    expect(answer).toMatch(/triangle/i);
  });

  it("lists objects when asked", async () => {
    const objs = [makeObj("Chair", 200), makeObj("Table", 150)];
    const answer = await askAboutScene("List all objects", objs, makeScene([]));
    expect(answer).toMatch(/Chair/);
    expect(answer).toMatch(/Table/);
  });

  it("gives optimization advice when asked", async () => {
    const objs = [makeObj("BigMesh", 600_000)];
    const answer = await askAboutScene("How can I optimize performance?", objs, makeScene([]));
    expect(answer).toMatch(/triangle|decimate|performance/i);
  });

  it("describes lighting when asked", async () => {
    const lights = [makeLightObj("MainLight", 2.0)];
    const answer = await askAboutScene("Tell me about the lighting", [makeObj("X", 10)], makeScene(lights));
    expect(answer).toMatch(/light/i);
    expect(answer).toMatch(/MainLight/);
  });

  it("handles empty scene gracefully", async () => {
    const answer = await askAboutScene("What is in the scene?", [], makeScene([]));
    expect(answer).toMatch(/empty/i);
  });

  it("provides help when asked about capabilities", async () => {
    const answer = await askAboutScene("What can you do?", [makeObj("X", 10)], makeScene([]));
    expect(answer).toMatch(/help|describ|name|material/i);
  });
});
