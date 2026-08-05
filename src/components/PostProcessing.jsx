// src/components/PostProcessing.jsx
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass";
import { FXAAShader } from "three/examples/jsm/shaders/FXAAShader";
import { SAOPass } from "three/examples/jsm/postprocessing/SAOPass.js";
import { BokehPass } from "three/examples/jsm/postprocessing/BokehPass.js";
import { OutlinePass } from "three/examples/jsm/postprocessing/OutlinePass.js";
import { applyToneMapping } from "../engine/PostFXManager.js";

/* ── Vignette shader ─────────────────────────────────────────────── */
const VignetteShader = {
  uniforms: {
    tDiffuse: { value: null },
    darkness: { value: 0.5 },
    offset: { value: 0.5 },
  },
  vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float darkness;
    uniform float offset;
    varying vec2 vUv;
    void main(){
      vec4 texel=texture2D(tDiffuse,vUv);
      float d=distance(vUv,vec2(0.5));
      texel.rgb*=smoothstep(0.8,offset*0.799,d*(darkness+offset));
      gl_FragColor=texel;
    }`,
};

/* ── Film Grain shader ───────────────────────────────────────────── */
const FilmGrainShader = {
  uniforms: {
    tDiffuse: { value: null },
    intensity: { value: 0.15 },
    time: { value: 0.0 },
  },
  vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float intensity;
    uniform float time;
    varying vec2 vUv;
    float rand(vec2 co){ return fract(sin(dot(co,vec2(12.9898,78.233)))*43758.5453); }
    void main(){
      vec4 texel=texture2D(tDiffuse,vUv);
      float grain=rand(vUv+time)*2.0-1.0;
      texel.rgb+=grain*intensity;
      gl_FragColor=texel;
    }`,
};

/* ── Chromatic Aberration shader ─────────────────────────────────── */
const ChromaticAberrationShader = {
  uniforms: {
    tDiffuse: { value: null },
    offset: { value: 0.002 },
  },
  vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float offset;
    varying vec2 vUv;
    void main(){
      vec2 dir=vUv-vec2(0.5);
      float d=length(dir);
      vec2 o=dir*offset*d;
      float r=texture2D(tDiffuse,vUv+o).r;
      float g=texture2D(tDiffuse,vUv).g;
      float b=texture2D(tDiffuse,vUv-o).b;
      float a=texture2D(tDiffuse,vUv).a;
      gl_FragColor=vec4(r,g,b,a);
    }`,
};

/* ── Color Grading shader (brightness/contrast/saturation/hue) ─── */
const ColorGradingShader = {
  uniforms: {
    tDiffuse: { value: null },
    brightness: { value: 0.0 },
    contrast: { value: 0.0 },
    saturation: { value: 0.0 },
    hueShift: { value: 0.0 },
  },
  vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float brightness;
    uniform float contrast;
    uniform float saturation;
    uniform float hueShift;
    varying vec2 vUv;
    vec3 rgb2hsv(vec3 c){
      vec4 K=vec4(0.0,-1.0/3.0,2.0/3.0,-1.0);
      vec4 p=mix(vec4(c.bg,K.wz),vec4(c.gb,K.xy),step(c.b,c.g));
      vec4 q=mix(vec4(p.xyw,c.r),vec4(c.r,p.yzx),step(p.x,c.r));
      float d=q.x-min(q.w,q.y);
      float e=1.0e-10;
      return vec3(abs(q.z+(q.w-q.y)/(6.0*d+e)),d/(q.x+e),q.x);
    }
    vec3 hsv2rgb(vec3 c){
      vec4 K=vec4(1.0,2.0/3.0,1.0/3.0,3.0);
      vec3 p=abs(fract(c.xxx+K.xyz)*6.0-K.www);
      return c.z*mix(K.xxx,clamp(p-K.xxx,0.0,1.0),c.y);
    }
    void main(){
      vec4 texel=texture2D(tDiffuse,vUv);
      vec3 c=texel.rgb;
      c+=brightness;
      c=(c-0.5)*(contrast+1.0)+0.5;
      float lum=dot(c,vec3(0.2126,0.7152,0.0722));
      c=mix(vec3(lum),c,saturation+1.0);
      vec3 hsv=rgb2hsv(c);
      hsv.x=fract(hsv.x+hueShift/360.0);
      c=hsv2rgb(hsv);
      gl_FragColor=vec4(clamp(c,0.0,1.0),texel.a);
    }`,
};

