// src/engine/ProceduralGenerator.js
// ---------------------------------------------------------------------------
// Phase 5 — Procedural geometry generation engine.
// Creates parametric shapes / structures that would be tedious to build
// manually: stairs, walls, floors, terrain, scatter patterns, arrays, grids.
// All geometry is created as plain Three.js BufferGeometry + MeshStandardMaterial
// and returned as THREE.Mesh / THREE.Group ready to be added to the scene.
// ---------------------------------------------------------------------------

import * as THREE from "three";

/* ═══════════════════════════════════════════════════════════════════════════
   1. PARAMETRIC PRIMITIVES
   ═══════════════════════════════════════════════════════════════════════ */

/**
 * Create a staircase group.
 * @param {{ steps?: number, width?: number, stepHeight?: number, stepDepth?: number, color?: string }} opts
 * @returns {THREE.Group}
 */
export function generateStairs(opts = {}) {
  const {
    steps = 10,
    width = 2,
    stepHeight = 0.25,
    stepDepth = 0.3,
    color = "#a0a0a0",
  } = opts;

  const group = new THREE.Group();
  group.name = "ProceduralStairs";

  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0.05 });

  for (let i = 0; i < steps; i++) {
    const geo = new THREE.BoxGeometry(width, stepHeight, stepDepth);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(0, stepHeight * (i + 0.5), -stepDepth * i);
    mesh.name = `Step_${i + 1}`;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }

  return group;
}

/**
 * Create a brick wall.
 * @param {{ rows?: number, cols?: number, brickW?: number, brickH?: number, brickD?: number, gap?: number, color?: string }} opts
 * @returns {THREE.Group}
 */
export function generateWall(opts = {}) {
  const {
    rows = 6,
    cols = 8,
    brickW = 0.4,
    brickH = 0.2,
    brickD = 0.2,
    gap = 0.02,
    color = "#b5651d",
  } = opts;

  const group = new THREE.Group();
  group.name = "ProceduralWall";

  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0 });
  const unitW = brickW + gap;
  const unitH = brickH + gap;

  for (let r = 0; r < rows; r++) {
    const offset = r % 2 === 0 ? 0 : unitW * 0.5; // staggered
    for (let c = 0; c < cols; c++) {
      const geo = new THREE.BoxGeometry(brickW, brickH, brickD);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(offset + unitW * c - (unitW * cols) / 2, unitH * r + brickH / 2, 0);
      mesh.name = `Brick_${r}_${c}`;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
    }
  }

  return group;
}

/**
 * Create a floor / ground plane.
 * @param {{ width?: number, depth?: number, segments?: number, color?: string, tileCount?: number }} opts
 * @returns {THREE.Mesh}
 */
export function generateFloor(opts = {}) {
  const {
    width = 10,
    depth = 10,
    segments = 1,
    color = "#e0ddd4",
    tileCount = 0,
  } = opts;

  // Simple floor — optionally tiled
  if (tileCount > 0) {
    const group = new THREE.Group();
    group.name = "ProceduralTiledFloor";
    const tileW = width / tileCount;
    const tileD = depth / tileCount;
    const colors = [color, shiftColor(color, -12)];
    for (let x = 0; x < tileCount; x++) {
      for (let z = 0; z < tileCount; z++) {
        const geo = new THREE.BoxGeometry(tileW * 0.98, 0.02, tileD * 0.98);
        const mat = new THREE.MeshStandardMaterial({
          color: colors[(x + z) % 2],
          roughness: 0.5,
          metalness: 0,
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(
          tileW * x - width / 2 + tileW / 2,
          0,
          tileD * z - depth / 2 + tileD / 2,
        );
        mesh.receiveShadow = true;
        mesh.name = `Tile_${x}_${z}`;
        group.add(mesh);
      }
    }
    return group;
  }

  const geo = new THREE.PlaneGeometry(width, depth, segments, segments);
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.receiveShadow = true;
  mesh.name = "ProceduralFloor";
  return mesh;
}

/* ═══════════════════════════════════════════════════════════════════════════
   2. TERRAIN
   ═══════════════════════════════════════════════════════════════════════ */

/**
 * Generate a heightmap terrain using simplex-like noise.
 * @param {{ size?: number, segments?: number, height?: number, color?: string, seed?: number }} opts
 * @returns {THREE.Mesh}
 */
export function generateTerrain(opts = {}) {
  const {
    size = 20,
    segments = 64,
    height = 3,
    color = "#5a7d3a",
    seed = 42,
  } = opts;

  const geo = new THREE.PlaneGeometry(size, size, segments, segments);
  geo.rotateX(-Math.PI / 2);

  const pos = geo.attributes.position;
  const rng = seededRandom(seed);
  // Multi-octave value noise
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    let h = 0;
    h += valueNoise2D(x * 0.15, z * 0.15, rng) * height;
    h += valueNoise2D(x * 0.4, z * 0.4, rng) * height * 0.3;
    h += valueNoise2D(x * 1.0, z * 1.0, rng) * height * 0.08;
    pos.setY(i, h);
  }
  geo.computeVertexNormals();

  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.9, metalness: 0, flatShading: true });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.name = "ProceduralTerrain";
  return mesh;
}

