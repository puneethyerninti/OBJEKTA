// src/store/TextureStore.js
import * as THREE from "three";

/**
 * Simple TextureStore: keyed by a string (prefer file.name or URL).
 * Keeps refcounts and disposes textures when refcount hits zero.
 */
class TextureStore {
  constructor() {
    this.map = new Map(); // key -> { tex, ref }
    this.loader = new THREE.TextureLoader();
  }

  async loadFromFile(file, key = null) {
    const k = key || (file && file.name) || `blob:${Date.now()}`;
    if (this.map.has(k)) {
      this.map.get(k).ref++;
      return this.map.get(k).tex;
    }
    const url = URL.createObjectURL(file);
    return new Promise((resolve, reject) => {
      this.loader.load(url,
        (tex) => {
          this.map.set(k, { tex, ref: 1, previewUrl: url });
          // tag texture with store metadata
          tex.__objekta_store_key = k;
          resolve(tex);
        },
        undefined,
        (err) => {
          try { URL.revokeObjectURL(url); } catch (e) {}
          reject(err);
        }
      );
    });
  }

  add(key, tex) {
    if (!key || !tex) return;
    const existing = this.map.get(key);
    if (existing) {
      existing.ref++;
      return existing.tex;
    }
    this.map.set(key, { tex, ref: 1 });
    tex.__objekta_store_key = key;
    return tex;
  }

  get(key) {
    const e = this.map.get(key);
    return e ? e.tex : null;
  }

  retain(key) {
    const e = this.map.get(key);
    if (e) e.ref++;
  }

  release(key) {
    const e = this.map.get(key);
    if (!e) return;
    e.ref = Math.max(0, e.ref - 1);
    if (e.ref === 0) {
      try { e.tex.dispose && e.tex.dispose(); } catch (err) {}
      if (e.previewUrl && e.previewUrl.startsWith && e.previewUrl.startsWith('blob:')) {
        try { URL.revokeObjectURL(e.previewUrl); } catch (e) {}
      }
      this.map.delete(key);
    }
  }

  disposeAll() {
    for (const [k, v] of this.map.entries()) {
      try { v.tex.dispose && v.tex.dispose(); } catch (e) {}
      if (v.previewUrl && v.previewUrl.startsWith && v.previewUrl.startsWith('blob:')) {
        try { URL.revokeObjectURL(v.previewUrl); } catch (e) {}
      }
    }
    this.map.clear();
  }

  stats() {
    return Array.from(this.map.entries()).map(([k, v]) => ({ key: k, refs: v.ref }));
  }
}

const store = new TextureStore();
export default store;
