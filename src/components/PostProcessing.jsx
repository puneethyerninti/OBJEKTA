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
    const bloomPass = new UnrealBloomPass(new THREE.Vector2(width, height), strength, radius, threshold);
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

  function render(delta) {
    composer.render(delta);
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

  return { composer, render, setSize, dispose };
}

export default setupPostProcessing;