/* ═══════════════════════════════════════════════════════════════════════════
   3. SCATTER & ARRAY
   ═══════════════════════════════════════════════════════════════════════ */

/**
 * Scatter copies of a source mesh over a given area.
 * @param {THREE.Mesh} source       — mesh to clone
 * @param {{ count?: number, area?: number, scaleRange?: [number,number], seed?: number }} opts
 * @returns {THREE.Group}
 */
export function scatter(source, opts = {}) {
  const {
    count = 20,
    area = 10,
    scaleRange = [0.8, 1.3],
    seed = 7,
  } = opts;

  const group = new THREE.Group();
  group.name = "ProceduralScatter";
  const rng = seededRandom(seed);
  const half = area / 2;

  for (let i = 0; i < count; i++) {
    const clone = source.clone();
    clone.material = source.material.clone();
    clone.position.set(
      (rng() - 0.5) * area,
      0,
      (rng() - 0.5) * area,
    );
    const s = scaleRange[0] + rng() * (scaleRange[1] - scaleRange[0]);
    clone.scale.setScalar(s);
    clone.rotation.y = rng() * Math.PI * 2;
    clone.name = `${source.name || "Scatter"}_${i + 1}`;
    clone.castShadow = true;
    group.add(clone);
  }

  return group;
}

/**
 * Create a linear or grid array of a source mesh.
 * @param {THREE.Mesh} source
 * @param {{ countX?: number, countY?: number, countZ?: number, spacingX?: number, spacingY?: number, spacingZ?: number }} opts
 * @returns {THREE.Group}
 */
export function array(source, opts = {}) {
  const {
    countX = 3, countY = 1, countZ = 1,
    spacingX = 2, spacingY = 2, spacingZ = 2,
  } = opts;

  const group = new THREE.Group();
  group.name = "ProceduralArray";

  for (let x = 0; x < countX; x++) {
    for (let y = 0; y < countY; y++) {
      for (let z = 0; z < countZ; z++) {
        if (x === 0 && y === 0 && z === 0) continue; // skip origin (original stays)
        const clone = source.clone();
        clone.material = source.material.clone();
        clone.position.set(x * spacingX, y * spacingY, z * spacingZ);
        clone.name = `${source.name || "Array"}_${x}_${y}_${z}`;
        clone.castShadow = true;
        group.add(clone);
      }
    }
  }

  return group;
}

/**
 * Create a circular array.
 * @param {THREE.Mesh} source
 * @param {{ count?: number, radius?: number, faceCenter?: boolean }} opts
 * @returns {THREE.Group}
 */
export function circularArray(source, opts = {}) {
  const { count = 8, radius = 3, faceCenter = true } = opts;

  const group = new THREE.Group();
  group.name = "ProceduralCircularArray";

  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2;
    const clone = source.clone();
    clone.material = source.material.clone();
    clone.position.set(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
    if (faceCenter) clone.rotation.y = -angle + Math.PI;
    clone.name = `${source.name || "Ring"}_${i + 1}`;
    clone.castShadow = true;
    group.add(clone);
  }

  return group;
}

/* ═══════════════════════════════════════════════════════════════════════════
   4. ARCHITECTURAL HELPERS
   ═══════════════════════════════════════════════════════════════════════ */

/**
 * Generate a simple room (4 walls + floor + optional ceiling).
 * @param {{ width?: number, depth?: number, height?: number, wallThickness?: number, ceiling?: boolean, wallColor?: string, floorColor?: string }} opts
 * @returns {THREE.Group}
 */
