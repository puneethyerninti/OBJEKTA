// src/utils/api.js
// Centralized API base + helper for Vite / runtime overrides
// Priority order: runtime override → Vite env → smart fallback (same origin for prod, localhost:5000 for dev)

function computeDefaultApiBase() {
  if (typeof window === "undefined") return "http://localhost:5000";
  try {
    const { protocol, hostname, origin } = window.location;
    const isLocalHost = /^(localhost|127\.0\.0\.1)$/i.test(hostname);
    if (isLocalHost) {
      // During local dev we typically run backend on port 5000 regardless of frontend port
      return `${protocol}//${hostname}:5000`;
    }
    // In production, assume backend shares the same origin as the served app
    return origin;
  } catch (e) {
    return "http://localhost:5000";
  }
}

const runtimeBase = typeof window !== "undefined" ? window.__OBJEKTA_API_BASE : null;
const envBase = typeof import.meta !== "undefined" && import.meta.env ? import.meta.env.VITE_API_BASE : null;

export const API_BASE = runtimeBase || envBase || computeDefaultApiBase();

export function apiUrl(path = "") {
  if (!path) return API_BASE || "";
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  // ensure single slash between base + path
  const base = String(API_BASE).replace(/\/+$/, "");
  const p = String(path).replace(/^\/+/, "");
  return `${base}/${p}`;
}
