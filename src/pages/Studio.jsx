// src/pages/Studio.jsx
import React, { useRef, useState, useEffect, useCallback, useLayoutEffect } from "react";
import * as THREE from "three";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import {
  FiSave, FiUpload, FiRefreshCcw, FiMaximize, FiMinimize, FiRotateCcw,
  FiRotateCw, FiSidebar, FiLayers, FiStar, FiPlusSquare, FiTrash2, FiCopy,
  FiWifi, FiWifiOff, FiSun, FiMoon, FiSearch
} from "react-icons/fi";

import Palette, { PALETTE_TYPE } from "../components/Palette";
import Workspace from "../components/Workspace";
import ObjectProperties from "../components/ObjectProperties";
import "../styles/Studio.css";

const PALETTE_ITEMS = [
  { id: 1, name: "Cube" }, { id: 2, name: "Sphere" }, { id: 3, name: "Cone" },
  { id: 4, name: "Plane" }, { id: 5, name: "Cylinder" }, { id: 6, name: "Torus" },
  { id: 7, name: "Empty" }, { id: 8, name: "Axis Helper" }, { id: 9, name: "Point Light" },
  { id: 10, name: "Spot Light" }, { id: 11, name: "Directional Light" }, { id: 12, name: "Camera" },
];

const Toast = ({ t, onClose }) => (
  <div role="status" aria-live="polite" className="toast-item" style={{ background: t.type === 'error' ? 'rgba(255, 60, 80, 0.85)' : '' }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: 'center', gap: 8 }}>
      <div style={{ fontWeight: 700 }}>{t.title || (t.type === "error" ? "Error" : "Info")}</div>
      <button onClick={onClose} style={{ background: "transparent", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: 16 }}>✕</button>
    </div>
    <div style={{ marginTop: 6, color: 'var(--text-muted)' }}>{t.message}</div>
  </div>
);

const ToastContainer = ({ toasts, remove }) => (
  <div className="toast-container">{toasts.map((t) => <Toast key={t.id} t={t} onClose={() => remove(t.id)} />)}</div>
);

const Loader = ({ active, message, progress }) => {
  if (!active) return null;
  return (
    <div className="loader-container">
      <div className="loader-content">
        <div style={{ marginBottom: 8, fontWeight: 700 }}>{message || "Loading..."}</div>
        <div style={{ height: 8, background: "rgba(255,255,255,0.08)", borderRadius: 6, overflow: "hidden", width: 240 }}>
          <div style={{ width: `${Math.round((progress ?? 0) * 100)}%`, height: "100%", background: "linear-gradient(90deg,var(--brand-purple),var(--brand-pink))" }} />
        </div>
        {typeof progress === "number" && <div style={{ marginTop: 8, fontSize: 12 }}>{Math.round(progress * 100)}%</div>}
      </div>
    </div>
  );
};

const ConfirmModal = ({ open, title, message, onCancel, onConfirm }) => {
  if (!open) return null;
  return (
    <div className="modal-container" onClick={onCancel}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 12 }}>{title}</div>
        <p style={{ color: 'var(--text-muted)', marginBottom: 20, lineHeight: 1.5 }}>{message}</p>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button onClick={onCancel} className="studio-btn">Cancel</button>
          <button onClick={onConfirm} className="launch-btn" style={{ padding: '8px 16px', fontSize: 14 }}>Confirm</button>
        </div>
      </div>
    </div>
  );
};

