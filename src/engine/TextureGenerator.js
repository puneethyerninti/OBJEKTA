// src/engine/TextureGenerator.js
// ---------------------------------------------------------------------------
// Phase 6 — Procedural texture generator.
// Creates textures entirely in JavaScript using Canvas 2D, no external image
// files needed.  Supports: checkerboard, noise (Perlin-like), wood grain,
// marble veins, gradient, grid, brick pattern, dots.
// All functions return THREE.CanvasTexture ready to assign to material maps.
// ---------------------------------------------------------------------------

import * as THREE from "three";

/* ═══════════════════════════════════════════════════════════════════════════
   CORE HELPERS
   ═══════════════════════════════════════════════════════════════════════ */

function createCanvas(size = 256) {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  return canvas;
}

function canvasToTexture(canvas, opts = {}) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  if (opts.repeat) tex.repeat.set(opts.repeat, opts.repeat);
  tex.needsUpdate = true;
  return tex;
}

/* Simple seeded PRNG (mulberry32). */
function seeded(seed) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* Smoothstep. */
function smoothstep(t) { return t * t * (3 - 2 * t); }

/* Lerp color channels. */
function lerpRGB(r0, g0, b0, r1, g1, b1, t) {
  return [
    r0 + (r1 - r0) * t,
    g0 + (g1 - g0) * t,
    b0 + (b1 - b0) * t,
  ];
}

/* Parse hex to [r,g,b] 0-255. */
function hexToRgb(hex) {
  const c = parseInt(hex.replace("#", ""), 16);
  return [(c >> 16) & 0xff, (c >> 8) & 0xff, c & 0xff];
}

/* ═══════════════════════════════════════════════════════════════════════════
   2D VALUE NOISE  (used by several generators)
   ═══════════════════════════════════════════════════════════════════════ */

function makeNoiseGrid(gridSize, rng) {
  const grid = new Float32Array(gridSize * gridSize);
  for (let i = 0; i < grid.length; i++) grid[i] = rng();
  return grid;
}

function sampleNoise(grid, gridSize, x, y) {
  const gx = ((x % gridSize) + gridSize) % gridSize;
  const gy = ((y % gridSize) + gridSize) % gridSize;
  const ix = Math.floor(gx);
  const iy = Math.floor(gy);
  const fx = gx - ix;
  const fy = gy - iy;
  const sx = smoothstep(fx);
  const sy = smoothstep(fy);
  const i00 = (iy % gridSize) * gridSize + (ix % gridSize);
  const i10 = (iy % gridSize) * gridSize + ((ix + 1) % gridSize);
  const i01 = ((iy + 1) % gridSize) * gridSize + (ix % gridSize);
  const i11 = ((iy + 1) % gridSize) * gridSize + ((ix + 1) % gridSize);
  const top = grid[i00] * (1 - sx) + grid[i10] * sx;
  const bot = grid[i01] * (1 - sx) + grid[i11] * sx;
  return top * (1 - sy) + bot * sy;
}

function fbmNoise(grid, gridSize, x, y, octaves = 4) {
  let val = 0, amp = 1, freq = 1, max = 0;
  for (let i = 0; i < octaves; i++) {
    val += sampleNoise(grid, gridSize, x * freq, y * freq) * amp;
    max += amp;
    amp *= 0.5;
    freq *= 2;
  }
  return val / max;
}

/* ═══════════════════════════════════════════════════════════════════════════
   GENERATORS
   ═══════════════════════════════════════════════════════════════════════ */

/**
 * Checkerboard pattern.
 * @param {{ size?: number, scale?: number, colorA?: string, colorB?: string }} opts
 * @returns {THREE.CanvasTexture}
 */
