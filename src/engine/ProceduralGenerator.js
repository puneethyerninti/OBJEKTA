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
  group.userData.__objekta = true;

  for (let i = 0; i < steps; i++) {
    const geo = new THREE.BoxGeometry(width, stepHeight, stepDepth);
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0.05 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(0, stepHeight * (i + 0.5), -stepDepth * i);
    mesh.name = `Step_${i + 1}`;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.__objekta = true;
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
  group.userData.__objekta = true;

  const unitW = brickW + gap;
  const unitH = brickH + gap;

  for (let r = 0; r < rows; r++) {
    const offset = r % 2 === 0 ? 0 : unitW * 0.5; // staggered
    for (let c = 0; c < cols; c++) {
      const geo = new THREE.BoxGeometry(brickW, brickH, brickD);
      const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0 });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(offset + unitW * c - (unitW * cols) / 2, unitH * r + brickH / 2, 0);
      mesh.name = `Brick_${r}_${c}`;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.userData.__objekta = true;
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
    group.userData.__objekta = true;
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
        mesh.userData.__objekta = true;
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
  mesh.userData.__objekta = true;
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
  mesh.userData.__objekta = true;
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
  group.userData.__objekta = true;
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
    clone.userData.__objekta = true;
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
  group.userData.__objekta = true;

  for (let x = 0; x < countX; x++) {
    for (let y = 0; y < countY; y++) {
      for (let z = 0; z < countZ; z++) {
        if (x === 0 && y === 0 && z === 0) continue; // skip origin (original stays)
        const clone = source.clone();
        clone.material = source.material.clone();
        clone.position.set(x * spacingX, y * spacingY, z * spacingZ);
        clone.name = `${source.name || "Array"}_${x}_${y}_${z}`;
        clone.castShadow = true;
        clone.userData.__objekta = true;
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
  group.userData.__objekta = true;

  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2;
    const clone = source.clone();
    clone.material = source.material.clone();
    clone.position.set(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
    if (faceCenter) clone.rotation.y = -angle + Math.PI;
    clone.name = `${source.name || "Ring"}_${i + 1}`;
    clone.castShadow = true;
    clone.userData.__objekta = true;
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
  group.userData.__objekta = true;

  const floorMat = new THREE.MeshStandardMaterial({ color: floorColor, roughness: 0.6, metalness: 0 });

  // Floor
  const floor = new THREE.Mesh(new THREE.BoxGeometry(width, 0.05, depth), floorMat);
  floor.name = "Room_Floor";
  floor.receiveShadow = true;
  floor.userData.__objekta = true;
  group.add(floor);

  // Walls: front, back, left, right
  const walls = [
    { pos: [0, height / 2, -depth / 2], size: [width, height, wallThickness], name: "BackWall" },
    { pos: [0, height / 2, depth / 2],  size: [width, height, wallThickness], name: "FrontWall" },
    { pos: [-width / 2, height / 2, 0], size: [wallThickness, height, depth], name: "LeftWall" },
    { pos: [width / 2, height / 2, 0],  size: [wallThickness, height, depth], name: "RightWall" },
  ];

  for (const w of walls) {
    const wallMat = new THREE.MeshStandardMaterial({ color: wallColor, roughness: 0.75, metalness: 0 });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(...w.size), wallMat);
    mesh.position.set(...w.pos);
    mesh.name = `Room_${w.name}`;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.__objekta = true;
    group.add(mesh);
  }

  // Ceiling
  if (ceiling) {
    const ceilMat = new THREE.MeshStandardMaterial({ color: wallColor, roughness: 0.75, metalness: 0 });
    const ceil = new THREE.Mesh(new THREE.BoxGeometry(width, 0.05, depth), ceilMat);
    ceil.position.y = height;
    ceil.name = "Room_Ceiling";
    ceil.receiveShadow = true;
    ceil.userData.__objekta = true;
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
    mesh.userData.__objekta = true;
    return mesh;
  }

  // Fluted column — cylinder with carved grooves represented as a group
  const group = new THREE.Group();
  group.name = "ProceduralFlutedColumn";
  group.userData.__objekta = true;

  // Main shaft
  const shaft = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, height, segments),
    mat,
  );
  shaft.position.y = height / 2;
  shaft.name = "Column_Shaft";
  shaft.castShadow = true;
  shaft.userData.__objekta = true;
  group.add(shaft);

  // Base & capital
  const baseMat = mat.clone();
  const baseGeo = new THREE.CylinderGeometry(radius * 1.3, radius * 1.4, 0.15, segments);
  const base = new THREE.Mesh(baseGeo, baseMat);
  base.position.y = 0.075;
  base.name = "Column_Base";
  base.receiveShadow = true;
  base.userData.__objekta = true;
  group.add(base);

  const capMat = mat.clone();
  const capGeo = new THREE.CylinderGeometry(radius * 1.4, radius * 1.3, 0.15, segments);
  const cap = new THREE.Mesh(capGeo, capMat);
  cap.position.y = height - 0.075;
  cap.name = "Column_Capital";
  cap.receiveShadow = true;
  cap.userData.__objekta = true;
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
   6. ADVANCED PROCEDURAL GENERATORS
   ═══════════════════════════════════════════════════════════════════════ */

/** 3D value noise (hash-based, no external deps). */
function valueNoise3D(x, y, z) {
  const hash = (a, b, c) => {
    let h = ((a * 374761393 + b * 668265263 + c * 1013904223 + 1376312589) | 0);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  };
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
  const fx = x - ix, fy = y - iy, fz = z - iz;
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy), sz = fz * fz * (3 - 2 * fz);
  const n000 = hash(ix, iy, iz),     n100 = hash(ix+1, iy, iz);
  const n010 = hash(ix, iy+1, iz),   n110 = hash(ix+1, iy+1, iz);
  const n001 = hash(ix, iy, iz+1),   n101 = hash(ix+1, iy, iz+1);
  const n011 = hash(ix, iy+1, iz+1), n111 = hash(ix+1, iy+1, iz+1);
  const nx00 = n000 * (1-sx) + n100 * sx, nx10 = n010 * (1-sx) + n110 * sx;
  const nx01 = n001 * (1-sx) + n101 * sx, nx11 = n011 * (1-sx) + n111 * sx;
  const nxy0 = nx00 * (1-sy) + nx10 * sy, nxy1 = nx01 * (1-sy) + nx11 * sy;
  return nxy0 * (1-sz) + nxy1 * sz;
}

/**
 * Menger Sponge fractal.
 * @param {{ iterations?: number, size?: number, color?: string }} opts
 * @returns {THREE.Mesh}
 */
export function generateFractal(opts = {}) {
  const { iterations = 2, size = 2, color = "#8b5cf6" } = opts;
  const iter = Math.min(Math.max(1, iterations), 3); // clamp for performance
  const geo = new THREE.BoxGeometry(1, 1, 1);
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.4, metalness: 0.3 });

  // Build menger sponge by merging box geometries
  function mengerPositions(depth, cx, cy, cz, half) {
    if (depth === 0) return [[cx, cy, cz, half]];
    const positions = [];
    const third = half / 3;
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        for (let dz = -1; dz <= 1; dz++) {
          const zeros = (dx === 0 ? 1 : 0) + (dy === 0 ? 1 : 0) + (dz === 0 ? 1 : 0);
          if (zeros >= 2) continue; // remove cross-shaped holes
          positions.push(...mengerPositions(depth - 1, cx + dx * third * 2, cy + dy * third * 2, cz + dz * third * 2, third));
        }
      }
    }
    return positions;
  }

  const cubes = mengerPositions(iter, 0, 0, 0, size / 2);
  const merged = new THREE.BufferGeometry();
  const matrices = cubes.map(([x, y, z, h]) => {
    const m = new THREE.Matrix4();
    m.makeScale(h * 2, h * 2, h * 2);
    m.setPosition(x, y, z);
    return m;
  });

  // Merge all cube geometries
  const geos = matrices.map((m) => {
    const g = geo.clone();
    g.applyMatrix4(m);
    return g;
  });

  const mergedGeo = geos.length > 0 ? mergeBufferGeometries(geos) : geo.clone();
  const mesh = new THREE.Mesh(mergedGeo, mat);
  mesh.name = "ProceduralFractal";
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData.__objekta = true;
  return mesh;
}

