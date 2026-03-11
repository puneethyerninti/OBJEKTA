// src/engine/ScenePresets.js
// ---------------------------------------------------------------------------
// Phase 5 — Pre-built scene presets / templates.
// Each preset creates a fully configured group of objects + lights that
// represent a common scene setup a user might need as a starting point.
// ---------------------------------------------------------------------------

import * as THREE from "three";
import { generateFloor, generateRoom, generateColumn } from "./ProceduralGenerator";

/** Tag an object and all descendants as __objekta for the editor pipeline. */
function tagObjekta(obj) {
  obj.userData = obj.userData || {};
  obj.userData.__objekta = true;
  obj.traverse((child) => {
    child.userData = child.userData || {};
    child.userData.__objekta = true;
  });
  return obj;
}

/* ═══════════════════════════════════════════════════════════════════════════
   PRESET: Studio Lighting
   Three-point lighting with a backdrop — perfect for product visualization.
   ═══════════════════════════════════════════════════════════════════════ */

export function presetStudioLighting() {
  const group = new THREE.Group();
  group.name = "Preset_StudioLighting";

  // Backdrop
  const backdrop = new THREE.Mesh(
    new THREE.PlaneGeometry(8, 6),
    new THREE.MeshStandardMaterial({ color: "#f0f0f0", roughness: 0.5, metalness: 0, side: THREE.DoubleSide }),
  );
  backdrop.position.set(0, 3, -3);
  backdrop.name = "Studio_Backdrop";
  backdrop.receiveShadow = true;
  group.add(backdrop);

  // Floor
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(8, 8),
    new THREE.MeshStandardMaterial({ color: "#e8e8e8", roughness: 0.4, metalness: 0 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.name = "Studio_Floor";
  floor.receiveShadow = true;
  group.add(floor);

  // Key light
  const key = new THREE.DirectionalLight("#fff5e6", 1.5);
  key.position.set(3, 5, 2);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.name = "Studio_KeyLight";
  group.add(key);

  // Fill light
  const fill = new THREE.DirectionalLight("#e6f0ff", 0.6);
  fill.position.set(-3, 3, 2);
  fill.name = "Studio_FillLight";
  group.add(fill);

  // Back / rim light
  const rim = new THREE.DirectionalLight("#ffffff", 0.8);
  rim.position.set(0, 4, -3);
  rim.name = "Studio_RimLight";
  group.add(rim);

  // Ambient
  const ambient = new THREE.AmbientLight("#404040", 0.3);
  ambient.name = "Studio_Ambient";
  group.add(ambient);

  return tagObjekta(group);
}

/* ═══════════════════════════════════════════════════════════════════════════
   PRESET: Outdoor Scene
   Ground plane, sky-colored ambient, sun directional, a few decorative items.
   ═══════════════════════════════════════════════════════════════════════ */

export function presetOutdoor() {
  const group = new THREE.Group();
  group.name = "Preset_Outdoor";

  // Ground
  const ground = generateFloor({ width: 30, depth: 30, color: "#6b8f3a" });
  if (ground.name) ground.name = "Outdoor_Ground";
  group.add(ground);

  // Sun
  const sun = new THREE.DirectionalLight("#fff8e1", 1.8);
  sun.position.set(10, 15, 8);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -15;
  sun.shadow.camera.right = 15;
  sun.shadow.camera.top = 15;
  sun.shadow.camera.bottom = -15;
  sun.name = "Outdoor_Sun";
  group.add(sun);

  // Sky ambient
  const sky = new THREE.HemisphereLight("#87ceeb", "#3a5f20", 0.5);
  sky.name = "Outdoor_SkyAmbient";
  group.add(sky);

  // A couple of decorative "trees" (simple cylinders + cones)
  for (let i = 0; i < 3; i++) {
    const tree = createSimpleTree();
    tree.position.set(-6 + i * 6, 0, -8 + i * 2);
    tree.name = `Outdoor_Tree_${i + 1}`;
    group.add(tree);
  }

  return tagObjekta(group);
}

/* ═══════════════════════════════════════════════════════════════════════════
   PRESET: Product Showcase
   Circular pedestal, spotlight from above, soft ambient.
   ═══════════════════════════════════════════════════════════════════════ */

export function presetProductShowcase() {
  const group = new THREE.Group();
  group.name = "Preset_ProductShowcase";

  // Pedestal circle
  const pedGeo = new THREE.CylinderGeometry(1.5, 1.5, 0.1, 48);
  const pedMat = new THREE.MeshStandardMaterial({ color: "#2a2a2a", roughness: 0.2, metalness: 0.6 });
  const pedestal = new THREE.Mesh(pedGeo, pedMat);
  pedestal.position.y = 0.05;
  pedestal.receiveShadow = true;
  pedestal.name = "Showcase_Pedestal";
  group.add(pedestal);

  // Floor
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(10, 10),
    new THREE.MeshStandardMaterial({ color: "#1a1a1a", roughness: 0.3, metalness: 0.1 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.name = "Showcase_Floor";
  floor.receiveShadow = true;
  group.add(floor);

  // Spotlight from above
  const spot = new THREE.SpotLight("#ffffff", 2, 10, Math.PI / 6, 0.5, 1);
  spot.position.set(0, 5, 0);
  spot.target = pedestal;
  spot.castShadow = true;
  spot.shadow.mapSize.set(1024, 1024);
  spot.name = "Showcase_Spotlight";
  group.add(spot);

  // Soft ambient
  const ambient = new THREE.AmbientLight("#1a1a2e", 0.4);
  ambient.name = "Showcase_Ambient";
  group.add(ambient);

  // Accent rim light
  const rim = new THREE.PointLight("#4a90d9", 0.6, 8);
  rim.position.set(-3, 2, -2);
  rim.name = "Showcase_RimLight";
  group.add(rim);

  return tagObjekta(group);
}

/* ═══════════════════════════════════════════════════════════════════════════
   PRESET: Architectural Interior
   Room with columns and warm lighting.
   ═══════════════════════════════════════════════════════════════════════ */

export function presetArchitectural() {
  const group = new THREE.Group();
  group.name = "Preset_Architectural";

  // Room shell
  const room = generateRoom({ width: 10, depth: 10, height: 4, ceiling: true, wallColor: "#eae4d8", floorColor: "#c4b8a8" });
  group.add(room);

  // Corner columns
  const positions = [[-4, 0, -4], [4, 0, -4], [-4, 0, 4], [4, 0, 4]];
  positions.forEach(([x, y, z], i) => {
    const col = generateColumn({ radius: 0.2, height: 4, fluted: true, color: "#d8d0c4" });
    col.position.set(x, y, z);
    col.name = `Arch_Column_${i + 1}`;
    group.add(col);
  });

  // Warm ceiling light
  const ceiling = new THREE.PointLight("#ffe4c4", 1.2, 12);
  ceiling.position.set(0, 3.5, 0);
  ceiling.castShadow = true;
  ceiling.name = "Arch_CeilingLight";
  group.add(ceiling);

  // Wall sconces (point lights on walls)
  const sconces = [
    [-4.8, 2.5, 0], [4.8, 2.5, 0], [0, 2.5, -4.8], [0, 2.5, 4.8],
  ];
  sconces.forEach(([x, y, z], i) => {
    const sconce = new THREE.PointLight("#ffd89b", 0.4, 5);
    sconce.position.set(x, y, z);
    sconce.name = `Arch_Sconce_${i + 1}`;
    group.add(sconce);
  });

  // Ambient
  const ambient = new THREE.AmbientLight("#3a2a1a", 0.2);
  ambient.name = "Arch_Ambient";
  group.add(ambient);

  return tagObjekta(group);
}

/* ═══════════════════════════════════════════════════════════════════════════
   PRESET: Low-Poly Nature
   Flat-shaded terrain with simple trees and soft lighting.
   ═══════════════════════════════════════════════════════════════════════ */

export function presetLowPolyNature() {
  const group = new THREE.Group();
  group.name = "Preset_LowPolyNature";

  // Terrain
  const terrainGeo = new THREE.PlaneGeometry(30, 30, 24, 24);
  terrainGeo.rotateX(-Math.PI / 2);
  const seed = 123;
  const pos = terrainGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const h = Math.sin(x * 0.3 + seed) * Math.cos(z * 0.25 + seed * 0.7) * 1.5 +
              Math.sin(x * 0.1) * Math.cos(z * 0.1) * 2;
    pos.setY(i, Math.max(h, -0.2));
  }
  terrainGeo.computeVertexNormals();
  const terrain = new THREE.Mesh(
    terrainGeo,
    new THREE.MeshStandardMaterial({ color: "#5a8a32", roughness: 0.9, metalness: 0, flatShading: true }),
  );
  terrain.receiveShadow = true;
  terrain.name = "Nature_Terrain";
  group.add(terrain);

  // Trees scattered around
  const rng = mulberry32(seed);
  for (let i = 0; i < 12; i++) {
    const tree = createSimpleTree();
    tree.position.set((rng() - 0.5) * 20, 0, (rng() - 0.5) * 20);
    tree.scale.setScalar(0.8 + rng() * 0.6);
    tree.name = `Nature_Tree_${i + 1}`;
    group.add(tree);
  }

  // Rocks
  for (let i = 0; i < 6; i++) {
    const rock = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.3 + rng() * 0.4, 0),
      new THREE.MeshStandardMaterial({ color: "#8a8a7a", roughness: 0.95, metalness: 0, flatShading: true }),
    );
    rock.position.set((rng() - 0.5) * 18, 0.15, (rng() - 0.5) * 18);
    rock.rotation.set(rng(), rng(), rng());
    rock.castShadow = true;
    rock.name = `Nature_Rock_${i + 1}`;
    group.add(rock);
  }

  // Sun + sky
  const sun = new THREE.DirectionalLight("#fff8e1", 1.5);
  sun.position.set(8, 12, 6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -15;
  sun.shadow.camera.right = 15;
  sun.shadow.camera.top = 15;
  sun.shadow.camera.bottom = -15;
  sun.name = "Nature_Sun";
  group.add(sun);

  const hemi = new THREE.HemisphereLight("#87ceeb", "#4a6f20", 0.45);
  hemi.name = "Nature_Sky";
  group.add(hemi);

  return tagObjekta(group);
}

/* ═══════════════════════════════════════════════════════════════════════════
   HELPER: Simple tree (cone on cylinder)
   ═══════════════════════════════════════════════════════════════════════ */

function createSimpleTree() {
  const tree = new THREE.Group();

  // Trunk
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08, 0.12, 1, 6),
    new THREE.MeshStandardMaterial({ color: "#6b4226", roughness: 0.9, metalness: 0, flatShading: true }),
  );
  trunk.position.y = 0.5;
  trunk.castShadow = true;
  trunk.name = "Tree_Trunk";
  tree.add(trunk);

  // Foliage (layered cones)
  const foliageMat = new THREE.MeshStandardMaterial({ color: "#2d7a2d", roughness: 0.8, metalness: 0, flatShading: true });
  const layers = [
    { r: 0.6, h: 0.8, y: 1.4 },
    { r: 0.45, h: 0.7, y: 1.9 },
    { r: 0.3, h: 0.6, y: 2.3 },
  ];
  layers.forEach((l, i) => {
    const cone = new THREE.Mesh(
      new THREE.ConeGeometry(l.r, l.h, 6),
      foliageMat,
    );
    cone.position.y = l.y;
    cone.castShadow = true;
    cone.name = `Tree_Foliage_${i + 1}`;
    tree.add(cone);
  });

  return tree;
}

