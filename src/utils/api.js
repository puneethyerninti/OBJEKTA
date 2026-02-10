// src/utils/api.js
// Centralized API base + helper for Vite / runtime overrides
// Priority order: runtime override → Vite env → smart fallback (same origin for prod, localhost:5000 for dev/render)

const FALLBACK_HOSTED_BASE = "https://objekta-backend.onrender.com"; // public backend used in render.yaml

function computeDefaultApiBase() {
  if (typeof window === "undefined") return FALLBACK_HOSTED_BASE;
  try {
    const { protocol, hostname, origin } = window.location;
    const isLocalHost = /^(localhost|127\.0\.0\.1)$/i.test(hostname);
    if (isLocalHost) {
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

const runtimeBase = typeof window !== "undefined"
  ? (window.__OBJEKTA_API_BASE || window.__OBJEKTA_API_URL__)
  : null;
const envBase = typeof import.meta !== "undefined" && import.meta.env
  ? (import.meta.env.VITE_API_BASE || import.meta.env.VITE_API_URL)
  : null;

export const API_BASE = runtimeBase || envBase || computeDefaultApiBase();

export function apiUrl(path = "") {
  if (!path) return API_BASE || "";
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  // ensure single slash between base + path
  const base = String(API_BASE).replace(/\/+$/, "");
  const p = String(path).replace(/^\/+/, "");
  return `${base}/${p}`;
}