/** Simple merge of BufferGeometries by concatenating attribute arrays. */
function mergeBufferGeometries(geometries) {
  // First convert all to non-indexed and compute normals
  const converted = geometries.map((g) => {
    const ni = g.index ? g.toNonIndexed() : g;
    if (!ni.attributes.normal) ni.computeVertexNormals();
    return ni;
  });

  let totalVerts = 0;
  for (const g of converted) totalVerts += g.attributes.position.count;

  const positions = new Float32Array(totalVerts * 3);
  const normals = new Float32Array(totalVerts * 3);
  let offset = 0;

  for (const g of converted) {
    const count = g.attributes.position.count;
    positions.set(g.attributes.position.array.subarray(0, count * 3), offset * 3);
    normals.set(g.attributes.normal.array.subarray(0, count * 3), offset * 3);
    offset += count;
  }

  const merged = new THREE.BufferGeometry();
  merged.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  merged.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
  return merged;
}

/**
 * Ridged multifractal terrain.
 * @param {{ size?: number, segments?: number, height?: number, seed?: number, ridgeness?: number, color?: string }} opts
 * @returns {THREE.Mesh}
 */
export function generateRidgedTerrain(opts = {}) {
  const { size = 20, segments = 64, height = 5, seed = 42, ridgeness = 0.8, color = "#6b7c3c" } = opts;
  const geo = new THREE.PlaneGeometry(size, size, segments, segments);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const rng = seededRandom(seed);
  const octaves = 4;
  const lacunarity = 2.0;
  const gain = 0.5;

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    let h = 0, amp = 1, freq = 0.15;
    for (let o = 0; o < octaves; o++) {
      let n = valueNoise2D(x * freq + seed, z * freq + seed);
      // Ridged noise: invert and square
      n = 1.0 - Math.abs(n * 2 - 1);
      n = Math.pow(n, 1 + ridgeness * 2);
      h += n * amp;
      freq *= lacunarity;
      amp *= gain;
    }
    pos.setY(i, h * height);
  }

  pos.needsUpdate = true;
  geo.computeVertexNormals();

  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0, flatShading: true });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = "ProceduralRidgedTerrain";
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData.__objekta = true;
  return mesh;
}