/**
 * setupPostProcessing({ renderer, scene, camera, width, height, options })
 * returns { composer, render(delta), setSize(w,h), dispose(), updateEffects(cfg) }
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
  let bloomPass, vignettePass, filmGrainPass, chromaticPass, colorGradingPass, fxaaPass;
  let saoPass, bokehPass, outlinePass;
  let grainTime = 0;
  try {
    composer = new EffectComposer(renderer);
    composer.setSize(width, height);

    const renderPass = new RenderPass(scene, camera);
    composer.addPass(renderPass);

    // SAO (SSAO) — disabled by default
    saoPass = new SAOPass(scene, camera);
    saoPass.enabled = false;
    saoPass.params.saoBias = 0.025;
    saoPass.params.saoIntensity = 1.0;
    saoPass.params.saoScale = 0.5;
    saoPass.params.saoKernelRadius = 16;
    saoPass.params.saoBlurRadius = 4;
    composer.addPass(saoPass);

    // Bokeh (DOF) — disabled by default
    bokehPass = new BokehPass(scene, camera, {
      focus: 5.0,
      aperture: 0.025,
      maxblur: 0.01,
    });
    bokehPass.enabled = false;
    composer.addPass(bokehPass);

    // Outline (selection) — disabled by default
    outlinePass = new OutlinePass(new THREE.Vector2(width, height), scene, camera);
    outlinePass.enabled = false;
    outlinePass.visibleEdgeColor.set("#c084fc");
    outlinePass.hiddenEdgeColor.set("#c084fc");
    outlinePass.edgeThickness = 2.0;
    outlinePass.edgeStrength = 3.0;
    outlinePass.pulsePeriod = 0;
    composer.addPass(outlinePass);

    // bloom params
    const strength = options.bloomStrength ?? 0.8;
    const radius = options.bloomRadius ?? 0.5;
    const threshold = options.bloomThreshold ?? 0.9;

    // UnrealBloomPass expects a Vector2 resolution first arg
    bloomPass = new UnrealBloomPass(new THREE.Vector2(width, height), strength, radius, threshold);
    composer.addPass(bloomPass);

    // Chromatic aberration (disabled by default)
    chromaticPass = new ShaderPass(ChromaticAberrationShader);
    chromaticPass.enabled = false;
    composer.addPass(chromaticPass);

    // Color grading (disabled by default)
    colorGradingPass = new ShaderPass(ColorGradingShader);
    colorGradingPass.enabled = false;
    composer.addPass(colorGradingPass);

    // Film grain (disabled by default)
    filmGrainPass = new ShaderPass(FilmGrainShader);
    filmGrainPass.enabled = false;
    composer.addPass(filmGrainPass);

    // Vignette (disabled by default)
    vignettePass = new ShaderPass(VignetteShader);
    vignettePass.enabled = false;
    composer.addPass(vignettePass);

    // FXAA (always last, always enabled)
    // Some drivers warn when using extreme sample bias values (e.g. -100). Clamp to a safe range.
    const safeFXAAShader = { ...FXAAShader };
    try {
      if (typeof safeFXAAShader.fragmentShader === 'string') {
        // Replace occurrences of -100.0 bias used in some FXAA macros with -16.0 (safe range)
        safeFXAAShader.fragmentShader = safeFXAAShader.fragmentShader.replace(/-100\.0/g, '-16.0');
      }
    } catch (e) {
      // If replacement fails, fall back to original shader
      safeFXAAShader.fragmentShader = FXAAShader.fragmentShader;
    }
    fxaaPass = new ShaderPass(safeFXAAShader);
    fxaaPass.uniforms["resolution"].value.set(1 / width, 1 / height);
    composer.addPass(fxaaPass);

  } catch (err) {
    // If any import/constructor fails, return a noop wrapper so app continues
    console.warn("PostProcessing init failed:", err);
    return {
      composer: null,
      render: () => {},
      setSize: () => {},
      dispose: () => {},
      updateEffects: () => {},
    };
  }

  let failureCount = 0;

  function render(delta) {
    if (!composer) return; // safety

    // Advance grain time
    if (filmGrainPass && filmGrainPass.enabled) {
      grainTime += delta || 0.016;
      filmGrainPass.uniforms.time.value = grainTime;
    }

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
    if (fxaaPass) fxaaPass.uniforms["resolution"].value.set(1 / w, 1 / h);
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

  function setOutlineObjects(objects) {
    if (!outlinePass) return;
    try {
      outlinePass.selectedObjects = Array.isArray(objects) ? objects : objects ? [objects] : [];
    } catch (e) {}
  }

  /**
   * Update post-processing passes from PostFXManager config.
   * @param {object} cfg — config snapshot from PostFXManager.getConfig()
   */
  function updateEffects(cfg) {
    if (!cfg) return;
    try {
      // Bloom
      if (bloomPass && cfg.bloom) {
        bloomPass.enabled = cfg.bloom.enabled !== false;
        if (cfg.bloom.strength != null) bloomPass.strength = cfg.bloom.strength;
        if (cfg.bloom.radius != null) bloomPass.radius = cfg.bloom.radius;
        if (cfg.bloom.threshold != null) bloomPass.threshold = cfg.bloom.threshold;
      }
      // SSAO (SAOPass)
      if (saoPass && cfg.ssao) {
        saoPass.enabled = !!cfg.ssao.enabled;
        if (cfg.ssao.intensity != null) saoPass.params.saoIntensity = cfg.ssao.intensity;
        if (cfg.ssao.radius != null) saoPass.params.saoScale = cfg.ssao.radius;
        if (cfg.ssao.bias != null) saoPass.params.saoBias = cfg.ssao.bias;
        if (cfg.ssao.samples != null) saoPass.params.saoKernelRadius = cfg.ssao.samples;
      }
      // Depth of Field (BokehPass)
      if (bokehPass && cfg.dof) {
        bokehPass.enabled = !!cfg.dof.enabled;
        if (cfg.dof.focusDistance != null) bokehPass.uniforms["focus"].value = cfg.dof.focusDistance;
        if (cfg.dof.aperture != null) bokehPass.uniforms["aperture"].value = cfg.dof.aperture;
        if (cfg.dof.bokehScale != null) bokehPass.uniforms["maxblur"].value = cfg.dof.bokehScale * 0.005;
      }
      // Outline (selection)
      if (outlinePass && cfg.outline) {
        outlinePass.enabled = !!cfg.outline.enabled;
        if (cfg.outline.color != null) {
          outlinePass.visibleEdgeColor.set(cfg.outline.color);
          outlinePass.hiddenEdgeColor.set(cfg.outline.color);
        }
        if (cfg.outline.thickness != null) outlinePass.edgeThickness = cfg.outline.thickness;
        if (cfg.outline.strength != null) outlinePass.edgeStrength = cfg.outline.strength;
        outlinePass.pulsePeriod = cfg.outline.pulse ? (cfg.outline.pulseSpeed ?? 2.0) : 0;
      }
      // Vignette
      if (vignettePass && cfg.vignette) {
        vignettePass.enabled = !!cfg.vignette.enabled;
        if (cfg.vignette.darkness != null) vignettePass.uniforms.darkness.value = cfg.vignette.darkness;
        if (cfg.vignette.offset != null) vignettePass.uniforms.offset.value = cfg.vignette.offset;
      }
      // Film grain
      if (filmGrainPass && cfg.filmGrain) {
        filmGrainPass.enabled = !!cfg.filmGrain.enabled;
        if (cfg.filmGrain.intensity != null) filmGrainPass.uniforms.intensity.value = cfg.filmGrain.intensity;
      }
      // Chromatic aberration
      if (chromaticPass && cfg.chromaticAberration) {
        chromaticPass.enabled = !!cfg.chromaticAberration.enabled;
        if (cfg.chromaticAberration.offset != null) chromaticPass.uniforms.offset.value = cfg.chromaticAberration.offset;
      }
      // Color grading
      if (colorGradingPass && cfg.colorGrading) {
        colorGradingPass.enabled = !!cfg.colorGrading.enabled;
        if (cfg.colorGrading.brightness != null) colorGradingPass.uniforms.brightness.value = cfg.colorGrading.brightness;
        if (cfg.colorGrading.contrast != null) colorGradingPass.uniforms.contrast.value = cfg.colorGrading.contrast;
        if (cfg.colorGrading.saturation != null) colorGradingPass.uniforms.saturation.value = cfg.colorGrading.saturation;
        if (cfg.colorGrading.hueShift != null) colorGradingPass.uniforms.hueShift.value = cfg.colorGrading.hueShift;
      }
      // Tone mapping (applied to renderer, not a pass)
      if (cfg.toneMapping && renderer) {
        applyToneMapping(renderer);
      }
    } catch (e) {
      console.warn("[PostProcessing] updateEffects error:", e);
    }
  }

  return { composer, render, setSize, dispose, tagForBloom, setOutlineObjects, BLOOM_LAYER, bloomPass, saoPass, bokehPass, outlinePass, updateEffects };
}

export default setupPostProcessing;
