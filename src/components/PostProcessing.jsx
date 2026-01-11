// src/components/PostProcessing.jsx
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass";

/**
 * setupPostProcessing({ renderer, scene, camera, width, height, options })
 * returns { composer, render(delta), setSize(w,h), dispose() }
 */
export function setupPostProcessing({ renderer, scene, camera, width = 800, height = 600, options = {} } = {}) {
  if (!renderer || !scene || !camera) throw new Error("renderer, scene, camera required");

  let composer;
  // selective bloom helpers
  const BLOOM_LAYER = 11; // arbitrary layer index for bloom-enabled objects
  const bloomLayers = new THREE.Layers();
  bloomLayers.set(BLOOM_LAYER); // precompute mask once
  const darkMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 });
  const materialsCache = new Map();
  let bloomPass;
  try {
    composer = new EffectComposer(renderer);
    composer.setSize(width, height);

    const renderPass = new RenderPass(scene, camera);
    composer.addPass(renderPass);

    // bloom params
    const strength = options.bloomStrength ?? 0.8;
    const radius = options.bloomRadius ?? 0.5;
    const threshold = options.bloomThreshold ?? 0.9;

    // UnrealBloomPass expects a Vector2 resolution first arg
    bloomPass = new UnrealBloomPass(new THREE.Vector2(width, height), strength, radius, threshold);
    composer.addPass(bloomPass);

  } catch (err) {
    // If any import/constructor fails, return a noop wrapper so app continues
    console.warn("PostProcessing init failed:", err);
    return {
      composer: null,
      render: () => {},
      setSize: () => {},
      dispose: () => {},
    };
  }

  let failureCount = 0;

  function render(delta) {
    if (!composer) return; // safety

    // Guard against zero / near-zero size render targets causing incomplete framebuffer errors
    try {
      const size = renderer.getSize(new THREE.Vector2());
      if (size.x < 2 || size.y < 2) return;
      try {
        const rb = composer.readBuffer;
        if (rb && (rb.width !== size.x || rb.height !== size.y)) composer.setSize(size.x, size.y);
      } catch (e) {}
    } catch (e) {}

    // Determine if any bloom objects exist; if none, skip selective replacement pass
    let hasBloomObjects = false;
    if (options.selectiveBloom) {
      try {
        scene.traverse((o) => {
          if (hasBloomObjects) return;
          if (o && o.isMesh && (o.userData.__bloom || (o.layers && (o.layers.mask & bloomLayers.mask) !== 0))) {
            hasBloomObjects = true;
          }
        });
      } catch (e) {}
    }

    if (options.selectiveBloom && hasBloomObjects) {
      // Temporarily swap materials for non-bloom objects
      scene.traverse((obj) => {
        if (!obj || !obj.isMesh) return;
        const isBloom = obj.userData.__bloom || (obj.layers && (obj.layers.mask & bloomLayers.mask) !== 0);
        if (!isBloom) {
          if (!materialsCache.has(obj)) materialsCache.set(obj, obj.material);
          obj.material = darkMaterial;
        }
      });
      let ok = true;
      try { composer.render(delta); } catch (e) { ok = false; console.warn("[PostProcessing] composer.render failed", e); }
      // Restore materials
      scene.traverse((obj) => {
        if (obj && obj.isMesh && materialsCache.has(obj)) obj.material = materialsCache.get(obj);
      });
      materialsCache.clear();
      if (!ok) {
        renderer.__lastBloomFailed = true;
        failureCount++;
        if (failureCount > 5) {
          options.selectiveBloom = false;
          console.warn("[PostProcessing] selectiveBloom disabled after repeated failures");
        }
      } else {
        renderer.__lastBloomFailed = false;
        if (failureCount > 0) failureCount = 0;
      }
    } else {
      // No bloom objects; render normally (prevents unintentional black materials)
      try { composer.render(delta); } catch (e) { console.warn("[PostProcessing] composer.render failed", e); }
    }
  }

  function setSize(w, h) {
    composer.setSize(w, h);
    // some passes may need their own resize
    try { if (composer.passes) composer.passes.forEach(p => p.setSize && p.setSize(w, h)); } catch (e) {}
  }

  function dispose() {
    try {
      composer.passes?.forEach(p => { try { p.dispose && p.dispose(); } catch(e) {} });
      composer?.dispose && composer.dispose();
    } catch (e) {}
  }

  function tagForBloom(object, enable = true) {
    if (!object || !object.layers) return;
    try {
      object.userData.__bloom = !!enable;
      if (enable) object.layers.enable(BLOOM_LAYER); else object.layers.disable(BLOOM_LAYER);
    } catch (e) {}
  }

  return { composer, render, setSize, dispose, tagForBloom, BLOOM_LAYER, bloomPass };
}

export default setupPostProcessing;
