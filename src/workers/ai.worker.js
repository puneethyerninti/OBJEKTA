// src/workers/ai.worker.js
// ---------------------------------------------------------------------------
// Web Worker that hosts Transformers.js pipelines.
// All heavy model download + inference runs off-main-thread.
//
// Protocol:
//   Main  -> Worker:  { id, type, payload }
//   Worker -> Main:   { id, type, result?, error?, progress? }
//
// Supported message types:
//   "load"     – download / cache a pipeline
//   "infer"    – run inference on a loaded pipeline
//   "dispose"  – release a pipeline from memory
// ---------------------------------------------------------------------------

import { pipeline, env } from "@huggingface/transformers";

// Use browser cache, don't try to use Node filesystem
env.allowLocalModels = false;

/** Cache of loaded pipelines keyed by a user-chosen alias. */
const pipelines = {};

/**
 * Load (or return cached) pipeline.
 */
async function loadPipeline(alias, task, model, options = {}) {
  if (pipelines[alias]) return pipelines[alias];

  const pipe = await pipeline(task, model, {
    progress_callback: (p) => {
      self.postMessage({ type: "progress", alias, progress: p });
    },
    ...options,
  });

  pipelines[alias] = pipe;
  return pipe;
}

// ---------------------------------------------------------------------------
// Message handler
// ---------------------------------------------------------------------------
self.onmessage = async (e) => {
  const { id, type, payload } = e.data || {};

  try {
    switch (type) {
      // ── Load a pipeline ──────────────────────────────────────────
      case "load": {
        const { alias, task, model, options } = payload;
        await loadPipeline(alias, task, model, options);
        self.postMessage({ id, type: "loaded", alias });
        break;
      }

      // ── Run inference ────────────────────────────────────────────
      case "infer": {
        const { alias, args } = payload;
        const pipe = pipelines[alias];
        if (!pipe) throw new Error(`Pipeline "${alias}" not loaded`);

        // args is an array of positional arguments
        const result = await pipe(...(Array.isArray(args) ? args : [args]));
        self.postMessage({ id, type: "result", result });
        break;
      }

      // ── Dispose a pipeline ───────────────────────────────────────
      case "dispose": {
        const { alias } = payload;
        if (pipelines[alias]) {
          try { await pipelines[alias].dispose?.(); } catch { /* ok */ }
          delete pipelines[alias];
        }
        self.postMessage({ id, type: "disposed", alias });
        break;
      }

      default:
        self.postMessage({ id, type: "error", error: `Unknown type: ${type}` });
    }
  } catch (err) {
    self.postMessage({
      id,
      type: "error",
      error: err?.message || String(err),
    });
  }
};
