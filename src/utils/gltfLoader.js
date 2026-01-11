import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

// Returns a GLTFLoader configured with a LoadingManager that safely
// supplies a 1x1 transparent placeholder for blob: URLs and common image
// extensions to avoid "Couldn't load texture blob:" errors when blobs
// are revoked or unavailable.
export function createSafeGLTFLoader(managerOverride = null) {
  const manager = managerOverride || new THREE.LoadingManager();

  class NullTextureLoader extends THREE.TextureLoader {
    constructor(mgr) { super(mgr); }
    load(url, onLoad, onProgress, onError) {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 1; canvas.height = 1;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = 'rgba(0,0,0,0)'; ctx.fillRect(0,0,1,1);
        const tex = new THREE.Texture(canvas);
        tex.encoding = THREE.sRGBEncoding;
        tex.needsUpdate = true;
        if (onLoad) setTimeout(() => onLoad(tex), 0);
        return tex;
      } catch (e) {
        if (onError) setTimeout(() => onError(e), 0);
        return null;
      }
    }
  }

  // Use null loader for blob: and common image extensions
  manager.addHandler(/blob:/, new NullTextureLoader(manager));
  manager.addHandler(/\.(jpg|jpeg|png|gif|bmp|tga|dds|ktx|ktx2|webp)$/i, new NullTextureLoader(manager));

  const loader = new GLTFLoader(manager);
  try { loader.setCrossOrigin('anonymous'); } catch (e) {}
  try { if (typeof MeshoptDecoder !== 'undefined' && MeshoptDecoder) loader.setMeshoptDecoder(MeshoptDecoder); } catch (e) {}

  return loader;
}

export default createSafeGLTFLoader;
