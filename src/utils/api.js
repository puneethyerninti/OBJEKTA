// src/utils/api.js
// Centralized API base + helper for Vite / runtime overrides
// Priority order: runtime override → Vite env → smart fallback (same origin for prod, localhost:5000 for dev/render)

const FALLBACK_HOSTED_BASE = "https://objekta-backend.onrender.com"; // public backend used in render.yaml
const LOCAL_HOST_RE = /^(localhost|127\.0\.0\.1)$/i;

function isLocalHostName(hostname = "") {
  return LOCAL_HOST_RE.test(String(hostname || ""));
}

function asBool(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}

function shouldAllowRemoteApiOnLocalhost() {
  if (typeof window !== "undefined" && asBool(window.__OBJEKTA_ALLOW_REMOTE_API_ON_LOCALHOST)) {
    return true;
  }
  const envFlag = typeof import.meta !== "undefined" && import.meta.env
    ? import.meta.env.VITE_ALLOW_REMOTE_API_ON_LOCALHOST
    : null;
  return asBool(envFlag);
}

function computeDefaultApiBase() {
  if (typeof window === "undefined") return FALLBACK_HOSTED_BASE;
  try {
    const { protocol, hostname, origin } = window.location;
    if (isLocalHostName(hostname)) {
      // During local dev we typically run backend on port 5000 regardless of frontend port
      return `${protocol}//${hostname}:5000`;
    }
    // On vercel/static hosting there is no backend, so route to hosted API
    if (/vercel\.app$/i.test(hostname)) return FALLBACK_HOSTED_BASE;
    // In production (render), assume backend shares the same origin as the served app
    return origin;
  } catch (e) {
    return FALLBACK_HOSTED_BASE;
  }
}

function resolveApiBase(baseCandidate) {
  const normalized = String(baseCandidate || "").trim();
  if (!normalized) return computeDefaultApiBase();
  if (typeof window === "undefined") return normalized;

  try {
    const { protocol, hostname, origin } = window.location;
    const runningLocal = isLocalHostName(hostname);
    if (!runningLocal || shouldAllowRemoteApiOnLocalhost()) {
      return normalized;
    }

    const parsed = new URL(normalized, origin);
    if (!isLocalHostName(parsed.hostname)) {
      return `${protocol}//${hostname}:5000`;
    }
  } catch (e) {
    // Keep user-provided base if URL parsing fails.
  }

  return normalized;
}

const runtimeBase = typeof window !== "undefined"
  ? (window.__OBJEKTA_API_BASE || window.__OBJEKTA_API_URL__)
  : null;
const envBase = typeof import.meta !== "undefined" && import.meta.env
  ? (import.meta.env.VITE_API_BASE || import.meta.env.VITE_API_URL)
  : null;

const rawBase = runtimeBase || envBase;
export const API_BASE = resolveApiBase(rawBase);

export function isCrossOriginTarget(target) {
  if (typeof window === "undefined") return false;
  try {
    const resolved = new URL(target || API_BASE || window.location.origin, window.location.origin);
    return resolved.origin !== window.location.origin;
  } catch (e) {
    return false;
  }
}

export function apiUrl(path = "") {
  if (!path) return API_BASE || "";
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  // ensure single slash between base + path
  const base = String(API_BASE).replace(/\/+$/, "");
  const p = String(path).replace(/^\/+/, "");
  return `${base}/${p}`;
}
