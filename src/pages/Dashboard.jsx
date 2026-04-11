// src/pages/Dashboard.jsx
import React, { useEffect, useState, useCallback, useRef } from "react";
import Sidebar from "../components/Sidebar";
import ProjectGrid from "../components/ProjectGrid";
import Modal from "../components/Modal/Modal";
import Toasts from "../components/Toasts";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { usePageTitle } from "../hooks/usePageTitle";
import "../styles/dashboard.css";
import { API_BASE, apiUrl } from "../utils/api";
import {
  FiPlus, FiSearch, FiGrid, FiList, FiLayout,
  FiClock, FiFolder, FiUploadCloud, FiHardDrive, FiStar,
  FiTrendingUp, FiZap, FiUsers, FiGlobe,
  FiDownload, FiExternalLink, FiCopy, FiEdit3, FiTrash2,
  FiShare2, FiFile, FiCommand, FiChevronRight,
  FiActivity, FiTarget, FiPlay, FiPause, FiRotateCw,
  FiSliders, FiBarChart2, FiX
} from "react-icons/fi";

// Global socket guard
if (typeof window !== 'undefined') {
  window.__OBJEKTA_SOCKET_INITIALIZED = window.__OBJEKTA_SOCKET_INITIALIZED || false;
}

/**
 * Updated Dashboard.jsx
 * - Normalizes fetch/authFetch results so Dashboard always receives { ok, status, data, res }
 * - Merges auth headers automatically
 * - Uses unified API base (matches Studio logic)
 * - Navigates to studio immediately after creating a project
 */

// Removed noisy API_BASE info log; retain value via data attribute for optional inspection
if (typeof document !== 'undefined') {
  try { document.documentElement.dataset.apiBase = API_BASE || ''; } catch (_) {}
}

const DASHBOARD_STARRED_KEY = "objekta_dashboard_starred";
const DEFAULT_FOCUS_SECONDS = 25 * 60;
const FOCUS_PRESETS = [15, 25, 45];

