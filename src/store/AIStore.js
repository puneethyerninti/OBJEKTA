// src/store/AIStore.js
// ---------------------------------------------------------------------------
// Central AI state – manages model lifecycle, inference results, chat history,
// and suggestion queue for all browser-side AI features.
//
// Uses Zustand for reactive state; any React component can subscribe:
//   const status = useAIStore(s => s.status);
//
// Non-React code can read/write via:
//   AIStore.getState().setStatus('loading');
// ---------------------------------------------------------------------------

import { create } from "zustand";

/**
 * @typedef {'idle'|'loading'|'ready'|'error'} ModelStatus
 *
 * @typedef {Object} ChatMessage
 * @property {'user'|'assistant'|'system'} role
 * @property {string} content
 * @property {number} timestamp   - Date.now()
 *
 * @typedef {Object} AISuggestion
 * @property {string} id
 * @property {'material'|'lighting'|'layout'|'optimization'|'general'} category
 * @property {string} summary     - one-line description
 * @property {object|null} payload - structured action data (e.g. params for applyMaterial)
 * @property {boolean} applied
 */

const useAIStore = create((set, _get) => ({
  // ─── Model lifecycle ────────────────────────────────────────────────
  /** Overall status across all loaded models */
  status: "idle", // 'idle' | 'loading' | 'ready' | 'error'

  /** Per-model loading progress { [modelKey]: { status, progress, error } } */
  models: {},

  /** Human-readable status line shown in the UI */
  statusMessage: "",

  setStatus(status, message) {
    set({ status, statusMessage: message ?? "" });
  },

  /** Register or update a specific model's state. */
  setModelStatus(key, modelStatus) {
    set((prev) => ({
      models: { ...prev.models, [key]: { ...prev.models[key], ...modelStatus } },
    }));
  },

  // ─── Inference results ──────────────────────────────────────────────
  /** Latest inference result keyed by feature name */
  results: {},

  setResult(feature, data) {
    set((prev) => ({
      results: { ...prev.results, [feature]: data },
    }));
  },

  clearResult(feature) {
    set((prev) => {
      const next = { ...prev.results };
      delete next[feature];
      return { results: next };
    });
  },

  // ─── Chat / Prompt history ─────────────────────────────────────────
  chatHistory: [],

  pushMessage(role, content) {
    set((prev) => ({
      chatHistory: [
        ...prev.chatHistory,
        { role, content, timestamp: Date.now() },
      ],
    }));
  },

  clearChat() {
    set({ chatHistory: [] });
  },

  // ─── Suggestion queue ──────────────────────────────────────────────
  suggestions: [],

  /** Add one or more suggestions (deduped by id). */
  addSuggestions(items = []) {
    set((prev) => {
      const ids = new Set(prev.suggestions.map((s) => s.id));
      const novel = items.filter((s) => !ids.has(s.id));
      return { suggestions: [...prev.suggestions, ...novel] };
    });
  },

  /** Mark a suggestion as applied. */
  applySuggestion(id) {
    set((prev) => ({
      suggestions: prev.suggestions.map((s) =>
        s.id === id ? { ...s, applied: true } : s,
      ),
    }));
  },

  dismissSuggestion(id) {
    set((prev) => ({
      suggestions: prev.suggestions.filter((s) => s.id !== id),
    }));
  },

  clearSuggestions() {
    set({ suggestions: [] });
  },

  // ─── Bulk reset ────────────────────────────────────────────────────
  reset() {
    set({
      status: "idle",
      models: {},
      statusMessage: "",
      results: {},
      chatHistory: [],
      suggestions: [],
    });
  },
}));

// Re-export the vanilla store for imperative (non-React) usage.
export const AIStore = useAIStore;
export default useAIStore;
