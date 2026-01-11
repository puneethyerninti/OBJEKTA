// src/engine/ImportEngine.js
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { SceneGraphStore } from "../store/SceneGraphStore";
import EventBus from "../utils/EventBus";

export const ImportEngine = {
  // Use a LoadingManager that gracefully handles blob: texture URLs
  loader: (() => {
    const manager = new THREE.LoadingManager();
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
    manager.addHandler(/blob:/, new NullTextureLoader(manager));
    manager.addHandler(/\.(jpg|jpeg|png|gif|bmp|tga|dds|ktx|ktx2|webp)$/i, new NullTextureLoader(manager));
    return new GLTFLoader(manager);
  })(),

  /**
   * Import a .glb/.gltf file from a File input
   */
  importFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (event) => {
        const arrayBuffer = event.target.result;

        this.loader.parse(
          arrayBuffer,
          "",
          (gltf) => {
            const root = gltf.scene || gltf.scenes[0];

            root.traverse((child) => {
              if (child.isMesh) {
                const id = THREE.MathUtils.generateUUID();
                const metadata = { name: child.name || "ImportedMesh" };
                SceneGraphStore.addObject(id, child, metadata);
              }
            });

            EventBus.emit("scene:updated", { type: "import" });
            resolve(root);
          },
          (error) => reject(error)
        );
      };

      reader.onerror = (err) => reject(err);
      reader.readAsArrayBuffer(file);
    });
  },

  /**
   * Import from a remote URL
   */
  importFromURL(url) {
    return new Promise((resolve, reject) => {
      this.loader.load(
        url,
        (gltf) => {
          const root = gltf.scene || gltf.scenes[0];

          root.traverse((child) => {
            if (child.isMesh) {
              const id = THREE.MathUtils.generateUUID();
              const metadata = { name: child.name || "ImportedMesh" };
              SceneGraphStore.addObject(id, child, metadata);
            }
          });

          EventBus.emit("scene:updated", { type: "import" });
          resolve(root);
        },
        undefined,
        (error) => reject(error)
      );
    });
  }
};
