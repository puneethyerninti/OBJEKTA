// src/engine/AIPipelineManager.js
// ---------------------------------------------------------------------------
// Singleton that manages the AI Web Worker and provides a promise-based API
// for loading models and running inference from any part of the app.
//
// Usage:
//   import ai from '../engine/AIPipelineManager';
//   await ai.load('text-gen', 'text2text-generation', 'Xenova/LaMini-Flan-T5-77M');
//   const out = await ai.infer('text-gen', ['Describe a 3D scene']);
// ---------------------------------------------------------------------------

import { AIStore } from "../store/AIStore";

let _instance = null;

class AIPipelineManager {
  constructor() {
    if (_instance) return _instance;
    _instance = this;

    /** @type {Worker|null} */
    this._worker = null;
    /** Pending promise callbacks keyed by request id */
    this._pending = {};
    this._nextId = 1;
    /** Track which aliases have been loaded */
    this._loaded = new Set();
  }

  // ── Worker lifecycle ────────────────────────────────────────────────

  /** Lazily spawn the AI worker the first time it's needed. */
  _ensureWorker() {
    if (this._worker) return;
    this._worker = new Worker(
      new URL("../workers/ai.worker.js", import.meta.url),
      { type: "module" },
    );
    this._worker.onmessage = (e) => this._onMessage(e.data);
    this._worker.onerror = (err) => {
      console.error("[AIPipelineManager] worker error", err);
      AIStore.getState().setStatus("error", "AI Worker crashed");
    };
  }

  _onMessage(msg) {
    const { id, type, alias, result, error, progress } = msg;

    // Progress callbacks (no id – broadcast)
    if (type === "progress" && progress) {
      const store = AIStore.getState();
      const pct =
        progress.progress != null
          ? Math.round(progress.progress * 100)
          : null;
      const label = progress.file
        ? `Downloading ${progress.file}… ${pct != null ? pct + "%" : ""}`
        : `Loading model… ${pct != null ? pct + "%" : ""}`;
      store.setModelStatus(alias, { status: "loading", progress: pct });
      store.setStatus("loading", label);
      return;
    }

    // Resolve / reject pending promise
    const cb = this._pending[id];
    if (!cb) return;
    delete this._pending[id];

    if (type === "error") {
      cb.reject(new Error(error));
    } else {
      cb.resolve(msg);
    }
  }

  /** Send a message to the worker and return a promise for the response. */
  _send(type, payload, timeoutMs = 120_000) {
    this._ensureWorker();
    const id = this._nextId++;
    return new Promise((resolve, reject) => {
      this._pending[id] = { resolve, reject };
      this._worker.postMessage({ id, type, payload });

      if (timeoutMs > 0) {
        setTimeout(() => {
          if (this._pending[id]) {
            delete this._pending[id];
            reject(new Error(`AI request ${id} timed out after ${timeoutMs}ms`));
          }
        }, timeoutMs);
      }
    });
  }

  // ── Public API ──────────────────────────────────────────────────────

  /**
   * Load (or re-use) a Transformers.js pipeline inside the worker.
   * @param {string} alias   – friendly name, e.g. "text-gen"
   * @param {string} task    – HF task, e.g. "text2text-generation"
   * @param {string} model   – HF model id, e.g. "Xenova/LaMini-Flan-T5-77M"
   * @param {object} options – extra pipeline options
   */
  async load(alias, task, model, options = {}) {
    if (this._loaded.has(alias)) return;
    const store = AIStore.getState();
    store.setModelStatus(alias, { status: "loading", progress: 0 });
    store.setStatus("loading", `Loading ${alias}…`);

    try {
      await this._send("load", { alias, task, model, options }, 300_000);
      this._loaded.add(alias);
      store.setModelStatus(alias, { status: "ready", progress: 100 });

      // If all models are ready, set global status to ready
      const allReady = Object.values(store.models).every(
        (m) => m.status === "ready",
      );
      if (allReady) store.setStatus("ready", "AI models ready");
    } catch (err) {
      store.setModelStatus(alias, {
        status: "error",
        error: err.message,
      });
      store.setStatus("error", err.message);
      throw err;
    }
  }

  /**
   * Run inference on a previously-loaded pipeline.
   * @param {string} alias  – pipeline alias
   * @param {any|any[]} args – arguments forwarded to the pipeline
   * @returns {Promise<any>} inference result
   */
  async infer(alias, args) {
    if (!this._loaded.has(alias)) {
      throw new Error(`Pipeline "${alias}" is not loaded. Call load() first.`);
    }
    const msg = await this._send("infer", { alias, args }, 60_000);
    return msg.result;
  }

  /**
   * Dispose a pipeline to free WASM / GPU memory.
   */
  async dispose(alias) {
    if (!this._loaded.has(alias)) return;
    await this._send("dispose", { alias }, 10_000);
    this._loaded.delete(alias);
    AIStore.getState().setModelStatus(alias, { status: "idle", progress: 0 });
  }

  /** Check if a pipeline is loaded and ready. */
  isReady(alias) {
    return this._loaded.has(alias);
  }

  /** Terminate the web worker entirely. */
  terminate() {
    if (this._worker) {
      this._worker.terminate();
      this._worker = null;
    }
    this._loaded.clear();
    this._pending = {};
    AIStore.getState().reset();
  }
}

// Singleton export
const aiManager = new AIPipelineManager();
export default aiManager;
