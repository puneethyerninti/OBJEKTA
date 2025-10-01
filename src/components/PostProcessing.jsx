// src/components/CameraControls.jsx
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";

/**
 * initCameraControls({ camera, domElement, autoRotate=false })
 * returns { controls, dispose, resetView, frameObject }
 *
 * Usage:
 *   const { controls, resetView, frameObject, dispose } = initCameraControls({ camera, domElement });
 */
export function initCameraControls({ camera, domElement, autoRotate = false, damping = 0.08 }) {
  if (!camera || !domElement) throw new Error("camera and domElement required");

  const controls = new OrbitControls(camera, domElement);
  controls.enableDamping = true;
  controls.dampingFactor = damping;
  controls.enablePan = true;
  controls.screenSpacePanning = false;
  controls.minDistance = 0.1;
  controls.maxDistance = 1000;
  controls.target.set(0, 0.7, 0);
  controls.update();
  controls.autoRotate = !!autoRotate;

  // convenience: store initial state for reset
  const initial = {
    position: camera.position.clone(),
    target: controls.target.clone(),
    zoom: camera.zoom,
  };

  function resetView({ position = null, target = null } = {}) {
    try {
      if (position && position.isVector3) camera.position.copy(position);
      else camera.position.copy(initial.position);

      if (target && target.isVector3) controls.target.copy(target);
      else controls.target.copy(initial.target);

      camera.updateProjectionMatrix();
      controls.update();
    } catch (e) { console.warn("resetView failed", e); }
  }

  // frameObject: move camera to fit an object (object3D)
  function frameObject(object3D, { padding = 1.2, duration = 0 } = {}) {
    if (!object3D) return;
    // compute world bbox
    const box = new THREE.Box3().setFromObject(object3D);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());

    // If object is a single point/empty, fallback
    const maxDim = Math.max(size.x, size.y, size.z, 0.0001);
    const fov = camera.fov * (Math.PI / 180);
    // distance from center needed to frame object
    const distance = Math.abs((maxDim * padding) / Math.sin(fov / 2));

    // move camera back along its forward vector
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir); // points -Z
    // position the camera so it's 'distance' units from center along -dir
    const newPos = center.clone().addScaledVector(dir, -distance);

    // apply
    if (duration > 0) {
      // small smooth interpolation (vanilla, no tween lib)
      const fromPos = camera.position.clone();
      const fromTarget = controls.target.clone();
      const start = performance.now();
      const tick = () => {
        const t = Math.min(1, (performance.now() - start) / duration);
        camera.position.lerpVectors(fromPos, newPos, t);
        controls.target.lerpVectors(fromTarget, center, t);
        controls.update();
        if (t < 1) requestAnimationFrame(tick);
      };
      tick();
    } else {
      camera.position.copy(newPos);
      controls.target.copy(center);
      controls.update();
    }
  }

  function dispose() {
    try {
      controls.dispose();
    } catch (e) {}
  }

  return { controls, resetView, frameObject, dispose };
}

export default initCameraControls;
