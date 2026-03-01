// src/components/workspace/constants.js
// Extracted from Workspace.jsx — shared constants and configuration

export const HISTORY_LIMIT = 200;
export const HISTORY_DEBOUNCE_MS = 600;
export const AUTOSAVE_KEY = "objekta_autosave_v1";
export const CAMERA_BOOKMARKS_KEY = "objekta_cam_bookmarks_v1";
export const TRANSFORM_FLUSH_MS = 100;

// Adaptive resolution thresholds
export const MIN_RESOLUTION_SCALE = 0.75;
export const MAX_RESOLUTION_SCALE = 1;

// BVH limits
export const BVH_MAX_TRIS = 200_000;
export const BVH_CHUNK_BUDGET_MS = 8;
export const BVH_IDLE_TIMEOUT_MS = 600;