/**
 * Simple L-system branching tree.
 * @param {{ depth?: number, trunkRadius?: number, trunkHeight?: number, branchAngle?: number, branchScale?: number, color?: string, leafColor?: string }} opts
 * @returns {THREE.Group}
 */
export function generateTree(opts = {}) {
  const {
    depth = 4,
    trunkRadius = 0.15,
    trunkHeight = 2,
    branchAngle = 30,
    branchScale = 0.7,
    color = "#5c3d1e",
    leafColor = "#3a7d2e",
  } = opts;

  const group = new THREE.Group();
  group.name = "ProceduralTree";
  group.userData.__objekta = true;
  const trunkMat = new THREE.MeshStandardMaterial({ color, roughness: 0.9, metalness: 0 });
  const leafMat = new THREE.MeshStandardMaterial({ color: leafColor, roughness: 0.7, metalness: 0 });

  function addBranch(parent, d, radius, height, rng) {
    const geo = new THREE.CylinderGeometry(radius * 0.7, radius, height, 6);
    geo.translate(0, height / 2, 0);
    const mesh = new THREE.Mesh(geo, trunkMat);
    mesh.name = `Branch_d${d}`;
    mesh.castShadow = true;
    mesh.userData.__objekta = true;
    parent.add(mesh);

    if (d <= 0) {
      // Add leaf sphere at tip
      const leafGeo = new THREE.IcosahedronGeometry(radius * 4, 1);
      const leaf = new THREE.Mesh(leafGeo, leafMat);
      leaf.position.y = height;
      leaf.name = "Leaf";
      leaf.castShadow = true;
      leaf.userData.__objekta = true;
      mesh.add(leaf);
      return;
    }

    const angleRad = (branchAngle * Math.PI) / 180;
    const branches = d > 2 ? 3 : 2;
    for (let i = 0; i < branches; i++) {
      const child = new THREE.Group();
      child.position.y = height;
      const azimuth = (i / branches) * Math.PI * 2 + (rng() - 0.5) * 0.5;
      child.rotation.z = angleRad * (0.8 + rng() * 0.4);
      child.rotation.y = azimuth;
      mesh.add(child);
      addBranch(child, d - 1, radius * branchScale, height * branchScale, rng);
    }
  }

  const rng = seededRandom(42);
  addBranch(group, Math.min(depth, 6), trunkRadius, trunkHeight, rng);
  return group;
}

/**
 * Crystal cluster.
 * @param {{ count?: number, size?: number, seed?: number, color?: string }} opts
 * @returns {THREE.Group}
 */
export function generateCrystal(opts = {}) {
  const { count = 5, size = 1, seed = 42, color = "#7dd3fc" } = opts;
  const rng = seededRandom(seed);
  const group = new THREE.Group();
  group.name = "ProceduralCrystal";
  group.userData.__objekta = true;
  const mat = new THREE.MeshStandardMaterial({
    color, roughness: 0.1, metalness: 0.6, transparent: true, opacity: 0.85,
  });

  for (let i = 0; i < Math.min(count, 20); i++) {
    const height = size * (0.5 + rng() * 1.5);
    const radius = size * (0.08 + rng() * 0.15);
    const sides = 4 + Math.floor(rng() * 4); // 4-7 sides
    const geo = new THREE.CylinderGeometry(0, radius, height, sides);
    geo.translate(0, height / 2, 0);
    const mesh = new THREE.Mesh(geo, mat.clone());
    mesh.position.set((rng() - 0.5) * size, 0, (rng() - 0.5) * size);
    mesh.rotation.z = (rng() - 0.5) * 0.4;
    mesh.rotation.x = (rng() - 0.5) * 0.4;
    mesh.name = `Crystal_${i}`;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.__objekta = true;
    group.add(mesh);
  }

  return group;
}

