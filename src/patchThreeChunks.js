import * as THREE from "three";

// Patch Three.js shader chunk names for legacy/newer mixes.
// If a dependency expects colorspace_* chunks but Three provides encodings_*, alias them.
const shaderChunk = THREE?.ShaderChunk;
if (shaderChunk) {
  if (!shaderChunk.colorspace_fragment && shaderChunk.encodings_fragment) {
    shaderChunk.colorspace_fragment = shaderChunk.encodings_fragment;
  }
  if (!shaderChunk.colorspace_pars_fragment && shaderChunk.encodings_pars_fragment) {
    shaderChunk.colorspace_pars_fragment = shaderChunk.encodings_pars_fragment;
  }
}

// Backwards compatibility shims for Three.js API renames.
if (THREE?.WebGLRenderer) {
  try {
    Object.defineProperty(THREE.WebGLRenderer.prototype, "outputEncoding", {
      configurable: true,
      enumerable: false,
      get() {
        return this.outputColorSpace !== undefined ? this.outputColorSpace : this._outputEncoding;
      },
      set(value) {
        this._outputEncoding = value;
        if (this.outputColorSpace !== undefined) {
          this.outputColorSpace = value;
        }
      },
    });
  } catch {
    // No-op: property may be non-configurable in some runtime variants.
  }
}

if (THREE?.Texture) {
  try {
    Object.defineProperty(THREE.Texture.prototype, "encoding", {
      configurable: true,
      enumerable: false,
      get() {
        return this.colorSpace !== undefined ? this.colorSpace : this._encoding;
      },
      set(value) {
        this._encoding = value;
        if (this.colorSpace !== undefined) {
          this.colorSpace = value;
        }
      },
    });
  } catch {
    // No-op: property may be non-configurable in some runtime variants.
  }
}
