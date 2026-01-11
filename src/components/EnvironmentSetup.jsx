// src/components/EnvironmentSetup.jsx
import * as THREE from "three";
import { RGBELoader } from "three/examples/jsm/loaders/RGBELoader.js";
import { EXRLoader } from "three/examples/jsm/loaders/EXRLoader.js";
// PMREMGenerator is part of three core
// no need to import from examples
// import { PMREMGenerator } from "three"; // optional, already in THREE

/**
 * setupEnvironment({ scene, renderer })
 * returns { setHDR, setBackgroundColor, dispose }
 */
export function setupEnvironment({ scene, renderer }) {
  if (!scene || !renderer) throw new Error("scene and renderer required");

  const pmremGen = new THREE.PMREMGenerator(renderer);
  pmremGen.compileEquirectangularShader && pmremGen.compileEquirectangularShader();

  const rgbeLoader = new RGBELoader();
  const exrLoader = new EXRLoader();
  let currentEnv = null;

  async function setHDR(url) {
    if (!url) {
      if (currentEnv) {
        try { currentEnv.dispose(); } catch (e) {}
        currentEnv = null;
        scene.environment = null;
        scene.background = null;
      }
      return null;
    }
    const lower = url.toLowerCase();
    const isEXR = lower.endsWith('.exr');

    return new Promise((resolve, reject) => {
      const loader = isEXR ? exrLoader : rgbeLoader;
      loader.load(url, (tex) => {
        try {
          // Ensure mapping for equirectangular input (EXR may not set automatically)
          if (tex && tex.mapping !== THREE.EquirectangularReflectionMapping) {
            tex.mapping = THREE.EquirectangularReflectionMapping;
          }
          if (tex && tex.isDataTexture && typeof tex.flipY === 'boolean') {
            // DataTextures from EXR often need flipY=false
            tex.flipY = false;
          }
          const envTex = pmremGen.fromEquirectangular(tex).texture;
          if (currentEnv && typeof currentEnv.dispose === 'function') {
            try { currentEnv.dispose(); } catch (e) {}
          }
            currentEnv = envTex;
            scene.environment = envTex;
            scene.background = envTex; // background for immediate visual feedback
            if (tex.dispose) try { tex.dispose(); } catch (e) {}
            resolve(envTex);
        } catch (e) { reject(e); }
      }, undefined, (err) => reject(err));
    });
  }

  function setBackgroundColor(hexOrColor) {
    try {
      scene.background = new THREE.Color(hexOrColor);
    } catch (e) {
      console.warn("setBackgroundColor failed", e);
    }
  }

  function dispose() {
    try {
      if (currentEnv) { try { currentEnv.dispose(); } catch (e) {} currentEnv = null; }
      pmremGen.dispose();
    } catch (e) {}
  }

  return { setHDR, setBackgroundColor, dispose };
}

export default setupEnvironment;