/** Mini PRNG for scattering. */
function mulberry32(seed) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
   CATALOG — used by UI to list available presets
   ═══════════════════════════════════════════════════════════════════════ */

export const PRESET_CATALOG = [
  {
    id: "studio",
    label: "Studio Lighting",
    icon: "💡",
    description: "Three-point lighting with backdrop — ideal for product shots.",
    fn: presetStudioLighting,
  },
  {
    id: "outdoor",
    label: "Outdoor Scene",
    icon: "🌳",
    description: "Open ground with sun, sky ambient, and simple trees.",
    fn: presetOutdoor,
  },
  {
    id: "showcase",
    label: "Product Showcase",
    icon: "🎯",
    description: "Dark pedestal with spotlight — professional product display.",
    fn: presetProductShowcase,
  },
  {
    id: "architectural",
    label: "Architectural Interior",
    icon: "🏛️",
    description: "Room with columns, warm ceiling light, and wall sconces.",
    fn: presetArchitectural,
  },
  {
    id: "lowpoly-nature",
    label: "Low-Poly Nature",
    icon: "⛰️",
    description: "Flat-shaded terrain with trees, rocks, and natural lighting.",
    fn: presetLowPolyNature,
  },
];

export default {
  presetStudioLighting,
  presetOutdoor,
  presetProductShowcase,
  presetArchitectural,
  presetLowPolyNature,
  PRESET_CATALOG,
};
