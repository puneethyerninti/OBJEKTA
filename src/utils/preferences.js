// src/utils/preferences.js
// Centralized persistence helpers (unique lightweight system)

const PREFIX = 'objekta_pref_';

export function savePref(key, value) {
  try { localStorage.setItem(PREFIX + key, JSON.stringify({ v: value })); } catch (e) {}
}

export function loadPref(key, fallback = null) {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return parsed && 'v' in parsed ? parsed.v : fallback;
  } catch (e) { return fallback; }
}

export function saveNumber(key, num, fallback = 0) {
  if (!Number.isFinite(num)) num = fallback;
  savePref(key, num);
}

export function loadNumber(key, fallback = 0) {
  const v = loadPref(key, fallback);
  return Number.isFinite(v) ? v : fallback;
}

export function saveBool(key, b) { savePref(key, !!b); }
export function loadBool(key, fallback = false) {
  const v = loadPref(key, fallback);
  return typeof v === 'boolean' ? v : !!fallback;
}

export function saveString(key, s) { savePref(key, String(s)); }
export function loadString(key, fallback = '') { const v = loadPref(key, fallback); return typeof v === 'string' ? v : fallback; }

// Specific higher-level helpers
export const PREF_KEYS = {
  adaptiveScale: 'adaptive_scale',
  perfPanelVisible: 'perf_panel_visible',
  paletteCollapsed: 'palette_collapsed',
  propsCollapsed: 'props_collapsed'
};

export function togglePerfPanel(currentVisible) {
  const next = !currentVisible;
  saveBool(PREF_KEYS.perfPanelVisible, next);
  return next;
}

export function persistAdaptiveScale(scale) {
  saveNumber(PREF_KEYS.adaptiveScale, scale, 1);
}

export function loadAdaptiveScale() {
  return loadNumber(PREF_KEYS.adaptiveScale, 1);
}

export function loadInitialPanels() {
  return {
    paletteCollapsed: loadBool(PREF_KEYS.paletteCollapsed, false),
    propsCollapsed: loadBool(PREF_KEYS.propsCollapsed, false),
  };
}

export function persistPanelStates({ paletteCollapsed, propsCollapsed }) {
  saveBool(PREF_KEYS.paletteCollapsed, paletteCollapsed);
  saveBool(PREF_KEYS.propsCollapsed, propsCollapsed);
}