export default function Dashboard() {
  usePageTitle("Dashboard");
  const { user, logout, authFetch } = useAuth() || {};
  const navigate = useNavigate();

  // Keep authFetch stable via ref to avoid doFetch recreating
  const authFetchRef = useRef(null);
  useEffect(() => {
    authFetchRef.current = authFetch;
  }, [authFetch]);

  // Data
  const [projects, setProjects] = useState(null); // null = loading
  const [activity, setActivity] = useState([]);
  const [collabs, setCollabs] = useState([]);
  const [stats, setStats] = useState({ projects: 0, uploads: 0, storageMB: 0 });
  const [projectsError, setProjectsError] = useState(null);

  // Scenes
  const [scenes, setScenes] = useState(null);
  const [scenesLoading, setScenesLoading] = useState(false);

  // UI
  const [selectedProject, setSelectedProject] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [preview, setPreview] = useState(null);

  // Toasts
  const [toasts, setToasts] = useState([]);
  const toastId = useRef(0);
  const toastTimersRef = useRef(new Map());

  // Search & sort
  const [qInput, setQInput] = useState("");
  const [q, setQ] = useState("");
  const searchDebounceRef = useRef(null);
  const [sortBy, setSortBy] = useState("recent"); // recent | name | progress
  const [projectFilter, setProjectFilter] = useState("all"); // all | starred | active

  const [starredIds, setStarredIds] = useState(() => {
    if (typeof window === "undefined") return {};
    try {
      const raw = window.localStorage.getItem(DASHBOARD_STARRED_KEY);
      const parsed = raw ? JSON.parse(raw) : {};
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  });

  const [isCommandOpen, setIsCommandOpen] = useState(false);
  const [commandQuery, setCommandQuery] = useState("");
  const commandInputRef = useRef(null);

  const [focusDuration, setFocusDuration] = useState(DEFAULT_FOCUS_SECONDS);
  const [focusRemaining, setFocusRemaining] = useState(DEFAULT_FOCUS_SECONDS);
  const [focusRunning, setFocusRunning] = useState(false);

  // Socket & presence/progress tracking
  const socketRef = useRef(null);
  const [presenceMap, setPresenceMap] = useState({});
  const [saveProgressMap, setSaveProgressMap] = useState({}); // { projectId: 0..1 }
  const [socketOnline, setSocketOnline] = useState(false);
  const socketErrorRef = useRef({ lastToast: 0, logged: false });
  const socketRetryRef = useRef(0);
  const socketGiveUpRef = useRef(false);

  // Context menu
  const [context, setContext] = useState(null);
  const contextRef = useRef(null);

  // ----- Auth headers helper -----
  const getAuthHeaders = useCallback(() => {
    const token = localStorage.getItem("objekta_token") || localStorage.getItem("token") || null;
    const headers = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;
    return headers;
  }, []);

  // Toast helpers
  const pushToast = useCallback((text, type = "info", ttl = 4200) => {
    const id = ++toastId.current;
    setToasts((t) => [...t, { id, text, type }]);
    const timer = setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), ttl);
    toastTimersRef.current.set(id, timer);
  }, []);
  const dismissToast = useCallback((id) => {
    try {
      setToasts((t) => t.filter((x) => x.id !== id));
      const timer = toastTimersRef.current.get(id);
      if (timer) clearTimeout(timer);
      toastTimersRef.current.delete(id);
    } catch (e) {
      console.warn('dismissToast error', e);
    }
  }, []);
  useEffect(() => {
    const toastTimers = toastTimersRef.current;
    return () => {
      toastTimers.forEach((t) => clearTimeout(t));
      toastTimers.clear();
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(DASHBOARD_STARRED_KEY, JSON.stringify(starredIds || {}));
    } catch {
      // Ignore storage quota/access issues
    }
  }, [starredIds]);

  useEffect(() => {
    if (!focusRunning) return;
    const interval = window.setInterval(() => {
      setFocusRemaining((prev) => {
        if (prev <= 1) {
          window.clearInterval(interval);
          setFocusRunning(false);
          pushToast("Focus session completed. Great momentum.", "success", 4600);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(interval);
  }, [focusRunning, pushToast]);

  const closeCommandPalette = useCallback(() => {
    setIsCommandOpen(false);
    setCommandQuery("");
  }, []);

  const openCommandPalette = useCallback(() => {
    setIsCommandOpen(true);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onCommandHotkey = (ev) => {
      const pressedK = (ev.key || "").toLowerCase() === "k";
      if ((ev.metaKey || ev.ctrlKey) && pressedK) {
        ev.preventDefault();
        setIsCommandOpen(true);
        return;
      }
      if (ev.key === "Escape" && isCommandOpen) {
        ev.preventDefault();
        closeCommandPalette();
      }
    };

    window.addEventListener("keydown", onCommandHotkey);
    return () => window.removeEventListener("keydown", onCommandHotkey);
  }, [isCommandOpen, closeCommandPalette]);

  useEffect(() => {
    if (!isCommandOpen) return;
    const timer = setTimeout(() => {
      commandInputRef.current?.focus?.();
    }, 0);
    return () => clearTimeout(timer);
  }, [isCommandOpen]);

  const forcedLogoutRef = useRef(false);
  useEffect(() => { forcedLogoutRef.current = false; }, [user]);

  const handleUnauthorized = useCallback((reason = "Session expired. Please sign in again.") => {
    if (forcedLogoutRef.current) return;
    forcedLogoutRef.current = true;
    pushToast(reason, "error", 5200);
    logout?.();
    navigate("/login");
  }, [logout, navigate, pushToast]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onExpired = () => handleUnauthorized();
    window.addEventListener("objekta:session-expired", onExpired);
    return () => window.removeEventListener("objekta:session-expired", onExpired);
  }, [handleUnauthorized]);

  // ----- Normalized fetch wrapper -----
  // Always returns an object: { ok, status, data, res, error? }
  const doFetch = useCallback(
    async (path, opts = {}) => {
      try {
        const url = path && typeof path === "string" && path.startsWith("http") ? path : apiUrl(path);

        // Prefer authFetch if present on the ref
        const af = authFetchRef.current;
        if (af) {
          try {
            const result = await af(url, opts);

            if (result && result.aborted) {
              return result;
            }
            const status = result?.status ?? result?.res?.status ?? null;
            if (status === 401) handleUnauthorized();

            // case: authFetch returns our normalized wrapper { res, data }
            if (result && result.res) {
              const { res, data } = result;
              return { ok: !!res.ok, status: res.status, data, res };
            }

            // case: authFetch returns a native Response
            if (result instanceof Response) {
              const cloned = result.clone();
              const text = await cloned.text();
              let data = null;
              try { data = text ? JSON.parse(text) : null; } catch { data = text || null; }
              return { ok: !!result.ok, status: result.status, data, res: result };
            }

            // case: authFetch returns normalized-like object
            if (result && typeof result === "object" && ("ok" in result || "status" in result || "data" in result)) {
              return result;
            }

            // fallback to native fetch if authFetch returned unexpected value
          } catch (e) {
            console.warn("[OBJEKTA] authFetch threw, falling back to fetch", e);
          }
        }

        // fallback: native fetch + merge auth headers
        const mergedHeaders = { ...(opts.headers || {}), ...getAuthHeaders() };
        const fetchOpts = { credentials: "include", ...opts, headers: mergedHeaders };

        const res = await fetch(url, fetchOpts);
        if (res.status === 401) handleUnauthorized();
        const text = await res.text();
        let data = null;
        try { data = text ? JSON.parse(text) : null; } catch { data = text || null; }

        if (!res.ok) {
          // attach more logging for debugging (status + url + possible validation errors)
          console.warn("[OBJEKTA] fetch failed", { url, status: res.status, body: data });
        }

        return { ok: !!res.ok, status: res.status, data, res };
      } catch (err) {
        if (err?.name === 'AbortError') {
          console.debug('[OBJEKTA] doFetch aborted (ignored)', path);
          return { ok: false, status: 0, data: null, aborted: true };
        }
        console.warn('[OBJEKTA] doFetch network error', err);
        return { ok: false, status: 0, data: null, error: err };
      }
    },
    [getAuthHeaders, handleUnauthorized]
  );

  // normalize project shape across backends
  const normalizeProject = useCallback((p) => {
    if (!p) return null;
    const _id = p._id || p.id || (p._doc && p._doc._id) || null;
    const title = (p.title || p.name || (p.data && p.data.name) || "Untitled").toString();

    let thumbnail = p.thumbnailUrl || p.thumbnail || null;
    if (thumbnail && typeof thumbnail === "object") {
      thumbnail = thumbnail.path || thumbnail.url || thumbnail.thumbnailUrl || null;
    }

    if (thumbnail && !/^https?:\/\//i.test(String(thumbnail))) {
      const base = String(API_BASE || window.location.origin).replace(/\/+$/, '');
      const path = String(thumbnail).replace(/^\/+/, '');
      thumbnail = `${base}/${path}`;
    }

    // If thumbnail still seems wrong, log for debugging
    if (thumbnail && !/^https?:\/\//i.test(String(thumbnail))) {
      console.warn("[OBJEKTA] normalizeProject - thumbnail is not absolute", thumbnail, p);
    }

    const createdAt = p.createdAt || p.created_at || p.created || (p._doc && p._doc.createdAt) || null;
    const updatedAt = p.lastSavedAt || p.updatedAt || p.updated_at || p.updated || p.lastSaved || null;
    const progress = (typeof p.progress === "number" && p.progress) || (p.data && typeof p.data.progress === "number" && p.data.progress) || 0;
    const collaborators = p.collaborators || p.collabs || p.members || [];
    return { _id, title, thumbnailUrl: thumbnail, createdAt, updatedAt, progress, collaborators, raw: p };
  }, []);

  const safeDate = (str) => {
    try {
      if (!str) return "";
      const d = new Date(str);
      if (isNaN(d.getTime())) return String(str);
      return d.toLocaleDateString();
    } catch {
      return "";
    }
  };

  // Fetch dashboard (projects + activity + collabs)
  const fetchDashboard = useCallback(
    async (abortController) => {
      setProjectsError(null);
      setProjects(null);
      setActivity([]);
      setCollabs([]);
      const signal = abortController?.signal;

      // Projects
      try {
        const res = await doFetch("/api/projects", { signal });
        if (res?.aborted) return;
        if (!res.ok) throw new Error(`projects fetch ${res.status}`);
        const data = res.data;
        let list = [];
        // Accept either a raw array or { success, projects } envelope
        if (Array.isArray(data)) list = data;
        else if (data && data.success && Array.isArray(data.projects)) list = data.projects;
        else if (Array.isArray(data?.projects)) list = data.projects;
        else if (Array.isArray(data?.items)) list = data.items;
        else if (data && typeof data === "object") {
          list = Object.values(data).filter((v) => v && (v._id || v.id));
        } else {
          list = [];
        }

        console.log("[OBJEKTA] fetched projects:", list.length, list);

        const normalized = list.map(normalizeProject).filter(Boolean);
        setProjects(normalized);
        setStats((s) => ({ ...s, projects: normalized.length }));
      } catch (err) {
        if (err?.aborted) return;
        const reason = err?.message || "Failed to load projects";
        console.warn("projects fetch failed", reason);
        setProjects([]);
        setStats((s) => ({ ...s, projects: 0 }));
        const friendly = /401|403/.test(String(err?.status || ""))
          ? "Session expired. Please sign back in."
          : `${reason}. Check that the backend is running at ${API_BASE}.`;
        setProjectsError(friendly);
        pushToast(`Projects load failed: ${reason}`, "error", 5200);
      }

      // activity
      try {
        const resA = await doFetch("/api/activity", { signal });
        if (resA?.aborted) return;
        if (!resA.ok) throw new Error("activity missing");
        const aData = resA.data;
        setActivity(Array.isArray(aData) ? aData : []);
      } catch {
        setActivity([
          { id: 1, text: "Created project Cyber Gipsy", when: "2 days ago" },
          { id: 2, text: "Uploaded texture set", when: "4 days ago" },
          { id: 3, text: "Shared project with Ana", when: "8 days ago" },
        ]);
      }

      // collaborators
      try {
        const resC = await doFetch("/api/collaborators", { signal });
        if (resC?.aborted) return;
        if (!resC.ok) throw new Error("collab missing");
        const cData = resC.data;
        setCollabs(Array.isArray(cData) ? cData : []);
      } catch {
        setCollabs([{ id: "u1", name: "Ana", role: "Designer" }, { id: "u2", name: "Dev", role: "Artist" }]);
      }
    },
    [doFetch, normalizeProject, pushToast]
  );

  useEffect(() => {
    if (!user) return;
    const ac = new AbortController();
    (async () => {
      try {
        await fetchDashboard(ac);
      } catch (e) {
        // swallow, fetchDashboard logs its own errors
      }
    })();
    return () => ac.abort();
  }, [user, fetchDashboard]);

  const handleRetryProjects = useCallback(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  // Scenes
  const fetchScenes = useCallback(async (signal) => {
    if (!user) return;
    setScenesLoading(true);
    try {
      const res = await doFetch("/api/scenes", { signal });
      if (res?.aborted) return;
      if (!res.ok) throw new Error("scenes fetch failed");
      const data = res.data;
      setScenes(Array.isArray(data) ? data : []);
    } catch (err) {
      if (err?.name === "AbortError" || signal?.aborted) return;
      console.warn("fetchScenes failed", err);
      setScenes([]);
    } finally {
      if (!signal?.aborted) setScenesLoading(false);
    }
  }, [doFetch, user]);

  useEffect(() => {
    if (!user) {
      setScenes([]);
      setScenesLoading(false);
      return;
    }
    const ac = new AbortController();
    (async () => {
      try {
        await fetchScenes(ac.signal);
      } catch (e) {}
    })();
    return () => ac.abort();
  }, [user, fetchScenes]);

  // Socket init & handlers (dynamic import)
  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        // Guard: prevent duplicate socket init
        if (window.__OBJEKTA_DASHBOARD_SOCKET_INITIALIZED) {
          if (!window.__OBJEKTA_SOCKET_LOGGED_ONCE) {
            window.__OBJEKTA_SOCKET_LOGGED_ONCE = true;
            console.info("[OBJEKTA] Dashboard socket already initialized");
          }
          return;
        }

        const module = await import("socket.io-client").catch(() => null);
        const io = module?.io || module?.default || module;
        if (!io) {
          pushToast("Realtime disabled (socket.io client missing)", "warn");
          return;
        }

        window.__OBJEKTA_DASHBOARD_SOCKET_INITIALIZED = true;
        socketRetryRef.current = 0;
        socketGiveUpRef.current = false;
        setSocketOnline(false);

        const socketToken =
          localStorage.getItem("objekta_token") || localStorage.getItem("token") || null;

        const s = io(API_BASE || window.location.origin, {
          withCredentials: true,
          transports: ["websocket", "polling"],
          timeout: 5000,
          reconnectionAttempts: 3,
          reconnectionDelay: 2500,
          reconnectionDelayMax: 6000,
          forceNew: true,
          auth: socketToken ? { token: socketToken } : undefined,
        });
        socketRef.current = s;

        s.on("connect", () => {
          setSocketOnline(true);
          try {
            s.emit("join-dashboard");
          } catch (e) {}
        });

        s.on("disconnect", () => {
          setSocketOnline(false);
        });

        s.on("project_created", (proj) => {
          if (!mounted) return;
          const n = normalizeProject(proj);
          setProjects((p) => (Array.isArray(p) ? [n, ...p] : [n]));
          setStats((st) => ({ ...st, projects: (st.projects || 0) + 1 }));
          pushToast(`Project created: ${n.title}`, "success");
        });

        s.on("project_updated", (proj) => {
          if (!mounted) return;
          const n = normalizeProject(proj);
          setProjects((p) => (Array.isArray(p) ? p.map((x) => (x._id === n._id ? n : x)) : [n]));
          pushToast(`Updated: ${n.title}`, "info");
          setSaveProgressMap((m) => {
            const copy = { ...(m || {}) };
            delete copy[n._id];
            return copy;
          });
        });

        s.on("project_deleted", (id) => {
          if (!mounted) return;
          setProjects((p) => (Array.isArray(p) ? p.filter((x) => x._id !== id) : []));
          setStats((st) => ({ ...st, projects: Math.max(0, (st.projects || 1) - 1) }));
          pushToast("Project deleted", "warn");
        });

        s.on("project_save_progress", ({ projectId, progress }) => {
          if (!projectId) return;
          setSaveProgressMap((m) => ({ ...(m || {}), [projectId]: Math.max(0, Math.min(1, progress || 0)) }));
        });

        s.on("project_thumbnail_updated", ({ projectId, thumbnailUrl }) => {
          if (!projectId) return;
          setProjects((prev) => {
            if (!Array.isArray(prev)) return prev;
            return prev.map((p) => (p._id === projectId ? { ...p, thumbnailUrl: thumbnailUrl } : p));
          });
        });

        // NEW: reflect asset additions in real time
        s.on("project_asset_added", ({ projectId, asset }) => {
          if (!projectId || !asset) return;
          setProjects((prev) => {
            if (!Array.isArray(prev)) return prev;
            return prev.map((p) => {
              if (p._id !== projectId) return p;
              const raw = p.raw || {};
              const assets = Array.isArray(raw.assets) ? [...raw.assets, asset] : [asset];
              return { ...p, raw: { ...raw, assets } };
            });
          });
          pushToast(`Asset added${asset.source ? ` (${asset.source})` : ""}`, asset.source === 's3' ? 'success' : asset.source === 'tus' ? 'warn' : 'info');
        });

        s.on("presence_update", ({ projectId, users }) => {
          setPresenceMap((m) => ({ ...m, [projectId]: users }));
        });

        s.on("connect_error", (err) => {
          setSocketOnline(false);
          if ((err?.message || "").toLowerCase().includes("unauthorized")) {
            handleUnauthorized();
            return;
          }
          const now = Date.now();
          socketRetryRef.current += 1;
          console.warn("Socket connect_error:", err?.message || err);
          if (now - (socketErrorRef.current.lastToast || 0) > 60000) {
            pushToast("Realtime connection error", "warn");
            socketErrorRef.current.lastToast = now;
          }
          if (!socketErrorRef.current.logged && err) {
            socketErrorRef.current.logged = true;
            console.error("[Dashboard] socket connect_error details", err);
          }
          if (!socketGiveUpRef.current && socketRetryRef.current >= 3) {
            socketGiveUpRef.current = true;
            pushToast("Realtime disabled (server unreachable)", "warn");
            try { s.io.opts.reconnection = false; } catch (e) {}
            try { s.disconnect(); } catch (e) {}
          }
        });

        s.on("reconnect_failed", () => {
          setSocketOnline(false);
          if (socketGiveUpRef.current) return;
          socketGiveUpRef.current = true;
          pushToast("Realtime disabled (server unreachable)", "warn");
          try { s.disconnect(); } catch (e) {}
        });
      } catch (err) {
        setSocketOnline(false);
        console.warn("socket init failed", err);
        pushToast("Realtime disabled", "warn");
      }
    })();

    return () => {
      try {
        socketRef.current?.disconnect();
      } catch (e) {}
      socketRef.current = null;
      setSocketOnline(false);
      if (typeof window !== "undefined") {
        window.__OBJEKTA_DASHBOARD_SOCKET_INITIALIZED = false;
      }
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [API_BASE, user, normalizeProject, pushToast]);

  // Create project (optimistic)
  const createProject = async () => {
    const temporary = {
      _id: `tmp-${Date.now()}`,
      title: `Untitled Project ${projects ? projects.length + 1 : 1}`,
      thumbnailUrl: null,
      progress: 0,
      createdAt: Date.now(),
      collaborators: [],
      raw: {},
    };
    setProjects((p) => (Array.isArray(p) ? [temporary, ...p] : [temporary]));
    setStats((s) => ({ ...s, projects: (s.projects || 0) + 1 }));
    try {
      const payload = { title: temporary.title, name: temporary.title, data: {} };
      const res = await doFetch("/api/projects", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (res.ok) {
        const savedRaw = res.data;
        const saved = normalizeProject(savedRaw);
        setProjects((p) => p.map((x) => (x._id === temporary._id ? saved : x)));
        pushToast("Project created", "success");
        // navigate to studio directly so user can continue immediately
        if (saved && saved._id) {
          navigate("/studio", { state: { projectId: saved._id } });
        } else {
          // fallback: open modal if we don't have server id
          setTimeout(() => openProjectModal(saved), 30);
        }
        socketRef.current?.emit?.("client_project_created", savedRaw);
      } else {
        throw new Error("server create failed");
      }
    } catch (err) {
      console.warn("create project error", err?.message || err);
      pushToast("Created locally — server unreachable", "warn");
    }
  };

  // Helpers: open modal + presence
  const openProjectModal = (proj) => {
    setSelectedProject(proj);
    setRenameValue(proj?.title || "");
    setIsModalOpen(true);
    if (socketRef.current && proj?._id) socketRef.current.emit("join-project", proj._id);
  };
  const closeModal = () => {
    if (selectedProject && socketRef.current) socketRef.current.emit("leave-project", selectedProject._id);
    setIsModalOpen(false);
    setSelectedProject(null);
    setModalLoading(false);
    setRenameValue("");
  };

  // rename
  const saveRename = async () => {
    if (!selectedProject) return;
    setModalLoading(true);
    setProjects((p) => p.map((x) => (x._id === selectedProject._id ? { ...x, title: renameValue } : x)));
    try {
      const res = await doFetch(`/api/projects/${encodeURIComponent(selectedProject._id)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: renameValue, name: renameValue }),
      });
      if (res.ok) {
        const updatedRaw = res.data;
        const updated = normalizeProject(updatedRaw);
        setProjects((p) => p.map((x) => (x._id === updated._id ? updated : x)));
        pushToast("Project renamed", "success");
      } else {
        throw new Error("rename failed");
      }
    } catch (err) {
      console.warn("rename error", err?.message || err);
      pushToast("Rename failed", "error");
    } finally {
      setModalLoading(false);
      closeModal();
    }
  };

  // delete
  const deleteProject = async (project = null) => {
    const target = project || selectedProject;
    if (!target) return;
    const id = target._id;
    setProjects((p) => p.filter((x) => x._id !== id));
    // keep the stats counter in sync with local deletion
    setStats((s) => ({ ...s, projects: Math.max(0, (s?.projects || 1) - 1) }));
    try {
      const res = await doFetch(`/api/projects/${encodeURIComponent(id)}`, { method: "DELETE" });
      if (res.ok) pushToast("Project deleted", "warn");
      else throw new Error("delete failed");
    } catch (err) {
      console.warn("delete error", err?.message || err);
      pushToast("Local delete — server unreachable", "warn");
    } finally {
      closeModal();
    }
  };

  // duplicate
  const duplicateProject = async (p) => {
    if (!p) return;
    try {
      const clone = { title: `${p.title} (copy)`, name: `${p.title} (copy)`, data: p.raw?.data || {} };
      const res = await doFetch("/api/projects", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(clone) });
      if (res.ok) {
        const savedRaw = res.data;
        const saved = normalizeProject(savedRaw);
        setProjects((prev) => (Array.isArray(prev) ? [saved, ...prev] : [saved]));
        pushToast("Project duplicated", "success");
      } else {
        throw new Error("dup failed");
      }
    } catch (err) {
      console.warn("duplicate error", err?.message || err);
      pushToast("Duplicate failed", "error");
    }
  };

  // navigate to studio
  const navToStudio = (project = null) => {
    if (project && project._id) navigate(`/studio`, { state: { projectId: project._id } });
    else navigate("/studio");
  };

  // Load scene in studio (scene id)
  const loadSceneInStudio = (sceneId) => {
    navigate("/studio", { state: { sceneId } });
  };

  const exportProjectSnapshot = useCallback((project) => {
    if (!project) {
      pushToast("No project selected for export.", "warn");
      return;
    }
    try {
      const payload = {
        _id: project._id,
        title: project.title,
        progress: project.progress ?? 0,
        createdAt: project.createdAt || null,
        updatedAt: project.updatedAt || null,
        data: project.raw?.data || {},
        metadata: {
          collaborators: Array.isArray(project.collaborators) ? project.collaborators : [],
          exportedAt: new Date().toISOString(),
        },
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${(project.title || "project").replace(/[^a-z0-9_-]+/gi, "_")}_snapshot.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1500);
      pushToast(`Exported ${project.title}`, "success");
    } catch (err) {
      console.warn("export project error", err);
      pushToast("Export failed", "error");
    }
  }, [pushToast]);

  const handleImport = useCallback(() => {
    pushToast("Import ready in Studio. Opening Studio…", "info", 2800);
    navigate("/studio", { state: { startImport: true } });
  }, [navigate, pushToast]);

  const handleMarketplace = useCallback(() => {
    navigate("/gallery");
  }, [navigate]);

  const handleExportAction = useCallback(() => {
    const target = selectedProject || preview || (Array.isArray(projects) ? projects[0] : null);
    if (!target) {
      pushToast("Create or open a project before exporting.", "warn");
      return;
    }
    exportProjectSnapshot(target);
  }, [selectedProject, preview, projects, exportProjectSnapshot, pushToast]);

  // Search debounce
  useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => setQ(qInput), 220);
    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, [qInput]);

  const toggleProjectStar = useCallback((projectId) => {
    if (!projectId) return;
    setStarredIds((prev) => {
      const next = { ...(prev || {}) };
      if (next[projectId]) delete next[projectId];
      else next[projectId] = true;
      return next;
    });
  }, []);

  // Filtered projects
  const filteredProjects = React.useMemo(() => {
    if (!Array.isArray(projects)) return [];
    const qLower = q.trim().toLowerCase();
    let list = projects.filter((p) => {
      const matchesSearch = !qLower || (p.title || "").toLowerCase().includes(qLower);
      if (!matchesSearch) return false;

      if (projectFilter === "starred") {
        return !!starredIds?.[p._id];
      }
      if (projectFilter === "active") {
        return Number(p.progress || 0) < 100;
      }
      return true;
    });
    if (sortBy === "recent") {
      list = [...list].sort(
        (a, b) =>
          new Date(b.updatedAt || b.createdAt || 0).getTime() - new Date(a.updatedAt || a.createdAt || 0).getTime()
      );
    } else if (sortBy === "name") {
      list = [...list].sort((a, b) => (a.title || "").localeCompare(b.title || ""));
    } else if (sortBy === "progress") {
      list = [...list].sort((a, b) => (b.progress || 0) - (a.progress || 0));
    }
    return list;
  }, [projects, q, sortBy, projectFilter, starredIds]);

  const applyFocusPreset = useCallback((minutes) => {
    const seconds = Math.max(1, Number(minutes || 0)) * 60;
    setFocusDuration(seconds);
    setFocusRemaining(seconds);
    setFocusRunning(false);
  }, []);

  const resetFocusSession = useCallback(() => {
    setFocusRemaining(focusDuration);
    setFocusRunning(false);
  }, [focusDuration]);

  const formatClock = useCallback((secondsInput) => {
    const total = Math.max(0, Number(secondsInput || 0));
    const mins = Math.floor(total / 60);
    const secs = total % 60;
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }, []);

  const focusProgress = React.useMemo(() => {
    if (!focusDuration) return 0;
    const completed = focusDuration - focusRemaining;
    return Math.max(0, Math.min(100, Math.round((completed / focusDuration) * 100)));
  }, [focusDuration, focusRemaining]);

  const starredCount = React.useMemo(() => {
    if (!Array.isArray(projects)) return 0;
    return projects.reduce((count, p) => count + (starredIds?.[p._id] ? 1 : 0), 0);
  }, [projects, starredIds]);

  const activeProjectCount = React.useMemo(() => {
    if (!Array.isArray(projects)) return 0;
    return projects.filter((p) => Number(p.progress || 0) < 100).length;
  }, [projects]);

  const averageProgress = React.useMemo(() => {
    if (!Array.isArray(projects) || projects.length === 0) return 0;
    const sum = projects.reduce((acc, p) => acc + Number(p.progress || 0), 0);
    return Math.round(sum / projects.length);
  }, [projects]);

  const liveCollaboratorCount = React.useMemo(() => {
    const groups = Object.values(presenceMap || {});
    return groups.reduce((sum, users) => sum + (Array.isArray(users) ? users.length : 0), 0);
  }, [presenceMap]);

  const momentumScore = React.useMemo(() => {
    const value = averageProgress * 0.55 + activeProjectCount * 6 + liveCollaboratorCount * 4;
    return Math.max(0, Math.min(100, Math.round(value)));
  }, [averageProgress, activeProjectCount, liveCollaboratorCount]);

  const spotlightProjects = React.useMemo(() => {
    if (!Array.isArray(projects)) return [];
    return [...projects]
      .sort((a, b) => {
        const scoreA = Number(a.progress || 0) + (starredIds?.[a._id] ? 18 : 0);
        const scoreB = Number(b.progress || 0) + (starredIds?.[b._id] ? 18 : 0);
        return scoreB - scoreA;
      })
      .slice(0, 4);
  }, [projects, starredIds]);

  // Context menu handlers
  useEffect(() => {
    const onDocClick = (ev) => {
      if (contextRef.current && !contextRef.current.contains(ev.target)) setContext(null);
    };
    const onWindowScroll = () => setContext(null);
    const onWindowResize = () => setContext(null);
    const onEscape = (ev) => {
      if (ev.key === "Escape") setContext(null);
    };
    const onDocContextMenu = (ev) => {
      if (contextRef.current && !contextRef.current.contains(ev.target)) {
        setContext(null);
      }
    };

    window.addEventListener("click", onDocClick);
    window.addEventListener("scroll", onWindowScroll, true);
    window.addEventListener("resize", onWindowResize);
    window.addEventListener("keydown", onEscape);
    window.addEventListener("contextmenu", onDocContextMenu);
    return () => {
      window.removeEventListener("click", onDocClick);
      window.removeEventListener("scroll", onWindowScroll, true);
      window.removeEventListener("resize", onWindowResize);
      window.removeEventListener("keydown", onEscape);
      window.removeEventListener("contextmenu", onDocContextMenu);
    };
  }, []);

  const openContext = (e, p) => {
    e.preventDefault();
    const menuWidth = 220;
    const menuHeight = 280;
    const margin = 10;
    const maxX = Math.max(margin, window.innerWidth - menuWidth - margin);
    const maxY = Math.max(margin, window.innerHeight - menuHeight - margin);
    const x = Math.max(margin, Math.min(e.clientX, maxX));
    const y = Math.max(margin, Math.min(e.clientY, maxY));
    setContext({ project: p, x, y });
  };

  const handleContextAction = (action, p) => {
    setContext(null);
    switch (action) {
      case "open":
        return navToStudio(p);
      case "rename":
        return openProjectModal(p);
      case "duplicate":
        return duplicateProject(p);
      case "star":
        toggleProjectStar(p?._id);
        return pushToast(starredIds?.[p?._id] ? "Removed from starred" : "Added to starred", "info");
      case "delete":
        return openProjectModal(p);
      case "share":
        navigator.clipboard?.writeText(`${window.location.origin}/studio?project=${encodeURIComponent(p._id)}`);
        return pushToast("Share link copied", "info");
      case "export":
        return exportProjectSnapshot(p);
      default:
        return;
    }
  };

  // Preview modal
  const openPreview = (project) => {
    setPreview(project);
  };
  const closePreview = () => setPreview(null);

  // Render only accepts a thumbnailUrl string (absolute or relative)
  const renderThumbSrc = (thumbnailUrl) => {
    if (!thumbnailUrl) return null;
    try {
      const s = String(thumbnailUrl);
      if (/^https?:\/\//i.test(s)) return s;
      const base = String(API_BASE || window.location.origin).replace(/\/+$/, "");
      return base + (s.startsWith("/") ? s : "/" + s);
    } catch (e) {
      return null;
    }
  };

  // Unified image error fallback - prevent infinite loops
  function handleThumbError(e) {
    try {
      const img = e?.target;
      if (!img) return;
      img.onerror = null; // Prevent infinite loop
      console.warn("[OBJEKTA] Thumbnail failed:", img.dataset?.src || img.src);
      img.src = "/placeholder-thumb.svg";
    } catch (err) {
      console.warn("[OBJEKTA] Thumbnail fallback error:", err);
    }
  }

  // View mode
  const [viewMode, setViewMode] = useState("grid"); // grid | list

  // Time-ago helper
  const timeAgo = useCallback((dateStr) => {
    if (!dateStr) return "";
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return "";
      const diff = Date.now() - d.getTime();
      const mins = Math.floor(diff / 60000);
      if (mins < 1) return "Just now";
      if (mins < 60) return `${mins}m ago`;
      const hrs = Math.floor(mins / 60);
      if (hrs < 24) return `${hrs}h ago`;
      const days = Math.floor(hrs / 24);
      if (days < 7) return `${days}d ago`;
      if (days < 30) return `${Math.floor(days / 7)}w ago`;
      return d.toLocaleDateString();
    } catch { return ""; }
  }, []);

  // Greeting
  const greeting = React.useMemo(() => {
    const hr = new Date().getHours();
    if (hr < 12) return "Good morning";
    if (hr < 17) return "Good afternoon";
    return "Good evening";
  }, []);

  const realtimeStateLabel = socketOnline ? "Live sync online" : "Realtime standby";

  const commandActions = (() => {
    const systemActions = [
      {
        id: "new-project",
        icon: FiPlus,
        label: "Create new project",
        description: "Start a blank scene in one click",
        hint: "New",
        keywords: "new create project",
        run: () => createProject(),
      },
      {
        id: "open-studio",
        icon: FiLayout,
        label: "Open Studio",
        description: "Jump into the editor workspace",
        hint: "Studio",
        keywords: "studio open editor",
        run: () => navToStudio(),
      },
      {
        id: "import",
        icon: FiDownload,
        label: "Import in Studio",
        description: "Open Studio in import mode",
        hint: "Import",
        keywords: "import upload",
        run: () => handleImport(),
      },
      {
        id: "marketplace",
        icon: FiGlobe,
        label: "Browse marketplace",
        description: "Find new assets and materials",
        hint: "Gallery",
        keywords: "marketplace gallery assets",
        run: () => handleMarketplace(),
      },
      {
        id: "export",
        icon: FiExternalLink,
        label: "Export snapshot",
        description: "Export the most recent project snapshot",
        hint: "Export",
        keywords: "export snapshot download",
        run: () => handleExportAction(),
      },
      {
        id: "focus-25",
        icon: FiTarget,
        label: "Start 25 minute focus",
        description: "Set and start a deep work timer",
        hint: "25m",
        keywords: "focus pomodoro timer",
        run: () => {
          applyFocusPreset(25);
          setFocusRunning(true);
        },
      },
    ];

    const projectActions = Array.isArray(projects)
      ? projects.slice(0, 8).map((project, index) => ({
          id: `project-${project._id || index}`,
          icon: FiFolder,
          label: `Open ${project.title || "Untitled"}`,
          description: "Open this project directly in Studio",
          hint: timeAgo(project.updatedAt || project.createdAt) || "Recent",
          keywords: `${project.title || ""} project open studio`,
          run: () => navToStudio(project),
        }))
      : [];

    return [...systemActions, ...projectActions];
  })();

  const filteredCommandActions = React.useMemo(() => {
    const needle = commandQuery.trim().toLowerCase();
    if (!needle) return commandActions;
    return commandActions.filter((cmd) => {
      const haystack = `${cmd.label} ${cmd.description} ${cmd.keywords}`.toLowerCase();
      return haystack.includes(needle);
    });
  }, [commandActions, commandQuery]);

  const runCommandAction = useCallback((cmd) => {
    if (!cmd || typeof cmd.run !== "function") return;
    closeCommandPalette();
    cmd.run();
  }, [closeCommandPalette]);

  const handleCommandInputKeyDown = useCallback((ev) => {
    if (ev.key === "Enter") {
      ev.preventDefault();
      runCommandAction(filteredCommandActions[0]);
    }
  }, [filteredCommandActions, runCommandAction]);

  // Render UI
  return (
    <div className="dashboard-root">
      <div className="dash-layout">
        {/* ── Premium Sidebar ──────────────────────────────── */}
        <Sidebar
          user={user}
          stats={stats}
          onCreate={createProject}
          onOpenStudio={() => navToStudio()}
          onLogout={() => {
            try { logout(); } catch {}
            navigate('/');
          }}
          onImport={handleImport}
          onMarketplace={handleMarketplace}
          onNavigateHome={() => navigate('/')}
        />

        {/* ── Main Content ─────────────────────────────────── */}
        <main className="dash-main">

          {/* ── Welcome Banner ───────────────────────────── */}
          <section className="dash-welcome">
            <div className="welcome-content">
              <div className="welcome-text">
                <h1 className="welcome-title">
                  {greeting}, <span className="welcome-name">{user?.name?.split(' ')[0] || 'Creator'}</span>
                </h1>
                <p className="welcome-sub">
                  Your creative workspace is ready. You have <strong>{filteredProjects.length}</strong> project{filteredProjects.length !== 1 ? 's' : ''} in progress.
                </p>
                <div className="welcome-meta">
                  <span className={`welcome-chip ${socketOnline ? 'welcome-chip--live' : ''}`}>
                    <span className="welcome-chip-dot" /> {realtimeStateLabel}
                  </span>
                  <span className="welcome-chip">{starredCount} starred</span>
                  <span className="welcome-chip">{averageProgress}% average completion</span>
                </div>
              </div>
              <div className="welcome-search">
                <div className="search-box">
                  <FiSearch className="search-icon" />
                  <input
                    type="text"
                    placeholder="Search projects, scenes..."
                    value={qInput}
                    onChange={(e) => setQInput(e.target.value)}
                    className="search-input"
                    aria-label="Search projects"
                  />
                  <button className="search-kbd" onClick={openCommandPalette} aria-label="Open command palette">
                    Ctrl/Cmd K
                  </button>
                </div>
                <button className="command-launch-btn" onClick={openCommandPalette}>
                  <FiCommand size={15} /> Command Palette
                </button>
              </div>
            </div>
            <div className="welcome-glow" aria-hidden="true" />
          </section>

          {/* ── Stats Metrics ────────────────────────────── */}
          <section className="dash-metrics">
            <div className="metric-card">
              <div className="metric-icon metric-icon--purple"><FiFolder size={20} /></div>
              <div className="metric-body">
                <div className="metric-value">{stats.projects ?? 0}</div>
                <div className="metric-label">Projects</div>
              </div>
              <div className="metric-trend metric-trend--up"><FiTrendingUp size={14} /></div>
            </div>
            <div className="metric-card">
              <div className="metric-icon metric-icon--teal"><FiFile size={20} /></div>
              <div className="metric-body">
                <div className="metric-value">{Array.isArray(scenes) ? scenes.length : 0}</div>
                <div className="metric-label">Scenes</div>
              </div>
            </div>
            <div className="metric-card">
              <div className="metric-icon metric-icon--pink"><FiUploadCloud size={20} /></div>
              <div className="metric-body">
                <div className="metric-value">{stats.uploads ?? 0}</div>
                <div className="metric-label">Uploads</div>
              </div>
            </div>
            <div className="metric-card">
              <div className="metric-icon metric-icon--amber"><FiHardDrive size={20} /></div>
              <div className="metric-body">
                <div className="metric-value">{stats.storageMB ?? 0}<span className="metric-unit">MB</span></div>
                <div className="metric-label">Storage</div>
              </div>
            </div>
          </section>

          {/* ── Command Center Bento ───────────────────── */}
          <section className="dash-bento" aria-label="Dashboard insights">
            <article className="bento-card bento-card--insight">
              <div className="bento-head">
                <h3 className="bento-title"><FiBarChart2 size={16} /> Momentum</h3>
                <span className="bento-pill">{momentumScore}/100</span>
              </div>
              <div className="momentum-ring" style={{ "--momentum-value": `${momentumScore}%` }}>
                <div className="momentum-ring-inner">
                  <div className="momentum-label">Momentum</div>
                  <div className="momentum-value">{momentumScore}</div>
                </div>
              </div>
              <div className="insight-stats">
                <div className="insight-stat">
                  <span className="insight-stat-label">Active projects</span>
                  <span className="insight-stat-value">{activeProjectCount}</span>
                </div>
                <div className="insight-stat">
                  <span className="insight-stat-label">Live collaborators</span>
                  <span className="insight-stat-value">{liveCollaboratorCount}</span>
                </div>
              </div>
            </article>

            <article className="bento-card bento-card--focus">
              <div className="bento-head">
                <h3 className="bento-title"><FiTarget size={16} /> Focus Session</h3>
                <span className="bento-pill">{Math.max(0, Math.round(focusRemaining / 60))}m left</span>
              </div>

              <div className="focus-ring" style={{ "--focus-progress": `${focusProgress}%` }}>
                <div className="focus-ring-inner">
                  <div className="focus-clock">{formatClock(focusRemaining)}</div>
                  <div className="focus-sub">Deep work mode</div>
                </div>
              </div>

              <div className="focus-presets" role="group" aria-label="Focus presets">
                {FOCUS_PRESETS.map((minutes) => (
                  <button
                    key={minutes}
                    className={`focus-preset ${focusDuration === minutes * 60 ? 'focus-preset--active' : ''}`}
                    onClick={() => applyFocusPreset(minutes)}
                  >
                    {minutes}m
                  </button>
                ))}
              </div>

              <div className="focus-actions">
                <button className="focus-btn focus-btn--primary" onClick={() => setFocusRunning((v) => !v)}>
                  {focusRunning ? <FiPause size={14} /> : <FiPlay size={14} />}
                  {focusRunning ? 'Pause' : 'Start'}
                </button>
                <button className="focus-btn" onClick={resetFocusSession}>
                  <FiRotateCw size={14} /> Reset
                </button>
              </div>
            </article>

            <article className="bento-card bento-card--spotlight">
              <div className="bento-head">
                <h3 className="bento-title"><FiActivity size={16} /> Spotlight</h3>
                <span className="bento-pill">Top work</span>
              </div>

              <div className="spotlight-list">
                {spotlightProjects.length === 0 ? (
                  <div className="spotlight-empty">Create a project to build your spotlight stack.</div>
                ) : spotlightProjects.map((project, idx) => (
                  <div key={project._id || `spot-${idx}`} className="spotlight-item">
                    <button
                      className={`spotlight-star ${starredIds?.[project._id] ? 'spotlight-star--active' : ''}`}
                      onClick={() => toggleProjectStar(project._id)}
                      aria-label={starredIds?.[project._id] ? 'Unstar project' : 'Star project'}
                    >
                      <FiStar size={13} />
                    </button>
                    <div className="spotlight-main">
                      <div className="spotlight-name" title={project.title}>{project.title}</div>
                      <div className="spotlight-meta">{timeAgo(project.updatedAt || project.createdAt)} • {project.progress || 0}%</div>
                    </div>
                    <button className="spotlight-open" onClick={() => navToStudio(project)}>
                      Open
                    </button>
                  </div>
                ))}
              </div>
            </article>
          </section>

        {/* ── Quick Actions ────────────────────────────── */}
          <section className="dash-quick-actions">
            <button className="qa-btn qa-btn--primary" onClick={createProject}>
              <FiPlus size={18} />
              <span>New Project</span>
            </button>
            <button className="qa-btn qa-btn--accent" onClick={handleImport}>
              <FiDownload size={18} />
              <span>Import</span>
            </button>
            <button className="qa-btn qa-btn--glass" onClick={() => navToStudio()}>
              <FiLayout size={18} />
              <span>Open Studio</span>
            </button>
            <button className="qa-btn qa-btn--glass" onClick={handleMarketplace}>
              <FiGlobe size={18} />
              <span>Marketplace</span>
            </button>
            <button className="qa-btn qa-btn--glass" onClick={handleExportAction}>
              <FiExternalLink size={18} />
              <span>Export</span>
            </button>
            <button className="qa-btn qa-btn--glass" onClick={openCommandPalette}>
              <FiSliders size={18} />
              <span>Commands</span>
            </button>
          </section>

          {/* ── Projects Section (HERO) ─────────────────────────── */}
          <section className="dash-projects-section dash-projects-hero">
            <div className="section-header">
              <div className="section-header-left">
                <h2 className="section-title"><FiStar className="section-icon" /> Your Projects</h2>
                <span className="section-count">{filteredProjects.length}</span>
                <div className="project-filter-chips" role="tablist" aria-label="Project filters">
                  <button
                    role="tab"
                    aria-selected={projectFilter === 'all'}
                    className={`filter-chip ${projectFilter === 'all' ? 'filter-chip--active' : ''}`}
                    onClick={() => setProjectFilter('all')}
                  >
                    All
                  </button>
                  <button
                    role="tab"
                    aria-selected={projectFilter === 'starred'}
                    className={`filter-chip ${projectFilter === 'starred' ? 'filter-chip--active' : ''}`}
                    onClick={() => setProjectFilter('starred')}
                  >
                    Starred ({starredCount})
                  </button>
                  <button
                    role="tab"
                    aria-selected={projectFilter === 'active'}
                    className={`filter-chip ${projectFilter === 'active' ? 'filter-chip--active' : ''}`}
                    onClick={() => setProjectFilter('active')}
                  >
                    Active ({activeProjectCount})
                  </button>
                </div>
              </div>
              <div className="section-header-right">
                <select
                  aria-label="Sort projects"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="sort-select"
                >
                  <option value="recent">Recent</option>
                  <option value="name">Name</option>
                  <option value="progress">Progress</option>
                </select>
                <div className="view-toggle">
                  <button
                    className={`view-btn ${viewMode === 'grid' ? 'view-btn--active' : ''}`}
                    onClick={() => setViewMode('grid')}
                    aria-label="Grid view"
                  ><FiGrid size={16} /></button>
                  <button
                    className={`view-btn ${viewMode === 'list' ? 'view-btn--active' : ''}`}
                    onClick={() => setViewMode('list')}
                    aria-label="List view"
                  ><FiList size={16} /></button>
                </div>
              </div>
            </div>

            {projectsError && (
              <div className="error-banner" role="alert">
                <div className="error-content">
                  <span className="error-dot" />
                  <span>{projectsError}</span>
                </div>
                <button className="error-retry" onClick={handleRetryProjects}>Retry</button>
              </div>
            )}

            <ProjectGrid
              projects={projects}
              loading={projects === null}
              filteredProjects={filteredProjects}
              presenceMap={presenceMap}
              saveProgressMap={saveProgressMap}
              onOpen={(p) => openProjectModal(p)}
              onPreview={(p) => openPreview(p)}
              onDuplicate={(p) => duplicateProject(p)}
              onContext={(e, p) => openContext(e, p)}
              onOpenStudio={(p) => navToStudio(p)}
              viewMode={viewMode}
              timeAgo={timeAgo}
            />
          </section>

          {/* ── Saved Scenes (moved higher) ─────────────────────────────── */}
          <section className="dash-projects-section dash-scenes-section">
            <div className="section-header">
              <div className="section-header-left">
                <h2 className="section-title"><FiZap className="section-icon" /> Saved Scenes</h2>
                <span className="section-count">{Array.isArray(scenes) ? scenes.length : 0}</span>
              </div>
            </div>

            {scenesLoading ? (
              <div className="scenes-loading">
                {[1,2,3].map(i => (
                  <div key={i} className="scene-skeleton">
                    <div className="skeleton-thumb" />
                    <div className="skeleton-body">
                      <div className="skeleton-line w-60" />
                      <div className="skeleton-line w-40" />
                    </div>
                  </div>
                ))}
              </div>
            ) : !Array.isArray(scenes) || scenes.length === 0 ? (
              <div className="empty-state-card">
                <div className="empty-icon-wrap">
                  <FiFile size={32} />
                </div>
                <h4 className="empty-title">No saved scenes yet</h4>
                <p className="empty-desc">Save a scene from the Studio to see it here.</p>
                <button className="qa-btn qa-btn--glass" onClick={() => navToStudio()}>
                  <FiLayout size={16} /> Open Studio
                </button>
              </div>
            ) : (
              <div className="scenes-grid">
                {scenes.map((s, i) => (
                  <div key={s._id || `scene-${i}`} className="scene-card" onClick={() => loadSceneInStudio(s._id)}>
                    <div className="scene-thumb">
                      {s.thumbnailUrl ? (
                        <img src={s.thumbnailUrl} alt={s.name} loading="lazy" />
                      ) : (
                        <div className="scene-placeholder">
                          <FiFile size={28} />
                        </div>
                      )}
                      <div className="scene-overlay">
                        <button className="scene-play-btn" aria-label="Load scene">
                          <FiChevronRight size={20} />
                        </button>
                      </div>
                    </div>
                    <div className="scene-body">
                      <div className="scene-name" title={s.name}>{s.name}</div>
                      <div className="scene-meta">{timeAgo(s.updatedAt || s.createdAt)}</div>
                    </div>
                    <div className="scene-actions">
                      <button className="scene-action-btn" onClick={(e) => { e.stopPropagation(); loadSceneInStudio(s._id); }} title="Open">
                        <FiExternalLink size={14} />
                      </button>
                      <button className="scene-action-btn" onClick={(e) => {
                        e.stopPropagation();
                        navigator.clipboard?.writeText(`${window.location.origin}/studio?scene=${encodeURIComponent(s._id)}`);
                        pushToast("Link copied", "info");
                      }} title="Copy link">
                        <FiCopy size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* ── Activity & Team Row ──────────────────────── */}
          <section className="dash-panels-row">
            <div className="panel-card panel-activity">
              <div className="panel-header">
                <h3 className="panel-title"><FiClock size={16} /> Activity</h3>
              </div>
              <div className="activity-timeline">
                {activity.length === 0 ? (
                  <div className="panel-empty-state">No recent activity</div>
                ) : activity.map((a) => (
                  <div key={a.id} className="timeline-item">
                    <div className="timeline-dot" />
                    <div className="timeline-content">
                      <span className="timeline-text">{a.text}</span>
                      <span className="timeline-when">{a.when}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="panel-card panel-team">
              <div className="panel-header">
                <h3 className="panel-title"><FiUsers size={16} /> Team</h3>
                <button className="panel-action-btn" onClick={() => pushToast("Invites coming soon", "info")}>
                  <FiPlus size={14} /> Invite
                </button>
              </div>
              <div className="team-list">
                {collabs.length === 0 ? (
                  <div className="panel-empty-state">No collaborators yet</div>
                ) : collabs.map((c) => (
                  <div key={c.id} className="team-member">
                    <div className="team-avatar">
                      {c.name?.[0]?.toUpperCase() ?? "U"}
                      <span className="online-dot" />
                    </div>
                    <div className="team-info">
                      <div className="team-name">{c.name}</div>
                      <div className="team-role">{c.role || "Member"}</div>
                    </div>
                    <button className="team-action" onClick={() => pushToast(`Invite sent to ${c.name}`, "success")}>
                      <FiShare2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ── Account Section ──────────────────────────── */}
          <section className="dash-account-section">
            <div className="account-card">
              <div className="account-header">
                <div className="account-avatar-lg">
                  {user?.name ? user.name.split(' ').map(n => n[0]).slice(0, 2).join('') : user?.email?.[0]?.toUpperCase() || 'U'}
                </div>
                <div className="account-info">
                  <div className="account-name">{user?.name || 'Creator'}</div>
                  <div className="account-email">{user?.email}</div>
                </div>
              </div>
              <div className="account-meta">
                <div className="account-meta-item">
                  <span className="account-meta-label">Member since</span>
                  <span className="account-meta-value">{new Date(user?.createdAt || Date.now()).toLocaleDateString()}</span>
                </div>
                <div className="account-meta-item">
                  <span className="account-meta-label">Projects</span>
                  <span className="account-meta-value">{stats.projects ?? 0}</span>
                </div>
              </div>
            </div>
          </section>

          {/* ── Footer ───────────────────────────────────── */}
          <footer className="dash-footer">
            <div className="footer-brand">Objekta</div>
            <div className="footer-copy">© {new Date().getFullYear()} All rights reserved.</div>
          </footer>
        </main>
      </div>

      {/* ── Context Menu ──────────────────────────────── */}
      {context && (
        <div
          ref={contextRef}
          className="ctx-menu"
          style={{ left: context.x, top: context.y, position: 'fixed', zIndex: 200 }}
          role="menu"
          aria-label="Project actions"
        >
          <button className="ctx-item" role="menuitem" onClick={() => handleContextAction('open', context.project)}>
            <FiExternalLink size={14} /> Open in Studio
          </button>
          <button className="ctx-item" role="menuitem" onClick={() => handleContextAction('rename', context.project)}>
            <FiEdit3 size={14} /> Rename
          </button>
          <button className="ctx-item" role="menuitem" onClick={() => handleContextAction('duplicate', context.project)}>
            <FiCopy size={14} /> Duplicate
          </button>
          <button className="ctx-item" role="menuitem" onClick={() => handleContextAction('star', context.project)}>
            <FiStar size={14} /> {starredIds?.[context.project?._id] ? 'Remove Star' : 'Star Project'}
          </button>
          <button className="ctx-item" role="menuitem" onClick={() => handleContextAction('export', context.project)}>
            <FiDownload size={14} /> Export
          </button>
          <button className="ctx-item" role="menuitem" onClick={() => handleContextAction('share', context.project)}>
            <FiShare2 size={14} /> Copy Share Link
          </button>
          <div className="ctx-divider" />
          <button className="ctx-item ctx-item--danger" role="menuitem" onClick={() => handleContextAction('delete', context.project)}>
            <FiTrash2 size={14} /> Delete
          </button>
        </div>
      )}

      {/* ── Project Detail Modal ─────────────────────── */}
      {isModalOpen && selectedProject && (
        <Modal title="Project Details" onClose={closeModal}>
          <div className="modal-project-header">
            <div className="modal-project-icon"><FiFolder size={20} /></div>
            <div>
              <label className="modal-label">Title</label>
              <input className="modal-input" value={renameValue} onChange={(e) => setRenameValue(e.target.value)} />
            </div>
          </div>

          <label className="modal-label modal-label--spaced">Progress</label>
          <div className="modal-progress">
            <div className="modal-progress-track">
              <div className="modal-progress-fill" style={{ width: `${selectedProject.progress ?? 0}%` }} />
            </div>
            <div className="modal-progress-num">{selectedProject.progress ?? 0}%</div>
          </div>

          <div className="modal-actions">
            <button className="modal-btn modal-btn--primary" onClick={saveRename} disabled={modalLoading}>
              {modalLoading ? 'Saving…' : 'Save Changes'}
            </button>
            <button className="modal-btn modal-btn--ghost" onClick={closeModal}>Cancel</button>
            <button className="modal-btn modal-btn--danger" onClick={() => deleteProject()} disabled={modalLoading}>
              Delete
            </button>
          </div>
        </Modal>
      )}

      {/* ── Preview Modal ────────────────────────────── */}
      {preview && (
        <Modal title={`Preview: ${preview.title}`} onClose={closePreview} width={820}>
          <div className="preview-layout">
            <div className="preview-media">
              <div className="preview-box">
                {renderThumbSrc(preview.thumbnailUrl) ? (
                  <img
                    src={renderThumbSrc(preview.thumbnailUrl)}
                    data-src={renderThumbSrc(preview.thumbnailUrl)}
                    alt={preview.title}
                    onError={handleThumbError}
                    loading="lazy"
                  />
                ) : (
                  <div className="preview-empty">
                    <FiFile size={48} />
                    <span>No preview available</span>
                  </div>
                )}
              </div>
            </div>
            <div className="preview-info">
              <div className="preview-info__title">{preview.title}</div>
              <div className="preview-info__meta">Last saved: {safeDate(preview.updatedAt || preview.createdAt)}</div>
              <div className="preview-info__actions">
                <button className="modal-btn modal-btn--primary" onClick={() => { navToStudio(preview); closePreview(); }}>
                  Open in Studio
                </button>
                <button className="modal-btn modal-btn--ghost" onClick={() => {
                  navigator.clipboard?.writeText(`${window.location.origin}/studio?project=${encodeURIComponent(preview._id)}`);
                  pushToast('Link copied', 'info');
                }}>
                  Copy Link
                </button>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* ── Command Palette ─────────────────────────── */}
      {isCommandOpen && (
        <div className="command-overlay" role="dialog" aria-modal="true" aria-label="Command palette" onClick={closeCommandPalette}>
          <div className="command-card" onClick={(ev) => ev.stopPropagation()}>
            <div className="command-search-row">
              <FiCommand className="command-search-icon" size={18} />
              <input
                ref={commandInputRef}
                value={commandQuery}
                onChange={(ev) => setCommandQuery(ev.target.value)}
                onKeyDown={handleCommandInputKeyDown}
                className="command-search-input"
                placeholder="Search actions, projects, workflows..."
                aria-label="Search commands"
              />
              <button className="command-close" onClick={closeCommandPalette} aria-label="Close command palette">
                <FiX size={16} />
              </button>
            </div>

            <div className="command-list" role="listbox" aria-label="Available commands">
              {filteredCommandActions.length === 0 ? (
                <div className="command-empty">No commands matched your search.</div>
              ) : filteredCommandActions.slice(0, 10).map((cmd) => {
                const CommandIcon = cmd.icon || FiCommand;
                return (
                  <button key={cmd.id} className="command-item" onClick={() => runCommandAction(cmd)} role="option">
                    <span className="command-item-icon"><CommandIcon size={15} /></span>
                    <span className="command-item-main">
                      <span className="command-item-title">{cmd.label}</span>
                      <span className="command-item-description">{cmd.description}</span>
                    </span>
                    {cmd.hint ? <span className="command-item-hint">{cmd.hint}</span> : null}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── Toasts ───────────────────────────────────── */}
      <Toasts toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
