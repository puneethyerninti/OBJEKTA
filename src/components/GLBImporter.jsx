// src/components/GLBImporter.jsx
import * as THREE from "three";
import createSafeGLTFLoader from "../utils/gltfLoader";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader";
import { unzipSync } from "three/examples/jsm/libs/fflate.module.js";
import { OBJLoader } from "three-stdlib";
import { FBXLoader } from "three-stdlib";
import EventBus from "../utils/EventBus";
import BlobURLManager from "../utils/BlobURLManager";
import { generateThumbnail } from "../utils/thumbnailGenerator";

/**
 * initGLBImporter({ scene, domElement, onLoad })
 * - onLoad(gltf, url/file) when model loaded
 * returns { dispose, loadFromFile, enableDragDrop, disableDragDrop }
 */
export function initGLBImporter({ scene, domElement, onLoad = () => {}, normalizeOptions = { alignToGround: true, maxDimension: 10 } } = {}) {
  if (!scene || !domElement) throw new Error("scene and domElement required");

  const loadingManager = new THREE.LoadingManager();
  const missingResources = new Set();
  loadingManager.onError = (url) => {
    if (url) missingResources.add(url);
  };
  const loader = createSafeGLTFLoader(loadingManager);
  try {
    const draco = new DRACOLoader();
    // you might need to set decoder path depending on setup:
    // draco.setDecoderPath('/draco/');
    loader.setDRACOLoader(draco);
  } catch (e) { /* DRACO optional */ }

  // lightweight fallback for KHR_materials_pbrSpecularGlossiness (common in older DCC exports)
  loader.register((parser) => new KHRSpecularGlossinessFallback(parser));

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
    // Normalize texture color spaces & clamp overly saturated blue hues to neutralize tint
    normalizeMaterialsAsync(root);
    const stats = analyzeAndOptimize(root);
    // Normalize unreliable GLB pivots/units so imports land predictably at the origin
    normalizeModel(root, normalizeOptions);
    scene.add(root);
    activeModel = root;

    if (missingResources.size > 0) {
      console.warn('[GLBImporter] Missing external resources:', Array.from(missingResources));
      root.userData.__missingResources = Array.from(missingResources);
      missingResources.clear();
    }

    onLoad(gltf, meta, stats);

    // Auto-generate thumbnail
    try {
      const thumb = generateThumbnail(root);
      if (thumb) {
        root.userData.__thumbnail = thumb;
        EventBus.emit?.('import:thumbnail', { thumbnail: thumb, name: meta?.name || 'model' });
      }
    } catch (e) { /* thumbnail generation optional */ }
  }

  function reportImportError(err, context = 'import', extra = {}) {
    const message = typeof err === 'string' ? err : err?.message || 'Import failed';
    console.error('[GLBImporter] Import failed:', message, err);
    const payload = { message, context, ...extra };
    if (missingResources.size) {
      payload.missing = Array.from(missingResources);
      try { EventBus.emit?.('import:missingResources', payload.missing); } catch (e) {}
      missingResources.clear();
    }
    try { EventBus.emit?.('import:error', payload); } catch (e) {}
  }

  async function loadFromZip(file) {
    let archive;
    try {
      const buffer = await file.arrayBuffer();
      archive = unzipSync(new Uint8Array(buffer));
    } catch (err) {
      reportImportError(err, file?.name || 'zip', { hint: 'Unable to unpack .zip. Make sure it is not password protected.' });
      return;
    }
    const entries = Object.keys(archive || {}).filter((name) => !name.endsWith('/'));
    if (!entries.length) {
      reportImportError('Zip archive is empty', file?.name);
      return;
    }
    const glbEntry = entries.find((name) => /\.glb$/i.test(name));
    if (glbEntry) {
      const blob = new Blob([archive[glbEntry]], { type: 'model/gltf-binary' });
      const url = BlobURLManager.create(blob);
      loader.load(
        url,
        (gltf) => {
          _addToScene(gltf, file);
          scheduleCleanupObjectURLs([url]);
        },
        null,
        (err) => {
          scheduleCleanupObjectURLs([url]);
          reportImportError(err, glbEntry);
        }
      );
      return;
    }
    const gltfEntry = entries.find((name) => /\.gltf$/i.test(name));
    if (!gltfEntry) {
      reportImportError('Zip must contain a .gltf or .glb file', file?.name);
      return;
    }
    const resourceURLs = new Map();
    const urlsToCleanup = [];
    const registerEntry = (entryName) => {
      if (entryName === gltfEntry) return;
      const data = archive[entryName];
      if (!data) return;
      const blob = new Blob([data], { type: guessMimeType(entryName) });
      const url = BlobURLManager.create(blob);
      urlsToCleanup.push(url);
      const normalized = normalizeResourceKey(entryName);
      resourceURLs.set(normalized, url);
      const base = normalized.split('/').pop();
      if (base) resourceURLs.set(base, url);
    };
    entries.forEach(registerEntry);

    const gltfBlob = new Blob([archive[gltfEntry]], { type: 'model/gltf+json' });
    const gltfUrl = BlobURLManager.create(gltfBlob);
    urlsToCleanup.push(gltfUrl);
    const manager = loader.manager;
    const previousModifier = manager?.urlModifier || null;
    if (manager && typeof manager.setURLModifier === 'function') {
      manager.setURLModifier((url) => {
        const normalized = normalizeResourceKey(url);
        return resourceURLs.get(normalized) || resourceURLs.get(normalized.split('/').pop()) || url;
      });
    }
    loader.load(
      gltfUrl,
      (gltf) => {
        if (manager && typeof manager.setURLModifier === 'function') manager.setURLModifier(previousModifier || null);
        scheduleCleanupObjectURLs(urlsToCleanup);
        _addToScene(gltf, file);
      },
      null,
      (err) => {
        if (manager && typeof manager.setURLModifier === 'function') manager.setURLModifier(previousModifier || null);
        scheduleCleanupObjectURLs(urlsToCleanup);
        reportImportError(err, file?.name, { hint: 'Double-check that textures and buffers are included inside the .zip.' });
      }
    );
  }

  function loadFromURL(url) {
    try {
      if (typeof url === 'string') {
        const base = url.replace(/[^/]*$/, '');
        if (base && base !== url) loader.setResourcePath(base);
      }
    } catch (e) {}
    loader.load(
      url,
      (gltf) => _addToScene(gltf, url),
      null,
      (err) => {
        reportImportError(err, typeof url === 'string' ? url : 'remote-url');
      }
    );
  }

  async function loadFromFile(file) {
    if (!file) return;
    if (/\.zip$/i.test(file.name)) {
      return loadFromZip(file);
    }
    // OBJ import
    if (/\.obj$/i.test(file.name)) {
      const text = await file.text();
      try {
        const objLoader = new OBJLoader();
        const group = objLoader.parse(text);
        _addToScene({ scene: group }, file);
      } catch (err) { reportImportError(err, file.name); }
      return;
    }
    // FBX import
    if (/\.fbx$/i.test(file.name)) {
      const buf = await file.arrayBuffer();
      try {
        const fbxLoader = new FBXLoader();
        const group = fbxLoader.parse(buf, '');
        _addToScene({ scene: group }, file);
      } catch (err) { reportImportError(err, file.name); }
      return;
    }
    const url = BlobURLManager.create(file);
    if (/\.gltf$/i.test(file.name)) {
      console.warn('[GLBImporter] Detected .gltf file with potential external resources. Please ensure textures/buffers are embedded (.glb) to avoid 404 errors.');
      try {
        EventBus.emit?.('import:warning', { message: 'This .gltf expects external textures/buffers. Drop a .zip with all files or convert to .glb for best results.' });
      } catch (e) {}
    }
    loader.load(
      url,
      (gltf) => {
        _addToScene(gltf, file);
        scheduleCleanupObjectURLs([url]);
      },
      null,
      (err) => {
        scheduleCleanupObjectURLs([url]);
        reportImportError(err, file?.name);
      }
    );
  }

  // drag-drop
  let _ondrop = null;
  function enableDragDrop() {
    if (_ondrop) return;
    function onDrop(e) {
      e.preventDefault();
      const files = Array.from(e.dataTransfer.files || []);
      const archive = files.find(f => /\.zip$/i.test(f.name));
      if (archive) {
        loadFromFile(archive);
        return;
      }
      const glb = files.find(f => /\.(gltf|glb|obj|fbx)$/i.test(f.name));
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
// Expose for tests and controlled normalization scenarios
export { normalizeModel };

// ---------- helpers ----------

// Normalize imported models so they arrive at the origin with a sensible pivot and ground contact.
// Many DCC exports ship with arbitrary pivots/units, so we normalize once on import
// to keep scenes predictable without moving the camera to compensate.
function normalizeModel(root, { alignToGround = true, maxDimension = 10 } = {}) {
  // Idempotent: mark roots to avoid repeated shifts if re-used.
  if (!root || root.userData?._normalized) return null;

  // Inspect original bounds first
  const initialBox = new THREE.Box3().setFromObject(root);

  // Uniformly scale down extreme assets
  const size = initialBox.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z, 0);
  if (maxDim > maxDimension) {
    const s = maxDimension / maxDim;
    root.scale.setScalar(s);
  }

  // Center pivot after final scale so translation stays correct
  const centeredBox = new THREE.Box3().setFromObject(root);
  if (!centeredBox.isEmpty()) {
    const center = centeredBox.getCenter(new THREE.Vector3());
    root.position.sub(center);
  }

  // Recompute after transform to optionally sit on the ground plane
  if (alignToGround) {
    const groundedBox = new THREE.Box3().setFromObject(root);
    if (!groundedBox.isEmpty()) {
      const lift = -groundedBox.min.y;
      if (Number.isFinite(lift)) root.position.y += lift;
    }
  }

  // Mark to avoid repeated normalization if the same root is re-used
  root.userData._normalized = true;

  return root;
}

function scheduleCleanupObjectURLs(list = [], delay = 3000) {
  try {
    if (!Array.isArray(list) || list.length === 0) return;
    setTimeout(() => {
      list.forEach((url) => {
        try { BlobURLManager.release(url); } catch (e) { console.warn('[GLBImporter] delayed url release failed', e); }
      });
    }, delay);
  } catch (e) {}
}

// Chunked material normalization to avoid long tasks during import
function normalizeMaterialsAsync(root) {
  if (!root) return;
  const queue = [root];
  const processChunk = () => {
    const start = performance.now();
    while (queue.length > 0 && performance.now() - start < 8) {
      const obj = queue.shift();
      if (!obj) continue;
      try {
        if (obj.children && obj.children.length) queue.push(...obj.children);
      } catch (e) { console.warn('[GLBImporter] normalize queue expand failed', e); }
      try {
        if (obj.isMesh) {
          const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
          mats.forEach((m) => {
            if (!m) return;
            if (m.map && m.map.colorSpace && m.map.colorSpace !== THREE.SRGBColorSpace) {
              try { m.map.colorSpace = THREE.SRGBColorSpace; m.map.needsUpdate = true; } catch (e) { console.warn('[GLBImporter] map colorspace normalize failed', e); }
            }
            if (m.emissive && m.emissive.isColor) {
              const emissiveHex = m.emissive.getHex();
              if (emissiveHex === 0x0000ff) m.emissive.multiplyScalar(0.25);
            }
            if (m.color && m.color.isColor) {
              const hsl = { h:0, s:0, l:0 };
              m.color.getHSL(hsl);
              if (hsl.h > 0.55 && hsl.h < 0.75 && hsl.s > 0.5) {
                m.color.setHSL(hsl.h, hsl.s * 0.6, Math.min(1, hsl.l * 1.05));
              }
            }
          });
        } else if (obj.isTexture && obj.colorSpace && obj.colorSpace !== THREE.SRGBColorSpace) {
          try { obj.colorSpace = THREE.SRGBColorSpace; obj.needsUpdate = true; } catch (e) { console.warn('[GLBImporter] texture colorspace normalize failed', e); }
        }
      } catch (err) {
        console.error('[GLBImporter] material normalize error', err);
      }
    }
    if (queue.length > 0) {
      if (typeof window !== 'undefined' && window.requestIdleCallback) {
        window.requestIdleCallback(processChunk, { timeout: 32 });
      } else {
        setTimeout(processChunk, 0);
      }
    }
  };
  processChunk();
}

function normalizeResourceKey(value = "") {
  return value
    .replace(/https?:\/\//i, '')
    .replace(/^[.\\/]+/, '')
    .replace(/\\/g, '/')
    .split('?')[0]
    .trim();
}

function guessMimeType(name = "") {
  const lower = name.toLowerCase();
  if (lower.endsWith('.bin')) return 'application/octet-stream';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.ktx2')) return 'image/ktx2';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.gltf')) return 'model/gltf+json';
  if (lower.endsWith('.glb')) return 'model/gltf-binary';
  return 'application/octet-stream';
}

