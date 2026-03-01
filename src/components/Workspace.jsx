// src/components/Workspace.jsx
import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState, useCallback } from "react";
import * as THREE from "three";

// three/examples imports MUST include .js for Vite
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { TransformControls } from "three/examples/jsm/controls/TransformControls";
import createSafeGLTFLoader from "../utils/gltfLoader";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader";
import { KTX2Loader } from "three/examples/jsm/loaders/KTX2Loader";
import { RGBELoader } from "three/examples/jsm/loaders/RGBELoader";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter";
import { uploadLargeFile, uploadSmallViaPresign } from "../utils/upload";
import { acceleratedRaycast, computeBoundsTree, disposeBoundsTree } from "three-mesh-bvh";

import { useDrop } from "react-dnd";
import { PALETTE_TYPE } from "./Palette";
import EventBus from "../utils/EventBus";
import { SceneGraphStore } from "../store/SceneGraphStore";

import initCameraControls from "../components/CameraControls";
import setupEnvironment from "../components/EnvironmentSetup";
import initGLBImporter from "../components/GLBImporter";
import setupDefaultLighting from "../components/LightingSetup";
import createMaterialEditor from "../components/MaterialEditor";
import setupPostProcessing from "../components/PostProcessing";
import AnimationScrubber from "../components/AnimationScrubber";
import BloomTagPanel from "../components/BloomTagPanel";
import AnimationKeyframeEditor from "../components/AnimationKeyframeEditor";
import ObjectProperties from "../components/ObjectProperties";
import { persistAdaptiveScale, loadAdaptiveScale } from "../utils/preferences";
import AnimationEngine from "../engine/AnimationEngine";

import { apiUrl } from "../utils/api";

// Extracted workspace sub-modules
import {
  HISTORY_LIMIT,
  HISTORY_DEBOUNCE_MS,
  AUTOSAVE_KEY,
  CAMERA_BOOKMARKS_KEY,
  TRANSFORM_FLUSH_MS,
} from "./workspace/constants";
import {
  computeLookAtQuat,
  presetCameraPosition,
  computeFramingDistance,
  serializeBookmark,
  deserializeBookmark,
  easeInOutCubic,
} from "./workspace/cameraUtils";
import {
  summarizeObject,
  collectLights,
  collectCameras,
  computeSceneSummary,
} from "./workspace/sceneSerializer";
import { Cmd, HistoryManager } from "./workspace/HistoryManager";

try { THREE.Cache.enabled = true; } catch (e) {}
try {
  if (THREE?.ImageUtils?.getDataURL && !THREE.ImageUtils.__objektaSilenced) {
    const originalGetDataURL = THREE.ImageUtils.getDataURL.bind(THREE.ImageUtils);
    THREE.ImageUtils.getDataURL = function patchedGetDataURL(...args) {
      const prevWarn = console.warn;
      console.warn = function filteredWarn(...warnArgs) {
        if (warnArgs[0] && typeof warnArgs[0] === 'string' && warnArgs[0].includes('Image converted to jpg')) {
          return;
        }
        return prevWarn.apply(console, warnArgs);
      };
      try {
        return originalGetDataURL(...args);
      } finally {
        console.warn = prevWarn;
      }
    };
    THREE.ImageUtils.__objektaSilenced = true;
  }
} catch (e) {}