export function checkerboard(opts = {}) {
  const { size = 256, scale = 8, colorA = "#ffffff", colorB = "#444444" } = opts;
  const canvas = createCanvas(size);
  const ctx = canvas.getContext("2d");
  const cellW = size / scale;
  const cellH = size / scale;

  for (let y = 0; y < scale; y++) {
    for (let x = 0; x < scale; x++) {
      ctx.fillStyle = (x + y) % 2 === 0 ? colorA : colorB;
      ctx.fillRect(x * cellW, y * cellH, cellW + 1, cellH + 1);
    }
  }

  const tex = canvasToTexture(canvas);
  tex.name = "ProceduralCheckerboard";
  return tex;
}

/**
 * Perlin-like noise texture.
 * @param {{ size?: number, scale?: number, octaves?: number, seed?: number, color?: string, intensity?: number }} opts
 * @returns {THREE.CanvasTexture}
 */
export function noise(opts = {}) {
  const { size = 256, scale = 16, octaves = 4, seed = 42, color = null, intensity = 1.0 } = opts;
  const canvas = createCanvas(size);
  const ctx = canvas.getContext("2d");
  const imgData = ctx.createImageData(size, size);
  const d = imgData.data;

  const rng = seeded(seed);
  const gridSize = Math.max(4, scale);
  const grid = makeNoiseGrid(gridSize, rng);

  const baseColor = color ? hexToRgb(color) : null;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const nx = (x / size) * gridSize;
      const ny = (y / size) * gridSize;
      const n = fbmNoise(grid, gridSize, nx, ny, octaves);
      const v = Math.min(255, Math.max(0, n * 255 * intensity));
      const idx = (y * size + x) * 4;

      if (baseColor) {
        d[idx]     = Math.min(255, baseColor[0] + (v - 128) * 0.5);
        d[idx + 1] = Math.min(255, baseColor[1] + (v - 128) * 0.5);
        d[idx + 2] = Math.min(255, baseColor[2] + (v - 128) * 0.5);
      } else {
        d[idx] = d[idx + 1] = d[idx + 2] = v;
      }
      d[idx + 3] = 255;
    }
  }
  ctx.putImageData(imgData, 0, 0);

  const tex = canvasToTexture(canvas);
  tex.name = "ProceduralNoise";
  return tex;
}

/**
 * Wood grain texture.
 * @param {{ size?: number, scale?: number, seed?: number, color?: string, intensity?: number }} opts
 * @returns {THREE.CanvasTexture}
 */
export function wood(opts = {}) {
  const { size = 256, scale = 10, seed = 7, color = "#a0724a", intensity = 0.15 } = opts;
  const canvas = createCanvas(size);
  const ctx = canvas.getContext("2d");
  const imgData = ctx.createImageData(size, size);
  const d = imgData.data;

  const rng = seeded(seed);
  const gridSize = Math.max(4, Math.floor(scale));
  const grid = makeNoiseGrid(gridSize, rng);
  const base = hexToRgb(color);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const nx = (x / size) * gridSize;
      const ny = (y / size) * gridSize;
      const n = fbmNoise(grid, gridSize, nx, ny, 3);

      // Ring pattern based on distance from center + noise distortion
      const dx = x / size - 0.5;
      const dy = y / size - 0.5;
      const dist = Math.sqrt(dx * dx + dy * dy) * scale + n * 3;
      const ring = (Math.sin(dist * 12) * 0.5 + 0.5); // 0..1

      const bright = 1.0 - ring * intensity;
      const idx = (y * size + x) * 4;
      d[idx]     = Math.min(255, Math.max(0, base[0] * bright));
      d[idx + 1] = Math.min(255, Math.max(0, base[1] * bright));
      d[idx + 2] = Math.min(255, Math.max(0, base[2] * bright));
      d[idx + 3] = 255;
    }
  }
  ctx.putImageData(imgData, 0, 0);

  const tex = canvasToTexture(canvas);
  tex.name = "ProceduralWood";
  return tex;
}

/**
 * Marble vein texture.
 * @param {{ size?: number, scale?: number, seed?: number, color?: string, veinColor?: string, intensity?: number }} opts
 * @returns {THREE.CanvasTexture}
 */