const TEXEL_LIMIT = 80_000_000; // ~80 megapixels total before we start clamping
const TRI_LIMIT = 4_000_000;

function analyzeAndOptimize(root) {
  const stats = { meshes: 0, triangles: 0, textures: 0, totalTexels: 0, downscaled: 0 };
  const seenTextures = new Set();
  root.traverse((obj) => {
    if (obj.isMesh) {
      stats.meshes++;
      const geom = obj.geometry;
      if (geom) {
        const triCount = geom.index ? Math.round(geom.index.count / 3) : Math.round(geom.attributes?.position?.count / 3) || 0;
        stats.triangles += triCount;
      }
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      mats.forEach((m) => {
        if (!m) return;
        ['map','normalMap','metalnessMap','roughnessMap','emissiveMap'].forEach((slot) => {
          const tex = m[slot];
          if (tex && !seenTextures.has(tex)) {
            seenTextures.add(tex);
            const dims = getTextureDimensions(tex);
            if (dims.pixels > 0) {
              stats.textures++;
              stats.totalTexels += dims.pixels;
            }
          }
        });
      });
    }
  });

  if (stats.totalTexels > TEXEL_LIMIT) {
    const ratio = Math.sqrt(TEXEL_LIMIT / stats.totalTexels);
    const maxDim = Math.max(1024, Math.round(4096 * ratio));
    seenTextures.forEach((tex) => {
      if (downscaleTexture(tex, maxDim)) stats.downscaled++;
    });
  }

  if (stats.triangles > TRI_LIMIT) {
    // set flag to hint workspace to lower resolution (handled in Workspace dynamic scaler already)
    root.userData.__heavyGeometry = true;
  }

  root.userData.__importStats = stats;
  console.log('[GLBImporter] import stats', stats);
  return stats;
}

