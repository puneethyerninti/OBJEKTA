// src/__tests__/procedural-generator.test.js
// Phase 5 — ProceduralGenerator engine tests

import { describe, it, expect } from "vitest";
import * as THREE from "three";
import {
  generateStairs,
  generateWall,
  generateFloor,
  generateTerrain,
  generateRoom,
  generateColumn,
  scatter,
  array,
  circularArray,
  PROCEDURAL_CATALOG,
} from "../engine/ProceduralGenerator";

/* ═══════════════════════════════════════════════════════════════════════
   generateStairs
   ═══════════════════════════════════════════════════════════════════ */
describe("generateStairs", () => {
  it("returns a group with the correct number of steps", () => {
    const result = generateStairs({ steps: 5 });
    expect(result).toBeInstanceOf(THREE.Group);
    expect(result.children).toHaveLength(5);
    expect(result.name).toBe("ProceduralStairs");
  });

  it("each step is a mesh with BoxGeometry", () => {
    const result = generateStairs({ steps: 3 });
    for (const child of result.children) {
      expect(child).toBeInstanceOf(THREE.Mesh);
      expect(child.geometry).toBeInstanceOf(THREE.BoxGeometry);
    }
  });

  it("steps are positioned progressively higher", () => {
    const result = generateStairs({ steps: 4, stepHeight: 0.5 });
    const ys = result.children.map((c) => c.position.y);
    for (let i = 1; i < ys.length; i++) {
      expect(ys[i]).toBeGreaterThan(ys[i - 1]);
    }
  });

  it("respects custom color", () => {
    const result = generateStairs({ steps: 2, color: "#ff0000" });
    const mesh = result.children[0];
    expect(mesh.material.color.getHexString()).toBe("ff0000");
  });

  it("uses default values when no options provided", () => {
    const result = generateStairs();
    expect(result.children).toHaveLength(10); // default steps
  });
});

/* ═══════════════════════════════════════════════════════════════════════
   generateWall
   ═══════════════════════════════════════════════════════════════════ */
describe("generateWall", () => {
  it("returns a group with rows × cols bricks", () => {
    const result = generateWall({ rows: 3, cols: 4 });
    expect(result).toBeInstanceOf(THREE.Group);
    expect(result.children).toHaveLength(12);
    expect(result.name).toBe("ProceduralWall");
  });

  it("bricks have staggered pattern (odd rows offset)", () => {
    const result = generateWall({ rows: 2, cols: 3 });
    const row0Xs = result.children.filter((_, i) => i < 3).map((c) => c.position.x);
    const row1Xs = result.children.filter((_, i) => i >= 3).map((c) => c.position.x);
    // Row 1 should be offset by half a brick width
    expect(row1Xs[0]).not.toBeCloseTo(row0Xs[0], 1);
  });

  it("all children are meshes with BoxGeometry", () => {
    const result = generateWall({ rows: 2, cols: 2 });
    for (const child of result.children) {
      expect(child).toBeInstanceOf(THREE.Mesh);
      expect(child.geometry).toBeInstanceOf(THREE.BoxGeometry);
    }
  });
});

/* ═══════════════════════════════════════════════════════════════════════
   generateFloor
   ═══════════════════════════════════════════════════════════════════ */
describe("generateFloor", () => {
  it("returns a simple plane mesh when no tiles", () => {
    const result = generateFloor({ width: 5, depth: 5 });
    expect(result).toBeInstanceOf(THREE.Mesh);
    expect(result.name).toBe("ProceduralFloor");
    expect(result.geometry).toBeInstanceOf(THREE.PlaneGeometry);
  });

  it("returns a tiled group when tileCount > 0", () => {
    const result = generateFloor({ width: 4, depth: 4, tileCount: 4 });
    expect(result).toBeInstanceOf(THREE.Group);
    expect(result.children).toHaveLength(16); // 4x4 tiles
    expect(result.name).toBe("ProceduralTiledFloor");
  });

  it("uses double-sided material for simple floor", () => {
    const result = generateFloor();
    expect(result.material.side).toBe(THREE.DoubleSide);
  });
});

/* ═══════════════════════════════════════════════════════════════════════
   generateTerrain
   ═══════════════════════════════════════════════════════════════════ */
describe("generateTerrain", () => {
  it("returns a mesh with displaced vertices", () => {
    const result = generateTerrain({ size: 10, segments: 8, height: 2 });
    expect(result).toBeInstanceOf(THREE.Mesh);
    expect(result.name).toBe("ProceduralTerrain");

    const pos = result.geometry.attributes.position;
    const ys = [];
    for (let i = 0; i < pos.count; i++) ys.push(pos.getY(i));
    // Not all Y values should be zero (noise displacement happened)
    const nonZero = ys.filter((y) => Math.abs(y) > 0.01);
    expect(nonZero.length).toBeGreaterThan(0);
  });

  it("uses flat shading", () => {
    const result = generateTerrain();
    expect(result.material.flatShading).toBe(true);
  });

  it("same seed produces same result", () => {
    const a = generateTerrain({ seed: 99, segments: 4 });
    const b = generateTerrain({ seed: 99, segments: 4 });
    const posA = a.geometry.attributes.position;
    const posB = b.geometry.attributes.position;
    for (let i = 0; i < posA.count; i++) {
      expect(posA.getY(i)).toBeCloseTo(posB.getY(i), 5);
    }
  });
});

/* ═══════════════════════════════════════════════════════════════════════
   generateRoom
   ═══════════════════════════════════════════════════════════════════ */