export function marble(opts = {}) {
  const { size = 256, scale = 4, seed = 33, color = "#f0ebe3", veinColor = "#888880", intensity = 0.08 } = opts;
  const canvas = createCanvas(size);
  const ctx = canvas.getContext("2d");
  const imgData = ctx.createImageData(size, size);
  const d = imgData.data;

  const rng = seeded(seed);
  const gridSize = Math.max(4, scale * 4);
  const grid = makeNoiseGrid(gridSize, rng);
  const base = hexToRgb(color);
  const vein = hexToRgb(veinColor);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const nx = (x / size) * gridSize;
      const ny = (y / size) * gridSize;
      const n = fbmNoise(grid, gridSize, nx, ny, 5);

      // Marble: sin(x * scale + noise) creates vein-like streaks
      const veinVal = Math.sin((x / size) * scale * Math.PI * 2 + n * 8) * 0.5 + 0.5;
      const t = Math.pow(veinVal, 3) * intensity * 10; // sharpen veins
      const tc = Math.min(1, Math.max(0, t));

      const idx = (y * size + x) * 4;
      const [r, g, b] = lerpRGB(base[0], base[1], base[2], vein[0], vein[1], vein[2], tc);
      d[idx]     = Math.min(255, r);
      d[idx + 1] = Math.min(255, g);
      d[idx + 2] = Math.min(255, b);
      d[idx + 3] = 255;
    }
  }
  ctx.putImageData(imgData, 0, 0);

  const tex = canvasToTexture(canvas);
  tex.name = "ProceduralMarble";
  return tex;
}

/**
 * Linear or radial gradient texture.
 * @param {{ size?: number, colorA?: string, colorB?: string, radial?: boolean }} opts
 * @returns {THREE.CanvasTexture}
 */
export function gradient(opts = {}) {
  const { size = 256, colorA = "#000000", colorB = "#ffffff", radial = false } = opts;
  const canvas = createCanvas(size);
  const ctx = canvas.getContext("2d");

  let grad;
  if (radial) {
    grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  } else {
    grad = ctx.createLinearGradient(0, 0, size, size);
  }
  grad.addColorStop(0, colorA);
  grad.addColorStop(1, colorB);

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  const tex = canvasToTexture(canvas);
  tex.name = "ProceduralGradient";
  return tex;
}

/**
 * Grid / wireframe-style texture.
 * @param {{ size?: number, scale?: number, lineWidth?: number, lineColor?: string, bgColor?: string }} opts
 * @returns {THREE.CanvasTexture}
 */
export function grid(opts = {}) {
  const { size = 256, scale = 8, lineWidth = 1, lineColor = "#666666", bgColor = "#222222" } = opts;
  const canvas = createCanvas(size);
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, size, size);

  ctx.strokeStyle = lineColor;
  ctx.lineWidth = lineWidth;
  const cell = size / scale;

  for (let i = 0; i <= scale; i++) {
    const p = i * cell;
    ctx.beginPath(); ctx.moveTo(p, 0); ctx.lineTo(p, size); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, p); ctx.lineTo(size, p); ctx.stroke();
  }

  const tex = canvasToTexture(canvas);
  tex.name = "ProceduralGrid";
  return tex;
}

/**
 * Brick pattern texture.
 * @param {{ size?: number, rows?: number, cols?: number, brickColor?: string, mortarColor?: string, mortarWidth?: number }} opts
 * @returns {THREE.CanvasTexture}
 */
