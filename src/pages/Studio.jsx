// src/pages/Studio.jsx
import React, { useRef, useState, useEffect, useCallback, lazy, Suspense } from "react";
import { createPortal } from "react-dom";
// Static pako import keeps compression available even if dynamic import fails
import { deflate } from "pako";
import * as THREE from "three";
import { TransformControls } from "three/examples/jsm/controls/TransformControls.js";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import {
  FiSave, FiUpload, FiRefreshCcw, FiMaximize, FiMinimize, FiRotateCcw,
  FiRotateCw, FiPlusSquare, FiCopy, FiWifi, FiWifiOff,
  FiZap, FiGrid, FiCamera, FiMove, FiImage,
  FiDroplet, FiCloudRain, FiSun, FiVideo, FiEdit3, FiLayout,
  FiMenu, FiPlus, FiTrash2, FiEye, FiArrowLeft, FiDownloadCloud, FiUploadCloud
} from "react-icons/fi";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

import Palette from "../components/Palette";
import Workspace from "../components/Workspace";
import ObjectProperties from "../components/ObjectProperties";
import Outliner from "../components/Outliner";
const SculptToolbar = lazy(() => import("../components/SculptToolbar"));
import { loadInitialPanels, persistPanelStates } from "../utils/preferences";
import { ensurePersistentStorage, logQuotaIfAny } from "../utils/storage";
import Timeline from "../components/Timeline";
import StudioToast from "../components/StudioToast";
import Loader from "../components/Loader";
const BackupsPanel = lazy(() => import("../components/BackupsPanel"));
const VersionTimeline = lazy(() => import("../components/VersionTimeline"));
import "../styles/Studio.css";

import { SceneGraphStore } from "../store/SceneGraphStore";
import EventBus from "../utils/EventBus";

import initCameraControls from "../components/CameraControls";
import setupDefaultLighting from "../components/LightingSetup";
import setupEnvironment from "../components/EnvironmentSetup";
import initGLBImporter from "../components/GLBImporter";
import createMaterialEditor from "../components/MaterialEditor";
import setupPostProcessing from "../components/PostProcessing";
import { API_BASE, apiUrl } from "../utils/api";

// Extracted studio sub-modules
import { PALETTE_ITEMS } from "./studio/constants";
import ConfirmModal from "./studio/ConfirmModal";
import CenterWelcomeCard from "./studio/CenterWelcomeCard";
import { saveBackupToIndexedDB } from "./studio/backupDB";
import useCollaboration from "../collaboration/useCollaboration";
import usePhysics from "../hooks/usePhysics";
const PresencePanel = lazy(() => import("../collaboration/PresencePanel"));
const PhysicsPanel = lazy(() => import("../components/PhysicsPanel"));
const PhysicsToolbar = lazy(() => import("../components/PhysicsToolbar"));
const PhysicsDebugRenderer = lazy(() => import("../components/PhysicsDebugRenderer"));
const JointEditor = lazy(() => import("../components/JointEditor"));
const JointVisualizer = lazy(() => import("../components/JointVisualizer"));
const AIChatPanel = lazy(() => import("../components/AIChatPanel"));
const MeshToolsPanel = lazy(() => import("../components/MeshToolsPanel"));
const OptimizationPanel = lazy(() => import("../components/OptimizationPanel"));
const ProceduralPanel = lazy(() => import("../components/ProceduralPanel"));
const MaterialLibraryPanel = lazy(() => import("../components/MaterialLibraryPanel"));
const PostFXPanel = lazy(() => import("../components/PostFXPanel"));

/* ---------------------------
   Main Studio component
   --------------------------- */

