// src/utils/assets.js
// Centralized asset base + helper for static assets (models, videos, posters)
// Priority: runtime override → Vite env → same-origin

function computeDefaultAssetBase() {
  if (typeof window === "undefined") return "";
  try {
    return window.location.origin;
  } catch {
    return "";
  }
}

const runtimeBase = typeof window !== "undefined"
  ? (window.__OBJEKTA_ASSET_BASE || window.__OBJEKTA_ASSET_URL__)
  : null;

const envBase = typeof import.meta !== "undefined" && import.meta.env
  ? import.meta.env.VITE_ASSET_BASE
  : null;

export const ASSET_BASE = runtimeBase || envBase || computeDefaultAssetBase();

export function assetUrl(path = "") {
  if (!path) return ASSET_BASE || "";
  if (/^https?:\/\//i.test(path)) return path;

  const base = (ASSET_BASE || "").replace(/\/+$/, "");
  const p = String(path).replace(/^\/+/, "");
  if (!base) return `/${p}`;
  return `${base}/${p}`;
}
