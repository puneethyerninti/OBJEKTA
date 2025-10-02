// src/components/EnvironmentSetup.jsx
import * as THREE from "three";
import { RGBELoader } from "three/examples/jsm/loaders/RGBELoader";
import { PMREMGenerator } from "three/examples/jsm/pmrem/PMREMGenerator";

/**
 * setupEnvironment({ scene, renderer })
 * returns { setHDR, setBackgroundColor, dispose }
 */
export function setupEnvironment({ scene, renderer }) {
  if (!scene || !renderer) throw new Error("scene and renderer required");

  const pmremGen = new PMREMGenerator(renderer);
  pmremGen.compileEquirectangularShader && pmremGen.compileEquirectangularShader();
  const rgbe = new RGBELoader();
  let currentEnv = null;

  async function setHDR(url) {
    if (!url) {
      if (currentEnv) { try { currentEnv.dispose(); } catch (e) {} currentEnv = null; scene.environment = null; scene.background = null; }
      return null;
    }
    return new Promise((resolve, reject) => {
      rgbe.load(url, (hdr) => {
        try {
          const env = pmremGen.fromEquirectangular(hdr).texture;
          if (currentEnv && typeof currentEnv.dispose === "function") currentEnv.dispose();
          currentEnv = env;
          scene.environment = env;
          scene.background = env;
          hdr.dispose && hdr.dispose();
          resolve(env);
        } catch (e) { reject(e); }
      }, undefined, (err) => reject(err));
    });
  }

  function setBackgroundColor(hexOrColor) {
    try {
      scene.background = new THREE.Color(hexOrColor);
    } catch (e) { console.warn("setBackgroundColor failed", e); }
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