export default function Studio() {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout, user: authUser } = useAuth() || {};

  // refs & API handles
  const workspaceRef = useRef(null);
  const panelRef = useRef(null);
  const containerRef = useRef(null);
  const toolbarRef = useRef(null);

  const lightingApiRef = useRef(null);
  const envApiRef = useRef(null);
  const importerApiRef = useRef(null);
  const cameraControlsApiRef = useRef(null);
  const materialEditorApiRef = useRef(null);
  const postApiRef = useRef(null);
  const transformControlsRef = useRef(null);

  // Reduce page scroll while in Studio, but DON'T hide element scrollbars — keep internal rails usable
  useEffect(() => {
    const enterStudio = () => {
      document.body.classList.add('studio-active');
      // prevent body/document scrolling while studio is active
      document.documentElement.style.overflow = 'hidden';
      document.body.style.overflow = 'hidden';
    };

    enterStudio();

    return () => {
      document.body.classList.remove('studio-active');
      document.documentElement.style.overflow = '';
      document.body.style.overflow = '';

      // remove any legacy injected style if present (from earlier runs)
      const existingStyle = document.getElementById('studio-scrollbar-hide');
      if (existingStyle) existingStyle.remove();
    };
  }, []);

  useEffect(() => {
    return () => {
      try { postApiRef.current?.dispose?.(); } catch (e) {}
      try { cameraControlsApiRef.current?.dispose?.(); } catch (e) {}
      try { importerApiRef.current?.dispose?.(); } catch (e) {}
      try { materialEditorApiRef.current?.dispose?.(); } catch (e) {}
      try { envApiRef.current?.dispose?.(); } catch (e) {}
      try { lightingApiRef.current?.dispose?.(); } catch (e) {}

      postApiRef.current = null;
      cameraControlsApiRef.current = null;
      importerApiRef.current = null;
      materialEditorApiRef.current = null;
      envApiRef.current = null;
      lightingApiRef.current = null;
    };
  }, []);

  // UI state
  const [selected, setSelected] = useState(null);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [panelPos, setPanelPos] = useState({ top: 50, right: 20 });

  const [paletteWidth, setPaletteWidth] = useState(() => {
    const raw = localStorage.getItem("objekta_palette_width");
    const n = parseInt(raw, 10);
    return Number.isFinite(n) ? Math.max(120, Math.min(420, n)) : 180;
  });
  const paletteWidthRef = useRef(paletteWidth);
  useEffect(() => { paletteWidthRef.current = paletteWidth; }, [paletteWidth]);

  const initialPanels = loadInitialPanels();
  const [paletteCollapsed, setPaletteCollapsed] = useState(initialPanels.paletteCollapsed);
  useEffect(() => { persistPanelStates({ paletteCollapsed, propsCollapsed: false }); }, [paletteCollapsed]);
  const togglePaletteCollapse = useCallback(() => setPaletteCollapsed(v => !v), []);
  useEffect(() => {
    const handler = (e) => {
      if (e.defaultPrevented) return;
      const tag = e.target?.tagName;
      if (tag && ['INPUT', 'TEXTAREA', 'SELECT'].includes(tag)) return;
      if (e.target?.isContentEditable) return;
      if ((e.key === 'p' || e.key === 'P') && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        togglePaletteCollapse();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [togglePaletteCollapse]);
  const [propsWidth, setPropsWidth] = useState(() => {
    const raw = localStorage.getItem("objekta_props_width");
    const n = parseInt(raw, 10);
    return Number.isFinite(n) ? Math.max(240, Math.min(460, n)) : 300;
  });
  const propsWidthRef = useRef(propsWidth);
  useEffect(() => { propsWidthRef.current = propsWidth; }, [propsWidth]);

  // toasts
  const [toasts, setToasts] = useState([]);
  const nextToastIdRef = useRef(1);
  const toastTimeoutsRef = useRef(new Map());
  const pushToast = useCallback((t, ttl = 5000) => {
    const id = nextToastIdRef.current++;
    setToasts((s) => [...s, { ...t, id }]);
    const to = setTimeout(() => setToasts((s) => s.filter((x) => x.id !== id)), ttl);
    toastTimeoutsRef.current.set(id, to);
  }, []);
  const removeToast = useCallback((id) => {
    setToasts((s) => s.filter((x) => x.id !== id));
    const to = toastTimeoutsRef.current.get(id);
    if (to) { clearTimeout(to); toastTimeoutsRef.current.delete(id); }
  }, []);
  useEffect(() => {
    const timers = toastTimeoutsRef.current;
    return () => {
      for (const to of timers.values()) clearTimeout(to);
      timers.clear();
    };
  }, []);

  const forcedLogoutRef = useRef(false);
  useEffect(() => { forcedLogoutRef.current = false; }, [location?.pathname, logout]);
  const forceLogoutDueTo401 = useCallback((reason = "Session expired. Please sign in again.") => {
    if (forcedLogoutRef.current) return;
    forcedLogoutRef.current = true;
    pushToast({ type: "error", title: "Authentication", message: reason || "Session expired. Please sign in again." }, 6200);
    logout?.();
    navigate("/login");
  }, [logout, navigate, pushToast]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handler = () => forceLogoutDueTo401();
    window.addEventListener("objekta:session-expired", handler);
    return () => window.removeEventListener("objekta:session-expired", handler);
  }, [forceLogoutDueTo401]);

  // Request persistent storage once toast helpers are available
  useEffect(() => {
    let mounted = true;
    (async () => {
      const res = await ensurePersistentStorage();
      if (!mounted) return;
      if (res.persisted) {
        pushToast?.({ type: 'info', title: 'Storage Ready', message: 'Persistent storage granted for large scenes.' }, 4000);
      }
      await logQuotaIfAny('StudioStorage');
    })();
    return () => { mounted = false; };
  }, [pushToast]);

  useEffect(() => {
    const onImportStats = (stats) => {
      const tris = stats?.triangles || 0;
      const tex = stats?.totalTexels || 0;
      pushToast({
        type: 'info',
        title: 'Import analyzed',
        message: `${(tris/1e6).toFixed(2)}M tris, ${(tex/1e6).toFixed(1)} MP texels${stats?.downscaled ? `, downscaled ${stats.downscaled} textures` : ''}`
      }, 7000);
    };
    const onMissing = (list) => {
      if (!list || list.length === 0) return;
      const preview = list.slice(0, 3).join(', ');
      pushToast({ type: 'error', title: 'Missing resources', message: `${preview}${list.length > 3 ? '…' : ''}` }, 8000);
    };
    const onImportError = (payload) => {
      if (!payload) return;
      const hint = payload.hint ? ` ${payload.hint}` : '';
      pushToast({ type: 'error', title: 'Import failed', message: `${payload.message || 'Check console.'}${hint}` }, 8000);
    };
    const onImportWarning = (payload) => {
      if (!payload) return;
      pushToast({ type: 'info', title: 'Import note', message: payload.message || 'Check console.' }, 6000);
    };
    EventBus.on?.('import:stats', onImportStats);
    EventBus.on?.('import:missingResources', onMissing);
    EventBus.on?.('import:error', onImportError);
    EventBus.on?.('import:warning', onImportWarning);
    return () => {
      EventBus.off?.('import:stats', onImportStats);
      EventBus.off?.('import:missingResources', onMissing);
      EventBus.off?.('import:error', onImportError);
      EventBus.off?.('import:warning', onImportWarning);
    };
  }, [pushToast]);

  // busy / loaders
  const [loading, setLoading] = useState(false);
  const [loadProgress, setLoadProgress] = useState(null);

  const [confirmState, setConfirmState] = useState({ open: false, title: "", message: "", onConfirm: null });
  // Helper: show a confirm dialog and await user's choice (resolve true = confirm, false = cancel)
  const askConfirm = useCallback(({ title = "Confirm", message = "Are you sure?", confirmLabel = "Confirm", cancelLabel = "Cancel" }) => {
    return new Promise((resolve) => {
      setConfirmState({
        open: true,
        title,
        message,
        confirmLabel,
        cancelLabel,
        onConfirm: () => { setConfirmState((s) => ({ ...s, open: false })); resolve(true); },
        onCancel: () => { setConfirmState((s) => ({ ...s, open: false })); resolve(false); },
      });
    });
  }, []);

  // Helper: ask for text input using the ConfirmModal and get the entered value
  const promptInput = useCallback(({ title = "Input", message = "", placeholder = "", defaultValue = "" }) => {
    return new Promise((resolve) => {
      setConfirmState({
        open: true,
        title,
        message,
        showInput: true,
        inputDefault: defaultValue,
        inputPlaceholder: placeholder,
        onConfirm: (val) => { setConfirmState((s) => ({ ...s, open: false })); resolve({ confirmed: true, value: val }); },
        onCancel: () => { setConfirmState((s) => ({ ...s, open: false })); resolve({ confirmed: false }); },
      });
    });
  }, []);
  const resizingRef = useRef(false);
  const draggingRef = useRef(false);
  const offsetRef = useRef({ x: 0, y: 0 });
  const [activeMode, setActiveMode] = useState("translate");
  const [viewMode, setViewMode] = useState("rendered");

  // snapping
  const [snapEnabled, setSnapEnabled] = useState(false);
  const [snapSize, setSnapSize] = useState(() => {
    const raw = localStorage.getItem("objekta_snap");
    const v = raw ? parseFloat(raw) : 0.5;
    return Number.isFinite(v) ? v : 0.5;
  });
  useEffect(() => { localStorage.setItem("objekta_snap", String(snapSize)); try { workspaceRef.current?.setSnapValue?.(snapSize); } catch (e) {} }, [snapSize]);

  // material editor state (compact)
  const [matColor, setMatColor] = useState("#888888");
  const [matRough, setMatRough] = useState(0.5);
  const [matMetal, setMatMetal] = useState(0.0);
  const [matHasMap, setMatHasMap] = useState(false);
  const [matMapURL, setMatMapURL] = useState(null);
  const prevMatMapRef = useRef(null);
  useEffect(() => {
    const prev = prevMatMapRef.current;
    if (prev && typeof prev === 'string' && prev.startsWith && prev.startsWith('blob:') && prev !== matMapURL) {
      // Delay revocation to allow any pending loaders to finish
      setTimeout(() => {
        try { URL.revokeObjectURL(prev); } catch (e) {}
      }, 1000);
    }
    prevMatMapRef.current = matMapURL;
    return () => { 
      setTimeout(() => {
        try { if (matMapURL && matMapURL.startsWith && matMapURL.startsWith('blob:')) URL.revokeObjectURL(matMapURL); } catch (e) {} 
      }, 1000);
    };
  }, [matMapURL]);

  // lights / collaboration / outliner / validation
  const [lights, setLights] = useState([]);
  const [collabConnected, setCollabConnected] = useState(false);
  const collabSocketRef = useRef(null);
  const [collabLoading, setCollabLoading] = useState(false);
  const collabErrorGateRef = useRef({ lastToast: 0, logged: false });
  const [outlinerSearch, setOutlinerSearch] = useState("");
  const [sceneVersion, setSceneVersion] = useState(0);
  const [propsTab, setPropsTab] = useState("props");
  const [envColor, setEnvColor] = useState("#111122");
  const [showFileMenu, setShowFileMenu] = useState(false);
  const [fileMenuPos, setFileMenuPos] = useState({ top: 44, left: 12 });
  const fileMenuRef = useRef(null);
  const fileMenuButtonRef = useRef(null);
  const fileMenuDropdownRef = useRef(null);
    // track last environment file for persistence during save
    const envFileRef = useRef(null);
  // Close file menu on outside click
  useEffect(() => {
    if (!showFileMenu) return;
    const handler = (e) => {
      const target = e.target;
      const clickedInsideToolbar = fileMenuRef.current && fileMenuRef.current.contains(target);
      const clickedInsideDropdown = fileMenuDropdownRef.current && fileMenuDropdownRef.current.contains(target);
      if (!clickedInsideToolbar && !clickedInsideDropdown) setShowFileMenu(false);
    };
    const updateMenuPosition = () => {
      const rect = fileMenuButtonRef.current?.getBoundingClientRect?.();
      if (!rect) return;
      const width = 250;
      const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8));
      setFileMenuPos({ top: Math.round(rect.bottom + 6), left: Math.round(left) });
    };
    updateMenuPosition();
    document.addEventListener('mousedown', handler);
    window.addEventListener('resize', updateMenuPosition);
    window.addEventListener('scroll', updateMenuPosition, true);
    return () => {
      document.removeEventListener('mousedown', handler);
      window.removeEventListener('resize', updateMenuPosition);
      window.removeEventListener('scroll', updateMenuPosition, true);
    };
  }, [showFileMenu]);
  const [bloomEnabled, setBloomEnabled] = useState(false);
  const [oceanEnabled, setOceanEnabled] = useState(false);
  const [rainEnabled, setRainEnabled] = useState(false);
  const [environmentActive, setEnvironmentActive] = useState(false);
  const [validationResult, setValidationResult] = useState(null);

  // ---------- Dashboard / Backend state ----------
  const [projects, setProjects] = useState([]); // normalized: { _id, name, lastSavedAt, thumbnailUrl }
  const [projectId, setProjectId] = useState(null);
  const [projectName, setProjectName] = useState("Untitled Project");
  const [isSaving, setIsSaving] = useState(false);
  const [isAutosave] = useState(true);
  const [_isConnectedToServer, setIsConnectedToServer] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState(null);
  const [isDirty, setIsDirty] = useState(false);

  const projectSocketRef = useRef(null);
  const autosaveTimerRef = useRef(null);
  const lastLocalSnapshotRef = useRef(null);
  const lastServerSavedAtRef = useRef(null);
  const isApplyingRemoteRef = useRef(false);

  // upload progress (fraction 0..1) for current save operation (visual in Studio)
  const [saveProgress, setSaveProgress] = useState(0);

  // --- Yjs CRDT Collaboration ---
  const collabUser = authUser ? { id: authUser._id || authUser.id, name: authUser.name || authUser.email } : null;
  const {
    status: yjsStatus,
    yjsConnected,
    remoteUsers,
    pushObjectUpdate,
    pushObjectRemove,
    lockObject,
    unlockObject,
    isLockedByOther,
    setCursor: setCollabCursor,
    setSelectedObjects: setCollabSelected,
  } = useCollaboration({ projectId, user: collabUser, workspaceRef, onToast: (t) => { try { pushToast(t); } catch (e) {} } });

  // --- Physics (Rapier WASM) ---
  const {
    ready: physicsReady,
    running: physicsRunning,
    gravity: physicsGravity,
    debugVisible: physicsDebugVisible,
    setDebugVisible: setPhysicsDebugVisible,
    bodies: physicsBodies,
    manager: physicsManagerRef,
    addPhysicsBody,
    removePhysicsBody,
    updatePhysicsBody,
    hasPhysicsBody,
    getPhysicsConfig,
    playPhysics,
    pausePhysics,
    resetPhysics,
    stepPhysics,
    setGravityPreset: setPhysicsGravityPreset,
    addJoint: addPhysicsJoint,
    removeJoint: removePhysicsJoint,
    getJoints: getPhysicsJoints,
    getJointsForBody: getPhysicsJointsForBody,
    addTrigger: addPhysicsTrigger,
    removeTrigger: removePhysicsTrigger,
    applyImpulse: applyPhysicsImpulse,
    getDebugLines: getPhysicsDebugLines,
    createRagdoll: createPhysicsRagdoll,
    bakeToKeyframes: bakePhysicsToKeyframes,
  } = usePhysics(workspaceRef);

  // Connect physics step to Workspace render loop
  useEffect(() => {
    const ws = workspaceRef.current;
    if (ws?.setPhysicsStep) {
      ws.setPhysicsStep(stepPhysics);
    }
    return () => {
      if (ws?.setPhysicsStep) ws.setPhysicsStep(null);
    };
  }, [stepPhysics]);

  const safeDate = useCallback(() => new Date().toISOString().replace(/[:.]/g, "-"), []);

  /* ---------- API base & helpers (centralized) ---------- */
  const getAuthHeaders = useCallback(() => {
    // match the token key used in your AuthContext: "objekta_token"
    const token = localStorage.getItem("objekta_token") || localStorage.getItem("token");
    const headers = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    return headers;
  }, []);

  const safeJson = async (res) => {
    // resilient JSON/text parser
    const text = await res.text();
    try { return JSON.parse(text); } catch { return text; }
  };

  /* ---------- probe workspace helper ---------- */
  const probeWorkspace = useCallback(() => {
    const ws = workspaceRef.current;
    if (!ws) return { renderer: null, scene: null, camera: null, dom: null };
    const renderer = ws.getRenderer?.() ?? ws.renderer ?? ws._renderer ?? null;
    const scene = ws.getScene?.() ?? ws.scene ?? null;
    const camera = ws.getCamera?.() ?? ws.camera ?? null;
    const dom = renderer?.domElement ?? null;
    return { renderer, scene, camera, dom };
  }, []);

  /* ---------- init helpers (lighting, env, importer, camera controls, transform controls, post) ---------- */
  useEffect(() => {
    let mounted = true;
    let initAttempt = 0;
    const maxAttempts = 60;

    async function initHelpers() {
      while (mounted && initAttempt < maxAttempts) {
        initAttempt++;
        const { renderer, scene, camera, dom } = probeWorkspace();
        if (renderer && scene && camera && dom) {
          try {
            // Lighting
            if (!lightingApiRef.current) {
              try {
                lightingApiRef.current = setupDefaultLighting(scene, renderer, { addHelpers: false });
                setTimeout(() => {
                  try {
                    const acc = [];
                    scene.traverse((n) => { if (n.isLight && n.userData?.__objekta) acc.push(n); });
                    setLights(acc);
                  } catch (e) {}
                }, 60);
              } catch (e) { console.warn("lighting init failed", e); }
            }

            // Environment
            if (!envApiRef.current) {
              try { envApiRef.current = setupEnvironment({ scene, renderer }); } catch (e) { console.warn("env init failed", e); }
            }

            // PostProcessing
            if (!postApiRef.current) {
              try {
                postApiRef.current = setupPostProcessing({
                  renderer,
                  scene,
                 
                  width: dom.clientWidth || renderer.domElement.clientWidth || 800,
                  height: dom.clientHeight || renderer.domElement.clientHeight || 600,
                  options: { bloomStrength: 0.6, bloomRadius: 0.5, bloomThreshold: 0.9 },
                });
              } catch (e) { console.warn("postprocessing init failed", e); }
            }

            // GLB importer
            if (!importerApiRef.current) {
              try {
                importerApiRef.current = initGLBImporter({
                  scene,
                  domElement: dom,
                  onLoad: (gltf, meta) => {
                    try {
                      const obj = gltf.scene || gltf.scenes?.[0] || gltf;
                      cameraControlsApiRef.current?.frameObject?.(obj, { padding: 1.25, duration: 400 });
                    } catch (e) {}
                    try { workspaceRef.current?.onModelLoaded?.(gltf, meta); } catch (e) {}
                  },
                  onProgress: (p) => { setLoadProgress(p); },
                });
                try { importerApiRef.current.enableDragDrop(); } catch (e) {}
              } catch (e) { console.warn("glb importer init failed", e); }
            }

            // Material editor
            if (!materialEditorApiRef.current) {
              try {
                const container = containerRef.current || document.body;
                materialEditorApiRef.current = createMaterialEditor({
                  container,
                  getSelectedMesh: () =>
                    workspaceRef.current?.getSelectedMesh?.() ?? window.__OBJEKTA_WORKSPACE?.getSelectedMesh?.() ?? null,
                });
              } catch (e) { console.warn("material editor init failed", e); }
            }

            // Camera controls
            if (!cameraControlsApiRef.current) {
              try {
                if (!(workspaceRef.current && (workspaceRef.current.getControls || workspaceRef.current.controls))) {
                  cameraControlsApiRef.current = initCameraControls({ camera, domElement: dom, autoRotate: false, damping: 0.08 });
                } else {
                  cameraControlsApiRef.current = {
                    controls: workspaceRef.current.getControls?.() ?? workspaceRef.current.controls ?? null,
                    resetView: workspaceRef.current.resetView?.bind(workspaceRef.current) ?? (() => {}),
                    frameObject: workspaceRef.current.frameObject?.bind(workspaceRef.current) ?? (() => {}),
                    dispose: () => {},
                  };
                }
              } catch (e) { console.warn("camera controls init failed", e); }
            }

            // If the Workspace already manages TransformControls, prefer that.
            // Only create a local TransformControls instance when the workspace
            // does not expose `attachTransformToSelection` (legacy fallback).
            if (!transformControlsRef.current && !workspaceRef.current?.attachTransformToSelection) {
              try {
                const tc = new TransformControls(camera, dom);
                tc.addEventListener("dragging-changed", (event) => {
                  try {
                    const orbit = cameraControlsApiRef.current?.controls;
                    if (orbit) orbit.enabled = !event.value;
                  } catch (e) {}
                });
                tc.addEventListener("objectChange", () => {
                  const obj = tc.object;
                  try { workspaceRef.current?.onObjectTransformed?.(obj); } catch (e) {}
                  setSelected((s) => (s === obj ? s : s));
                });
                scene.add(tc);
                transformControlsRef.current = tc;
              } catch (e) { console.warn("transformcontrols init failed", e); }
            }

            // done
            break;
          } catch (e) {
            console.warn("initHelpers loop error", e);
          }
        }
        await new Promise((r) => setTimeout(r, 100));
      }
    }

    initHelpers();

    return () => {
      try { importerApiRef.current?.dispose?.(); importerApiRef.current = null; } catch (e) {}
      try { materialEditorApiRef.current?.dispose?.(); materialEditorApiRef.current = null; } catch (e) {}
      try { cameraControlsApiRef.current?.dispose?.(); cameraControlsApiRef.current = null; } catch (e) {}
      try { lightingApiRef.current?.dispose?.(); lightingApiRef.current = null; } catch (e) {}
      try { envApiRef.current?.dispose?.(); envApiRef.current = null; } catch (e) {}
      try { postApiRef.current?.dispose?.(); postApiRef.current = null; } catch (e) {}
      try { if (transformControlsRef.current && transformControlsRef.current.parent) transformControlsRef.current.parent.remove(transformControlsRef.current); transformControlsRef.current = null; } catch (e) {}
      mounted = false;
    };
  }, [probeWorkspace]);

  /* robust async screenshot helper */
  const captureThumbnailAsync = useCallback(async (opts = { quality: 0.9, mime: "image/png" }) => {
    try {
      const { renderer, scene, camera } = probeWorkspace();
      if (!renderer || !scene || !camera) {
        console.warn("[OBJEKTA] captureThumbnailAsync: missing renderer/scene/camera");
        return null;
      }

      try {
        if (postApiRef.current && typeof postApiRef.current.render === "function") {
          postApiRef.current.render();
        } else {
          renderer.render(scene, camera);
        }
      } catch (e) {
        console.warn("[OBJEKTA] post render for thumbnail failed", e);
      }

      // wait two animation frames to ensure browser compositing finished
      await new Promise((r) => requestAnimationFrame(r));
      await new Promise((r) => requestAnimationFrame(r));

      const srcCanvas = renderer.domElement;
      if (!srcCanvas) return null;

      const w = srcCanvas.width || srcCanvas.clientWidth || srcCanvas.offsetWidth;
      const h = srcCanvas.height || srcCanvas.clientHeight || srcCanvas.offsetHeight;
      if (!w || !h) return null;

      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      try {
        ctx.drawImage(srcCanvas, 0, 0, w, h);
      } catch (drawErr) {
        console.warn("[OBJEKTA] captureThumbnail drawImage failed", drawErr);
        return null;
      }

      // Promise wrapper for toBlob to guarantee Blob output
      const blob = await new Promise((resolve) => {
        try {
          canvas.toBlob((b) => resolve(b || null), opts.mime || "image/png", opts.quality ?? 0.92);
        } catch (e) {
          console.warn("[OBJEKTA] canvas.toBlob failed", e);
          resolve(null);
        }
      });
      return blob;
    } catch (err) {
      console.warn("captureThumbnailAsync failed", err);
      return null;
    }
  }, [probeWorkspace]);

  /* Transform mode & snapping sync */
  useEffect(() => {
    try { if (workspaceRef.current?.setTransformMode) workspaceRef.current.setTransformMode(activeMode); } catch (e) {}
    try {
      if (transformControlsRef.current) {
        transformControlsRef.current.setMode(activeMode === "translate" ? "translate" : activeMode === "rotate" ? "rotate" : "scale");
      }
    } catch (e) {}
  }, [activeMode]);

  useEffect(() => {
    try { workspaceRef.current?.setShadingMode?.(viewMode); } catch (e) {}
  }, [viewMode]);

  useEffect(() => {
    try {
      if (workspaceRef.current?.setSnapValue) workspaceRef.current.setSnapValue(snapSize);
      if (transformControlsRef.current) {
        transformControlsRef.current.setTranslationSnap(snapEnabled ? snapSize : null);
        transformControlsRef.current.setRotationSnap(snapEnabled ? (Math.PI / 180) * 15 : null);
      }
    } catch (e) {}
  }, [snapEnabled, snapSize]);

  /* attach/detach transform controls on selection change */
  useEffect(() => {
    try {
      const attachTo = selected ?? null;
      // Prefer workspace-managed transform controls when available
      if (workspaceRef.current?.attachTransformToSelection) {
        if (attachTo) workspaceRef.current.attachTransformToSelection(attachTo);
        else workspaceRef.current.detachTransformControls?.();
      } else if (transformControlsRef.current) {
        if (attachTo) transformControlsRef.current.attach(attachTo);
        else transformControlsRef.current.detach();
      }
    } catch (e) {}
  }, [selected]);

  /* reveal observer to prevent everything popping at once */
  useEffect(() => {
    const revealEls = containerRef.current ? containerRef.current.querySelectorAll(".reveal, .studio-panel, .studio-toolbar, .palette-panel") : [];
    if (!revealEls || revealEls.length === 0) return;
    const obs = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          obs.unobserve(entry.target);
        }
      });
    }, { threshold: 0.08 });
    revealEls.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, []);

  /* importGLTF wrapper */
  const importGLTF = useCallback(async (file) => {
    if (!file) return;
    setLoading(true); setLoadProgress(0);
    try {
      if (importerApiRef.current?.loadFromFile) {
        await importerApiRef.current.loadFromFile(file);
        pushToast({ type: "info", message: `Imported: ${file.name}` });
      } else if (workspaceRef.current?.addGLTF) {
        await workspaceRef.current.addGLTF?.(file, null, (p) => setLoadProgress(p));
        pushToast({ type: "info", message: `Imported (workspace): ${file.name}` });
      } else {
        pushToast({ type: "error", message: "No importer available" });
      }
    } catch (e) {
      console.error("Import failed", e);
      pushToast({ type: "error", message: "Import failed" });
    } finally {
      setTimeout(() => { setLoading(false); setLoadProgress(null); }, 300);
    }
  }, [pushToast]);

  /* applyEnvironmentFromFile */
  const applyEnvironmentFromFile = useCallback(async (file) => {
    // Allow passing an event accidentally; extract first file
    if (file && file.target && file.target.files) {
      file = file.target.files[0];
    }
    if (!file || !(file instanceof Blob)) return;
    setLoading(true);
    const name = (file.name || "").toLowerCase();
    let url = null;
    try {
      if ((name.endsWith(".hdr") || name.endsWith(".exr")) && envApiRef.current?.setHDR) {
        url = URL.createObjectURL(file);
        try {
          await envApiRef.current.setHDR(url);
          pushToast({ type: "info", message: "HDR environment loaded" });
          setSceneVersion((v) => v + 1);
          envFileRef.current = file; // keep original for save
          setEnvironmentActive(true);
        } finally {
          setTimeout(() => { try { url && url.startsWith && url.startsWith('blob:') && URL.revokeObjectURL(url); } catch (e) {} }, 1500);
        }
      } else {
        const loader = new THREE.TextureLoader();
        url = URL.createObjectURL(file);
        const tex = await new Promise((res, rej) => loader.load(url, (t) => res(t), undefined, (err) => rej(err)));
        try {
          const scene = workspaceRef.current?.scene;
          if (scene) {
            scene.background = tex;
            pushToast({ type: "info", message: "Background image applied" });
            setSceneVersion((v) => v + 1);
            envFileRef.current = file;
            setEnvironmentActive(true);
          }
        } finally {
          setTimeout(() => { try { url && url.startsWith && url.startsWith('blob:') && URL.revokeObjectURL(url); } catch (e) {} }, 1500);
        }
      }
    } catch (e) {
      console.error("applyEnvironmentFromFile failed", e);
      pushToast({ type: "error", message: "Environment load failed" });
      try { if (url && url.startsWith && url.startsWith('blob:')) URL.revokeObjectURL(url); } catch (e) {}
      setEnvironmentActive(false);
    } finally { setLoading(false); }
  }, [pushToast]);

  const applyEnvironmentColor = useCallback((hex) => {
    try {
      if (envApiRef.current?.setBackgroundColor) envApiRef.current.setBackgroundColor(hex);
      else {
        const scene = workspaceRef.current?.scene;
        if (scene) scene.background = new THREE.Color(hex);
      }
      pushToast({ type: "info", message: "Background color applied" });
      setSceneVersion((v) => v + 1);
    } catch (e) { pushToast({ type: "error", message: "Failed to set color" }); }
  }, [pushToast]);

  /* toggleBloom */
  const toggleBloom = useCallback((enabled) => {
    setBloomEnabled(enabled);
    try {
      if (enabled) {
        if (!postApiRef.current) {
          const { renderer, scene, camera } = probeWorkspace();
          if (renderer && scene && camera) {
            try {
              postApiRef.current = setupPostProcessing({
                renderer, scene, camera,
                width: renderer.domElement.clientWidth, height: renderer.domElement.clientHeight,
                options: { bloomStrength: 0.6, bloomRadius: 0.5, bloomThreshold: 0.9 }
              });
            } catch (e) { console.warn("failed creating composer", e); }
          }
        }
      } else {
        try { postApiRef.current?.dispose?.(); postApiRef.current = null; } catch (e) {}
      }
      EventBus?.emit?.('postfx:bloom:toggle', { enabled });
      pushToast({ type: "info", message: `Bloom ${enabled ? 'enabled' : 'disabled'}` });
      // persist toggle if scene save endpoint available
      if (projectId) {
        try {
          fetch(apiUrl(`/api/scenes/${projectId}/update`), {
            method: 'POST',
            credentials: 'include',
            headers: { 'Accept': 'application/json' },
            body: (() => { const fd = new FormData(); fd.append('bloomEnabled', String(enabled)); return fd; })()
          }).catch(()=>{});
        } catch (e) {}
      }
    } catch (e) { pushToast({ type: "error", message: "Failed to toggle bloom" }); }
  }, [probeWorkspace, pushToast, projectId]);

  // Ocean effect toggle
  const toggleOcean = useCallback((enabled) => {
    setOceanEnabled(enabled);
    try {
      const scene = workspaceRef.current?.scene;
      if (!scene) return;
      const existing = scene.getObjectByName('_oceanEffect');
      if (enabled && !existing) {
        const geo = new THREE.PlaneGeometry(60, 60, 256, 256);
        const uniforms = { time: { value: 0 }, amplitude: { value: 0.5 }, shininess: { value: 0.3 } };
        const mat = new THREE.ShaderMaterial({
          uniforms,
          vertexShader: `uniform float time; uniform float amplitude; varying vec2 vUv; varying float vHeight; void main(){ vUv=uv; vec3 p=position; float wave=sin((p.x*0.22+time)*1.6)+cos((p.y*0.18+time*0.9)); wave += sin((p.x*0.35 - time*0.4))*0.5; p.z = wave*amplitude; vHeight=p.z; gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.0); }`,
          fragmentShader: `uniform float shininess; varying vec2 vUv; varying float vHeight; void main(){ float g = 0.4 + 0.6*vUv.y; float fres = pow(1.0 - abs(vHeight), 3.0); vec3 base = mix(vec3(0.02,0.18,0.35), vec3(0.05,0.32,0.55), g); base += fres*0.25; gl_FragColor = vec4(base,1.0); }`,
          transparent: false
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.rotation.x = -Math.PI/2;
        mesh.position.y = -1.2;
        mesh.name = '_oceanEffect';
        scene.add(mesh);
      } else if (!enabled && existing) {
        scene.remove(existing);
        existing.geometry?.dispose?.();
        existing.material?.dispose?.();
      }
      pushToast({ type: 'info', message: `Ocean ${enabled? 'enabled':'disabled'}` });
      setSceneVersion(v=>v+1);
      if (projectId) {
        const fd = new FormData(); fd.append('oceanEnabled', String(enabled));
        fetch(apiUrl(`/api/scenes/${projectId}/update`), { method:'POST', credentials:'include', body: fd }).catch(()=>{});
      }
    } catch (e) { pushToast({ type:'error', message:'Ocean toggle failed' }); }
  }, [pushToast, projectId]);

  // Rain effect toggle
  const toggleRain = useCallback((enabled) => {
    setRainEnabled(enabled);
    try {
      const scene = workspaceRef.current?.scene;
      if (!scene) return;
      const existing = scene.getObjectByName('_rainEffect');
      if (enabled && !existing) {
        const group = new THREE.Group();
        group.name = '_rainEffect';
        for (let i=0;i<400;i++) {
          const geom = new THREE.BufferGeometry();
          const verts = new Float32Array([ (Math.random()-0.5)*40, Math.random()*10+2, (Math.random()-0.5)*40 ]);
          geom.setAttribute('position', new THREE.BufferAttribute(verts,3));
          const mat = new THREE.PointsMaterial({ color:0x99bbff, size:0.08 });
          const pts = new THREE.Points(geom, mat);
          pts.userData.v = 0.03 + Math.random()*0.08;
          group.add(pts);
        }
        scene.add(group);
      } else if (!enabled && existing) {
        existing.children.forEach(c=>{ c.geometry?.dispose?.(); c.material?.dispose?.(); });
        scene.remove(existing);
      }
      pushToast({ type:'info', message:`Rain ${enabled? 'enabled':'disabled'}` });
      setSceneVersion(v=>v+1);
      if (projectId) { const fd = new FormData(); fd.append('rainEnabled', String(enabled)); fetch(apiUrl(`/api/scenes/${projectId}/update`), { method:'POST', credentials:'include', body: fd }).catch(()=>{}); }
    } catch (e) { pushToast({ type:'error', message:'Rain toggle failed' }); }
  }, [pushToast, projectId]);

  /* selection handler */
  const handleWorkspaceSelect = useCallback((obj) => {
    setSelected(obj);
    // Sync selected objects to Yjs awareness
    setCollabSelected(obj ? [obj.uuid] : []);
    try { materialEditorApiRef.current?.refresh?.(); } catch (e) {}
    if (!obj) {
      setMatColor('#888888'); setMatRough(0.5); setMatMetal(0); setMatHasMap(false); setMatMapURL(null);
      return;
    }
    let found = null;
    obj.traverse((n) => { if (!found && n.isMesh && n.material) found = n; });
    if (found) {
      const mat = Array.isArray(found.material) ? found.material[0] : found.material;
      if (mat && mat.color) setMatColor('#' + mat.color.getHexString());
      if (mat && typeof mat.roughness === 'number') setMatRough(mat.roughness);
      if (mat && typeof mat.metalness === 'number') setMatMetal(mat.metalness);
      if (mat && mat.map && mat.map.image) {
        setMatHasMap(true);
        setMatMapURL(mat.map.__objekta_preview || (mat.map.image.currentSrc || mat.map.image.src || null));
      } else { setMatHasMap(false); setMatMapURL(null); }
    } else {
      setMatColor('#888888'); setMatRough(0.5); setMatMetal(0); setMatHasMap(false); setMatMapURL(null);
    }
  }, []);

  /* applyMaterialToSelection */
  const applyMaterialToSelection = useCallback(async ({ color, roughness, metalness, mapFile } = {}) => {
    const sel = workspaceRef.current?.getSelectedMesh?.() ?? selected;
    if (!sel) { pushToast({ type: "error", message: "No selection to apply material" }); return; }
    try {
      if (workspaceRef.current?.applyMaterialToSelection) {
        await workspaceRef.current.applyMaterialToSelection({ color, roughness, metalness, mapFile });
        pushToast({ type: "info", message: "Material applied (workspace)" });
        return;
      }
      sel.traverse((n) => {
        if (n.isMesh) {
          try {
            n.material = Array.isArray(n.material) ? n.material.map(m => m.clone()) : n.material.clone();
            const mats = Array.isArray(n.material) ? n.material : [n.material];
            mats.forEach((mat) => {
              if (color && mat.color) mat.color.set(color);
              if (typeof roughness === 'number' && typeof mat.roughness === 'number') mat.roughness = roughness;
              if (typeof metalness === 'number' && typeof mat.metalness === 'number') mat.metalness = metalness;
              mat.needsUpdate = true;
            });
          } catch (e) { console.warn("applyMaterial error", e); }
        }
      });
      if (mapFile) {
        const url = URL.createObjectURL(mapFile);
        const loader = new THREE.TextureLoader();
        loader.load(url, (tex) => {
          tex.__objekta_preview = url;
          sel.traverse((n) => {
            if (n.isMesh && n.material) {
              const mats = Array.isArray(n.material) ? n.material : [n.material];
              mats.forEach((mat) => { mat.map = tex; mat.needsUpdate = true; });
            }
          });
          setMatHasMap(true); setMatMapURL(url);
          pushToast({ type: "info", message: "Texture applied" });
        }, undefined, (_err) => {
          pushToast({ type: "error", message: "Failed to load texture" });
          try { if (url && url.startsWith && url.startsWith('blob:')) URL.revokeObjectURL(url); } catch (e) {}
        });
      } else {
        sel.traverse((n) => {
          if (n.isMesh && n.material) {
            const mats = Array.isArray(n.material) ? n.material : [n.material];
            mats.forEach((mat) => {
              if (mat.map) {
                try { mat.map.dispose && mat.map.dispose(); } catch (e) {}
                mat.map = null;
                mat.needsUpdate = true;
              }
            });
          }
        });
        setMatHasMap(false); setMatMapURL(null);
      }
      pushToast({ type: "info", message: "Material applied" });
    } catch (e) {
      console.error(e);
      pushToast({ type: "error", message: "Failed to apply material" });
    }
  }, [selected, pushToast]);

  const applyTextureToSelectionSlot = useCallback((file, slotKey = "map") => {
    const sel = workspaceRef.current?.getSelectedMesh?.() ?? selected;
    if (!sel || !file) {
      pushToast({ type: "error", message: "No selection or file for texture apply" });
      return;
    }
    const url = URL.createObjectURL(file);
    const loader = new THREE.TextureLoader();
    loader.load(url, (tex) => {
      try { tex.colorSpace = THREE.SRGBColorSpace; } catch (e) { try { tex.encoding = THREE.sRGBEncoding; } catch (e2) {} }
      sel.traverse((n) => {
        if (!n.isMesh || !n.material) return;
        const mats = Array.isArray(n.material) ? n.material : [n.material];
        mats.forEach((m) => {
          m[slotKey] = tex;
          if (slotKey === "normalMap" && m.normalScale) {
            m.normalScale.set(1, 1);
          }
          m.needsUpdate = true;
        });
      });
      pushToast({ type: "info", message: `${slotKey} texture applied` });
      setIsDirty(true);
    }, undefined, () => {
      pushToast({ type: "error", message: `Failed to apply ${slotKey} texture` });
      try { URL.revokeObjectURL(url); } catch (e) {}
    });
  }, [selected, pushToast]);

  const removeTextureFromSelectionSlot = useCallback((slotKey = "map") => {
    const sel = workspaceRef.current?.getSelectedMesh?.() ?? selected;
    if (!sel) return;
    sel.traverse((n) => {
      if (!n.isMesh || !n.material) return;
      const mats = Array.isArray(n.material) ? n.material : [n.material];
      mats.forEach((m) => {
        if (m[slotKey]) {
          try { m[slotKey].dispose?.(); } catch (e) {}
        }
        m[slotKey] = null;
        m.needsUpdate = true;
      });
    });
    setIsDirty(true);
    pushToast({ type: "info", message: `${slotKey} texture removed` });
  }, [selected, pushToast]);

  /* saveJSON & exportGLTF (unchanged) */
  const saveJSON = useCallback(() => {
    const data = workspaceRef.current?.serializeScene?.();
    if (!data) { pushToast({ type: "error", message: "Nothing to save" }); return; }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Objekta_Scene_${safeDate()}.json`;
    // append for safety in some browsers
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
    pushToast({ type: "info", message: "Scene saved (JSON)" });
  }, [pushToast, safeDate]);

  const exportGLTF = useCallback((binary = true) => {
    if (workspaceRef.current?.exportGLTF) {
      return workspaceRef.current.exportGLTF(binary).catch((err) => {
        console.error("GLTF export failed", err);
        pushToast({ type: "error", message: "Export failed" });
      });
    }
    saveJSON();
    pushToast({ type: "info", message: "GLB export unavailable, saved JSON instead" });
    return Promise.resolve(null);
  }, [pushToast, saveJSON]);

  /* drag/drop on container (unchanged) */
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const onDragOver = (e) => { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; };
    const onDrop = (e) => {
      e.preventDefault();
      if (e.dataTransfer.files?.length > 0) {
        const file = e.dataTransfer.files[0];
        const name = (file.name || "").toLowerCase();
        if (name.endsWith(".glb") || name.endsWith(".gltf") || name.endsWith(".obj") || name.endsWith(".fbx") || name.endsWith(".zip")) importGLTF(file);
        else if (name.endsWith(".json")) loadJSON(file);
        else if (name.endsWith(".hdr") || name.endsWith(".exr") || name.endsWith(".jpg") || name.endsWith(".png")) applyEnvironmentFromFile(file);
        else pushToast({ type: "error", message: "Unsupported file. Drop a .glb, .gltf, .obj, .fbx, .json, or .hdr file." });
      }
    };
    container.addEventListener("dragover", onDragOver);
    container.addEventListener("drop", onDrop);
    return () => {
      container.removeEventListener("dragover", onDragOver);
      container.removeEventListener("drop", onDrop);
    };
  }, [importGLTF, pushToast, applyEnvironmentFromFile]);

  /* loadJSON (unchanged) */
  const loadJSON = useCallback(async (file) => {
    if (!file) return;
    setLoading(true);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (!parsed) { pushToast({ type: "error", message: "Invalid JSON" }); return; }
      if (workspaceRef.current?.loadFromData) {
        workspaceRef.current.loadFromData(parsed);
        pushToast({ type: "info", message: `Loaded JSON: ${file.name}` });
      } else {
        pushToast({ type: "error", message: "Workspace does not support loading JSON directly" });
      }
    } catch (e) {
      console.error("loadJSON failed", e);
      pushToast({ type: "error", message: "Failed to load JSON" });
    } finally { setLoading(false); }
  }, [pushToast]);

  /* disposeObjectResources (unchanged) */
  const disposeObjectResources = useCallback((obj) => {
    if (!obj) return;
    obj.traverse(n => {
      try {
        if (n.isMesh) {
          const mats = Array.isArray(n.material) ? n.material : [n.material];
          mats.forEach(mat => {
            if (!mat) return;
            if (mat.map) { try { mat.map.dispose && mat.map.dispose(); } catch (e) {} }
            try { mat.dispose && mat.dispose(); } catch (e) {}
          });
          if (n.geometry) { try { n.geometry.dispose(); } catch (e) {} }
        }
      } catch (e) {}
    });
  }, []);

  const requestDeleteObject = useCallback((obj) => {
    if (!obj) return;
    setConfirmState({
      open: true,
      title: "Delete Object",
      message: `Delete '${obj.name || obj.type || "this object"}'?`,
      onConfirm: () => {
        try {
          if (workspaceRef.current?.selectObject) {
            workspaceRef.current.selectObject(obj);
          }
          disposeObjectResources(obj);
          workspaceRef.current?.deleteSelected?.();
          setSelected((prev) => (prev?.uuid === obj.uuid ? null : prev));
          setIsDirty(true);
          pushToast({ type: "info", message: "Deleted" });
        } catch (e) {
          pushToast({ type: "error", message: "Delete failed" });
        }
      },
    });
  }, [disposeObjectResources, pushToast]);

  /* delete / reset (unchanged) */
  const requestDeleteSelected = useCallback(() => {
    const sel = workspaceRef.current?.getSelectedMesh?.() ?? selected;
    if (!sel) return;
    setConfirmState({
      open: true,
      title: "Delete selected object",
      message: `Are you sure you want to delete '${sel.name || "object"}'? This cannot be undone.`,
      onConfirm: () => {
        try { disposeObjectResources(sel); } catch (e) {}
        workspaceRef.current?.deleteSelected?.();
        setSelected(null);
        setConfirmState((s) => ({ ...s, open: false }));
        pushToast({ type: "info", message: "Deleted object" });
      },
    });
  }, [selected, disposeObjectResources, pushToast]);

  const requestResetScene = useCallback(() => {
    setConfirmState({
      open: true,
      title: "Reset scene",
      message: "Resetting will remove all objects from the scene. Continue?",
      onConfirm: () => {
        try {
          const scene = workspaceRef.current?.scene;
          const ug = scene?._userGroup || scene?._user_group;
          if (ug) ug.children.forEach(child => disposeObjectResources(child));
        } catch (e) {}
        workspaceRef.current?.resetScene?.();
        setConfirmState((s) => ({ ...s, open: false }));
        setSelected(null);
        pushToast({ type: "info", message: "Scene reset" });
      },
    });
  }, [disposeObjectResources, pushToast]);

  /* collaboration — Yjs-backed (CRDT). Legacy socket.io collab is kept for backward compat. */
  const startCollab = useCallback(async () => {
    if (collabSocketRef.current) {
      try { collabSocketRef.current.disconnect(); } catch (e) {}
      collabSocketRef.current = null; setCollabConnected(false); pushToast({ type: "info", message: "Collab disconnected" }); return;
    }
    // Yjs is already auto-connected via useCollaboration when projectId is set.
    // The legacy socket collab is kept for backward compatibility.
    setCollabLoading(true);
    try {
      const module = await import("socket.io-client");
      const ioClient = module.io || module.default || module;
      const base = API_BASE || window.location.origin;
      const socket = ioClient(base, { autoConnect: true, transports: ["websocket", "polling"], withCredentials: true });
      collabSocketRef.current = socket;
      socket.on("connect", () => {
        setCollabConnected(true); setCollabLoading(false); pushToast({ type: "info", message: "Connected to collab server" });
        try { const data = workspaceRef.current?.serializeScene?.(); socket.emit("scene:push", { scene: data || { snaps: [] } }); } catch (e) {}
      });
      socket.on("connect_error", (err) => {
        setCollabLoading(false);
        const now = Date.now();
        if (now - (collabErrorGateRef.current.lastToast || 0) > 60000) {
          pushToast({ type: "error", message: "Collab connect failed" });
          collabErrorGateRef.current.lastToast = now;
        }
        if (!collabErrorGateRef.current.logged) {
          collabErrorGateRef.current.logged = true;
          console.error("collab connect err", err);
        }
      });
      socket.on("scene:push", (payload) => {
        try {
          if (!payload || !payload.scene) return;
          const remote = payload.scene;
          askConfirm({ title: "Remote update", message: "Remote collaborator pushed a scene. Load it now (will replace current scene)?", confirmLabel: "Load", cancelLabel: "Ignore" }).then((ok) => {
            if (ok) { try { workspaceRef.current?.loadFromData?.(remote); pushToast({ type: "info", message: "Loaded remote scene" }); } catch (e) { console.warn(e); } }
          });
        } catch (e) { console.warn(e); }
      });
      socket.on("disconnect", () => { setCollabConnected(false); pushToast({ type: "info", message: "Collab disconnected" }); });
    } catch (e) { console.error("collab start failed", e); pushToast({ type: "error", message: "Failed to start collab (see console)" }); setCollabLoading(false); }
  }, [pushToast]);

  /* refreshLightListFromScene (unchanged) */
  const refreshLightListFromScene = useCallback(() => {
    try {
      const scene = workspaceRef.current?.scene;
      if (!scene) {
        setLights([]);
        return;
      }
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
    } catch (e) {
      setLights([]);
    }
  }, []);

  const resolveSelectedObject = useCallback((payload) => {
    if (!payload) return null;
    if (payload?.isObject3D) return payload;
    if (payload?.object?.isObject3D) return payload.object;

    const ids = Array.isArray(payload)
      ? payload
      : Array.isArray(payload?.ids)
        ? payload.ids
        : [];

    const rawId = ids[0] ?? payload?.id ?? payload?.uuid ?? (typeof payload === "string" ? payload : null);
    if (!rawId) return null;

    const scene = workspaceRef.current?.scene;
    const byUuid = scene?.getObjectByProperty?.("uuid", rawId);
    if (byUuid) return byUuid;

    if (typeof rawId === "number") {
      const byNumericId = scene?.getObjectById?.(rawId);
      if (byNumericId) return byNumericId;
    }

    const fromStore = SceneGraphStore.objects?.[rawId]?.object || null;
    return fromStore;
  }, []);

  /* EventBus integration */
  useEffect(() => {
    const onSceneUpdated = () => {
      setSceneVersion((v) => v + 1);
      refreshLightListFromScene();
      setIsDirty(true);
    };

    const onObjectsSelected = (payload) => {
      try {
        const obj = resolveSelectedObject(payload);
        handleWorkspaceSelect(obj || null);
      } catch (e) {}
    };

    const onObjectSelected = (p) => {
      try {
        const obj = resolveSelectedObject(p);
        handleWorkspaceSelect(obj || null);
      } catch (e) {}
    };

    EventBus.on?.("scene:updated", onSceneUpdated);
    EventBus.on?.("objects:selected", onObjectsSelected);
    EventBus.on?.("object:selected", onObjectSelected);

    // Push transform changes to Yjs CRDT
    const onTransformCommit = (payload) => {
      try {
        const obj = payload?.object;
        if (!obj?.uuid) return;
        pushObjectUpdate(obj.uuid, {
          position: [obj.position.x, obj.position.y, obj.position.z],
          rotation: [obj.rotation.x, obj.rotation.y, obj.rotation.z],
          scale: [obj.scale.x, obj.scale.y, obj.scale.z],
          name: obj.name || '',
          type: obj.type || 'Object3D',
        });
      } catch (e) {}
    };
    EventBus.on?.("transform:commit", onTransformCommit);

    // When user manually transforms an object, sync position to physics body
    const onTransformCommitPhysics = (payload) => {
      try {
        const obj = payload?.object;
        if (!obj?.uuid) return;
        if (physicsManagerRef?.current?.hasBody(obj.uuid)) {
          physicsManagerRef.current.syncFromThreeObject(obj.uuid, obj);
        }
      } catch (e) {}
    };
    EventBus.on?.("transform:commit", onTransformCommitPhysics);

    return () => {
      try {
        EventBus.off?.("scene:updated", onSceneUpdated);
        EventBus.off?.("objects:selected", onObjectsSelected);
        EventBus.off?.("object:selected", onObjectSelected);
        EventBus.off?.("transform:commit", onTransformCommit);
        EventBus.off?.("transform:commit", onTransformCommitPhysics);
      } catch (e) {}
    };
  }, [refreshLightListFromScene, resolveSelectedObject, handleWorkspaceSelect, pushObjectUpdate]);

  useEffect(() => {
    refreshLightListFromScene();
  }, [refreshLightListFromScene]);

  const handleOutlinerSelect = useCallback((obj) => {
    try {
      if (!obj) return;
      if (workspaceRef.current?.selectObject) {
        workspaceRef.current.selectObject(obj);
        handleWorkspaceSelect(obj);
        workspaceRef.current.frameObject?.(obj);
      } else {
        handleWorkspaceSelect(obj);
        cameraControlsApiRef.current?.frameObject?.(obj, { padding: 1 });
      }
    } catch (e) { console.warn("handleOutlinerSelect failed", e); }
  }, [handleWorkspaceSelect]);

  /* Sculpt toggle (unchanged) */
  const toggleSculpt = useCallback(() => {
    const on = !!(workspaceRef.current?.isSculptMode?.() ?? false);
    const next = !on;
    EventBus.emit?.('studio:toggle:sculpt', { enabled: next });
    try { workspaceRef.current?.setSculptMode?.(next); } catch (e) {}
    pushToast({ type: "info", message: `Sculpt ${next ? 'enabled' : 'disabled'}` });
  }, [pushToast]);

  // Sculpt events handled in toggleSculpt; no inspector collapse behavior.

  /* panel drag/resize (unchanged) */
  useEffect(() => {
    const onMove = (ev) => {
      if (!draggingRef.current) return;
      const rect = panelRef.current.getBoundingClientRect();
      const left = ev.clientX - offsetRef.current.x;
      const top = ev.clientY - offsetRef.current.y;
      const constrainedTop = Math.max(8, Math.min(window.innerHeight - rect.height - 8, top));
      const constrainedRight = Math.max(8, Math.min(window.innerWidth - rect.width - 8, window.innerWidth - left - rect.width));
      setPanelPos({ top: constrainedTop, right: Math.max(8, constrainedRight) });
    };
    const onUp = () => { draggingRef.current = false; };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

  /* runValidation (unchanged) */
  const runValidation = useCallback(() => {
    try {
      const scene = workspaceRef.current?.scene;
      if (!scene) {
        setValidationResult({ ok: false, issues: ["No scene loaded"] });
        pushToast({ type: "info", message: "Validation complete" });
        return;
      }
      let tris = 0;
      let meshes = 0;
      scene.traverse((n) => {
        if (n.isMesh) {
          meshes++;
          const geom = n.geometry;
          if (geom && geom.index) tris += (geom.index.count / 3);
          else if (geom && geom.attributes?.position) tris += (geom.attributes.position.count / 3);
        }
      });
      const issues = [];
      if (meshes === 0) issues.push("Scene contains no mesh objects.");
      if (tris > 500000) issues.push("High triangle count (>500k) — consider decimating or LOD.");
      setValidationResult({ ok: issues.length === 0, meshes, tris, issues });
      pushToast({ type: "info", message: "Validation complete" });
    } catch (e) {
      console.error("runValidation failed", e);
      setValidationResult({ ok: false, issues: ["Validation error (see console)"] });
      pushToast({ type: "error", message: "Validation failed" });
    }
  }, [pushToast]);

  /* screenshot helper (improved) */
  const captureThumbnail = useCallback(() => {
    try {
      const { renderer, scene, camera } = probeWorkspace();
      if (!renderer) return null;

      // Try to force a render (if possible)
      try {
        if (postApiRef.current?.render) {
          // if you created a post processing wrapper exposing render, call it
          postApiRef.current.render();
        } else if (renderer && scene && camera) {
          renderer.render(scene, camera);
        }
      } catch (e) {
        // ignore, we still try to capture below
      }

      const srcCanvas = renderer.domElement;
      if (!srcCanvas) return null;
      const w = srcCanvas.width || srcCanvas.clientWidth || srcCanvas.offsetWidth;
      const h = srcCanvas.height || srcCanvas.clientHeight || srcCanvas.offsetHeight;
      if (!w || !h) return null;

      // Draw current WebGL canvas onto an offscreen canvas to get a stable dataURL
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      // drawImage accepts a canvas as source
      try {
        ctx.drawImage(srcCanvas, 0, 0, w, h);
      } catch (err) {
        // drawImage may fail in some exotic scenarios; fallback to direct toDataURL
        try {
          const data = srcCanvas.toDataURL && srcCanvas.toDataURL("image/jpeg", 0.9);
          return data || null;
        } catch (e) {
          return null;
        }
      }

      // Quick pixel check: sample a pixel to see if it's blank/transparent
      try {
        const px = ctx.getImageData(Math.max(0, Math.floor(w / 2)), Math.max(0, Math.floor(h / 2)), 1, 1).data;
        const isMostlyEmpty = px[3] === 0 || (px[0] < 8 && px[1] < 8 && px[2] < 8); // transparent or near-black
        const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
        if (!isMostlyEmpty) return dataUrl;
        // if mostly empty, still return it - but higher level will retry
        return dataUrl;
      } catch (e) {
        // if getImageData fails (rare), still return the image
        return canvas.toDataURL("image/jpeg", 0.9);
      }
    } catch (e) {
      console.warn("captureThumbnail failed", e);
      return null;
    }
  }, [probeWorkspace]);

  /* fullscreen changes -> keep state accurate */
  useEffect(() => {
    const onFS = () => setIsFullScreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onFS);
    return () => document.removeEventListener("fullscreenchange", onFS);
  }, []);

  /* keyboard shortcuts (unchanged) */
  useEffect(() => {
    const onKey = (e) => {
      const meta = e.ctrlKey || e.metaKey;
      // Allow ctrl/cmd shortcuts regardless of focus (save, undo, redo)
      if (meta && e.key.toLowerCase() === "s") { e.preventDefault(); saveJSON(); return; }
      if (meta && e.key.toLowerCase() === "z" && !e.shiftKey) { e.preventDefault(); workspaceRef.current?.undo?.(); return; }
      if ((meta && e.key.toLowerCase() === "y") || (meta && e.shiftKey && e.key.toLowerCase() === "z")) { e.preventDefault(); workspaceRef.current?.redo?.(); return; }

      // Guard: don't intercept bare keys when user is typing
      const tag = e.target?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select' || e.target?.isContentEditable) return;

      if (e.key === "Escape") {
        workspaceRef.current?.clearSelection?.();
        setSelected(null);
        return;
      }

      if (e.key === "Delete") { requestDeleteSelected(); return; }
      if (!meta && e.key.toLowerCase() === "p") { setPaletteCollapsed((v) => !v); return; }
      // inspector collapse shortcut removed
      if (!meta && e.key.toLowerCase() === "b") { toggleBloom(!bloomEnabled); return; }
      if (!meta && e.key.toLowerCase() === "f" && e.shiftKey) {
        workspaceRef.current?.frameAll?.();
        return;
      }
      if (!meta && e.key.toLowerCase() === "f") {
        if (selected) workspaceRef.current?.frameSelection?.();
        return;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [saveJSON, requestDeleteSelected, bloomEnabled, toggleBloom, selected]);

  const duplicateWrapper = useCallback(() => { workspaceRef.current?.duplicateSelected?.(); pushToast({ type: "info", message: "Duplicated selection" }); }, [pushToast]);

  /* ---------------- Backend / Dashboard helpers ---------------- */

  // Fetch helpers (use apiUrl)
  const fetchProjects = useCallback(async () => {
    try {
      const res = await fetch(apiUrl("/api/projects"), { headers: getAuthHeaders(), credentials: "include" });
      const data = await safeJson(res);
      if (res.status === 0) {
        console.debug("fetchProjects aborted/failed (status 0)");
        return;
      }
      if (res.status === 401) {
        forceLogoutDueTo401();
        return;
      }
      if (!res.ok) {
        console.warn("fetchProjects: non-ok", res.status, data);
        const fallback = Array.isArray(data) ? data : (data?.projects || []);
        // normalize fallback
        const normalized = (fallback || []).map((p) => ({
          _id: p._id || p.id || p.project?._id || null,
          name: p.name || p.title || p.project?.name || p.scene?.name || `Project ${p._id || p.id || ""}`,
          thumbnailUrl: p.thumbnailUrl ?? null,
          lastSavedAt: p.lastSavedAt || p.updatedAt || p.modifiedAt || null,
          raw: p,
        }));
        setProjects(normalized);
        return;
      }
      let list = [];
      if (Array.isArray(data)) list = data;
      else if (data?.projects && Array.isArray(data.projects)) list = data.projects;
      else if (data?.success && Array.isArray(data.projects)) list = data.projects;
      else if (data?.length) list = data;
      // normalize results into consistent shape
      const normalized = (list || []).map((p) => ({
        _id: p._id || p.id || p.project?._id || null,
        name: p.name || p.title || p.project?.name || p.scene?.name || `Project ${p._id || p.id || ""}`,
  thumbnailUrl: p.thumbnailUrl ?? null,
        lastSavedAt: p.lastSavedAt || p.updatedAt || p.modifiedAt || null,
        raw: p,
      }));
      setProjects(normalized || []);
    } catch (err) {
      console.error("Failed to list projects:", err);
      // no crash — keep existing list
    }
  }, [getAuthHeaders, forceLogoutDueTo401]);

  const getProject = useCallback(async (id) => {
    if (!id) throw new Error("Project id required");
    const res = await fetch(apiUrl(`/api/projects/${id}`), { headers: getAuthHeaders(), credentials: "include" });
    const data = await safeJson(res);
    if (res.status === 401) {
      forceLogoutDueTo401();
      throw new Error("Session expired");
    }
    if (!res.ok) {
      const msg = data?.message || data?.error || JSON.stringify(data);
      throw new Error(msg || "Failed fetching project");
    }
    if (data?.project) return data.project;
    return data;
  }, [getAuthHeaders, forceLogoutDueTo401]);

  /* ----------------
     UPLOAD helpers
     ---------------- */

  // convert dataURL to blob
  const dataUrlToBlob = useCallback(async (dataUrl) => {
    if (!dataUrl) return null;
    try {
      const r = await fetch(dataUrl);
      return await r.blob();
    } catch (e) {
      console.warn("dataUrlToBlob failed", e);
      return null;
    }
  }, []);

  const transparentPlaceholderBlob = useCallback(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, 1, 1);
    return new Promise((resolve) => {
      try {
        canvas.toBlob((b) => resolve(b || null), 'image/png');
      } catch (e) {
        resolve(null);
      }
    });
  }, []);

  // send JSON or FormData (uses XHR if onUploadProgress provided for progress reporting)
  const sendJsonOrForm = useCallback(async (path, method = "POST", payload = {}, { thumbnailBlob = null, onUploadProgress = null, projectIdHint = null, extraFiles = null, sceneFile = null, sceneMeta = null } = {}) => {
    // AbortController with 60s timeout for upload safety
    const controller = new AbortController();
    // Dynamic timeout: larger payloads get more time (up to 3m)
    let estSize = 0;
    try { if (payload && typeof payload.data === 'string') estSize = payload.data.length; else if (payload && payload.data) estSize = JSON.stringify(payload.data).length; } catch (e) {}
    const baseMs = 60000;
    const extraMs = Math.min(120000, Math.floor(estSize / (5 * 1024 * 1024)) * 30000); // +30s per 5MB up to +120s
    const timeoutMs = baseMs + extraMs;
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      // multipart/form-data path when thumbnailBlob provided and valid
      const allowedTypes = new Set(["image/png", "image/jpeg", "image/jpg", "image/webp"]);
      const maxThumbBytes = 10 * 1024 * 1024; // 10MB
      const useThumb = !!(thumbnailBlob && (thumbnailBlob.type ? allowedTypes.has(thumbnailBlob.type) : true) && (typeof thumbnailBlob.size !== 'number' || thumbnailBlob.size <= maxThumbBytes));
      const useSceneFile = !!sceneFile;
      if (useThumb || extraFiles || useSceneFile) {
        const fd = new FormData();
        if (typeof payload.data !== 'undefined' && !useSceneFile) fd.append("data", typeof payload.data === 'string' ? payload.data : JSON.stringify(payload.data));
        if (payload.name) fd.append("name", payload.name);
        if (payload.title) fd.append("title", payload.title);
        if (payload.lastSavedAt) fd.append("lastSavedAt", payload.lastSavedAt);
        if (payload.dataEncoding) fd.append("dataEncoding", payload.dataEncoding);
        if (payload.dataCompressed) fd.append("dataCompressed", String(payload.dataCompressed));
        if (typeof payload.bloomEnabled !== 'undefined') fd.append('bloomEnabled', String(payload.bloomEnabled));
        if (typeof payload.oceanEnabled !== 'undefined') fd.append('oceanEnabled', String(payload.oceanEnabled));
        if (typeof payload.rainEnabled !== 'undefined') fd.append('rainEnabled', String(payload.rainEnabled));
        if (typeof payload.cameraState !== 'undefined') fd.append('cameraState', payload.cameraState);
        if (typeof payload.environmentColor !== 'undefined') fd.append('environmentColor', payload.environmentColor);
        try { fd.append("thumbnail", thumbnailBlob, `thumb_${safeDate()}.png`); } catch (e) { console.warn("thumbnail append failed", e); }
        if (useSceneFile) {
          try { fd.append('scene', sceneFile, sceneFile.name || 'scene.deflate'); } catch (e) { console.warn('scene append failed', e); }
          if (sceneMeta?.encoding) fd.append('sceneEncoding', sceneMeta.encoding);
          if (sceneMeta?.originalSize) fd.append('sceneOriginalSize', String(sceneMeta.originalSize));
          if (sceneMeta?.compressedSize) fd.append('sceneCompressedSize', String(sceneMeta.compressedSize));
        }
        if (extraFiles) {
          Object.entries(extraFiles).forEach(([field, file]) => {
            if (file) {
              try { fd.append(field, file, file.name || `env_${Date.now()}`); } catch (e) { console.warn('append extra file failed', field, e); }
            }
          });
        }

        // include auth headers except content-type
        const authHeaders = getAuthHeaders() || {};
        const fetchHeaders = {};
        Object.keys(authHeaders).forEach((h) => { if (h.toLowerCase() === "content-type") return; fetchHeaders[h] = authHeaders[h]; });

        const fetchOpts = {
          method,
          headers: fetchHeaders,
          credentials: "include",
          body: fd,
          signal: controller.signal,
        };

        if (typeof onUploadProgress === "function") {
          // XHR path for progress
          return await new Promise((resolve, reject) => {
            let xhr = null;
            try {
              xhr = new XMLHttpRequest();
              const onAbort = () => { try { xhr && xhr.abort(); } catch (e) {} };
              controller.signal.addEventListener?.("abort", onAbort);

              xhr.open(method, apiUrl(path));
              const authHeadersForXHR = getAuthHeaders();
              Object.keys(authHeadersForXHR || {}).forEach((h) => {
                if (h.toLowerCase() === "content-type") return;
                try { xhr.setRequestHeader(h, authHeadersForXHR[h]); } catch (e) {}
              });

              xhr.upload.onprogress = (ev) => {
                if (ev.lengthComputable) {
                  const p = ev.loaded / ev.total;
                  try { onUploadProgress(p); } catch (e) {}
                  try { projectSocketRef.current?.emit?.("project_save_progress", { projectId: projectIdHint || null, progress: p }); } catch (e) {}
                }
              };

              xhr.onload = () => {
                try { controller.signal.removeEventListener?.("abort", onAbort); } catch (e) {}
                const status = xhr.status;
                const text = xhr.responseText;
                try {
                  const json = JSON.parse(text);
                  if (status >= 200 && status < 300) resolve(json);
                  else {
                    if (status === 401) forceLogoutDueTo401();
                    console.warn("[OBJEKTA] upload non-ok XHR", { status, body: json });
                    reject({ status, body: json });
                  }
                } catch (err) {
                  if (status >= 200 && status < 300) resolve(text);
                  else {
                    if (status === 401) forceLogoutDueTo401();
                    console.warn("[OBJEKTA] upload non-ok XHR (text)", { status, body: text });
                    reject({ status, body: text });
                  }
                }
              };

              xhr.onerror = (e) => {
                try { controller.signal.removeEventListener?.("abort", onAbort); } catch (err) {}
                reject(e);
              };

              xhr.onabort = () => {
                try { controller.signal.removeEventListener?.("abort", onAbort); } catch (err) {}
                reject(new Error("Upload aborted (timeout or user cancelled)"));
              };

              xhr.send(fd);
            } catch (e) {
              try { controller.signal.removeEventListener?.("abort", () => {}); } catch (err) {}
              reject(e);
            }
          });
        } else {
          // fetch fallback (no progress)
          const res = await fetch(apiUrl(path), fetchOpts);
          const json = await safeJson(res);
          if (res.status === 401) {
            forceLogoutDueTo401();
            throw { status: 401, body: json };
          }
          if (!res.ok) {
            console.warn("[OBJEKTA] upload failed (fetch)", { url: apiUrl(path), status: res.status, body: json });
            throw { status: res.status, body: json };
          }
          return json;
        }
      }

      // JSON path (no thumbnail)
      const bodyToSend = JSON.stringify(payload);
      const res = await fetch(apiUrl(path), {
        method,
        headers: getAuthHeaders(),
        credentials: "include",
        body: bodyToSend,
        signal: controller.signal,
      });
      const json = await safeJson(res);
      if (res.status === 401) {
        forceLogoutDueTo401();
        throw { status: 401, body: json };
      }
      if (!res.ok) {
        console.warn("[OBJEKTA] API JSON request failed", { url: apiUrl(path), status: res.status, body: json });
        throw { status: res.status, body: json };
      }
      return json;
    } finally {
      clearTimeout(timeout);
    }
  }, [getAuthHeaders, safeDate, forceLogoutDueTo401]);

  // Compress snapshot off the main thread when possible.
  const compressSceneSnapshot = useCallback(async (snapshot) => {
    if (!snapshot) return { ok: false, reason: "no-snapshot" };

    const encodeScene = () => {
      const json = JSON.stringify(snapshot);
      const encoded = new TextEncoder().encode(json);
      return { json, encoded };
    };

    // First choice: worker offloads work from the main thread
    if (typeof Worker === "function") {
      try {
        if (!compressSceneSnapshot.worker) {
          compressSceneSnapshot.worker = new Worker(new URL('../workers/sceneCompress.worker.js', import.meta.url), { type: 'module' });
        }
        const worker = compressSceneSnapshot.worker;
        const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
        return await new Promise((resolve) => {
          const timer = setTimeout(() => resolve({ ok: false, reason: "timeout" }), 30000);
          const handler = (ev) => {
            if (!ev?.data || ev.data.id !== id) return;
            worker.removeEventListener('message', handler);
            clearTimeout(timer);
            resolve(ev.data);
          };
          worker.addEventListener('message', handler);
          worker.postMessage({ scene: snapshot, id });
        });
      } catch (err) {
        console.warn('[OBJEKTA] worker compress failed, falling back', err);
      }
    }

    // Built-in CompressionStream when available (Chrome/Edge)
    if (typeof CompressionStream === "function") {
      try {
        const { json } = encodeScene();
        const stream = new CompressionStream("deflate");
        const writer = stream.writable.getWriter();
        writer.write(new TextEncoder().encode(json));
        writer.close();
        const compressed = await new Response(stream.readable).arrayBuffer();
        return { ok: true, buffer: compressed, compressedSize: compressed.byteLength, originalSize: json.length };
      } catch (err) {
        console.warn('[OBJEKTA] CompressionStream deflate failed, continuing to pako', err);
      }
    }

    // Final fallback: synchronous deflate via static pako import
    try {
      const { encoded } = encodeScene();
      const deflated = deflate(encoded);
      return { ok: true, buffer: deflated.buffer, compressedSize: deflated.byteLength, originalSize: encoded.byteLength };
    } catch (err) {
      return { ok: false, reason: err?.message || 'deflate-fail' };
    }
  }, []);

  // Create / update project on server (now support thumbnail + progress)
  const createProjectOnServer = useCallback(async (name, data, { thumbnail = null, onUploadProgress = null } = {}) => {
    const payload = { name, title: name, data, lastSavedAt: new Date().toISOString() };
    const json = await sendJsonOrForm("/api/projects", "POST", payload, { thumbnailBlob: thumbnail, onUploadProgress });
    return json?.project || json;
  }, [sendJsonOrForm]);

  const updateProjectOnServer = useCallback(async (id, name, data, { thumbnail = null, onUploadProgress = null } = {}) => {
    if (!id) throw new Error("Project id required");
    const payload = { name, title: name, data, lastSavedAt: new Date().toISOString() };
    const json = await sendJsonOrForm(`/api/projects/${id}`, "PUT", payload, { thumbnailBlob: thumbnail, onUploadProgress, projectIdHint: id });
    return json?.project || json;
  }, [sendJsonOrForm]);

  const deleteProjectOnServer = useCallback(async (id) => {
    const res = await fetch(apiUrl(`/api/projects/${id}`), {
      method: "DELETE",
      headers: getAuthHeaders(),
      credentials: "include",
    });
    const json = await safeJson(res);
    if (res.status === 401) {
      forceLogoutDueTo401();
      throw new Error("Session expired");
    }
    if (!res.ok) {
      const msg = json?.message || json?.error || JSON.stringify(json);
      throw new Error(msg || "Delete project failed");
    }
    return json;
  }, [getAuthHeaders, forceLogoutDueTo401]);

  // Fallback local storage for offline saves (improved to handle quota + IndexedDB fallback)
  const saveLocalBackup = useCallback(async (name, data) => {
    const label = name || "untitled";
    const attemptIndexedDb = async (reason = "") => {
      try {
        const id = await saveBackupToIndexedDB("local-fallback", { name: label, data });
        if (id) return { ok: true, target: "indexedDB" };
        return { ok: false, reason: reason || "indexeddb-unavailable" };
      } catch (idxErr) {
        console.warn("IndexedDB backup failed", idxErr);
        return { ok: false, reason: reason || idxErr?.message || "indexeddb-error" };
      }
    };

    let approxBytes = 0;
    try {
      const serialized = JSON.stringify(data || {});
      approxBytes = serialized ? serialized.length : 0;
    } catch (sizeErr) {
      console.warn("Failed to estimate snapshot size, skipping localStorage", sizeErr);
      return attemptIndexedDb("serialize-failed");
    }

    const LOCAL_STORAGE_BUDGET = 4 * 1024 * 1024; // 4 MB safety margin
    if (approxBytes > LOCAL_STORAGE_BUDGET) {
      return attemptIndexedDb("payload-too-large");
    }

    try {
      let store = [];
      try { store = JSON.parse(localStorage.getItem("objekta_local_backups") || "[]"); } catch (e) { store = []; }
      store.unshift({ id: "local-" + Date.now(), name: label, lastSavedAt: new Date().toISOString(), data });
      localStorage.setItem("objekta_local_backups", JSON.stringify(store.slice(0, 15)));
      return { ok: true, target: "localStorage" };
    } catch (err) {
      console.warn("localStorage backup failed, trying IndexedDB", err);
      return attemptIndexedDb("localstorage-failed");
    }
  }, [saveBackupToIndexedDB]);

  const handleRestoreBackup = useCallback(async (entry) => {
    if (!entry) return;

    try {
      if (entry.type === "scene-data" && entry.data) {
        if (workspaceRef.current?.loadFromData) await workspaceRef.current.loadFromData(entry.data);
        else if (workspaceRef.current?.applyScene) await workspaceRef.current.applyScene(entry.data);
        if (entry.name) setProjectName(entry.name);
        setIsDirty(true);
        lastLocalSnapshotRef.current = entry.data;
        pushToast({ type: "info", message: "Backup restored (scene data)" });
        return;
      }

      if ((entry.type === "glb-blob" || entry.type === "glb-index") && entry.blob) {
        const file = new File([entry.blob], entry.name || "backup.glb", { type: "model/gltf-binary" });
        await importGLTF(file);
        setIsDirty(true);
        pushToast({ type: "info", message: "Backup restored (GLB)" });
        return;
      }

      if (entry.type === "glb-index" && entry.url) {
        if (entry.url.startsWith("blob:")) {
          pushToast({ type: "error", message: "Backup URL expired. Try IndexedDB backup instead." });
          return;
        }
        const res = await fetch(entry.url);
        if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
        const blob = await res.blob();
        const file = new File([blob], entry.name || "backup.glb", { type: "model/gltf-binary" });
        await importGLTF(file);
        setIsDirty(true);
        pushToast({ type: "info", message: "Backup restored (GLB URL)" });
        return;
      }

      pushToast({ type: "error", message: "Backup restore failed (unsupported entry)." });
    } catch (e) {
      console.warn("restore backup failed", e);
      pushToast({ type: "error", message: "Backup restore failed" });
    }
  }, [importGLTF, pushToast]);

  // Initialize project socket (realtime sync) -> dynamic import to avoid build error
  useEffect(() => {
    let mounted = true;
    (async () => {
      if (typeof window !== 'undefined') {
        if (window.__OBJEKTA_STUDIO_SOCKET_INITIALIZED) return;
        window.__OBJEKTA_STUDIO_SOCKET_INITIALIZED = true;
      }
      try {
  const base = API_BASE || window.location.origin;
  const module = await import("socket.io-client").catch(() => null);
        if (!module) {



          // socket lib missing — silently skip realtime
          return;
        }
        const ioClient = module.io || module.default || module;
        const socket = ioClient(base, { path: "/socket.io", transports: ["websocket", "polling"], autoConnect: true, withCredentials: true });
        projectSocketRef.current = socket;

        socket.on("connect", () => {
          if (!mounted) return;
          setIsConnectedToServer(true);
          if (projectId) socket.emit("join", { projectId });
        });

        socket.on("disconnect", () => { if (!mounted) return; setIsConnectedToServer(false); });

        socket.on("project:patched", async (payload) => {
          try {
            if (!payload || !payload.projectId) return;
            if (!projectId || payload.projectId !== projectId) return;
            if (isApplyingRemoteRef.current) return;
            const serverTs = payload.lastSavedAt ? new Date(payload.lastSavedAt).getTime() : Date.now();
            const lastKnown = lastServerSavedAtRef.current ? new Date(lastServerSavedAtRef.current).getTime() : 0;
            if (serverTs > lastKnown) {
              const proj = await getProject(payload.projectId);
              if (!proj) return;
              isApplyingRemoteRef.current = true;
              if (workspaceRef.current?.loadFromData) await workspaceRef.current.loadFromData(proj.data || {});
              else if (workspaceRef.current?.applyScene) await workspaceRef.current.applyScene?.(proj.data || {});
              isApplyingRemoteRef.current = false;
              lastLocalSnapshotRef.current = proj.data || {};
              lastServerSavedAtRef.current = proj.lastSavedAt || new Date().toISOString();
              setLastSavedAt(lastServerSavedAtRef.current);
              setIsDirty(false);
              pushToast({ type: "info", message: "Project updated by collaborator; reloaded." });
            }
          } catch (err) {
            console.warn("Failed to apply remote project patch:", err);
          }
        });

        socket.on("projects:changed", () => fetchProjects());

        // NEW: update UI on asset registration
        socket.on("project_asset_added", ({ projectId: pid, asset }) => {
          try {
            if (!pid) return;
            if (projectId && pid === projectId) {
              pushToast({ type: asset?.source === 's3' ? 'info' : 'warn', message: `Asset added${asset?.source ? ` (${asset.source})` : ''}` });
            }
          } catch (e) {}
        });

        projectSocketRef.current = socket;
      } catch (e) { console.warn("project socket init failed", e); }
    })();

    return () => {
      mounted = false;
      try { projectSocketRef.current?.disconnect(); } catch (e) {}
      projectSocketRef.current = null;
      if (typeof window !== 'undefined') {
        window.__OBJEKTA_STUDIO_SOCKET_INITIALIZED = false;
      }
    };
    // NOTE: intentionally no deps to run once
  }, []);

  // Join/leave when projectId changes
  useEffect(() => {
    if (!projectSocketRef.current) return;
    try {
      if (projectId) projectSocketRef.current.emit("join", { projectId });
      else projectSocketRef.current.emit("leave");
    } catch (e) { console.warn("socket join/leave err", e); }
  }, [projectId]);

  // Save project (create or update) using fetch + local fallback
  const saveProject = useCallback(async (opts = { saveAs: false, name: null, returnToDashboard: false }) => {
    setIsSaving(true);
    setSaveProgress(0);

    let snapshot = null;
    let nameToUse = projectName;

    try {
      snapshot = workspaceRef.current?.serializeScene?.();
      if (!snapshot) {
        pushToast({ type: "error", message: "No scene snapshot available" });
        return null;
      }

      // inject meta (effects + camera + environment + animation + bloom tags)
      try {
        const { camera } = probeWorkspace();
        const camState = camera ? { position: camera.position.toArray(), quaternion: camera.quaternion.toArray(), fov: camera.fov } : null;
        const animApi = workspaceRef.current?.getAnimationApi?.();
        const tracks = animApi ? animApi.listTracks() : [];
        const bloomTagged = [];
        try {
          const scene = workspaceRef.current?.scene;
          if (scene) scene.traverse(o => { if (o.isMesh && o.userData?.__bloom) bloomTagged.push(o.uuid); });
        } catch (err) {}
        snapshot = { ...snapshot, meta: { ...(snapshot.meta || {}), effects: { bloomEnabled, oceanEnabled, rainEnabled }, cameraState: camState, environmentColor: envColor, animationTracks: tracks, bloomTagged } };
      } catch (e) {}

      if (opts.saveAs) {
        if (opts.name) nameToUse = opts.name;
        else {
          const res = await promptInput({ title: "Save project as", message: "Enter a name for the project:", placeholder: "Project name", defaultValue: projectName || "Untitled Project" });
          if (!res || !res.confirmed) { pushToast({ type: "error", message: "Save cancelled (no name)" }); return null; }
          nameToUse = (res.value || "").trim();
        }
      } else {
        nameToUse = projectName;
      }
      if (!nameToUse) { pushToast({ type: "error", message: "Save cancelled (no name)" }); return null; }

      // capture thumbnail: prefer workspaceRef.captureThumbnail (async) then robust async helper
      let thumbnail = null;
      try {
        const captureFromWorkspace = workspaceRef.current?.captureThumbnail;
        if (typeof captureFromWorkspace === "function") {
          for (let attempt = 0; attempt < 3 && !thumbnail; attempt++) {
            if (attempt > 0) await new Promise((r) => requestAnimationFrame(r));
            const data = await Promise.resolve(captureFromWorkspace.call(workspaceRef.current, 0.6, "image/png", 0.95));
            if (!data) continue;
            if (data instanceof Blob) { thumbnail = data; break; }
            if (typeof data === "string") {
              const b = await dataUrlToBlob(data);
              if (b) { thumbnail = b; break; }
            }
          }
        }

        if (!thumbnail) {
          for (let attempt = 0; attempt < 3 && !thumbnail; attempt++) {
            if (attempt > 0) await new Promise((r) => requestAnimationFrame(r));
            const blob = await captureThumbnailAsync();
            if (blob instanceof Blob) { thumbnail = blob; break; }
          }
        }
      } catch (e) {
        console.warn('[OBJEKTA] thumbnail capture failed', e);
        thumbnail = null;
      }

      if (!thumbnail) {
        thumbnail = await transparentPlaceholderBlob();
      }

      try { console.log(`[OBJEKTA] saveProject captured thumbnail size=${(thumbnail && (thumbnail.size || (thumbnail.length || 0))) || 0}`); } catch (e) {}

      const onUploadProgress = (p) => {
        setSaveProgress(Math.max(0, Math.min(1, p)));
        setLoadProgress?.(p);
        try { projectSocketRef.current?.emit?.("project_save_progress", { projectId: projectId || null, progress: p }); } catch (e) {}
      };

      let saved = null;
      const compressResult = await compressSceneSnapshot(snapshot);
      const allowThumb = true;
      let snapshotPayload = snapshot;
      let extraFields = {};
      let sceneFile = null;
      let sceneMeta = null;

      if (compressResult && compressResult.ok && compressResult.buffer) {
        const blob = new Blob([compressResult.buffer], { type: 'application/octet-stream' });
        sceneFile = new File([blob], `scene_${Date.now()}.deflate`, { type: 'application/octet-stream' });
        sceneMeta = { encoding: 'deflate', originalSize: compressResult.originalSize || 0, compressedSize: compressResult.compressedSize || blob.size };
        snapshotPayload = undefined; // prefer uploading compressed file instead of inline
        extraFields = { dataEncoding: 'deflate', dataCompressed: true };
      } else {
        console.warn('[OBJEKTA] compression unavailable, falling back to raw JSON file upload');
        try {
          const jsonString = JSON.stringify(snapshot);
          const rawBlob = new Blob([jsonString], { type: 'application/json' });
          sceneFile = new File([rawBlob], `scene_${Date.now()}.json`, { type: 'application/json' });
          sceneMeta = { encoding: 'json', originalSize: rawBlob.size, compressedSize: rawBlob.size };
          snapshotPayload = undefined;
          extraFields = { dataEncoding: 'json', dataCompressed: false };
        } catch (jsonErr) {
          let inlineSize = 0;
          try { inlineSize = JSON.stringify(snapshot).length; } catch (e) { inlineSize = 0; }
          const INLINE_LIMIT = 12_000_000; // mirrors backend inline cap
          if (inlineSize > INLINE_LIMIT) {
            pushToast({ type: "error", message: "Scene too large to save without compression. Try reducing scene size or reloading." });
            setIsSaving(false);
            setSaveProgress(0);
            return null;
          }
          try {
            const jsonString = JSON.stringify(snapshot);
            snapshotPayload = JSON.parse(jsonString);
          } catch (e) {
            snapshotPayload = snapshot;
          }
        }
      }

      if (!projectId || opts.saveAs) {
        saved = await sendJsonOrForm('/api/projects', 'POST', { name: nameToUse, title: nameToUse, data: snapshotPayload, lastSavedAt: new Date().toISOString(), ...extraFields, bloomEnabled, oceanEnabled, rainEnabled, cameraState: snapshot.meta?.cameraState ? JSON.stringify(snapshot.meta.cameraState) : undefined, environmentColor: envColor }, { thumbnailBlob: allowThumb ? thumbnail : null, onUploadProgress, extraFiles: envFileRef.current ? { environment: envFileRef.current } : null, sceneFile, sceneMeta });
        if (saved && saved._id) {
          setProjectId(saved._id);
          setProjectName(saved.name || saved.title || nameToUse);
          if (projectSocketRef.current && saved._id) projectSocketRef.current.emit("join", { projectId: saved._id });
        }
      } else {
        saved = await sendJsonOrForm(`/api/projects/${projectId}`, 'PUT', { name: nameToUse, title: nameToUse, data: snapshotPayload, lastSavedAt: new Date().toISOString(), ...extraFields, bloomEnabled, oceanEnabled, rainEnabled, cameraState: snapshot.meta?.cameraState ? JSON.stringify(snapshot.meta.cameraState) : undefined, environmentColor: envColor }, { thumbnailBlob: allowThumb ? thumbnail : null, onUploadProgress, projectIdHint: projectId, extraFiles: envFileRef.current ? { environment: envFileRef.current } : null, sceneFile, sceneMeta });
      }

      setIsDirty(false);
      lastLocalSnapshotRef.current = snapshot;
      lastServerSavedAtRef.current = saved?.lastSavedAt || new Date().toISOString();
      setLastSavedAt(lastServerSavedAtRef.current);
      fetchProjects();

      try {
        if (saved && saved._id) {
          const thumbUrl = saved.thumbnailUrl ?? null;
          if (thumbUrl) {
            projectSocketRef.current?.emit?.("project_thumbnail_updated", { projectId: saved._id, thumbnailUrl: thumbUrl });
          }
          projectSocketRef.current?.emit?.("project_updated", { projectId: saved._id, lastSavedAt: saved.lastSavedAt, project: saved });
        }
      } catch (e) {}

      pushToast({ type: "info", message: "Project saved to server" });

      if (opts.returnToDashboard) navigate("/dashboard");

      return saved;
    } catch (err) {
      console.warn("server save failed, performing local backup", err);
      try {
        if (err && typeof err === "object" && err.body) console.warn("server response body:", err.body);
      } catch (e) {}

      let backupResult = null;
      try {
        backupResult = await saveLocalBackup(nameToUse, snapshot);
      } catch (e) {
        console.warn("saveLocalBackup threw", e);
        backupResult = { ok: false, reason: e?.message || "local-backup-error" };
      }

      if (backupResult?.ok) {
        const targetLabel = backupResult.target === "indexedDB" ? "IndexedDB" : "local storage";
        pushToast({ type: "warn", message: `Server save failed — backup stored in ${targetLabel}` });
        setPropsTab("backups");
      } else {
        const reasonSuffix = backupResult?.reason ? ` (${backupResult.reason})` : "";
        pushToast({ type: "error", message: `Server save failed — backup storage failed${reasonSuffix}` });
      }

      setIsSaving(false);
      setIsDirty(false);
      lastLocalSnapshotRef.current = snapshot;
      setSaveProgress(0);
      return null;
    } finally {
      setIsSaving(false);
      setSaveProgress(0);
    }
  }, [projectId, projectName, createProjectOnServer, updateProjectOnServer, fetchProjects, saveLocalBackup, captureThumbnail, navigate, setPropsTab]);

  const saveAsProject = useCallback(async () => {
    try {
      const res = await promptInput({ title: "Save project as", message: "Enter a name for the project:", placeholder: "Project name", defaultValue: projectName || "Untitled Project" });
      if (!res || !res.confirmed) return null;
      const name = (res.value || "").trim();
      if (!name) return null;
      return saveProject({ saveAs: true, name });
    } catch (e) { return null; }
  }, [projectName, saveProject]);

  const newProject = useCallback(async (opts = { promptSaveIfDirty: true }) => {
    try {
      if (isDirty && opts.promptSaveIfDirty) {
        const ok = await askConfirm({ title: "Unsaved changes", message: "You have unsaved changes. Save before creating a new project?", confirmLabel: "Save", cancelLabel: "Don't save" });
        if (ok) await saveProject();
      }
      setProjectId(null);
      setProjectName("Untitled Project");
      setIsDirty(false);
      setLastSavedAt(null);
      lastLocalSnapshotRef.current = null;
      lastServerSavedAtRef.current = null;
      if (projectSocketRef.current) projectSocketRef.current.emit("leave");
      if (workspaceRef.current?.resetScene) workspaceRef.current.resetScene();
      pushToast({ type: "info", message: "New project created (local)" });
    } catch (e) { console.error(e); }
  }, [isDirty, saveProject]);

  const loadProject = useCallback(async (id) => {
    if (!id) return;
    try {
      if (isDirty) {
        const ok = await askConfirm({ title: "Unsaved changes", message: "You have unsaved changes. Save before loading another project?", confirmLabel: "Save", cancelLabel: "Don't save" });
        if (ok) await saveProject();
      }
      setLoading(true);
      const proj = await getProject(id);
      if (!proj) throw new Error("Project not found");
      isApplyingRemoteRef.current = true;
      if (workspaceRef.current?.loadFromData) await workspaceRef.current.loadFromData(proj.data || {});
      else if (workspaceRef.current?.applyScene) await workspaceRef.current.applyScene?.(proj.data || {});
      isApplyingRemoteRef.current = false;

      // Reapply environment (color or HDR) & effects & camera POV if metadata present
      try {
        const meta = (proj.data && proj.data.meta) ? proj.data.meta : {};
        // Restore animation tracks
        if (Array.isArray(meta.animationTracks)) {
          try {
            const animApi = workspaceRef.current?.getAnimationApi?.();
            if (animApi) {
              animApi.clear();
              meta.animationTracks.forEach(t => animApi.addTrack(t));
              animApi.seek(0);
            }
          } catch (e) { console.warn('restore animation tracks failed', e); }
        }
        // Restore bloom tags
        if (Array.isArray(meta.bloomTagged) && postApiRef.current?.tagForBloom) {
          try {
            const scene = workspaceRef.current?.scene;
            if (scene) meta.bloomTagged.forEach(id => { const o = scene.getObjectByProperty('uuid', id); if (o) postApiRef.current.tagForBloom(o, true); });
          } catch (e) { console.warn('restore bloom tags failed', e); }
        }
        const envColorVal = meta.environmentColor || proj.environmentColor || null;
        if (envColorVal) {
          if (envApiRef.current?.setBackgroundColor) envApiRef.current.setBackgroundColor(envColorVal);
          setEnvColor(envColorVal);
        }
        // Attempt to load environment map file (only if HDR/EXR and server path exists)
        const envMapPath = proj.environmentMap || (meta.environmentMap) || null;
        if (envMapPath && envApiRef.current?.setHDR && /\.(hdr|exr)$/i.test(envMapPath)) {
          try { await envApiRef.current.setHDR(envMapPath); } catch (e) { console.warn('Reload envMap failed', e); }
        }
        // Effects toggles
        const effects = meta.effects || proj.effects || {};
        if (typeof effects.bloomEnabled === 'boolean' && effects.bloomEnabled !== bloomEnabled) toggleBloom(effects.bloomEnabled);
        if (typeof effects.oceanEnabled === 'boolean' && effects.oceanEnabled !== oceanEnabled) toggleOcean(effects.oceanEnabled);
        if (typeof effects.rainEnabled === 'boolean' && effects.rainEnabled !== rainEnabled) toggleRain(effects.rainEnabled);
        // Camera state
        const camState = meta.cameraState || proj.cameraState || null;
        if (camState && Array.isArray(camState.position) && Array.isArray(camState.quaternion)) {
          try {
            const { camera } = probeWorkspace();
            if (camera) {
              camera.position.fromArray(camState.position);
              camera.quaternion.fromArray(camState.quaternion);
              if (typeof camState.fov === 'number') { camera.fov = camState.fov; camera.updateProjectionMatrix(); }
              if (cameraControlsApiRef.current?.controls) {
                const forward = new THREE.Vector3(0,0,-1).applyQuaternion(camera.quaternion);
                const target = camera.position.clone().add(forward.multiplyScalar(5));
                cameraControlsApiRef.current.controls.target.copy(target);
                cameraControlsApiRef.current.controls.update();
              }
            }
          } catch (e) { console.warn('apply cameraState failed', e); }
        }
      } catch (e) { console.warn('restore meta failed', e); }

      setProjectId(proj._id);
      setProjectName(proj.name || proj.title || "Untitled Project");
      setIsDirty(false);
      lastLocalSnapshotRef.current = proj.data || {};
      lastServerSavedAtRef.current = proj.lastSavedAt || new Date().toISOString();
      setLastSavedAt(lastServerSavedAtRef.current);
      if (projectSocketRef.current) projectSocketRef.current.emit("join", { projectId: proj._id });
      pushToast({ type: "info", message: `Loaded project '${proj.name || proj.title || ""}'` });
      fetchProjects();
    } catch (err) {
      console.error("loadProject failed", err);
      pushToast({ type: "error", message: "Failed to load project" });
    } finally {
      setLoading(false);
    }
  }, [isDirty, saveProject, getProject, fetchProjects]);

  const deleteProject = useCallback(async (id) => {
    if (!id) return;
    setConfirmState({
      open: true,
      title: 'Delete Project',
      message: 'Delete this project permanently? This cannot be undone.',
      onConfirm: async () => {
        try {
          await deleteProjectOnServer(id);
          if (id === projectId) {
            setProjectId(null);
            setProjectName("Untitled Project");
            setIsDirty(false);
            setLastSavedAt(null);
            lastLocalSnapshotRef.current = null;
            lastServerSavedAtRef.current = null;
            if (workspaceRef.current?.resetScene) workspaceRef.current.resetScene();
            if (projectSocketRef.current) projectSocketRef.current.emit("leave");
          }
          fetchProjects();
          pushToast({ type: "info", message: "Project deleted" });
        } catch (err) {
          console.error("deleteProject failed", err);
          pushToast({ type: "error", message: "Delete failed" });
        }
      },
    });
  }, [projectId, fetchProjects, deleteProjectOnServer]);

  // Autosave logic: uses saveProject (which itself has fallback)
  useEffect(() => {
    if (autosaveTimerRef.current) {
      clearInterval(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }
    if (isAutosave) {
      autosaveTimerRef.current = setInterval(async () => {
        try {
          if (!isDirty) return;
          if (isSaving) return;
          await saveProject({ saveAs: false });
        } catch (err) {
          console.warn("Autosave error:", err);
        }
      }, Math.max(2000, 5000));
    }
    return () => {
      if (autosaveTimerRef.current) {
        clearInterval(autosaveTimerRef.current);
        autosaveTimerRef.current = null;
      }
    };
  }, [isAutosave, isDirty, isSaving, saveProject]);

  // expose small setDirty method (unchanged)
  useEffect(() => {
    window.__studio_set_dirty = (val = true) => setIsDirty(Boolean(val));
    return () => { try { delete window.__studio_set_dirty; } catch {} };
  }, []);

  // Fetch initial project list on mount
  useEffect(() => { fetchProjects(); }, [fetchProjects]);

  /* --------------------- AUTO-LOAD when navigated from Dashboard --------------------- */
  // If Dashboard passes { state: { projectId } } or { sceneId }, load that project automatically
  useEffect(() => {
    const st = location?.state || {};
    if (!st) return;
    const pid = st.projectId || null;
    const sid = st.sceneId || null;
    if (pid) {
      // ensure workspace is ready - give it a short delay if needed
      setTimeout(() => {
        try {
          loadProject(pid);
        } catch (e) {
          console.warn("Auto load project failed", e);
        }
      }, 120);
    } else if (sid) {
      setTimeout(() => {
        (async () => {
          try {
            const res = await fetch(apiUrl(`/api/scenes/${encodeURIComponent(sid)}`), { headers: getAuthHeaders(), credentials: "include" });
            const body = await safeJson(res);
            const sceneData = body?.scene || body;
            if (sceneData) {
              if (workspaceRef.current?.loadFromData) workspaceRef.current.loadFromData(sceneData);
              else if (workspaceRef.current?.applyScene) workspaceRef.current.applyScene(sceneData);
              pushToast({ type: "info", message: "Loaded scene from link" });
            }
          } catch (e) {
            console.warn("Auto-load scene failed", e);
          }
        })();
      }, 120);
    }
    else if (st.importUrl || st.modelUrl) {
      const url = st.importUrl || st.modelUrl;
      // wait for importerApiRef to be ready then call loadFromURL
      let attempts = 0;
      const tryImport = () => {
        attempts++;
        try {
          if (importerApiRef.current && typeof importerApiRef.current.loadFromURL === 'function') {
            importerApiRef.current.loadFromURL(url);
            pushToast({ type: 'info', message: 'Importing model…' });
            return;
          }
        } catch (e) { console.warn('auto import failed', e); }
        if (attempts < 40) setTimeout(tryImport, 150);
        else pushToast({ type: 'error', message: 'Import failed: importer unavailable' });
      };
      setTimeout(tryImport, 120);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location?.state]);

  /* --------------------- UI render --------------------- */

  const panelTopOffset = (toolbarRef.current?.getBoundingClientRect?.()?.height ?? 64) + 12;

  // Resize workspace when panels change
  useEffect(() => {
    if (workspaceRef.current && workspaceRef.current.resize) {
      // small delay to allow CSS transition to finish or start
      const t = setTimeout(() => workspaceRef.current.resize(), 50);
      const t2 = setTimeout(() => workspaceRef.current.resize(), 200); // backup
      return () => { clearTimeout(t); clearTimeout(t2); };
    }
  }, [paletteCollapsed, paletteWidth, propsWidth, isFullScreen]);

  return (
    <DndProvider backend={HTML5Backend}>
      <div ref={containerRef} className="studio-container" role="region" aria-label="3D Studio">
        <StudioToast toasts={toasts} onDismiss={removeToast} />
          <Loader active={loading || collabLoading} message={loading ? `Importing model...` : (collabLoading ? "Connecting to collab..." : "")} progress={loadProgress} />
        <ConfirmModal
          open={confirmState.open}
          title={confirmState.title}
          message={confirmState.message}
          showInput={confirmState.showInput}
          inputDefault={confirmState.inputDefault}
          inputPlaceholder={confirmState.inputPlaceholder}
          onCancel={() => { confirmState.onCancel?.(); setConfirmState((s) => ({ ...s, open: false })); }}
          onConfirm={(val) => { confirmState.onConfirm?.(val); setConfirmState((s) => ({ ...s, open: false })); }}
        />

        {/* Palette panel */}
        <div className="studio-panel palette-panel reveal" style={{ width: paletteWidth, minWidth: 44 }}>
          <div className="palette-inner">
            <Palette
              items={PALETTE_ITEMS.map((it) => ({ ...it, fav: false }))}
              onAction={(name, client) => workspaceRef.current?.addItem?.(name, client)}
            />
            {!paletteCollapsed && (
              <div className="palette-resizer" onMouseDown={(e) => {
                e.preventDefault();
                resizingRef.current = true;
                const startX = e.clientX;
                const startW = paletteWidthRef.current ?? paletteWidth;
                const onMove = (ev) => {
                  if (!resizingRef.current) return;
                  const newWidth = Math.max(120, Math.min(420, startW + ev.clientX - startX));
                  setPaletteWidth(newWidth);
                  paletteWidthRef.current = newWidth;
                  localStorage.setItem("objekta_palette_width", String(newWidth));
                };
                const onUp = () => {
                  resizingRef.current = false;
                  window.removeEventListener("mousemove", onMove);
                  window.removeEventListener("mouseup", onUp);
                };
                window.addEventListener("mousemove", onMove);
                window.addEventListener("mouseup", onUp);
              }} />
            )}
          </div>
          {/* palette collapse removed per request */}
        </div>

        {/* Workspace area */}
        <div className="workspace-area studio-canvas-wrap card-3d">
          <div ref={toolbarRef} className="studio-toolbar reveal studio-hud" role="toolbar" aria-label="Studio toolbar">
            {/* History group */}
            <div className="toolbar-group" role="group" aria-label="History">
            <button className="studio-btn icon-btn" onClick={() => workspaceRef.current?.undo?.()} title="Undo (Ctrl/Cmd+Z)" aria-label="Undo"><FiRotateCcw /></button>
            <button className="studio-btn icon-btn" onClick={() => workspaceRef.current?.redo?.()} title="Redo (Ctrl/Cmd+Y)" aria-label="Redo"><FiRotateCw /></button>
            </div>

            {/* Transform group */}
            <div className="toolbar-group" role="group" aria-label="Transform">
            <div className="segmented-control" role="group" aria-label="Transform modes">
              {[["translate", "Move"], ["rotate", "Rotate"], ["scale", "Scale"]].map(([m, label]) => (
                <button key={m} onClick={() => setActiveMode(m)} className={activeMode === m ? 'active' : ''} title={`${label} mode`} aria-pressed={activeMode === m}>{label}</button>
              ))}
            </div>

            <div className="studio-btn snap-control" role="group" aria-label="Snap controls">
              <label className="snap-toggle-label" title="Toggle snapping">
                <input aria-label="Toggle snap" type="checkbox" checked={snapEnabled} onChange={() => { setSnapEnabled((v) => !v); workspaceRef.current?.toggleSnap?.(); }} />
                Snap
              </label>
              <input aria-label="Snap size" type="number" value={snapSize} step={0.1} min={0} onChange={(e) => { const v = parseFloat(e.target.value); if (Number.isFinite(v)) setSnapSize(v); }} title="Snap size" />
            </div>
            </div>

            {/* Shading group */}
            <div className="toolbar-group" role="group" aria-label="Shading">
            <div className="toolbar-shading-group">
              <div className="segmented-control" role="group" aria-label="Viewport shading">
                {[ ['rendered', 'Rendered'], ['solid', 'Solid'], ['material', 'Material'], ['wireframe', 'Wireframe'] ].map(([mode, label]) => (
                  <button key={mode} onClick={() => setViewMode(mode)} className={viewMode === mode ? 'active' : ''} title={`${label} view`} aria-pressed={viewMode === mode}>{label}</button>
                ))}
              </div>
            </div>
            </div>

            {/* Actions group */}
            <div className="toolbar-group" role="group" aria-label="Actions">
            <button className="studio-btn icon-btn" onClick={() => duplicateWrapper()} title="Duplicate (Ctrl/Cmd+D)" aria-label="Duplicate"><FiCopy /></button>

            <label className="studio-btn icon-btn" title="Import GLB/GLTF" aria-label="Import">
              <FiUpload />
              <input aria-label="Import 3D Model" type="file" accept=".glb,.gltf,.obj,.fbx,.zip" className="sr-only" onChange={(e) => { const file = e.target.files?.[0]; if (file) { importGLTF(file); e.target.value = ""; } }} />
            </label>

            <button className="studio-btn icon-btn" onClick={() => exportGLTF(true)} title="Export as GLB" aria-label="Export"><FiSave /></button>

            <button className="studio-btn icon-btn" onClick={() => saveJSON()} title="Save JSON (Ctrl/Cmd+S)" aria-label="Save JSON"><FiPlusSquare /></button>
            <button className="studio-btn icon-btn" onClick={() => requestResetScene()} title="Reset Scene" aria-label="Reset Scene"><FiRefreshCcw /></button>
            </div>

            {/* View group */}
            <div className="toolbar-group" role="group" aria-label="View">
            <button className="studio-btn icon-btn" onClick={() => {
              const el = containerRef.current; if (!el) return;
              if (!document.fullscreenElement) el.requestFullscreen(); else document.exitFullscreen();
            }} title={isFullScreen ? "Exit Fullscreen" : "Fullscreen"} aria-label={isFullScreen ? "Exit fullscreen" : "Enter fullscreen"}>
              {isFullScreen ? <FiMinimize /> : <FiMaximize />}
            </button>

            {/* Inspector collapse toggle removed */}

            <button className={`studio-btn icon-btn ${collabConnected || yjsConnected ? 'connected' : ''}`} onClick={() => startCollab()} title={collabConnected ? "Disconnect collaboration" : yjsConnected ? `Yjs: ${yjsStatus} (${remoteUsers.length} users)` : "Start collaboration"} aria-pressed={collabConnected || yjsConnected}>
              {collabConnected || yjsConnected ? <FiWifi /> : <FiWifiOff />}
            </button>

            <button className="studio-btn icon-btn" onClick={() => toggleSculpt()} title="Toggle sculpt" aria-label="Toggle sculpt"><FiEdit3 /></button>
            </div>

            {/* Viewport helpers */}
            <div className="toolbar-group toolbar-helpers" role="group" aria-label="Viewport helpers">
              <button className="studio-btn icon-btn" onClick={() => { try { workspaceRef.current?.frameAll?.(); cameraControlsApiRef.current?.resetView?.(); } catch (e) { workspaceRef.current?.onFullScreenChange?.(true); } }} title="Fit to view" aria-label="Fit to view"><FiMove /></button>
              <button className="studio-btn icon-btn" onClick={() => {
                (async () => {
                  const url = await captureThumbnailAsync();
                  if (url) {
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = 'scene.jpg';
                    document.body.appendChild(a);
                    a.click();
                    a.remove();
                  } else pushToast({ type: "error", message: "Screenshot failed" });
                })();
              }} title="Capture" aria-label="Capture"><FiCamera /></button>
              <label className={`studio-btn icon-btn ${environmentActive ? 'active' : ''}`} title="Load Environment" aria-label="Load environment">
                <FiSun />
                <input type="file" accept=".hdr,.exr,.jpg,.jpeg,.png" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (f) { applyEnvironmentFromFile(f); e.target.value=''; } }} />
              </label>
              <button className="studio-btn icon-btn" title="View Selected Camera" aria-label="View camera POV" onClick={() => {
                if (selected && selected.isCamera) {
                  workspaceRef.current?.setActiveCamera?.(selected.uuid);
                  pushToast({ type: 'info', message: 'Viewing through selected camera' });
                } else {
                  pushToast({ type: 'error', message: 'Select a camera object first' });
                }
              }}><FiVideo /></button>
              <button className="studio-btn icon-btn" onClick={() => { setPaletteCollapsed(false); }} title="Reset UI" aria-label="Reset UI"><FiLayout /></button>
              <button className="studio-btn icon-btn" onClick={() => toggleBloom(!bloomEnabled)} title="Toggle Bloom" aria-label="Toggle bloom"><FiZap /></button>
              <button className={`studio-btn ${oceanEnabled? 'active':''}`} onClick={()=>toggleOcean(!oceanEnabled)} title="Toggle Ocean" aria-label="Toggle ocean"><FiDroplet /></button>
              <button className={`studio-btn ${rainEnabled? 'active':''}`} onClick={()=>toggleRain(!rainEnabled)} title="Toggle Rain" aria-label="Toggle rain"><FiCloudRain /></button>
              <button className="studio-btn icon-btn" onClick={() => {
                try {
                  const scene = workspaceRef.current?.scene;
                  const grid = scene?._editorGroup?.getObjectByName("_grid");
                  if (grid) { grid.visible = !grid.visible; pushToast({ type: "info", message: `Grid ${grid.visible ? 'shown' : 'hidden'}` }); }
                } catch (e) {}
              }} title="Toggle Grid" aria-label="Toggle grid"><FiGrid /></button>
            </div>

            {/* File menu dropdown */}
            <div className="toolbar-group toolbar-file-menu" ref={fileMenuRef} role="group" aria-label="File">
              <button
                ref={fileMenuButtonRef}
                className="studio-btn icon-btn"
                onClick={() => {
                  setShowFileMenu((prev) => {
                    const next = !prev;
                    if (next) {
                      const rect = fileMenuButtonRef.current?.getBoundingClientRect?.();
                      if (rect) {
                        const width = 250;
                        const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8));
                        setFileMenuPos({ top: Math.round(rect.bottom + 6), left: Math.round(left) });
                      }
                    }
                    return next;
                  });
                }}
                title="File menu"
                aria-label="File menu"
                aria-expanded={showFileMenu}
              >
                <FiMenu />
              </button>
              {showFileMenu && (typeof document !== 'undefined' ? createPortal(
                <div
                  ref={fileMenuDropdownRef}
                  className="file-menu-dropdown"
                  style={{ top: fileMenuPos.top, left: fileMenuPos.left }}
                  role="menu"
                  tabIndex={-1}
                  onKeyDown={(e) => {
                    try {
                      const root = fileMenuDropdownRef.current;
                      if (!root) return;
                      const items = Array.from(root.querySelectorAll('button.file-menu-item, a.file-menu-item, select.file-menu-select'));
                      if (!items || items.length === 0) return;
                      const active = document.activeElement;
                      let idx = items.indexOf(active);
                      if (e.key === 'ArrowDown') {
                        e.preventDefault();
                        idx = (idx + 1) % items.length;
                        (items[idx]).focus();
                      } else if (e.key === 'ArrowUp') {
                        e.preventDefault();
                        idx = (idx - 1 + items.length) % items.length;
                        (items[idx]).focus();
                      } else if (e.key === 'Home') {
                        e.preventDefault(); items[0].focus();
                      } else if (e.key === 'End') {
                        e.preventDefault(); items[items.length - 1].focus();
                      } else if (e.key === 'Escape') {
                        setShowFileMenu(false);
                        fileMenuButtonRef.current?.focus?.();
                      } else if (e.key === 'Enter') {
                        if (active && (active.tagName === 'BUTTON' || active.tagName === 'A')) {
                          (active).click();
                        }
                      }
                    } catch (err) { /* ignore */ }
                  }}
                >
                  <div className="file-menu-section">
                    <select
                      aria-label="Open project"
                      value={projectId || ""}
                      onChange={(e) => {
                        const id = e.target.value || null;
                        if (id) { loadProject(id); setShowFileMenu(false); }
                      }}
                      role="menuitem"
                      className="file-menu-select"
                    >
                      <option value="">-- Open Project --</option>
                      {projects.map((p) => {
                        const displayName = p.name || p.title || `Project ${p._id || ""}`;
                        return <option key={p._id || (p.raw && (p.raw._id || p.raw.id))} value={p._id || (p.raw && (p.raw._id || p.raw.id))}>{displayName}</option>;
                      })}
                    </select>
                  </div>
                  <button role="menuitem" tabIndex={0} className="file-menu-item" onClick={() => { saveProject({ saveAs: false }); setShowFileMenu(false); }} disabled={isSaving}>
                    <FiUploadCloud /> {isSaving ? "Saving…" : "Save to Cloud"}
                  </button>
                  <button role="menuitem" tabIndex={0} className="file-menu-item" onClick={() => { saveAsProject(); setShowFileMenu(false); }}>
                    <FiSave /> Save As
                  </button>
                  <button role="menuitem" tabIndex={0} className="file-menu-item" onClick={() => { saveProject({ saveAs: false, returnToDashboard: true }); setShowFileMenu(false); }} disabled={isSaving}>
                    <FiDownloadCloud /> Save & Return
                  </button>
                  <div className="file-menu-divider" />
                  <button className="file-menu-item" onClick={() => { setConfirmState({ open: true, title: 'New Project', message: 'Create new blank project? Unsaved changes will be lost.', onConfirm: () => newProject() }); setShowFileMenu(false); }}>
                    <FiPlus /> New Project
                  </button>
                  <button className="file-menu-item" onClick={() => {
                    const thumb = captureThumbnail?.();
                    if (thumb) {
                      const w = window.open("", "_blank");
                      if (w) {
                        w.document.write(`<title>Preview</title><img src="${thumb}" style="max-width:100%;height:auto;display:block;margin:20px auto;background:#111;padding:18px;border-radius:12px" />`);
                        w.document.close();
                      } else pushToast({ type: "error", message: "Popup blocked" });
                    } else pushToast({ type: "error", message: "No preview available" });
                    setShowFileMenu(false);
                  }}>
                    <FiEye /> Preview
                  </button>
                  <div className="file-menu-divider" />
                  <button className="file-menu-item" onClick={() => { navigate("/dashboard"); setShowFileMenu(false); }}>
                    <FiArrowLeft /> Dashboard
                  </button>
                  <button className="file-menu-item file-menu-item--danger" onClick={() => { deleteProject(projectId); setShowFileMenu(false); }} disabled={!projectId}>
                    <FiTrash2 /> Delete Project
                  </button>
                </div>, document.body) : null)}
            </div>

            <div className="toolbar-status">
              <div className="toolbar-status__text">
                {lastSavedAt ? `${new Date(lastSavedAt).toLocaleTimeString()}` : (isDirty ? "Unsaved" : "")}
              </div>
              {(isSaving || saveProgress > 0) && (
                <div
                  role="status"
                  aria-live="polite"
                  className="toolbar-save-progress"
                >
                  <div className="toolbar-save-track">
                    <div className="toolbar-save-fill" style={{
                      width: `${Math.round(saveProgress * 100)}%`,
                    }} />
                  </div>
                  <div className="toolbar-save-percent">
                    {Math.round(saveProgress * 100)}%
                  </div>
                </div>
              )}
            </div>
          </div>

          <Suspense fallback={null}>
            <SculptToolbar workspaceRef={workspaceRef} />
          </Suspense>

          <Workspace
            ref={workspaceRef}
            selected={selected}
            onSelect={handleWorkspaceSelect}
            panelTopOffset={panelTopOffset}
            showInternalPanels={false}
            onSceneChange={(_v) => { setSceneVersion((s) => s + 1); refreshLightListFromScene(); setIsDirty(true); }}
          />

          {/* Physics Toolbar (simulation controls) */}
          {physicsReady && (
            <Suspense fallback={null}>
              <PhysicsToolbar
                physicsReady={physicsReady}
                physicsRunning={physicsRunning}
                gravity={physicsGravity}
                debugVisible={physicsDebugVisible}
                bodies={physicsBodies}
                onPlay={playPhysics}
                onPause={pausePhysics}
                onReset={resetPhysics}
                onGravityChange={setPhysicsGravityPreset}
                onDebugToggle={setPhysicsDebugVisible}
                onBakePhysics={() => {
                  const tracks = bakePhysicsToKeyframes(5, 30);
                  const uuids = Object.keys(tracks);
                  if (uuids.length === 0) { pushToast({ type: 'warn', message: 'No physics bodies to bake.' }); return; }
                  // Convert to animation tracks
                  const animApi = workspaceRef.current?.getAnimationApi?.();
                  if (animApi) {
                    for (const uuid of uuids) {
                      const frames = tracks[uuid];
                      for (const frame of frames) {
                        animApi.addTrack({
                          id: `phys_${uuid}_pos`,
                          objectUuid: uuid,
                          property: 'position',
                          keyframes: frames.map(f => ({
                            time: f.time,
                            value: { x: f.position.x, y: f.position.y, z: f.position.z },
                          })),
                        });
                      }
                    }
                    pushToast({ type: 'success', message: `Baked ${uuids.length} physics tracks to animation.` });
                  }
                }}
              />
            </Suspense>
          )}

          {/* Physics Debug Renderer + Joint Visualizer */}
          {physicsReady && (
            <Suspense fallback={null}>
              <PhysicsDebugRenderer
                scene={workspaceRef.current?.scene}
                physicsManager={physicsManagerRef}
                visible={physicsDebugVisible}
              />
              <JointVisualizer
                scene={workspaceRef.current?.scene}
                getJoints={getPhysicsJoints}
                debugVisible={physicsDebugVisible}
              />
            </Suspense>
          )}

          {/* Yjs Collaboration Presence Panel */}
          {yjsConnected && (
            <Suspense fallback={null}>
              <PresencePanel remoteUsers={remoteUsers} yjsStatus={yjsStatus} />
            </Suspense>
          )}

          {/* Yjs connection status dot (bottom-right) */}
          {projectId && (
            <div style={{
              position: 'absolute', bottom: 12, right: 12, display: 'flex', alignItems: 'center', gap: 6,
              background: 'rgba(0,0,0,0.5)', color: '#eee', fontSize: 10, borderRadius: 12,
              padding: '4px 10px', zIndex: 90, pointerEvents: 'none',
            }}>
              <span style={{
                width: 6, height: 6, borderRadius: '50%', display: 'inline-block',
                background: yjsStatus === 'connected' ? '#4ade80' : yjsStatus === 'connecting' ? '#facc15' : '#ef4444',
              }} />
              {yjsStatus === 'connected' ? 'Synced' : yjsStatus === 'connecting' ? 'Syncing…' : 'Offline'}
              {remoteUsers.length > 0 && ` · ${remoteUsers.length} user${remoteUsers.length > 1 ? 's' : ''}`}
            </div>
          )}

          {/* Welcome card removed — inspector empty state provides same actions */}
          <Timeline workspaceRef={workspaceRef} selected={selected} />

          {/* Floating action button: Fit to view */}
          <button className="floating-fab" title="Fit to view" aria-label="Fit to view" onClick={() => { try { workspaceRef.current?.frameAll?.(); cameraControlsApiRef.current?.resetView?.(); } catch (e) {} }}>
            <FiMove />
          </button>

          {/* render properties panel always; use collapsed class and narrow width when collapsed */}
          <div ref={panelRef} className={`studio-panel properties-panel reveal`} style={{ width: propsWidth }} role="region" aria-label="Inspector">
              <div className="properties-resizer" onMouseDown={(e) => {
                e.preventDefault();
                const startX = e.clientX;
                const startW = propsWidthRef.current ?? propsWidth;
                let lastW = startW;
                const onMove = (ev) => {
                  const newW = Math.max(240, Math.min(460, startW - (ev.clientX - startX)));
                  lastW = newW;
                  setPropsWidth(newW);
                  propsWidthRef.current = newW;
                };
                const onUp = () => {
                  try { localStorage.setItem("objekta_props_width", String(lastW)); } catch (e) {}
                  window.removeEventListener("mousemove", onMove);
                  window.removeEventListener("mouseup", onUp);
                };
                window.addEventListener("mousemove", onMove);
                window.addEventListener("mouseup", onUp);
              }} />
                  <div className="properties-drag-handle" onMouseDown={(e) => {
                draggingRef.current = true;
                const rect = panelRef.current.getBoundingClientRect();
                offsetRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
                e.preventDefault(); e.stopPropagation();
              }}><div /><div /><div /></div>
                  {/* inspector collapse UI removed */}

              <div role="tablist" aria-label="Inspector Tabs" className="inspector-tabs">
                <button role="tab" id="tab-props" aria-selected={propsTab === 'props'} aria-controls="tabpanel-props" onClick={() => setPropsTab('props')} className={propsTab === 'props' ? 'active' : ''}>Transform</button>
                <button role="tab" id="tab-material" aria-selected={propsTab === 'material'} aria-controls="tabpanel-material" onClick={() => setPropsTab('material')} className={propsTab === 'material' ? 'active' : ''}>Material</button>
                <button role="tab" id="tab-lights" aria-selected={propsTab === 'lights'} aria-controls="tabpanel-lights" onClick={() => setPropsTab('lights')} className={propsTab === 'lights' ? 'active' : ''}>Lighting</button>
                <button role="tab" id="tab-outliner" aria-selected={propsTab === 'outliner'} aria-controls="tabpanel-outliner" onClick={() => setPropsTab('outliner')} className={propsTab === 'outliner' ? 'active' : ''}>Outliner</button>
                <button role="tab" id="tab-validate" aria-selected={propsTab === 'validate'} aria-controls="tabpanel-validate" onClick={() => setPropsTab('validate')} className={propsTab === 'validate' ? 'active' : ''}>Validate</button>
                <button role="tab" id="tab-environment" aria-selected={propsTab === 'environment'} aria-controls="tabpanel-environment" onClick={() => setPropsTab('environment')} className={propsTab === 'environment' ? 'active' : ''}>Environment</button>
                <button role="tab" id="tab-backups" aria-selected={propsTab === 'backups'} aria-controls="tabpanel-backups" onClick={() => setPropsTab('backups')} className={propsTab === 'backups' ? 'active' : ''}>Backups</button>

                <button role="tab" id="tab-mesh" aria-selected={propsTab === 'mesh'} aria-controls="tabpanel-mesh" onClick={() => setPropsTab('mesh')} className={propsTab === 'mesh' ? 'active' : ''}>Mesh</button>
                <button role="tab" id="tab-optimize" aria-selected={propsTab === 'optimize'} aria-controls="tabpanel-optimize" onClick={() => setPropsTab('optimize')} className={propsTab === 'optimize' ? 'active' : ''}>Optimize</button>
                <button role="tab" id="tab-procedural" aria-selected={propsTab === 'procedural'} aria-controls="tabpanel-procedural" onClick={() => setPropsTab('procedural')} className={propsTab === 'procedural' ? 'active' : ''}>Procedural</button>
                <button role="tab" id="tab-library" aria-selected={propsTab === 'library'} aria-controls="tabpanel-library" onClick={() => setPropsTab('library')} className={propsTab === 'library' ? 'active' : ''}>Library</button>
                <button role="tab" id="tab-postfx" aria-selected={propsTab === 'postfx'} aria-controls="tabpanel-postfx" onClick={() => setPropsTab('postfx')} className={propsTab === 'postfx' ? 'active' : ''}>PostFX</button>
                {physicsReady && <button role="tab" id="tab-physics" aria-selected={propsTab === 'physics'} aria-controls="tabpanel-physics" onClick={() => setPropsTab('physics')} className={propsTab === 'physics' ? 'active' : ''}>Physics</button>}
              </div>

              <div className="inspector-selection-bar" aria-live="polite">
                <div className="inspector-selection-main">
                  <span className={`selection-dot ${selected ? 'is-active' : ''}`} aria-hidden="true" />
                  <span className="selection-name">{selected ? (selected.name || selected.type || 'Selected Object') : 'No selection'}</span>
                  {selected?.type && <span className="selection-type">{selected.type}</span>}
                </div>
                <div className="inspector-selection-actions">
                  <button
                    className="studio-btn"
                    onClick={() => selected && workspaceRef.current?.frameSelection?.()}
                    disabled={!selected}
                  >
                    Frame
                  </button>
                  <button
                    className="studio-btn"
                    onClick={() => { workspaceRef.current?.clearSelection?.(); setSelected(null); }}
                    disabled={!selected}
                  >
                    Deselect
                  </button>
                  <button
                    className="studio-btn"
                    onClick={requestDeleteSelected}
                    disabled={!selected}
                  >
                    Delete
                  </button>
                </div>
              </div>

              <div className="object-properties inspector-content" id={`tabpanel-${propsTab}`} role="tabpanel" aria-labelledby={`tab-${propsTab}`}>
                {/* Transform (ObjectProperties component) */}
                {propsTab === 'props' && (selected ? (
                  <>
                    <ObjectProperties
                      selected={selected}
                      onTransformChange={(prop, axis, val) => workspaceRef.current?.handleTransformChange?.(prop, axis, val)}
                      onMaterialChange={(patch) => {
                        const normalized = {
                          color: patch?.color || patch?.hex,
                          roughness: patch?.roughness,
                          metalness: patch?.metalness,
                        };
                        applyMaterialToSelection(normalized);
                      }}
                      onApplyTexture={(file, slot) => { applyTextureToSelectionSlot(file, slot || "map"); }}
                      onApplyGLB={(file) => importGLTF(file)}
                      onRemoveTexture={(slot) => { removeTextureFromSelectionSlot(slot || "map"); }}
                      onVisibilityToggle={(vis) => { if (selected) selected.visible = vis; }}
                      onDelete={requestDeleteSelected}
                      onRename={(name) => {
                        if (workspaceRef.current?.renameSelected) workspaceRef.current.renameSelected(name);
                        else selected.name = name;
                      }}
                      onLightChange={(_payload) => { /* optional: forward to lighting system */ }}
                    />
                    {/* Physics properties panel */}
                    {physicsReady && !selected?.isLight && !selected?.isCamera && (
                      <Suspense fallback={null}>
                        <PhysicsPanel
                          selected={selected}
                          physicsReady={physicsReady}
                          physicsRunning={physicsRunning}
                          hasPhysicsBody={hasPhysicsBody}
                          getPhysicsConfig={getPhysicsConfig}
                          addPhysicsBody={addPhysicsBody}
                          removePhysicsBody={removePhysicsBody}
                          updatePhysicsBody={updatePhysicsBody}
                          getJointsForBody={getPhysicsJointsForBody}
                          onCreateRagdoll={(obj) => {
                            let rootBone = null;
                            obj.traverse?.(c => { if (!rootBone && c.isBone) rootBone = c; });
                            if (rootBone) {
                              createPhysicsRagdoll(rootBone);
                              pushToast({ type: 'success', message: 'Ragdoll generated!' });
                            }
                          }}
                        />
                      </Suspense>
                    )}
                    {/* Bloom tagging quick toggle */}
                    {postApiRef.current?.tagForBloom && selected.isObject3D && (
                      <div className="postfx-section">
                        <div className="postfx-title">Post FX</div>
                        <button className="studio-btn" onClick={() => {
                          const enabled = !selected.userData.__bloom;
                          postApiRef.current.tagForBloom(selected, enabled);
                          pushToast({ type: 'info', message: `Bloom tag ${enabled ? 'enabled' : 'disabled'} for '${selected.name || selected.type}'` });
                        }}>
                          {selected.userData.__bloom ? 'Disable Bloom Tag' : 'Enable Bloom Tag'}
                        </button>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="panel-empty-card">
                    <div className="panel-title">No object selected</div>
                    <p className="panel-empty">Select an item in the viewport or outliner to edit transforms and properties.</p>
                    <div className="panel-empty-actions">
                      <button className="studio-btn" onClick={() => setPropsTab('outliner')}>Open Outliner</button>
                      <button className="studio-btn" onClick={() => workspaceRef.current?.addItem?.('Cube')}>Add Cube</button>
                      <button className="studio-btn" onClick={() => setPropsTab('environment')}>Scene Environment</button>
                    </div>
                  </div>
                ))}

                {/* Material */}
                {propsTab === 'material' && (
                  <div>
                    <div className="panel-title">Material Editor</div>
                    <form onSubmit={(e) => { e.preventDefault(); const input = document.getElementById("tex-upload-input"); const file = input?.files?.[0] ?? null; applyMaterialToSelection({ color: matColor, roughness: matRough, metalness: matMetal, mapFile: file }); }}>
                      <div className="mat-field">
                        <label className="mat-label">Color</label>
                        <input aria-label="Material color" type="color" value={matColor} onChange={(e) => setMatColor(e.target.value)} />
                      </div>
                      <div className="mat-field">
                        <label className="mat-label">Roughness: {matRough.toFixed(2)}</label>
                        <input aria-label="Material roughness" type="range" min="0" max="1" step="0.01" value={matRough} onChange={(e) => setMatRough(parseFloat(e.target.value))} className="mat-range" />
                      </div>
                      <div className="mat-field">
                        <label className="mat-label">Metalness: {matMetal.toFixed(2)}</label>
                        <input aria-label="Material metalness" type="range" min="0" max="1" step="0.01" value={matMetal} onChange={(e) => setMatMetal(parseFloat(e.target.value))} className="mat-range" />
                      </div>

                      <div className="mat-field">
                        <label className="mat-label">Texture (optional)</label>
                        <input id="tex-upload-input" aria-label="Upload texture" type="file" accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) setMatMapURL(URL.createObjectURL(f)); }} />
                        {matMapURL && <div className="mat-texture-preview">
                          <img src={matMapURL} alt="preview" className="mat-texture-img" />
                          <div className="mat-texture-info">
                            <div className="mat-texture-status">{matHasMap ? 'Applied texture' : 'New texture (pending)'}</div>
                            <div className="mat-texture-actions">
                              <button type="button" className="studio-btn" onClick={() => {
                                const file = document.getElementById('tex-upload-input')?.files?.[0];
                                applyMaterialToSelection({ color: matColor, roughness: matRough, metalness: matMetal, mapFile: file });
                              }}>Apply texture</button>
                              <button type="button" className="studio-btn" onClick={() => { applyMaterialToSelection({ color: matColor, roughness: matRough, metalness: matMetal, mapFile: null }); }}>Remove</button>
                            </div>
                          </div>
                        </div>}
                      </div>

                      <div className="mat-form-actions">
                        <button type="submit" className="launch-btn">Apply</button>
                        <button type="button" className="studio-btn" onClick={() => { if (selected) { selected.traverse((n) => { if (n.isMesh && n.material) { try { n.material.color.set('#888888'); n.material.roughness = 0.5; n.material.metalness = 0.0; } catch (e) {} } }); pushToast({ type: "info", message: "Reset material" }); } }}>Reset</button>
                      </div>
                    </form>
                  </div>
                )}

                {/* Lighting */}
                {propsTab === 'lights' && (
                  <div>
                    <div className="panel-title">Lighting</div>
                    <div className="light-add-row">
                      <button className="studio-btn" onClick={() => { workspaceRef.current?.addItem?.('Point Light'); pushToast({ type: "info", message: "PointLight added" }); }}>Point</button>
                      <button className="studio-btn" onClick={() => { workspaceRef.current?.addItem?.('Spot Light'); pushToast({ type: "info", message: "SpotLight added" }); }}>Spot</button>
                      <button className="studio-btn" onClick={() => { workspaceRef.current?.addItem?.('Directional Light'); pushToast({ type: "info", message: "DirectionalLight added" }); }}>Dir</button>
                      <button className="studio-btn" onClick={() => { workspaceRef.current?.addItem?.('HemisphereLight'); pushToast({ type: "info", message: "HemisphereLight added" }); }}>Hemi</button>
                    </div>

                    <div>
                      {lights.length === 0 && <div className="panel-empty">No lights in scene</div>}
                      {lights.map(l => (
                        <div key={l.uuid} className="light-item">
                          <div className="light-item__info">
                            <div className="light-item__name">{l.name}</div>
                            <div className="light-item__type">{l.type}</div>
                          </div>
                          <div className="light-item__controls">
                            <input aria-label={`Color for ${l.name}`} type="color" value={l.color} onChange={(e) => {
                              try { const scene = workspaceRef.current?.scene; const light = scene?.getObjectByProperty('uuid', l.uuid); if (light) light.color.set(e.target.value); refreshLightListFromScene(); } catch (e) {}
                            }} />
                            <input aria-label={`Intensity for ${l.name}`} type="range" min="0" max="4" step="0.01" value={l.intensity} onChange={(e) => {
                              try { const scene = workspaceRef.current?.scene; const light = scene?.getObjectByProperty('uuid', l.uuid); if (light) light.intensity = parseFloat(e.target.value); refreshLightListFromScene(); } catch(e) {}
                            }} />
                            <div className="light-item__actions">
                              <button className="studio-btn" onClick={() => {
                                try { const scene = workspaceRef.current?.scene; const light = scene?.getObjectByProperty('uuid', l.uuid); if (light && light.parent) light.parent.remove(light); refreshLightListFromScene(); } catch (e) {}
                              }}>Remove</button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Outliner */}
                {propsTab === 'outliner' && (
                  <div>
                    <div className="panel-title">Scene Outliner</div>
                    <Outliner
                      workspaceRef={workspaceRef}
                      onSelect={handleOutlinerSelect}
                      className="outliner-scroll"
                      outlinerSearch={outlinerSearch}
                      setOutlinerSearch={setOutlinerSearch}
                      onDeleteRequest={requestDeleteObject}
                    />
                  </div>
                )}

                {/* Validate */}
                {propsTab === 'validate' && (
                  <div>
                    <div className="panel-title">Validation</div>
                    <div className="validate-controls">
                      <button className="launch-btn" onClick={() => runValidation()}>Run Validation</button>
                      <button className="studio-btn" onClick={() => setValidationResult(null)}>Clear</button>
                    </div>
                    {!validationResult && <div className="panel-empty">No validation run yet. Click "Run Validation".</div>}
                    {validationResult && (
                      <div className="validate-result">
                        {validationResult.ok ? <div className="text-success">OK</div> : <div className="text-danger">Issues found</div>}
                        <pre className="validate-pre">
{JSON.stringify(validationResult, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                )}

                {/* Environment */}
                {propsTab === 'environment' && (
                  <div>
                    <div className="panel-title">Environment</div>
                    <div className="env-controls">
                      <input aria-label="Environment color" type="color" value={envColor} onChange={(e) => setEnvColor(e.target.value)} />
                      <button className="studio-btn" onClick={() => applyEnvironmentColor(envColor)}>Apply Color</button>
                      <label className="studio-btn env-import-label">
                        <input aria-label="Import environment image" type="file" accept=".hdr,.exr,.jpg,.png" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (f) applyEnvironmentFromFile(f); e.target.value = ''; }} />
                        <span className="env-import-text"><FiImage />Import...</span>
                      </label>
                    </div>
                  </div>
                )}

                {propsTab === 'backups' && (
                  <Suspense fallback={<div className="panel-empty">Loading backups…</div>}>
                    <BackupsPanel
                      onRestore={handleRestoreBackup}
                      onNotify={(type, message) => pushToast({ type, message })}
                    />
                    <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", margin: "12px 0" }} />
                    <VersionTimeline
                      projectId={projectId}
                      onRestore={(project) => {
                        if (project?.data) handleRestoreBackup({ data: project.data, type: "scene-data" });
                      }}
                      onNotify={(type, message) => pushToast({ type, message })}
                    />
                  </Suspense>
                )}



                {propsTab === 'mesh' && (
                  <Suspense fallback={<div className="panel-empty">Loading mesh tools…</div>}>
                    <MeshToolsPanel
                      workspaceRef={workspaceRef}
                      selected={selected}
                      pushToast={pushToast}
                    />
                  </Suspense>
                )}

                {propsTab === 'optimize' && (
                  <Suspense fallback={<div className="panel-empty">Loading optimizer…</div>}>
                    <OptimizationPanel
                      workspaceRef={workspaceRef}
                      selected={selected}
                      pushToast={pushToast}
                    />
                  </Suspense>
                )}

                {propsTab === 'procedural' && (
                  <Suspense fallback={<div className="panel-empty">Loading procedural tools…</div>}>
                    <ProceduralPanel
                      workspaceRef={workspaceRef}
                      pushToast={pushToast}
                    />
                  </Suspense>
                )}

                {propsTab === 'library' && (
                  <Suspense fallback={<div className="panel-empty">Loading material library…</div>}>
                    <MaterialLibraryPanel
                      workspaceRef={workspaceRef}
                      selected={selected}
                      pushToast={pushToast}
                    />
                  </Suspense>
                )}

                {propsTab === 'postfx' && (
                  <Suspense fallback={<div className="panel-empty">Loading post-FX controls…</div>}>
                    <PostFXPanel
                      pushToast={pushToast}
                    />
                  </Suspense>
                )}

                {/* Physics tab */}
                {propsTab === 'physics' && physicsReady && (
                  <div style={{ padding: 12 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#e2e8f0', marginBottom: 12 }}>
                      ⚡ Physics Engine
                    </div>
                    <div style={{ fontSize: 11, color: '#a0aec0', marginBottom: 8 }}>
                      {physicsBodies.length} active {physicsBodies.length === 1 ? 'body' : 'bodies'} · Gravity: {physicsGravity}
                    </div>

                    {/* Joint Editor */}
                    <Suspense fallback={null}>
                      <JointEditor
                        selectedA={selected?.uuid}
                        selectedB={null}
                        onAddJoint={addPhysicsJoint}
                        onRemoveJoint={removePhysicsJoint}
                        getJoints={getPhysicsJoints}
                        physicsRunning={physicsRunning}
                        hasPhysicsBody={hasPhysicsBody}
                      />
                    </Suspense>

                    {/* Physics bodies list */}
                    {physicsBodies.length > 0 && (
                      <div style={{ marginTop: 12, borderTop: '1px solid #2d3748', paddingTop: 8 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: '#a0aec0', marginBottom: 6 }}>
                          Physics Bodies
                        </div>
                        {physicsBodies.map(b => (
                          <div key={b.uuid} style={{
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            padding: '3px 0', fontSize: 11, color: '#a0aec0',
                          }}>
                            <span>{b.uuid.slice(0, 8)}… ({b.type}, {b.colliderType})</span>
                            <button
                              onClick={() => removePhysicsBody(b.uuid)}
                              disabled={physicsRunning}
                              style={{
                                background: '#e53e3e', color: '#fff', border: 'none',
                                borderRadius: 3, padding: '1px 6px', fontSize: 10, cursor: 'pointer',
                              }}
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
        </div>
      </div>
      {/* Floating AI Chat Panel */}
      <Suspense fallback={null}>
        <AIChatPanel workspaceRef={workspaceRef} selected={selected} pushToast={pushToast} />
      </Suspense>
    </DndProvider>
  );
}
