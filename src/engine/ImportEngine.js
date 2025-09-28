// src/engine/ImportEngine.js
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { SceneGraphStore } from "../store/SceneGraphStore";
import EventBus from "../utils/EventBus";

export const ImportEngine = {
  loader: new GLTFLoader(),

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
