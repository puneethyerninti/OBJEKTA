// src/components/Workspace.jsx
import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState, useCallback } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { TransformControls } from "three/examples/jsm/controls/TransformControls";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter";
import { MeshBVH, acceleratedRaycast, computeBoundsTree, disposeBoundsTree } from "three-mesh-bvh";
import { useDrop } from "react-dnd";
import { PALETTE_TYPE } from "./Palette";
import EventBus from "../utils/EventBus";
import { SceneGraphStore } from "../store/SceneGraphStore";

/*
  Workspace.jsx — extended + fixes
  - shared DRACOLoader instance (dracoRef) and disposal on unmount
  - getUserGroup(scene?) helper to normalize _userGroup / _user_group access
  - WeakMap (materialOriginalsRef) to store/restore emissive without polluting userData
  - robust blob URL tracking / revoke
  - preserved original architecture and history logic
*/

const HISTORY_LIMIT = 200;
const THROTTLE_MS = 50;
const AUTOSAVE_KEY = "objekta_autosave_v1";
const HISTORY_DEBOUNCE_MS = 600;

const Workspace = forwardRef(({ selected, onSelect, onFullScreenChange, panelTopOffset = 12, onSceneChange }, ref) => {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);

  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const rendererRef = useRef(null);
  const orbitRef = useRef(null);
  const transformRef = useRef(null);

  const raycasterRef = useRef(new THREE.Raycaster());
  const mouseRef = useRef(new THREE.Vector2());
  const nameCountRef = useRef(1);
  const blobUrlsRef = useRef(new Set());

  // NEW: shared DRACO loader + WeakMap for material originals
  const dracoRef = useRef(null);
  const materialOriginalsRef = useRef(new WeakMap());

  const [selectedInternal, setSelectedInternal] = useState(null);
  const [toolbarPos, setToolbarPos] = useState({ x: -999, y: -999 });
  const [transformMode, setTransformModeState] = useState("translate");

  // simple scene-version counter — increment whenever scene changes
  const sceneVersionRef = useRef(0);
  const bumpSceneVersion = (why) => {
    sceneVersionRef.current++;
    try { if (typeof onSceneChange === "function") onSceneChange(sceneVersionRef.current); } catch (e) {}
    try { EventBus?.emit?.("scene:updated", { version: sceneVersionRef.current, why }); } catch (e) {}
  };

  // snapshot history (legacy/autosave)
  const snapshotHistoryRef = useRef([]);
  const snapshotHistoryIndexRef = useRef(-1);

  // command history (preferred for undo/redo)
  class Cmd {
    constructor(redoFn, undoFn, label = "") {
      this.redo = redoFn;
      this.undo = undoFn;
      this.label = label;
    }
  }
  class HistoryManager {
    constructor(limit = 200) {
      this.limit = limit;
      this.stack = [];
      this.index = -1;
    }
    push(cmd) {
      this.stack.splice(this.index + 1);
      this.stack.push(cmd);
      if (this.stack.length > this.limit) this.stack.shift();
      this.index = this.stack.length - 1;
    }
    undo() {
      if (this.index < 0) return;
      try { this.stack[this.index].undo(); } catch (e) { console.warn("Undo failed", e); }
      this.index--;
      bumpSceneVersion('undo');
    }
    redo() {
      if (this.index >= this.stack.length - 1) return;
      this.index++;
      try { this.stack[this.index].redo(); } catch (e) { console.warn("Redo failed", e); }
      bumpSceneVersion('redo');
    }
    clear() { this.stack = []; this.index = -1; }
    get length() { return this.stack.length; }
  }
  const cmdHistoryRef = useRef(new HistoryManager(HISTORY_LIMIT));

  const transformStartRef = useRef(null);
  const transformDirtyRef = useRef(false);
  const lastToolbarUpdate = useRef(0);
  const historyDebounceRef = useRef(null);
  const lastHistorySignatureRef = useRef(null);

  // multi-select
  const selectedSetRef = useRef(new Set());
  const transformGroupRef = useRef(null);
  const multiParentMapRef = useRef(new Map());

  // snapping
  const snapRef = useRef({ enabled: false, value: 0.5 });

  // hover tooltip
  const [hover, setHover] = useState({ name: "", x: -999, y: -999 });

  // loading state for GLTFs
  const [loading, setLoading] = useState(false);

  // ---------- BVH wiring ----------
  try {
    if (THREE && THREE.Mesh && THREE.Mesh.prototype && THREE.Mesh.prototype.raycast !== acceleratedRaycast) {
      THREE.Mesh.prototype.raycast = acceleratedRaycast;
    }
    if (THREE && THREE.BufferGeometry && !THREE.BufferGeometry.prototype.computeBoundsTree) {
      THREE.BufferGeometry.prototype.computeBoundsTree = computeBoundsTree;
      THREE.BufferGeometry.prototype.disposeBoundsTree = disposeBoundsTree;
    }
  } catch (err) {
    // fallback silently
  }

  // --- Non-blocking BVH / computeBoundsTree scheduler ---
  const scheduleComputeBoundsTreeForObject = useCallback((obj) => {
    if (!obj) return;
    const tasks = [];
    try {
      obj.traverse((n) => {
        if (n.isMesh && n.geometry) {
          if (typeof n.geometry.computeBoundsTree === "function") {
            tasks.push(() => {
              try { n.geometry.computeBoundsTree(); } catch (e) {}
            });
          } else if (MeshBVH) {
            tasks.push(() => {
              try { n.geometry.boundsTree = new MeshBVH(n.geometry); } catch (e) {}
            });
          }
        }
      });
    } catch (e) { /* ignore */ }

    if (tasks.length === 0) return;

    const runChunk = () => {
      const start = performance.now();
      while (tasks.length) {
        const fn = tasks.shift();
        try { fn(); } catch (e) {}
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
    } else {
      setTimeout(runChunk, 16);
    }
  }, []);

  const ensureBVHForObject = useCallback((obj) => {
    try {
      scheduleComputeBoundsTreeForObject(obj);
    } catch (e) {
      try {
        obj.traverse((n) => {
          if (n.isMesh && n.geometry && typeof n.geometry.computeBoundsTree === "function") {
            try { n.geometry.computeBoundsTree(); } catch (e) {}
          } else if (n.isMesh && n.geometry && MeshBVH) {
            try { n.geometry.boundsTree = new MeshBVH(n.geometry); } catch (e) {}
          }
        });
      } catch (er) {}
    }
  }, [scheduleComputeBoundsTreeForObject]);

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  // --- Sculpting integration (paste after clamp) ---
  const sculptStateRef = useRef({
    active: false,
    target: null,
    mode: 'inflate', // inflate | deflate | grab | smooth | pinch | flatten
    radius: 0.25,
    strength: 0.6,
    symmetry: { x: false, y: false, z: false },
    pointerDown: false,
    lastPoint: null,
    neighborsMap: new Map(),
    undoTmp: null,
  });

  // Build adjacency (vertex neighbors) for BufferGeometry
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
        neighbors[a].add(b); neighbors[a].add(c);
        neighbors[b].add(a); neighbors[b].add(c);
        neighbors[c].add(a); neighbors[c].add(b);
      }
    } else {
      const pos = posAttr.array;
      for (let i = 0, vi = 0; i < pos.length; i += 9, vi += 3) {
        const a = vi, b = vi + 1, c = vi + 2;
        neighbors[a].add(b); neighbors[a].add(c);
        neighbors[b].add(a); neighbors[b].add(c);
        neighbors[c].add(a); neighbors[c].add(b);
      }
    }
    return neighbors.map((s) => Array.from(s));
  };

  // falloff curve (cosine-like)
  const falloff = (t) => {
    const x = Math.max(0, Math.min(1, t));
    // 1 at center, 0 at radius
    return 0.5 * (1 + Math.cos(Math.PI * Math.min(1, x)));
  };

  // apply brush at a world point
  const applyBrushToMesh = (mesh, worldPoint, opts = {}) => {
    if (!mesh || !mesh.geometry || !mesh.geometry.isBufferGeometry) return null;
    const geometry = mesh.geometry;
    const posAttr = geometry.attributes.position;
    const nVerts = posAttr.count;
    const localPoint = worldPoint.clone();
    mesh.worldToLocal(localPoint);

    const radius = (typeof opts.radius === 'number') ? opts.radius : sculptStateRef.current.radius;
    const strength = (typeof opts.strength === 'number') ? opts.strength : sculptStateRef.current.strength;
    const mode = opts.mode || sculptStateRef.current.mode;

    if (!sculptStateRef.current.neighborsMap.has(geometry.uuid)) {
      sculptStateRef.current.neighborsMap.set(geometry.uuid, buildVertexNeighbors(geometry));
    }
    const neighbors = sculptStateRef.current.neighborsMap.get(geometry.uuid);

    if (!geometry.attributes.normal) geometry.computeVertexNormals();
    const normals = geometry.attributes.normal.array;
    const positions = posAttr.array;
    const changed = new Map();

    for (let i = 0; i < nVerts; i++) {
      const ix = i * 3;
      const vx = positions[ix], vy = positions[ix + 1], vz = positions[ix + 2];
      const dx = vx - localPoint.x, dy = vy - localPoint.y, dz = vz - localPoint.z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (dist > radius) continue;
      const t = dist / radius;
      const w = falloff(1 - t); // stronger at center

      let nx = normals[ix], ny = normals[ix + 1], nz = normals[ix + 2];
      const nl = Math.hypot(nx, ny, nz) || 1;
      nx /= nl; ny /= nl; nz /= nl;

      let dirx = nx, diry = ny, dirz = nz;
      if (mode === 'grab') {
        if (opts.viewDir) { dirx = opts.viewDir.x; diry = opts.viewDir.y; dirz = opts.viewDir.z; }
      } else if (mode === 'flatten') {
        if (opts.planeNormal) { dirx = opts.planeNormal.x; diry = opts.planeNormal.y; dirz = opts.planeNormal.z; }
      } else if (mode === 'pinch') {
        dirx = -dx; diry = -dy; dirz = -dz;
        const dl = Math.hypot(dirx, diry, dirz) || 1; dirx /= dl; diry /= dl; dirz /= dl;
      }

      const sign = (mode === 'deflate') ? -1 : 1;
      const delta = strength * sign * w * 0.08; // tuned scale

      if (!changed.has(i)) changed.set(i, [vx, vy, vz]);

      positions[ix] = vx + dirx * delta;
      positions[ix + 1] = vy + diry * delta;
      positions[ix + 2] = vz + dirz * delta;
    }

    // smoothing pass for smooth mode
    if (mode === 'smooth') {
      const out = new Float32Array(positions.length);
      out.set(positions);
      const lambda = strength * 0.6;
      for (let i = 0; i < nVerts; i++) {
        const nb = neighbors[i];
        if (!nb || nb.length === 0) continue;
        const ix = i*3;
        let sx=0, sy=0, sz=0;
        for (let j=0;j<nb.length;j++) {
          const k = nb[j]*3;
          sx += positions[k]; sy += positions[k+1]; sz += positions[k+2];
        }
        const inv = 1/nb.length;
        sx *= inv; sy *= inv; sz *= inv;
        out[ix] += (sx - positions[ix]) * lambda;
        out[ix+1] += (sy - positions[ix+1]) * lambda;
        out[ix+2] += (sz - positions[ix+2]) * lambda;
      }
      positions.set(out);
    }

    posAttr.needsUpdate = true;
    if (geometry.computeVertexNormals) geometry.computeVertexNormals();
    if (geometry.computeBoundingSphere) geometry.computeBoundingSphere();

    try { ensureBVHForObject(mesh); } catch (e) {}

    return { mesh, geometry, changed };
  };

  // push sculpt command (undo/redo)
  const pushSculptCommand = (mesh, changedMap, label = 'sculpt') => {
    if (!mesh || !mesh.geometry || !changedMap || changedMap.size === 0) return;
    try {
      const geometry = mesh.geometry;
      const pos = geometry.attributes.position;
      const redoSnapshot = new Map();
      for (const [i] of changedMap) {
        const ix = i*3;
        redoSnapshot.set(i, [pos.array[ix], pos.array[ix+1], pos.array[ix+2]]);
      }
      const undoSnapshot = changedMap;

      cmdHistoryRef.current.push(new Cmd(
        () => {
          for (const [i, v] of redoSnapshot) {
            const ix = i*3;
            pos.array[ix] = v[0]; pos.array[ix+1] = v[1]; pos.array[ix+2] = v[2];
          }
          pos.needsUpdate = true; geometry.computeVertexNormals && geometry.computeVertexNormals();
          ensureBVHForObject(mesh); bumpSceneVersion('sculpt-redo');
        },
        () => {
          for (const [i, v] of undoSnapshot) {
            const ix = i*3;
            pos.array[ix] = v[0]; pos.array[ix+1] = v[1]; pos.array[ix+2] = v[2];
          }
          pos.needsUpdate = true; geometry.computeVertexNormals && geometry.computeVertexNormals();
          ensureBVHForObject(mesh); bumpSceneVersion('sculpt-undo');
        },
        label
      ));
    } catch (e) { console.warn('pushSculptCommand failed', e); }
  };

  // start / stop sculpt state
  const startSculptingInternal = (mesh, { mode = 'inflate', radius = 0.25, strength = 0.6 } = {}) => {
    if (!mesh || !mesh.geometry) return false;
    sculptStateRef.current.active = true;
    sculptStateRef.current.target = mesh;
    sculptStateRef.current.mode = mode;
    sculptStateRef.current.radius = radius;
    sculptStateRef.current.strength = strength;
    sculptStateRef.current.pointerDown = false;
    sculptStateRef.current.lastPoint = null;
    sculptStateRef.current.undoTmp = null;
    try { mesh.geometry.computeVertexNormals?.(); } catch(e){}
    try { ensureBVHForObject(mesh); } catch(e){}
    bumpSceneVersion('sculpt-start');
    // disable transform/orbit while sculpting
    try { orbitRef.current && (orbitRef.current.enabled = false); transformRef.current && (transformRef.current.enabled = false); } catch (e) {}
    return true;
  };
  const stopSculptingInternal = () => {
    if (!sculptStateRef.current.active) return;
    sculptStateRef.current.active = false;
    sculptStateRef.current.target = null;
    sculptStateRef.current.pointerDown = false;
    sculptStateRef.current.lastPoint = null;
    sculptStateRef.current.undoTmp = null;
    bumpSceneVersion('sculpt-stop');
    try { orbitRef.current && (orbitRef.current.enabled = true); transformRef.current && (transformRef.current.enabled = true); } catch (e) {}
  };

  // pointer handlers
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
      const res = applyBrushToMesh(mesh, worldPoint, { radius: sculptStateRef.current.radius, strength: sculptStateRef.current.strength, mode: sculptStateRef.current.mode, viewDir: cameraRef.current.getWorldDirection(new THREE.Vector3()).clone() });
      if (res && res.changed && res.changed.size > 0) {
        sculptStateRef.current.undoTmp = res.changed;
        // We'll push a command at pointerup to group the stroke into one undo
      }
    } catch (e) { console.warn('sculpt pointerdown', e); }
  };

  const onSculptPointerMove = (event) => {
    if (!sculptStateRef.current.active || !sculptStateRef.current.pointerDown) return;
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
      const res = applyBrushToMesh(mesh, worldPoint, { radius: sculptStateRef.current.radius, strength: sculptStateRef.current.strength, mode: sculptStateRef.current.mode, viewDir: cameraRef.current.getWorldDirection(new THREE.Vector3()).clone() });
      if (res && res.changed && res.changed.size > 0) {
        if (!sculptStateRef.current.undoTmp) sculptStateRef.current.undoTmp = new Map();
        for (const [k, v] of res.changed) {
          if (!sculptStateRef.current.undoTmp.has(k)) sculptStateRef.current.undoTmp.set(k, v);
        }
      }
    } catch (e) { console.warn('sculpt pointermove', e); }
  };

  const onSculptPointerUp = (event) => {
    if (!sculptStateRef.current.active || !sculptStateRef.current.pointerDown) return;
    sculptStateRef.current.pointerDown = false;
    const mesh = sculptStateRef.current.target;
    if (sculptStateRef.current.undoTmp && mesh) {
      pushSculptCommand(mesh, sculptStateRef.current.undoTmp, 'sculpt-stroke');
      sculptStateRef.current.undoTmp = null;
      bumpSceneVersion('sculpt-stroke-commit');
    }
  };

  // attach sculpt pointer listeners (separate effect)
  useEffect(() => {
    const el = rendererRef.current?.domElement;
    if (!el) return;
    el.addEventListener('pointerdown', onSculptPointerDown);
    el.addEventListener('pointermove', onSculptPointerMove);
    window.addEventListener('pointerup', onSculptPointerUp);
    return () => {
      el.removeEventListener('pointerdown', onSculptPointerDown);
      el.removeEventListener('pointermove', onSculptPointerMove);
      window.removeEventListener('pointerup', onSculptPointerUp);
    };
  }, []);

  // convenience API setters for toolbar (used below in useImperativeHandle)
  const setSculptRadius = (r) => { sculptStateRef.current.radius = r; };
  const setSculptStrength = (s) => { sculptStateRef.current.strength = s; };
  const setSculptMode = (m) => { sculptStateRef.current.mode = m; };
  const setSculptSymmetry = (s) => { sculptStateRef.current.symmetry = s; };

  const disposeObject = (obj) => {
    if (!obj) return;
    obj.traverse((n) => {
      if (n.isMesh) {
        try { n.geometry?.disposeBoundsTree?.(); } catch (e) {}
        try { n.geometry?.dispose?.(); } catch (e) {}
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

  // Helper: ensure a consistent user-group container on the scene
  const getUserGroup = (scene = sceneRef.current) => {
    if (!scene) return null;
    if (!scene._user_group && !scene._userGroup) {
      const g = new THREE.Group();
      g.name = "_user_group";
      scene.add(g);
      scene._userGroup = scene._user_group = g;
    }
    return scene._user_group ?? scene._userGroup;
  };

  // ---------- Init Scene ----------
  useEffect(() => {
    if (!canvasRef.current) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0a1a);
    sceneRef.current = scene;

    const editorGroup = new THREE.Group();
    editorGroup.name = "_editor_group";

    const userGroup = new THREE.Group();
    userGroup.name = "_user_group";

    scene.add(editorGroup);
    scene.add(userGroup);

    sceneRef.current._editorGroup = editorGroup;
    sceneRef.current._userGroup = userGroup;

    const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 2000);
    camera.position.set(3, 3, 6);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, canvas: canvasRef.current });
    renderer.setPixelRatio(window.devicePixelRatio || 1);
    renderer.shadowMap.enabled = true;
    if (THREE.sRGBEncoding) renderer.outputEncoding = THREE.sRGBEncoding;
    rendererRef.current = renderer;

    const orbit = new OrbitControls(camera, renderer.domElement);
    orbit.enableDamping = true;
    orbitRef.current = orbit;

    const transform = new TransformControls(camera, renderer.domElement);
    transform.addEventListener("dragging-changed", (e) => {
      orbit.enabled = !e.value;
      transformDirtyRef.current = e.value;
      if (e.value) {
        try {
          const attached = transformRef.current?.object ?? transform.object;
          if (attached) {
            transformStartRef.current = {
              uuid: attached.uuid,
              pos: attached.position.clone(),
              rot: { x: attached.rotation.x, y: attached.rotation.y, z: attached.rotation.z },
              scale: attached.scale.clone(),
            };
          } else transformStartRef.current = null;
        } catch (err) { transformStartRef.current = null; }

        // Emit transform:started so external modules (Studio / HistoryEngine) can capture "before"
        try {
          const attached = transformRef.current?.object ?? transform.object;
          const ids = attached ? [attached.uuid] : [];
          const before = {};
          if (attached) {
            before[attached.uuid] = {
              position: [attached.position.x, attached.position.y, attached.position.z],
              rotation: [attached.rotation.x, attached.rotation.y, attached.rotation.z],
              scale: [attached.scale.x, attached.scale.y, attached.scale.z],
            };
          }
          EventBus?.emit?.("transform:started", { ids, before });
        } catch (e) { /* ignore */ }
      }
    });

    transform.addEventListener("change", () => updateToolbarPosition());
    transform.addEventListener("mouseUp", () => {
      if (transformDirtyRef.current) {
        try {
          const attached = transformRef.current?.object ?? transform.object;
          if (transformStartRef.current && attached && attached.uuid === transformStartRef.current.uuid) {
            const start = transformStartRef.current;
            const end = {
              uuid: attached.uuid,
              pos: attached.position.clone(),
              rot: { x: attached.rotation.x, y: attached.rotation.y, z: attached.rotation.z },
              scale: attached.scale.clone(),
            };

            cmdHistoryRef.current.push(new Cmd(
              () => {
                const ug = getUserGroup();
                const obj = ug?.getObjectByProperty('uuid', end.uuid);
                if (obj) { obj.position.copy(end.pos); obj.rotation.set(end.rot.x, end.rot.y, end.rot.z); obj.scale.copy(end.scale); }
              },
              () => {
                const ug = getUserGroup();
                const obj = ug?.getObjectByProperty('uuid', start.uuid);
                if (obj) { obj.position.copy(start.pos); obj.rotation.set(start.rot.x, start.rot.y, start.rot.z); obj.scale.copy(start.scale); }
              },
              "transform"
            ));

            // Emit transform:ended with before/after so other modules can produce full TransformCommand
            try {
              const ids = [end.uuid];
              const before = {
                [start.uuid]: {
                  position: [start.pos.x, start.pos.y, start.pos.z],
                  rotation: [start.rot.x, start.rot.y, start.rot.z],
                  scale: [start.scale.x, start.scale.y, start.scale.z],
                }
              };
              const after = {
                [end.uuid]: {
                  position: [end.pos.x, end.pos.y, end.pos.z],
                  rotation: [end.rot.x, end.rot.y, end.rot.z],
                  scale: [end.scale.x, end.scale.y, end.scale.z],
                }
              };
              EventBus?.emit?.("transform:ended", { ids, before, after });
            } catch (e) { /* ignore */ }

            bumpSceneVersion('transform');
          }
        } catch (e) { console.warn("Transform commit failed", e); }
        transformDirtyRef.current = false;
        transformStartRef.current = null;
      }
      if (transformGroupRef.current) {
        try { dissolveTransformGroup(); } catch (e) {}
      }
    });

    editorGroup.add(transform);
    transformRef.current = transform;

    const amb = new THREE.AmbientLight(0xffffff, 0.45);
    amb.name = "_ambient_light";
    const hemi = new THREE.HemisphereLight(0x606080, 0x202020, 0.4);
    hemi.name = "_hemi_light";
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(5, 10, 7.5);
    dirLight.name = "_dir_light";
    editorGroup.add(amb, hemi, dirLight);

    const grid = new THREE.GridHelper(40, 80, 0x33ffcc, 0x5500ff);
    grid.name = "_grid";
    editorGroup.add(grid);
    editorGroup.add(new THREE.AxesHelper(3));

    const selectionBox = new THREE.BoxHelper();
    selectionBox.name = "_selection_box";
    selectionBox.visible = false;
    editorGroup.add(selectionBox);

    const onPointerDown = (event) => {
      if (!rendererRef.current || !cameraRef.current) return;
      if (transformDirtyRef.current) return;
      if (sculptStateRef.current?.active) return; // ignore selection while sculpting

      const rect = rendererRef.current.domElement.getBoundingClientRect();
      mouseRef.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouseRef.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      raycasterRef.current.setFromCamera(mouseRef.current, cameraRef.current);
      const intersects = raycasterRef.current.intersectObjects(sceneRef.current.children, true);

      let foundObj = null;
      for (const it of intersects) {
        const obj = findObjektaAncestor(it.object);
        if (obj) { foundObj = obj; break; }
      }

      if (foundObj) {
        if (event.shiftKey || event.ctrlKey) {
          toggleMultiSelect(foundObj);
        } else {
          clearMultiSelectionIfAny();
          selectObject(foundObj);
          try { transformRef.current.setMode(transformMode); } catch (e) {}
          try { transformRef.current.attach(foundObj); } catch (e) {
            try { const meshChild = foundObj.getObjectByProperty("type", "Mesh"); if (meshChild) transformRef.current.attach(meshChild); } catch (err) {}
          }
          transformDirtyRef.current = true;
        }
      } else {
        clearSelection();
        clearMultiSelectionIfAny();
      }
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
          if (obj) { displayObj = obj; break; }
        }
      }

      if (displayObj) {
        const displayName = displayObj.name || (displayObj.userData && displayObj.userData.name) || "object";
        setHover({
          name: displayName,
          x: clamp(event.clientX - rect.left + 12, 8, rect.width - 120),
          y: clamp(event.clientY - rect.top + 10, 8, rect.height - 28),
        });
      } else {
        setHover({ name: "", x: -999, y: -999 });
      }
    };
    renderer.domElement.addEventListener("pointermove", onPointerMove);

    const onPointerUp = () => {
      if (transformDirtyRef.current) {
        transformDirtyRef.current = false;
      }
    };
    window.addEventListener("pointerup", onPointerUp);

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
        if (obj) { focusObj = obj; break; }
      }

      if (focusObj) {
        const pos = new THREE.Vector3();
        focusObj.getWorldPosition(pos);
        const cam = cameraRef.current;
        const offset = new THREE.Vector3(0, 1.8, 3).applyQuaternion(cam.quaternion);
        cam.position.copy(pos).add(offset);
        orbitRef.current.target.copy(pos);
      }
    };
    renderer.domElement.addEventListener("dblclick", onDblClick);

    // Render loop
    let mounted = true;
    const tick = () => {
      if (!mounted) return;
      requestAnimationFrame(tick);
      orbitRef.current?.update();

      // update selection box
      try {
        const selBox = sceneRef.current._editorGroup.getObjectByName("_selection_box");
        if (selBox && selBox.isBoxHelper) {
          const sel = (selectedInternal && getUserGroup())
            ? (getUserGroup()?.getObjectByProperty?.('uuid', selectedInternal.uuid) || getUserGroup().getObjectByProperty('uuid', selectedInternal.uuid))
            : null;
          if (sel) {
            selBox.setFromObject(sel);
            selBox.visible = !!sel.userData?.__selected;
          } else selBox.visible = false;
        }
      } catch (e) {}

      renderer.render(scene, cameraRef.current);
      const now = Date.now();
      if (now - lastToolbarUpdate.current > THROTTLE_MS) {
        updateToolbarPosition();
        lastToolbarUpdate.current = now;
      }
    };
    tick();

    const doResize = () => {
      if (!containerRef.current) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;
      renderer.setSize(w, h, false);
      cameraRef.current.aspect = w / h;
      cameraRef.current.updateProjectionMatrix();
    };
    window.addEventListener("resize", doResize);
    doResize();

    const onFs = () => onFullScreenChange?.(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFs);

    const onKeyDown = (e) => {
      const cmd = e.ctrlKey || e.metaKey;
      if (cmd && e.key.toLowerCase() === "z") {
        e.preventDefault();
        e.shiftKey ? redo() : undo();
      } else if (cmd && e.key.toLowerCase() === "y") {
        e.preventDefault();
        redo();
      } else if (cmd && e.key.toLowerCase() === "d") {
        e.preventDefault();
        duplicateSelected();
      } else if (e.key === "Delete") {
        deleteSelected();
      }
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

    pushHistorySnapshot("init");

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

    return () => {
      mounted = false;
      clearInterval(autosaveInterval);
      window.removeEventListener("beforeunload", beforeUnload);

      renderer.domElement.removeEventListener("pointerdown", onPointerDown);
      renderer.domElement.removeEventListener("pointermove", onPointerMove);
      renderer.domElement.removeEventListener("dblclick", onDblClick);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("resize", doResize);
      document.removeEventListener("fullscreenchange", onFs);
      window.removeEventListener("keydown", onKeyDown);

      try { transformRef.current?.dispose?.(); } catch (e) {}
      try { orbitRef.current?.dispose?.(); } catch (e) {}
      try { rendererRef.current?.dispose?.(); } catch (e) {}

      try {
        const ug = getUserGroup();
        const toRemove = ug ? Array.from(ug.children) : [];
        toRemove.forEach((c) => {
          try { disposeObject(c); } catch (e) {}
        });
      } catch (err) {}

      // dispose DRACOLoader instance if created
      try { dracoRef.current?.dispose?.(); dracoRef.current = null; } catch (e) {}

      // revoke any created blob URLs (GLTF loads / exports)
      try {
        for (const url of blobUrlsRef.current) {
          try { URL.revokeObjectURL(url); } catch (e) {}
        }
        blobUrlsRef.current.clear();
      } catch (e) {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onFullScreenChange, panelTopOffset]);

  useEffect(() => transformRef.current?.setMode(transformMode), [transformMode]);

  // ---------- Selection ----------
  const selectObject = (obj) => {
    if (!obj) return;
    if (selectedInternal) markSelectionVisual(selectedInternal, false);

    setSelectedInternal(obj);
    onSelect?.(obj);

    try { transformRef.current?.attach(obj); } catch (e) {}
    try { transformRef.current?.setMode(transformMode); } catch (e) {}

    markSelectionVisual(obj, true);
    updateToolbarPosition();
  };

  const clearSelection = () => {
    if (selectedInternal) markSelectionVisual(selectedInternal, false);
    setSelectedInternal(null);
    onSelect?.(null);
    try { transformRef.current?.detach?.(); } catch (e) {}
    setToolbarPos({ x: -999, y: -999 });

    const selBox = sceneRef.current?._editorGroup?.getObjectByName("_selection_box");
    if (selBox) selBox.visible = false;
  };

  const markSelectionVisual = (obj, selectedFlag) => {
    if (!obj) return;

    try {
      const selBox = sceneRef.current?._editorGroup?.getObjectByName("_selection_box");
      if (selBox && selBox.isBoxHelper) {
        if (selectedFlag) {
          selBox.setFromObject(obj);
          selBox.material.color.set(0x7f5af0);
          selBox.visible = true;
        } else {
          selBox.visible = false;
        }
      }
    } catch (err) {}

    // Use WeakMap to remember original material emissive values
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
  };

  // ---------- Multi-select helpers ----------
  const toggleMultiSelect = (obj) => {
    if (!obj) return;
    const set = selectedSetRef.current;
    if (set.has(obj)) {
      set.delete(obj);
      markSelectionVisual(obj, false);
      multiParentMapRef.current.delete(obj.uuid);
      try { SceneGraphStore.removeObject?.(obj.uuid); } catch (e) {}
    } else {
      set.add(obj);
      markSelectionVisual(obj, true);
      try { SceneGraphStore.addObject?.(obj.uuid, obj, { name: obj.name, type: obj.type }); } catch (e) {}
    }

    if (set.size >= 2) {
      createTransformGroupFromSet();
    } else {
      dissolveTransformGroup();
      if (set.size === 1) {
        const first = set.values().next().value;
        if (first) selectObject(first);
      } else {
        clearSelection();
      }
    }
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

  const createTransformGroupFromSet = () => {
    const set = selectedSetRef.current;
    if (set.size < 2) return;
    if (transformGroupRef.current) return;

    const group = new THREE.Group();
    group.name = "_multi_transform_group_" + (nameCountRef.current++);
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
    sceneRef.current.add(group);

    for (const o of Array.from(set)) {
      try {
        multiParentMapRef.current.set(o.uuid, o.parent || sceneRef.current);
        group.attach(o);
      } catch (e) {}
    }

    transformGroupRef.current = group;
    try { transformRef.current.attach(group); } catch (e) {}
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
    if (set.size === 1) {
      const first = set.values().next().value;
      try { transformRef.current.attach(first); } catch (e) {}
      setSelectedInternal(first);
    } else if (set.size === 0) {
      clearSelection();
    } else {
      const first = set.values().next().value;
      if (first) try { transformRef.current.attach(first); } catch (e) {}
    }
  };

  const worldPointAtMouse = (client) => {
    if (!rendererRef.current || !cameraRef.current || !containerRef.current) return new THREE.Vector3(0, 0.5, 0);
    const rect = rendererRef.current.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((client.x - rect.left) / rect.width) * 2 - 1,
      -((client.y - rect.top) / rect.height) * 2 + 1
    );
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

    const makeIcon = (color = 0xffff00, size = 0.06) =>
      new THREE.Mesh(new THREE.SphereGeometry(size, 8, 8), new THREE.MeshBasicMaterial({ color }));

    const parseColor = (c, fallback = 0xffffff) => {
      if (!c) return fallback;
      try { return new THREE.Color(c); } catch (err) { return fallback; }
    };

    switch (name) {
      case "Cube": obj = new THREE.Mesh(new THREE.BoxGeometry(1,1,1), new THREE.MeshStandardMaterial({ color: opts.color ? parseColor(opts.color) : 0xff5555 })); break;
      case "Sphere": obj = new THREE.Mesh(new THREE.SphereGeometry(0.6,32,32), new THREE.MeshStandardMaterial({ color: opts.color ? parseColor(opts.color) : 0x55ff88 })); break;
      case "Plane": obj = new THREE.Mesh(new THREE.PlaneGeometry(4,4), new THREE.MeshStandardMaterial({ color: opts.color ? parseColor(opts.color) : 0x777777, side: THREE.DoubleSide })); obj.rotation.x = -Math.PI/2; break;
      case "Cone": obj = new THREE.Mesh(new THREE.ConeGeometry(0.6,1.5,32), new THREE.MeshStandardMaterial({ color: opts.color ? parseColor(opts.color) : 0xffaa33 })); break;
      case "Cylinder": obj = new THREE.Mesh(new THREE.CylinderGeometry(0.5,0.5,1.5,32), new THREE.MeshStandardMaterial({ color: opts.color ? parseColor(opts.color) : 0x3388ff })); break;
      case "Torus": obj = new THREE.Mesh(new THREE.TorusGeometry(0.7,0.3,16,100), new THREE.MeshStandardMaterial({ color: opts.color ? parseColor(opts.color) : 0xff33aa })); break;
      case "Empty": obj = new THREE.Group(); break;
      case "Axis Helper": obj = new THREE.AxesHelper(2); break;
      case "Point Light": obj = new THREE.PointLight(opts.color ? parseColor(opts.color) : 0xffffff,1,20); obj.add(makeIcon(opts.color ? parseColor(opts.color) : 0xffff66, 0.06)); break;
      case "Spot Light": obj = new THREE.SpotLight(opts.color ? parseColor(opts.color) : 0xffffff,1,30,Math.PI/6); obj.add(makeIcon(opts.color ? parseColor(opts.color) : 0xffcc66,0.06)); break;
      case "Directional Light": obj = new THREE.DirectionalLight(opts.color ? parseColor(opts.color) : 0xffffff,1); obj.position.set(3,5,3); obj.add(makeIcon(opts.color ? parseColor(opts.color) : 0xddddff, 0.06)); break;
      case "Camera": obj = new THREE.PerspectiveCamera(50,1,0.1,2000); obj.userData._isVirtualCamera = true; obj.add(makeIcon(opts.color ? parseColor(opts.color) : 0x66ccff, 0.06)); break;
      default: obj = new THREE.Mesh(new THREE.BoxGeometry(0.6,0.6,0.6), new THREE.MeshStandardMaterial({ color: opts.color ? parseColor(opts.color) : 0x777777 }));
    }

    if (point && point instanceof THREE.Vector3) obj.position.copy(point);
    else obj.position.copy(new THREE.Vector3(0,0.5,0));

    obj.name = name + "_" + nameCountRef.current++;
    obj.userData.__objekta = true;
    obj.traverse((n) => { if (!n.userData) n.userData = {}; n.userData.__objekta = true; });

    const userGroup = getUserGroup();
    if (userGroup) userGroup.add(obj);
    else sceneRef.current.add(obj);

    try { ensureBVHForObject(obj); } catch (e) {}

    // register with SceneGraphStore so Studio/outliner/stats stay in sync
    try {
      SceneGraphStore.addObject?.(obj.uuid, obj, { name: obj.name, type: name });
    } catch (e) { /* ignore if store missing */ }

    // notify listeners
    try { EventBus?.emit?.("scene:updated", { id: obj.uuid, type: "add" }); } catch (e) {}

    selectObject(obj);
    bumpSceneVersion('addItem');

    try {
      const snap = obj.toJSON();
      const uuid = obj.uuid;
      cmdHistoryRef.current.push(new Cmd(
        () => {
          try {
            const loader = new THREE.ObjectLoader();
            const recreated = loader.parse(snap);
            recreated.userData = recreated.userData || {};
            recreated.userData.__objekta = true;
            const ug = getUserGroup();
            if (ug) ug.add(recreated);
            else sceneRef.current.add(recreated);
            ensureBVHForObject(recreated);
            selectObject(recreated);
            bumpSceneVersion('redo-add');
          } catch (e) { console.warn("Redo add failed", e); }
        },
        () => {
          try {
            const ug = getUserGroup();
            const existing = ug?.getObjectByProperty('uuid', uuid);
            if (existing) { disposeObject(existing); if (existing.parent) existing.parent.remove(existing); clearSelection(); bumpSceneVersion('undo-add'); }
          } catch (e) { console.warn("Undo add failed", e); }
        },
        "add"
      ));
    } catch (e) {}

    return obj;
  };

  // ---------- Palette DnD ----------
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
    try { if (node && typeof dropRef === "function") dropRef(node); } catch (err) {}
  };

  // ---------- Local GLB Drop ----------
  useEffect(() => {
    const handleDrop = (e) => {
      e.preventDefault(); e.stopPropagation();
      if (!e.dataTransfer || !e.dataTransfer.files) return;
      const glbFile = Array.from(e.dataTransfer.files).find((f) => f.name.toLowerCase().endsWith('.glb') || f.name.toLowerCase().endsWith('.gltf'));
      if (glbFile) {
        const point = worldPointAtMouse({ x: e.clientX, y: e.clientY });
        addGLTF(glbFile, point).catch(err => console.error('GLTF import failed', err));
      }
    };
    const handleDragOver = (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; };
    const el = containerRef.current; if (!el) return;
    el.addEventListener('drop', handleDrop); el.addEventListener('dragover', handleDragOver);
    return () => { el.removeEventListener('drop', handleDrop); el.removeEventListener('dragover', handleDragOver); };
  }, []);

  // ---------- Add GLTF ----------
  const addGLTF = (input, point = null, onProgress = null) => {
    return new Promise((resolve, reject) => {
      const loader = new GLTFLoader();
      try {
        if (!dracoRef.current) dracoRef.current = new DRACOLoader();
        loader.setDRACOLoader(dracoRef.current);
      } catch (e) {
        // if DRACOLoader unavailable, continue without it
        console.warn("DRACOLoader init failed or missing", e);
      }
      setLoading(true);

      const addNodeToScene = (sceneNode) => {
        try {
          const box = new THREE.Box3().setFromObject(sceneNode);
          const size = box.getSize(new THREE.Vector3());
          const maxDim = Math.max(size.x, size.y, size.z);
          const scale = maxDim > 0 ? 2 / maxDim : 1;
          sceneNode.scale.setScalar(scale);
          sceneNode.updateMatrixWorld(true);

          const boxScaled = new THREE.Box3().setFromObject(sceneNode);
          const center = boxScaled.getCenter(new THREE.Vector3());
          sceneNode.position.sub(center);

          if (point) {
            sceneNode.position.copy(point);
            sceneNode.position.y += boxScaled.getSize(new THREE.Vector3()).y / 2 + 0.05;
          } else {
            sceneNode.position.y += boxScaled.getSize(new THREE.Vector3()).y / 2 + 0.05;
          }

          sceneNode.traverse((child) => {
            if (child.isMesh) {
              if (child.material) {
                try { child.material = Array.isArray(child.material) ? child.material.map(m => m.clone()) : child.material.clone(); } catch (err) { child.material = new THREE.MeshStandardMaterial({ color: 0x888888 }); }
              } else child.material = new THREE.MeshStandardMaterial({ color: 0x888888 });
              child.castShadow = true; child.receiveShadow = true;
            }
            if (!child.userData) child.userData = {};
            child.userData.__objekta = true;
            if (!child.userData.name) child.userData.name = sceneNode.name;
          });

          sceneNode.userData = sceneNode.userData || {};
          sceneNode.userData.__objekta = true;
          sceneNode.name = sceneNode.name || "Imported_" + nameCountRef.current++;

          const userGroup = getUserGroup();
          if (userGroup) userGroup.add(sceneNode);
          else sceneRef.current.add(sceneNode);

          // register all loaded nodes with SceneGraphStore
          try {
            sceneNode.traverse((n) => {
              if (n.userData?.__objekta) {
                try { SceneGraphStore.addObject?.(n.uuid, n, { name: n.name, type: n.type }); } catch (e) {}
              }
            });
          } catch (e) {}

          // notify listeners
          try { EventBus?.emit?.("scene:updated", { id: sceneNode.uuid, type: "import" }); } catch (e) {}

          ensureBVHForObject(sceneNode);
          selectObject(sceneNode);
          bumpSceneVersion('addGLTF');

          try {
            const snap = sceneNode.toJSON();
            const uuid = sceneNode.uuid;
            cmdHistoryRef.current.push(new Cmd(
              () => {
                try {
                  const loader2 = new THREE.ObjectLoader();
                  const recreated = loader2.parse(snap);
                  recreated.userData = recreated.userData || {};
                  recreated.userData.__objekta = true;
                  const ug = getUserGroup();
                  if (ug) ug.add(recreated);
                  else sceneRef.current.add(recreated);
                  ensureBVHForObject(recreated);
                  selectObject(recreated);
                  bumpSceneVersion('redo-import');
                } catch (e) { console.warn("Redo import failed", e); }
              },
              () => {
                try {
                  const ug = getUserGroup();
                  const existing = ug?.getObjectByProperty('uuid', uuid);
                  if (existing) {
                    try { existing.traverse(n => { SceneGraphStore.removeObject?.(n.uuid); }); } catch (e) {}
                    disposeObject(existing); if (existing.parent) existing.parent.remove(existing); clearSelection(); bumpSceneVersion('undo-import');
                  }
                } catch (e) { console.warn("Undo import failed", e); }
              },
              "import"
            ));
          } catch (e) {}

        } catch (err) {
          console.warn("addNodeToScene error", err);
        } finally {
          setLoading(false);
        }
      };

      if (input && input.isObject3D) {
        input.traverse(n => { if (!n.userData) n.userData = {}; n.userData.__objekta = true; });
        addNodeToScene(input);
        resolve(input);
        return;
      }
      if (input && (input.type === 'Scene' || input.children)) {
        input.traverse(n => { if (!n.userData) n.userData = {}; n.userData.__objekta = true; });
        addNodeToScene(input);
        resolve(input);
        return;
      }
      if (!(input instanceof File)) {
        console.error('addGLTF expects a File or a THREE.Object3D');
        setLoading(false);
        reject(new Error('Invalid input to addGLTF'));
        return;
      }

      const url = URL.createObjectURL(input);
      try { blobUrlsRef.current.add(url); } catch (e) {}
      loader.load(url, (gltf) => {
        try {
          const sceneNode = gltf.scene || gltf.scenes?.[0];
          if (!sceneNode) { throw new Error('GLTF has no scene'); }
          addNodeToScene(sceneNode);
          setTimeout(() => { try { URL.revokeObjectURL(url); blobUrlsRef.current.delete(url); } catch (e) {} }, 1500);
          resolve(sceneNode);
        } catch (err) {
          try { URL.revokeObjectURL(url); blobUrlsRef.current.delete(url); } catch (e) {}
          setLoading(false);
          reject(err);
        }
      }, (xhr) => {
        try { if (onProgress && xhr && xhr.loaded && xhr.total) onProgress(xhr.loaded / xhr.total); } catch (e) {}
      }, (err) => {
        try { URL.revokeObjectURL(url); blobUrlsRef.current.delete(url); } catch (e) {}
        setLoading(false);
        reject(err);
      });
    });
  };

  // ---------- Export GLTF (returns Promise<Blob>) ----------
  const exportGLTF = (binary = true) => {
    return new Promise((resolve, reject) => {
      if (!sceneRef.current) { reject(new Error('No scene')); return; }
      const userGroup = getUserGroup();
      const userObjects = userGroup ? Array.from(userGroup.children) : [];

      const exporter = new GLTFExporter();
      const exportScene = new THREE.Scene();

      const isHelperType = (obj) => {
        if (!obj) return false;
        if (obj.name && obj.name.startsWith('_')) return true;
        if (obj.type === 'GridHelper' || obj.type === 'AxesHelper' || obj.type === 'BoxHelper' || obj.type === 'CameraHelper') return true;
        if (obj.userData && obj.userData.__helper) return true;
        return false;
      };

      const pruneHelpers = (root) => {
        const removeList = [];
        root.traverse((n) => { if (isHelperType(n)) removeList.push(n); });
        removeList.forEach((n) => { if (n.parent) n.parent.remove(n); });
      };

      userObjects.forEach((c) => {
        try {
          const clone = c.clone(true);
          pruneHelpers(clone);
          clone.traverse((n) => { if (n.name && n.name.startsWith('_')) { if (n.parent) n.parent.remove(n); } });
          const allowed = ['Mesh','Group','Object3D','PerspectiveCamera','OrthographicCamera','PointLight','DirectionalLight','HemisphereLight','SpotLight','AmbientLight'];
          if (allowed.includes(clone.type) || clone.isMesh || clone.isLight || clone.isCamera) exportScene.add(clone);
          else {
            const group = new THREE.Group();
            clone.traverse((n) => { if (n.isMesh || n.isLight || n.isCamera || n.type === 'Group') group.add(n.clone(true)); });
            if (group.children.length) exportScene.add(group);
          }
        } catch (err) { console.warn('Export: failed to clone object', err); }
      });

      exportScene.updateMatrixWorld(true);

      // embed images so exported GLB is self-contained
      exporter.parse(exportScene, (result) => {
        try {
          let blob;
          if (binary && result instanceof ArrayBuffer) blob = new Blob([result], { type: 'model/gltf-binary' });
          else { const str = JSON.stringify(result, null, 2); blob = new Blob([str], { type: 'application/json' }); }

          // trigger download for compatibility
          const link = document.createElement('a');
          const url = URL.createObjectURL(blob);
          try { blobUrlsRef.current.add(url); } catch (e) {}
          link.href = url;
          link.download = binary ? 'scene.glb' : 'scene.gltf';
          link.click();
          setTimeout(() => { try { URL.revokeObjectURL(url); blobUrlsRef.current.delete(url); } catch (e) {} }, 1500);

          resolve(blob);
        } catch (e) { reject(e); }
      }, { binary, embedImages: true, truncateDrawRange: true });
    });
  };

  // ---------- Snapshot history helpers ----------
  const computeSceneSignature = () => {
    if (!sceneRef.current) return "";
    try {
      const ug = sceneRef.current._user_group ? Array.from(sceneRef.current._user_group.children) : (sceneRef.current._userGroup ? Array.from(sceneRef.current._userGroup.children) : []);
      const objs = ug.filter((c) => c.userData?.__objekta);
      return objs.map((c) => {
        const p = c.position; const r = c.rotation; const s = c.scale;
        let matSig = "";
        c.traverse((n) => {
          if (!matSig && n.isMesh && n.material) {
            try { matSig = Array.isArray(n.material) ? n.material.map(m => m.uuid + (m.color ? m.color.getHexString() : '')).join('|') : n.material.uuid + (n.material.color ? n.material.color.getHexString() : ''); } catch (e) {}
          }
        });
        return `${c.name}|p:${p.x.toFixed(3)},${p.y.toFixed(3)},${p.z.toFixed(3)}|r:${r.x.toFixed(3)},${r.y.toFixed(3)},${r.z.toFixed(3)}|s:${s.x.toFixed(3)},${s.y.toFixed(3)},${s.z.toFixed(3)}|m:${matSig}`;
      }).join('||');
    } catch (e) { return ""; }
  };

  const pushHistorySnapshot = (label = "") => {
    if (!sceneRef.current) return;
    const signature = computeSceneSignature();
    if (signature && lastHistorySignatureRef.current === signature) return;
    lastHistorySignatureRef.current = signature;

    const userGroup = getUserGroup();
    const snaps = userGroup ? Array.from(userGroup.children).filter((c) => c.userData?.__objekta).map((c) => c.toJSON()) : [];
    snapshotHistoryRef.current.push({ label, snaps });
    if (snapshotHistoryRef.current.length > HISTORY_LIMIT) snapshotHistoryRef.current.shift();
    snapshotHistoryIndexRef.current = snapshotHistoryRef.current.length - 1;
    bumpSceneVersion('pushHistorySnapshot');
  };

  const commitHistory = (label = "") => { pushHistorySnapshot(label); bumpSceneVersion('commitHistory'); };
  const commitHistoryDebounced = (label = "") => {
    if (historyDebounceRef.current) clearTimeout(historyDebounceRef.current);
    historyDebounceRef.current = setTimeout(() => { pushHistorySnapshot(label); historyDebounceRef.current = null; }, HISTORY_DEBOUNCE_MS);
  };

  const loadHistory = (entry) => {
    if (!entry || !sceneRef.current) return;
    const userGroup = getUserGroup();
    const toRemove = userGroup ? Array.from(userGroup.children) : [];
    toRemove.forEach((c) => { try { disposeObject(c); } catch (e) {} if (c.parent) c.parent.remove(c); });
    const loader = new THREE.ObjectLoader();
    entry.snaps.forEach((snap) => { try { const obj = loader.parse(snap); obj.userData.__objekta = true; if (userGroup) userGroup.add(obj); else sceneRef.current.add(obj); ensureBVHForObject(obj); } catch (err) { console.error('Failed to parse history snapshot', err); } });
    clearSelection();
    bumpSceneVersion('loadHistory');
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
      loadHistory(snapshotHistoryRef.current[snapshotHistoryIndexRef.current]);
    }
  };

  const deleteSelected = () => {
    if (!selectedInternal || !sceneRef.current) return;
    try {
      try { selectedInternal.traverse(n => { SceneGraphStore.removeObject?.(n.uuid); }); } catch (e) {}
      const snap = selectedInternal.toJSON();
      const uuid = selectedInternal.uuid;
      try { disposeObject(selectedInternal); } catch (e) {}
      if (selectedInternal.parent) selectedInternal.parent.remove(selectedInternal);
      clearSelection();
      bumpSceneVersion('delete');

      try { EventBus?.emit?.("scene:updated", { id: uuid, type: "delete" }); } catch (e) {}

      cmdHistoryRef.current.push(new Cmd(
        () => {
          const ug = getUserGroup();
          const ex = ug?.getObjectByProperty('uuid', uuid);
          if (ex) { disposeObject(ex); if (ex.parent) ex.parent.remove(ex); }
        },
        () => {
          try {
            const loader = new THREE.ObjectLoader();
            const recreated = loader.parse(snap);
            recreated.userData = recreated.userData || {};
            recreated.userData.__objekta = true;
            const ug = getUserGroup();
            if (ug) ug.add(recreated);
            else sceneRef.current.add(recreated);
            try { recreated.traverse(n => { SceneGraphStore.addObject?.(n.uuid, n, { name: n.name, type: n.type }); }); } catch (e) {}
            ensureBVHForObject(recreated);
            bumpSceneVersion('undo-delete');
          } catch (e) { console.warn("Undo delete failed", e); }
        },
        "delete"
      ));
    } catch (e) { console.error(e); }
    commitHistory("delete");
  };

  const duplicateSelected = () => {
    if (!selectedInternal || !sceneRef.current) return;
    try {
      const clone = selectedInternal.clone(true);
      clone.position = clone.position.clone().add(new THREE.Vector3(0.2,0.2,0.2));
      clone.name = (selectedInternal.name || 'clone') + '_dup_' + nameCountRef.current++;
      clone.userData.__objekta = true;
      clone.traverse((n) => { if (n.isMesh && n.material) { try { n.material = Array.isArray(n.material) ? n.material.map(m => m.clone()) : n.material.clone(); } catch (err) {} } });
      const userGroup = getUserGroup();
      if (userGroup) userGroup.add(clone); else sceneRef.current.add(clone);
      ensureBVHForObject(clone);

      try { clone.traverse(n => { SceneGraphStore.addObject?.(n.uuid, n, { name: n.name, type: n.type }); }); } catch (e) {}

      selectObject(clone);
      bumpSceneVersion('duplicate');

      try { EventBus?.emit?.("scene:updated", { id: clone.uuid, type: "duplicate" }); } catch (e) {}

      try {
        const snap = clone.toJSON();
        const uuid = clone.uuid;
        cmdHistoryRef.current.push(new Cmd(
          () => {
            try {
              const loader = new THREE.ObjectLoader();
              const recreated = loader.parse(snap);
              recreated.userData = recreated.userData || {};
              recreated.userData.__objekta = true;
              const ug = getUserGroup();
              if (ug) ug.add(recreated);
              else sceneRef.current.add(recreated);
              try { recreated.traverse(n => { SceneGraphStore.addObject?.(n.uuid, n, { name: n.name, type: n.type }); }); } catch (e) {}
              ensureBVHForObject(recreated);
              bumpSceneVersion('redo-duplicate');
            } catch (e) { console.warn("Redo duplicate failed", e); }
          },
          () => {
            const ug = getUserGroup();
            const ex = ug?.getObjectByProperty('uuid', uuid);
            if (ex) {
              try { ex.traverse(n => { SceneGraphStore.removeObject?.(n.uuid); }); } catch (e) {}
              disposeObject(ex); if (ex.parent) ex.parent.remove(ex); bumpSceneVersion('undo-duplicate');
            }
          },
          "duplicate"
        ));
      } catch (e) {}
      commitHistory('duplicate');
    } catch (err) { console.error('duplicate error', err); }
  };

  // ---------- Toolbar ----------
  const updateToolbarPosition = () => {
    if (!selectedInternal || !cameraRef.current || !rendererRef.current || !containerRef.current) { setToolbarPos({ x:-999, y:-999 }); return; }
    const vector = new THREE.Vector3(); selectedInternal.getWorldPosition(vector); vector.project(cameraRef.current);
    const rect = rendererRef.current.domElement.getBoundingClientRect();
    const leftRaw = (vector.x * 0.5 + 0.5) * rect.width; const topRaw = (-vector.y * 0.5 + 0.5) * rect.height - 40;
    const left = clamp(leftRaw, 8, rect.width - 80); const top = clamp(topRaw, 8, rect.height - 36);
    setToolbarPos({ x: left, y: top });
  };

  // ---------- Scene serialization API ----------
  const serializeScene = () => {
    if (!sceneRef.current) return null;
    const userGroup = getUserGroup();
    const snaps = userGroup ? Array.from(userGroup.children).filter((c) => c.userData?.__objekta).map((c) => c.toJSON()) : [];
    return { snaps };
  };

  const loadFromData = (data) => {
    if (!data || !data.snaps || !sceneRef.current) return;
    const userGroup = getUserGroup();
    const toRemove = userGroup ? Array.from(userGroup.children) : [];
    toRemove.forEach((c) => { if (c.parent) c.parent.remove(c); try { disposeObject(c); } catch (e) {} });
    const loader = new THREE.ObjectLoader();
    data.snaps.forEach((snap) => {
      try {
        const obj = loader.parse(snap);
        obj.userData.__objekta = true;
        if (userGroup) userGroup.add(obj); else sceneRef.current.add(obj);
        ensureBVHForObject(obj);
        try { obj.traverse(n => { SceneGraphStore.addObject?.(n.uuid, n, { name: n.name, type: n.type }); }); } catch (e) {}
      } catch (err) { console.error('Failed to load object from data', err); }
    });
    commitHistory('load');
    bumpSceneVersion('loadFromData');
    try { EventBus?.emit?.("scene:updated", { type: "load" }); } catch (e) {}
  };

  const resetScene = ({ skipConfirm } = {}) => {
    const userGroup = getUserGroup();
    const toRemove = userGroup ? Array.from(userGroup.children) : [];
    toRemove.forEach((c) => { try { disposeObject(c); } catch (e) {} if (c.parent) c.parent.remove(c); });
    snapshotHistoryRef.current = [];
    snapshotHistoryIndexRef.current = -1;
    cmdHistoryRef.current.clear();
    pushHistorySnapshot('reset');
    clearSelection();
    bumpSceneVersion('resetScene');

    try {
      if (SceneGraphStore.clearSelection) SceneGraphStore.clearSelection();
      if (SceneGraphStore.objects) SceneGraphStore.objects = {};
    } catch (e) {}
    try { EventBus?.emit?.("scene:updated", { type: "reset" }); } catch (e) {}
  };

  // ---------- Helpers used by ObjectProperties ----------
  const renameSelected = (name) => {
    if (!selectedInternal) return;
    selectedInternal.name = name;
    commitHistory('rename');
    bumpSceneVersion('rename');
    try { SceneGraphStore.renameObject?.(selectedInternal.uuid, name); } catch (e) {}
    try { EventBus?.emit?.("scene:updated", { id: selectedInternal.uuid, type: "rename" }); } catch (e) {}
  };

  // ---------- Transform batching (throttle / debounce) ----------
  const pendingTransformRef = useRef({ position: false, rotation: false, scale: false });
  const transformFlushTimerRef = useRef(null);
  const TRANSFORM_FLUSH_MS = 100; // coalesce updates into 100ms windows (tweakable)

  const handleTransformChange = (prop, axis, val) => {
    if (!selectedInternal) return;
    if (!["position","rotation","scale"].includes(prop)) return;
    const axes = ['x','y','z']; let idx = axis;
    if (typeof axis === 'string') idx = axes.indexOf(axis);
    else if (typeof axis === 'number') idx = axis;
    if (typeof idx !== 'number' || idx < 0 || idx > 2) return;
    const key = axes[idx];

    try {
      if (prop === 'rotation') selectedInternal.rotation[key] = val;
      else selectedInternal[prop][key] = val;
    } catch (e) { /* ignore */ }

    pendingTransformRef.current[prop] = true;
    if (transformFlushTimerRef.current) clearTimeout(transformFlushTimerRef.current);
    transformFlushTimerRef.current = setTimeout(() => {
      try { commitHistoryDebounced('prop-change'); } catch (e) {}
      try { bumpSceneVersion('prop-change'); } catch (e) {}
      pendingTransformRef.current = { position: false, rotation: false, scale: false };
      transformFlushTimerRef.current = null;
    }, TRANSFORM_FLUSH_MS);
  };

  const toggleSnap = (enable) => {
    const transform = transformRef.current; if (!transform) return; if (typeof enable === 'boolean') snapRef.current.enabled = enable; else snapRef.current.enabled = !snapRef.current.enabled;
    if (snapRef.current.enabled) { transform.setTranslationSnap(snapRef.current.value); transform.setRotationSnap(THREE.MathUtils.degToRad(15)); } else { transform.setTranslationSnap(null); transform.setRotationSnap(null); }
  };

  const setSnapValue = (val) => { snapRef.current.value = val; if (snapRef.current.enabled && transformRef.current) transformRef.current.setTranslationSnap(snapRef.current.value); };

  // ---------- Validation helpers & scene summary ----------
  const getSceneSummary = () => {
    const scene = sceneRef.current;
    if (!scene) return { totalTris: 0, objects: 0, objectsList: [] };
    const userGroup = getUserGroup();
    const objs = userGroup ? Array.from(userGroup.children) : [];
    let totalTris = 0;
    const objectsList = objs.map(o => {
      let tris = 0;
      o.traverse(n => {
        if (n.isMesh && n.geometry) {
          try {
            if (n.geometry.index) tris += n.geometry.index.count / 3;
            else if (n.geometry.attributes && n.geometry.attributes.position) tris += n.geometry.attributes.position.count / 3;
          } catch (e) {}
        }
      });
      totalTris += tris;
      return { uuid: o.uuid, name: o.name, tris: Math.round(tris) };
    });
    return { totalTris: Math.round(totalTris), objects: objectsList.length, objectsList };
  };

  const validateSceneAPI = async () => {
    try {
      const data = serializeScene();
      return { ok: true, summary: getSceneSummary() };
    } catch (e) {
      return { ok: false, error: e.message || String(e) };
    }
  };

  // ---------- API ----------
  useImperativeHandle(ref, () => ({
    addItem, addGLTF, exportGLTF, undo, redo, deleteSelected,
    setTransformMode: (mode) => setTransformModeState(mode),
    serializeScene, loadFromData, resetScene,
    onResize: () => { if (!containerRef.current || !rendererRef.current || !cameraRef.current) return; const w = containerRef.current.clientWidth; const h = containerRef.current.clientHeight; rendererRef.current.setSize(w, h, false); cameraRef.current.aspect = w / h; cameraRef.current.updateProjectionMatrix(); },
    renameSelected, handleTransformChange, toggleSnap, setSnapValue, duplicateSelected,
    selectObject,
    // sculpt API (real implementations)
    startSculpting: (mesh = null, opts = {}) => {
      const target = mesh || selectedInternal;
      if (!target) {
        console.warn('startSculpting: no target mesh');
        return false;
      }
      return startSculptingInternal(target, opts);
    },
    stopSculpting: () => {
      stopSculptingInternal();
    },
    setSculptRadius, setSculptStrength, setSculptMode, setSculptSymmetry,
    validateScene: validateSceneAPI,
    getSceneSummary,
    getSceneObjects: () => {
      const ug = getUserGroup();
      return ug ? Array.from(ug.children) : [];
    },
    getSceneVersion: () => sceneVersionRef.current,
    get scene() { return sceneRef.current; },
  }));

  try {
    window.__OBJEKTA_WORKSPACE = {
      addItem, addGLTF, exportGLTF, undo, redo,
      getScene: () => sceneRef.current, getRenderer: () => rendererRef.current, getCamera: () => cameraRef.current,
      selectObject: (o) => selectObject(o), serializeScene, validateScene: validateSceneAPI, getSceneSummary
    };
  } catch (e) {}

  // ---------- Panels: Outliner + Properties (inside workspace for fallback UI) ----------
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

      // initial
      scanOnce();

      const iv = setInterval(() => {
        const ver = sceneVersionRef.current;
        if (ver !== lastVer.current) {
          lastVer.current = ver;
          scanOnce();
        }
      }, 600);

      return () => { mounted = false; clearInterval(iv); };
    }, []);

    const toggleVisibility = (obj) => { obj.visible = !obj.visible; commitHistory('vis-toggle'); bumpSceneVersion('visibility'); };
    const removeObject = (obj) => { try { disposeObject(obj); } catch (e) {} if (obj.parent) obj.parent.remove(obj); commitHistory('delete'); bumpSceneVersion('removeObject'); };
    const renameObject = (obj) => { const nv = prompt('Rename object', obj.name || ''); if (nv && nv !== obj.name) { obj.name = nv; commitHistory('rename'); bumpSceneVersion('renameObject'); } };

    return (
      <div style={{ overflowY: 'auto', padding: 8, height: '100%' }}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>Scene Outliner</div>
        {items.map((it) => (
          <div key={it.uuid} style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '6px 8px', borderRadius: 8,
            background: it.userData?.__selected ? 'rgba(127,90,240,0.12)' : 'transparent',
            marginBottom: 6
          }}>
            <div style={{ flex: 1, cursor: 'pointer' }}
              onClick={(e) => { if (e.ctrlKey || e.metaKey) { toggleMultiSelect(it); } else { onPrimarySelect(it); } }}>
              {it.name}
            </div>
            <button title="Rename" onClick={() => renameObject(it)}>✎</button>
            <button title="Toggle visibility" onClick={() => toggleVisibility(it)}>{it.visible ? '👁' : '🚫'}</button>
            <button title="Delete" onClick={() => { if (confirm('Delete object?')) removeObject(it); }}>🗑</button>
          </div>
        ))}
      </div>
    );
  };

  const PropertiesPanelInner = ({ selected }) => {
    const [nameVal, setNameVal] = useState('');
    const [color, setColor] = useState('#777777');
    const [roughness, setRoughness] = useState(0.5);
    const [metalness, setMetalness] = useState(0.0);

    useEffect(() => {
      if (!selected) return;
      setNameVal(selected.name || '');
      let foundCol = null;
      selected.traverse((n) => {
        if (n.isMesh && n.material && !foundCol) {
          const mat = Array.isArray(n.material) ? n.material[0] : n.material;
          if (mat && mat.color) foundCol = '#' + mat.color.getHexString();
          if (mat && typeof mat.roughness === 'number') setRoughness(mat.roughness);
          if (mat && typeof mat.metalness === 'number') setMetalness(mat.metalness);
        }
      });
      if (foundCol) setColor(foundCol);
    }, [selected]);

    const applyName = (v) => { if (!selected) return; selected.name = v; commitHistory('rename'); bumpSceneVersion('renameProp'); };
    const applyColor = (hex) => {
      if (!selected) return;
      selected.traverse((n) => {
        if (n.isMesh && n.material) {
          try {
            const mats = Array.isArray(n.material) ? n.material : [n.material];
            mats.forEach((m) => { if (m.color) m.color.set(hex); });
          } catch (e) {}
        }
      });
      commitHistory('material-color');
      bumpSceneVersion('materialColor');
    };
    const applyRoughMetal = (r, m) => {
      if (!selected) return;
      selected.traverse((n) => {
        if (n.isMesh && n.material) {
          try {
            const mats = Array.isArray(n.material) ? n.material : [n.material];
            mats.forEach((mat) => {
              if (typeof r === 'number' && typeof mat.roughness === 'number') mat.roughness = r;
              if (typeof m === 'number' && typeof mat.metalness === 'number') mat.metalness = m;
            });
          } catch (e) {}
        }
      });
      commitHistory('material-prop');
      bumpSceneVersion('materialProp');
    };

    if (!selected) return <div style={{ padding: 12 }}>No selection</div>;

    return (
      <div style={{ padding: 8, overflowY: 'auto', height: '100%' }}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>Properties</div>

        <div style={{ marginBottom: 8 }}>
          <label style={{ display: 'block', fontSize: 12 }}>Name</label>
          <input value={nameVal} onChange={(e) => setNameVal(e.target.value)} onBlur={() => applyName(nameVal)} style={{ width: '100%' }} />
        </div>

        <div style={{ marginBottom: 8 }}>
          <label style={{ display: 'block', fontSize: 12 }}>Color</label>
          <input type="color" value={color} onChange={(e) => { setColor(e.target.value); applyColor(e.target.value); }} />
        </div>

        <div style={{ marginBottom: 8 }}>
          <label style={{ display: 'block', fontSize: 12 }}>Roughness: {roughness.toFixed(2)}</label>
          <input type="range" min="0" max="1" step="0.01" value={roughness} onChange={(e) => { const v = parseFloat(e.target.value); setRoughness(v); applyRoughMetal(v, metalness); }} style={{ width: '100%' }} />
        </div>

        <div style={{ marginBottom: 8 }}>
          <label style={{ display: 'block', fontSize: 12 }}>Metalness: {metalness.toFixed(2)}</label>
          <input type="range" min="0" max="1" step="0.01" value={metalness} onChange={(e) => { const v = parseFloat(e.target.value); setMetalness(v); applyRoughMetal(roughness, v); }} style={{ width: '100%' }} />
        </div>

        <div style={{ marginTop: 12 }}>
          <button onClick={() => { selected.visible = !selected.visible; commitHistory('vis-toggle'); bumpSceneVersion('propVisibility'); }}>{selected.visible ? 'Hide' : 'Show'}</button>
          <button style={{ marginLeft: 8 }} onClick={() => { if (confirm('Delete selection?')) { try { disposeObject(selected); } catch (e) {} if (selected.parent) selected.parent.remove(selected); clearSelection(); commitHistory('delete'); bumpSceneVersion('propDelete'); } }}>Delete</button>
        </div>
      </div>
    );
  };

  // Panel container uses panelTopOffset prop so host (Studio) can reserve toolbar space
  const PanelContainerInner = () => {
    const [tab, setTab] = useState('outliner');
    const topValue = typeof panelTopOffset === 'number' ? panelTopOffset : 12;
    return (
      <div style={{ position: 'absolute', right: 12, top: topValue, width: 320, bottom: 12, display: 'flex', flexDirection: 'column', zIndex: 60, gap: 8, pointerEvents: 'auto' }}>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={() => setTab('outliner')} style={{ flex: 1, padding: 8, background: tab === 'outliner' ? 'rgba(127,90,240,0.16)' : 'rgba(0,0,0,0.4)' }}>Outliner</button>
          <button onClick={() => setTab('props')} style={{ flex: 1, padding: 8, background: tab === 'props' ? 'rgba(127,90,240,0.16)' : 'rgba(0,0,0,0.4)' }}>Properties</button>
        </div>
        <div style={{ flex: 1, background: 'linear-gradient(180deg, rgba(0,0,0,0.25), rgba(0,0,0,0.18))', borderRadius: 10, overflow: 'hidden' }}>
          {tab === 'outliner' ? <OutlinerPanelInner onPrimarySelect={(o) => selectObject(o)} /> : <PropertiesPanelInner selected={selectedInternal} />}
        </div>
      </div>
    );
  };

  // ---------- Render ----------
  return (
    <div ref={setContainerNode} className="relative flex-1 w-full h-full overflow-hidden" data-objekta-root>
      <canvas ref={canvasRef} className="w-full h-full" />

      {loading && (
        <div className="absolute inset-0 z-50 flex items-center justify-center pointer-events-none">
          <div style={{ background: "rgba(0,0,0,0.6)", padding: 16, borderRadius: 10 }}>
            <div style={{ color: "#fff", fontSize: 13 }}>Loading model...</div>
          </div>
        </div>
      )}

      {hover.name && (
        <div aria-hidden style={{ position: "absolute", left: hover.x, top: hover.y, transform: "translate(-0%, -100%)", pointerEvents: "none", background: "rgba(0,0,0,0.7)", color: "#fff", padding: "6px 8px", borderRadius: 6, fontSize: 12, zIndex: 30, whiteSpace: "nowrap", boxShadow: "0 8px 20px rgba(0,0,0,0.5)" }}>
          {hover.name}
        </div>
      )}

      {selectedInternal && (
        <div className="absolute bg-black/60 text-white px-2 py-1 rounded-md text-sm z-40" style={{ left: toolbarPos.x, top: toolbarPos.y, transform: "translate(-50%,-100%)", pointerEvents: "auto", minWidth: 120, display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={() => setTransformModeState("translate")} title="Move">↔</button>
            <button onClick={() => setTransformModeState("rotate")} title="Rotate">⤾</button>
            <button onClick={() => setTransformModeState("scale")} title="Scale">⇲</button>
            <button onClick={duplicateSelected} title="Duplicate (Ctrl/Cmd+D)">⧉</button>
          </div>
          <div className="truncate" style={{ maxWidth: 220, fontSize: 12 }}>{selectedInternal.name}</div>
        </div>
      )}

      {isOver && (<div className="absolute inset-0 border-2 border-dashed border-green-500 pointer-events-none" />)}

      <PanelContainerInner />
    </div>
  );
});

export default Workspace;