describe("generateRoom", () => {
  it("returns a group with floor + 4 walls (no ceiling by default)", () => {
    const result = generateRoom();
    expect(result).toBeInstanceOf(THREE.Group);
    expect(result.children).toHaveLength(5); // floor + 4 walls
    expect(result.name).toBe("ProceduralRoom");
  });

  it("adds ceiling when option is true", () => {
    const result = generateRoom({ ceiling: true });
    expect(result.children).toHaveLength(6); // floor + 4 walls + ceiling
    const ceiling = result.children.find((c) => c.name === "Room_Ceiling");
    expect(ceiling).toBeTruthy();
  });

  it("all children are meshes", () => {
    const result = generateRoom({ ceiling: true });
    for (const child of result.children) {
      expect(child).toBeInstanceOf(THREE.Mesh);
    }
  });
});

/* ═══════════════════════════════════════════════════════════════════════
   generateColumn
   ═══════════════════════════════════════════════════════════════════ */
describe("generateColumn", () => {
  it("returns a simple cylinder mesh when not fluted", () => {
    const result = generateColumn({ fluted: false });
    expect(result).toBeInstanceOf(THREE.Mesh);
    expect(result.geometry).toBeInstanceOf(THREE.CylinderGeometry);
    expect(result.name).toBe("ProceduralColumn");
  });

  it("returns a group with base + capital when fluted", () => {
    const result = generateColumn({ fluted: true });
    expect(result).toBeInstanceOf(THREE.Group);
    expect(result.name).toBe("ProceduralFlutedColumn");
    expect(result.children.length).toBeGreaterThanOrEqual(3); // shaft + base + capital
  });
});

/* ═══════════════════════════════════════════════════════════════════════
   scatter
   ═══════════════════════════════════════════════════════════════════ */
describe("scatter", () => {
  it("creates the correct number of clones", () => {
    const source = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshStandardMaterial({ color: "red" }),
    );
    source.name = "TestBox";
    const result = scatter(source, { count: 10, area: 5 });
    expect(result).toBeInstanceOf(THREE.Group);
    expect(result.children).toHaveLength(10);
  });

  it("clones have varied positions", () => {
    const source = new THREE.Mesh(
      new THREE.SphereGeometry(0.5),
      new THREE.MeshStandardMaterial(),
    );
    const result = scatter(source, { count: 5, area: 10, seed: 42 });
    const positions = result.children.map((c) => [c.position.x, c.position.z]);
    // All positions should be different
    const unique = new Set(positions.map((p) => `${p[0].toFixed(3)}_${p[1].toFixed(3)}`));
    expect(unique.size).toBe(5);
  });

  it("same seed produces deterministic results", () => {
    const source = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial());
    const a = scatter(source, { count: 3, seed: 123 });
    const b = scatter(source, { count: 3, seed: 123 });
    for (let i = 0; i < 3; i++) {
      expect(a.children[i].position.x).toBeCloseTo(b.children[i].position.x, 5);
    }
  });
});

/* ═══════════════════════════════════════════════════════════════════════
   array
   ═══════════════════════════════════════════════════════════════════ */
describe("array", () => {
  it("creates (countX*countY*countZ - 1) clones", () => {
    const source = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial());
    const result = array(source, { countX: 3, countY: 2, countZ: 2 });
    expect(result.children).toHaveLength(3 * 2 * 2 - 1); // minus origin
  });

  it("clones are spaced correctly on X axis", () => {
    const source = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial());
    const result = array(source, { countX: 4, countY: 1, countZ: 1, spacingX: 3 });
    const xs = result.children.map((c) => c.position.x).sort((a, b) => a - b);
    expect(xs).toEqual([3, 6, 9]);
  });
});

/* ═══════════════════════════════════════════════════════════════════════
   circularArray
   ═══════════════════════════════════════════════════════════════════ */
describe("circularArray", () => {
  it("creates the correct number of clones", () => {
    const source = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial());
    const result = circularArray(source, { count: 6, radius: 2 });
    expect(result.children).toHaveLength(6);
  });

  it("clones are positioned on a circle", () => {
    const source = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial());
    const result = circularArray(source, { count: 4, radius: 5 });
    for (const child of result.children) {
      const dist = Math.sqrt(child.position.x ** 2 + child.position.z ** 2);
      expect(dist).toBeCloseTo(5, 1);
    }
  });
});

/* ═══════════════════════════════════════════════════════════════════════
   PROCEDURAL_CATALOG
   ═══════════════════════════════════════════════════════════════════ */
describe("PROCEDURAL_CATALOG", () => {
  it("has at least 5 generators", () => {
    expect(PROCEDURAL_CATALOG.length).toBeGreaterThanOrEqual(5);
  });

  it("each entry has required fields", () => {
    for (const gen of PROCEDURAL_CATALOG) {
      expect(gen.id).toBeTruthy();
      expect(gen.label).toBeTruthy();
      expect(gen.icon).toBeTruthy();
      expect(typeof gen.fn).toBe("function");
      expect(Array.isArray(gen.params)).toBe(true);
    }
  });

  it("each param has key, label, type, and default", () => {
    for (const gen of PROCEDURAL_CATALOG) {
      for (const p of gen.params) {
        expect(p.key).toBeTruthy();
        expect(p.label).toBeTruthy();
        expect(p.type).toBeTruthy();
        expect(p.default).toBeDefined();
      }
    }
  });

  it("all generators produce valid Three.js objects with defaults", () => {
    for (const gen of PROCEDURAL_CATALOG) {
      const defaults = {};
      for (const p of gen.params) defaults[p.key] = p.default;
      const result = gen.fn(defaults);
      expect(result).toBeTruthy();
      expect(result.isObject3D).toBe(true);
    }
  });
});
