// src/components/LightingSetup.jsx
import * as THREE from "three";
import { RGBELoader } from "three/examples/jsm/loaders/RGBELoader";
import { PMREMGenerator } from "three/examples/jsm/pmrem/PMREMGenerator";

const DEFAULT_DIR_POSITION = new THREE.Vector3(5, 10, 7.5);

/**
 * setupDefaultLighting(scene, renderer, { addHelpers=false })
 * returns { lights, setEnvFromEquirect, addDirectional, addAmbient, dispose }
 */
export function setupDefaultLighting(scene, renderer, opts = {}) {
  if (!scene || !renderer) throw new Error("scene and renderer required");

  const { addHelpers = false } = opts;
  const lights = {};

  // Ambient
  const amb = new THREE.AmbientLight(0xffffff, 0.45);
  amb.name = "_ambient_light";
  scene.add(amb);
  lights.ambient = amb;

  // Hemisphere
  const hemi = new THREE.HemisphereLight(0x606080, 0x202020, 0.35);
  hemi.name = "_hemi_light";
  scene.add(hemi);
  lights.hemisphere = hemi;

  // Directional (sun)
  const dir = new THREE.DirectionalLight(0xffffff, 0.8);
  dir.position.copy(DEFAULT_DIR_POSITION);
  dir.castShadow = true;
  dir.shadow.camera.left = -10;
  dir.shadow.camera.right = 10;
  dir.shadow.camera.top = 10;
  dir.shadow.camera.bottom = -10;
  dir.shadow.mapSize.set(2048, 2048);
  dir.name = "_dir_light";
  scene.add(dir);
  lights.directional = dir;

  // optional helpers
  let helpers = [];
  if (addHelpers) {
    try {
      const { DirectionalLightHelper, HemisphereLightHelper, CameraHelper } = THREE;
      const dh = new DirectionalLightHelper(dir, 1);
      scene.add(dh); helpers.push(dh);
      const hh = new HemisphereLightHelper(hemi, 0.5);
      scene.add(hh); helpers.push(hh);
      const ch = new CameraHelper(dir.shadow.camera);
      scene.add(ch); helpers.push(ch);
    } catch (e) { /* ignore */ }
  }

  // PMREM generator
  const pmremGen = new PMREMGenerator(renderer);
  pmremGen.compileEquirectangularShader && pmremGen.compileEquirectangularShader();

  // RGBE loader
  const rgbe = new RGBELoader();
  let currentEnvTexture = null;

  async function setEnvFromEquirect(url) {
    if (!url) {
      if (currentEnvTexture) {
        try { currentEnvTexture.dispose(); } catch (e) {}
        currentEnvTexture = null;
        scene.environment = null;
        scene.background = null;
      }
      return null;
    }

    return new Promise((resolve, reject) => {
      rgbe.load(url, (hdrMap) => {
        try {
          const envRT = pmremGen.fromEquirectangular(hdrMap).texture;
          if (currentEnvTexture && typeof currentEnvTexture.dispose === "function") currentEnvTexture.dispose();
          currentEnvTexture = envRT;
          scene.environment = envRT;
          scene.background = envRT;
          hdrMap.dispose && hdrMap.dispose();
          resolve(envRT);
        } catch (err) { reject(err); }
      }, undefined, (err) => reject(err));
    });
  }

  function addDirectional(opts = {}) {
    const color = opts.color ?? 0xffffff;
    const intensity = typeof opts.intensity === "number" ? opts.intensity : 1;
    const pos = opts.position ? opts.position.clone() : DEFAULT_DIR_POSITION.clone();
    const l = new THREE.DirectionalLight(color, intensity);
    l.position.copy(pos);
    l.castShadow = !!opts.castShadow;
    if (opts.name) l.name = opts.name;
    scene.add(l);
    return l;
  }

  function addAmbient(color = 0xffffff, intensity = 0.3) {
    const l = new THREE.AmbientLight(color, intensity);
    scene.add(l);
    return l;
  }

  function dispose() {
    try {
      Object.values(lights).forEach((l) => { if (l && l.parent) l.parent.remove(l); });
      if (currentEnvTexture) { try { currentEnvTexture.dispose(); } catch(e){} currentEnvTexture = null; }
      pmremGen.dispose();
      helpers.forEach(h => { if (h.parent) h.parent.remove(h); });
    } catch (e) {}
  }

  return {
    lights,
    setEnvFromEquirect,
    addDirectional,
    addAmbient,
    dispose,
  };
}

export default setupDefaultLighting;