function getTextureDimensions(texture) {
  try {
    const img = texture.image;
    if (!img) return { width: 0, height: 0, pixels: 0 };
    const width = img.width || img.videoWidth || img.naturalWidth || 0;
    const height = img.height || img.videoHeight || img.naturalHeight || 0;
    return { width, height, pixels: width * height };
  } catch (e) { return { width: 0, height: 0, pixels: 0 }; }
}

function downscaleTexture(texture, maxDim = 2048) {
  try {
    if (texture.isCompressedTexture || !texture.image || texture.image.data) return false;
    const dims = getTextureDimensions(texture);
    const largest = Math.max(dims.width, dims.height);
    if (!largest || largest <= maxDim) return false;
    const scale = maxDim / largest;
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(dims.width * scale));
    canvas.height = Math.max(1, Math.round(dims.height * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) return false;
    ctx.drawImage(texture.image, 0, 0, canvas.width, canvas.height);
    texture.image = canvas;
    texture.needsUpdate = true;
    texture.generateMipmaps = true;
    texture.anisotropy = Math.min(4, texture.anisotropy || 1);
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    return true;
  } catch (e) {
    return false;
  }
}

class KHRSpecularGlossinessFallback {
  constructor(parser) {
    this.parser = parser;
    this.name = 'KHR_materials_pbrSpecularGlossiness';
  }