export function generateRoom(opts = {}) {
  const {
    width = 6,
    depth = 6,
    height = 3,
    wallThickness = 0.15,
    ceiling = false,
    wallColor = "#ddd8ce",
    floorColor = "#c8c0b4",
  } = opts;

  const group = new THREE.Group();
  group.name = "ProceduralRoom";

  const wallMat = new THREE.MeshStandardMaterial({ color: wallColor, roughness: 0.75, metalness: 0 });
  const floorMat = new THREE.MeshStandardMaterial({ color: floorColor, roughness: 0.6, metalness: 0 });

  // Floor
  const floor = new THREE.Mesh(new THREE.BoxGeometry(width, 0.05, depth), floorMat);
  floor.name = "Room_Floor";
  floor.receiveShadow = true;
  group.add(floor);

  // Walls: front, back, left, right
  const walls = [
    { pos: [0, height / 2, -depth / 2], size: [width, height, wallThickness], name: "BackWall" },
    { pos: [0, height / 2, depth / 2],  size: [width, height, wallThickness], name: "FrontWall" },
    { pos: [-width / 2, height / 2, 0], size: [wallThickness, height, depth], name: "LeftWall" },
    { pos: [width / 2, height / 2, 0],  size: [wallThickness, height, depth], name: "RightWall" },
  ];

  for (const w of walls) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(...w.size), wallMat);
    mesh.position.set(...w.pos);
    mesh.name = `Room_${w.name}`;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }

  // Ceiling
  if (ceiling) {
    const ceil = new THREE.Mesh(new THREE.BoxGeometry(width, 0.05, depth), wallMat);
    ceil.position.y = height;
    ceil.name = "Room_Ceiling";
    ceil.receiveShadow = true;
    group.add(ceil);
  }

  return group;
}

/**
 * Generate a column / pillar.
 * @param {{ radius?: number, height?: number, segments?: number, color?: string, fluted?: boolean }} opts
 * @returns {THREE.Mesh | THREE.Group}
 */
export function generateColumn(opts = {}) {
  const {
    radius = 0.25,
    height = 3,
    segments = 16,
    color = "#d4cfc5",
    fluted = false,
  } = opts;

  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.4, metalness: 0.05 });

  if (!fluted) {
    const geo = new THREE.CylinderGeometry(radius, radius, height, segments);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.y = height / 2;
    mesh.name = "ProceduralColumn";
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }

  // Fluted column — cylinder with carved grooves represented as a group
  const group = new THREE.Group();
  group.name = "ProceduralFlutedColumn";

  // Main shaft
  const shaft = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, height, segments),
    mat,
  );
  shaft.position.y = height / 2;
  shaft.name = "Column_Shaft";
  shaft.castShadow = true;
  group.add(shaft);

  // Base & capital
  const baseMat = mat.clone();
  const baseGeo = new THREE.CylinderGeometry(radius * 1.3, radius * 1.4, 0.15, segments);
  const base = new THREE.Mesh(baseGeo, baseMat);
  base.position.y = 0.075;
  base.name = "Column_Base";
  base.receiveShadow = true;
  group.add(base);

  const capGeo = new THREE.CylinderGeometry(radius * 1.4, radius * 1.3, 0.15, segments);
  const cap = new THREE.Mesh(capGeo, baseMat);
  cap.position.y = height - 0.075;
  cap.name = "Column_Capital";
  cap.receiveShadow = true;
  group.add(cap);

  return group;
}

/* ═══════════════════════════════════════════════════════════════════════════
   5. HELPER UTILITIES
   ═══════════════════════════════════════════════════════════════════════ */

/** Simple seeded PRNG (mulberry32). */
function seededRandom(seed) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 2D value noise. */
function valueNoise2D(x, z, rng) {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fz = z - iz;
  const hash = (a, b) => {
    let h = ((a * 374761393 + b * 668265263 + 1013904223) | 0);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  };
  const n00 = hash(ix, iz);
  const n10 = hash(ix + 1, iz);
  const n01 = hash(ix, iz + 1);
  const n11 = hash(ix + 1, iz + 1);
  const sx = fx * fx * (3 - 2 * fx);
  const sz = fz * fz * (3 - 2 * fz);
  return (n00 * (1 - sx) + n10 * sx) * (1 - sz) + (n01 * (1 - sx) + n11 * sx) * sz;
}

