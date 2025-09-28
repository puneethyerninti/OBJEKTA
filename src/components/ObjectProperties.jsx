// src/components/ObjectProperties.jsx
import React, { useCallback, useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import "../styles/ObjectProperties.css"; // <- new stylesheet

/* (Everything else in the component is functionally unchanged;
   only inline styling was moved to CSS classes.) */

const CLIP_KEY = "objekta_transform_clipboard_v3";
const MAT_CLIP_KEY = "objekta_material_clipboard_v1";
const PRESET_PREFIX = "objekta_mat_preset_";
const ACCENT = "#7f5af0";

const MAP_SLOTS = [
  { key: "map", label: "Base Color" },
  { key: "normalMap", label: "Normal Map" },
  { key: "roughnessMap", label: "Roughness Map" },
  { key: "metalnessMap", label: "Metalness Map" },
  { key: "emissiveMap", label: "Emissive Map" },
  { key: "aoMap", label: "AO Map" },
];

// color helpers (same as before)
const clamp = (v, a = 0, b = 255) => Math.min(Math.max(v, a), b);

function hexToRgb(hex) {
  if (!hex) return { r: 136, g: 136, b: 136 };
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = parseInt(full, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function rgbToHex(r, g, b) {
  return (
    "#" +
    [r, g, b]
      .map((v) => Math.round(clamp(v)).toString(16).padStart(2, "0"))
      .join("")
  );
}

function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0, l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
      default: break;
    }
    h /= 6;
  }
  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

function hslToRgb(h, s, l) {
  h = ((h % 360) + 360) % 360;
  s /= 100; l /= 100;
  if (s === 0) {
    const v = Math.round(l * 255);
    return { r: v, g: v, b: v };
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const hk = h / 360;
  const tc = (t) => {
    let x = hk + t;
    if (x < 0) x += 1;
    if (x > 1) x -= 1;
    if (x < 1 / 6) return p + (q - p) * 6 * x;
    if (x < 1 / 2) return q;
    if (x < 2 / 3) return p + (q - p) * (2 / 3 - x) * 6;
    return p;
  };
  return {
    r: Math.round(tc(1 / 3) * 255),
    g: Math.round(tc(0) * 255),
    b: Math.round(tc(-1 / 3) * 255),
  };
}

export default function ObjectPropertiesTexture({
  selected,
  onTransformChange,
  onMaterialChange,
  onApplyTexture,
  onApplyGLB,
  onRemoveTexture,
  onVisibilityToggle,
  onDelete,
  onRename,
}) {
  // TRANSFORM / UI
  const [name, setName] = useState("");
  const [visible, setVisible] = useState(true);
  const [position, setPosition] = useState({ x: 0, y: 0, z: 0 });
  const [rotation, setRotation] = useState({ x: 0, y: 0, z: 0 });
  const [scale, setScale] = useState({ x: 1, y: 1, z: 1 });
  const [useDegrees, setUseDegrees] = useState(true);
  const [uniformScale, setUniformScale] = useState(false);
  const [localSpace, setLocalSpace] = useState(true);

  // MATERIAL
  const [hex, setHex] = useState("#888888");
  const [rgb, setRgb] = useState({ r: 136, g: 136, b: 136 });
  const [hsl, setHsl] = useState({ h: 0, s: 0, l: 53 });
  const [roughness, setRoughness] = useState(0.5);
  const [metalness, setMetalness] = useState(0.0);
  const [opacity, setOpacity] = useState(1.0);
  const [emissiveHex, setEmissiveHex] = useState("#000000");
  const [emissiveIntensity, setEmissiveIntensity] = useState(1.0);
  const [wireframe, setWireframe] = useState(false);
  const [normalScale, setNormalScale] = useState(1.0);
  const [aoIntensity, setAoIntensity] = useState(1.0);
  const [invertRoughness, setInvertRoughness] = useState(false);
  const [invertMetalness, setInvertMetalness] = useState(false);

  // TEXTURES
  const mapsRef = useRef({});
  const [mapVersion, setMapVersion] = useState(0);

  // loaders & misc
  const textureLoaderRef = useRef(null);
  const gltfLoaderRef = useRef(null);
  const mountedRef = useRef(true);
  const pendingRef = useRef({ position: {}, rotation: {}, scale: {} });
  const flushTimerRef = useRef(null);
  const materialTimerRef = useRef(null);
  const dragActiveRef = useRef(false);
  const [dragActive, setDragActive] = useState(false);

  // file input ids
  const fileIdsRef = useRef({});
  MAP_SLOTS.forEach((s) => {
    if (!fileIdsRef.current[s.key]) fileIdsRef.current[s.key] = `obj-prop-${s.key}-${Math.random().toString(36).slice(2,9)}`;
  });
  const glbIdRef = useRef(`obj-prop-glb-${Math.random().toString(36).slice(2,9)}`);

  // undo/redo (serializable snapshots)
  const materialUndoRef = useRef([]);
  const materialRedoRef = useRef([]);
  const MAT_UNDO_LIMIT = 30;

  // presets + preview
  const [presetList, setPresetList] = useState([]);
  const [previewUrl, setPreviewUrl] = useState(null);

  // helpers
  const toNum = useCallback((v,d=0)=> {
    const n = typeof v === "number" && Number.isFinite(v) ? Number(v) : d;
    return Number(n.toFixed(4));
  }, []);

  const safeHex = useCallback((h) => {
    if (!h) return "#888888";
    const s = String(h).trim();
    if (s[0] === "#") return s;
    if (/^[0-9A-Fa-f]{3}$/.test(s) || /^[0-9A-Fa-f]{6}$/.test(s)) return `#${s}`;
    return "#888888";
  }, []);

  // init loaders
  useEffect(() => {
    try { textureLoaderRef.current = new THREE.TextureLoader(); } catch (e) { textureLoaderRef.current = null; }
    try { gltfLoaderRef.current = new GLTFLoader(); } catch (e) { gltfLoaderRef.current = null; }
    return () => { textureLoaderRef.current = null; gltfLoaderRef.current = null; };
  }, []);

  // sync when selected changes (revokes previous blob urls to avoid leaks)
  const materialSnapshot = useRef(null);
  useEffect(() => {
    mountedRef.current = true;

    // revoke blob urls from previous selection to avoid leaks
    try {
      Object.values(mapsRef.current || {}).forEach((m) => {
        if (m && m.url && m.file) {
          try { URL.revokeObjectURL(m.url); } catch (e) {}
        }
      });
    } catch (e) {}

    if (!selected) {
      // reset
      setName(""); setVisible(true);
      setPosition({ x: 0, y: 0, z: 0 });
      setRotation({ x: 0, y: 0, z: 0 });
      setScale({ x: 1, y: 1, z: 1 });
      setHex("#888888"); setRgb({ r: 136, g: 136, b: 136 }); setHsl(rgbToHsl(136, 136, 136));
      setRoughness(0.5); setMetalness(0); setOpacity(1); setEmissiveHex("#000000"); setEmissiveIntensity(1); setWireframe(false);
      mapsRef.current = {}; setMapVersion(v => v+1);
      materialUndoRef.current = []; materialRedoRef.current = [];
      materialSnapshot.current = null;
      return;
    }

    setName(selected.name || "");
    setVisible(selected.visible ?? true);
    setPosition({ x: toNum(selected.position?.x ?? 0), y: toNum(selected.position?.y ?? 0), z: toNum(selected.position?.z ?? 0) });
    setScale({ x: toNum(selected.scale?.x ?? 1, 1), y: toNum(selected.scale?.y ?? 1, 1), z: toNum(selected.scale?.z ?? 1, 1) });
    if (useDegrees) {
      setRotation({ x: toNum((selected.rotation?.x ?? 0) * (180/Math.PI)), y: toNum((selected.rotation?.y ?? 0) * (180/Math.PI)), z: toNum((selected.rotation?.z ?? 0) * (180/Math.PI)) });
    } else {
      setRotation({ x: toNum(selected.rotation?.x ?? 0), y: toNum(selected.rotation?.y ?? 0), z: toNum(selected.rotation?.z ?? 0) });
    }

    // extract material from first mesh
    try {
      let foundMat = null;
      selected.traverse((c) => {
        if (foundMat) return;
        if (c.isMesh && c.material) {
          foundMat = Array.isArray(c.material) ? c.material[0] : c.material;
        }
      });

      const ms = {};
      let snapValues = {
        hex: "#888888", roughness: 0.5, metalness: 0, opacity: 1,
        emissiveHex: "#000000", emissiveIntensity: 1, wireframe: false, normalScale: 1, aoIntensity: 1
      };

      if (foundMat) {
        try {
          if (foundMat.color) {
            const hx = `#${foundMat.color.getHexString()}`;
            snapValues.hex = hx;
            const rgbv = hexToRgb(hx);
            snapValues.rgb = rgbv;
            snapValues.hsl = rgbToHsl(rgbv.r, rgbv.g, rgbv.b);
            setHex(hx); setRgb(rgbv); setHsl(snapValues.hsl);
          }
        } catch (e) {}

        if (typeof foundMat.roughness === "number") { snapValues.roughness = foundMat.roughness; setRoughness(foundMat.roughness); }
        if (typeof foundMat.metalness === "number") { snapValues.metalness = foundMat.metalness; setMetalness(foundMat.metalness); }
        if (typeof foundMat.opacity === "number") { snapValues.opacity = foundMat.opacity; setOpacity(foundMat.opacity); }
        if (foundMat.emissive) try { const em = `#${foundMat.emissive.getHexString()}`; snapValues.emissiveHex = em; setEmissiveHex(em); } catch (e) {}
        if (typeof foundMat.wireframe === "boolean") { snapValues.wireframe = foundMat.wireframe; setWireframe(foundMat.wireframe); }
        if (foundMat.normalScale) { snapValues.normalScale = foundMat.normalScale.x || 1; setNormalScale(foundMat.normalScale.x || 1); }

        MAP_SLOTS.forEach((slot) => {
          const k = slot.key;
          let t = foundMat[k];
          if (t) {
            ms[k] = {
              url: (t.image && (t.image.currentSrc || t.image.src)) || null,
              texture: t,
              settings: {
                repeatX: t.repeat?.x ?? 1,
                repeatY: t.repeat?.y ?? 1,
                offsetX: t.offset?.x ?? 0,
                offsetY: t.offset?.y ?? 0,
                rotation: t.rotation ?? 0,
                flipH: false,
                flipV: false,
                wrap: 'repeat',
                filter: 'linear',
              }
            };
          }
        });
        mapsRef.current = ms;
        setMapVersion(v => v + 1);
      } else {
        mapsRef.current = {};
        setMapVersion(v => v + 1);
      }

      // fresh snapshot built from foundMat values
      materialSnapshot.current = {
        ...snapValues,
        maps: JSON.parse(JSON.stringify(Object.fromEntries(Object.entries(mapsRef.current || {}).map(([k,v])=>[k,{url:v?.url,settings:v.settings}]))))
      };
    } catch (e) {
      mapsRef.current = {};
      setMapVersion(v => v + 1);
      materialSnapshot.current = null;
    }

    materialUndoRef.current = []; materialRedoRef.current = [];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, useDegrees, toNum]);

  // TRANSFORM batching
  const flushPending = useCallback(() => {
    if (!mountedRef.current) return;
    const p = pendingRef.current;
    try {
      for (const prop of ["position", "rotation", "scale"]) {
        const obj = p[prop];
        if (!obj) continue;
        for (const axis of Object.keys(obj)) {
          const val = obj[axis];
          if (typeof onTransformChange === "function") onTransformChange(prop, axis, val);
          else {
            try {
              if (selected) {
                if (prop === "rotation") selected.rotation[axis] = val;
                else selected[prop][axis] = val;
                selected.updateMatrixWorld?.();
              }
            } catch (e) {}
          }
        }
        pendingRef.current[prop] = {};
      }
    } catch (e) {}
  }, [onTransformChange, selected]);

  const scheduleFlush = useCallback(() => {
    if (flushTimerRef.current) clearTimeout(flushTimerRef.current);
    flushTimerRef.current = setTimeout(() => { flushTimerRef.current = null; flushPending(); }, 80);
  }, [flushPending]);

  const queueTransform = useCallback((prop, axis, uiValue) => {
    if (!prop || !axis) return;
    let sendVal = uiValue;
    if (prop === "rotation" && useDegrees) sendVal = (uiValue * Math.PI) / 180;
    if (!pendingRef.current[prop]) pendingRef.current[prop] = {};
    pendingRef.current[prop][axis] = Number(sendVal || 0);
    scheduleFlush();
  }, [scheduleFlush, useDegrees]);

  const handleInputChange = useCallback((prop, axis) => (e) => {
    const raw = e.target.value; const parsed = raw === '' ? 0 : parseFloat(raw);
    if (prop === 'position') setPosition((s) => ({...s, [axis]: isNaN(parsed) ? 0 : parsed}));
    else if (prop === 'rotation') setRotation((s) => ({...s, [axis]: isNaN(parsed) ? 0 : parsed}));
    else if (prop === 'scale') {
      if (uniformScale) { const v = isNaN(parsed) ? 0 : parsed; setScale({x:v,y:v,z:v}); queueTransform('scale','x',v); queueTransform('scale','y',v); queueTransform('scale','z',v); return; }
      else setScale((s) => ({...s, [axis]: isNaN(parsed) ? 0 : parsed}));
    }
    queueTransform(prop, axis, isNaN(parsed) ? 0 : parsed);
  }, [queueTransform, uniformScale]);

  // MATERIAL apply (debounced)
  const applyMaterialPatch = useCallback((patch = {}) => {
    try {
      selected?.traverse((n) => {
        if (n.isMesh && n.material) {
          const mats = Array.isArray(n.material) ? n.material : [n.material];
          mats.forEach((m) => {
            try {
              if (patch.hex && m.color) m.color.set(patch.hex);
              if (typeof patch.roughness === 'number' && typeof m.roughness === 'number') m.roughness = (patch.invertRoughness ? 1 - patch.roughness : patch.roughness);
              if (typeof patch.metalness === 'number' && typeof m.metalness === 'number') m.metalness = (patch.invertMetalness ? 1 - patch.metalness : patch.metalness);
              if (typeof patch.opacity === 'number') { m.opacity = patch.opacity; m.transparent = patch.opacity < 1; }
              if (patch.emissiveHex && m.emissive) { m.emissive.set(patch.emissiveHex); if (typeof patch.emissiveIntensity === 'number' && m.emissiveIntensity !== undefined) m.emissiveIntensity = patch.emissiveIntensity; }
              if (typeof patch.wireframe === 'boolean') m.wireframe = patch.wireframe;
              if (typeof patch.normalScale === 'number' && m.normalScale) m.normalScale = new THREE.Vector2(patch.normalScale, patch.normalScale);
              if (typeof patch.aoIntensity === 'number' && m.aoMap) { /* AO intensity often used in shader - left for host */ }
              m.needsUpdate = true;
            } catch (e) {}
          });
        }
      });
    } catch (e) {}

    try { if (typeof onMaterialChange === 'function') onMaterialChange({ hex, roughness, metalness, opacity, emissiveHex, emissiveIntensity, normalScale, aoIntensity, ...patch }); } catch (e) {}
  }, [selected, onMaterialChange, hex, roughness, metalness, opacity, emissiveHex, emissiveIntensity, normalScale, aoIntensity]);

  const scheduleMaterialApply = useCallback((patch = {}) => {
    if (materialTimerRef.current) clearTimeout(materialTimerRef.current);
    materialTimerRef.current = setTimeout(() => {
      materialTimerRef.current = null;
      applyMaterialPatch(patch);
    }, 120);
  }, [applyMaterialPatch]);

  // snapshots (undo/redo)
  const snapshotMaterialState = useCallback((label = 'mat-edit') => {
    try {
      const snap = {
        hex, roughness, metalness, opacity, emissiveHex, emissiveIntensity, wireframe, normalScale, aoIntensity,
        maps: JSON.parse(JSON.stringify(Object.fromEntries(Object.entries(mapsRef.current || {}).map(([k,v]) => [k, { url: v?.url || null, settings: v?.settings || {} }])))),
        label,
      };
      materialUndoRef.current.push(snap);
      if (materialUndoRef.current.length > MAT_UNDO_LIMIT) materialUndoRef.current.shift();
      materialRedoRef.current = [];
    } catch (e) {}
  }, [hex, roughness, metalness, opacity, emissiveHex, emissiveIntensity, wireframe, normalScale, aoIntensity]);

  const applySnapshotToMaterial = useCallback((snap) => {
    if (!snap) return;
    try {
      setHex(snap.hex || "#888888");
      if (snap.hex) { const rgbv = hexToRgb(snap.hex); setRgb(rgbv); setHsl(rgbToHsl(rgbv.r, rgbv.g, rgbv.b)); }
      setRoughness(typeof snap.roughness === 'number' ? snap.roughness : 0.5);
      setMetalness(typeof snap.metalness === 'number' ? snap.metalness : 0);
      setOpacity(typeof snap.opacity === 'number' ? snap.opacity : 1);
      setEmissiveHex(snap.emissiveHex || "#000000");
      setEmissiveIntensity(typeof snap.emissiveIntensity === 'number' ? snap.emissiveIntensity : 1.0);
      setWireframe(!!snap.wireframe);
      setNormalScale(typeof snap.normalScale === 'number' ? snap.normalScale : 1);
      setAoIntensity(typeof snap.aoIntensity === 'number' ? snap.aoIntensity : 1);

      // restore maps metadata and attempt to load them
      const ms = {};
      for (const k of Object.keys(snap.maps || {})) {
        const entry = snap.maps[k];
        if (entry && entry.url) {
          ms[k] = { url: entry.url, file: null, texture: null, settings: entry.settings || {} };
          try {
            const url = entry.url;
            if (textureLoaderRef.current) {
              textureLoaderRef.current.load(url, (tex) => {
                try {
                  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
                  const s = ms[k].settings || {};
                  if (tex.repeat) tex.repeat.set(s.repeatX ?? 1, s.repeatY ?? 1);
                  if (tex.offset) tex.offset.set(s.offsetX ?? 0, s.offsetY ?? 0);
                  if (typeof tex.rotation === 'number') tex.rotation = s.rotation ?? 0;
                  tex.center = tex.center || new THREE.Vector2(0.5, 0.5);
                  tex.needsUpdate = true;
                  // apply to selected materials
                  selected?.traverse((n) => { if (n.isMesh && n.material) {
                    const mats = Array.isArray(n.material) ? n.material : [n.material];
                    mats.forEach(m => { try { m[k] = tex; m.needsUpdate = true; } catch(e){} });
                  }});
                  mapsRef.current = { ...(mapsRef.current || {}), [k]: { ...ms[k], texture: tex } };
                  setMapVersion(v => v + 1);
                } catch (e) {}
              });
            }
          } catch (e) {}
        }
      }
      mapsRef.current = { ...(mapsRef.current || {}), ...ms };
      setMapVersion(v => v + 1);
      if (typeof onMaterialChange === 'function') onMaterialChange({ hex: snap.hex, roughness: snap.roughness, metalness: snap.metalness, opacity: snap.opacity });
    } catch (e) {}
  }, [selected, onMaterialChange]);

  const matUndo = useCallback(() => {
    if (!materialUndoRef.current.length) return;
    try {
      const snap = materialUndoRef.current.pop();
      materialRedoRef.current.push({
        hex, roughness, metalness, opacity, emissiveHex, emissiveIntensity, wireframe, normalScale,
        maps: JSON.parse(JSON.stringify(Object.fromEntries(Object.entries(mapsRef.current || {}).map(([k,v]) => [k, { url: v?.url || null, settings: v?.settings || {} }]))))
      });
      applySnapshotToMaterial(snap);
    } catch (e) {}
  }, [applySnapshotToMaterial, hex, roughness, metalness, opacity, emissiveHex, emissiveIntensity, wireframe, normalScale]);

  const matRedo = useCallback(() => {
    if (!materialRedoRef.current.length) return;
    try {
      const snap = materialRedoRef.current.pop();
      materialUndoRef.current.push({
        hex, roughness, metalness, opacity, emissiveHex, emissiveIntensity, wireframe, normalScale,
        maps: JSON.parse(JSON.stringify(Object.fromEntries(Object.entries(mapsRef.current || {}).map(([k,v]) => [k, { url: v?.url || null, settings: v?.settings || {} }]))))
      });
      applySnapshotToMaterial(snap);
    } catch (e) {}
  }, [applySnapshotToMaterial, hex, roughness, metalness, opacity, emissiveHex, emissiveIntensity, wireframe, normalScale]);

  // APPLY MAP FILE (local)
  const applyMapFile = useCallback(async (file, slotKey) => {
    if (!file || !slotKey) return;
    snapshotMaterialState('apply-map');

    if (typeof onApplyTexture === 'function') {
      try { onApplyTexture(file, slotKey); } catch (e) {}
      return;
    }

    const url = URL.createObjectURL(file);
    const entry = { url, file, texture: null, settings: { repeatX: 1, repeatY: 1, offsetX: 0, offsetY: 0, rotation: 0, flipH: false, flipV: false, wrap: 'repeat', filter: 'linear' } };

    // revoke previous blob for this slot if we created it
    try {
      const old = mapsRef.current?.[slotKey];
      if (old && old.file && old.url) {
        try { URL.revokeObjectURL(old.url); } catch (e) {}
      }
    } catch (e) {}

    mapsRef.current = { ...(mapsRef.current || {}), [slotKey]: entry };
    setMapVersion(v => v + 1);

    try {
      const loader = textureLoaderRef.current;
      if (loader && loader.load) {
        loader.load(url, (tex) => {
          try {
            const s = entry.settings;
            if (s.wrap === 'repeat') { tex.wrapS = tex.wrapT = THREE.RepeatWrapping; }
            else if (s.wrap === 'clamp') { tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping; }
            else if (s.wrap === 'mirror') { tex.wrapS = tex.wrapT = THREE.MirroredRepeatWrapping; }
            if (tex.repeat) tex.repeat.set(s.repeatX, s.repeatY);
            if (tex.offset) tex.offset.set(s.offsetX, s.offsetY);
            if (typeof tex.rotation === 'number') tex.rotation = s.rotation || 0;
            tex.center = tex.center || new THREE.Vector2(0.5, 0.5);
            if (s.filter === 'nearest') tex.minFilter = THREE.NearestFilter;
            else if (s.filter === 'mipmap') tex.minFilter = THREE.LinearMipMapLinearFilter;
            else tex.minFilter = THREE.LinearFilter;
            tex.needsUpdate = true;

            mapsRef.current = { ...(mapsRef.current || {}), [slotKey]: { ...entry, texture: tex } };

            // apply to selected materials
            selected?.traverse((n) => {
              if (n.isMesh && n.material) {
                const mats = Array.isArray(n.material) ? n.material : [n.material];
                mats.forEach((m) => {
                  try {
                    m[slotKey] = tex;
                    if (slotKey === 'normalMap') m.normalScale = m.normalScale || new THREE.Vector2(normalScale, normalScale);
                    if (slotKey === 'roughnessMap' && typeof m.roughness === 'undefined') m.roughness = 1;
                    if (slotKey === 'metalnessMap' && typeof m.metalness === 'undefined') m.metalness = 0;
                    m.needsUpdate = true;
                  } catch (e) {}
                });
              }
            });

            setMapVersion(v => v + 1);
            if (typeof onMaterialChange === 'function') onMaterialChange({ texture: true });
          } catch (e) {
            try { if (entry.file) URL.revokeObjectURL(url); } catch (e) {}
          }
        }, undefined, (err) => {
          console.warn("texture load failed", err);
          try { if (entry.file) URL.revokeObjectURL(url); } catch (e) {}
        });
      } else {
        mapsRef.current = { ...(mapsRef.current || {}), [slotKey]: entry };
        setMapVersion(v => v + 1);
      }
    } catch (e) {
      try { if (entry.file) URL.revokeObjectURL(url); } catch (e) {}
    }
  }, [onApplyTexture, selected, snapshotMaterialState, normalScale, onMaterialChange]);

  const revokeBlobIfNeeded = (url, slotKey) => {
    try {
      const entry = mapsRef.current?.[slotKey];
      if (entry && entry.file) { try { URL.revokeObjectURL(url); } catch (e) {} }
    } catch (e) {}
  };

  const removeMap = useCallback((slotKey) => {
    snapshotMaterialState('remove-map');
    const cur = mapsRef.current || {};
    const entry = cur[slotKey];
    if (!entry) return;
    try {
      if (typeof onRemoveTexture === 'function') onRemoveTexture(slotKey);
      if (entry.texture) { try { entry.texture.dispose?.(); } catch (e) {} }
      selected?.traverse((n) => {
        if (n.isMesh && n.material) {
          const mats = Array.isArray(n.material) ? n.material : [n.material];
          mats.forEach((m) => { try { m[slotKey] = null; m.needsUpdate = true; } catch (e) {} });
        }
      });
    } catch (e) {}
    try { if (entry && entry.file && entry.url) URL.revokeObjectURL(entry.url); } catch (e) {}
    delete mapsRef.current[slotKey];
    setMapVersion(v => v + 1);
    if (typeof onMaterialChange === 'function') onMaterialChange({ texture: false });
  }, [onRemoveTexture, selected, snapshotMaterialState, onMaterialChange]);

  const updateMapSettings = useCallback((slotKey, patch) => {
    if (!slotKey) return;
    snapshotMaterialState('map-settings');
    const cur = mapsRef.current || {};
    const entry = cur[slotKey];
    if (!entry) return;
    entry.settings = { ...(entry.settings || {}), ...patch };

    if (entry.texture) {
      try {
        const t = entry.texture;
        const s = entry.settings || {};
        const fx = s.flipH ? -1 : 1;
        const fy = s.flipV ? -1 : 1;
        if (t.repeat) t.repeat.set((s.repeatX ?? 1) * fx, (s.repeatY ?? 1) * fy);
        if (t.offset) t.offset.set(s.offsetX ?? 0, s.offsetY ?? 0);
        if (typeof t.rotation === 'number') t.rotation = s.rotation ?? 0;
        if (s.wrap === 'repeat') { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
        else if (s.wrap === 'clamp') { t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; }
        else if (s.wrap === 'mirror') { t.wrapS = t.wrapT = THREE.MirroredRepeatWrapping; }
        if (s.filter === 'nearest') t.minFilter = THREE.NearestFilter;
        else if (s.filter === 'mipmap') t.minFilter = THREE.LinearMipMapLinearFilter;
        else t.minFilter = THREE.LinearFilter;

        t.center = t.center || new THREE.Vector2(0.5, 0.5);
        t.needsUpdate = true;

        selected?.traverse((n) => { if (n.isMesh && n.material) {
          const mats = Array.isArray(n.material) ? n.material : [n.material];
          mats.forEach(m => { try { m[slotKey] = t; m.needsUpdate = true; } catch(e){} });
        }});
      } catch (e) {}
    }

    mapsRef.current = { ...(mapsRef.current || {}), [slotKey]: entry };
    setMapVersion(v => v + 1);
    if (typeof onMaterialChange === 'function') onMaterialChange({ color: hex, roughness, metalness, opacity });
  }, [selected, snapshotMaterialState, hex, roughness, metalness, opacity, onMaterialChange]);

  // GLB import
  const applyGLBFile = useCallback(async (file) => {
    if (!file) return;
    if (typeof onApplyGLB === 'function') { try { onApplyGLB(file); } catch (e) {} return; }
    const url = URL.createObjectURL(file);
    const loader = gltfLoaderRef.current;
    if (!loader) { URL.revokeObjectURL(url); return; }
    try {
      loader.load(url, (gltf) => {
        try {
          const scene = gltf.scene || gltf.scenes?.[0];
          if (!scene) return;
          if (selected && (selected.isMesh || selected.isGroup)) {
            selected.clear?.();
            scene.children.forEach((c) => { selected.add(c.clone()); });
          }
          URL.revokeObjectURL(url);
        } catch (e) { URL.revokeObjectURL(url); }
      }, undefined, (err) => { console.warn('glb load failed', err); URL.revokeObjectURL(url); });
    } catch (e) { try { URL.revokeObjectURL(url); } catch(_) {} }
  }, [onApplyGLB, selected]);

  // drag/drop handlers
  const onDrop = useCallback((e) => {
    e.preventDefault();
    setDragActive(false);
    const items = e.dataTransfer?.files || [];
    for (let i = 0; i < items.length; i++) {
      const f = items[i];
      const name = (f.name || "").toLowerCase();
      if (name.endsWith(".glb") || name.endsWith(".gltf")) { applyGLBFile(f); }
      else {
        let slot = "map";
        if (name.includes("normal") || name.includes("nrm")) slot = "normalMap";
        else if (name.includes("rough")) slot = "roughnessMap";
        else if (name.includes("metal")) slot = "metalnessMap";
        else if (name.includes("emiss") || name.includes("emit")) slot = "emissiveMap";
        else if (name.includes("ao")) slot = "aoMap";
        applyMapFile(f, slot);
      }
    }
  }, [applyGLBFile, applyMapFile]);

  const onDragOver = useCallback((e) => { e.preventDefault(); }, []);
  const onDragEnter = useCallback((e) => { e.preventDefault(); dragActiveRef.current = true; setDragActive(true); }, []);
  const onDragLeave = useCallback((e) => { e.preventDefault(); dragActiveRef.current = false; setTimeout(()=>{ if (!dragActiveRef.current) setDragActive(false); }, 120); }, []);

  // keyboard shortcuts
  useEffect(() => {
    const onKey = (e) => {
      const meta = e.ctrlKey || e.metaKey;
      if (meta && e.key.toLowerCase() === "z") { e.preventDefault(); matUndo(); }
      if (meta && (e.key.toLowerCase() === "y" || (e.shiftKey && e.key.toLowerCase() === "z"))) { e.preventDefault(); matRedo(); }
      if (e.key === "Escape" && previewUrl) { setPreviewUrl(null); } // ESC closes preview
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [matUndo, matRedo, previewUrl]);

  // cleanup on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (flushTimerRef.current) { clearTimeout(flushTimerRef.current); flushTimerRef.current = null; }
      if (materialTimerRef.current) { clearTimeout(materialTimerRef.current); materialTimerRef.current = null; }
      try {
        Object.values(mapsRef.current || {}).forEach((m) => { if (m && m.url && m.file) { try { URL.revokeObjectURL(m.url); } catch(e) {} } });
      } catch (e) {}
    };
  }, []);

  // Presets: load/save/delete
  const loadPresets = useCallback(() => {
    try {
      const keys = Object.keys(localStorage).filter(k => k.startsWith(PRESET_PREFIX));
      setPresetList(keys.map(k => ({ key: k, name: k.replace(PRESET_PREFIX, "") })));
    } catch (e) {}
  }, []);
  useEffect(() => { loadPresets(); }, [loadPresets]);

  const savePreset = (name) => {
    try {
      if (!name || !name.trim()) name = `preset-${Date.now()}`;
      const payload = {
        hex, roughness, metalness, opacity, emissiveHex, emissiveIntensity, normalScale, aoIntensity,
        invertRoughness, invertMetalness,
        maps: JSON.parse(JSON.stringify(Object.fromEntries(Object.entries(mapsRef.current || {}).map(([k,v])=>[k,{url:v?.url,settings:v.settings}]))))
      };
      localStorage.setItem(PRESET_PREFIX + name, JSON.stringify(payload));
      loadPresets();
    } catch (e) {}
  };

  const applyPreset = (key) => {
    try {
      const s = localStorage.getItem(key);
      if (!s) return;
      const p = JSON.parse(s);
      if (p.hex) { setHex(p.hex); const rgbv = hexToRgb(p.hex); setRgb(rgbv); setHsl(rgbToHsl(rgbv.r, rgbv.g, rgbv.b)); }
      if (typeof p.roughness === 'number') setRoughness(p.roughness);
      if (typeof p.metalness === 'number') setMetalness(p.metalness);
      if (typeof p.opacity === 'number') setOpacity(p.opacity);
      if (p.emissiveHex) setEmissiveHex(p.emissiveHex);
      if (typeof p.emissiveIntensity === 'number') setEmissiveIntensity(p.emissiveIntensity);
      if (typeof p.normalScale === 'number') setNormalScale(p.normalScale);
      if (typeof p.aoIntensity === 'number') setAoIntensity(p.aoIntensity);
      if (typeof p.invertRoughness === 'boolean') setInvertRoughness(p.invertRoughness);
      if (typeof p.invertMetalness === 'boolean') setInvertMetalness(p.invertMetalness);
      scheduleMaterialApply(p);
    } catch (e) {}
  };

  const deletePreset = (key) => {
    try { localStorage.removeItem(key); loadPresets(); } catch (e) {}
  };

  // reset & revert helpers
  const resetMaterial = useCallback(() => {
    setHex("#888888"); setRgb({ r: 136, g: 136, b: 136 }); setHsl(rgbToHsl(136, 136, 136));
    setRoughness(0.5); setMetalness(0); setOpacity(1); setEmissiveHex("#000000"); setEmissiveIntensity(1);
    setWireframe(false); setNormalScale(1); setAoIntensity(1);
    scheduleMaterialApply();
  }, [scheduleMaterialApply]);

  const revertMaterial = useCallback(() => {
    if (!materialSnapshot.current) return;
    const s = materialSnapshot.current;
    if (s.hex) { setHex(s.hex); const rgbv = hexToRgb(s.hex); setRgb(rgbv); setHsl(rgbToHsl(rgbv.r, rgbv.g, rgbv.b)); }
    if (typeof s.roughness === 'number') setRoughness(s.roughness);
    if (typeof s.metalness === 'number') setMetalness(s.metalness);
    if (typeof s.opacity === 'number') setOpacity(s.opacity);
    if (s.emissiveHex) setEmissiveHex(s.emissiveHex);
    if (typeof s.emissiveIntensity === 'number') setEmissiveIntensity(s.emissiveIntensity);
    if (typeof s.normalScale === 'number') setNormalScale(s.normalScale);
    if (typeof s.aoIntensity === 'number') setAoIntensity(s.aoIntensity);
    scheduleMaterialApply();
  }, [scheduleMaterialApply]);

  // color sync handlers
  useEffect(() => {
    try {
      const rgbv = hexToRgb(hex);
      setRgb(rgbv);
      setHsl(rgbToHsl(rgbv.r, rgbv.g, rgbv.b));
    } catch (e) {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hex]);

  const onRgbChange = (patch) => {
    const nx = { ...rgb, ...patch };
    setRgb(nx);
    const hx = rgbToHex(nx.r, nx.g, nx.b);
    setHex(hx);
    setHsl(rgbToHsl(nx.r, nx.g, nx.b));
    scheduleMaterialApply({ hex: hx });
  };

  const onHslChange = (patch) => {
    const nx = { ...hsl, ...patch };
    setHsl(nx);
    const rgbv = hslToRgb(nx.h || 0, nx.s || 0, nx.l || 0);
    setRgb(rgbv);
    const hx = rgbToHex(rgbv.r, rgbv.g, rgbv.b);
    setHex(hx);
    scheduleMaterialApply({ hex: hx });
  };

  // preview modal
  const openPreview = (url) => { setPreviewUrl(url); };
  const closePreview = () => { setPreviewUrl(null); };

  // Numeric component moved to use CSS class
  const Numeric = ({ value, onChange, step = 0.1, min, max, ariaLabel }) => (
    <input className="op-numeric" type="number" step={step} value={value} onChange={onChange} min={min} max={max} aria-label={ariaLabel} />
  );

  // UI collapsible state
  const [openTransform, setOpenTransform] = useState(true);
  const [openMaterial, setOpenMaterial] = useState(true);
  const [openTextures, setOpenTextures] = useState(true);

  // main render
  return selected ? (
    <div className={`op-container ${dragActive ? "drag-active" : ""}`} onDrop={onDrop} onDragOver={onDragOver} onDragEnter={onDragEnter} onDragLeave={onDragLeave}>

      {/* Header */}
      <div className="op-header">
        <input
          className="op-name-input"
          type="text"
          value={name}
          onChange={(e) => { setName(e.target.value); try { if (selected) selected.name = e.target.value; } catch(e){} if (typeof onRename === 'function') onRename(e.target.value); }}
          placeholder="Object name"
        />
        <label className="op-visible-label">
          <input type="checkbox" checked={visible} onChange={(e) => { setVisible(e.target.checked); try { if (selected) selected.visible = e.target.checked; } catch (e) {} if (typeof onVisibilityToggle === 'function') onVisibilityToggle(e.target.checked); }} />
          <span>Visible</span>
        </label>
        <div className="op-header-actions">
          <button className="op-btn" title="Undo" onClick={() => matUndo()}>↶</button>
          <button className="op-btn" title="Redo" onClick={() => matRedo()}>↷</button>
          <button className="op-btn op-btn-danger" title="Delete" onClick={() => onDelete && onDelete()}>Delete</button>
        </div>
      </div>

      {/* Transform */}
      <div className="op-panel">
        <div className="op-panel-header">
          <button className="op-collapse" onClick={() => setOpenTransform(v => !v)}>{openTransform ? '▾' : '▸'}</button>
          <strong>Transform</strong>

          <div className="op-panel-right">
            <button className="op-small-btn" onClick={() => { const rotRad = { x: useDegrees ? rotation.x*Math.PI/180 : rotation.x, y: useDegrees ? rotation.y*Math.PI/180 : rotation.y, z: useDegrees ? rotation.z*Math.PI/180 : rotation.z }; const payload = { position, rotation: rotRad, scale }; localStorage.setItem(CLIP_KEY, JSON.stringify(payload)); }}>Copy</button>
            <button className="op-small-btn" onClick={() => { try { const s = localStorage.getItem(CLIP_KEY); if (!s) return; const raw = JSON.parse(s); setPosition({ x: toNum(raw.position.x), y: toNum(raw.position.y), z: toNum(raw.position.z) }); setScale({ x: toNum(raw.scale.x,1), y: toNum(raw.scale.y,1), z: toNum(raw.scale.z,1) }); if (useDegrees) { setRotation({ x: toNum(raw.rotation.x*180/Math.PI), y: toNum(raw.rotation.y*180/Math.PI), z: toNum(raw.rotation.z*180/Math.PI) }); queueTransform('rotation','x', raw.rotation.x*180/Math.PI); queueTransform('rotation','y', raw.rotation.y*180/Math.PI); queueTransform('rotation','z', raw.rotation.z*180/Math.PI); } else { setRotation({ x: toNum(raw.rotation.x), y: toNum(raw.rotation.y), z: toNum(raw.rotation.z) }); queueTransform('rotation','x', raw.rotation.x); queueTransform('rotation','y', raw.rotation.y); queueTransform('rotation','z', raw.rotation.z); } queueTransform('position','x', raw.position.x); queueTransform('position','y', raw.position.y); queueTransform('position','z', raw.position.z); queueTransform('scale','x', raw.scale.x); queueTransform('scale','y', raw.scale.y); queueTransform('scale','z', raw.scale.z); } catch (e){} }}>Paste</button>

            <input id={glbIdRef.current} type="file" accept="model/gltf,model/glb,.gltf,.glb" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; if (f) applyGLBFile(f); e.target.value=''; }} />
            <button className="op-small-btn" onClick={() => document.getElementById(glbIdRef.current)?.click()}>Import .glb</button>
          </div>
        </div>

        {openTransform && (
          <div className="op-transform-body">
            <div className="op-transform-left">
              <div className="op-transform-row">
                <label className="op-transform-label">Pos</label>
                <Numeric value={position.x} onChange={handleInputChange('position','x')} />
                <Numeric value={position.y} onChange={handleInputChange('position','y')} />
                <Numeric value={position.z} onChange={handleInputChange('position','z')} />
              </div>

              <div className="op-transform-row">
                <label className="op-transform-label">Rot</label>
                <Numeric value={rotation.x} onChange={handleInputChange('rotation','x')} />
                <Numeric value={rotation.y} onChange={handleInputChange('rotation','y')} />
                <Numeric value={rotation.z} onChange={handleInputChange('rotation','z')} />
                <label className="op-inline-checkbox"><input type="checkbox" checked={useDegrees} onChange={(e) => setUseDegrees(e.target.checked)} />deg</label>
              </div>

              <div className="op-transform-row">
                <label className="op-transform-label">Scl</label>
                <Numeric value={scale.x} onChange={handleInputChange('scale','x')} />
                <Numeric value={scale.y} onChange={handleInputChange('scale','y')} />
                <Numeric value={scale.z} onChange={handleInputChange('scale','z')} />
                <label className="op-inline-checkbox"><input type="checkbox" checked={uniformScale} onChange={(e) => setUniformScale(e.target.checked)} />uniform</label>
              </div>
            </div>

            <div className="op-transform-right">
              <label className="op-small-label">Space</label>
              <label className="op-inline-checkbox"><input type="checkbox" checked={localSpace} onChange={(e) => setLocalSpace(e.target.checked)} />Local</label>
            </div>
          </div>
        )}
      </div>

      {/* Material */}
      <div className="op-panel">
        <div className="op-panel-header">
          <button className="op-collapse" onClick={() => setOpenMaterial(v => !v)}>{openMaterial ? '▾' : '▸'}</button>
          <strong>Material</strong>
          <div className="op-panel-right">
            <button className="op-small-btn" onClick={() => { snapshotMaterialState('copy-mat'); try { localStorage.setItem(MAT_CLIP_KEY, JSON.stringify({ hex, roughness, metalness, opacity, emissiveHex })); } catch (e) {} }}>Copy Mat</button>
            <button className="op-small-btn" onClick={() => { try { const s = localStorage.getItem(MAT_CLIP_KEY); if (!s) return; const raw = JSON.parse(s); if (raw.hex) setHex(raw.hex); if (typeof raw.roughness === 'number') setRoughness(raw.roughness); if (typeof raw.metalness === 'number') setMetalness(raw.metalness); if (typeof raw.opacity === 'number') setOpacity(raw.opacity); if (raw.emissiveHex) setEmissiveHex(raw.emissiveHex); if (typeof onMaterialChange === 'function') onMaterialChange(raw); } catch (e) {} }}>Paste Mat</button>
            <label className="op-inline-checkbox">
              <input type="checkbox" checked={wireframe} onChange={(e) => { setWireframe(e.target.checked); scheduleMaterialApply({ wireframe: e.target.checked }); try { selected?.traverse(n => { if (n.isMesh && n.material) { const mats = Array.isArray(n.material) ? n.material : [n.material]; mats.forEach(m => { try { m.wireframe = e.target.checked; m.needsUpdate = true; } catch (e) {} }); } }); } catch (e) {} }} />
              <span>Wireframe</span>
            </label>
          </div>
        </div>

        {openMaterial && (
          <div className="op-material-body">
            <div className="op-color-block">
              <input className="op-color-swatch" type="color" value={hex} onChange={(e) => { setHex(e.target.value); scheduleMaterialApply({ hex: e.target.value }); }} />
              <div className="op-color-controls">
                <input className="op-text" value={hex.toUpperCase()} onChange={(e) => setHex(e.target.value)} onBlur={() => { const h = safeHex(hex); setHex(h); scheduleMaterialApply({ hex: h }); }} />
                <div className="op-rgb-row">
                  <label>R</label><Numeric value={rgb.r} onChange={(e) => onRgbChange({ r: Number(e.target.value || 0) })} step={1} min={0} max={255} />
                  <label>G</label><Numeric value={rgb.g} onChange={(e) => onRgbChange({ g: Number(e.target.value || 0) })} step={1} min={0} max={255} />
                  <label>B</label><Numeric value={rgb.b} onChange={(e) => onRgbChange({ b: Number(e.target.value || 0) })} step={1} min={0} max={255} />
                </div>
                <div className="op-hsl-row">
                  <label>H</label><Numeric value={hsl.h} onChange={(e) => onHslChange({ h: Number(e.target.value || 0) })} step={1} min={0} max={360} />
                  <label>S</label><Numeric value={hsl.s} onChange={(e) => onHslChange({ s: Number(e.target.value || 0) })} step={1} min={0} max={100} />
                  <label>L</label><Numeric value={hsl.l} onChange={(e) => onHslChange({ l: Number(e.target.value || 0) })} step={1} min={0} max={100} />
                </div>
              </div>
            </div>

            <div className="op-slider-block">
              <label>Roughness {roughness.toFixed(2)}</label>
              <input className="op-range" type="range" min="0" max="1" step="0.01" value={roughness} onChange={(e) => { const r = Number(e.target.value); setRoughness(r); scheduleMaterialApply({ roughness: r, invertRoughness }); }} />
              <label className="op-inline-checkbox"><input type="checkbox" checked={invertRoughness} onChange={(e) => { setInvertRoughness(e.target.checked); scheduleMaterialApply({ invertRoughness: e.target.checked, roughness }); }} /> Invert Roughness</label>
            </div>

            <div className="op-slider-block">
              <label>Metalness {metalness.toFixed(2)}</label>
              <input className="op-range" type="range" min="0" max="1" step="0.01" value={metalness} onChange={(e) => { const m = Number(e.target.value); setMetalness(m); scheduleMaterialApply({ metalness: m, invertMetalness }); }} />
              <label className="op-inline-checkbox"><input type="checkbox" checked={invertMetalness} onChange={(e) => { setInvertMetalness(e.target.checked); scheduleMaterialApply({ invertMetalness: e.target.checked, metalness }); }} /> Invert Metalness</label>
            </div>

            <div className="op-slider-block">
              <label>Opacity {opacity.toFixed(2)}</label>
              <input className="op-range" type="range" min="0" max="1" step="0.01" value={opacity} onChange={(e) => { const o = Number(e.target.value); setOpacity(o); scheduleMaterialApply({ opacity: o }); }} />
            </div>

            <div className="op-emissive-block">
              <label>Emissive</label>
              <input className="op-color-swatch small" type="color" value={emissiveHex} onChange={(e) => { setEmissiveHex(e.target.value); scheduleMaterialApply({ emissiveHex: e.target.value, emissiveIntensity }); }} />
              <label>Intensity {emissiveIntensity.toFixed(2)}</label>
              <input className="op-range" type="range" min="0" max="5" step="0.01" value={emissiveIntensity} onChange={(e) => { const v = Number(e.target.value); setEmissiveIntensity(v); scheduleMaterialApply({ emissiveIntensity: v, emissiveHex }); }} />
            </div>

            <div className="op-slider-block">
              <label>Normal Strength {normalScale.toFixed(2)}</label>
              <input className="op-range" type="range" min="0" max="4" step="0.01" value={normalScale} onChange={(e) => { const v = Number(e.target.value); setNormalScale(v); scheduleMaterialApply({ normalScale: v }); }} />
              <label>AO Intensity {aoIntensity.toFixed(2)}</label>
              <input className="op-range" type="range" min="0" max="2" step="0.01" value={aoIntensity} onChange={(e) => { const v = Number(e.target.value); setAoIntensity(v); scheduleMaterialApply({ aoIntensity: v }); }} />
            </div>
          </div>
        )}
      </div>

      {/* Presets panel */}
      <div className="op-presets-row">
        <input id="preset-name" className="op-text" placeholder="Preset name" />
        <button className="op-small-btn" onClick={() => { const n = document.getElementById('preset-name')?.value || `preset-${Date.now()}`; savePreset(n); }}>Save Preset</button>
        <select className="op-select" onChange={(e) => { if (!e.target.value) return; applyPreset(e.target.value); e.target.value = ""; }} defaultValue="">
          <option value="">Load Preset</option>
          {presetList.map(p => <option key={p.key} value={p.key}>{p.name}</option>)}
        </select>
      </div>

      {/* Textures */}
      <div className={`op-panel ${dragActive ? "op-drag-active" : ""}`}>
        <div className="op-panel-header">
          <button className="op-collapse" onClick={() => setOpenTextures(v => !v)}>{openTextures ? '▾' : '▸'}</button>
          <strong>Textures</strong>
          <div className="op-panel-right note">Tip: drag & drop images or .glb onto this panel</div>
        </div>

        {openTextures && (
          <div className="op-textures-body">
            {MAP_SLOTS.map(slot => {
              const s = mapsRef.current?.[slot.key] || null;
              return (
                <div key={slot.key} className="op-texture-slot">
                  <div className="op-texture-left">
                    <div className="op-texture-label" style={{ color: ACCENT }}>{slot.label}</div>
                    <div className="op-texture-actions">
                      <input id={fileIdsRef.current[slot.key]} type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; if (f) applyMapFile(f, slot.key); e.target.value = ''; }} />
                      <button className="op-small-btn" onClick={() => document.getElementById(fileIdsRef.current[slot.key])?.click()}>Upload</button>
                      {s && s.url ? (
                        <img src={s.url} alt={slot.key} className="op-thumb" onClick={() => openPreview(s.url)} />
                      ) : (
                        <div className="op-thumb-empty">—</div>
                      )}
                    </div>
                  </div>

                  <div className="op-texture-right">
                    <div className="op-texture-row">
                      <label>Tile X</label><Numeric value={(s?.settings?.repeatX ?? 1)} onChange={(e) => updateMapSettings(slot.key, { repeatX: Number(e.target.value || 1) })} step={0.1} min={0.01} />
                      <label>Tile Y</label><Numeric value={(s?.settings?.repeatY ?? 1)} onChange={(e) => updateMapSettings(slot.key, { repeatY: Number(e.target.value || 1) })} step={0.1} min={0.01} />
                    </div>

                    <div className="op-texture-row">
                      <label>Offset X</label><Numeric value={(s?.settings?.offsetX ?? 0)} onChange={(e) => updateMapSettings(slot.key, { offsetX: Number(e.target.value || 0) })} step={0.01} />
                      <label>Offset Y</label><Numeric value={(s?.settings?.offsetY ?? 0)} onChange={(e) => updateMapSettings(slot.key, { offsetY: Number(e.target.value || 0) })} step={0.01} />
                    </div>

                    <div className="op-texture-row">
                      <label>Rot</label><Numeric value={(s?.settings?.rotation ?? 0)} onChange={(e) => updateMapSettings(slot.key, { rotation: Number(e.target.value || 0) })} step={1} />
                      <label>Wrap</label>
                      <select className="op-select" value={(s?.settings?.wrap || 'repeat')} onChange={(e) => updateMapSettings(slot.key, { wrap: e.target.value })}>
                        <option value="repeat">Repeat</option>
                        <option value="clamp">ClampToEdge</option>
                        <option value="mirror">MirroredRepeat</option>
                      </select>
                      <label>Filter</label>
                      <select className="op-select" value={(s?.settings?.filter || 'linear')} onChange={(e) => updateMapSettings(slot.key, { filter: e.target.value })}>
                        <option value="linear">Linear</option>
                        <option value="nearest">Nearest</option>
                        <option value="mipmap">Mipmap</option>
                      </select>

                      <label className="op-inline-checkbox">Flip H <input type="checkbox" checked={!!(s?.settings?.flipH)} onChange={(e) => updateMapSettings(slot.key, { flipH: e.target.checked })} /></label>
                      <label className="op-inline-checkbox">Flip V <input type="checkbox" checked={!!(s?.settings?.flipV)} onChange={(e) => updateMapSettings(slot.key, { flipV: e.target.checked })} /></label>

                      <button className="op-small-btn" onClick={() => removeMap(slot.key)}>Remove</button>
                    </div>
                  </div>
                </div>
              );
            })}

            <div className="op-hint">Tip: Drag textures or a .glb file onto this panel. Filenames with "normal", "rough", "metal", "ao", or "emiss" will auto-route.</div>
          </div>
        )}
      </div>

      {/* Preview modal */}
      {previewUrl && (
        <div className="op-preview-overlay" onClick={closePreview}>
          <div className="op-preview-box" onClick={(e) => e.stopPropagation()}>
            <img src={previewUrl} alt="preview" className="op-preview-img" />
            <div className="op-preview-actions">
              <button className="op-small-btn" onClick={(e) => { e.stopPropagation(); try { navigator.clipboard.writeText(previewUrl); } catch (err) {} }}>Copy URL</button>
              <button className="op-small-btn" onClick={(e) => { e.stopPropagation(); closePreview(); }}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  ) : (
    <div className="op-empty">Select an object</div>
  );
}