export function bricks(opts = {}) {
  const { size = 256, rows = 8, cols = 4, brickColor = "#b5651d", mortarColor = "#999999", mortarWidth = 2 } = opts;
  const canvas = createCanvas(size);
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = mortarColor;
  ctx.fillRect(0, 0, size, size);

  const bH = size / rows;
  const bW = size / cols;

  ctx.fillStyle = brickColor;
  for (let r = 0; r < rows; r++) {
    const offset = r % 2 === 0 ? 0 : bW * 0.5;
    for (let c = -1; c <= cols; c++) {
      const x = offset + c * bW + mortarWidth / 2;
      const y = r * bH + mortarWidth / 2;
      ctx.fillRect(x, y, bW - mortarWidth, bH - mortarWidth);
    }
  }

  const tex = canvasToTexture(canvas);
  tex.name = "ProceduralBricks";
  return tex;
}

/**
 * Dot / halftone pattern texture.
 * @param {{ size?: number, scale?: number, dotSize?: number, color?: string, bgColor?: string }} opts
 * @returns {THREE.CanvasTexture}
 */
export function dots(opts = {}) {
  const { size = 256, scale = 12, dotSize = 0.3, color = "#ffffff", bgColor = "#000000" } = opts;
  const canvas = createCanvas(size);
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, size, size);

  ctx.fillStyle = color;
  const cell = size / scale;
  const radius = (cell * dotSize) / 2;

  for (let y = 0; y < scale; y++) {
    for (let x = 0; x < scale; x++) {
      ctx.beginPath();
      ctx.arc(x * cell + cell / 2, y * cell + cell / 2, radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  const tex = canvasToTexture(canvas);
  tex.name = "ProceduralDots";
  return tex;
}

/* ═══════════════════════════════════════════════════════════════════════════
   APPLY TO MATERIAL — attach a procedural texture to a material map slot
   ═══════════════════════════════════════════════════════════════════════ */

/**
 * Apply a texture descriptor from a material preset to a material.
 * @param {THREE.MeshStandardMaterial} material
 * @param {{ type: string, scale?: number, intensity?: number, channel?: string, [key: string]: any }} descriptor
 */
export function applyTextureDescriptor(material, descriptor) {
  if (!descriptor || !descriptor.type) return;

  const generatorMap = {
    checkerboard,
    noise,
    wood,
    marble,
    gradient,
    grid,
    bricks,
    dots,
  };

  const genFn = generatorMap[descriptor.type];
  if (!genFn) {
    console.warn(`[TextureGenerator] Unknown type: ${descriptor.type}`);
    return;
  }

  const tex = genFn(descriptor);
  const channel = descriptor.channel || "color";

  switch (channel) {
    case "color":
      material.map = tex;
      break;
    case "roughness":
      material.roughnessMap = tex;
      break;
    case "metalness":
      material.metalnessMap = tex;
      break;
    case "emissive":
      material.emissiveMap = tex;
      break;
    case "normal":
      material.normalMap = tex;
      break;
    case "ao":
      material.aoMap = tex;
      break;
    default:
      material.map = tex;
  }

  material.needsUpdate = true;
}

/* ═══════════════════════════════════════════════════════════════════════════
   TEXTURE CATALOG — for UI browsing
   ═══════════════════════════════════════════════════════════════════════ */

export const TEXTURE_CATALOG = [
  { id: "checkerboard", label: "Checkerboard", icon: "🏁", fn: checkerboard },
  { id: "noise",        label: "Noise",        icon: "📡", fn: noise },
  { id: "wood",         label: "Wood Grain",   icon: "🪵", fn: wood },
  { id: "marble",       label: "Marble",       icon: "🪨", fn: marble },
  { id: "gradient",     label: "Gradient",     icon: "🌈", fn: gradient },
  { id: "grid",         label: "Grid",         icon: "#️⃣", fn: grid },
  { id: "bricks",       label: "Bricks",       icon: "🧱", fn: bricks },
  { id: "dots",         label: "Dots",         icon: "⚪", fn: dots },
];

export default {
  checkerboard,
  noise,
  wood,
  marble,
  gradient,
  grid,
  bricks,
  dots,
  applyTextureDescriptor,
  TEXTURE_CATALOG,
};