export default function Studio() {
  const workspaceRef = useRef(null);
  const panelRef = useRef(null);
  const containerRef = useRef(null);
  const toolbarRef = useRef(null);

  const [selected, setSelected] = useState(null);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [panelPos, setPanelPos] = useState({ top: 50, right: 20 });

  const [paletteWidth, setPaletteWidth] = useState(() => {
    const raw = localStorage.getItem("objekta_palette_width");
    const n = parseInt(raw, 10);
    return Number.isFinite(n) ? Math.max(120, Math.min(420, n)) : 180;
  });

  const [paletteCollapsed, setPaletteCollapsed] = useState(false);
  const [propsCollapsed, setPropsCollapsed] = useState(false);

  const [propsWidth, setPropsWidth] = useState(() => {
    const raw = localStorage.getItem("objekta_props_width");
    const n = parseInt(raw, 10);
    return Number.isFinite(n) ? Math.max(260, Math.min(520, n)) : 320;
  });

  const [toasts, setToasts] = useState([]);
  const nextToastIdRef = useRef(1);
  const toastTimeoutsRef = useRef(new Map());

  const pushToast = (t, ttl = 5000) => {
    const id = nextToastIdRef.current++;
    setToasts((s) => [...s, { ...t, id }]);
    const to = setTimeout(() => setToasts((s) => s.filter((x) => x.id !== id)), ttl);
    toastTimeoutsRef.current.set(id, to);
  };
  const removeToast = (id) => {
    setToasts((s) => s.filter((x) => x.id !== id));
    const to = toastTimeoutsRef.current.get(id);
    if (to) {
      clearTimeout(to);
      toastTimeoutsRef.current.delete(id);
    }
  };

  const [loading, setLoading] = useState(false);
  const [loadProgress, setLoadProgress] = useState(null);
  const [confirmState, setConfirmState] = useState({ open: false, title: "", message: "", onConfirm: null });
  const resizingRef = useRef(false);
  const draggingRef = useRef(false);
  const offsetRef = useRef({ x: 0, y: 0 });
  const [activeMode, setActiveMode] = useState("translate");

  const [snapEnabled, setSnapEnabled] = useState(false);
  const [snapSize, setSnapSize] = useState(() => {
    const raw = localStorage.getItem("objekta_snap");
    const v = raw ? parseFloat(raw) : 0.5;
    return Number.isFinite(v) ? v : 0.5;
  });

  useEffect(() => {
    localStorage.setItem("objekta_snap", String(snapSize));
    try { workspaceRef.current?.setSnapValue?.(snapSize); } catch (e) {}
  }, [snapSize]);

  const [favorites, setFavorites] = useState(() => {
    try {
      const raw = localStorage.getItem("objekta_palette_favs");
      return raw ? JSON.parse(raw) : {};
    } catch { return {}; }
  });

  const [toolbarHeight, setToolbarHeight] = useState(64);
  useLayoutEffect(() => {
    const measure = () => {
      try {
        const rect = toolbarRef.current?.getBoundingClientRect();
        if (rect && rect.height) setToolbarHeight(Math.ceil(rect.height));
      } catch (e) {}
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  const setMode = (mode) => {
    setActiveMode(mode);
    workspaceRef.current?.setTransformMode?.(mode);
  };

  const toggleSnap = () => {
    setSnapEnabled((v) => {
      const next = !v;
      workspaceRef.current?.toggleSnap?.();
      pushToast({ type: "info", message: `Snap ${next ? "enabled" : "disabled"}` });
      return next;
    });
  };

  // --- Material Editor state ---
  const [matColor, setMatColor] = useState("#888888");
  const [matRough, setMatRough] = useState(0.5);
  const [matMetal, setMatMetal] = useState(0.0);
  const [matHasMap, setMatHasMap] = useState(false);
  const [matMapURL, setMatMapURL] = useState(null);

  // --- Lighting editor state ---
  const [lights, setLights] = useState([]);
  const [collabConnected, setCollabConnected] = useState(false);
  const collabSocketRef = useRef(null);
  const [collabLoading, setCollabLoading] = useState(false);

  // --- Outliner search ---
  const [outlinerSearch, setOutlinerSearch] = useState("");

  const pushSceneToast = (msg) => pushToast({ type: "info", message: msg });

  const safeDate = () => new Date().toISOString().replace(/[:.]/g, "-");

  // ---------- Save / Load JSON ----------
  const saveJSON = useCallback(() => {
    const data = workspaceRef.current?.serializeScene?.();
    if (!data) {
      pushToast({ type: "error", message: "Nothing to save" });
      return;
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Objekta_Scene_${safeDate()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
    pushToast({ type: "info", message: "Scene saved (JSON)" });
  }, []);

  const loadJSON = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const json = JSON.parse(e.target.result);
        workspaceRef.current?.loadFromData?.(json);
        pushToast({ type: "info", message: "Scene loaded" });
      } catch (err) {
        pushToast({ type: "error", message: "Invalid JSON file" });
      }
    };
    reader.readAsText(file);
  };

  const exportGLTF = (binary = true) => {
    workspaceRef.current?.exportGLTF?.(binary);
  };

  // ---------- GLTF import (wired to Workspace progress) ----------
  const importGLTF = async (file) => {
    if (!file) return;
    setLoading(true);
    setLoadProgress(0);
    try {
      await workspaceRef.current?.addGLTF?.(file, null, (p) => {
        setLoadProgress(p);
      });
      pushToast({ type: "info", message: `Imported: ${file.name}` });
    } catch (e) {
      console.error("ImportGLTF failed", e);
      pushToast({ type: "error", message: "Import failed" });
    } finally {
      setTimeout(() => { setLoading(false); setLoadProgress(null); }, 300);
    }
  };

  // ---------- Resize / drag handlers ----------
  const startResize = (e) => {
    e.preventDefault();
    resizingRef.current = true;
    const startX = e.clientX;
    const startW = paletteWidth;
    const onMove = (ev) => {
      if (!resizingRef.current) return;
      const newWidth = Math.max(120, Math.min(420, startW + ev.clientX - startX));
      setPaletteWidth(newWidth);
      localStorage.setItem("objekta_palette_width", String(newWidth));
    };
    const onUp = () => {
      resizingRef.current = false;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  const startPropsResize = (e) => {
    e.preventDefault();
    const startX = e.clientX;
    const startW = propsWidth;
    const onMove = (ev) => {
      const newW = Math.max(260, Math.min(520, startW - (ev.clientX - startX)));
      setPropsWidth(newW);
    };
    const onUp = () => {
      try { localStorage.setItem("objekta_props_width", String(propsWidth)); } catch {}
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  useEffect(() => {
    const onResize = () => workspaceRef.current?.onResize?.();
    window.addEventListener("resize", onResize);
    setTimeout(() => workspaceRef.current?.onResize?.(), 50);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const startDrag = (e) => {
    draggingRef.current = true;
    const rect = panelRef.current.getBoundingClientRect();
    offsetRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    e.preventDefault();
    e.stopPropagation();
  };

  useEffect(() => {
    const onMouseMove = (e) => {
      if (!draggingRef.current) return;
      const x = e.clientX - offsetRef.current.x;
      const y = e.clientY - offsetRef.current.y;
      const { innerWidth, innerHeight } = window;
      const snap = 20;
      const right = Math.max(0, innerWidth - x - (panelRef.current?.offsetWidth ?? 300));
      const top = Math.max(0, Math.min(y, innerHeight - (panelRef.current?.offsetHeight ?? 300)));
      let snappedRight = right, snappedTop = top;
      if (right < snap) snappedRight = 0;
      if (x < snap) snappedRight = innerWidth - (panelRef.current?.offsetWidth ?? 300);
      if (top < snap) snappedTop = 0;
      if (innerHeight - (top + (panelRef.current?.offsetHeight ?? 300)) < snap)
        snappedTop = innerHeight - (panelRef.current?.offsetHeight ?? 300);
      const minTop = toolbarHeight + 12;
      if (snappedTop < minTop) snappedTop = minTop;
      setPanelPos({ right: snappedRight, top: snappedTop });
    };
    const onMouseUp = () => { draggingRef.current = false; };
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [toolbarHeight]);

  useEffect(() => {
    const onFullScreenChange = () => setIsFullScreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFullScreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullScreenChange);
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const onDragOver = (e) => { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; };
    const onDrop = (e) => {
      e.preventDefault();
      if (e.dataTransfer.files?.length > 0) {
        const file = e.dataTransfer.files[0];
        const name = (file.name || "").toLowerCase();
        if (name.endsWith(".glb") || name.endsWith(".gltf")) importGLTF(file);
        else if (name.endsWith(".json")) loadJSON(file);
        else pushToast({ type: "error", message: "Unsupported file. Drop a .glb, .gltf, or .json file." });
      }
    };
    container.addEventListener("dragover", onDragOver);
    container.addEventListener("drop", onDrop);
    return () => {
      container.removeEventListener("dragover", onDragOver);
      container.removeEventListener("drop", onDrop);
    };
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      const meta = e.ctrlKey || e.metaKey;
      if (meta && e.key.toLowerCase() === "s") { e.preventDefault(); saveJSON(); return; }
      if (meta && e.key.toLowerCase() === "z" && !e.shiftKey) { e.preventDefault(); workspaceRef.current?.undo?.(); return; }
      if ((meta && e.key.toLowerCase() === "y") || (meta && e.shiftKey && e.key.toLowerCase() === "z")) { e.preventDefault(); workspaceRef.current?.redo?.(); return; }
      if (e.key === "Delete") { requestDeleteSelected(); return; }
      if (!meta && e.key.toLowerCase() === "p") { setPaletteCollapsed((v) => !v); return; }
      if (!meta && e.key.toLowerCase() === "i") { setPropsCollapsed((v) => !v); return; }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [saveJSON, selected]);

  const undo = () => workspaceRef.current?.undo?.();
  const redo = () => workspaceRef.current?.redo?.();

  const [ctxMenu, setCtxMenu] = useState(null);
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onContext = (ev) => { ev.preventDefault(); setCtxMenu({ x: ev.clientX, y: ev.clientY }); };
    el.addEventListener("contextmenu", onContext);
    return () => el.removeEventListener("contextmenu", onContext);
  }, []);

  const closeContext = () => setCtxMenu(null);
  const ctxDuplicate = () => { workspaceRef.current?.duplicateSelected?.(); pushToast({ type: "info", message: "Duplicated" }); closeContext(); };
  const ctxDelete = () => { requestDeleteSelected(); closeContext(); };
  const ctxExport = () => { exportGLTF(true); closeContext(); };
  const ctxSave = () => { saveJSON(); closeContext(); };
  const ctxReset = () => { requestResetScene(); closeContext(); };

  const [stats, setStats] = useState({ objects: 0, tris: 0 });

  // NEW: sceneVersion to react to Workspace events instead of polling
  const [sceneVersion, setSceneVersion] = useState(0);

  // compute stats once (used on sceneChange)
  const updateStatsOnce = () => {
    try {
      const scene = workspaceRef.current?.scene;
      if (scene && (scene._user_group || scene._userGroup)) {
        const ug = scene._userGroup || scene._user_group;
        const n = Array.from(ug.children).filter((c) => c.userData?.__objekta).length;
        let tris = 0;
        Array.from(ug.children).forEach(c => {
          c.traverse(n => {
            if (n.isMesh && n.geometry) {
              try {
                if (n.geometry.index) tris += n.geometry.index.count / 3;
                else if (n.geometry.attributes && n.geometry.attributes.position) tris += n.geometry.attributes.position.count / 3;
              } catch (e) {}
            }
          });
        });
        setStats({ objects: n, tris: Math.round(tris) });
      } else {
        setStats({ objects: 0, tris: 0 });
      }
    } catch (e) { /* ignore */ }
  };

  useEffect(() => {
    // initial stats fill on mount
    updateStatsOnce();
    // no polling interval anymore — updates happen via onSceneChange
  }, []);

  useEffect(() => {
    return () => {
      for (const to of toastTimeoutsRef.current.values()) clearTimeout(to);
      toastTimeoutsRef.current.clear();
    };
  }, []);

  const panelTopOffset = toolbarHeight + 12;

  // ---------- Selection sync from Workspace ----------
  const handleWorkspaceSelect = (obj) => {
    setSelected(obj);
    if (!obj) {
      setMatColor('#888888'); setMatRough(0.5); setMatMetal(0); setMatHasMap(false); setMatMapURL(null);
      return;
    }
    let found = null;
    obj.traverse((n) => {
      if (!found && n.isMesh && n.material) found = n;
    });
    if (found) {
      const mat = Array.isArray(found.material) ? found.material[0] : found.material;
      if (mat && mat.color) setMatColor('#' + mat.color.getHexString());
      if (mat && typeof mat.roughness === 'number') setMatRough(mat.roughness);
      if (mat && typeof mat.metalness === 'number') setMatMetal(mat.metalness);
      if (mat && mat.map && mat.map.image) {
        setMatHasMap(true);
        setMatMapURL(mat.map.image.currentSrc || mat.map.image.src || null);
      } else { setMatHasMap(false); setMatMapURL(null); }
    } else {
      setMatColor('#888888'); setMatRough(0.5); setMatMetal(0); setMatHasMap(false); setMatMapURL(null);
    }
  };

  // ---------- Material functions ----------
  const applyMaterialToSelection = async ({ color, roughness, metalness, mapFile } = {}) => {
    if (!selected) { pushToast({ type: "error", message: "No selection to apply material" }); return; }
    selected.traverse((n) => {
      if (n.isMesh) {
        try {
          n.material = Array.isArray(n.material) ? n.material.map(m => m.clone()) : n.material.clone();
          const mats = Array.isArray(n.material) ? n.material : [n.material];
          mats.forEach((mat) => {
            if (color && mat.color) mat.color.set(color);
            if (typeof roughness === 'number' && typeof mat.roughness === 'number') mat.roughness = roughness;
            if (typeof metalness === 'number' && typeof mat.metalness === 'number') mat.metalness = metalness;
          });
        } catch (e) { console.warn("applyMaterial error", e); }
      }
    });
    if (mapFile) {
      const url = URL.createObjectURL(mapFile);
      try {
        const loader = new THREE.TextureLoader();
        loader.load(url, (tex) => {
          selected.traverse((n) => {
            if (n.isMesh && n.material) {
              const mats = Array.isArray(n.material) ? n.material : [n.material];
              mats.forEach((mat) => { mat.map = tex; mat.needsUpdate = true; });
            }
          });
          setMatHasMap(true);
          setMatMapURL(url);
          pushToast({ type: "info", message: "Texture applied" });
        }, undefined, (err) => {
          pushToast({ type: "error", message: "Failed to load texture" });
          URL.revokeObjectURL(url);
        });
      } catch (e) { URL.revokeObjectURL(url); }
    } else {
      selected.traverse((n) => {
        if (n.isMesh && n.material) {
          const mats = Array.isArray(n.material) ? n.material : [n.material];
          mats.forEach((mat) => {
            if (mat.map) {
              try { mat.map.dispose?.(); } catch (e) {}
              mat.map = null;
              mat.needsUpdate = true;
            }
          });
        }
      });
      setMatHasMap(false);
      setMatMapURL(null);
    }
    pushToast({ type: "info", message: "Material applied" });
  };

  // ---------- Lighting helpers (read from scene exposed by Workspace) ----------
  const refreshLightListFromScene = () => {
    try {
      const scene = workspaceRef.current?.scene;
      if (!scene || !scene._userGroup) { setLights([]); return; }
      const acc = [];
      scene.traverse((n) => {
        if (n.isLight && n.userData?.__objekta) {
          acc.push({
            uuid: n.uuid,
            name: n.name || n.type,
            type: n.type,
            color: '#' + new THREE.Color(n.color || 0xffffff).getHexString(),
            intensity: typeof n.intensity === 'number' ? n.intensity : 1,
          });
        }
      });
      setLights(acc);
    } catch (e) { setLights([]); }
  };

  useEffect(() => {
    // initial refresh; subsequent updates happen via onSceneChange
    refreshLightListFromScene();
  }, []);

  const addLightToScene = (type = "PointLight") => {
    try {
      workspaceRef.current?.addItem?.(type);
      pushToast({ type: "info", message: `${type} added` });
      setTimeout(() => refreshLightListFromScene(), 300);
    } catch (e) { pushToast({ type: "error", message: "Failed to add light" }); }
  };

  const updateLight = (uuid, updates = {}) => {
    try {
      const scene = workspaceRef.current?.scene;
      if (!scene || !scene._userGroup) return;
      const light = scene.getObjectByProperty('uuid', uuid);
      if (!light) return;
      if (updates.color) {
        try { light.color.set(updates.color); } catch (e) {}
      }
      if (typeof updates.intensity === 'number') light.intensity = updates.intensity;
      refreshLightListFromScene();
    } catch (e) { console.warn(e); }
  };

  const removeLight = (uuid) => {
    try {
      const scene = workspaceRef.current?.scene;
      if (!scene || !scene._userGroup) return;
      const light = scene.getObjectByProperty('uuid', uuid);
      if (light && light.parent) light.parent.remove(light);
      refreshLightListFromScene();
    } catch (e) { console.warn(e); }
  };

  // ---------- Outliner helpers (uses workspace.getSceneVersion/getSceneObjects to avoid blinking) ----------
  const OutlinerView = ({ onSelect, sceneVersion }) => {
    const [items, setItems] = useState([]);
    const lastVerRef = useRef(-1);

    useEffect(() => {
      let mounted = true;
      const scanIfNeeded = async () => {
        try {
          const ws = workspaceRef.current;
          if (!ws) return;
          const ver = typeof ws.getSceneVersion === 'function' ? ws.getSceneVersion() : null;
          // if version is provided by prop and equals last, skip
          if (typeof sceneVersion === 'number' && sceneVersion === lastVerRef.current) return;
          // otherwise proceed
          let list = [];
          if (typeof ws.getSceneObjects === 'function') {
            list = ws.getSceneObjects();
          } else {
            const scene = ws.scene;
            list = scene && scene._userGroup ? Array.from(scene._userGroup.children) : [];
          }
          if (!mounted) return;
          lastVerRef.current = ver;
          // apply outlinerSearch filter
          const filtered = outlinerSearch ? list.filter(i => (i.name || '').toLowerCase().includes(outlinerSearch.toLowerCase())) : list;
          setItems(filtered);
        } catch (e) {
          // ignore
        }
      };

      scanIfNeeded();
      // Re-run when sceneVersion or outlinerSearch changes (no interval)
      return () => { mounted = false; };
    }, [outlinerSearch, sceneVersion]);

    const toggleVisibility = (obj) => { obj.visible = !obj.visible; pushToast({ type: "info", message: `${obj.name} ${obj.visible ? "shown" : "hidden"}` }); };
    const renameObject = (obj) => {
      const nv = prompt('Rename object', obj.name || '');
      if (nv && nv !== obj.name) {
        try {
          if (workspaceRef.current?.selectObject) {
            workspaceRef.current.selectObject(obj);
            workspaceRef.current.renameSelected?.(nv);
          } else obj.name = nv;
        } catch (e) { obj.name = nv; }
        pushToast({ type: "info", message: "Renamed" });
      }
    };

    const deleteObject = (obj) => {
      if (!confirm('Delete object?')) return;
      try {
        if (workspaceRef.current?.selectObject) {
          workspaceRef.current.selectObject(obj);
          workspaceRef.current.deleteSelected?.();
        } else {
          const scene = workspaceRef.current?.scene;
          const found = scene?.getObjectByProperty('uuid', obj.uuid);
          if (found && found.parent) found.parent.remove(found);
        }
        pushToast({ type: "info", message: "Deleted" });
      } catch (e) { pushToast({ type: "error", message: "Delete failed" }); }
    };

    return (
      <div style={{ padding: 8, overflowY: 'auto', height: '100%' }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          <input placeholder="Filter..." value={outlinerSearch} onChange={e => setOutlinerSearch(e.target.value)} style={{ flex: 1, padding: 6 }} />
          <button onClick={() => { setOutlinerSearch(''); }} className="studio-btn icon-btn"><FiSearch /></button>
        </div>
        {items.map((it) => (
          <div key={it.uuid} style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '6px 8px', borderRadius: 8,
            background: it.userData?.__selected ? 'rgba(127,90,240,0.12)' : 'transparent',
            marginBottom: 6
          }}>
            <div style={{ flex: 1, cursor: 'pointer' }} onClick={() => {
              if (workspaceRef.current?.selectObject) workspaceRef.current.selectObject(it);
              else setSelected(it);
              onSelect?.(it);
            }}>
              {it.name}
            </div>
            <button title="Rename" onClick={() => renameObject(it)}>✎</button>
            <button title="Toggle visibility" onClick={() => toggleVisibility(it)}>{it.visible ? '👁' : '🚫'}</button>
            <button title="Delete" onClick={() => deleteObject(it)}>🗑</button>
          </div>
        ))}
      </div>
    );
  };

  // ---------- Collaboration (lightweight) ----------
  const startCollab = async () => {
    if (collabSocketRef.current) {
      try { collabSocketRef.current.disconnect(); } catch (e) {}
      collabSocketRef.current = null;
      setCollabConnected(false);
      pushToast({ type: "info", message: "Collab disconnected" });
      return;
    }
    setCollabLoading(true);
    try {
      const module = await import("socket.io-client");
      const io = module.io || module.default || module;
      const url = window.location.origin;
      const socket = io(url, { autoConnect: true });
      collabSocketRef.current = socket;

      socket.on("connect", () => {
        setCollabConnected(true);
        setCollabLoading(false);
        pushToast({ type: "info", message: "Connected to collab server" });
        try {
          const data = workspaceRef.current?.serializeScene?.();
          socket.emit("scene:push", { scene: data || { snaps: [] } });
        } catch (e) {}
      });

      socket.on("connect_error", (err) => {
        setCollabLoading(false);
        pushToast({ type: "error", message: "Collab connect failed" });
        console.error("collab connect err", err);
      });

      socket.on("scene:push", (payload) => {
        try {
          if (!payload || !payload.scene) return;
          const remote = payload.scene;
          const ok = window.confirm("Remote collaborator pushed a scene. Load it now (will replace current scene)?");
          if (ok) {
            workspaceRef.current?.loadFromData?.(remote);
            pushToast({ type: "info", message: "Loaded remote scene" });
          }
        } catch (e) { console.warn(e); }
      });

      socket.on("disconnect", () => {
        setCollabConnected(false);
        pushToast({ type: "info", message: "Collab disconnected" });
      });
    } catch (e) {
      console.error("collab start failed", e);
      pushToast({ type: "error", message: "Failed to start collab (see console)" });
      setCollabLoading(false);
    }
  };

  // ---------- Delete / Duplicate helpers ----------
  const requestDeleteSelected = () => {
    if (!selected) return;
    setConfirmState({
      open: true,
      title: "Delete selected object",
      message: `Are you sure you want to delete '${selected.name || "object"}'? This cannot be undone.`,
      onConfirm: () => {
        workspaceRef.current?.deleteSelected?.();
        setSelected(null);
        setConfirmState((s) => ({ ...s, open: false }));
        pushToast({ type: "info", message: "Deleted object" });
      },
    });
  };

  const requestResetScene = () => {
    setConfirmState({
      open: true,
      title: "Reset scene",
      message: "Resetting will remove all objects from the scene. Continue?",
      onConfirm: () => {
        workspaceRef.current?.resetScene?.();
        setConfirmState((s) => ({ ...s, open: false }));
        setSelected(null);
        pushToast({ type: "info", message: "Scene reset" });
      },
    });
  };

  // ---------- Sculpting placeholder ----------
  const [sculptMode, setSculptMode] = useState(false);
  const toggleSculpt = () => {
    setSculptMode((v) => {
      const next = !v;
      try {
        if (next) {
          workspaceRef.current?.startSculpting?.();
          pushToast({ type: "info", message: "Sculpt mode ON (placeholder)" });
        } else {
          workspaceRef.current?.stopSculpting?.();
          pushToast({ type: "info", message: "Sculpt mode OFF (placeholder)" });
        }
      } catch (e) { pushToast({ type: "error", message: "Sculpt not available" }); }
      return next;
    });
  };

  // ---------- Panel UI state -->
  const [propsTab, setPropsTab] = useState("props"); // props | material | lights | outliner | validate

  // ---------- Material form submit ----------
  const onApplyMaterialSubmit = (e) => {
    e.preventDefault();
    const input = document.getElementById("tex-upload-input");
    const file = input?.files?.[0] ?? null;
    applyMaterialToSelection({ color: matColor, roughness: matRough, metalness: matMetal, mapFile: file });
  };

  const removeTexture = () => {
    applyMaterialToSelection({ color: matColor, roughness: matRough, metalness: matMetal, mapFile: null });
  };

  const handleOutlinerSelect = (obj) => {
    if (workspaceRef.current?.selectObject) workspaceRef.current.selectObject(obj);
    else if (window.__OBJEKTA_WORKSPACE?.selectObject) window.__OBJEKTA_WORKSPACE.selectObject(obj);
    setSelected(obj);
  };

  // ---------- Validation ----------
  const [validationResult, setValidationResult] = useState(null);
  const runValidation = async () => {
    try {
      const res = await workspaceRef.current?.validateScene?.();
      setValidationResult(res || null);
      if (res && res.ok) pushToast({ type: "info", message: "Validation completed" });
      else pushToast({ type: "error", message: "Validation failed (see panel)" });
      setPropsTab('validate');
    } catch (e) {
      setValidationResult({ ok: false, error: e.message || String(e) });
      pushToast({ type: "error", message: "Validation error" });
      setPropsTab('validate');
    }
  };

  // ---------- Save / Load project (localStorage) ----------
  const [lastSaveAt, setLastSaveAt] = useState(null);
  const saveProject = (name = "latest") => {
    try {
      const data = workspaceRef.current?.serializeScene?.();
      if (!data) { pushToast({ type: "error", message: "Nothing to save" }); return; }
      localStorage.setItem(`objekta_project_${name}`, JSON.stringify({ meta: { savedAt: new Date().toISOString() }, data }));
      setLastSaveAt(new Date().toISOString());
      pushToast({ type: "info", message: `Project saved (${name})` });
    } catch (e) { pushToast({ type: "error", message: "Save failed" }); }
  };
  const loadLastProject = (name = "latest") => {
    try {
      const raw = localStorage.getItem(`objekta_project_${name}`);
      if (!raw) { pushToast({ type: "error", message: "No saved project found" }); return; }
      const parsed = JSON.parse(raw);
      if (!parsed?.data) { pushToast({ type: "error", message: "Invalid project data" }); return; }
      workspaceRef.current?.loadFromData?.(parsed.data);
      pushToast({ type: "info", message: `Project loaded (${name})` });
    } catch (e) { pushToast({ type: "error", message: "Load failed" }); }
  };

  // ---------- Scene change handler (event-driven) ----------
  const handleSceneChange = (version) => {
    // update local sceneVersion so OutlinerView will rescan
    setSceneVersion(version ?? (v => v + 1));
    // refresh derived UI pieces
    refreshLightListFromScene();
    updateStatsOnce();
  };

  // ---------- Render ----------
  return (
    <DndProvider backend={HTML5Backend}>
      <div ref={containerRef} className="studio-container">
        <ToastContainer toasts={toasts} remove={removeToast} />
        <Loader active={loading || collabLoading} message={loading ? `Importing model...` : (collabLoading ? "Connecting to collab..." : "")} progress={loadProgress} />
        <ConfirmModal
          open={confirmState.open}
          title={confirmState.title}
          message={confirmState.message}
          onCancel={() => setConfirmState((s) => ({ ...s, open: false }))}
          onConfirm={() => { confirmState.onConfirm?.(); setConfirmState((s) => ({ ...s, open: false })); }}
        />

        <div className="studio-panel palette-panel" style={{ width: paletteCollapsed ? 44 : paletteWidth, minWidth: paletteCollapsed ? 44 : 120 }}>
          {!paletteCollapsed ? (
            <Palette
              items={PALETTE_ITEMS.map((it) => ({ ...it, fav: !!favorites[it.name] }))}
              onAction={(name, client) => workspaceRef.current?.addItem?.(name, client)}
            />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "center", paddingTop: 8 }}>
            </div>
          )}
          {!paletteCollapsed && (<div className="palette-resizer" onMouseDown={startResize} />)}
          <div style={{ position: "absolute", right: 8, top: 8 }}>
            <button
              title={paletteCollapsed ? "Open Palette (P)" : "Collapse Palette (P)"}
              onClick={() => setPaletteCollapsed((v) => !v)}
              className="studio-btn icon-btn"
            >
              <FiSidebar />
            </button>
          </div>
        </div>

        <div className="workspace-area">
          <div ref={toolbarRef} className="studio-toolbar">
            <button className="studio-btn icon-btn" onClick={undo} title="Undo (Ctrl/Cmd+Z)"><FiRotateCcw /></button>
            <button className="studio-btn icon-btn" onClick={redo} title="Redo (Ctrl/Cmd+Y)"><FiRotateCw /></button>

            <div className="segmented-control">
              {[["translate", "Move"], ["rotate", "Rotate"], ["scale", "Scale"]].map(([m, label]) => (
                <button key={m} onClick={() => setMode(m)} className={activeMode === m ? 'active' : ''} title={`${label} mode`}>{label}</button>
              ))}
            </div>

            <div className="studio-btn snap-control">
              <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }} title="Toggle snapping">
                <input type="checkbox" checked={snapEnabled} onChange={toggleSnap} />
                Snap
              </label>
              <input type="number" value={snapSize} step={0.1} min={0} onChange={(e) => { const v = parseFloat(e.target.value); if (Number.isFinite(v)) setSnapSize(v); }} title="Snap size" />
            </div>

            <button className="studio-btn icon-btn" onClick={() => { workspaceRef.current?.duplicateSelected?.(); pushToast({ type: "info", message: "Duplicated selection" }); }} title="Duplicate (Ctrl/Cmd+D)">
              <FiCopy />
            </button>

            <label className="studio-btn icon-btn" title="Import GLB/GLTF">
              <FiUpload />
              <input type="file" accept=".glb,.gltf" style={{ display: "none" }} onChange={(e) => { const file = e.target.files?.[0]; if (file) { importGLTF(file); e.target.value = ""; } }} />
            </label>

            <button className="studio-btn icon-btn" onClick={() => exportGLTF(true)} title="Export as GLB"><FiSave /></button>

            <button className="studio-btn icon-btn" onClick={saveJSON} title="Save JSON (Ctrl/Cmd+S)"><FiPlusSquare /></button>
            <button className="studio-btn icon-btn" onClick={requestResetScene} title="Reset Scene"><FiRefreshCcw /></button>

            <button className="studio-btn icon-btn" onClick={() => {
              const el = containerRef.current; if (!el) return;
              if (!document.fullscreenElement) el.requestFullscreen(); else document.exitFullscreen();
            }} title={isFullScreen ? "Exit Fullscreen" : "Fullscreen"}>
              {isFullScreen ? <FiMinimize /> : <FiMaximize />}
            </button>

            <button className="studio-btn icon-btn" onClick={() => setPropsCollapsed((v) => !v)} title="Toggle Inspector (I)"><FiLayers /></button>

            <button className={`studio-btn icon-btn ${collabConnected ? 'connected' : ''}`} onClick={startCollab} title={collabConnected ? "Disconnect collaboration" : "Start collaboration"}>
              {collabConnected ? <FiWifi /> : <FiWifiOff />}
            </button>

            <button className="studio-btn icon-btn" onClick={() => toggleSculpt()} title="Sculpt (placeholder)">🪵</button>

            {/* Save / Load project */}
            <div style={{ marginLeft: 8, display: "flex", gap: 6 }}>
              <button className="studio-btn" onClick={() => saveProject("latest")}>Save Project</button>
              <button className="studio-btn" onClick={() => loadLastProject("latest")}>Load Last</button>
              <button className="studio-btn" onClick={() => runValidation()}>Validate</button>
            </div>
          </div>

          <Workspace
            ref={workspaceRef}
            selected={selected}
            onSelect={handleWorkspaceSelect}
            panelTopOffset={panelTopOffset}
            onSceneChange={handleSceneChange}
          />

          {!propsCollapsed && (
            <div ref={panelRef} className="studio-panel properties-panel" style={{ width: propsWidth, top: panelPos.top, right: panelPos.right }}>
              <div className="properties-resizer" onMouseDown={startPropsResize} />
              <div className="properties-drag-handle" onMouseDown={startDrag}><div /><div /><div /></div>

              <div style={{ display: 'flex', gap: 6, padding: 8 }}>
                <button onClick={() => setPropsTab('props')} className={propsTab === 'props' ? 'active' : ''}>Transform</button>
                <button onClick={() => setPropsTab('material')} className={propsTab === 'material' ? 'active' : ''}>Material</button>
                <button onClick={() => setPropsTab('lights')} className={propsTab === 'lights' ? 'active' : ''}>Lighting</button>
                <button onClick={() => setPropsTab('outliner')} className={propsTab === 'outliner' ? 'active' : ''}>Outliner</button>
                <button onClick={() => setPropsTab('validate')} className={propsTab === 'validate' ? 'active' : ''}>Validate</button>
              </div>

              <div style={{ padding: 8, overflowY: 'auto', height: 'calc(100% - 72px)' }}>
                {propsTab === 'props' && selected && (
                  <ObjectProperties
                    selected={selected}
                    onTransformChange={(prop, axis, val) => workspaceRef.current?.handleTransformChange?.(prop, axis, val)}
                    onColorChange={(col) => { if (selected) { selected.traverse((n) => { if (n.isMesh && n.material) { try { n.material.color.set(col); } catch (e) {} } }); pushToast({ type: "info", message: "Color updated" }); } }}
                    onVisibilityToggle={(vis) => { if (selected) selected.visible = vis; }}
                    onDelete={requestDeleteSelected}
                    onRename={(name) => {
                      if (workspaceRef.current?.renameSelected) {
                        workspaceRef.current.renameSelected(name);
                      } else {
                        selected.name = name;
                      }
                    }}
                  />
                )}

                {propsTab === 'material' && (
                  <div>
                    <div style={{ fontWeight: 700, marginBottom: 8 }}>Material Editor</div>
                    <form onSubmit={onApplyMaterialSubmit}>
                      <div style={{ marginBottom: 8 }}>
                        <label style={{ display: 'block', fontSize: 12 }}>Color</label>
                        <input type="color" value={matColor} onChange={(e) => setMatColor(e.target.value)} />
                      </div>
                      <div style={{ marginBottom: 8 }}>
                        <label style={{ display: 'block', fontSize: 12 }}>Roughness: {matRough.toFixed(2)}</label>
                        <input type="range" min="0" max="1" step="0.01" value={matRough} onChange={(e) => setMatRough(parseFloat(e.target.value))} style={{ width: '100%' }} />
                      </div>
                      <div style={{ marginBottom: 8 }}>
                        <label style={{ display: 'block', fontSize: 12 }}>Metalness: {matMetal.toFixed(2)}</label>
                        <input type="range" min="0" max="1" step="0.01" value={matMetal} onChange={(e) => setMatMetal(parseFloat(e.target.value))} style={{ width: '100%' }} />
                      </div>

                      <div style={{ marginBottom: 8 }}>
                        <label style={{ display: 'block', fontSize: 12 }}>Texture (optional)</label>
                        <input id="tex-upload-input" type="file" accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) setMatMapURL(URL.createObjectURL(f)); }} />
                        {matMapURL && <div style={{ marginTop: 8, display: 'flex', gap: 8, alignItems: 'center' }}>
                          <img src={matMapURL} alt="preview" style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 6 }} />
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <div style={{ fontSize: 12 }}>{matHasMap ? 'Applied texture' : 'New texture (pending)'}</div>
                            <div style={{ marginTop: 6 }}>
                              <button type="button" className="studio-btn" onClick={() => {
                                const file = document.getElementById('tex-upload-input')?.files?.[0];
                                applyMaterialToSelection({ color: matColor, roughness: matRough, metalness: matMetal, mapFile: file });
                              }}>Apply texture</button>
                              <button type="button" className="studio-btn" onClick={() => { removeTexture(); }}>Remove</button>
                            </div>
                          </div>
                        </div>}
                      </div>

                      <div style={{ display: 'flex', gap: 8 }}>
                        <button type="submit" className="launch-btn">Apply</button>
                        <button type="button" className="studio-btn" onClick={() => { if (selected) { selected.traverse((n) => { if (n.isMesh && n.material) { try { n.material.color.set('#888888'); n.material.roughness = 0.5; n.material.metalness = 0.0; } catch (e) {} } }); pushToast({ type: "info", message: "Reset material" }); } }}>Reset</button>
                      </div>
                    </form>
                  </div>
                )}

                {propsTab === 'lights' && (
                  <div>
                    <div style={{ fontWeight: 700, marginBottom: 8 }}>Lighting</div>
                    <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                      <button className="studio-btn" onClick={() => addLightToScene('Point Light')}><FiSun /> Point</button>
                      <button className="studio-btn" onClick={() => addLightToScene('Spot Light')}><FiStar /> Spot</button>
                      <button className="studio-btn" onClick={() => addLightToScene('Directional Light')}><FiRotateCw /> Dir</button>
                      <button className="studio-btn" onClick={() => addLightToScene('Hemisphere Light')}><FiMoon /> Hemi</button>
                    </div>

                    <div>
                      {lights.length === 0 && <div style={{ color: 'var(--text-muted)' }}>No lights in scene</div>}
                      {lights.map(l => (
                        <div key={l.uuid} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', padding: 8, display: 'flex', gap: 8, alignItems: 'center' }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 700 }}>{l.name}</div>
                            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{l.type}</div>
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
                            <input type="color" value={l.color} onChange={(e) => updateLight(l.uuid, { color: e.target.value })} />
                            <input type="range" min="0" max="4" step="0.01" value={l.intensity} onChange={(e) => updateLight(l.uuid, { intensity: parseFloat(e.target.value) })} />
                            <div style={{ display: 'flex', gap: 6 }}>
                              <button className="studio-btn" onClick={() => removeLight(l.uuid)}>Remove</button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {propsTab === 'outliner' && (
                  <div>
                    <div style={{ fontWeight: 700, marginBottom: 8 }}>Scene Outliner</div>
                    <OutlinerView onSelect={handleOutlinerSelect} sceneVersion={sceneVersion} />
                  </div>
                )}

                {propsTab === 'validate' && (
                  <div>
                    <div style={{ fontWeight: 700, marginBottom: 8 }}>Validation</div>
                    <div style={{ marginBottom: 10 }}>
                      <button className="launch-btn" onClick={() => runValidation()}>Run Validation</button>
                      <button className="studio-btn" onClick={() => setValidationResult(null)}>Clear</button>
                    </div>

                    {!validationResult && <div style={{ color: 'var(--text-muted)' }}>No validation run yet. Click "Run Validation".</div>}

                    {validationResult && (
                      <div style={{ fontSize: 13 }}>
                        {validationResult.ok ? <div style={{ color: 'var(--success)' }}>OK</div> : <div style={{ color: 'var(--danger)' }}>Issues found</div>}
                        <pre style={{ whiteSpace: 'pre-wrap', marginTop: 8, fontSize: 12, color: 'var(--text-muted)' }}>
{JSON.stringify(validationResult, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </div>

            </div>
          )}
        </div>

        <div className="status-bar">
            Objects: {stats.objects} • Tris: {stats.tris} • Selected: {selected ? (selected.name || selected.uuid) : "—"} • Snap: {snapEnabled ? `${snapSize}` : "off"} • Collab: {collabConnected ? 'on' : 'off'} {lastSaveAt ? ` • Saved: ${new Date(lastSaveAt).toLocaleString()}` : ''}
        </div>

        {ctxMenu && (
          <div className="context-menu" style={{ left: ctxMenu.x, top: ctxMenu.y }} onMouseLeave={closeContext}>
              <button className="context-menu-btn" onClick={ctxDuplicate}><FiCopy style={{ marginRight: 8 }} /> Duplicate</button>
              <button className="context-menu-btn delete" onClick={ctxDelete}><FiTrash2 style={{ marginRight: 8 }} /> Delete</button>
              <button className="context-menu-btn" onClick={ctxExport}><FiSave style={{ marginRight: 8 }} /> Export GLB</button>
              <button className="context-menu-btn" onClick={ctxSave}><FiPlusSquare style={{ marginRight: 8 }} /> Save JSON</button>
              <button className="context-menu-btn" onClick={ctxReset}><FiRefreshCcw style={{ marginRight: 8 }} /> Reset Scene</button>
          </div>
        )}
      </div>
    </DndProvider>
  );
}
