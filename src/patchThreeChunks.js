// Patch Three.js shader chunk names for legacy/newer mixes
// If a dependency expects colorspace_* chunks but our Three provides encodings_*, alias them.
try {
  // Import on demand to avoid bundler side effects if tree-shaken
  // eslint-disable-next-line import/no-extraneous-dependencies
  const three = await import('three');
  const ShaderChunk = three?.ShaderChunk;
  if (ShaderChunk) {
    if (!ShaderChunk.colorspace_fragment && ShaderChunk.encodings_fragment) {
      ShaderChunk.colorspace_fragment = ShaderChunk.encodings_fragment;
    }
    if (!ShaderChunk.colorspace_pars_fragment && ShaderChunk.encodings_pars_fragment) {
      ShaderChunk.colorspace_pars_fragment = ShaderChunk.encodings_pars_fragment;
    }
  }

  // --- Backwards-compatibility shims for three.js API renames ---
  // Provide .outputEncoding on WebGLRenderer that maps to .outputColorSpace
  try {
    const THREE = three;
    if (THREE && THREE.WebGLRenderer) {
      // Always override to silence upstream deprecation warning spam
      Object.defineProperty(THREE.WebGLRenderer.prototype, 'outputEncoding', {
        configurable: true,
        enumerable: false,
        get() {
          // Map through outputColorSpace when available
          return this.outputColorSpace !== undefined ? this.outputColorSpace : this._outputEncoding;
        },
        set(v) {
          // Store fallback value and try to write into outputColorSpace for newer three
          try {
            this._outputEncoding = v;
            if (this.outputColorSpace !== undefined) {
              this.outputColorSpace = v;
            }
          } catch (e) {
            // ignore if assignment fails
          }
        },
      });
    }

    // Map Texture.encoding -> Texture.colorSpace for older code
    if (THREE && THREE.Texture) {
      Object.defineProperty(THREE.Texture.prototype, 'encoding', {
        configurable: true,
        enumerable: false,
        get() {
          return this.colorSpace !== undefined ? this.colorSpace : this._encoding;
        },
        set(v) {
          try {
            this._encoding = v;
            if (this.colorSpace !== undefined) this.colorSpace = v;
          } catch (e) {}
        },
      });
    }
    // Targeted suppression of repeating deprecation/context lost warnings
    try {
      const originalWarn = console.warn;
      const originalInfo = console.info;
      const SUPPRESS_WARN = [
        /THREE\.WebGLRenderer: Property \.outputEncoding has been removed/i,
        /THREE\.Texture: Property \.encoding has been replaced/i,
        /THREE\.WebGLRenderer: Context Lost\./i
      ];
      const SUPPRESS_INFO = [
        /Download the React DevTools for a better development experience/i
      ];
      console.warn = function(...args) {
        if (typeof args[0] === 'string' && SUPPRESS_WARN.some(r => r.test(args[0]))) return;
        return originalWarn.apply(this, args);
      };
      console.info = function(...args) {
        if (typeof args[0] === 'string' && SUPPRESS_INFO.some(r => r.test(args[0]))) return;
        return originalInfo.apply(this, args);
      };
    } catch (e) {}
  } catch (e) {
    // ignore
  }
} catch (e) {
  // ignore if three not yet available
}