  getMaterialType(materialIndex) {
    const material = this.parser.json.materials?.[materialIndex];
    if (material?.extensions?.[this.name]) {
      return THREE.MeshPhysicalMaterial;
    }
    return null;
  }

  extendMaterialParams(materialIndex, materialParams) {
    const material = this.parser.json.materials?.[materialIndex];
    if (!material?.extensions?.[this.name]) return null;
    const ext = material.extensions[this.name];
    const pending = [];
    if (ext.diffuseFactor) {
      const c = new THREE.Color().fromArray(ext.diffuseFactor);
      materialParams.color = c;
      materialParams.opacity = ext.diffuseFactor[3] ?? 1;
      if (materialParams.opacity < 1) materialParams.transparent = true;
    }
    if (ext.specularFactor) {
      const max = Math.max(ext.specularFactor[0], ext.specularFactor[1], ext.specularFactor[2]);
      materialParams.metalness = Math.min(1, max);
    }
    if (typeof ext.glossinessFactor === 'number') {
      materialParams.roughness = 1 - ext.glossinessFactor;
    }
    if (ext.diffuseTexture) {
      pending.push(this.parser.assignTexture(materialParams, 'map', ext.diffuseTexture));
    }
    if (ext.specularGlossinessTexture) {
      pending.push(this.parser.assignTexture(materialParams, 'metalnessMap', ext.specularGlossinessTexture));
      pending.push(this.parser.assignTexture(materialParams, 'roughnessMap', ext.specularGlossinessTexture));
    }
    return Promise.all(pending);
  }
}
