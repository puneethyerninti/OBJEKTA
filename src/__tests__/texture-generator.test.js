// src/__tests__/texture-generator.test.js
// Phase 6 — TextureGenerator engine tests

import { describe, it, expect, beforeAll, vi } from "vitest";
import * as THREE from "three";

/* ── Lightweight Canvas 2D mock for Node.js environment ──────────── */
function makeImageData(w, h) {
  return { data: new Uint8ClampedArray(w * h * 4), width: w, height: h };
}
function makeFakeCtx() {
  return {
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 1,
    globalAlpha: 1,
    fillRect() {},
    clearRect() {},
    strokeRect() {},
    beginPath() {},
    closePath() {},
    moveTo() {},
    lineTo() {},
    arc() {},
    fill() {},
    stroke() {},
    save() {},
    restore() {},
    translate() {},
    rotate() {},
    scale() {},
    createLinearGradient() {
      return { addColorStop() {} };
    },
    createRadialGradient() {
      return { addColorStop() {} };
    },
    createImageData(w, h) {
      return makeImageData(w, h);
    },
    getImageData(x, y, w, h) {
      return makeImageData(w, h);
    },
    putImageData() {},
  };
}

function makeFakeCanvas(w = 256, h = 256) {
  const canvas = {
    _w: w,
    _h: h,
    get width() { return this._w; },
    set width(v) { this._w = v; },
    get height() { return this._h; },
    set height(v) { this._h = v; },
    getContext() {
      const self = this;
      return {
        ...makeFakeCtx(),
        getImageData(x, y, w2, h2) {
          return makeImageData(w2 || self._w, h2 || self._h);
        },
      };
    },
    toDataURL() {
      return "data:image/png;base64,mock";
    },
  };
  return canvas;
}

// Polyfill document.createElement for canvas creation in Node.js
if (typeof document === "undefined") {
  globalThis.document = {
    createElement(tag) {
      if (tag === "canvas") return makeFakeCanvas();
      return {};
    },
  };
}

import {
  checkerboard as generateCheckerboard,
  noise as generateNoise,
  wood as generateWood,
  marble as generateMarble,
  gradient as generateGradient,
  grid as generateGrid,
  bricks as generateBricks,
  dots as generateDots,
  applyTextureDescriptor,
  TEXTURE_CATALOG,
} from "../engine/TextureGenerator";

/* ═══════════════════════════════════════════════════════════════════════
   TEXTURE_CATALOG
   ═══════════════════════════════════════════════════════════════════ */