const Workspace = forwardRef(({ selected: _selected, onSelect, onFullScreenChange, panelTopOffset = 12, onSceneChange, onLightChange, showInternalPanels = true }, ref) => {
  // DOM refs
  const containerRef = useRef(null);
  const canvasRef = useRef(null);

  // three refs
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const rendererRef = useRef(null);
  const orbitRef = useRef(null);
  const transformRef = useRef(null);

  // helper APIs
  const cameraControlsApiRef = useRef(null);
  const lightingApiRef = useRef(null);
  const envApiRef = useRef(null);
  const glbImporterApiRef = useRef(null);
  const materialEditorApiRef = useRef(null);
  const postfxApiRef = useRef(null);
  const composerRef = useRef(null);
  const animationEngineRef = useRef(new AnimationEngine());
  // performance & adaptive resolution refs
  const fpsRef = useRef({ lastTime: performance.now(), frames: 0, fps: 60, accumTime: 0 });
  const dynResRef = useRef({ scale: 1, downCooldown: 0, upCooldown: 0 });
  const fallbackLightsRef = useRef({ amb: null, dir: null });
  const resolutionStateRef = useRef({ scale: 1, auto: false, fps: 60 });
  const [resolutionUi, setResolutionUi] = useState(resolutionStateRef.current);
  const autoResolutionRef = useRef(false);
  // Force full resolution (100%) by default per request
  const forceFullResRef = useRef(true);
  const animClockRef = useRef(performance.now());

  const shadingModeRef = useRef("rendered");
  const materialWireframeCacheRef = useRef(new WeakMap());

  const syncResolutionState = useCallback((patch = {}) => {
    const next = { ...resolutionStateRef.current, ...patch };
    resolutionStateRef.current = next;
    setResolutionUi(next);
    try { EventBus.emit?.('workspace:resolution', next); } catch (e) { /* noop */ }
  }, []);

  const setAutoResolution = useCallback((auto) => {
    autoResolutionRef.current = !!auto;
    syncResolutionState({ auto: !!auto });
  }, [syncResolutionState]);

  const applyResolutionScale = useCallback((scale, { persist = true, auto } = {}) => {
    const numeric = typeof scale === 'number' ? scale : parseFloat(scale);
    const unclamped = Number.isFinite(numeric) ? numeric : 1;
    const target = forceFullResRef.current ? 1 : Math.max(0.75, Math.min(1, unclamped));
    dynResRef.current.scale = target;
    const renderer = rendererRef.current;
    if (renderer) {
      try { renderer.setPixelRatio((window.devicePixelRatio || 1) * target); } catch (e) {}
      needsRenderRef.current = true;
    }
    if (persist && !forceFullResRef.current) {
      try { persistAdaptiveScale(target); } catch (e) {}
    }
    const patch = { scale: target };
    if (typeof auto === 'boolean') {
      autoResolutionRef.current = auto;
      patch.auto = auto;
    } else if (forceFullResRef.current) {
      autoResolutionRef.current = false;
      patch.auto = false;
    }
    syncResolutionState(patch);
  }, [syncResolutionState]);

  const handleResolutionAutoToggle = useCallback((nextAuto) => {
    const finalAuto = forceFullResRef.current ? false : !!nextAuto;
    setAutoResolution(finalAuto);
    dynResRef.current.downCooldown = 0;
    dynResRef.current.upCooldown = 0;
    if (finalAuto) {
      try { persistAdaptiveScale(dynResRef.current.scale); } catch (e) {}
    }
  }, [setAutoResolution]);

  const handleResolutionSlider = useCallback((value) => {
    const numeric = Math.max(50, Math.min(100, parseInt(value, 10) || 100));
    applyResolutionScale(numeric / 100, { auto: false });
  }, [applyResolutionScale]);

  const handleResolutionReset = useCallback((forceManual = false) => {
    dynResRef.current.downCooldown = 0;
    dynResRef.current.upCooldown = 0;
    const opts = forceManual ? { auto: false } : {};
    applyResolutionScale(1, opts);
  }, [applyResolutionScale]);

  // loaders & encoders
  const gltfLoaderRef = useRef(null);
  const dracoRef = useRef(null);
  const ktx2Ref = useRef(null);

  // file assets map (store original imported files for robust saving)
  // key: scene object uuid, value: { name, type, buffer (ArrayBuffer) }
  const fileAssetsRef = useRef(new Map());
  const isBulkImportRef = useRef(false);

  // mini preview refs
  const miniRendererRef = useRef(null);
  const miniCameraRef = useRef(null);
  const miniOrbitRef = useRef(null);
  const miniCanvasRef = useRef(null);
  const miniDisabledRef = useRef(false);
  const cameraBookmarksRef = useRef(new Map());
  const cameraAnimRef = useRef(null);
  // camera view toggle (Blender-like 'Look Through') state
  const isCameraViewRef = useRef(false);
  const savedCameraStateRef = useRef(null);

  // scene helpers
  const raycasterRef = useRef(new THREE.Raycaster());
  const mouseRef = useRef(new THREE.Vector2());
  const nameCountRef = useRef(1);
  const blobUrlsRef = useRef(new Set());
  const materialOriginalsRef = useRef(new WeakMap());

  // state
  const [isCanvasReady, setIsCanvasReady] = useState(false);
  const [selectedInternal, setSelectedInternal] = useState(null);
  const [toolbarPos, setToolbarPos] = useState({ x: -999, y: -999 });
  const [transformMode, setTransformModeState] = useState("translate"); // translate | rotate | scale
  const [loading, setLoading] = useState(false);
  const [bookmarkUiVersion, setBookmarkUiVersion] = useState(0);
  const [hover, setHover] = useState({ name: "", x: -999, y: -999 });

  // render/scene tracking
  const needsRenderRef = useRef(true);
  const sceneVersionRef = useRef(0);
  const bumpSceneVersion = (why) => {
    sceneVersionRef.current++;
    try {
      if (typeof onSceneChange === "function") onSceneChange(sceneVersionRef.current);
    } catch (e) {}
    try {
      EventBus?.emit?.("scene:updated", { version: sceneVersionRef.current, why });
    } catch (e) {}
  };

  // History manager
  const snapshotHistoryRef = useRef([]);
  const snapshotHistoryIndexRef = useRef(-1);
  const captureBusyRef = useRef(false);

  // Cmd and HistoryManager are now imported from ./workspace/HistoryManager

  // ---------- Global resize helper (exposed & used by effect) ----------
  const doResize = (w = null, h = null) => {
    try {
      const renderer = rendererRef.current;
      const camera = cameraRef.current;
      const containerEl = containerRef.current || renderer?.domElement?.parentElement || null;
      const width = w ?? (containerEl ? containerEl.clientWidth : window.innerWidth);
      const height = h ?? (containerEl ? containerEl.clientHeight : window.innerHeight);

      // The isCanvasReady state now prevents this from running with zero-size.
      // The ResizeObserver provides the correct dimensions.
      if (width < 10 || height < 10) {
        return; // Do nothing if size is invalid.
      }

      if (renderer) {
        try { renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2)); } catch (e) {}
        try { renderer.setSize(width, height, false); } catch (e) { /* ignore */ }
      }
      if (camera) {
        camera.aspect = width / Math.max(1, height);
        try { camera.updateProjectionMatrix(); } catch (e) {}
      }
      // Post-processing resize guards
      if (postfxApiRef.current?.setSize) {
        try { postfxApiRef.current.setSize(width, height); } catch (e) {}
      }
      if (composerRef.current?.setSize) {
        try { composerRef.current.setSize(width, height); } catch (e) {}
      }
      if (miniRendererRef.current) {
        try { miniRendererRef.current.setSize(140, 140, false); } catch (e) {}
      }
      needsRenderRef.current = true;
    } catch (e) {
      console.warn("doResize (global) failed", e);
    }
  };

  // ---------- captureThumbnail (robust helper without creating extra WebGL contexts) ----------
  // Uses a transient WebGLRenderTarget to avoid spawning additional WebGLRenderer instances (which can
  // trigger context loss when the browser reaches its context limit). Reads pixels and encodes to Blob.
  async function captureThumbnail({ width = 800, height = 600, mime = "image/jpeg", quality = 0.9 } = {}) {
    const renderer = rendererRef.current;
    const scene = sceneRef.current;
    const camera = cameraRef.current;
    if (!renderer || !scene || !camera) {
      console.warn("[OBJEKTA] Missing renderer/scene/camera for capture");
      return null;
    }
  if (captureBusyRef.current) {
    return null;
  }
  captureBusyRef.current = true;
  try {
    try { scene.updateMatrixWorld(true); } catch (e) {}
    try { camera.updateMatrixWorld(true); } catch (e) {}

    // If the scene is very heavy, reduce capture size to minimize GPU memory use
    try {
      const tris = renderer.info?.render?.triangles || 0;
      if (tris > 4000000) {
        width = 480;
        height = 360;
      }
    } catch (e) {}

    // Save current renderer state
    const prevTarget = renderer.getRenderTarget();
    const prevSize = renderer.getSize(new THREE.Vector2());
    const prevPixelRatio = renderer.getPixelRatio ? renderer.getPixelRatio() : 1;
    const prevViewport = renderer.getViewport(new THREE.Vector4());

    // Create render target (no multisampling needed for thumbnail)
    const rt = new THREE.WebGLRenderTarget(width, height, { depthBuffer: true, stencilBuffer: false });
    rt.texture.colorSpace = (renderer.outputColorSpace !== undefined) ? renderer.outputColorSpace : THREE.SRGBColorSpace;
    try { renderer.setPixelRatio(1); } catch (e) {}
    try { renderer.setSize(width, height, false); } catch (e) {}
    try { renderer.setRenderTarget(rt); } catch (e) {}

    // Render directly (skip postFX to minimize overhead for capture)
    try { renderer.render(scene, camera); } catch (e) { console.warn("[OBJEKTA] thumbnail render failed", e); }

    // Read pixels
    const buffer = new Uint8Array(width * height * 4);
    try { renderer.readRenderTargetPixels(rt, 0, 0, width, height, buffer); } catch (e) {
      console.warn("[OBJEKTA] readRenderTargetPixels failed", e);
    }

    // Convert to canvas (flip Y because pixel data is bottom-up)
    const canvas = document.createElement("canvas");
    canvas.width = width; canvas.height = height;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    const imgData = ctx.createImageData(width, height);
    // Flip Y while copying
    for (let y = 0; y < height; y++) {
      const srcRow = height - 1 - y;
      for (let x = 0; x < width; x++) {
        const dstIdx = (y * width + x) * 4;
        const srcIdx = (srcRow * width + x) * 4;
        imgData.data[dstIdx] = buffer[srcIdx];     // R
        imgData.data[dstIdx + 1] = buffer[srcIdx + 1]; // G
        imgData.data[dstIdx + 2] = buffer[srcIdx + 2]; // B
        imgData.data[dstIdx + 3] = buffer[srcIdx + 3]; // A
      }
    }
    try { ctx.putImageData(imgData, 0, 0); } catch (e) {}

    const blob = await new Promise((res) => {
      try { canvas.toBlob((b) => res(b), mime, quality); } catch (e) { res(null); }
    });

    // Restore renderer state
    try { renderer.setRenderTarget(prevTarget); } catch (e) {}
    try { renderer.setPixelRatio(prevPixelRatio); } catch (e) {}
    try { renderer.setSize(prevSize.x || prevSize.width || 800, prevSize.y || prevSize.height || 600, false); } catch (e) {}
    try { renderer.setViewport(prevViewport); } catch (e) {}
    try { rt.dispose(); } catch (e) {}

    if (blob && blob.size > 200) {
      console.log(`[OBJEKTA] captureThumbnail OK (size=${blob.size})`);
      needsRenderRef.current = true;
      return blob;
    }
      console.warn("[OBJEKTA] captureThumbnail produced empty blob");
      return null;
    } finally {
      captureBusyRef.current = false;
    }
  }
  // HistoryManager imported from ./workspace/HistoryManager — pass bumpSceneVersion as onMutate callback
  const cmdHistoryRef = useRef(new HistoryManager(HISTORY_LIMIT, (action) => bumpSceneVersion(action)));

  // BVH wiring (safe)
  try {
    if (THREE && THREE.Mesh && THREE.Mesh.prototype && THREE.Mesh.prototype.raycast !== acceleratedRaycast) {
      THREE.Mesh.prototype.raycast = acceleratedRaycast;
    }
    if (THREE && THREE.BufferGeometry && !THREE.BufferGeometry.prototype.computeBoundsTree) {
      THREE.BufferGeometry.prototype.computeBoundsTree = computeBoundsTree;
      THREE.BufferGeometry.prototype.disposeBoundsTree = disposeBoundsTree;
    }
  } catch (err) {}

  const scheduleComputeBoundsTreeForObject = useCallback((obj) => {
    if (!obj) return;
    const tasks = [];
    try {
      obj.traverse((n) => {
        if (n.isMesh && n.geometry) {
          try {
            const geom = n.geometry;
            let tris = 0;
            if (geom.index) tris = Math.round(geom.index.count / 3);
            else if (geom.attributes && geom.attributes.position) tris = Math.round(geom.attributes.position.count / 3);
            if (tris > 200000) return; // skip BVH for extremely large meshes
          } catch (e) {}
          if (typeof n.geometry.computeBoundsTree === "function") {
            tasks.push(() => {
              try {
                n.geometry.computeBoundsTree();
              } catch (e) {}
            });
          }
        }
      });
    } catch (e) {}
    if (tasks.length === 0) return;
    const runChunk = () => {
      const start = performance.now();
      while (tasks.length) {
        const fn = tasks.shift();
        try {
          fn();
        } catch (e) {}
        if (performance.now() - start > 8) {
          setTimeout(runChunk, 12);
          return;
        }
      }
    };
    if (typeof window !== "undefined" && typeof window.requestIdleCallback === "function") {
      try {
        window.requestIdleCallback(() => runChunk(), { timeout: 600 });
      } catch (e) {
        setTimeout(runChunk, 16);
      }
    } else setTimeout(runChunk, 16);
  }, []);

  const ensureBVHForObject = useCallback((obj) => {
    try {
      scheduleComputeBoundsTreeForObject(obj);
    } catch (e) {
      /* ignore */
    }
  }, [scheduleComputeBoundsTreeForObject]);

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  // ---------- safeAdd (simplified, quiet on non-Object3D) ----------
  function safeAdd(parent, child) {
    try {
      if (!parent || !child) return false;
      // prefer explicit Object3D identification
      if (child.isObject3D || (typeof THREE !== "undefined" && child instanceof THREE.Object3D)) {
        parent.add(child);
        return true;
      }
      // support wrappers that expose `.object`
      if (child.object && (child.object.isObject3D || (typeof THREE !== "undefined" && child.object instanceof THREE.Object3D))) {
        parent.add(child.object);
        return true;
      }
      // quietly skip unknown types
      return false;
    } catch (e) {
      // conservative fallback
      return false;
    }
  }

  // sculpting state & logic
  const sculptStateRef = useRef({
    active: false,
    target: null,
    mode: "inflate",
    radius: 0.25,
    strength: 0.6,
    symmetry: { x: false, y: false, z: false },
    pointerDown: false,
    lastPoint: null,
    neighborsMap: new Map(),
    undoTmp: null,
  });

  const buildVertexNeighbors = (geometry) => {
    if (!geometry || !geometry.isBufferGeometry) return [];
    const posAttr = geometry.attributes.position;
    const idxAttr = geometry.index;
    const nVerts = posAttr.count;
    const neighbors = new Array(nVerts);
    for (let i = 0; i < nVerts; i++) neighbors[i] = new Set();
    if (idxAttr) {
      const idx = idxAttr.array;
      for (let i = 0; i < idx.length; i += 3) {
        const a = idx[i], b = idx[i + 1], c = idx[i + 2];
        neighbors[a].add(b);
        neighbors[a].add(c);
        neighbors[b].add(a);
        neighbors[b].add(c);
        neighbors[c].add(a);
        neighbors[c].add(b);
      }
    } else {
      const pos = posAttr.array;
      for (let i = 0, vi = 0; i < pos.length; i += 9, vi += 3) {
        const a = vi,
          b = vi + 1,
          c = vi + 2;
        neighbors[a].add(b);
        neighbors[a].add(c);
        neighbors[b].add(a);
        neighbors[b].add(c);
        neighbors[c].add(a);
        neighbors[c].add(b);
      }
    }
    return neighbors.map((s) => Array.from(s));
  };

  const falloff = (t) => {
    const x = Math.max(0, Math.min(1, t));
    return 0.5 * (1 + Math.cos(Math.PI * Math.min(1, x)));
  };

  const applyBrushToMesh = (mesh, worldPoint, opts = {}) => {
    if (!mesh || !mesh.geometry || !mesh.geometry.isBufferGeometry) return null;
    const geometry = mesh.geometry;
    const posAttr = geometry.attributes.position;
    const nVerts = posAttr.count;
    const localPoint = worldPoint.clone();
    mesh.worldToLocal(localPoint);
    const radius = typeof opts.radius === "number" ? opts.radius : sculptStateRef.current.radius;
    const strength = typeof opts.strength === "number" ? opts.strength : sculptStateRef.current.strength;
    const mode = opts.mode || sculptStateRef.current.mode;

    // Optimization: Check bounding sphere first
    if (!geometry.boundingSphere) geometry.computeBoundingSphere();
    if (geometry.boundingSphere) {
        const dist = geometry.boundingSphere.center.distanceTo(localPoint);
        if (dist > geometry.boundingSphere.radius + radius) return null;
    }

    if (!sculptStateRef.current.neighborsMap.has(geometry.uuid)) sculptStateRef.current.neighborsMap.set(geometry.uuid, buildVertexNeighbors(geometry));
    const neighbors = sculptStateRef.current.neighborsMap.get(geometry.uuid);

    if (!geometry.attributes.normal) geometry.computeVertexNormals();
    const normals = geometry.attributes.normal.array;
    const positions = posAttr.array;
    const changed = new Map();

    // Pre-calculate grab vector in local space
    let grabVector = null;
    if (mode === "grab" && opts.delta) {
        // Transform world delta to local delta
        const worldDelta = opts.delta.clone();
        // We only care about direction/magnitude, but scale matters. 
        // Simple approximation: rotate delta by inverse mesh rotation and scale by inverse mesh scale
        const invQuat = mesh.quaternion.clone().invert();
        const localDelta = worldDelta.applyQuaternion(invQuat).divide(mesh.scale);
        grabVector = localDelta;
    }

    for (let i = 0; i < nVerts; i++) {
      const ix = i * 3;
      const vx = positions[ix],
        vy = positions[ix + 1],
        vz = positions[ix + 2];
      const dx = vx - localPoint.x,
        dy = vy - localPoint.y,
        dz = vz - localPoint.z;
      const distSq = dx * dx + dy * dy + dz * dz;
      const radSq = radius * radius;
      
      if (distSq > radSq) continue;
      
      const dist = Math.sqrt(distSq);
      const t = dist / radius;
      const w = falloff(1 - t); // 0 to 1

      let nx = normals[ix],
        ny = normals[ix + 1],
        nz = normals[ix + 2];
      const nl = Math.hypot(nx, ny, nz) || 1;
      nx /= nl;
      ny /= nl;
      nz /= nl;

      let dirx = nx,
        diry = ny,
        dirz = nz;
      
      let effectiveStrength = strength;

      if (mode === "grab") {
        if (grabVector) {
            dirx = grabVector.x;
            diry = grabVector.y;
            dirz = grabVector.z;
            // Grab moves everything in radius by delta * weight
            // We don't use 'strength' as multiplier for delta usually, 
            // but we can use it to attenuate the effect if needed.
            // Usually grab follows mouse exactly at center.
            effectiveStrength = 1.0; 
            // For grab, we want to move by the delta amount scaled by falloff
            // The 'delta' variable below is calculated as strength * sign * w * 0.08
            // We need to override this.
        } else {
            continue; // No movement if no delta
        }
      } else if (mode === "flatten") {
        if (opts.planeNormal) {
          dirx = opts.planeNormal.x;
          diry = opts.planeNormal.y;
          dirz = opts.planeNormal.z;
        }
      } else if (mode === "pinch") {
        dirx = -dx;
        diry = -dy;
        dirz = -dz;
        const dl = Math.hypot(dirx, diry, dirz) || 1;
        dirx /= dl;
        diry /= dl;
        dirz /= dl;
      }

      const sign = mode === "deflate" ? -1 : 1;
      
      let deltaX, deltaY, deltaZ;

      if (mode === "grab" && grabVector) {
          deltaX = grabVector.x * w;
          deltaY = grabVector.y * w;
          deltaZ = grabVector.z * w;
      } else {
          const d = effectiveStrength * sign * w * 0.08; // 0.08 is arbitrary scaling factor
          deltaX = dirx * d;
          deltaY = diry * d;
          deltaZ = dirz * d;
      }

      if (!changed.has(i)) changed.set(i, [vx, vy, vz]);

      positions[ix] = vx + deltaX;
      positions[ix + 1] = vy + deltaY;
      positions[ix + 2] = vz + deltaZ;
    }

    if (mode === "smooth") {
      const out = new Float32Array(positions.length);
      out.set(positions);
      const lambda = strength * 0.6;
      for (let i = 0; i < nVerts; i++) {
        const nb = neighbors[i];
        if (!nb || nb.length === 0) continue;
        const ix = i * 3;
        let sx = 0,
          sy = 0,
          sz = 0;
        for (let j = 0; j < nb.length; j++) {
          const k = nb[j] * 3;
          sx += positions[k];
          sy += positions[k + 1];
          sz += positions[k + 2];
        }
        const inv = 1 / nb.length;
        sx *= inv;
        sy *= inv;
        sz *= inv;
        out[ix] += (sx - positions[ix]) * lambda;
        out[ix + 1] += (sy - positions[ix + 1]) * lambda;
        out[ix + 2] += (sz - positions[ix + 2]) * lambda;
      }
      positions.set(out);
    }

    posAttr.needsUpdate = true;
    if (geometry.computeVertexNormals) geometry.computeVertexNormals();
    if (geometry.computeBoundingSphere) geometry.computeBoundingSphere();

    try {
      ensureBVHForObject(mesh);
    } catch (e) {}

    needsRenderRef.current = true;
    return { mesh, geometry, changed };
  };

  const pushSculptCommand = (mesh, changedMap, label = "sculpt") => {
    if (!mesh || !mesh.geometry || !changedMap || changedMap.size === 0) return;
    try {
      const geometry = mesh.geometry;
      const pos = geometry.attributes.position;
      const redoSnapshot = new Map();
      for (const [i] of changedMap) {
        const ix = i * 3;
        redoSnapshot.set(i, [pos.array[ix], pos.array[ix + 1], pos.array[ix + 2]]);
      }
      const undoSnapshot = changedMap;

      cmdHistoryRef.current.push(
        new Cmd(
          () => {
            for (const [i, v] of redoSnapshot) {
              const ix = i * 3;
              pos.array[ix] = v[0];
              pos.array[ix + 1] = v[1];
              pos.array[ix + 2] = v[2];
            }
            pos.needsUpdate = true;
            geometry.computeVertexNormals && geometry.computeVertexNormals();
            ensureBVHForObject(mesh);
            bumpSceneVersion("sculpt-redo");
            needsRenderRef.current = true;
          },
          () => {
            for (const [i, v] of undoSnapshot) {
              const ix = i * 3;
              pos.array[ix] = v[0];
              pos.array[ix + 1] = v[1];
              pos.array[ix + 2] = v[2];
            }
            pos.needsUpdate = true;
            geometry.computeVertexNormals && geometry.computeVertexNormals();
            ensureBVHForObject(mesh);
            bumpSceneVersion("sculpt-undo");
            needsRenderRef.current = true;
          },
          label
        )
      );
    } catch (e) {
      console.warn("pushSculptCommand failed", e);
    }
  };

  const startSculptingInternal = (mesh, { mode = "inflate", radius = 0.25, strength = 0.6 } = {}) => {
    if (!mesh || !mesh.geometry) return false;
    sculptStateRef.current.active = true;
    sculptStateRef.current.target = mesh;
    sculptStateRef.current.mode = mode;
    sculptStateRef.current.radius = radius;
    sculptStateRef.current.strength = strength;
    sculptStateRef.current.pointerDown = false;
    sculptStateRef.current.lastPoint = null;
    sculptStateRef.current.undoTmp = null;
    try {
      mesh.geometry.computeVertexNormals?.();
    } catch (e) {}
    try {
      ensureBVHForObject(mesh);
    } catch (e) {}
    bumpSceneVersion("sculpt-start");
    try {
      orbitRef.current && (orbitRef.current.enabled = false);
      transformRef.current && (transformRef.current.enabled = false);
    } catch (e) {}
    needsRenderRef.current = true;
    return true;
  };
  const stopSculptingInternal = () => {
    if (!sculptStateRef.current.active) return;
    sculptStateRef.current.active = false;
    sculptStateRef.current.target = null;
    sculptStateRef.current.pointerDown = false;
    sculptStateRef.current.lastPoint = null;
    sculptStateRef.current.undoTmp = null;
    bumpSceneVersion("sculpt-stop");
    try {
      orbitRef.current && (orbitRef.current.enabled = true);
      transformRef.current && (transformRef.current.enabled = true);
    } catch (e) {}
    needsRenderRef.current = true;
  };

  // sculpt pointer events
  const onSculptPointerDown = (event) => {
    if (!sculptStateRef.current.active) return;
    sculptStateRef.current.pointerDown = true;
    try {
      const rect = rendererRef.current.domElement.getBoundingClientRect();
      const ndc = new THREE.Vector2(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
      raycasterRef.current.setFromCamera(ndc, cameraRef.current);
      const hits = raycasterRef.current.intersectObjects(sceneRef.current.children, true);
      if (!hits || hits.length === 0) return;
      const hit = hits[0];
      const mesh = sculptStateRef.current.target || findObjektaAncestor(hit.object);
      if (!mesh) return;
      const worldPoint = hit.point.clone();
      
      sculptStateRef.current.lastPoint = worldPoint.clone(); // Initialize lastPoint

      const res = applyBrushToMesh(mesh, worldPoint, {
        radius: sculptStateRef.current.radius,
        strength: sculptStateRef.current.strength,
        mode: sculptStateRef.current.mode,
        viewDir: cameraRef.current.getWorldDirection(new THREE.Vector3()).clone(),
      });
      if (res && res.changed && res.changed.size > 0) sculptStateRef.current.undoTmp = res.changed;
    } catch (e) {
      console.warn("sculpt pointerdown", e);
    }
  };
  const onSculptPointerMove = (event) => {
    if (!sculptStateRef.current.active || !sculptStateRef.current.pointerDown) return;
    try {
      const rect = rendererRef.current.domElement.getBoundingClientRect();
      const ndc = new THREE.Vector2(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
      raycasterRef.current.setFromCamera(ndc, cameraRef.current);
      const hits = raycasterRef.current.intersectObjects(sceneRef.current.children, true);
      
      // For grab, we might not hit the object if we dragged off it, but we still want to move vertices based on mouse delta.
      // But we need a reference point.
      // If we have a target, we can project the mouse ray onto a plane at the target's depth?
      
      if (!hits || hits.length === 0) return;
      const hit = hits[0];
      const mesh = sculptStateRef.current.target || findObjektaAncestor(hit.object);
      if (!mesh) return;
      const worldPoint = hit.point.clone();
      
      // Calculate delta
      let delta = null;
      if (sculptStateRef.current.lastPoint) {
          delta = worldPoint.clone().sub(sculptStateRef.current.lastPoint);
      }
      sculptStateRef.current.lastPoint = worldPoint.clone();

      const res = applyBrushToMesh(mesh, worldPoint, {
        radius: sculptStateRef.current.radius,
        strength: sculptStateRef.current.strength,
        mode: sculptStateRef.current.mode,
        viewDir: cameraRef.current.getWorldDirection(new THREE.Vector3()).clone(),
        delta: delta
      });
      if (res && res.changed && res.changed.size > 0) {
        if (!sculptStateRef.current.undoTmp) sculptStateRef.current.undoTmp = new Map();
        for (const [k, v] of res.changed) {
          if (!sculptStateRef.current.undoTmp.has(k)) sculptStateRef.current.undoTmp.set(k, v);
        }
      }
    } catch (e) {
      console.warn("sculpt pointermove", e);
    }
  };
  const onSculptPointerUp = () => {
    if (!sculptStateRef.current.active || !sculptStateRef.current.pointerDown) return;
    sculptStateRef.current.pointerDown = false;
    const mesh = sculptStateRef.current.target;
    if (sculptStateRef.current.undoTmp && mesh) {
      pushSculptCommand(mesh, sculptStateRef.current.undoTmp, "sculpt-stroke");
      sculptStateRef.current.undoTmp = null;
      bumpSceneVersion("sculpt-stroke-commit");
    }
  };

  // API wrappers that accept pointer-like objects
  const wrapperSculptPointerDown = (evOrObj) => {
    try {
      if (!evOrObj) return;
      let e = evOrObj;
      if (!(evOrObj instanceof Event) && typeof evOrObj.x === "number") {
        e = { clientX: evOrObj.x, clientY: evOrObj.y, pressure: evOrObj.pressure ?? 0.5 };
      }
      onSculptPointerDown(e);
    } catch (e) {
      console.warn("wrapperSculptPointerDown", e);
    }
  };
  const wrapperSculptPointerMove = (evOrObj) => {
    try {
      if (!evOrObj) return;
      let e = evOrObj;
      if (!(evOrObj instanceof Event) && typeof evOrObj.x === "number") {
        e = { clientX: evOrObj.x, clientY: evOrObj.y, pressure: evOrObj.pressure ?? 0.5, pxRadius: evOrObj.pxRadius };
      }
      onSculptPointerMove(e);
    } catch (e) {
      console.warn("wrapperSculptPointerMove", e);
    }
  };
  const wrapperSculptPointerUp = (evOrObj) => {
    try {
      if (!evOrObj) {
        onSculptPointerUp();
        return;
      }
      let e = evOrObj;
      if (!(evOrObj instanceof Event) && typeof evOrObj.x === "number") {
        e = { clientX: evOrObj.x, clientY: evOrObj.y, pressure: evOrObj.pressure ?? 0 };
      }
      onSculptPointerUp(e);
    } catch (e) {
      console.warn("wrapperSculptPointerUp", e);
    }
  };


  // sculpt setters
  const setSculptRadius = (r) => {
    sculptStateRef.current.radius = r;
  };
  const setSculptStrength = (s) => {
    sculptStateRef.current.strength = s;
  };
  const setSculptMode = (m) => {
    sculptStateRef.current.mode = m;
  };
  const setSculptSymmetry = (s) => {
    sculptStateRef.current.symmetry = s;
  };

  // dispose helper
  const disposeObject = (obj) => {
    if (!obj) return;
    obj.traverse((n) => {
      if (n.isMesh) {
        try {
          n.geometry?.disposeBoundsTree?.();
        } catch (e) {}
        try {
          n.geometry?.dispose?.();
        } catch (e) {}
        try {
          const m = n.material;
          if (m) {
            if (Array.isArray(m)) m.forEach((mm) => mm?.dispose?.());
            else m?.dispose?.();
            if (m.map) m.map?.dispose?.();
          }
        } catch (e) {}
      }
    });
  };

  const findObjektaAncestor = (obj) => {
    let o = obj;
    while (o && o !== sceneRef.current) {
      if (o.userData?.__objekta) return o;
      o = o.parent;
    }
    return null;
  };

  const getUserGroup = (scene = sceneRef.current) => {
    if (!scene) return null;
    if (!scene._user_group && !scene._userGroup) {
      const g = new THREE.Group();
      g.name = "_user_group";
      safeAdd(scene, g, "_user_group");
      scene._userGroup = scene._user_group = g;
    }
    return scene._user_group ?? scene._userGroup;
  };

  // ---------- Init Scene & Renderer ----------
  useEffect(() => {
    if (!canvasRef.current) return;

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0a1a);
    sceneRef.current = scene;

    const editorGroup = new THREE.Group();
    editorGroup.name = "_editor_group";
    const userGroup = new THREE.Group();
    userGroup.name = "_user_group";
    safeAdd(scene, editorGroup, "_editor_group");
    safeAdd(scene, userGroup, "_user_group");
    sceneRef.current._editorGroup = editorGroup;
    sceneRef.current._userGroup = userGroup;

    // Camera
    const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 2000);
    camera.position.set(3, 3, 6);
    cameraRef.current = camera;

    // Renderer (preserveDrawingBuffer disabled; use ephemeral renderer for captures)
    const renderer = new THREE.WebGLRenderer({
      antialias: false,
      stencil: false,
      alpha: false,
      depth: true,
      powerPreference: "high-performance",
      preserveDrawingBuffer: false,
      canvas: canvasRef.current,
    });
    renderer.setPixelRatio(window.devicePixelRatio || 1);
    renderer.shadowMap.enabled = true;
    // Prefer physically correct lighting & modern tone mapping for realistic PBR appearance.
    try {
      if (renderer.useLegacyLights !== undefined) renderer.useLegacyLights = false; // r152+
      else if (renderer.physicallyCorrectLights !== undefined) renderer.physicallyCorrectLights = true; // older versions
    } catch (e) {}
    try { renderer.toneMapping = THREE.ACESFilmicToneMapping; } catch (e) {}
    try { renderer.toneMappingExposure = 1.0; } catch (e) {}
    try { THREE.ColorManagement && (THREE.ColorManagement.enabled = true); } catch (e) {}
    // Legacy property outputEncoding removed in newer Three; use outputColorSpace when available
    try {
      if (renderer.outputColorSpace !== THREE.SRGBColorSpace) renderer.outputColorSpace = THREE.SRGBColorSpace;
    } catch (e) {
      // fallback for older builds
      if (THREE.sRGBEncoding && renderer.outputEncoding !== undefined && renderer.outputEncoding !== THREE.sRGBEncoding) {
        try { renderer.outputEncoding = THREE.sRGBEncoding; } catch (e2) {}
      }
    }
    rendererRef.current = renderer;

    // Load any saved camera bookmarks once renderer/camera exist
    try { loadCameraBookmarksFromStorage(); } catch (e) {}

    // Camera controls (helper)
    try {
      const camApi = initCameraControls({ camera, domElement: renderer.domElement, autoRotate: false, damping: 0.08 });
      cameraControlsApiRef.current = camApi;
      orbitRef.current = camApi.controls;
      camApi.controls.addEventListener && camApi.controls.addEventListener("change", () => {
        needsRenderRef.current = true;
      });
    } catch (e) {
      const orbit = new OrbitControls(camera, renderer.domElement);
      orbit.enableDamping = true;
      orbitRef.current = orbit;
      orbit.addEventListener("change", () => {
        needsRenderRef.current = true;
      });
    }

    // Transform controls
    const transform = new TransformControls(camera, renderer.domElement);
    transform.addEventListener("dragging-changed", (e) => {
      orbitRef.current && (orbitRef.current.enabled = !e.value);
      try {
        EventBus.emit && EventBus.emit("transform:dragging", { active: e.value });
      } catch (err) {}
    });
    transform.addEventListener("change", () => {
      updateToolbarPosition();
      needsRenderRef.current = true;
    });
    transform.addEventListener("mouseDown", () => {
      const obj = transform.object;
      const scene = sceneRef.current;
      if (!obj || !scene || !scene.getObjectById(obj.id)) {
        try { transform.detach(); } catch (e) {}
        clearSelection();
        return;
      }
      try { obj.updateMatrixWorld(true); } catch (e) {}
    });
    transform.addEventListener("mouseUp", () => {
      needsRenderRef.current = true;
      try {
        EventBus.emit && EventBus.emit("transform:commit", { object: transform.object });
      } catch (e) {}
      cmdHistoryRef.current.push(new Cmd(() => {}, () => {}, "transform"));
    });
    safeAdd(editorGroup, transform, "_transform_controls");
    transformRef.current = transform;

    // editor lights & helpers
    const amb = new THREE.AmbientLight(0xffffff, 0.45);
    amb.name = "_ambient_light";
    const hemi = new THREE.HemisphereLight(0x606080, 0x202020, 0.4);
    hemi.name = "_hemi_light";
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(5, 10, 7.5);
    dirLight.name = "_dir_light";
    safeAdd(editorGroup, amb, "_ambient_light");
    safeAdd(editorGroup, hemi, "_hemi_light");
    safeAdd(editorGroup, dirLight, "_dir_light");
    const grid = new THREE.GridHelper(40, 80, 0x33ffcc, 0x5500ff);
    grid.name = "_grid";
    safeAdd(editorGroup, grid, "_grid");
    safeAdd(editorGroup, new THREE.AxesHelper(3), "_axes_helper");

    const selectionBox = new THREE.BoxHelper();
    selectionBox.name = "_selection_box";
    selectionBox.visible = false;
    safeAdd(editorGroup, selectionBox, "_selection_box");

    // composer via helper (optional) with safe non-zero sizing
    try {
      const rawW = containerRef.current ? containerRef.current.clientWidth : 800;
      const rawH = containerRef.current ? containerRef.current.clientHeight : 600;
      const initW = rawW < 10 ? 800 : rawW;
      const initH = rawH < 10 ? 600 : rawH;
      const postfx = setupPostProcessing({
        renderer,
        scene,
        camera,
        width: initW,
        height: initH,
        options: { bloomStrength: 0.55, bloomRadius: 0.3, bloomThreshold: 0.9, selectiveBloom: true },
      });
      postfxApiRef.current = postfx;
      composerRef.current = postfx.composer;
    } catch (e) {
      console.warn("Composer init failed", e);
      composerRef.current = null;
      postfxApiRef.current = null;
    }

    // shared loaders
    try {
      if (!dracoRef.current) {
        dracoRef.current = new DRACOLoader();
        dracoRef.current.setDecoderPath("/draco/");
      }
      const gltfLoader = createSafeGLTFLoader();
      gltfLoader.setDRACOLoader && gltfLoader.setDRACOLoader(dracoRef.current);
      try {
        ktx2Ref.current = new KTX2Loader().setTranscoderPath("/basis/").detectSupport(renderer);
        gltfLoader.setKTX2Loader && gltfLoader.setKTX2Loader(ktx2Ref.current);
      } catch (e) {}
      gltfLoaderRef.current = gltfLoader;
    } catch (e) {
      console.warn("Shared loader init failed", e);
      gltfLoaderRef.current = null;
    }

    // lighting + environment helpers
    try {
      lightingApiRef.current = setupDefaultLighting(scene, renderer, { addHelpers: false });
    } catch (e) {
      console.warn("lighting init failed", e);
      lightingApiRef.current = null;
    }
    try {
      envApiRef.current = setupEnvironment({ scene, renderer });
      // Wrap setHDR to track last URL for context restore
      if (envApiRef.current?.setHDR) {
        const originalSetHDR = envApiRef.current.setHDR;
        const lastEnvUrlRef = { value: null };
        envApiRef.current.setHDR = async (url) => {
          lastEnvUrlRef.value = url || null;
          return originalSetHDR(url);
        };
        envApiRef.current._getLastHDR = () => lastEnvUrlRef.value;
      }
    } catch (e) {
      console.warn("env init failed", e);
      envApiRef.current = null;
    }

    // Expose minimal workspace handle for external systems (e.g. AnimationEngine object lookup)
    try {
      window.__OBJEKTA_WORKSPACE = {
        getScene: () => sceneRef.current,
        getRenderer: () => rendererRef.current,
        captureThumbnail,
        setRenderScale: (scale, opts = {}) => applyResolutionScale(scale, { auto: typeof opts.auto === 'boolean' ? opts.auto : undefined }),
        toggleAutoResolution: (auto) => handleResolutionAutoToggle(auto),
        getResolutionState: () => resolutionStateRef.current,
      };
    } catch (e) {}

    // material editor
    try {
      if (containerRef.current && typeof createMaterialEditor === "function") {
        materialEditorApiRef.current = createMaterialEditor({
          container: containerRef.current,
          getSelectedMesh: () => {
            const sel = selectedInternal || null;
            if (!sel) return null;
            let found = null;
            sel.traverse((n) => {
              if (!found && n.isMesh) found = n;
            });
            return found;
          },
        });
      }
    } catch (e) {
      console.warn("Material editor init failed", e);
    }

    // GLB Importer Helper (drop / drag UI)
    try {
      if (containerRef.current && typeof initGLBImporter === "function") {
        glbImporterApiRef.current = initGLBImporter({
          scene,
          domElement: containerRef.current,
          onLoad: async (gltf, meta, stats) => {
            try {
              let root = gltf && (gltf.scene || (gltf.scenes && gltf.scenes[0]) || gltf);
              if (!root) { console.warn("GLB importer passed no scene root"); return; }
              if (stats) {
                try { EventBus.emit?.("import:stats", stats); } catch (e) {}
                if (stats.triangles > 4500000 || (stats.totalTexels && stats.totalTexels > 35_000_000)) {
                  console.warn("[Workspace] Heavy import detected; disabling postFX/mini preview to avoid context loss");
                  disablePostFX();
                  disableMiniRenderer();
                  try { if (rendererRef.current) rendererRef.current.shadowMap.enabled = false; } catch (e) {}
                }
                if (stats.triangles > 3000000 && rendererRef.current) {
                  dynResRef.current.scale = 0.85;
                  syncResolutionState({ scale: dynResRef.current.scale, auto: false });
                  autoResolutionRef.current = false;
                  try { rendererRef.current.setPixelRatio((window.devicePixelRatio || 1) * dynResRef.current.scale); } catch (e) {}
                }
              }
              isBulkImportRef.current = true;
              if (composerRef.current) {
                try { composerRef.current.enabled = false; } catch (e) { console.warn('[Workspace] disable composer during import failed', e); }
              }
              let originalFileMeta = null;
              try {
                if (meta && meta.file && typeof meta.file.arrayBuffer === "function") {
                  const arrayBuffer = await meta.file.arrayBuffer();
                  originalFileMeta = { __arrayBuffer: arrayBuffer, name: meta.file.name || "imported.glb", type: meta.file.type || "model/gltf-binary", size: meta.file.size || (arrayBuffer && arrayBuffer.byteLength) };
                } else if (meta && meta.arrayBuffer) {
                  originalFileMeta = { __arrayBuffer: meta.arrayBuffer, name: meta.name || "imported.glb", type: meta.type || "model/gltf-binary", size: meta.size || (meta.arrayBuffer && meta.arrayBuffer.byteLength) };
                }
              } catch (e) {}
              // Normalize materials & textures to proper color space to avoid blue tint
              try {
                root.traverse((obj) => {
                  if (obj.isMesh) {
                    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
                    mats.forEach((m) => {
                      if (!m) return;
                      // Ensure standard materials use correct tone & color space
                      if (m.map && m.map.colorSpace && m.map.colorSpace !== THREE.SRGBColorSpace) {
                        try { m.map.colorSpace = THREE.SRGBColorSpace; m.map.needsUpdate = true; } catch (e) {}
                      }
                      if (m.emissive && m.emissive.isColor && m.emissive.equals(new THREE.Color(0x0000ff))) {
                        // Avoid default bright emissive blue if loader produced odd values
                        m.emissive.multiplyScalar(0.2);
                      }
                      if (m.color && m.color.isColor) {
                        // Slight neutralization if overly saturated blue
                        const hsl = { h:0, s:0, l:0 };
                        m.color.getHSL(hsl);
                        if (hsl.h > 0.55 && hsl.h < 0.75 && hsl.s > 0.5) {
                          m.color.setHSL(hsl.h, hsl.s * 0.6, hsl.l * 1.05);
                        }
                      }
                    });
                  }
                  if (obj.isTexture && obj.colorSpace && obj.colorSpace !== THREE.SRGBColorSpace) {
                    try { obj.colorSpace = THREE.SRGBColorSpace; obj.needsUpdate = true; } catch (e) {}
                  }
                });
              } catch (e) { /* non-fatal */ }

              addGLTF(root, null, () => {}, originalFileMeta).finally(() => {
                isBulkImportRef.current = false;
                commitHistory("import-bulk");
              if (root.userData?.__missingResources) {
                try { EventBus.emit?.("import:missingResources", root.userData.__missingResources); } catch (e) {}
              }
              if (composerRef.current) {
                try { composerRef.current.enabled = true; } catch (e) { console.warn('[Workspace] re-enable composer failed', e); }
              }
              });
            } catch (err) { console.warn("GLB importer onLoad wrapper failed", err); }
          },
        });
      }
    } catch (e) {
      console.warn("GLB importer init failed", e);
    }

    // ---------- MINI (PALETTE) CAMERA SETUP ----------
    try {
      if (!miniDisabledRef.current) {
        const miniCanvas = document.createElement("canvas");
        miniCanvas.style.position = "absolute";
        miniCanvas.style.left = "12px";
        miniCanvas.style.top = "12px";
        miniCanvas.style.width = "140px";
        miniCanvas.style.height = "140px";
        miniCanvas.style.borderRadius = "8px";
        miniCanvas.style.boxShadow = "0 10px 30px rgba(0,0,0,0.5)";
        miniCanvas.style.zIndex = 80;
        miniCanvas.style.pointerEvents = "auto";
        miniCanvasRef.current = miniCanvas;

        const miniRenderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: "high-performance", canvas: miniCanvas, alpha: true });
        miniRenderer.setPixelRatio(window.devicePixelRatio || 1);
        miniRenderer.setSize(140, 140, false);
        miniRenderer.setClearColor(0x000000, 0.0);
        miniRendererRef.current = miniRenderer;

        const miniCamera = new THREE.PerspectiveCamera(70, 1, 0.1, 2000);
        miniCamera.position.set(2.5, 2.5, 2.5);
        miniCamera.lookAt(new THREE.Vector3(0, 0, 0));
        miniCameraRef.current = miniCamera;

        const miniOrbit = new OrbitControls(miniCamera, miniRenderer.domElement);
        miniOrbit.enablePan = false;
        miniOrbit.enableZoom = true;
        miniOrbit.enableDamping = true;
        miniOrbit.addEventListener("change", () => {
          try {
            const mainCam = cameraRef.current;
            if (!mainCam) return;
            const target = orbitRef.current?.target ? orbitRef.current.target.clone() : new THREE.Vector3(0, 0, 0);
            const dir = new THREE.Vector3();
            miniCamera.getWorldDirection(dir);
            const mainDist = mainCam.position.distanceTo(target);
            const newPos = target.clone().add(dir.clone().multiplyScalar(-mainDist));
            mainCam.position.copy(newPos);
            mainCam.quaternion.copy(miniCamera.quaternion);
            if (orbitRef.current && orbitRef.current.target) orbitRef.current.target.copy(target);
            needsRenderRef.current = true;
          } catch (e) {
            // swallow
          }
        });
        miniOrbitRef.current = miniOrbit;

        miniRenderer.domElement.addEventListener("dblclick", () => {
          try {
            const mainCam = cameraRef.current;
            if (!mainCam) return;
            mainCam.position.set(3, 3, 6);
            mainCam.lookAt(0, 0, 0);
            orbitRef.current?.reset && orbitRef.current.reset();
            needsRenderRef.current = true;
          } catch (e) {}
        });
      }
    } catch (e) {
      console.warn("Mini camera init failed", e);
    }

    // pointer selection / hover / dblclick + render loop
    const onPointerDown = (event) => {
      if (!rendererRef.current || !cameraRef.current) return;
      if (sculptStateRef.current?.active) return;
      const rect = rendererRef.current.domElement.getBoundingClientRect();
      mouseRef.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouseRef.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycasterRef.current.setFromCamera(mouseRef.current, cameraRef.current);
      const intersects = raycasterRef.current.intersectObjects(sceneRef.current.children, true);
      let foundObj = null;
      for (const it of intersects) {
        const obj = findObjektaAncestor(it.object);
        if (obj) {
          foundObj = obj;
          break;
        }
      }
      if (foundObj) {
        selectObject(foundObj);
        try {
          // Guard: only attach if object still in scene graph
          if (sceneRef.current && sceneRef.current.getObjectById(foundObj.id)) {
            transformRef.current.setMode(transformMode);
            transformRef.current.attach(foundObj);
          }
        } catch (e) {}
      } else {
        clearSelection();
      }
      needsRenderRef.current = true;
    };
    renderer.domElement.addEventListener("pointerdown", onPointerDown);

    const onPointerMove = (event) => {
      if (!rendererRef.current || !cameraRef.current) return;
      const rect = rendererRef.current.domElement.getBoundingClientRect();
      const ndc = new THREE.Vector2(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1
      );
      raycasterRef.current.setFromCamera(ndc, cameraRef.current);
      const intersects = raycasterRef.current.intersectObjects(sceneRef.current.children, true);
      let displayObj = null;
      if (intersects.length > 0) {
        for (const it of intersects) {
          const obj = findObjektaAncestor(it.object);
          if (obj) {
            displayObj = obj;
            break;
          }
        }
      }
      if (displayObj) {
        const displayName = displayObj.name || (displayObj.userData && displayObj.userData.name) || "object";
        setHover({
          name: displayName,
          x: clamp(event.clientX - rect.left + 12, 8, rect.width - 120),
          y: clamp(event.clientY - rect.top + 10, 8, rect.height - 28),
        });
      } else setHover({ name: "", x: -999, y: -999 });
    };
    let pointerMovePending = false;
    let lastPointerEvent = null;
    const onPointerMoveRaf = (ev) => {
      lastPointerEvent = ev;
      if (pointerMovePending) return;
      pointerMovePending = true;
      requestAnimationFrame(() => {
        try { onPointerMove(lastPointerEvent); } catch (e) {}
        pointerMovePending = false;
        lastPointerEvent = null;
      });
    };
    renderer.domElement.addEventListener("pointermove", onPointerMoveRaf);

    const onDblClick = (e) => {
      if (!rendererRef.current || !cameraRef.current) return;
      const rect = rendererRef.current.domElement.getBoundingClientRect();
      const ndc = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1
      );
      raycasterRef.current.setFromCamera(ndc, cameraRef.current);
      const intersects = raycasterRef.current.intersectObjects(sceneRef.current.children, true);
      let focusObj = null;
      for (const it of intersects) {
        const obj = findObjektaAncestor(it.object);
        if (obj) {
          focusObj = obj;
          break;
        }
      }
      if (focusObj) {
        const pos = new THREE.Vector3();
        focusObj.getWorldPosition(pos);
        const cam = cameraRef.current;
        const offset = new THREE.Vector3(0, 1.8, 3).applyQuaternion(cam.quaternion);
        cam.position.copy(pos).add(offset);
        cameraControlsApiRef.current?.controls && cameraControlsApiRef.current.controls.target.copy(pos);
        needsRenderRef.current = true;
      }
    };
    renderer.domElement.addEventListener("dblclick", onDblClick);

    // WebGL context loss / restore handling
    const onContextLost = (e) => {
      try { e.preventDefault(); } catch (err) {}
      console.warn("[Workspace] WebGL context lost");
      disableMiniRenderer();
      disablePostFX();
      needsRenderRef.current = false;
      try { renderer.forceContextRestore?.(); } catch (err) {}
    };
    const onContextRestored = () => {
      console.warn("[Workspace] WebGL context restored; reinitializing post-processing");
      try {
        if (!isCanvasReady) {
          console.warn("[Workspace] Context restored, but canvas not ready. Deferring post-fx re-init.");
          return;
        }
        // Do not dispose old composer here to avoid invalid delete errors; just rebuild a new one
        composerRef.current = null;
        postfxApiRef.current = null;
        const sizeV = renderer.getSize(new THREE.Vector2());
        const w = sizeV.x < 10 ? 800 : sizeV.x;
        const h = sizeV.y < 10 ? 600 : sizeV.y;
        const postfx = setupPostProcessing({
          renderer,
          scene: sceneRef.current,
          camera: cameraRef.current,
          width: w,
          height: h,
          options: { bloomStrength: 0.55, bloomRadius: 0.3, bloomThreshold: 0.9, selectiveBloom: true },
        });
        postfxApiRef.current = postfx;
        composerRef.current = postfx.composer;
        try { if (renderer.useLegacyLights !== undefined) renderer.useLegacyLights = false; } catch(e){}
        try { renderer.toneMapping = THREE.ACESFilmicToneMapping; } catch(e){}
        try { renderer.toneMappingExposure = 1.0; } catch(e){}
        try { renderer.info?.reset?.(); } catch (e) {}
        try {
          const lastHdr = envApiRef.current?._getLastHDR?.();
          if (lastHdr) envApiRef.current.setHDR(lastHdr).catch(()=>{});
        } catch (e) {}
        try {
          sceneRef.current.traverse((o) => {
            if (o.isMesh) {
              const mats = Array.isArray(o.material) ? o.material : [o.material];
              mats.forEach(m => { if (m) m.needsUpdate = true; });
            }
          });
        } catch (e) {}
        needsRenderRef.current = true;
      } catch (err) {
        console.warn("[Workspace] postfx reinit failed after context restore", err);
      }
    };
    renderer.domElement.addEventListener("webglcontextlost", onContextLost, false);
    renderer.domElement.addEventListener("webglcontextrestored", onContextRestored, false);

    // Attach sculpt pointer handlers to renderer canvas
    renderer.domElement.addEventListener("pointerdown", onSculptPointerDown);
    renderer.domElement.addEventListener("pointermove", onSculptPointerMove);
    window.addEventListener("pointerup", onSculptPointerUp);

    // ---------- Resize Observer (The robust solution) ----------
    let zeroSizeWarned = false;
    const resizeObserver = new ResizeObserver(entries => {
        for (let entry of entries) {
            const { width, height } = entry.contentRect;
            if (width > 10 && height > 10) {
                if (!isCanvasReady) {
                    console.log(`[Workspace] Canvas is ready (${width}x${height}). Initializing renderer size.`);
                    doResize(width, height);
                    setIsCanvasReady(true);
                } else {
                    // If already ready, just resize
                    doResize(width, height);
                }
            } else {
                if (isCanvasReady) {
                  if (!zeroSizeWarned) {
                    zeroSizeWarned = true;
                    console.warn(`[Workspace] Canvas became zero-sized. Pausing renderer.`);
                  }
                    setIsCanvasReady(false);
                }
            }
        }
    });

    if (containerRef.current) {
        resizeObserver.observe(containerRef.current);
    }


    // ---------- Render loop ----------
    let mounted = true;
    // load adaptive scale initial
    try {
      const initialScale = forceFullResRef.current ? 1 : loadAdaptiveScale();
      dynResRef.current.scale = initialScale || 1;
      if (rendererRef.current) {
        try { rendererRef.current.setPixelRatio((window.devicePixelRatio || 1) * dynResRef.current.scale); } catch (e) {}
      }
      autoResolutionRef.current = false;
      syncResolutionState({ scale: dynResRef.current.scale, auto: false });
    } catch (e) {}

    const tick = () => {
      if (!mounted) return;
      requestAnimationFrame(tick);

      if (!isCanvasReady) return; // master guard

      // Detach transform controls if the target disappeared
      try {
        const target = transformRef.current?.object;
        const scene = sceneRef.current;
        if (target && scene && !scene.getObjectById(target.id)) {
          try { transformRef.current?.detach?.(); } catch (e) {}
          clearSelection();
        }
      } catch (e) {}

      // Update controls
      try { cameraControlsApiRef.current?.controls?.update?.() ?? orbitRef.current?.update?.(); } catch (e) {}

      // FPS & adaptive resolution
      try {
        const now = performance.now();
        const dt = now - fpsRef.current.lastTime;
        fpsRef.current.lastTime = now;
        fpsRef.current.frames++;
        fpsRef.current.accumTime += dt;
        if (fpsRef.current.accumTime >= 500) { // twice per second
            fpsRef.current.fps = Math.round((fpsRef.current.frames / fpsRef.current.accumTime) * 1000);
            fpsRef.current.frames = 0; fpsRef.current.accumTime = 0;
            if (Math.abs((resolutionStateRef.current.fps || 0) - fpsRef.current.fps) > 1) {
              syncResolutionState({ fps: fpsRef.current.fps });
            }
            const renderer = rendererRef.current;
            if (renderer) {
              if (autoResolutionRef.current) {
                const low = 34, high = 55;
                if (fpsRef.current.fps < low && dynResRef.current.downCooldown <= 0) {
                  dynResRef.current.scale = Math.max(0.75, dynResRef.current.scale - 0.1);
                  dynResRef.current.downCooldown = 2000;
                  try { renderer.setPixelRatio((window.devicePixelRatio || 1) * dynResRef.current.scale); } catch(e){}
                  if (!forceFullResRef.current) persistAdaptiveScale(dynResRef.current.scale);
                  syncResolutionState({ scale: dynResRef.current.scale });
                  needsRenderRef.current = true;
                } else if (fpsRef.current.fps > high && dynResRef.current.upCooldown <= 0) {
                  dynResRef.current.scale = Math.min(1, dynResRef.current.scale + 0.1);
                  dynResRef.current.upCooldown = 3000;
                  try { renderer.setPixelRatio((window.devicePixelRatio || 1) * dynResRef.current.scale); } catch(e){}
                  if (!forceFullResRef.current) persistAdaptiveScale(dynResRef.current.scale);
                  syncResolutionState({ scale: dynResRef.current.scale });
                  needsRenderRef.current = true;
                }
              } else {
                const desiredPR = (window.devicePixelRatio || 1) * (dynResRef.current.scale || 1);
                try {
                  const currentPR = renderer.getPixelRatio ? renderer.getPixelRatio() : desiredPR;
                  if (Math.abs(currentPR - desiredPR) > 0.01) {
                    renderer.setPixelRatio(desiredPR);
                    needsRenderRef.current = true;
                  }
                } catch (e) {}
              }
            }
        }
        if (dynResRef.current.downCooldown > 0) dynResRef.current.downCooldown -= dt;
        if (dynResRef.current.upCooldown > 0) dynResRef.current.upCooldown -= dt;
      } catch (e) {}

      // Animation & simple effects
      try {
        const nowMs = performance.now();
        const delta = (nowMs - animClockRef.current) * 0.001;
        animClockRef.current = nowMs;
        const t = nowMs * 0.001;
        try {
          const animChanged = animationEngineRef.current.update(delta);
          if (animChanged) needsRenderRef.current = true;
        } catch (e) {}
        const ocean = sceneRef.current?.getObjectByName('_oceanEffect');
        if (ocean?.material?.uniforms?.time) { ocean.material.uniforms.time.value = t; needsRenderRef.current = true; }
        const rainGroup = sceneRef.current?.getObjectByName('_rainEffect');
        if (rainGroup) {
          rainGroup.children.forEach((p) => { const v = p.userData.v || 0.06; p.position.y -= v; if (p.position.y < 0) p.position.y = 10 + Math.random()*2; });
          needsRenderRef.current = true;
        }
      } catch (e) {}

      // Fallback lights if none
      try {
        const scene = sceneRef.current;
        if (scene) {
          let lightCount = 0; scene.traverse(o => { if (o.isLight) lightCount++; });
          const hasEnv = !!scene.environment;
          if (lightCount === 0 && !hasEnv) {
            if (!fallbackLightsRef.current.amb) {
              const amb = new THREE.AmbientLight(0xffffff, 0.65); amb.name = '_fallback_amb';
              const dir = new THREE.DirectionalLight(0xffffff, 0.85); dir.position.set(4,6,3); dir.name = '_fallback_dir';
              scene.add(amb); scene.add(dir);
              fallbackLightsRef.current.amb = amb; fallbackLightsRef.current.dir = dir;
              needsRenderRef.current = true; console.warn('[Workspace] Added fallback lights');
            }
          } else if (fallbackLightsRef.current.amb && lightCount > 0) {
            try { scene.remove(fallbackLightsRef.current.amb); } catch(e){}
            try { scene.remove(fallbackLightsRef.current.dir); } catch(e){}
            fallbackLightsRef.current.amb = null; fallbackLightsRef.current.dir = null;
            needsRenderRef.current = true; console.log('[Workspace] Removed fallback lights');
          }
        }
      } catch (e) {}

      // Render
      if (needsRenderRef.current) {
        const renderer = rendererRef.current;
        try {
          const composerActive = postfxApiRef.current?.composer ? postfxApiRef.current.composer.enabled !== false : true;
          if (postfxApiRef.current?.render && composerActive) {
            postfxApiRef.current.render();
          } else if (composerRef.current && composerRef.current.enabled !== false) {
            const sizeV = renderer.getSize(new THREE.Vector2());
            if (sizeV.x >= 2 && sizeV.y >= 2) composerRef.current.render();
          } else if (renderer && sceneRef.current && cameraRef.current) {
            renderer.render(sceneRef.current, cameraRef.current);
          }
          if (miniRendererRef.current && miniCameraRef.current && !miniDisabledRef.current) {
            try { miniRendererRef.current.render(sceneRef.current, miniCameraRef.current); } catch(e){}
          }
        } catch (e) { console.warn('Render failed:', e); }
        needsRenderRef.current = false;
      }

      // Perf panel removed: HUD disabled for production
    };
    tick();

    // The ResizeObserver replaces the window resize listener.
    // window.addEventListener("resize", doResize);
    // try { doResize(); } catch (e) { console.warn("initial resize failed", e); }

    const onFs = () => onFullScreenChange?.(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFs);

    const onKeyDown = (e) => {
      const cmd = e.ctrlKey || e.metaKey;
      const tag = (e.target?.tagName || "").toLowerCase();
      if (tag === "input" || tag === "textarea" || e.target?.isContentEditable) return;
      const key = e.key.toLowerCase();
      if (cmd && key === "z") {
        e.preventDefault();
        e.shiftKey ? redo() : undo();
      } else if (cmd && key === "y") {
        e.preventDefault();
        redo();
      } else if (cmd && key === "d") {
        e.preventDefault();
        duplicateSelected();
      } else if (cmd && e.shiftKey && ["1", "2", "3", "4"].includes(key)) {
        e.preventDefault();
        saveCameraBookmark(key);
      } else if (cmd && ["1", "2", "3", "4"].includes(key)) {
        e.preventDefault();
        loadCameraBookmark(key);
      } else if (!cmd && e.shiftKey && key === "f") {
        e.preventDefault();
        frameSelection();
      } else if (!cmd && e.shiftKey && key === "a") {
        e.preventDefault();
        frameAll();
      } else if (!cmd && e.shiftKey && key === "h") {
        e.preventDefault();
        frameHierarchy();
      } else if (!cmd && e.altKey && ["1", "2", "3", "4"].includes(key)) {
        e.preventDefault();
        if (key === "1") applyViewPreset("front");
        else if (key === "2") applyViewPreset("right");
        else if (key === "3") applyViewPreset("top");
        else applyViewPreset("iso");
      } else if (e.key === "Delete") deleteSelected();
    };
    window.addEventListener("keydown", onKeyDown);

    try {
      const saved = localStorage.getItem(AUTOSAVE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed?.snaps) {
          snapshotHistoryRef.current.push({ label: "autosave-restore", snaps: parsed.snaps });
          snapshotHistoryIndexRef.current = snapshotHistoryRef.current.length - 1;
        }
      }
    } catch (err) {}

    const autosaveInterval = setInterval(() => {
      try {
        const data = serializeScene();
        if (data) localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(data));
      } catch (err) {}
    }, 60000);

    const beforeUnload = () => {
      try {
        const data = serializeScene();
        if (data) localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(data));
      } catch (err) {}
    };
    window.addEventListener("beforeunload", beforeUnload);

    pushHistorySnapshot("init");

    return () => {
      mounted = false;
      clearInterval(autosaveInterval);
      window.removeEventListener("beforeunload", beforeUnload);

      if (resizeObserver && containerRef.current) {
        resizeObserver.unobserve(containerRef.current);
      }
      resizeObserver.disconnect();

      renderer.domElement.removeEventListener("pointerdown", onPointerDown);
      renderer.domElement.removeEventListener("pointermove", onPointerMoveRaf);
      renderer.domElement.removeEventListener("dblclick", onDblClick);
      renderer.domElement.removeEventListener("webglcontextlost", onContextLost);
      renderer.domElement.removeEventListener("webglcontextrestored", onContextRestored);
      renderer.domElement.removeEventListener("pointerdown", onSculptPointerDown);
      renderer.domElement.removeEventListener("pointermove", onSculptPointerMove);
      window.removeEventListener("pointerup", onSculptPointerUp);
      // window.removeEventListener("resize", doResize);
      document.removeEventListener("fullscreenchange", onFs);
      window.removeEventListener("keydown", onKeyDown);

      try {
        transformRef.current?.dispose?.();
      } catch (e) {}
      try {
        orbitRef.current?.dispose?.();
      } catch (e) {}
      try {
        cameraControlsApiRef.current?.dispose?.();
      } catch (e) {}
      try {
        rendererRef.current?.dispose?.();
      } catch (e) {}

      try {
        const ug = getUserGroup();
        const toRemove = ug ? Array.from(ug.children) : [];
        toRemove.forEach((c) => {
          try {
            disposeObject(c);
          } catch (e) {}
          if (c.parent) c.parent.remove(c);
        });
      } catch (err) {}

      try {
        dracoRef.current?.dispose?.();
        dracoRef.current = null;
      } catch (e) {}
      try {
        ktx2Ref.current?.dispose?.();
        ktx2Ref.current = null;
      } catch (e) {}
      try {
        glbImporterApiRef.current?.dispose?.();
        glbImporterApiRef.current = null;
      } catch (e) {}
      try {
        materialEditorApiRef.current?.dispose?.();
        materialEditorApiRef.current = null;
      } catch (e) {}
      try {
        lightingApiRef.current?.dispose?.();
        lightingApiRef.current = null;
      } catch (e) {}
      try {
        envApiRef.current?.dispose?.();
        envApiRef.current = null;
      } catch (e) {}
      try {
        postfxApiRef.current?.dispose?.();
        postfxApiRef.current = null;
      } catch (e) {}
      try {
        composerRef.current?.dispose?.();
        composerRef.current = null;
      } catch (e) {}

      try {
        for (const url of blobUrlsRef.current) {
          try {
            URL.revokeObjectURL(url);
          } catch (e) {}
        }
        blobUrlsRef.current.clear();
      } catch (e) {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onFullScreenChange, panelTopOffset]);

  // Keep transform mode in sync
  useEffect(() => {
    if (transformRef.current && typeof transformRef.current.setMode === "function") {
      try {
        transformRef.current.setMode(transformMode);
      } catch (e) {}
    }
  }, [transformMode]);

  // ---------- Selection ----------
  const selectObject = (obj) => {
    if (!obj) return;
    if (selectedInternal) markSelectionVisual(selectedInternal, false);
    setSelectedInternal(obj);
    onSelect?.(obj);
    try {
      if (sceneRef.current && sceneRef.current.getObjectById(obj.id)) {
        transformRef.current?.attach(obj);
      }
    } catch (e) {}
    try {
      transformRef.current?.setMode(transformMode);
    } catch (e) {}
    markSelectionVisual(obj, true);
    updateToolbarPosition();
    needsRenderRef.current = true;
  };

  const clearSelection = () => {
    if (selectedInternal) markSelectionVisual(selectedInternal, false);
    setSelectedInternal(null);
    onSelect?.(null);
    try {
      transformRef.current?.detach?.();
    } catch (e) {}
    setToolbarPos({ x: -999, y: -999 });
    const selBox = sceneRef.current?._editorGroup?.getObjectByName("_selection_box");
    if (selBox) selBox.visible = false;
    needsRenderRef.current = true;
  };

  const disableMiniRenderer = useCallback(() => {
    try {
      miniDisabledRef.current = true;
      if (miniOrbitRef.current) { miniOrbitRef.current.dispose?.(); miniOrbitRef.current = null; }
      if (miniRendererRef.current) { miniRendererRef.current.dispose?.(); miniRendererRef.current = null; }
      if (miniCanvasRef.current && miniCanvasRef.current.parentElement) {
        miniCanvasRef.current.parentElement.removeChild(miniCanvasRef.current);
      }
      miniCanvasRef.current = null;
    } catch (e) {}
  }, []);

  const markSelectionVisual = (obj, selectedFlag) => {
    if (!obj) return;
    try {
      const selBox = sceneRef.current._editorGroup.getObjectByName("_selection_box");
      if (selBox && selBox.isBoxHelper) {
        if (selectedFlag) {
          selBox.setFromObject(obj);
          selBox.material.color.set(0x7f5af0);
          selBox.visible = true;
        } else selBox.visible = false;
      }
    } catch (err) {}
    obj.traverse((n) => {
      if (n.isMesh && n.material) {
        try {
          const mats = Array.isArray(n.material) ? n.material : [n.material];
          if (selectedFlag) {
            mats.forEach((mat) => {
              try {
                if (mat && mat.emissive && !materialOriginalsRef.current.has(mat)) materialOriginalsRef.current.set(mat, mat.emissive.clone());
                if (mat && mat.emissive) mat.emissive.set(0x7f5af0);
              } catch (e) {}
            });
          } else {
            mats.forEach((mat) => {
              try {
                const orig = materialOriginalsRef.current.get(mat);
                if (orig && mat && mat.emissive) mat.emissive.copy(orig);
                materialOriginalsRef.current.delete(mat);
              } catch (e) {}
            });
          }
        } catch (err) {}
      }
    });
    obj.userData.__selected = !!selectedFlag;
    needsRenderRef.current = true;
  };

  // Multi-select helpers
  const selectedSetRef = useRef(new Set());
  const transformGroupRef = useRef(null);
  const multiParentMapRef = useRef(new Map());

  const toggleMultiSelect = (obj) => {
    if (!obj) return;
    const set = selectedSetRef.current;
    if (set.has(obj)) {
      set.delete(obj);
      markSelectionVisual(obj, false);
      multiParentMapRef.current.delete(obj.uuid);
      try {
        SceneGraphStore.removeObject?.(obj.uuid);
      } catch (e) {}
    } else {
      set.add(obj);
      markSelectionVisual(obj, true);
      try {
        SceneGraphStore.addObject?.(obj.uuid, obj, { name: obj.name, type: obj.type });
      } catch (e) {}
    }
    if (set.size >= 2) createTransformGroupFromSet();
    else dissolveTransformGroup();
    needsRenderRef.current = true;
  };

  const clearMultiSelectionIfAny = () => {
    const set = selectedSetRef.current;
    if (set.size === 0) return;
    for (const o of Array.from(set)) {
      markSelectionVisual(o, false);
      try {
        const origParent = multiParentMapRef.current.get(o.uuid);
        if (origParent && origParent.attach) origParent.attach(o);
      } catch (e) {}
    }
    set.clear();
    multiParentMapRef.current.clear();
    dissolveTransformGroup();
    clearSelection();
  };

  // ---------- Camera helpers (presets, framing, bookmarks) ----------
  const getOrbitTarget = () => {
    try {
      if (orbitRef.current?.target) return orbitRef.current.target.clone();
    } catch (e) {}
    return new THREE.Vector3(0, 0.7, 0);
  };

  const applyCameraState = (state = {}) => {
    const cam = cameraRef.current;
    if (!cam || !state) return false;
    try {
      if (state.position?.isVector3) cam.position.copy(state.position);
      if (state.quaternion?.isQuaternion) cam.quaternion.copy(state.quaternion);
      if (typeof state.zoom === "number") {
        cam.zoom = state.zoom;
        cam.updateProjectionMatrix();
      }
      const target = state.target?.isVector3 ? state.target : getOrbitTarget();
      if (orbitRef.current?.target && target) orbitRef.current.target.copy(target);
      if (cameraControlsApiRef.current?.controls?.target && target) cameraControlsApiRef.current.controls.target.copy(target);
      orbitRef.current?.update?.();
      cameraControlsApiRef.current?.controls?.update?.();
      needsRenderRef.current = true;
      return true;
    } catch (e) {
      return false;
    }
  };

  const applyViewPreset = useCallback((preset = "front") => {
    const cam = cameraRef.current;
    if (!cam) return false;
    const target = getOrbitTarget();
    const dist = Math.max(1.5, cam.position.distanceTo(target));
    const dir = new THREE.Vector3();
    switch (preset) {
      case "back":
        dir.set(0, 0, -1);
        break;
      case "left":
        dir.set(1, 0, 0);
        break;
      case "right":
        dir.set(-1, 0, 0);
        break;
      case "top":
        dir.set(0, 1, 0);
        break;
      case "bottom":
        dir.set(0, -1, 0);
        break;
      case "iso":
      case "isometric":
        dir.set(1, 0.9, 1);
        break;
      default:
        dir.set(0, 0, 1); // front
    }
    dir.normalize();
    const newPos = target.clone().addScaledVector(dir, dist);
    const up = preset === "top" ? new THREE.Vector3(0, 0, -1) : preset === "bottom" ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(0, 1, 0);
    cam.up.copy(up);
    const targetQuat = computeLookAtQuat(newPos, target);
    smoothCameraMove({ toPos: newPos, toTarget: target, toQuat: targetQuat, duration: 0.35 });
    needsRenderRef.current = true;
    return true;
  }, []);

  const computeSelectionBounds = () => {
    const box = new THREE.Box3();
    let has = false;
    const set = selectedSetRef.current;
    const addObj = (o) => {
      if (!o) return;
      try {
        box.expandByObject(o);
        has = true;
      } catch (e) {}
    };
    if (set?.size) {
      for (const o of set) addObj(o);
    } else if (selectedInternal) {
      addObj(selectedInternal);
    }
    return has ? box : null;
  };

  const frameSelection = useCallback((opts = {}) => {
    const cam = cameraRef.current;
    if (!cam) return false;
    const box = computeSelectionBounds();
    if (!box) return false;
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z, 0.0001);
    const padding = opts.padding ?? 1.3;
    const fov = (cam.fov || 60) * (Math.PI / 180);
    const dist = Math.abs((maxDim * padding) / Math.sin(fov / 2));
    const dir = new THREE.Vector3();
    cam.getWorldDirection(dir);
    const newPos = center.clone().addScaledVector(dir, -dist);
    const targetQuat = computeLookAtQuat(newPos, center);
    if (opts.instant) {
      cam.position.copy(newPos);
      cam.lookAt(center);
      if (orbitRef.current?.target) orbitRef.current.target.copy(center);
      orbitRef.current?.update?.();
      cameraControlsApiRef.current?.controls?.update?.();
    } else {
      smoothCameraMove({ toPos: newPos, toTarget: center, toQuat: targetQuat, duration: opts.duration || 0.32 });
    }
    needsRenderRef.current = true;
    return true;
  }, []);

  const saveCameraBookmark = useCallback((slot = "1") => {
    const cam = cameraRef.current;
    if (!cam) return false;
    const snap = {
      position: cam.position.clone(),
      quaternion: cam.quaternion.clone(),
      zoom: cam.zoom,
      target: getOrbitTarget(),
    };
    cameraBookmarksRef.current.set(String(slot), snap);
    persistCameraBookmarks();
    setBookmarkUiVersion((v) => v + 1);
    return snap;
  }, []);

  const loadCameraBookmark = useCallback((slot = "1") => {
    const snap = cameraBookmarksRef.current.get(String(slot));
    if (!snap) return false;
    const ok = applyCameraState(snap);
    if (ok) setBookmarkUiVersion((v) => v + 1);
    return ok;
  }, []);

  const listCameraBookmarks = () => Array.from(cameraBookmarksRef.current.keys());

  const persistCameraBookmarks = () => {
    try {
      const obj = {};
      for (const [k, v] of cameraBookmarksRef.current.entries()) obj[k] = serializeBookmark(v);
      localStorage.setItem(CAMERA_BOOKMARKS_KEY, JSON.stringify(obj));
    } catch (e) {}
  };

  const loadCameraBookmarksFromStorage = () => {
    try {
      const raw = localStorage.getItem(CAMERA_BOOKMARKS_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      cameraBookmarksRef.current.clear();
      Object.entries(parsed || {}).forEach(([k, v]) => {
        const snap = deserializeBookmark(v);
        if (snap) cameraBookmarksRef.current.set(String(k), snap);
      });
      setBookmarkUiVersion((v) => v + 1);
    } catch (e) {}
  };

  const cancelCameraAnim = () => {
    if (cameraAnimRef.current && cameraAnimRef.current.cancel) cameraAnimRef.current.cancel = true;
    cameraAnimRef.current = null;
  };

  const smoothCameraMove = ({ toPos, toTarget, toQuat = null, duration = 0.35 } = {}) => {
    const cam = cameraRef.current;
    if (!cam || !toPos || !toTarget) return false;
    cancelCameraAnim();
    const fromPos = cam.position.clone();
    const fromTarget = getOrbitTarget();
    const fromQuat = cam.quaternion.clone();
    const targetQuat = toQuat ? toQuat.clone() : fromQuat.clone();
    const start = performance.now();
    const durMs = Math.max(60, duration * 1000);
    const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
    const token = { cancel: false };
    cameraAnimRef.current = token;

    const step = () => {
      if (token.cancel) return;
      const t = Math.min(1, (performance.now() - start) / durMs);
      const k = ease(t);
      cam.position.lerpVectors(fromPos, toPos, k);
      if (orbitRef.current?.target) orbitRef.current.target.lerpVectors(fromTarget, toTarget, k);
      if (toQuat) cam.quaternion.slerpQuaternions(fromQuat, targetQuat, k);
      orbitRef.current?.update?.();
      cameraControlsApiRef.current?.controls?.update?.();
      needsRenderRef.current = true;
      if (t < 1) requestAnimationFrame(step);
    };

    requestAnimationFrame(step);
    return true;
  };

  const frameAll = useCallback((opts = {}) => {
    const cam = cameraRef.current;
    if (!cam) return false;
    const ug = getUserGroup();
    if (!ug || ug.children.length === 0) return false;
    const box = new THREE.Box3();
    let has = false;
    ug.children.forEach((c) => {
      try { box.expandByObject(c); has = true; } catch (e) {}
    });
    if (!has) return false;
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z, 0.0001);
    const padding = opts.padding ?? 1.25;
    const fov = (cam.fov || 60) * (Math.PI / 180);
    const dist = Math.abs((maxDim * padding) / Math.sin(fov / 2));
    const dir = new THREE.Vector3();
    cam.getWorldDirection(dir);
    const newPos = center.clone().addScaledVector(dir, -dist);
    const targetQuat = computeLookAtQuat(newPos, center);
    if (opts.instant) {
      cam.position.copy(newPos);
      cam.lookAt(center);
      orbitRef.current?.target?.copy(center);
      orbitRef.current?.update?.();
      cameraControlsApiRef.current?.controls?.update?.();
    } else {
      smoothCameraMove({ toPos: newPos, toTarget: center, toQuat: targetQuat, duration: opts.duration || 0.4 });
    }
    needsRenderRef.current = true;
    return true;
  }, []);

  const frameHierarchy = useCallback((opts = {}) => {
    const cam = cameraRef.current;
    if (!cam || !selectedInternal) return false;
    const box = new THREE.Box3();
    let has = false;
    try { box.expandByObject(selectedInternal); has = true; } catch (e) {}
    if (!has) return false;
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z, 0.0001);
    const padding = opts.padding ?? 1.2;
    const fov = (cam.fov || 60) * (Math.PI / 180);
    const dist = Math.abs((maxDim * padding) / Math.sin(fov / 2));
    const dir = new THREE.Vector3();
    cam.getWorldDirection(dir);
    const newPos = center.clone().addScaledVector(dir, -dist);
    const targetQuat = computeLookAtQuat(newPos, center);
    if (opts.instant) {
      cam.position.copy(newPos);
      cam.lookAt(center);
      orbitRef.current?.target?.copy(center);
      orbitRef.current?.update?.();
      cameraControlsApiRef.current?.controls?.update?.();
    } else {
      smoothCameraMove({ toPos: newPos, toTarget: center, toQuat: targetQuat, duration: opts.duration || 0.35 });
    }
    needsRenderRef.current = true;
    return true;
  }, [selectedInternal]);

  // ---------- Shading / viewport modes ----------
  const setShadingMode = useCallback((mode = "rendered") => {
    const scene = sceneRef.current;
    const renderer = rendererRef.current;
    if (!scene) return;

    const normalized = mode === "wireframe" ? "wireframe" : mode === "material" ? "material" : "rendered";
    shadingModeRef.current = normalized;

    const composerEnabled = normalized === "rendered";
    if (postfxApiRef.current?.composer) postfxApiRef.current.composer.enabled = composerEnabled;
    if (composerRef.current) composerRef.current.enabled = composerEnabled;

    scene.traverse((obj) => {
      if (!obj.isMesh) return;
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      mats.forEach((mat) => {
        if (!mat) return;
        const cache = materialWireframeCacheRef.current;
        if (!cache.has(mat)) cache.set(mat, { wireframe: !!mat.wireframe, toneMapped: mat.toneMapped !== false });
        const original = cache.get(mat);
        if (normalized === "wireframe") {
          mat.wireframe = true;
          mat.toneMapped = false;
        } else if (normalized === "material") {
          mat.wireframe = original?.wireframe || false;
          mat.toneMapped = false;
        } else {
          mat.wireframe = original?.wireframe || false;
          mat.toneMapped = original?.toneMapped !== false;
        }
        mat.needsUpdate = true;
      });
    });

    if (renderer) {
      needsRenderRef.current = true;
    }
  }, []);

  const disablePostFX = useCallback(() => {
    try {
      if (postfxApiRef.current?.dispose) postfxApiRef.current.dispose();
    } catch (e) {}
    try {
      if (composerRef.current?.dispose) composerRef.current.dispose();
    } catch (e) {}
    postfxApiRef.current = null;
    composerRef.current = null;
  }, []);

  const createTransformGroupFromSet = () => {
    const set = selectedSetRef.current;
    if (set.size < 2) return;
    if (transformGroupRef.current) return;
    const group = new THREE.Group();
    group.name = "_multi_transform_group_" + nameCountRef.current++;
    const centroid = new THREE.Vector3();
    let count = 0;
    for (const o of set) {
      const p = new THREE.Vector3();
      o.getWorldPosition(p);
      centroid.add(p);
      count++;
    }
    centroid.multiplyScalar(1 / Math.max(1, count));
    group.position.copy(centroid);
    safeAdd(sceneRef.current, group, group.name);
    for (const o of set) {
      try {
        multiParentMapRef.current.set(o.uuid, o.parent || sceneRef.current);
        group.attach(o);
      } catch (e) {}
    }
    transformGroupRef.current = group;
    try {
      transformRef.current.attach(group);
    } catch (e) {}
    needsRenderRef.current = true;
  };

  const dissolveTransformGroup = () => {
    const group = transformGroupRef.current;
    if (!group) return;
    const set = selectedSetRef.current;
    for (const o of Array.from(set)) {
      try {
        const origParent = multiParentMapRef.current.get(o.uuid) || sceneRef.current;
        origParent.attach(o);
      } catch (e) {}
    }
    try {
      if (group.parent) group.parent.remove(group);
    } catch (e) {}
    transformGroupRef.current = null;
    needsRenderRef.current = true;
  };

  const worldPointAtMouse = (client) => {
    if (!rendererRef.current || !cameraRef.current || !containerRef.current) return new THREE.Vector3(0, 0.5, 0);
    const rect = rendererRef.current.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((client.x - rect.left) / rect.width) * 2 - 1, -((client.y - rect.top) / rect.height) * 2 + 1);
    raycasterRef.current.setFromCamera(ndc, cameraRef.current);
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const point = new THREE.Vector3();
    raycasterRef.current.ray.intersectPlane(plane, point);
    point.y = 0.5;
    return point;
  };

  // ---------- Add Item ----------
  const addItem = (name, point = null, opts = {}) => {
    if (!sceneRef.current) return;
    if (point && typeof point.x === "number" && typeof point.y === "number" && !(point instanceof THREE.Vector3)) {
      point = worldPointAtMouse(point);
    }
    let obj;
    const makeIcon = (color = 0xffff00, size = 0.06) => new THREE.Mesh(new THREE.SphereGeometry(size, 8, 8), new THREE.MeshBasicMaterial({ color }));
    const parseColor = (c, fallback = 0xffffff) => {
      if (!c) return fallback;
      try {
        return new THREE.Color(c);
      } catch (err) {
        return fallback;
      }
    };

    switch (name) {
      case "Cube":
        obj = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: opts.color ? parseColor(opts.color) : 0xff5555 }));
        break;
      case "Sphere":
        obj = new THREE.Mesh(new THREE.SphereGeometry(0.6, 32, 32), new THREE.MeshStandardMaterial({ color: opts.color ? parseColor(opts.color) : 0x55ff88 }));
        break;
      case "Plane":
        obj = new THREE.Mesh(new THREE.PlaneGeometry(4, 4), new THREE.MeshStandardMaterial({ color: opts.color ? parseColor(opts.color) : 0x777777, side: THREE.DoubleSide }));
        obj.rotation.x = -Math.PI / 2;
        break;
      case "Cone":
        obj = new THREE.Mesh(new THREE.ConeGeometry(0.6, 1.5, 32), new THREE.MeshStandardMaterial({ color: opts.color ? parseColor(opts.color) : 0xffaa33 }));
        break;
      case "Cylinder":
        obj = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 1.5, 32), new THREE.MeshStandardMaterial({ color: opts.color ? parseColor(opts.color) : 0x3388ff }));
        break;
      case "Torus":
        obj = new THREE.Mesh(new THREE.TorusGeometry(0.7, 0.3, 16, 100), new THREE.MeshStandardMaterial({ color: opts.color ? parseColor(opts.color) : 0xff33aa }));
        break;
      case "Empty":
        obj = new THREE.Group();
        break;
      case "Axis Helper":
        obj = new THREE.AxesHelper(2);
        break;
      case "Point Light":
        obj = new THREE.PointLight(opts.color ? parseColor(opts.color) : 0xffffff, 1, 20);
        obj.add(makeIcon(opts.color ? parseColor(opts.color) : 0xffff66, 0.06));
        break;
      case "Spot Light":
        obj = new THREE.SpotLight(opts.color ? parseColor(opts.color) : 0xffffff, 1, 30, Math.PI / 6);
        obj.add(makeIcon(opts.color ? parseColor(opts.color) : 0xffcc66, 0.06));
        break;
      case "Directional Light":
        obj = new THREE.DirectionalLight(opts.color ? parseColor(opts.color) : 0xffffff, 1);
        obj.position.set(3, 5, 3);
        obj.add(makeIcon(opts.color ? parseColor(opts.color) : 0xddddff, 0.06));
        break;
      case "Camera":
        obj = new THREE.PerspectiveCamera(50, cameraRef.current?.aspect || 1, 0.1, 2000);
        obj.userData._isVirtualCamera = true;
        obj.position.set(3, 2, 6);
        try { obj.lookAt(new THREE.Vector3(0, 0.5, 0)); } catch (e) {}
        obj.add(makeIcon(opts.color ? parseColor(opts.color) : 0x66ccff, 0.06));
        try {
          const dirHelper = new THREE.ArrowHelper(new THREE.Vector3(0, 0, -1), new THREE.Vector3(0, 0, 0), 0.9, opts.color ? parseColor(opts.color) : 0x66ccff);
          dirHelper.userData.__objekta = true;
          obj.add(dirHelper);
        } catch (e) {}
        try { obj.updateProjectionMatrix?.(); } catch (e) {}
        break;
      default:
        obj = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 0.6), new THREE.MeshStandardMaterial({ color: opts.color ? parseColor(opts.color) : 0x777777 }));
    }

    if (point && point instanceof THREE.Vector3) obj.position.copy(point);
    else obj.position.copy(new THREE.Vector3(0, 0.5, 0));
    obj.name = name + "_" + nameCountRef.current++;
    obj.userData.__objekta = true;
    obj.traverse((n) => {
      if (!n.userData) n.userData = {};
      n.userData.__objekta = true;
    });

    const userGroup = getUserGroup();
    const parent = userGroup || sceneRef.current;
    safeAdd(parent, obj, obj.name);
    try {
      ensureBVHForObject(obj);
    } catch (e) {}
    try {
      SceneGraphStore.addObject?.(obj.uuid, obj, { name: obj.name, type: name });
    } catch (e) {}
    try {
      EventBus?.emit?.("scene:updated", { id: obj.uuid, type: "add" });
    } catch (e) {}
    selectObject(obj);
    bumpSceneVersion("addItem");

    try {
      const snap = obj.toJSON();
      const uuid = obj.uuid;
      cmdHistoryRef.current.push(
        new Cmd(
          () => {
            try {
              const loader = new THREE.ObjectLoader();
              const recreated = loader.parse(snap);
              recreated.userData = recreated.userData || {};
              recreated.userData.__objekta = true;
              const ug = getUserGroup();
              safeAdd(ug || sceneRef.current, recreated, "redo_add");
              ensureBVHForObject(recreated);
              selectObject(recreated);
              bumpSceneVersion("redo-add");
            } catch (e) {
              console.warn("Redo add failed", e);
            }
          },
          () => {
            try {
              const ug = getUserGroup();
              const existing = ug?.getObjectByProperty("uuid", uuid);
              if (existing) {
                disposeObject(existing);
                if (existing.parent) existing.parent.remove(existing);
                clearSelection();
                bumpSceneVersion("undo-add");
              }
            } catch (e) {
              console.warn("Undo add failed", e);
            }
          },
          "add"
        )
      );
    } catch (e) {}

    needsRenderRef.current = true;
    return obj;
  };

  // Palette DnD
  const [{ isOver }, dropRef] = useDrop({
    accept: PALETTE_TYPE,
    drop: (item, monitor) => {
      const clientOffset = monitor.getClientOffset();
      if (!clientOffset) return;
      const worldPos = worldPointAtMouse(clientOffset);
      addItem(item.name, worldPos, { color: item.color });
    },
    collect: (monitor) => ({ isOver: !!monitor.isOver() }),
  });
  const setContainerNode = (node) => {
    containerRef.current = node;
    try {
      if (node && typeof dropRef === "function") dropRef(node);
    } catch (err) {}
  };

  // Helper: chunked traversal/preparation to avoid freezing main thread on large models
  const traversePrepareChunked = (root) => {
    return new Promise((resolve) => {
      const nodes = [];
      root.traverse((n) => nodes.push(n));
      let i = 0;
      const chunk = () => {
        const start = performance.now();
        while (i < nodes.length) {
          const child = nodes[i++];
          // lightweight preparation
          if (!child.userData) child.userData = {};
          child.userData.__objekta = true;
          if (child.isMesh) {
            try {
              if (child.material) {
                child.material = Array.isArray(child.material) ? child.material.map((m) => m.clone()) : child.material.clone();
              } else {
                child.material = new THREE.MeshStandardMaterial({ color: 0x888888 });
              }
              child.castShadow = true;
              child.receiveShadow = true;
            } catch (e) {
              try {
                child.material = new THREE.MeshStandardMaterial({ color: 0x888888 });
              } catch (ee) {}
            }
          }
          if (performance.now() - start > 12) {
            setTimeout(chunk, 10);
            return;
          }
        }
        resolve();
      };
      chunk();
    });
  };

  // ---------- GLTF add (file or Object3D) ----------
  const addGLTF = (input, point = null, onProgress = null, originalFile = null) => {
    // Accepts:
    // - File (GLB/glTF) -> parse ArrayBuffer (non-blocking approach)
    // - ArrayBuffer (GLB)
    // - THREE.Object3D or parsed gltf.scene
    return new Promise(async (resolve, reject) => {
      if (!sceneRef.current) return reject(new Error("Scene not ready"));
      const loader = gltfLoaderRef.current || createSafeGLTFLoader();
      try {
        if (dracoRef.current && loader.setDRACOLoader) loader.setDRACOLoader(dracoRef.current);
      } catch (e) {}
      setLoading(true);

      const addNodeToScene = async (sceneNode, fileMeta) => {
        try {
          // chunked preparation to avoid freezing the UI with huge models
          await traversePrepareChunked(sceneNode);

          // bounding / normalization
          try {
            const box = new THREE.Box3().setFromObject(sceneNode);
            const size = box.getSize(new THREE.Vector3());
            const center = box.getCenter(new THREE.Vector3());
            const maxDim = Math.max(size.x, size.y, size.z, 1);
            if (maxDim > 0) sceneNode.scale.setScalar(2 / maxDim);
            sceneNode.position.sub(center);
          } catch (e) {}

          // second pass: ensure mesh materials/cloning safety and userData set (some already done in traversePrepareChunked)
          sceneNode.traverse((child) => {
            if (!child.userData) child.userData = {};
            child.userData.__objekta = true;
            if (child.isMesh) {
              try {
                if (child.material) {
                  child.material.needsUpdate = true;
                  child.material.side = THREE.DoubleSide;
                  child.material.toneMapped = true;
                  child.material.color?.convertSRGBToLinear?.();
                } else {
                  child.material = new THREE.MeshStandardMaterial({ color: 0xaaaaaa });
                }
              } catch (e) {
                try {
                  child.material = new THREE.MeshStandardMaterial({ color: 0xaaaaaa });
                } catch (ee) {}
              }
              child.castShadow = true;
              child.receiveShadow = true;
            }
          });

          // position relative to insertion point
          try {
            const boxScaled = new THREE.Box3().setFromObject(sceneNode);
            const dropTarget = point ? point.clone() : (cameraControlsApiRef.current?.controls?.target?.clone?.() ?? new THREE.Vector3());
            const heightOffset = boxScaled.getSize(new THREE.Vector3()).y / 2 + 0.05;
            sceneNode.position.copy(dropTarget);
            sceneNode.position.y += heightOffset;
          } catch (e) {}

          sceneNode.userData = sceneNode.userData || {};
          sceneNode.userData.__objekta = true;
          sceneNode.name = sceneNode.name || "Imported_" + nameCountRef.current++;

          const userGroup = getUserGroup();
          const parent = userGroup || sceneRef.current;
          safeAdd(parent, sceneNode, sceneNode.name || "imported_sceneNode");

          // Bulk import flag reduces snapshot churn and heavy SceneGraphStore calls until done
          if (!isBulkImportRef.current) isBulkImportRef.current = false; // ensure defined

          try {
            sceneNode.traverse((n) => {
              if (n.userData?.__objekta) try {
                SceneGraphStore.addObject?.(n.uuid, n, { name: n.name, type: n.type });
              } catch (e) {}
            });
          } catch (e) {}

          try {
            EventBus?.emit?.("scene:updated", { id: sceneNode.uuid, type: "import" });
          } catch (e) {}

          ensureBVHForObject(sceneNode);
          selectObject(sceneNode);
          bumpSceneVersion("addGLTF");

          // store original file arraybuffer for robust server save if provided
          if (fileMeta && fileMeta.arrayBuffer && fileMeta.name) {
            try {
              fileAssetsRef.current.set(sceneNode.uuid, {
                name: fileMeta.name,
                type: fileMeta.type || "model/gltf-binary",
                buffer: fileMeta.arrayBuffer,
                size: fileMeta.size || (fileMeta.arrayBuffer && fileMeta.arrayBuffer.byteLength),
              });
            } catch (e) {
              // ignore storing asset if it fails
            }
          }

          try {
            const snap = sceneNode.toJSON();
            const uuid = sceneNode.uuid;
            // push a single import cmd (undo will remove imported tree)
            cmdHistoryRef.current.push(
              new Cmd(
                () => {
                  try {
                    const loader2 = new THREE.ObjectLoader();
                    const recreated = loader2.parse(snap);
                    recreated.userData = recreated.userData || {};
                    recreated.userData.__objekta = true;
                    const ug = getUserGroup();
                    safeAdd(ug || sceneRef.current, recreated, "redo_import");
                    ensureBVHForObject(recreated);
                    selectObject(recreated);
                    bumpSceneVersion("redo-import");
                  } catch (e) {
                    console.warn("Redo import failed", e);
                  }
                },
                () => {
                  try {
                    const ug = getUserGroup();
                    const existing = ug?.getObjectByProperty("uuid", uuid);
                    if (existing) {
                      try {
                        existing.traverse((n) => {
                          SceneGraphStore.removeObject?.(n.uuid);
                        });
                      } catch (e) {}
                      disposeObject(existing);
                      if (existing.parent) existing.parent.remove(existing);
                      clearSelection();
                      bumpSceneVersion("undo-import");
                    }
                  } catch (e) {
                    console.warn("Undo import failed", e);
                  }
                },
                "import"
              )
            );
          } catch (e) {}

          return sceneNode;
        } catch (err) {
          console.warn("addNodeToScene error", err);
          throw err;
        } finally {
          setLoading(false);
          needsRenderRef.current = true;
        }
      };

      // helper to parse ArrayBuffer (GLB) with loader.parse to avoid extra fetch + blob URL overhead
      const parseArrayBuffer = (arrayBuffer) =>
        new Promise((res, rej) => {
          try {
            // parse binary GLB
            const loader = gltfLoaderRef.current || createSafeGLTFLoader();
            loader.parse(
              arrayBuffer,
              "",
              (gltf) => res(gltf),
              (err) => rej(err)
            );
          } catch (err) {
            rej(err);
          }
        });

      // If input is already a THREE.Object3D or parsed gltf.scene
      if (input && input.isObject3D) {
        try {
          await traversePrepareChunked(input);
          const added = await addNodeToScene(input, originalFile ? { arrayBuffer: originalFile.__arrayBuffer, name: originalFile.name, type: originalFile.type } : null);
          resolve(added);
        } catch (e) {
          setLoading(false);
          reject(e);
        }
        return;
      }

      // If input is a parsed GLTF (object with .scene)
      if (input && (input.scene || (input.scenes && input.scenes.length))) {
        try {
          const sceneNode = input.scene || input.scenes[0];
          await traversePrepareChunked(sceneNode);
          const added = await addNodeToScene(sceneNode, originalFile ? { arrayBuffer: originalFile.__arrayBuffer, name: originalFile.name, type: originalFile.type } : null);
          resolve(added);
        } catch (e) {
          setLoading(false);
          reject(e);
        }
        return;
      }

      // If input is an ArrayBuffer (GLB content)
      if (input instanceof ArrayBuffer) {
        try {
          const gltf = await parseArrayBuffer(input);
          const sceneNode = gltf.scene || gltf.scenes?.[0];
          if (!sceneNode) throw new Error("GLTF has no scene");
          const added = await addNodeToScene(sceneNode, { arrayBuffer: input, name: "imported.glb", type: "model/gltf-binary", size: input.byteLength });
          resolve(added);
        } catch (err) {
          setLoading(false);
          reject(err);
        }
        return;
      }

      // If input is a File (user dropped a file)
      if (input && (input instanceof File)) {
        // read as ArrayBuffer and parse to avoid blob URL overhead
        const file = input;
        const reader = new FileReader();
        reader.onload = async () => {
          try {
            const arrayBuffer = reader.result;
            // Attach arrayBuffer to originalFile metadata for possible storage
            const fileMeta = { arrayBuffer, name: file.name, type: file.type || "model/gltf-binary", size: file.size };
            // parse & add
            const gltf = await parseArrayBuffer(arrayBuffer);
            const sceneNode = gltf.scene || gltf.scenes?.[0];
            if (!sceneNode) throw new Error("GLTF has no scene");
            const added = await addNodeToScene(sceneNode, fileMeta);
            resolve(added);
          } catch (err) {
            setLoading(false);
            reject(err);
          }
        };
        reader.onerror = (err) => {
          setLoading(false);
          reject(err);
        };
        reader.readAsArrayBuffer(file);
        return;
      }

      // unsupported input
      setLoading(false);
      reject(new Error("addGLTF expects a File, ArrayBuffer, or THREE.Object3D"));
    });
  };

  // ---------- Export GLTF ----------
  // Make exportGLTF optionally return a blob without auto-downloading (so frontend can send a proper GLB to the server)
  const exportGLTF = (binary = true, options = { download: true, filename: null }) => {
    return new Promise((resolve, reject) => {
      if (!sceneRef.current) {
        reject(new Error("No scene"));
        return;
      }
      const userGroup = getUserGroup();
      const userObjects = userGroup ? Array.from(userGroup.children) : [];
      const exporter = new GLTFExporter();
      const exportScene = new THREE.Scene();

      const isHelperType = (obj) => {
        if (!obj) return false;
        if (obj.name && obj.name.startsWith("_")) return true;
        if (obj.type === "GridHelper" || obj.type === "AxesHelper" || obj.type === "BoxHelper" || obj.type === "CameraHelper") return true;
        if (obj.userData && obj.userData.__helper) return true;
        return false;
      };

      const pruneHelpers = (root) => {
        const removeList = [];
        root.traverse((n) => {
          if (isHelperType(n)) removeList.push(n);
        });
        removeList.forEach((n) => {
          if (n.parent) n.parent.remove(n);
        });
      };

      userObjects.forEach((c) => {
        try {
          const clone = c.clone(true);
          pruneHelpers(clone);
          clone.traverse((n) => {
            if (n.name && n.name.startsWith("_")) {
              if (n.parent) n.parent.remove(n);
            }
          });
          const allowed = ["Mesh", "Group", "Object3D", "PerspectiveCamera", "OrthographicCamera", "PointLight", "DirectionalLight", "HemisphereLight", "SpotLight", "AmbientLight"];
          if (allowed.includes(clone.type) || clone.isMesh || clone.isLight || clone.isCamera) exportScene.add(clone);
          else {
            const group = new THREE.Group();
            clone.traverse((n) => {
              if (n.isMesh || n.isLight || n.isCamera || n.type === "Group") group.add(n.clone(true));
            });
            if (group.children.length) exportScene.add(group);
          }
        } catch (err) {
          console.warn("Export: failed to clone object", err);
        }
      });

      exportScene.updateMatrixWorld(true);

      exporter.parse(
        exportScene,
        (result) => {
          try {
            let blob;
            if (binary && result instanceof ArrayBuffer) blob = new Blob([result], { type: "model/gltf-binary" });
            else {
              const str = JSON.stringify(result, null, 2);
              blob = new Blob([str], { type: "application/json" });
            }

            // If options.download is true behave as before (trigger download)
            if (options.download !== false) {
              const link = document.createElement("a");
              const url = URL.createObjectURL(blob);
              try {
                blobUrlsRef.current.add(url);
              } catch (e) {}
              link.href = url;
              link.download = options.filename || (binary ? "scene.glb" : "scene.gltf");
              link.click();
              setTimeout(() => {
                try {
                  URL.revokeObjectURL(url);
                  blobUrlsRef.current.delete(url);
                } catch (e) {}
              }, 1500);
            }

            resolve(blob);
          } catch (e) {
            reject(e);
          }
        },
        { binary, embedImages: true, truncateDrawRange: true }
      );
    });
  };

  // Helper for preparing a FormData payload suitable to send to your backend (server)
  // It uses exportGLTF(binary) to build a single .glb that contains current scene meshes & textures.
  const prepareSavePayload = async (meta = {}) => {
    // returns FormData ready to send: { file: scene.glb, meta: JSON.stringify(meta) }
    try {
      const blob = await exportGLTF(true, { download: false });
      const fd = new FormData();
      // IMPORTANT: backend expects "file" (upload.single('file')) — use "file" to match server
      fd.append("file", blob, meta.filename || "scene.glb");
      fd.append("meta", JSON.stringify(meta || {}));
      // If you also want to attach original imported source files (per-object), you can attach them like:
      // for (const [uuid, asset] of fileAssetsRef.current) {
      //   const arr = new Uint8Array(asset.buffer);
      //   const b = new Blob([arr], { type: asset.type });
      //   fd.append(`asset_${uuid}`, b, asset.name);
      // }
      return fd;
    } catch (e) {
      throw e;
    }
  };

  // ---------- Upload to project as asset (GLB) ----------
  /**
   * Upload exported GLB blob to project as an asset.
   * Uses field name "file" so it matches your backend's multer(upload.single("file"))
   * Returns parsed JSON response or throws.
   */
  const saveSceneToProject = async (projectId, { filename = "scene.glb", meta = {} } = {}) => {
    if (!projectId) throw new Error("projectId required for saveSceneToProject");
    try {
      // export binary GLB blob (no auto-download)
      const blob = await exportGLTF(true, { download: false, filename });
      if (!(blob instanceof Blob)) throw new Error("exportGLTF did not return a Blob");

      // Prefer direct-to-S3 (presign or multipart) with tus fallback
      try {
        const file = new File([blob], filename, { type: "model/gltf-binary" });
        const SMALL_LIMIT = 50 * 1024 * 1024;
        let res;
        if (file.size <= SMALL_LIMIT) {
          res = await uploadSmallViaPresign({ file, projectId, onProgress: (u, t) => {} });
        } else {
          res = await uploadLargeFile({ file, projectId, onProgress: (u, t) => {} });
        }
        console.log("[OBJEKTA] external upload complete", res);
        const asset = res?.asset || (res?.key ? { key: res.key } : (res?.url ? { url: res.url } : null));
        try {
          if (asset) EventBus?.emit?.("project_asset_uploaded", { projectId, asset, raw: res });
        } catch (e) {}
        return { success: true, external: true, ...res };
      } catch (externalErr) {
        console.warn("[OBJEKTA] external upload failed, falling back to server FormData", externalErr);
      }

      const fd = new FormData();
      // NOTE: backend expects field name "file" for asset uploads
      fd.append("file", blob, filename);
      fd.append("meta", JSON.stringify(meta || {}));

      // Attach per-object original source files if available (so server stores exact originals)
      try {
        for (const [uuid, asset] of fileAssetsRef.current) {
          if (!asset || !asset.buffer) continue;
          const arr = asset.buffer instanceof ArrayBuffer
            ? new Uint8Array(asset.buffer)
            : (asset.buffer.buffer instanceof ArrayBuffer ? new Uint8Array(asset.buffer.buffer) : new Uint8Array(asset.buffer));
          const blobAsset = new Blob([arr], { type: asset.type || "application/octet-stream" });
          fd.append(`asset_${uuid}`, blobAsset, asset.name || `asset_${uuid}.bin`);
        }
      } catch (e) {
        console.warn("Failed to append original assets to FormData", e);
      }

      const url = apiUrl(`/api/projects/${projectId}/assets`);
      const resp = await fetch(url, { method: "POST", body: fd, credentials: "include" });
      const status = resp.status;

      // Handle 413 specifically
      if (status === 413) {
        const text = await resp.text().catch(() => "");
        throw new Error("Server rejected upload (413 Payload Too Large): " + text);
      }

      // parse JSON if possible
      let json;
      try {
        json = await resp.json();
      } catch (e) {
        const txt = await resp.text().catch(() => "");
        throw new Error("Upload failed, server returned non-JSON: " + txt);
      }

      if (!resp.ok) {
        const errMsg = json?.message || json?.error || JSON.stringify(json);
        throw new Error("Upload failed: " + errMsg);
      }

      // success → return server response
      console.log("Scene uploaded to project:", json);
      try {
        // Inform app about new asset (EventBus / SceneGraph / UI update as needed)
        EventBus?.emit?.("project_asset_uploaded", { projectId, asset: json.asset || null, raw: json });
      } catch (e) {}
      return json;
    } catch (err) {
      console.error("saveSceneToProject error:", err);
      throw err;
    }
  };

  /**
   * Attempts to save scene to server, on failure saves a local backup.
   * Returns { ok: true, server: <resp> } or { ok: false, backupKey: string, error }
   */
  const saveSceneWithFallback = async (projectId, { filename = "scene.glb", meta = {} } = {}) => {
    try {
      const serverResp = await saveSceneToProject(projectId, { filename, meta });
      return { ok: true, server: serverResp };
    } catch (err) {
      // Attempt presigned small upload once more if size fits
      try {
        const smallLimit = 50 * 1024 * 1024;
        const blob = await exportGLTF(true, { download: false, filename });
        if (blob && blob.size <= smallLimit) {
          const file = new File([blob], filename, { type: "model/gltf-binary" });
          const res = await uploadSmallViaPresign({ file, projectId });
          if (res && res.asset) return { ok: true, server: { external: true, ...res } };
        }
      } catch (e2) { /* proceed to local backup */ }
      // fallback: store real blob in IndexedDB, with object URL backup only if IndexedDB fails
      // IndexedDB helper
      const saveBackupToIndexedDB = (id, name, blob, metaData = {}) => {
        return new Promise((resolve, reject) => {
          try {
            const req = indexedDB.open("OBJEKTA_DB_v1", 1);
            req.onupgradeneeded = (ev) => {
              const db = ev.target.result;
              if (!db.objectStoreNames.contains("backups")) {
                db.createObjectStore("backups", { keyPath: "id" });
              }
            };
            req.onsuccess = () => {
              const db = req.result;
              const tx = db.transaction("backups", "readwrite");
              const store = tx.objectStore("backups");
              const record = { id, name, blob, meta: metaData, createdAt: new Date().toISOString() };
              const putReq = store.put(record);
              putReq.onsuccess = () => { resolve(id); try { db.close(); } catch (e) {} };
              putReq.onerror = (e) => { reject(e); try { db.close(); } catch (e2) {} };
            };
            req.onerror = (e) => reject(e);
          } catch (e) { reject(e); }
        });
      };
      try {
        const blob = await exportGLTF(true, { download: false, filename });
        const backupId = `backup_${Date.now()}`;
        try {
          await saveBackupToIndexedDB(backupId, filename, blob, meta || {});
          const idxKey = "objekta_local_backups_v1";
            let idx = [];
            try { idx = JSON.parse(localStorage.getItem(idxKey) || "[]"); } catch (e) { idx = []; }
            const backupEntry = { id: backupId, createdAt: new Date().toISOString(), name: filename, size: blob.size || null };
            idx.unshift(backupEntry);
            if (idx.length > 20) idx = idx.slice(0, 20);
            localStorage.setItem(idxKey, JSON.stringify(idx));
            console.warn("Server save failed — backup stored in IndexedDB.", backupEntry);
            return { ok: false, backupKey: backupId, backupEntry, error: err.message || String(err) };
        } catch (e2) {
          // Fallback to object URL if IndexedDB fails
          const url = URL.createObjectURL(blob);
          try { blobUrlsRef.current.add(url); } catch (e) {}
          const backupEntry = { id: `local_backup_${Date.now()}`, createdAt: new Date().toISOString(), name: filename, url, meta };
          const idxKey = "objekta_local_backups_v1";
          let idx = [];
          try { idx = JSON.parse(localStorage.getItem(idxKey) || "[]"); } catch (e) { idx = []; }
          idx.unshift(backupEntry);
          if (idx.length > 10) idx.splice(10);
          localStorage.setItem(idxKey, JSON.stringify(idx));
          console.warn("Server save failed — fallback stored as object URL (IndexedDB failed).", e2);
          return { ok: false, backupKey: backupEntry.id, backupEntry, error: (err.message || String(err)) + " ; backupIndexedDB failed: " + (e2.message || String(e2)) };
        }
      } catch (e2) {
        console.error("saveSceneWithFallback: failed to create local backup", e2);
        return { ok: false, backupKey: null, error: (err.message || String(err)) + " ; backup failed: " + (e2.message || String(e2)) };
      }
    }
  };

  // ---------- Snapshot helpers ----------
  const computeSceneSignature = () => {
    if (!sceneRef.current) return "";
    try {
      const ug = sceneRef.current._user_group ? Array.from(sceneRef.current._user_group.children) : sceneRef.current._userGroup ? Array.from(sceneRef.current._userGroup.children) : [];
      const objs = ug.filter((c) => c.userData?.__objekta);
      return objs
        .map((c) => {
          const p = c.position;
          const r = c.rotation;
          const s = c.scale;
          let matSig = "";
          c.traverse((n) => {
            if (!matSig && n.isMesh && n.material) {
              try {
                matSig = Array.isArray(n.material)
                  ? n.material.map((m) => m.uuid + (m.color ? m.color.getHexString() : "")).join("|")
                  : n.material.uuid + (n.material.color ? n.material.color.getHexString() : "");
              } catch (e) {}
            }
          });
          return `${c.name}|p:${p.x.toFixed(3)},${p.y.toFixed(3)},${p.z.toFixed(3)}|r:${r.x.toFixed(3)},${r.y.toFixed(3)},${r.z.toFixed(3)}|s:${s.x.toFixed(3)},${s.y.toFixed(3)},${s.z.toFixed(3)}|m:${matSig}`;
        })
        .join("||");
    } catch (e) {
      return "";
    }
  };

  const pushHistorySnapshot = (label = "") => {
    if (!sceneRef.current) return;
    const signature = computeSceneSignature();
    if (signature && snapshotHistoryRef.current.length && snapshotHistoryRef.current[snapshotHistoryRef.current.length - 1]?.signature === signature) return;
    const userGroup = getUserGroup();
    const snaps = userGroup ? Array.from(userGroup.children).filter((c) => c.userData?.__objekta).map((c) => c.toJSON()) : [];
    snapshotHistoryRef.current.push({ label, snaps, signature });
    if (snapshotHistoryRef.current.length > HISTORY_LIMIT) snapshotHistoryRef.current.shift();
    snapshotHistoryIndexRef.current = snapshotHistoryRef.current.length - 1;
    bumpSceneVersion("pushHistorySnapshot");
    needsRenderRef.current = true;
  };

  const commitHistory = (label = "") => {
    pushHistorySnapshot(label);
    bumpSceneVersion("commitHistory");
  };
  const commitHistoryDebounced = (label = "") => {
    clearTimeout(commitHistoryDebounced._t);
    commitHistoryDebounced._t = setTimeout(() => pushHistorySnapshot(label), HISTORY_DEBOUNCE_MS);
  };

  const loadHistory = (entry) => {
    if (!entry || !sceneRef.current) return;
    const userGroup = getUserGroup();
    const toRemove = userGroup ? Array.from(userGroup.children) : [];
    toRemove.forEach((c) => {
      try {
        disposeObject(c);
      } catch (e) {}
      if (c.parent) c.parent.remove(c);
    });
    const loader = new THREE.ObjectLoader();
    entry.snaps.forEach((snap) => {
      try {
        const obj = loader.parse(snap);
        obj.userData.__objekta = true;
        safeAdd(userGroup || sceneRef.current, obj, "history_load");
        ensureBVHForObject(obj);
      } catch (err) {
        console.error("Failed to parse history snapshot", err);
      }
    });
    clearSelection();
    bumpSceneVersion("loadHistory");
    needsRenderRef.current = true;
  };

  // ---------- Undo/Redo ----------
  const undo = () => {
    if (cmdHistoryRef.current.length > 0 && cmdHistoryRef.current.index >= 0) {
      cmdHistoryRef.current.undo();
      return;
    }
    if (snapshotHistoryIndexRef.current > 0) {
      snapshotHistoryIndexRef.current--;
      loadHistory(snapshotHistoryRef.current[snapshotHistoryIndexRef.current]);
    }
  };
  const redo = () => {
    if (cmdHistoryRef.current.length > 0 && cmdHistoryRef.current.index < cmdHistoryRef.current.stack.length - 1) {
      cmdHistoryRef.current.redo();
      return;
    }
    if (snapshotHistoryIndexRef.current < snapshotHistoryRef.current.length - 1) {
      snapshotHistoryIndexRef.current++;
      loadHistory(snapshotHistoryRef.current[snapshotHistoryRef.current.length - 1]);
    }
  };

  const deleteSelected = () => {
    if (!selectedInternal || !sceneRef.current) return;
    try {
      try {
        selectedInternal.traverse((n) => {
          SceneGraphStore.removeObject?.(n.uuid);
        });
      } catch (e) {}
      const snap = selectedInternal.toJSON();
      const uuid = selectedInternal.uuid;
      try {
        disposeObject(selectedInternal);
      } catch (e) {}
      if (selectedInternal.parent) selectedInternal.parent.remove(selectedInternal);
      clearSelection();
      bumpSceneVersion("delete");
      try {
        EventBus?.emit?.("scene:updated", { id: uuid, type: "delete" });
      } catch (e) {}

      cmdHistoryRef.current.push(
        new Cmd(
          () => {
            const ug = getUserGroup();
            const ex = ug?.getObjectByProperty("uuid", uuid);
            if (ex) {
              disposeObject(ex);
              if (ex.parent) ex.parent.remove(ex);
            }
          },
          () => {
            try {
              const loader = new THREE.ObjectLoader();
              const recreated = loader.parse(snap);
              recreated.userData = recreated.userData || {};
              recreated.userData.__objekta = true;
              const ug = getUserGroup();
              safeAdd(ug || sceneRef.current, recreated, "undo_delete");
              try {
                recreated.traverse((n) => {
                  SceneGraphStore.addObject?.(n.uuid, n, { name: n.name, type: n.type });
                });
              } catch (e) {}
              ensureBVHForObject(recreated);
              bumpSceneVersion("undo-delete");
            } catch (e) {
              console.warn("Undo delete failed", e);
            }
          },
          "delete"
        )
      );
    } catch (e) {
      console.error(e);
    }
    commitHistory("delete");
    needsRenderRef.current = true;
  };

  const duplicateSelected = () => {
    if (!selectedInternal || !sceneRef.current) return;
    try {
      const clone = selectedInternal.clone(true);
      clone.position = clone.position.clone().add(new THREE.Vector3(0.2, 0.2, 0.2));
      clone.name = (selectedInternal.name || "clone") + "_dup_" + nameCountRef.current++;
      clone.userData.__objekta = true;
      clone.traverse((n) => {
        if (n.isMesh && n.material) {
          try {
            n.material = Array.isArray(n.material) ? n.material.map((m) => m.clone()) : n.material.clone();
          } catch (err) {}
        }
      });
      const userGroup = getUserGroup();
      safeAdd(userGroup || sceneRef.current, clone, clone.name);
      ensureBVHForObject(clone);
      try {
        clone.traverse((n) => {
          SceneGraphStore.addObject?.(n.uuid, n, { name: n.name, type: n.type });
        });
      } catch (e) {}
      selectObject(clone);
      bumpSceneVersion("duplicate");
      try {
        EventBus?.emit?.("scene:updated", { id: clone.uuid, type: "duplicate" });
      } catch (e) {}

      try {
        const snap = clone.toJSON();
        const uuid = clone.uuid;
        cmdHistoryRef.current.push(
          new Cmd(
            () => {
              try {
                const loader = new THREE.ObjectLoader();
                const recreated = loader.parse(snap);
                recreated.userData = recreated.userData || {};
                recreated.userData.__objekta = true;
                const ug = getUserGroup();
                safeAdd(ug || sceneRef.current, recreated, "redo_duplicate");
                try {
                  recreated.traverse((n) => {
                    SceneGraphStore.addObject?.(n.uuid, n, { name: n.name, type: n.type });
                  });
                } catch (e) {}
                ensureBVHForObject(recreated);
                bumpSceneVersion("redo-duplicate");
              } catch (e) {
                console.warn("Redo duplicate failed", e);
              }
            },
            () => {
              const ug = getUserGroup();
              const ex = ug?.getObjectByProperty("uuid", uuid);
              if (ex) {
                try {
                  ex.traverse((n) => {
                    SceneGraphStore.removeObject?.(n.uuid);
                  });
                } catch (e) {}
                disposeObject(ex);
                if (ex.parent) ex.parent.remove(ex);
                bumpSceneVersion("undo-duplicate");
              }
            },
            "duplicate"
          )
        );
      } catch (e) {}
      commitHistory("duplicate");
    } catch (err) {
      console.error("duplicate error", err);
    }
    needsRenderRef.current = true;
  };

  // ---------- Toolbar ----------
  const updateToolbarPosition = () => {
    if (!selectedInternal || !cameraRef.current || !rendererRef.current || !containerRef.current) {
      setToolbarPos({ x: -999, y: -999 });
      return;
    }
    const vector = new THREE.Vector3();
    selectedInternal.getWorldPosition(vector);
    vector.project(cameraRef.current);
    const rect = rendererRef.current.domElement.getBoundingClientRect();
    const leftRaw = (vector.x * 0.5 + 0.5) * rect.width;
    const topRaw = (-vector.y * 0.5 + 0.5) * rect.height - 40;
    const left = clamp(leftRaw, 8, rect.width - 80);
    const top = clamp(topRaw, 8, rect.height - 36);
    setToolbarPos({ x: left, y: top });
  };

  // ---------- Scene serialization API ----------
  // Uses extracted helpers from workspace/sceneSerializer for compact summaries.
  const serializeScene = () => {
    if (!sceneRef.current) return null;
    const userGroup = getUserGroup();
    const objs = userGroup ? Array.from(userGroup.children).filter((c) => c.userData?.__objekta) : [];

    // full snap array (backwards compatible)
    const snaps = objs.map((c) => c.toJSON());

    // compact object summaries via extracted helper
    const objects = objs.map(summarizeObject);

    // lights & cameras via extracted helpers
    const lights  = collectLights(sceneRef.current);
    const cameras = collectCameras(sceneRef.current);

    const meta = {
      exportedAt: new Date().toISOString(),
      objectCount: objects.length,
      totalTris: objects.reduce((acc, o) => acc + (o.geometry?.tris || 0), 0),
    };

    const animations = animationEngineRef.current?.snapshot ? animationEngineRef.current.snapshot() : [];

    return { snaps, objects, lights, cameras, animations, meta };
  };

  const loadFromData = (data) => {
    if (!data || !sceneRef.current) return;
    if (data.animations && Array.isArray(data.animations)) {
      try { animationEngineRef.current.loadSnapshot(data.animations); } catch (e) {}
    }
    // support both legacy { snaps: [...] } and new { objects: [...] , snaps: [...] } payloads
    if (data.snaps && Array.isArray(data.snaps)) {
      const userGroup = getUserGroup();
      const toRemove = userGroup ? Array.from(userGroup.children) : [];
      toRemove.forEach((c) => {
        if (c.parent) c.parent.remove(c);
        try {
          disposeObject(c);
        } catch (e) {}
      });
      const loader = new THREE.ObjectLoader();
      data.snaps.forEach((snap) => {
        try {
          const obj = loader.parse(snap);
          obj.userData.__objekta = true;
          safeAdd(userGroup || sceneRef.current, obj, "load_data_obj");
          ensureBVHForObject(obj);
          try {
            obj.traverse((n) => {
              SceneGraphStore.addObject?.(n.uuid, n, { name: n.name, type: n.type });
            });
          } catch (e) {}
        } catch (err) {
          console.error("Failed to load object from data", err);
        }
      });
      commitHistory("load");
      bumpSceneVersion("loadFromData");
      try {
        EventBus?.emit?.("scene:updated", { type: "load" });
      } catch (e) {}
      needsRenderRef.current = true;
      return;
    }

    // If the payload is minimal (objects only) we try to restore reasonable placeholders
    if (data.objects && Array.isArray(data.objects)) {
      const userGroup = getUserGroup();
      const toRemove = userGroup ? Array.from(userGroup.children) : [];
      toRemove.forEach((c) => {
        if (c.parent) c.parent.remove(c);
        try {
          disposeObject(c);
        } catch (e) {}
      });

      data.objects.forEach((o) => {
        try {
          // best-effort recreation: create simple primitive based on geometry type
          let obj = null;
          const geomType = o.geometry?.type || "";
          if (geomType.toLowerCase().includes("box")) obj = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: o.material?.color || 0x888888 }));
          else if (geomType.toLowerCase().includes("sphere")) obj = new THREE.Mesh(new THREE.SphereGeometry(0.6, 24, 24), new THREE.MeshStandardMaterial({ color: o.material?.color || 0x888888 }));
          else if (geomType.toLowerCase().includes("plane")) obj = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshStandardMaterial({ color: o.material?.color || 0x888888, side: THREE.DoubleSide }));
          else obj = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: o.material?.color || 0x888888 }));

          obj.name = o.name || "obj_" + nameCountRef.current++;
          obj.userData = o.userData || {};
          obj.userData.__objekta = true;
          if (o.position) obj.position.set(o.position.x || 0, o.position.y || 0, o.position.z || 0);
          if (o.rotation) obj.rotation.set(o.rotation.x || 0, o.rotation.y || 0, o.rotation.z || 0);
          if (o.scale) obj.scale.set(o.scale.x || 1, o.scale.y || 1, o.scale.z || 1);
          safeAdd(userGroup || sceneRef.current, obj, obj.name);
          ensureBVHForObject(obj);
        } catch (e) {
          console.warn("loadFromData (objects) failed for", o, e);
        }
      });

      commitHistory("load_minimal");
      bumpSceneVersion("loadFromData_minimal");
      try {
        EventBus?.emit?.("scene:updated", { type: "load_minimal" });
      } catch (e) {}
      needsRenderRef.current = true;
      return;
    }
  };

  const resetScene = ({ skipConfirm } = {}) => {
    const userGroup = getUserGroup();
    const toRemove = userGroup ? Array.from(userGroup.children) : [];
    toRemove.forEach((c) => {
      try {
        disposeObject(c);
      } catch (e) {}
      if (c.parent) c.parent.remove(c);
    });
    snapshotHistoryRef.current = [];
    snapshotHistoryIndexRef.current = -1;
    cmdHistoryRef.current.clear();
    pushHistorySnapshot("reset");
    clearSelection();
    bumpSceneVersion("resetScene");
    try {
      if (SceneGraphStore.clearSelection) SceneGraphStore.clearSelection();
      if (SceneGraphStore.objects) SceneGraphStore.objects = {};
    } catch (e) {}
    try {
      EventBus?.emit?.("scene:updated", { type: "reset" });
    } catch (e) {}
    needsRenderRef.current = true;
  };

  // ---------- Rename helper ----------
  const renameSelected = (name) => {
    if (!selectedInternal) return;
    selectedInternal.name = name;
    commitHistory("rename");
    bumpSceneVersion("rename");
    try {
      SceneGraphStore.renameObject?.(selectedInternal.uuid, name);
    } catch (e) {}
    try {
      EventBus?.emit?.("object:renamed", { uuid: selectedInternal.uuid, name });
    } catch (e) {}
    needsRenderRef.current = true;
  };

  // ---------- Transform batching ----------
  const pendingTransformRef = useRef({ position: false, rotation: false, scale: false });
  const transformFlushTimerRef = useRef(null);

  const handleTransformChange = (prop, axis, val) => {
    if (!selectedInternal) return;
    if (selectedInternal.isCamera && ["fov", "near", "far"].includes(prop)) {
      try {
        selectedInternal[prop] = val;
        selectedInternal.updateProjectionMatrix?.();
      } catch (e) {}
      try {
        commitHistoryDebounced("prop-change");
        bumpSceneVersion("prop-change");
      } catch (e) {}
      needsRenderRef.current = true;
      return;
    }

    if (!["position", "rotation", "scale"].includes(prop)) return;
    const axes = ["x", "y", "z"];
    let idx = axis;
    if (typeof axis === "string") idx = axes.indexOf(axis);
    else if (typeof axis === "number") idx = axis;
    if (typeof idx !== "number" || idx < 0 || idx > 2) return;
    const key = axes[idx];
    try {
      if (prop === "rotation") selectedInternal.rotation[key] = val;
      else selectedInternal[prop][key] = val;
    } catch (e) {}
    pendingTransformRef.current[prop] = true;
    if (transformFlushTimerRef.current) clearTimeout(transformFlushTimerRef.current);
    transformFlushTimerRef.current = setTimeout(() => {
      try {
        commitHistoryDebounced("prop-change");
      } catch (e) {}
      try {
        bumpSceneVersion("prop-change");
      } catch (e) {}
      pendingTransformRef.current = { position: false, rotation: false, scale: false };
      transformFlushTimerRef.current = null;
    }, TRANSFORM_FLUSH_MS);
    needsRenderRef.current = true;
  };

  const toggleSnap = (enable) => {
    const transform = transformRef.current;
    if (!transform) return;
    if (typeof enable === "boolean") transform.setTranslationSnap(enable ? 0.5 : null);
    else transform.setTranslationSnap(null);
    needsRenderRef.current = true;
  };
  const setSnapValue = (val) => {
    if (transformRef.current) transformRef.current.setTranslationSnap(val);
  };

  // ---------- Validation helpers & summary ----------
  const getSceneSummary = () => {
    const scene = sceneRef.current;
    if (!scene) return { totalTris: 0, objects: 0, objectsList: [] };
    const userGroup = getUserGroup();
    const objs = userGroup ? Array.from(userGroup.children) : [];
    return computeSceneSummary(objs);
  };

  const validateSceneAPI = async () => {
    try {
      const data = serializeScene();
      return { ok: true, summary: getSceneSummary() };
    } catch (e) {
      return { ok: false, error: e.message || String(e) };
    }
  };

  // ---------- Texture and HDR helpers ----------
  const applyTextureToSelection = (file) => {
    return new Promise((resolve, reject) => {
      if (!file) return reject(new Error("No file provided"));
      if (!selectedInternal && selectedSetRef.current.size === 0) return reject(new Error("No selection"));
      const url = URL.createObjectURL(file);
      try {
        blobUrlsRef.current.add(url);
      } catch (e) {}
      const loader = new THREE.TextureLoader();
      loader.load(
        url,
        (tex) => {
          // Modern three uses colorSpace; fallback to encoding if older build
          try { tex.colorSpace = THREE.SRGBColorSpace; } catch (e) { try { tex.encoding = THREE.sRGBEncoding; } catch (e2) {} }
          tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
          const applyTo = selectedSetRef.current.size ? Array.from(selectedSetRef.current) : [selectedInternal];
          applyTo.forEach((o) => {
            o.traverse((n) => {
              if (n.isMesh) {
                const mats = Array.isArray(n.material) ? n.material : [n.material];
                mats.forEach((m) => {
                  try {
                    m.map && m.map.dispose && m.map.dispose();
                  } catch (e) {}
                  m.map = tex;
                  m.needsUpdate = true;
                });
              }
            });
          });
          needsRenderRef.current = true;
          resolve(tex);
        },
        undefined,
        (err) => {
          try {
            URL.revokeObjectURL(url);
            blobUrlsRef.current.delete(url);
          } catch (e) {}
          reject(err);
        }
      );
    });
  };

  const loadEnvironmentFromHDR = (fileOrUrl) => {
    return new Promise((resolve, reject) => {
      const loader = new RGBELoader();
      const renderer = rendererRef.current;
      if (!renderer) return reject(new Error("Renderer not ready"));
      const pmrem = new THREE.PMREMGenerator(renderer);
      pmrem.compileEquirectangularShader();
      const onLoaded = (tex) => {
        const env = pmrem.fromEquirectangular(tex).texture;
        sceneRef.current.environment = env;
        tex.dispose();
        pmrem.dispose();
        needsRenderRef.current = true;
        resolve(env);
      };
      if (typeof fileOrUrl === "string") loader.load(fileOrUrl, onLoaded, undefined, (err) => reject(err));
      else {
        const reader = new FileReader();
        reader.onload = () => {
          const arr = reader.result;
          const blob = new Blob([arr], { type: fileOrUrl.type || "application/octet-stream" });
          const url = URL.createObjectURL(blob);
          try {
            blobUrlsRef.current.add(url);
          } catch (e) {}
          loader.load(
            url,
            (tex) => {
              onLoaded(tex);
              try {
                URL.revokeObjectURL(url);
                blobUrlsRef.current.delete(url);
              } catch (e) {}
            },
            undefined,
            (err) => {
              try {
                URL.revokeObjectURL(url);
                blobUrlsRef.current.delete(url);
              } catch (e) {}
              reject(err);
            }
          );
        };
        reader.readAsArrayBuffer(fileOrUrl);
      }
    });
  };

  // (duplicate doResize removed; original definition earlier in file handles sizing)

  // ---------- API exposure ----------
  const setControlsEnabled = (enabled) => {
    try {
      if (orbitRef.current && typeof orbitRef.current.enabled === "boolean") orbitRef.current.enabled = enabled;
      if (cameraControlsApiRef.current?.controls) cameraControlsApiRef.current.controls.enabled = enabled;
      if (transformRef.current) transformRef.current.enabled = enabled;
      needsRenderRef.current = true;
    } catch (e) {}
  };

  useImperativeHandle(ref, () => ({
    addItem,
    addGLTF,
    exportGLTF,
    prepareSavePayload, // new helper to prepare FormData (GLB) for backend
    saveSceneToProject, // uploaded GLB to /api/projects/:id/assets (field name "file")
    saveSceneWithFallback, // try server, fallback to local backup
    undo,
    redo,
    deleteSelected,
    setTransformMode: (mode) => setTransformModeState(mode),
    serializeScene,
    loadFromData,
    resetScene,
    renameSelected,
    handleTransformChange,
    toggleSnap,
    setSnapValue,
    duplicateSelected,
    frameSelection,
    frameAll,
    frameHierarchy,
    applyViewPreset,
    saveCameraBookmark,
    loadCameraBookmark,
    listCameraBookmarks,
    selectObject,
    clearSelection,
    startSculpting: (mesh = null, opts = {}) => {
      const target = mesh || selectedInternal;
      if (!target) {
        console.warn("startSculpting: no target mesh");
        return false;
      }
      return startSculptingInternal(target, opts);
    },
    stopSculpting: () => stopSculptingInternal(),
    setSculptRadius,
    setSculptStrength,
    setSculptMode,
    setSculptSymmetry,
    sculptPointerDown: wrapperSculptPointerDown,
    sculptPointerMove: wrapperSculptPointerMove,
    sculptPointerUp: wrapperSculptPointerUp,
    setControlsEnabled,
    validateScene: validateSceneAPI,
    getSceneSummary,
    getSceneObjects: () => {
      const ug = getUserGroup();
      return ug ? Array.from(ug.children) : [];
    },
    getSceneVersion: () => sceneVersionRef.current,
    get scene() {
      return sceneRef.current;
    },
    applyTextureToSelection,
    loadEnvironmentFromHDR,
    getLightingApi: () => lightingApiRef.current,
    getEnvApi: () => envApiRef.current,
    getPostfxApi: () => postfxApiRef.current,
    getAnimationApi: () => animationEngineRef.current,
    getCameraControlsApi: () => cameraControlsApiRef.current,
    captureThumbnail,
    toggleNightMode: (enable) => {
      const en = typeof enable === "boolean" ? enable : !nightModeRef.current;
      toggleNightMode(en);
    },
    applyLightPayload,
    addLight,
    listLights,
    removeLight,
    resize: doResize, // Expose resize
    // Attach transform controls to a selection safely (no-op if not ready)
    attachTransformToSelection: (obj) => {
      try {
        if (!obj) return;
        if (!sceneRef.current) return;
        if (!transformRef.current) return;
        // ensure object is in the scene graph
        if (sceneRef.current.getObjectById(obj.id)) {
          transformRef.current.attach(obj);
        }
      } catch (e) {}
    },
    detachTransformControls: () => {
      try { transformRef.current?.detach?.(); } catch (e) {}
    },
    setActiveCamera: (camUuid) => {
        if (!camUuid) {
            return;
        }
        const cam = sceneRef.current.getObjectByProperty("uuid", camUuid);
        if (cam && cam.isCamera) {
            const mainCam = cameraRef.current;
            mainCam.position.copy(cam.getWorldPosition(new THREE.Vector3()));
            mainCam.quaternion.copy(cam.getWorldQuaternion(new THREE.Quaternion()));
            if (cam.fov) {
                mainCam.fov = cam.fov;
                mainCam.updateProjectionMatrix();
            }
        // derive target by casting forward direction
        const forward = new THREE.Vector3(0,0,-1).applyQuaternion(mainCam.quaternion);
        const target = mainCam.position.clone().add(forward.multiplyScalar(-5));
        if (orbitRef.current) orbitRef.current.target.copy(target);
        if (cameraControlsApiRef.current?.controls) cameraControlsApiRef.current.controls.target.copy(target);
        try { orbitRef.current?.update?.(); cameraControlsApiRef.current?.controls?.update?.(); } catch (e) {}
            
            needsRenderRef.current = true;
        }
    },
    // Animation API surface
    addTrack: (track) => animationEngineRef.current.addTrack(track),
    removeTrack: (id) => animationEngineRef.current.removeTrack(id),
    playAnimation: () => animationEngineRef.current.play(),
    pauseAnimation: () => animationEngineRef.current.pause(),
    seekAnimation: (t) => animationEngineRef.current.seek(t),
    listTracks: () => animationEngineRef.current.listTracks(),
    getAnimationSnapshot: () => animationEngineRef.current.snapshot(),
    loadAnimationSnapshot: (tracks) => animationEngineRef.current.loadSnapshot(tracks),
    getSelected: () => selectedInternal,
    setShadingMode,
  }));

  // Mirror global API for dev convenience
  try {
    window.__OBJEKTA_WORKSPACE = {
      addItem,
      addGLTF,
      exportGLTF,
      prepareSavePayload,
      undo,
      redo,
      getScene: () => sceneRef.current,
      getRenderer: () => rendererRef.current,
      getCamera: () => cameraRef.current,
      getSelected: () => selectedInternal,
      clearSelection: () => clearSelection(),
      selectObject: (o) => selectObject(o),
      frameSelection: () => frameSelection(),
      frameAll: () => frameAll(),
      frameHierarchy: () => frameHierarchy(),
      applyViewPreset: (preset) => applyViewPreset(preset),
      saveCameraBookmark: (slot) => saveCameraBookmark(slot),
      loadCameraBookmark: (slot) => loadCameraBookmark(slot),
      listCameraBookmarks,
      serializeScene,
      validateScene: validateSceneAPI,
      getSceneSummary,
      getAnimationSnapshot: () => animationEngineRef.current.snapshot(),
      loadAnimationSnapshot: (tracks) => animationEngineRef.current.loadSnapshot(tracks),
      startSculpting: (mesh = null, opts = {}) => {
        try {
          const target = mesh || selectedInternal || null;
          if (!target) {
            console.warn("startSculpting global: no target");
            return false;
          }
          return startSculptingInternal(target, opts);
        } catch (e) {
          console.warn(e);
          return false;
        }
      },
      stopSculpting: () => {
        try {
          stopSculptingInternal();
        } catch (e) {}
      },
      sculptPointerDown: wrapperSculptPointerDown,
      sculptPointerMove: wrapperSculptPointerMove,
      sculptPointerUp: wrapperSculptPointerUp,
      setControlsEnabled,
        setShadingMode,
  // Expose the local captureThumbnail helper directly on the global API (always calls local helper)
      captureThumbnail: async (scale = 1, mime = "image/png", quality = 0.9) => {
    try {
      const width = Math.round(800 * (scale || 1));
      const height = Math.round(600 * (scale || 1));
      return await captureThumbnail({ width, height, mime: "image/png", quality, attempts: 3 });
    } catch (e) {
      console.warn("global captureThumbnail wrapper error", e);
      return null;
    }
  },
      saveSceneToProject, // exposed globally for debugging
      saveSceneWithFallback,
    };
  } catch (e) {}

  // Expose a simple captureThumbnail wrapper on the global helper for console/debugging
  try {
      if (typeof window !== "undefined") {
      window.__OBJEKTA_WORKSPACE = window.__OBJEKTA_WORKSPACE || {};
      window.__OBJEKTA_WORKSPACE.captureThumbnail = async (scale = 0.8, mime = "image/png", quality = 0.9) => {
        try {
          const width = Math.round(800 * (scale || 1));
          const height = Math.round(600 * (scale || 1));
          const blob = await captureThumbnail({ width, height, mime: "image/png", quality, attempts: 3 });
          if (blob) console.log("[OBJEKTA] captureThumbnail OK (size):", blob.size);
          else console.warn("[OBJEKTA] captureThumbnail failed");
          return blob;
        } catch (err) {
          console.warn("[OBJEKTA] global captureThumbnail error", err);
          return null;
        }
      };
    }
  } catch (e) {}

  // lighting apply bridge (used by ObjectProperties, kept near top in original)
  function applyLightPayload(payload = {}) {
    try {
      const { type, color, intensity, position, target } = payload;
      if (lightingApiRef.current && typeof lightingApiRef.current.apply === "function") {
        lightingApiRef.current.apply(payload);
      } else {
        const amb = sceneRef.current._editor_group?.getObjectByName("_ambient_light");
        const dir = sceneRef.current._editor_group?.getObjectByName("_dir_light");
        if (amb && amb.isAmbientLight && typeof intensity === "number") amb.intensity = Math.max(0, Math.min(5, intensity * 0.45));
        if (dir && dir.isDirectionalLight) {
          if (typeof intensity === "number") dir.intensity = Math.max(0, Math.min(5, intensity));
          if (color) dir.color = new THREE.Color(color);
          if (position && position.x !== undefined) dir.position.set(position.x, position.y, position.z);
          if (target && dir.target) dir.target.position.set(target.x, target.y, target.z);
        }
      }
      needsRenderRef.current = true;
      try {
        if (typeof onLightChange === "function") onLightChange(payload);
      } catch (e) {}
    } catch (e) {
      console.warn("applyLightPayload failed", e);
    }
  }

  // Lighting API helpers
  const addLight = (type = "point", opts = {}) => {
    const color = opts.color ? new THREE.Color(opts.color) : new THREE.Color(0xffffff);
    let light;
    switch (type) {
      case "point":
        light = new THREE.PointLight(color, opts.intensity ?? 1, opts.distance ?? 20);
        break;
      case "spot":
        light = new THREE.SpotLight(color, opts.intensity ?? 1, opts.distance ?? 30, opts.angle ?? Math.PI / 6);
        break;
      case "dir":
      case "directional":
        light = new THREE.DirectionalLight(color, opts.intensity ?? 1);
        break;
      case "ambient":
        light = new THREE.AmbientLight(color, opts.intensity ?? 0.5);
        break;
      default:
        light = new THREE.PointLight(color, opts.intensity ?? 1, opts.distance ?? 20);
    }
    light.name = opts.name || `light_${nameCountRef.current++}`;
    light.userData.__objekta = true;
    const ug = getUserGroup();
    safeAdd(ug || sceneRef.current, light, light.name);
    ensureBVHForObject(light);
    bumpSceneVersion("addLight");
    needsRenderRef.current = true;
    return light;
  };

  const listLights = () => {
    const out = [];
    sceneRef.current.traverse((n) => {
      if (n.isLight) out.push(n);
    });
    return out;
  };

  const removeLight = (light) => {
    try {
      if (!light) return;
      if (light.parent) light.parent.remove(light);
      disposeObject(light);
      bumpSceneVersion("removeLight");
      needsRenderRef.current = true;
    } catch (e) {}
  };

  // Night/day mode
  const nightModeRef = useRef(false);
  const toggleNightMode = (enable) => {
    const en = typeof enable === "boolean" ? enable : !nightModeRef.current;
    nightModeRef.current = en;
    try {
      if (en) {
        sceneRef.current.background = new THREE.Color(0x020215);
        const amb = sceneRef.current._editor_group?.getObjectByName("_ambient_light");
        const hemi = sceneRef.current._editor_group?.getObjectByName("_hemi_light");
        const dir = sceneRef.current._editor_group?.getObjectByName("_dir_light");
        if (amb) amb.intensity = 0.12;
        if (hemi) hemi.intensity = 0.15;
        if (dir) dir.intensity = 0.45;
        try {
          if (envApiRef.current && typeof envApiRef.current.setTint === "function") envApiRef.current.setTint(0x20244f);
        } catch (e) {}
      } else {
        sceneRef.current.background = new THREE.Color(0x0a0a1a);
        const amb = sceneRef.current._editor_group?.getObjectByName("_ambient_light");
        const hemi = sceneRef.current._editor_group?.getObjectByName("_hemi_light");
        const dir = sceneRef.current._editor_group?.getObjectByName("_dir_light");
        if (amb) amb.intensity = 0.45;
        if (hemi) hemi.intensity = 0.4;
        if (dir) dir.intensity = 0.8;
        try {
          if (envApiRef.current && typeof envApiRef.current.setTint === "function") envApiRef.current.setTint(null);
        } catch (e) {}
      }
    } catch (e) {}
    needsRenderRef.current = true;
    bumpSceneVersion("night-mode-" + (en ? "on" : "off"));
  };

  // ---------- Outliner & Properties UI (kept simple and inside) ----------
  const OutlinerPanelInner = ({ onPrimarySelect }) => {
    const [items, setItems] = useState([]);
    const lastVer = useRef(sceneVersionRef.current);
    useEffect(() => {
      let mounted = true;
      const scanOnce = () => {
        const ug = getUserGroup();
        const list = ug ? Array.from(ug.children) : [];
        if (!mounted) return;
        setItems(list);
      };
      scanOnce();
      const iv = setInterval(() => {
        const ver = sceneVersionRef.current;
        if (ver !== lastVer.current) {
          lastVer.current = ver;
          scanOnce();
        }
      }, 600);
      return () => {
        mounted = false;
        clearInterval(iv);
      };
    }, []);

    const toggleVisibility = (obj) => {
      obj.visible = !obj.visible;
      commitHistory("vis-toggle");
      bumpSceneVersion("visibility");
      needsRenderRef.current = true;
    };
    const removeObject = (obj) => {
      try {
        disposeObject(obj);
      } catch (e) {}
      if (obj.parent) obj.parent.remove(obj);
      commitHistory("delete");
      bumpSceneVersion("removeObject");
      needsRenderRef.current = true;
      try {
        EventBus.emit?.("object:deleted", { uuid: obj.uuid });
      } catch (e) {}
    };
    const renameObject = (obj) => {
      const nv = prompt("Rename object", obj.name || "");
      if (nv && nv !== obj.name) {
        obj.name = nv;
        commitHistory("rename");
        bumpSceneVersion("renameObject");
        needsRenderRef.current = true;
        try {
          EventBus?.emit?.("object:renamed", { uuid: obj.uuid, name: nv });
        } catch (e) {}
      }
    };

    return (
      <div
        // Replace fragile height:100% with flex so parent flex layouts can
        // resolve the inner area and allow overflow to behave correctly.
        style={{ overflowY: "auto", padding: 8, flex: '1 1 auto', minHeight: 0 }}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>Scene Outliner</div>
        {items.map((it) => (
          <div
            key={it.uuid}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "6px 8px",
              borderRadius: 8,
              background: it.userData?.__selected ? "rgba(127,90,240,0.12)" : "transparent",
              marginBottom: 6,
            }}
          >
            <div
              style={{ flex: 1, cursor: "pointer" }}
              onClick={(e) => {
                if (e.ctrlKey || e.metaKey) {
                  toggleMultiSelect(it);
                } else {
                  onPrimarySelect(it);
                }
              }}
            >
              {it.name}
            </div>
            <button title="Rename" onClick={() => renameObject(it)}>
              ✎
            </button>
            <button title="Toggle visibility" onClick={() => toggleVisibility(it)}>
              {it.visible ? "👁" : "🚫"}
            </button>
            <button
              title="Delete"
              onClick={() => {
                if (confirm("Delete object?")) removeObject(it);
              }}
            >
              🗑
            </button>
          </div>
        ))}
      </div>
    );
  };

  // We're using your external ObjectProperties (imported above).
  // Provide it a full set of callbacks it expects and let it mutate the real THREE object directly.

  // Bridge functions required by ObjectProperties
  const onMaterialChangeFromPanel = (patch) => {
    if (!selectedInternal) return;
    try {
      selectedInternal.traverse((n) => {
        if (n.isMesh && n.material) {
          const mats = Array.isArray(n.material) ? n.material : [n.material];
          mats.forEach((m) => {
            try {
              if (patch.hex && m.color) m.color.set(patch.hex);
              if (typeof patch.roughness === "number" && typeof m.roughness === "number")
                m.roughness = patch.invertRoughness ? 1 - patch.roughness : patch.roughness;
              if (typeof patch.metalness === "number" && typeof m.metalness === "number")
                m.metalness = patch.invertMetalness ? 1 - patch.metalness : patch.metalness;
              if (typeof patch.opacity === "number") {
                m.opacity = patch.opacity;
                m.transparent = patch.opacity < 1;
              }
              if (patch.emissiveHex && m.emissive) m.emissive.set(patch.emissiveHex);
              if (typeof patch.emissiveIntensity === "number" && m.emissiveIntensity !== undefined)
                m.emissiveIntensity = patch.emissiveIntensity;
              if (typeof patch.wireframe === "boolean") m.wireframe = patch.wireframe;
              if (typeof patch.normalScale === "number" && m.normalScale) m.normalScale = new THREE.Vector2(patch.normalScale, patch.normalScale);
              m.needsUpdate = true;
            } catch (e) {}
          });
        }
      });
    } catch (e) {}
    needsRenderRef.current = true;
    try {
      if (typeof onLightChange === "function") onLightChange({ materialPatch: patch });
    } catch (e) {}
  };

  const onApplyTextureFromPanel = (file, slotKey) => {
    if (!file || !selectedInternal) return;
    const url = URL.createObjectURL(file);
    try {
      blobUrlsRef.current.add(url);
    } catch (e) {}
    const loader = new THREE.TextureLoader();
    loader.load(
      url,
      (tex) => {
        try {
          try { tex.colorSpace = THREE.SRGBColorSpace; } catch (e) { try { tex.encoding = THREE.sRGBEncoding; } catch (e2) {} }
          tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
          selectedInternal.traverse((n) => {
            if (n.isMesh && n.material) {
              const mats = Array.isArray(n.material) ? n.material : [n.material];
              mats.forEach((m) => {
                try {
                  m[slotKey] = tex;
                  if (slotKey === "normalMap") m.normalScale = m.normalScale || new THREE.Vector2(1, 1);
                  m.needsUpdate = true;
                } catch (e) {}
              });
            }
          });
          needsRenderRef.current = true;
        } catch (e) {}
      },
      undefined,
      (err) => {
        try {
          URL.revokeObjectURL(url);
          blobUrlsRef.current.delete(url);
        } catch (e) {}
      }
    );
  };

  const onApplyGLBFromPanel = (file) => {
    if (!file) return;
    addGLTF(file, null);
  };

  const onRemoveTextureFromPanel = (slotKey) => {
    if (!selectedInternal) return;
    try {
      selectedInternal.traverse((n) => {
        if (n.isMesh && n.material) {
          const mats = Array.isArray(n.material) ? n.material : [n.material];
          mats.forEach((m) => {
            try {
              m[slotKey] = null;
              m.needsUpdate = true;
            } catch (e) {}
          });
        }
      });
    } catch (e) {}
    needsRenderRef.current = true;
  };

  const onVisibilityToggleFromPanel = (v) => {
    if (!selectedInternal) return;
    try {
      selectedInternal.visible = v;
    } catch (e) {}
    needsRenderRef.current = true;
  };

  const onDeleteFromPanel = () => {
    if (!selectedInternal) return;
    try {
      selectedInternal.traverse((n) => {
        try {
          SceneGraphStore.removeObject?.(n.uuid);
        } catch (e) {}
      });
    } catch (e) {}
    try {
      const snap = selectedInternal.toJSON();
      const uuid = selectedInternal.uuid;
      try {
        disposeObject(selectedInternal);
      } catch (e) {}
      if (selectedInternal.parent) selectedInternal.parent.remove(selectedInternal);
      clearSelection();
      bumpSceneVersion("delete");
      try {
        EventBus?.emit?.("scene:updated", { id: uuid, type: "delete" });
      } catch (e) {}
      cmdHistoryRef.current.push(
        new Cmd(
          () => {
            const ug = getUserGroup();
            const ex = ug?.getObjectByProperty("uuid", uuid);
            if (ex) {
              disposeObject(ex);
              if (ex.parent) ex.parent.remove(ex);
            }
          },
          () => {
            try {
              const loader = new THREE.ObjectLoader();
              const recreated = loader.parse(snap);
              recreated.userData = recreated.userData || {};
              recreated.userData.__objekta = true;
              const ug = getUserGroup();
              safeAdd(ug || sceneRef.current, recreated, "undo_delete");
              try {
                recreated.traverse((n) => {
                  SceneGraphStore.addObject?.(n.uuid, n, { name: n.name, type: n.type });
                });
              } catch (e) {}
              ensureBVHForObject(recreated);
              bumpSceneVersion("undo-delete");
            } catch (e) {
              console.warn("Undo delete failed", e);
            }
          },
          "delete"
        )
      );
    } catch (e) {}
    needsRenderRef.current = true;
  };

  const onRenameFromPanel = (name) => {
    if (!selectedInternal) return;
    selectedInternal.name = name;
    commitHistory("rename");
    bumpSceneVersion("rename");
    try {
      SceneGraphStore.renameObject?.(selectedInternal.uuid, name);
    } catch (e) {}
    try {
      EventBus?.emit?.("object:renamed", { uuid: selectedInternal.uuid, name });
    } catch (e) {}
    needsRenderRef.current = true;
  };

  const handleEnvChange = (payload) => {
      if (payload.background) {
          if (envApiRef.current) envApiRef.current.setBackgroundColor(payload.background);
          else sceneRef.current.background = new THREE.Color(payload.background);
      }
      if (payload.file) {
          const url = URL.createObjectURL(payload.file);
          if (envApiRef.current) envApiRef.current.setHDR(url).finally(() => URL.revokeObjectURL(url));
      }
      if (typeof payload.intensity === 'number') {
          sceneRef.current.backgroundIntensity = payload.intensity;
          sceneRef.current.environmentIntensity = payload.intensity;
      }
      if (typeof payload.blur === 'number') {
          sceneRef.current.backgroundBlurriness = payload.blur;
      }
      needsRenderRef.current = true;
  };

  const handleLookThrough = (cam) => {
      if (!cam || !cam.isCamera) return;
      // Save current main camera state so we can toggle back
        if (!isCameraViewRef.current) {
          const mainCam = cameraRef.current;
          const orbit = orbitRef.current;
          if (mainCam) {
            savedCameraStateRef.current = {
              pos: mainCam.position.clone(),
              quat: mainCam.quaternion.clone(),
              fov: mainCam.fov,
              near: mainCam.near,
              far: mainCam.far,
              target: orbit && orbit.target ? orbit.target.clone() : null,
            };
          }
          isCameraViewRef.current = true;
        }

        const worldPos = cam.getWorldPosition(new THREE.Vector3());
        const worldQuat = cam.getWorldQuaternion(new THREE.Quaternion());
        const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(worldQuat).normalize();
        const target = worldPos.clone().add(dir.clone().multiplyScalar(5));

        smoothCameraMove({ toPos: worldPos, toTarget: target, toQuat: worldQuat, duration: 0.4 });

        const mainCam = cameraRef.current;
        if (mainCam) {
          if (typeof cam.fov === 'number') mainCam.fov = cam.fov;
          if (typeof cam.near === 'number') mainCam.near = cam.near;
          if (typeof cam.far === 'number') mainCam.far = cam.far;
          try { mainCam.updateProjectionMatrix(); } catch (e) {}
        }
        needsRenderRef.current = true;
  };

  const exitCameraView = (opts = { duration: 0.4 }) => {
    if (!isCameraViewRef.current) return;
    const saved = savedCameraStateRef.current;
    if (!saved) {
      isCameraViewRef.current = false;
      return;
    }
    const mainCam = cameraRef.current;
    if (mainCam) {
      if (typeof saved.fov === 'number') mainCam.fov = saved.fov;
      if (typeof saved.near === 'number') mainCam.near = saved.near;
      if (typeof saved.far === 'number') mainCam.far = saved.far;
      try { mainCam.updateProjectionMatrix(); } catch (e) {}
    }
    // Restore position/quat/target smoothly
    smoothCameraMove({ toPos: saved.pos, toTarget: saved.target || null, toQuat: saved.quat, duration: opts.duration });
    isCameraViewRef.current = false;
    needsRenderRef.current = true;
  };

  const enterCameraView = (cam) => {
    handleLookThrough(cam);
  };

  const handleToggleCameraView = () => {
    // If already in camera view, exit; otherwise enter using selected camera if present
    if (isCameraViewRef.current) {
      exitCameraView();
    } else if (selectedInternal && selectedInternal.isCamera) {
      enterCameraView(selectedInternal);
    }
  };

  // Bind Blender-like '0' key to toggle camera view (ignore when typing in inputs)
  useEffect(() => {
    const onKey = (ev) => {
      if (ev.key === '0') {
        const active = document.activeElement;
        if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.isContentEditable)) return;
        try { handleToggleCameraView(); } catch (e) { /* noop */ }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedInternal]);

  // ---------- Outliner & Properties UI render ----------
  const PropertiesPanelInner = ({ selected }) => {
    // Removed early return to allow Environment settings when no selection

    return (
      <div style={{ flex: '1 1 auto', minHeight: 0, overflow: "hidden" }}>
        {/* If you use an external ObjectProperties component in your project, render it here:
            <ObjectProperties selected={selected} onTransformChange={...} onMaterialChange={...} ... />
            but to keep this file self-contained, the simple inlined properties exist above (PropertiesPanelInner earlier in old snippet).
         */}
        <ObjectProperties
          selected={selected}
          onTransformChange={(prop, axis, value) => {
            handleTransformChange(prop, axis, value);
          }}
          onMaterialChange={(patch) => onMaterialChangeFromPanel(patch)}
          onApplyTexture={(file, slotKey) => onApplyTextureFromPanel(file, slotKey)}
          onApplyGLB={(file) => onApplyGLBFromPanel(file)}
          onRemoveTexture={(slotKey) => onRemoveTextureFromPanel(slotKey)}
          onVisibilityToggle={(v) => onVisibilityToggleFromPanel(v)}
          onDelete={() => onDeleteFromPanel()}
          onRename={(name) => onRenameFromPanel(name)}
          onLightChange={(payload) => applyLightPayload(payload)}
          onEnvChange={handleEnvChange}
          onLookThrough={handleLookThrough}
        />
      </div>
    );
  };

  const PanelContainerInner = () => {
    const [tab, setTab] = useState("outliner");
    const topValue = typeof panelTopOffset === "number" ? panelTopOffset : 12;
    return (
      <div
        style={{
          position: "absolute",
          right: 12,
          top: topValue,
          width: 360,
          bottom: 12,
          display: "flex",
          flexDirection: "column",
          zIndex: 60,
          gap: 8,
          pointerEvents: "auto",
        }}
      >
        <div style={{ display: "flex", gap: 6 }}>
          <button
            onClick={() => setTab("outliner")}
            style={{
              flex: 1,
              padding: 8,
              background: tab === "outliner" ? "rgba(127,90,240,0.16)" : "rgba(0,0,0,0.4)",
            }}
          >
            Outliner
          </button>
          <button
            onClick={() => setTab("props")}
            style={{
              flex: 1,
              padding: 8,
              background: tab === "props" ? "rgba(127,90,240,0.16)" : "rgba(0,0,0,0.4)",
            }}
          >
            Properties
          </button>
        </div>
        <div style={{ flex: 1, background: "linear-gradient(180deg, rgba(0,0,0,0.25), rgba(0,0,0,0.18))", borderRadius: 10, overflow: "hidden" }}>
          {tab === "outliner" ? <OutlinerPanelInner onPrimarySelect={(o) => selectObject(o)} /> : <PropertiesPanelInner selected={selectedInternal} />}
        </div>
      </div>
    );
  };

  // ---------- Render ----------
  return (
    <div ref={setContainerNode} className="relative flex-1 w-full h-full overflow-hidden" data-objekta-root>
      {/* main canvas */}
      <canvas ref={canvasRef} className="w-full h-full" />

      {/* GPU / performance panel removed */}
      {/* Resolution controls removed — viewport scale forced to 100% */}
      {/* Animation scrubber */}
      <AnimationScrubber />
      {/* Bloom tagging panel */}
      <BloomTagPanel workspaceRef={ref || { current: window.__OBJEKTA_WORKSPACE }} />
      {/* Keyframe editor */}
      <AnimationKeyframeEditor />

      {/* mini canvas inserted into DOM for camera preview */}
      <div style={{ position: "absolute", left: 12, top: 12, width: 140, height: 140, zIndex: 80, pointerEvents: "auto" }}>
        <div
          ref={(el) => {
            if (!el) return;
            try {
              const miniEl = miniRendererRef.current?.domElement;
              if (miniEl && miniEl.parentElement !== el) {
                miniEl.style.width = "140px";
                miniEl.style.height = "140px";
                miniEl.style.borderRadius = "8px";
                miniEl.style.boxShadow = "0 10px 30px rgba(0,0,0,0.5)";
                miniEl.style.pointerEvents = "auto";
                miniEl.style.background = "transparent";
                el.appendChild(miniEl);
              }
            } catch (e) {}
          }}
          style={{ width: "140px", height: "140px", borderRadius: 8, overflow: "hidden", touchAction: "none" }}
        />
      </div>

      {/* camera quick actions */}
      <div
        style={{
          position: "absolute",
          left: 12,
          top: 160,
          width: 240,
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 4,
          background: "rgba(0,0,0,0.7)",
          padding: "4px 6px",
          borderRadius: 6,
          color: "#eee",
          zIndex: 80,
          boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
          fontSize: 10,
        }}
      >
        <button className="studio-btn" style={{ fontSize: 10, padding: "3px 6px", minHeight: 24 }} title="Frame selection (Shift+F)" onClick={() => frameSelection()}>
          Sel
        </button>
        <button className="studio-btn" style={{ fontSize: 10, padding: "3px 6px", minHeight: 24 }} title="Frame all (Shift+A)" onClick={() => frameAll()}>
          All
        </button>
        <button className="studio-btn" style={{ fontSize: 10, padding: "3px 6px", minHeight: 24 }} title="Frame hierarchy (Shift+H)" onClick={() => frameHierarchy()}>
          Hier
        </button>
        <button className="studio-btn" style={{ fontSize: 10, padding: "3px 6px", minHeight: 24 }} title="Front view (Alt+1)" onClick={() => applyViewPreset("front")}>
          F
        </button>
        <button className="studio-btn" style={{ fontSize: 10, padding: "3px 6px", minHeight: 24 }} title="Right view (Alt+2)" onClick={() => applyViewPreset("right")}>
          R
        </button>
        <button className="studio-btn" style={{ fontSize: 10, padding: "3px 6px", minHeight: 24 }} title="Top view (Alt+3)" onClick={() => applyViewPreset("top")}>
          T
        </button>
        <button className="studio-btn" style={{ fontSize: 10, padding: "3px 6px", minHeight: 24 }} title="Isometric view (Alt+4)" onClick={() => applyViewPreset("iso")}>
          Iso
        </button>
        {["1", "2", "3", "4"].map((slot) => {
          const hasBookmark = cameraBookmarksRef.current.has(slot);
          return (
            <React.Fragment key={`bookmark-${slot}-${bookmarkUiVersion}`}>
              <button
                className="studio-btn"
                style={{ fontSize: 10, padding: "3px 6px", minHeight: 24 }}
                title={`Save bookmark ${slot} (Ctrl/Cmd+Shift+${slot})`}
                onClick={() => saveCameraBookmark(slot)}
              >
                S{slot}
              </button>
              <button
                className="studio-btn"
                style={{
                  fontSize: 10,
                  padding: "3px 6px",
                  minHeight: 24,
                  borderColor: hasBookmark ? "rgba(34,197,94,0.8)" : undefined,
                  boxShadow: hasBookmark ? "inset 0 0 0 1px rgba(34,197,94,0.45)" : undefined,
                }}
                title={`Load bookmark ${slot} (Ctrl/Cmd+${slot})`}
                onClick={() => loadCameraBookmark(slot)}
                disabled={!hasBookmark}
              >
                L{slot}
              </button>
            </React.Fragment>
          );
        })}
      </div>

      {loading && (
        <div className="absolute inset-0 z-50 flex items-center justify-center pointer-events-none">
          <div style={{ background: "rgba(0,0,0,0.6)", padding: 16, borderRadius: 10 }}>
            <div style={{ color: "#fff", fontSize: 13 }}>Loading model...</div>
          </div>
        </div>
      )}

      {hover.name && (
        <div
          aria-hidden
          style={{
            position: "absolute",
            left: hover.x,
            top: hover.y,
            transform: "translate(-0%, -100%)",
            pointerEvents: "none",
            background: "rgba(0,0,0,0.7)",
            color: "#fff",
            padding: "6px 8px",
            borderRadius: 6,
            fontSize: 12,
            zIndex: 30,
            whiteSpace: "nowrap",
            boxShadow: "0 8px 20px rgba(0,0,0,0.5)",
          }}
        >
          {hover.name}
        </div>
      )}

      {/* visual drop indicator */}
      {isOver && <div className="absolute inset-0 border-2 border-dashed border-green-500 pointer-events-none" />}

      {/* toolbar placeholder near object (could be extended) */}
      <div style={{ position: "absolute", left: toolbarPos.x, top: toolbarPos.y, zIndex: 70, pointerEvents: "auto" }}>
        {selectedInternal && (
          <div style={{ background: "rgba(0,0,0,0.6)", padding: "6px 8px", borderRadius: 6, color: "#fff", fontSize: 12 }}>
            {selectedInternal.name}
          </div>
        )}
      </div>

      {showInternalPanels && <PanelContainerInner />}
    </div>
  );
});

export default Workspace;
