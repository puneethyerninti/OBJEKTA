// src/engine/ExportEngine.js
import * as THREE from "three";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import { SceneGraphStore } from "../store/SceneGraphStore";

export const ExportEngine = {
  /**
   * Export the scene as GLTF/GLB
   * @param {boolean} binary - If true, exports as .glb (binary), otherwise .gltf (JSON)
   * @param {object} [animationEngine] - Optional AnimationEngine instance; if provided, baked animations are embedded
   */
  exportGLTF(binary = true, animationEngine = null) {
    const exporter = new GLTFExporter();
    const objects = SceneGraphStore.getObjects();

    const scene = new THREE.Scene();
    objects.forEach((obj) => scene.add(obj.clone()));

    const options = { binary };

    if (animationEngine && typeof animationEngine.toAnimationClip === 'function') {
      const clip = animationEngine.toAnimationClip(30);
      if (clip && clip.tracks.length > 0) {
        options.animations = [clip];
      }
    }

    exporter.parse(
      scene,
      (result) => {
        if (binary) {
          this._saveArrayBuffer(result, "scene.glb");
        } else {
          const output = JSON.stringify(result, null, 2);
          this._saveString(output, "scene.gltf");
        }
      },
      (error) => { console.error('GLTF export failed:', error); },
      options
    );
  },

  /**
   * Export the scene as JSON (Three.js format)
   */
  exportJSON() {
    const objects = SceneGraphStore.getObjects();
    const scene = new THREE.Scene();
    objects.forEach((obj) => scene.add(obj.clone()));

    const json = scene.toJSON();
    this._saveString(JSON.stringify(json, null, 2), "scene.json");
  },

  /**
   * Save string as file
   */
  _saveString(text, filename) {
    const blob = new Blob([text], { type: "text/plain" });
    this._downloadBlob(blob, filename);
  },

  /**
   * Save binary ArrayBuffer as file
   */
  _saveArrayBuffer(buffer, filename) {
    const blob = new Blob([buffer], { type: "application/octet-stream" });
    this._downloadBlob(blob, filename);
  },

  /**
   * Trigger download from blob
   */
  _downloadBlob(blob, filename) {
    const link = document.createElement("a");
    link.style.display = "none";
    document.body.appendChild(link);

    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();

    // Clean up
    setTimeout(() => {
      URL.revokeObjectURL(link.href);
      document.body.removeChild(link);
    }, 100);
  }
};