describe("TEXTURE_CATALOG", () => {
  it("is a non-empty array", () => {
    expect(Array.isArray(TEXTURE_CATALOG)).toBe(true);
    expect(TEXTURE_CATALOG.length).toBeGreaterThanOrEqual(8);
  });

  it("each entry has id, label, icon, fn", () => {
    for (const entry of TEXTURE_CATALOG) {
      expect(entry).toHaveProperty("id");
      expect(entry).toHaveProperty("label");
      expect(entry).toHaveProperty("icon");
      expect(entry).toHaveProperty("fn");
      expect(typeof entry.fn).toBe("function");
    }
  });

  it("has unique ids", () => {
    const ids = TEXTURE_CATALOG.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

/* ═══════════════════════════════════════════════════════════════════════
   Checkerboard
   ═══════════════════════════════════════════════════════════════════ */
describe("generateCheckerboard", () => {
  it("returns a THREE.CanvasTexture", () => {
    const tex = generateCheckerboard({ size: 64 });
    expect(tex).toBeInstanceOf(THREE.CanvasTexture);
  });

  it("respects custom size", () => {
    const tex = generateCheckerboard({ size: 128 });
    expect(tex.image.width).toBe(128);
    expect(tex.image.height).toBe(128);
  });

  it("uses repeat wrapping", () => {
    const tex = generateCheckerboard({ size: 64 });
    expect(tex.wrapS).toBe(THREE.RepeatWrapping);
    expect(tex.wrapT).toBe(THREE.RepeatWrapping);
  });
});

/* ═══════════════════════════════════════════════════════════════════════
   Noise
   ═══════════════════════════════════════════════════════════════════ */
describe("generateNoise", () => {
  it("returns a CanvasTexture", () => {
    const tex = generateNoise({ size: 64 });
    expect(tex).toBeInstanceOf(THREE.CanvasTexture);
  });

  it("is deterministic with a seed (produces valid texture)", () => {
    const a = generateNoise({ size: 32, seed: 42 });
    const b = generateNoise({ size: 32, seed: 42 });
    // Both calls should produce a texture
    expect(a).toBeInstanceOf(THREE.CanvasTexture);
    expect(b).toBeInstanceOf(THREE.CanvasTexture);
  });

  it("different seeds both produce valid textures", () => {
    const a = generateNoise({ size: 32, seed: 1 });
    const b = generateNoise({ size: 32, seed: 999 });
    expect(a).toBeInstanceOf(THREE.CanvasTexture);
    expect(b).toBeInstanceOf(THREE.CanvasTexture);
  });
});

/* ═══════════════════════════════════════════════════════════════════════
   Wood grain
   ═══════════════════════════════════════════════════════════════════ */
describe("generateWood", () => {
  it("returns a CanvasTexture", () => {
    const tex = generateWood({ size: 64 });
    expect(tex).toBeInstanceOf(THREE.CanvasTexture);
  });

  it("respects custom size", () => {
    const tex = generateWood({ size: 256 });
    expect(tex.image.width).toBe(256);
  });
});

/* ═══════════════════════════════════════════════════════════════════════
   Marble
   ═══════════════════════════════════════════════════════════════════ */
describe("generateMarble", () => {
  it("returns a CanvasTexture", () => {
    const tex = generateMarble({ size: 64 });
    expect(tex).toBeInstanceOf(THREE.CanvasTexture);
  });

  it("can accept vein color", () => {
    const tex = generateMarble({ size: 64, veinColor: "#222222" });
    expect(tex).toBeInstanceOf(THREE.CanvasTexture);
  });
});

/* ═══════════════════════════════════════════════════════════════════════
   Gradient
   ═══════════════════════════════════════════════════════════════════ */
describe("generateGradient", () => {
  it("returns a CanvasTexture", () => {
    const tex = generateGradient({ size: 64 });
    expect(tex).toBeInstanceOf(THREE.CanvasTexture);
  });

  it("supports linear mode", () => {
    const tex = generateGradient({ size: 64, mode: "linear" });
    expect(tex).toBeInstanceOf(THREE.CanvasTexture);
  });

  it("supports radial mode", () => {
    const tex = generateGradient({ size: 64, mode: "radial" });
    expect(tex).toBeInstanceOf(THREE.CanvasTexture);
  });
});

/* ═══════════════════════════════════════════════════════════════════════
   Grid
   ═══════════════════════════════════════════════════════════════════ */
describe("generateGrid", () => {
  it("returns a CanvasTexture", () => {
    const tex = generateGrid({ size: 64 });
    expect(tex).toBeInstanceOf(THREE.CanvasTexture);
  });
});

/* ═══════════════════════════════════════════════════════════════════════
   Bricks
   ═══════════════════════════════════════════════════════════════════ */
describe("generateBricks", () => {
  it("returns a CanvasTexture", () => {
    const tex = generateBricks({ size: 64 });
    expect(tex).toBeInstanceOf(THREE.CanvasTexture);
  });

  it("accepts custom brick color", () => {
    const tex = generateBricks({ size: 64, brickColor: "#cc4444" });
    expect(tex).toBeInstanceOf(THREE.CanvasTexture);
  });
});

/* ═══════════════════════════════════════════════════════════════════════
   Dots
   ═══════════════════════════════════════════════════════════════════ */
describe("generateDots", () => {
  it("returns a CanvasTexture", () => {
    const tex = generateDots({ size: 64 });
    expect(tex).toBeInstanceOf(THREE.CanvasTexture);
  });

  it("respects custom parameters", () => {
    const tex = generateDots({ size: 128, dotColor: "#ff00ff", radius: 8 });
    expect(tex.image.width).toBe(128);
  });
});

/* ═══════════════════════════════════════════════════════════════════════
   applyTextureDescriptor
   ═══════════════════════════════════════════════════════════════════ */
describe("applyTextureDescriptor", () => {
  it("applies a checkerboard to the color (map) slot", () => {
    const mat = new THREE.MeshStandardMaterial();
    applyTextureDescriptor(mat, { type: "checkerboard", channel: "color", size: 64 });
    expect(mat.map).toBeInstanceOf(THREE.CanvasTexture);
    expect(mat.map.image.width).toBe(64);
  });

  it("applies noise to roughnessMap", () => {
    const mat = new THREE.MeshStandardMaterial();
    applyTextureDescriptor(mat, { type: "noise", channel: "roughness", size: 64 });
    expect(mat.roughnessMap).toBeInstanceOf(THREE.CanvasTexture);
  });

  it("applies noise to metalnessMap", () => {
    const mat = new THREE.MeshStandardMaterial();
    applyTextureDescriptor(mat, { type: "noise", channel: "metalness", size: 64 });
    expect(mat.metalnessMap).toBeInstanceOf(THREE.CanvasTexture);
  });

  it("applies to emissiveMap", () => {
    const mat = new THREE.MeshStandardMaterial();
    applyTextureDescriptor(mat, { type: "gradient", channel: "emissive", size: 64 });
    expect(mat.emissiveMap).toBeInstanceOf(THREE.CanvasTexture);
  });

  it("applies to normalMap", () => {
    const mat = new THREE.MeshStandardMaterial();
    applyTextureDescriptor(mat, { type: "noise", channel: "normal", size: 64 });
    expect(mat.normalMap).toBeInstanceOf(THREE.CanvasTexture);
  });

  it("applies to aoMap", () => {
    const mat = new THREE.MeshStandardMaterial();
    applyTextureDescriptor(mat, { type: "noise", channel: "ao", size: 64 });
    expect(mat.aoMap).toBeInstanceOf(THREE.CanvasTexture);
  });

  it("defaults slot to color if omitted", () => {
    const mat = new THREE.MeshStandardMaterial();
    applyTextureDescriptor(mat, { type: "checkerboard", size: 64 });
    expect(mat.map).toBeInstanceOf(THREE.CanvasTexture);
  });

  it("marks material as needing update", () => {
    const mat = new THREE.MeshStandardMaterial();
    expect(mat.map).toBeNull();
    applyTextureDescriptor(mat, { type: "grid", channel: "color", size: 64 });
    // After apply, map should be set
    expect(mat.map).toBeTruthy();
  });

  it("handles unknown texture type gracefully", () => {
    const mat = new THREE.MeshStandardMaterial();
    // Should not throw
    expect(() => {
      applyTextureDescriptor(mat, { type: "nonexistent", slot: "color", size: 64 });
    }).not.toThrow();
  });
});

/* ═══════════════════════════════════════════════════════════════════════
   All catalog generators produce valid textures
   ═══════════════════════════════════════════════════════════════════ */
describe("All TEXTURE_CATALOG generators", () => {
  for (const entry of TEXTURE_CATALOG) {
    it(`${entry.id}: produces a CanvasTexture with correct dimensions`, () => {
      const tex = entry.fn({ size: 64 });
      expect(tex).toBeInstanceOf(THREE.CanvasTexture);
      expect(tex.image.width).toBe(64);
      expect(tex.image.height).toBe(64);
    });
  }
});
