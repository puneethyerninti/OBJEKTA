// src/components/GLBImporter.jsx
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader";

/**
 * initGLBImporter({ scene, domElement, onLoad })
 * - onLoad(gltf, url/file) when model loaded
 * returns { dispose, loadFromFile, enableDragDrop, disableDragDrop }
 */
export function initGLBImporter({ scene, domElement, onLoad = () => {} } = {}) {
  if (!scene || !domElement) throw new Error("scene and domElement required");

  const loader = new GLTFLoader();
  try {
    const draco = new DRACOLoader();
    // you might need to set decoder path depending on setup:
    // draco.setDecoderPath('/draco/');
    loader.setDRACOLoader(draco);
  } catch (e) { /* DRACO optional */ }

  let activeModel = null;

  function clearActiveModel() {
    if (!activeModel) return;
    try {
      scene.remove(activeModel);
      activeModel.traverse((c) => {
        if (c.isMesh) {
          c.geometry && c.geometry.dispose && c.geometry.dispose();
          if (Array.isArray(c.material)) c.material.forEach(m => m.dispose && m.dispose());
          else c.material && c.material.dispose && c.material.dispose();
        }
      });
    } catch (e) {}
    activeModel = null;
  }

  function _addToScene(gltf, meta) {
    clearActiveModel();
    const root = gltf.scene || gltf.scenes?.[0] || gltf;
    scene.add(root);
    activeModel = root;
    // orient/scaling: ensure at origin
    const box = new THREE.Box3().setFromObject(root);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    // center to origin
    root.position.sub(center);
    // simple auto-scale if huge
    const maxDim = Math.max(size.x, size.y, size.z, 1);
    if (maxDim > 10) {
      const s = 1 / maxDim;
      root.scale.setScalar(s);
    }
    onLoad(gltf, meta);
  }

  function loadFromURL(url) {
    loader.load(url, (gltf) => _addToScene(gltf, url), null, (err) => console.error("GLTF load error", err));
  }

  function loadFromFile(file) {
    const url = URL.createObjectURL(file);
    loader.load(url, (gltf) => {
      _addToScene(gltf, file);
      try { URL.revokeObjectURL(url); } catch (e) {}
    }, null, (err) => {
      console.error("GLTF load error", err);
    });
  }

  // drag-drop
  let _ondrop = null;
  function enableDragDrop() {
    if (_ondrop) return;
    function onDrop(e) {
      e.preventDefault();
      const files = Array.from(e.dataTransfer.files || []);
      const glb = files.find(f => /\.(gltf|glb)$/i.test(f.name));
      if (glb) loadFromFile(glb);
    }
    function onDragOver(e) { e.preventDefault(); }
    domElement.addEventListener("drop", onDrop);
    domElement.addEventListener("dragover", onDragOver);
    _ondrop = { onDrop, onDragOver };
  }

  function disableDragDrop() {
    if (!_ondrop) return;
    domElement.removeEventListener("drop", _ondrop.onDrop);
    domElement.removeEventListener("dragover", _ondrop.onDragOver);
    _ondrop = null;
  }

  function dispose() {
    disableDragDrop();
    clearActiveModel();
    try { loader.manager?.dispose && loader.manager.dispose(); } catch (e) {}
  }

  return { loadFromURL, loadFromFile, enableDragDrop, disableDragDrop, dispose, getActiveModel: () => activeModel };
}

export default initGLBImporter;
