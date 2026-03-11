// src/utils/thumbnailGenerator.js
import * as THREE from 'three';

/**
 * Generate a 256×256 thumbnail of a Three.js object.
 * Uses an offscreen WebGLRenderer to render from a preset angle.
 * Returns a data URL (image/png) or null on failure.
 */
export function generateThumbnail(object, size = 256) {
  if (!object) return null;
  try {
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setSize(size, size);
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    const scene = new THREE.Scene();
    const clone = object.clone(true);
    scene.add(clone);

    // Compute bounding box for framing
    const box = new THREE.Box3().setFromObject(clone);
    const center = box.getCenter(new THREE.Vector3());
    const bSize = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(bSize.x, bSize.y, bSize.z) || 1;

    // Camera: 45° angle from above-right
    const camera = new THREE.PerspectiveCamera(35, 1, 0.01, maxDim * 10);
    const dist = maxDim * 1.8;
    camera.position.set(center.x + dist * 0.7, center.y + dist * 0.5, center.z + dist * 0.7);
    camera.lookAt(center);

    // Basic lighting
    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const dir = new THREE.DirectionalLight(0xffffff, 0.8);
    dir.position.copy(camera.position);
    scene.add(dir);

    renderer.render(scene, camera);
    const dataUrl = renderer.domElement.toDataURL('image/png');

    renderer.dispose();
    return dataUrl;
  } catch (e) {
    console.warn('[thumbnailGenerator] Failed:', e);
    return null;
  }
}