/**
 * Plasma sphere — sphere with vertex displacement from 3D noise.
 * @param {{ radius?: number, segments?: number, intensity?: number, frequency?: number, seed?: number, color?: string }} opts
 * @returns {THREE.Mesh}
 */
export function generatePlasma(opts = {}) {
  const { radius = 1, segments = 48, intensity = 0.3, frequency = 3, seed = 42, color = "#f472b6" } = opts;
  const geo = new THREE.SphereGeometry(radius, segments, segments);
  const pos = geo.attributes.position;
  const normal = geo.attributes.normal;

  for (let i = 0; i < pos.count; i++) {
    const nx = normal.getX(i), ny = normal.getY(i), nz = normal.getZ(i);
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const n = valueNoise3D(x * frequency + seed, y * frequency + seed, z * frequency + seed);
    const displacement = (n - 0.5) * 2 * intensity;
    pos.setXYZ(i, x + nx * displacement, y + ny * displacement, z + nz * displacement);
  }

  pos.needsUpdate = true;
  geo.computeVertexNormals();

  const mat = new THREE.MeshStandardMaterial({
    color, roughness: 0.3, metalness: 0.5, emissive: color, emissiveIntensity: 0.2,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = "ProceduralPlasma";
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData.__objekta = true;
  return mesh;
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
  {
    id: "fractal",
    label: "Fractal (Menger)",
    icon: "🔷",
    fn: generateFractal,
    params: [
      { key: "iterations", label: "Iterations", type: "int",   min: 1, max: 3, default: 2 },
      { key: "size",       label: "Size",       type: "float", min: 0.5, max: 10, default: 2 },
      { key: "color",      label: "Color",      type: "color", default: "#8b5cf6" },
    ],
  },
  {
    id: "ridgedTerrain",
    label: "Ridged Terrain",
    icon: "🏔️",
    fn: generateRidgedTerrain,
    params: [
      { key: "size",      label: "Size",      type: "float", min: 5, max: 100, default: 20 },
      { key: "segments",  label: "Segments",  type: "int",   min: 8, max: 256, default: 64 },
      { key: "height",    label: "Height",    type: "float", min: 0.5, max: 20, default: 5 },
      { key: "ridgeness", label: "Ridgeness", type: "float", min: 0, max: 2, default: 0.8 },
      { key: "seed",      label: "Seed",      type: "int",   min: 0, max: 9999, default: 42 },
      { key: "color",     label: "Color",     type: "color", default: "#6b7c3c" },
    ],
  },
  {
    id: "tree",
    label: "Tree (L-system)",
    icon: "🌳",
    fn: generateTree,
    params: [
      { key: "depth",       label: "Depth",        type: "int",   min: 1, max: 6, default: 4 },
      { key: "trunkRadius", label: "Trunk Radius",  type: "float", min: 0.05, max: 0.5, default: 0.15 },
      { key: "trunkHeight", label: "Trunk Height",  type: "float", min: 0.5, max: 5, default: 2 },
      { key: "branchAngle", label: "Branch Angle",  type: "float", min: 10, max: 60, default: 30 },
      { key: "branchScale", label: "Branch Scale",  type: "float", min: 0.4, max: 0.9, default: 0.7 },
      { key: "color",       label: "Trunk Color",   type: "color", default: "#5c3d1e" },
      { key: "leafColor",   label: "Leaf Color",    type: "color", default: "#3a7d2e" },
    ],
  },
  {
    id: "crystal",
    label: "Crystal Cluster",
    icon: "💎",
    fn: generateCrystal,
    params: [
      { key: "count", label: "Count", type: "int",   min: 1, max: 20, default: 5 },
      { key: "size",  label: "Size",  type: "float", min: 0.5, max: 5, default: 1 },
      { key: "seed",  label: "Seed",  type: "int",   min: 0, max: 9999, default: 42 },
      { key: "color", label: "Color", type: "color", default: "#7dd3fc" },
    ],
  },
  {
    id: "plasma",
    label: "Plasma Sphere",
    icon: "🔮",
    fn: generatePlasma,
    params: [
      { key: "radius",    label: "Radius",     type: "float", min: 0.5, max: 5, default: 1 },
      { key: "segments",  label: "Segments",   type: "int",   min: 16, max: 96, default: 48 },
      { key: "intensity", label: "Intensity",   type: "float", min: 0, max: 1, default: 0.3 },
      { key: "frequency", label: "Frequency",   type: "float", min: 1, max: 10, default: 3 },
      { key: "seed",      label: "Seed",        type: "int",   min: 0, max: 9999, default: 42 },
      { key: "color",     label: "Color",       type: "color", default: "#f472b6" },
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
  generateFractal,
  generateRidgedTerrain,
  generateTree,
  generateCrystal,
  generatePlasma,
  scatter,
  array,
  circularArray,
  PROCEDURAL_CATALOG,
};
