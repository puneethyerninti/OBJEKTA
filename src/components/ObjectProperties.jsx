import React, { useCallback, useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";

/**
 * ObjectProperties.texture.jsx
 * Extends ObjectProperties with a powerful Texture & GLB material panel.
 * - Local texture loading for many map types (albedo, normal, roughness, metalness, emissive, ao)
 * - .glb import for replacing selected mesh or importing a new asset
 * - Per-map controls: repeat (tiling), offset, rotation, flip, filtering
 * - Drag-and-drop for textures & .glb files
 * - Live preview thumbnails and undo/redo for material changes
 * - Calls onMaterialChange when material properties change
 *
 * Props (keeps the original API):
 * - selected: THREE.Object3D
 * - onTransformChange(prop, axis, value)
 * - onMaterialChange?(data)
 * - onApplyTexture?(file, slot) // optional host handler
 * - onApplyGLB?(file) // optional host handler for .glb
 * - onRemoveTexture?()
 * - onVisibilityToggle?(visible)
 * - onDelete?()
 * - onRename?(name)
 */

const CLIP_KEY = "objekta_transform_clipboard_v3";
const MAT_CLIP_KEY = "objekta_material_clipboard_v1";
const ACCENT = "#7f5af0";
const BORDER = "1px solid rgba(127,90,240,0.24)";
const FIELD_BG = "rgba(12,12,18,0.45)";
const axisList = ["x", "y", "z"];

// default map slots we support
const MAP_SLOTS = [
  { key: "map", label: "Base Color" },
  { key: "normalMap", label: "Normal Map" },
  { key: "roughnessMap", label: "Roughness Map" },
  { key: "metalnessMap", label: "Metalness Map" },
  { key: "emissiveMap", label: "Emissive Map" },
  { key: "aoMap", label: "AO Map" },
];

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
  // --- TRANSFORM / BASIC UI STATE ---
  const [name, setName] = useState("");
  const [visible, setVisible] = useState(true);

  const [position, setPosition] = useState({ x: 0, y: 0, z: 0 });
  const [rotation, setRotation] = useState({ x: 0, y: 0, z: 0 });
  const [scale, setScale] = useState({ x: 1, y: 1, z: 1 });

  const [useDegrees, setUseDegrees] = useState(true);
  const [uniformScale, setUniformScale] = useState(false);
  const [localSpace, setLocalSpace] = useState(true);

  // --- MATERIAL & TEXTURE STATE ---
  const [color, setColor] = useState("#888888");
  const [roughness, setRoughness] = useState(0.5);
  const [metalness, setMetalness] = useState(0.0);
  const [opacity, setOpacity] = useState(1.0);
  const [emissive, setEmissive] = useState("#000000");
  const [wireframe, setWireframe] = useState(false);

  // map states: { mapSlot: { url, file, texture, settings: { repeatX, repeatY, offsetX, offsetY, rotation, flipH, flipV, filter } } }
  const mapsRef = useRef({});
  const [mapStateVersion, setMapStateVersion] = useState(0); // trigger UI updates

  // undo / redo for material snapshots
  const materialUndoRef = useRef([]);
  const materialRedoRef = useRef([]);
  const MAT_UNDO_LIMIT = 30;

  // loader refs
  const textureLoaderRef = useRef(null);
  const gltfLoaderRef = useRef(null);

  // file input ids
  const fileIdsRef = useRef({});
  MAP_SLOTS.forEach((s) => { if (!fileIdsRef.current[s.key]) fileIdsRef.current[s.key] = `obj-prop-${s.key}-${Math.random().toString(36).slice(2,9)}`; });
  const glbIdRef = useRef(`obj-prop-glb-${Math.random().toString(36).slice(2,9)}`);

  // misc
  const mountedRef = useRef(true);
  const pendingRef = useRef({ position: {}, rotation: {}, scale: {} });
  const flushTimerRef = useRef(null);
  const rAFRef = useRef(null);
  const FLUSH_DEBOUNCE_MS = 80;

  // helpers
  const toNum = useCallback((v, d = 0) => {
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

  // sync when selected changes
  useEffect(() => {
    mountedRef.current = true;
    if (!selected) {
      setName(""); setVisible(true);
      setPosition({ x: 0, y: 0, z: 0 }); setRotation({ x: 0, y: 0, z: 0 }); setScale({ x: 1, y: 1, z: 1 });
      setColor("#888888"); setRoughness(0.5); setMetalness(0); setOpacity(1); setEmissive("#000000");
      mapsRef.current = {};
      setMapStateVersion((v) => v + 1);
      materialUndoRef.current = []; materialRedoRef.current = [];
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

    // attempt to extract material values from first mesh
    try {
      let foundMat = null;
      selected.traverse((c) => {
        if (foundMat) return;
        if (c.isMesh && c.material) {
          foundMat = Array.isArray(c.material) ? c.material[0] : c.material;
        }
      });
      if (foundMat) {
        try { if (foundMat.color) setColor(`#${foundMat.color.getHexString()}`); } catch(e){}
        if (typeof foundMat.roughness === 'number') setRoughness(foundMat.roughness);
        if (typeof foundMat.metalness === 'number') setMetalness(foundMat.metalness);
        if (typeof foundMat.opacity === 'number') setOpacity(foundMat.opacity);
        if (foundMat.emissive) try { setEmissive(`#${foundMat.emissive.getHexString()}`); } catch (e) {}
        if (typeof foundMat.wireframe === 'boolean') setWireframe(foundMat.wireframe);

        // try to build map state
        const ms = {};
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
                filter: t.minFilter || null,
              }
            };
          }
        });
        mapsRef.current = ms;
        setMapStateVersion((v) => v + 1);
      }
    } catch (e) { mapsRef.current = {}; setMapStateVersion((v) => v + 1); }

    materialUndoRef.current = []; materialRedoRef.current = [];
  }, [selected, useDegrees, toNum]);

  // --- TRANSFORM BATCHING (same as before) ---
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
    if (rAFRef.current) cancelAnimationFrame(rAFRef.current);
    flushTimerRef.current = setTimeout(() => {
      rAFRef.current = requestAnimationFrame(() => { flushTimerRef.current = null; rAFRef.current = null; flushPending(); });
    }, FLUSH_DEBOUNCE_MS);
  }, [flushPending]);

  const queueTransform = useCallback((prop, axis, uiValue) => {
    if (!prop || !axis) return;
    let sendVal = uiValue;
    if (prop === "rotation" && useDegrees) sendVal = (uiValue * Math.PI)/180;
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

  // --- MATERIAL SNAPSHOT / UNDO ---
  const snapshotMaterialState = useCallback((label = 'mat-edit') => {
    if (!selected) return;
    try {
      // shallow snapshot of maps and core params
      const snap = {
        color, roughness, metalness, opacity, emissive, wireframe,
        maps: JSON.parse(JSON.stringify(Object.fromEntries(Object.entries(mapsRef.current || {}).map(([k,v]) => [k, { url: v?.url || null, settings: v?.settings || {} }])))),
        label,
      };
      materialUndoRef.current.push(snap);
      if (materialUndoRef.current.length > MAT_UNDO_LIMIT) materialUndoRef.current.shift();
      materialRedoRef.current = [];
    } catch (e) {}
  }, [selected, color, roughness, metalness, opacity, emissive, wireframe]);

  const applySnapshotToMaterial = useCallback((snap) => {
    if (!snap || !selected) return;
    try {
      setColor(snap.color || '#888888');
      setRoughness(typeof snap.roughness === 'number' ? snap.roughness : 0.5);
      setMetalness(typeof snap.metalness === 'number' ? snap.metalness : 0);
      setOpacity(typeof snap.opacity === 'number' ? snap.opacity : 1);
      setEmissive(snap.emissive || '#000000');
      setWireframe(!!snap.wireframe);
      // maps: we only restore metadata (urls & settings). Actual textures must be reloaded if URL present — attempt to use loader
      const ms = {};
      for (const k of Object.keys(snap.maps || {})) {
        const entry = snap.maps[k];
        if (entry && entry.url) {
          ms[k] = { url: entry.url, file: null, texture: null, settings: entry.settings || {} };
          // attempt to load
          (async () => {
            try {
              const url = entry.url;
              if (!textureLoaderRef.current) return;
              textureLoaderRef.current.load(url, (tex) => {
                if (!ms[k]) return;
                ms[k].texture = tex;
                // apply settings
                const s = ms[k].settings || {};
                if (tex.repeat) { tex.repeat.set(s.repeatX ?? 1, s.repeatY ?? 1); }
                if (tex.offset) { tex.offset.set(s.offsetX ?? 0, s.offsetY ?? 0); }
                if (typeof tex.rotation === 'number') tex.rotation = s.rotation ?? 0;
                tex.needsUpdate = true;
                // apply to selected's material
                selected.traverse((n) => { if (n.isMesh && n.material) { const mats = Array.isArray(n.material) ? n.material : [n.material]; mats.forEach(m => { try { m[k] = tex; m.needsUpdate = true; } catch (e) {} }); } });
                mapsRef.current = { ...mapsRef.current, ...ms };
                setMapStateVersion(v => v+1);
              });
            } catch (e) {}
          })();
        }
      }
      mapsRef.current = { ...mapsRef.current, ...ms };
      setMapStateVersion(v => v+1);
      // notify host
      if (typeof onMaterialChange === 'function') onMaterialChange({ color: snap.color, roughness: snap.roughness, metalness: snap.metalness, opacity: snap.opacity, emissive: snap.emissive });
    } catch (e) {}
  }, [selected, onMaterialChange]);

  const matUndo = useCallback(() => {
    if (!materialUndoRef.current.length) return;
    try {
      const snap = materialUndoRef.current.pop();
      materialRedoRef.current.push({ color, roughness, metalness, opacity, emissive, wireframe, maps: JSON.parse(JSON.stringify(Object.fromEntries(Object.entries(mapsRef.current || {}).map(([k,v]) => [k, { url: v?.url || null, settings: v?.settings || {} }])))) });
      applySnapshotToMaterial(snap);
    } catch (e) {}
  }, [applySnapshotToMaterial, color, roughness, metalness, opacity, emissive, wireframe]);

  const matRedo = useCallback(() => {
    if (!materialRedoRef.current.length) return;
    try {
      const snap = materialRedoRef.current.pop();
      materialUndoRef.current.push({ color, roughness, metalness, opacity, emissive, wireframe, maps: JSON.parse(JSON.stringify(Object.fromEntries(Object.entries(mapsRef.current || {}).map(([k,v]) => [k, { url: v?.url || null, settings: v?.settings || {} }])))) });
      applySnapshotToMaterial(snap);
    } catch (e) {}
  }, [applySnapshotToMaterial, color, roughness, metalness, opacity, emissive, wireframe]);

  // --- APPLY MAP FILE (local) ---
  const applyMapFile = useCallback(async (file, slotKey) => {
    if (!file || !slotKey) return;
    snapshotMaterialState('apply-map');

    // allow host to override
    if (typeof onApplyTexture === 'function') {
      try { onApplyTexture(file, slotKey); } catch (e) {}
      return;
    }

    const url = URL.createObjectURL(file);
    setMapStateVersion(v => v+1);
    const entry = { url, file, texture: null, settings: { repeatX: 1, repeatY: 1, offsetX: 0, offsetY: 0, rotation: 0, flipH: false, flipV: false, filter: null } };
    mapsRef.current = { ...(mapsRef.current || {}), [slotKey]: entry };

    try {
      const loader = textureLoaderRef.current;
      if (loader && loader.load) {
        loader.load(url, (tex) => {
          try {
            // default wrap/repeat
            tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
            tex.repeat.set(entry.settings.repeatX, entry.settings.repeatY);
            tex.offset.set(entry.settings.offsetX, entry.settings.offsetY);
            tex.rotation = entry.settings.rotation || 0;
            tex.needsUpdate = true;

            // store texture
            mapsRef.current = { ...(mapsRef.current || {}), [slotKey]: { ...entry, texture: tex } };

            // apply to selected
            selected?.traverse((n) => {
              if (n.isMesh && n.material) {
                const mats = Array.isArray(n.material) ? n.material : [n.material];
                mats.forEach((m) => {
                  try {
                    m[slotKey] = tex;
                    // set PBR flags if needed
                    if (slotKey === 'normalMap') m.normalScale = m.normalScale || new THREE.Vector2(1,1);
                    if (slotKey === 'roughnessMap') m.roughness = m.roughness ?? 1;
                    if (slotKey === 'metalnessMap') m.metalness = m.metalness ?? 0;
                    if (slotKey === 'aoMap') { if (m.aoMap) m.aoMap = tex; else m.aoMap = tex; }
                    m.needsUpdate = true;
                  } catch (e) {}
                });
              }
            });

            setMapStateVersion(v => v+1);
            if (typeof onMaterialChange === 'function') onMaterialChange({ color, roughness, metalness, opacity, texture: true });
            textureUrlCleanup(url, slotKey);
          } catch (e) { textureUrlCleanup(url, slotKey); }
        }, undefined, (err) => { console.warn('texture load failed', err); textureUrlCleanup(url, slotKey); });
      } else {
        // fallback: just keep url for preview
        mapsRef.current = { ...(mapsRef.current || {}), [slotKey]: entry };
        setMapStateVersion(v => v+1);
      }
    } catch (e) { textureUrlCleanup(url, slotKey); }
  }, [onApplyTexture, selected, snapshotMaterialState, color, roughness, metalness, opacity, onMaterialChange]);

  const textureUrlCleanup = (url, slotKey) => {
    // we keep the blob URL stored so we shouldn't revoke immediately; revoke only when removed or component unmounts
    // this helper present for future adaptation
  };

  const removeMap = useCallback((slotKey) => {
    snapshotMaterialState('remove-map');
    const cur = mapsRef.current || {};
    const entry = cur[slotKey];
    if (!entry) return;
    try {
      // allow host to handle
      if (typeof onRemoveTexture === 'function') { onRemoveTexture(slotKey); }
      // dispose texture if present
      if (entry.texture) { try { entry.texture.dispose?.(); } catch (e) {} }
      // remove from materials
      selected?.traverse((n) => {
        if (n.isMesh && n.material) {
          const mats = Array.isArray(n.material) ? n.material : [n.material];
          mats.forEach((m) => {
            try { m[slotKey] = null; m.needsUpdate = true; } catch (e) {}
          });
        }
      });
    } catch (e) {}
    delete mapsRef.current[slotKey];
    setMapStateVersion(v => v+1);
    if (typeof onMaterialChange === 'function') onMaterialChange({ color, roughness, metalness, opacity, texture: false });
  }, [onRemoveTexture, selected, snapshotMaterialState, color, roughness, metalness, opacity, onMaterialChange]);

  // update map settings (tiling/offset/rotation/flip/filter)
  const updateMapSettings = useCallback((slotKey, patch) => {
    if (!slotKey) return;
    snapshotMaterialState('map-settings');
    const cur = mapsRef.current || {};
    const entry = cur[slotKey];
    if (!entry) return;
    entry.settings = { ...(entry.settings || {}), ...patch };
    // apply to texture object if loaded
    if (entry.texture) {
      try {
        const t = entry.texture;
        if (patch.repeatX !== undefined || patch.repeatY !== undefined) t.repeat.set(entry.settings.repeatX ?? 1, entry.settings.repeatY ?? 1);
        if (patch.offsetX !== undefined || patch.offsetY !== undefined) t.offset.set(entry.settings.offsetX ?? 0, entry.settings.offsetY ?? 0);
        if (patch.rotation !== undefined) t.rotation = entry.settings.rotation ?? 0;
        // flip handling (by scaling repeat negative)
        if (patch.flipH !== undefined || patch.flipV !== undefined) {
          const fx = entry.settings.flipH ? -1 : 1;
          const fy = entry.settings.flipV ? -1 : 1;
          // easiest: set matrix transform via repeat * flip
          t.repeat.set((entry.settings.repeatX ?? 1) * fx, (entry.settings.repeatY ?? 1) * fy);
        }
        t.needsUpdate = true;
        // reapply to material
        selected?.traverse((n) => { if (n.isMesh && n.material) { const mats = Array.isArray(n.material) ? n.material : [n.material]; mats.forEach(m => { try { m[slotKey] = t; m.needsUpdate = true; } catch (e) {} }); } });
      } catch (e) {}
    }
    mapsRef.current = { ...(mapsRef.current || {}), [slotKey]: entry };
    setMapStateVersion(v => v+1);
    if (typeof onMaterialChange === 'function') onMaterialChange({ color, roughness, metalness, opacity });
  }, [selected, snapshotMaterialState, color, roughness, metalness, opacity, onMaterialChange]);

  // --- GLB import ---
  const applyGLBFile = useCallback(async (file) => {
    if (!file) return;
    // allow host to handle
    if (typeof onApplyGLB === 'function') { try { onApplyGLB(file); } catch (e) {} return; }
    // default behavior: load and replace selected's mesh geometry & materials, or add as child
    const url = URL.createObjectURL(file);
    const loader = gltfLoaderRef.current;
    if (!loader) { URL.revokeObjectURL(url); return; }
    try {
      loader.load(url, (gltf) => {
        try {
          const scene = gltf.scene || gltf.scenes?.[0];
          if (!scene) return;
          // if selected is a group or mesh, replace it, otherwise add as child
          if (selected && (selected.isMesh || selected.isGroup)) {
            // remove children and add loaded scene children
            selected.clear?.();
            scene.children.forEach((c) => { selected.add(c.clone()); });
          } else {
            // if no selection, attach scene as child to root (caller must handle)
            // here we simply attach if selected exists, else do nothing
          }
          URL.revokeObjectURL(url);
        } catch (e) { URL.revokeObjectURL(url); }
      }, undefined, (err) => { console.warn('glb load failed', err); URL.revokeObjectURL(url); });
    } catch (e) { try { URL.revokeObjectURL(url); } catch(_) {} }
  }, [onApplyGLB, gltfLoaderRef, selected]);

  // --- drag & drop handlers ---
  const onDrop = useCallback((e) => {
    e.preventDefault();
    const items = e.dataTransfer?.files || [];
    for (let i=0;i<items.length;i++) {
      const f = items[i];
      const name = (f.name||'').toLowerCase();
      if (name.endsWith('.glb') || name.endsWith('.gltf')) { applyGLBFile(f); }
      else {
        // heuristics: normal map if filename contains 'normal' or 'nrm', roughness if contains 'rough', metalness if 'metal'
        let slot = 'map';
        if (name.includes('normal') || name.includes('nrm')) slot = 'normalMap';
        else if (name.includes('rough')) slot = 'roughnessMap';
        else if (name.includes('metal')) slot = 'metalnessMap';
        else if (name.includes('emiss') || name.includes('emit')) slot = 'emissiveMap';
        else if (name.includes('ao')) slot = 'aoMap';
        applyMapFile(f, slot);
      }
    }
  }, [applyGLBFile, applyMapFile]);

  const onDragOver = useCallback((e) => { e.preventDefault(); }, []);

  // keyboard shortcuts for material undo/redo and map copy/paste
  useEffect(() => {
    const onKey = (e) => {
      const meta = e.ctrlKey || e.metaKey;
      if (meta && e.key.toLowerCase() === 'z') { e.preventDefault(); matUndo(); }
      if (meta && (e.key.toLowerCase() === 'y' || (e.shiftKey && e.key.toLowerCase() === 'z'))) { e.preventDefault(); matRedo(); }
      if (meta && e.key.toLowerCase() === 'g') { // quick reimport glb via prompt: convenience
        // noop in this context
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [matUndo, matRedo]);

  // cleanup on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (flushTimerRef.current) { clearTimeout(flushTimerRef.current); flushTimerRef.current = null; }
      if (rAFRef.current) { cancelAnimationFrame(rAFRef.current); rAFRef.current = null; }
      // revoke blob URLs we've created
      try {
        Object.values(mapsRef.current || {}).forEach((m) => { if (m && m.url && m.file) { try { URL.revokeObjectURL(m.url); } catch(e) {} } });
      } catch (e) {}
    };
  }, []);

  // Numeric small component
  const Numeric = ({ value, onChange, step = 0.1, min, max, ariaLabel }) => (
    <input type="number" step={step} value={value} onChange={onChange} min={min} max={max} style={{ width: 88, padding: '6px 8px', borderRadius: 8, border: BORDER, background: FIELD_BG, color: '#fff', textAlign: 'center' }} aria-label={ariaLabel} />
  );

  // Render
  return selected ? (
    <div onDrop={onDrop} onDragOver={onDragOver} style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 12, color: '#fff', fontFamily: 'Inter, sans-serif' }}>
      {/* Header */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <input type="text" value={name} onChange={(e) => { setName(e.target.value); try { if (selected) selected.name = e.target.value; } catch(e){} if (typeof onRename === 'function') onRename(e.target.value); }} placeholder="Object name" style={{ padding: '8px 10px', borderRadius: 10, border: BORDER, background: FIELD_BG, color: '#fff', fontWeight: 700, flex: 1 }} />
        <label style={{ display: 'flex', gap: 6, alignItems: 'center', marginLeft: 6 }}>
          <input type="checkbox" checked={visible} onChange={(e) => { setVisible(e.target.checked); try { if (selected) selected.visible = e.target.checked; } catch (e) {} if (typeof onVisibilityToggle==='function') onVisibilityToggle(e.target.checked); }} />
          <span style={{ fontSize: 13 }}>Visible</span>
        </label>
        <div style={{ display: 'flex', gap: 6, marginLeft: 'auto' }}>
          <button onClick={() => { /* transform undo handled elsewhere */ }} title="Undo" style={{ padding: '6px 8px' }}>↶</button>
          <button onClick={() => { /* redo */ }} title="Redo" style={{ padding: '6px 8px' }}>↷</button>
          <button onClick={() => onDelete && onDelete()} title="Delete" style={{ padding: '6px 8px', background: 'rgba(80,0,40,0.6)', color: '#ff88c4' }}>Delete</button>
        </div>
      </div>

      {/* Transform utilities (kept brief) */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <button onClick={() => { try { const rotRad = { x: useDegrees ? rotation.x*Math.PI/180 : rotation.x, y: useDegrees ? rotation.y*Math.PI/180 : rotation.y, z: useDegrees ? rotation.z*Math.PI/180 : rotation.z }; const payload = { position, rotation: rotRad, scale }; localStorage.setItem(CLIP_KEY, JSON.stringify(payload)); } catch(e){} }} style={{ padding: '6px 8px' }}>Copy</button>
        <button onClick={() => { try { const s = localStorage.getItem(CLIP_KEY); if (!s) return; const raw = JSON.parse(s); setPosition({ x: toNum(raw.position.x), y: toNum(raw.position.y), z: toNum(raw.position.z) }); setScale({ x: toNum(raw.scale.x,1), y: toNum(raw.scale.y,1), z: toNum(raw.scale.z,1) }); if (useDegrees) { setRotation({ x: toNum(raw.rotation.x*180/Math.PI), y: toNum(raw.rotation.y*180/Math.PI), z: toNum(raw.rotation.z*180/Math.PI) }); queueTransform('rotation','x', raw.rotation.x*180/Math.PI); queueTransform('rotation','y', raw.rotation.y*180/Math.PI); queueTransform('rotation','z', raw.rotation.z*180/Math.PI); } else { setRotation({ x: toNum(raw.rotation.x), y: toNum(raw.rotation.y), z: toNum(raw.rotation.z) }); queueTransform('rotation','x', raw.rotation.x); queueTransform('rotation','y', raw.rotation.y); queueTransform('rotation','z', raw.rotation.z); } queueTransform('position','x', raw.position.x); queueTransform('position','y', raw.position.y); queueTransform('position','z', raw.position.z); queueTransform('scale','x', raw.scale.x); queueTransform('scale','y', raw.scale.y); queueTransform('scale','z', raw.scale.z); } catch (e){} }} style={{ padding: '6px 8px' }}>Paste</button>
        <input id={glbIdRef.current} type="file" accept="model/gltf,model/glb,.gltf,.glb" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; if (f) applyGLBFile(f); e.target.value=''; }} />
        <button onClick={() => document.getElementById(glbIdRef.current)?.click()} style={{ padding: '6px 8px' }}>Import .glb</button>
        <label style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center' }}>
          <input type="checkbox" checked={localSpace} onChange={(e) => setLocalSpace(e.target.checked)} />
          <span style={{ fontSize: 13 }}>Local</span>
        </label>
      </div>

      {/* Material + color */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input type="color" value={color} onChange={(e) => { setColor(e.target.value); // apply immediately
            try { selected?.traverse(n => { if (n.isMesh && n.material) { const mats = Array.isArray(n.material)?n.material:[n.material]; mats.forEach(m=>{ try{ if (m.color) m.color.set(e.target.value); m.needsUpdate=true;}catch(e){} });}}); } catch(e){}
            if (typeof onMaterialChange==='function') onMaterialChange({ color: e.target.value, roughness, metalness, opacity, emissive });
          }} style={{ width:44, height:44, borderRadius:8, border: BORDER }} />
          <input value={color.toUpperCase()} onChange={(e)=>setColor(e.target.value)} onBlur={()=> { const h = color.trim(); try { selected?.traverse(n => { if (n.isMesh && n.material) { const mats = Array.isArray(n.material)?n.material:[n.material]; mats.forEach(m=>{ try{ if (m.color) m.color.set(safeHex(h)); m.needsUpdate=true;}catch(e){} });}}); }catch(e){} if (typeof onMaterialChange==='function') onMaterialChange({ color: safeHex(h), roughness, metalness, opacity, emissive }); }} style={{ padding: '6px 8px', borderRadius:8, border: BORDER, background: FIELD_BG, color: '#fff', width:120 }} />

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 12 }}>Roughness {roughness.toFixed(2)}</label>
            <input type="range" min="0" max="1" step="0.01" value={roughness} onChange={(e)=>{ const r=Number(e.target.value); setRoughness(r); try{ selected?.traverse(n=>{ if (n.isMesh && n.material) { const mats=Array.isArray(n.material)?n.material:[n.material]; mats.forEach(m=>{ try{ if (typeof m.roughness==='number') m.roughness=r; m.needsUpdate=true;}catch(e){} }); }});}catch(e){} if (typeof onMaterialChange==='function') onMaterialChange({ color, roughness:r, metalness, opacity, emissive }); }} />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 12 }}>Metalness {metalness.toFixed(2)}</label>
            <input type="range" min="0" max="1" step="0.01" value={metalness} onChange={(e)=>{ const m=Number(e.target.value); setMetalness(m); try{ selected?.traverse(n=>{ if (n.isMesh && n.material) { const mats=Array.isArray(n.material)?n.material:[n.material]; mats.forEach(mm=>{ try{ if (typeof mm.metalness==='number') mm.metalness=m; mm.needsUpdate=true;}catch(e){} }); }});}catch(e){} if (typeof onMaterialChange==='function') onMaterialChange({ color, roughness, metalness:m, opacity, emissive }); }} />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 12 }}>Opacity {opacity.toFixed(2)}</label>
            <input type="range" min="0" max="1" step="0.01" value={opacity} onChange={(e)=>{ const o=Number(e.target.value); setOpacity(o); try{ selected?.traverse(n=>{ if (n.isMesh && n.material) { const mats=Array.isArray(n.material)?n.material:[n.material]; mats.forEach(mm=>{ try{ if (typeof mm.opacity==='number') { mm.opacity=o; mm.transparent = o<1;} mm.needsUpdate=true;}catch(e){} }); }});}catch(e){} if (typeof onMaterialChange==='function') onMaterialChange({ color, roughness, metalness, opacity:o, emissive }); }} />
          </div>

          <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
            <button onClick={() => { snapshotMaterialState('copy-mat'); try { localStorage.setItem(MAT_CLIP_KEY, JSON.stringify({ color, roughness, metalness, opacity, emissive })); } catch (e) {} }} style={{ padding: '6px 8px' }}>Copy Mat</button>
            <button onClick={() => { try { const s = localStorage.getItem(MAT_CLIP_KEY); if (!s) return; const raw = JSON.parse(s); setColor(raw.color||color); setRoughness(typeof raw.roughness==='number'?raw.roughness:roughness); setMetalness(typeof raw.metalness==='number'?raw.metalness:metalness); setOpacity(typeof raw.opacity==='number'?raw.opacity:opacity); setEmissive(raw.emissive||emissive); if (typeof onMaterialChange==='function') onMaterialChange(raw); } catch (e) {} }} style={{ padding: '6px 8px' }}>Paste Mat</button>
            <label style={{ display: 'flex', alignItems: 'center' }}>
              <input type="checkbox" checked={wireframe} onChange={(e)=>{ setWireframe(e.target.checked); try{ selected?.traverse(n=>{ if (n.isMesh && n.material) { const mats = Array.isArray(n.material)?n.material:[n.material]; mats.forEach(m=>{ try{ m.wireframe = e.target.checked; m.needsUpdate = true;}catch(e){} }); }});}catch(e){} }} />
              <span style={{ marginLeft: 6 }}>Wireframe</span>
            </label>
          </div>
        </div>

        {/* Maps editor */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {MAP_SLOTS.map(slot => {
            const s = mapsRef.current?.[slot.key] || null;
            return (
              <div key={slot.key} style={{ display: 'flex', gap: 8, alignItems: 'center', background: 'rgba(255,255,255,0.02)', padding: 8, borderRadius: 8 }}>
                <div style={{ width: 110, fontWeight: 700, color: ACCENT }}>{slot.label}</div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input id={fileIdsRef.current[slot.key]} type="file" accept="image/*" style={{ display: 'none' }} onChange={(e)=>{ const f = e.target.files?.[0]; if (f) applyMapFile(f, slot.key); e.target.value=''; }} />
                  <button onClick={()=>document.getElementById(fileIdsRef.current[slot.key])?.click()} style={{ padding: '6px 8px' }}>Upload</button>
                  {s && s.url && (<img src={s.url} alt={slot.key} style={{ width:48, height:48, objectFit:'cover', borderRadius:6 }} />)}
                  <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                    <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                      <label style={{ fontSize:12 }}>Tile X</label>
                      <Numeric value={(s?.settings?.repeatX ?? 1)} onChange={(e)=> updateMapSettings(slot.key, { repeatX: Number(e.target.value || 1) })} step={0.1} min={0.01} />
                      <label style={{ fontSize:12 }}>Tile Y</label>
                      <Numeric value={(s?.settings?.repeatY ?? 1)} onChange={(e)=> updateMapSettings(slot.key, { repeatY: Number(e.target.value || 1) })} step={0.1} min={0.01} />
                    </div>
                    <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                      <label style={{ fontSize:12 }}>Offset X</label>
                      <Numeric value={(s?.settings?.offsetX ?? 0)} onChange={(e)=> updateMapSettings(slot.key, { offsetX: Number(e.target.value || 0) })} step={0.01} />
                      <label style={{ fontSize:12 }}>Offset Y</label>
                      <Numeric value={(s?.settings?.offsetY ?? 0)} onChange={(e)=> updateMapSettings(slot.key, { offsetY: Number(e.target.value || 0) })} step={0.01} />
                    </div>
                    <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                      <label style={{ fontSize:12 }}>Rot</label>
                      <Numeric value={(s?.settings?.rotation ?? 0)} onChange={(e)=> updateMapSettings(slot.key, { rotation: Number(e.target.value || 0) })} step={1} />
                      <label style={{ fontSize:12 }}>Flip H</label>
                      <input type="checkbox" checked={!!(s?.settings?.flipH)} onChange={(e)=> updateMapSettings(slot.key, { flipH: e.target.checked })} />
                      <label style={{ fontSize:12 }}>Flip V</label>
                      <input type="checkbox" checked={!!(s?.settings?.flipV)} onChange={(e)=> updateMapSettings(slot.key, { flipV: e.target.checked })} />
                      <button onClick={()=> removeMap(slot.key)} style={{ marginLeft: 8, padding:'6px 8px' }}>Remove</button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>
          Tip: Drag textures or a .glb file onto this panel. Supported auto-slot heuristics will try to guess map types by filename (normal, rough, metal, ao, emiss). Use the tile/offset/rotation controls to adjust UV transforms. Material changes are undoable.
        </div>
      </div>
    </div>
  ) : (
    <div style={{ padding: 12, color: 'rgba(200,200,220,0.85)' }}>Select an object</div>
  );
}