/** Slightly shift a hex color's lightness. */
function shiftColor(hex, amount) {
  const c = new THREE.Color(hex);
  const hsl = {};
  c.getHSL(hsl);
  hsl.l = Math.max(0, Math.min(1, hsl.l + amount / 100));
  c.setHSL(hsl.h, hsl.s, hsl.l);
  return "#" + c.getHexString();
}

/* ═══════════════════════════════════════════════════════════════════════════
   CATALOG — used by UI to list available generators
   ═══════════════════════════════════════════════════════════════════════ */

export const PROCEDURAL_CATALOG = [
  {
    id: "stairs",
    label: "Staircase",
    icon: "🪜",
    fn: generateStairs,
    params: [
      { key: "steps",      label: "Steps",       type: "int",    min: 2, max: 50, default: 10 },
      { key: "width",      label: "Width",        type: "float",  min: 0.5, max: 10, default: 2 },
      { key: "stepHeight", label: "Step Height",  type: "float",  min: 0.05, max: 1, default: 0.25 },
      { key: "stepDepth",  label: "Step Depth",   type: "float",  min: 0.1, max: 1, default: 0.3 },
      { key: "color",      label: "Color",        type: "color",  default: "#a0a0a0" },
    ],
  },
  {
    id: "wall",
    label: "Brick Wall",
    icon: "🧱",
    fn: generateWall,
    params: [
      { key: "rows",   label: "Rows",        type: "int",   min: 1, max: 30, default: 6 },
      { key: "cols",   label: "Columns",      type: "int",   min: 1, max: 30, default: 8 },
      { key: "brickW", label: "Brick Width",  type: "float", min: 0.1, max: 2, default: 0.4 },
      { key: "brickH", label: "Brick Height", type: "float", min: 0.05, max: 1, default: 0.2 },
      { key: "gap",    label: "Gap",          type: "float", min: 0, max: 0.1, default: 0.02 },
      { key: "color",  label: "Color",        type: "color", default: "#b5651d" },
    ],
  },
  {
    id: "floor",
    label: "Floor / Ground",
    icon: "⬜",
    fn: generateFloor,
    params: [
      { key: "width",     label: "Width",      type: "float", min: 1, max: 100, default: 10 },
      { key: "depth",     label: "Depth",      type: "float", min: 1, max: 100, default: 10 },
      { key: "tileCount", label: "Tile Count", type: "int",   min: 0, max: 50, default: 0 },
      { key: "color",     label: "Color",      type: "color", default: "#e0ddd4" },
    ],
  },
  {
    id: "terrain",
    label: "Terrain",
    icon: "⛰️",
    fn: generateTerrain,
    params: [
      { key: "size",     label: "Size",      type: "float", min: 5, max: 100, default: 20 },
      { key: "segments", label: "Segments",  type: "int",   min: 8, max: 256, default: 64 },
      { key: "height",   label: "Height",    type: "float", min: 0.5, max: 20, default: 3 },
      { key: "seed",     label: "Seed",      type: "int",   min: 0, max: 9999, default: 42 },
      { key: "color",    label: "Color",     type: "color", default: "#5a7d3a" },
    ],
  },
  {
    id: "room",
    label: "Room",
    icon: "🏠",
    fn: generateRoom,
    params: [
      { key: "width",   label: "Width",    type: "float", min: 2, max: 30, default: 6 },
      { key: "depth",   label: "Depth",    type: "float", min: 2, max: 30, default: 6 },
      { key: "height",  label: "Height",   type: "float", min: 1.5, max: 10, default: 3 },
      { key: "ceiling", label: "Ceiling",  type: "bool",  default: false },
      { key: "wallColor",  label: "Wall Color",  type: "color", default: "#ddd8ce" },
      { key: "floorColor", label: "Floor Color", type: "color", default: "#c8c0b4" },
    ],
  },
  {
    id: "column",
    label: "Column",
    icon: "🏛️",
    fn: generateColumn,
    params: [
      { key: "radius",  label: "Radius",   type: "float", min: 0.1, max: 2, default: 0.25 },
      { key: "height",  label: "Height",   type: "float", min: 0.5, max: 20, default: 3 },
      { key: "segments",label: "Segments", type: "int",   min: 6, max: 64, default: 16 },
      { key: "fluted",  label: "Fluted",   type: "bool",  default: false },
      { key: "color",   label: "Color",    type: "color", default: "#d4cfc5" },
    ],
  },
];

export default {
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
};
