import * as THREE from 'three';

let cachedNebulaTexture = null;

const buildNebulaTexture = () => {
  if (typeof document === 'undefined') return null;
  const size = 768;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  const core = ctx.createRadialGradient(size * 0.4, size * 0.44, size * 0.16, size * 0.52, size * 0.52, size * 0.72);
  core.addColorStop(0, 'rgba(138, 244, 255, 0.78)');
  core.addColorStop(0.3, 'rgba(104, 162, 255, 0.52)');
  core.addColorStop(0.74, 'rgba(28, 62, 150, 0.18)');
  core.addColorStop(1, 'rgba(6, 14, 32, 0)');
  ctx.fillStyle = core;
  ctx.fillRect(0, 0, size, size);

  const rim = ctx.createRadialGradient(size * 0.58, size * 0.46, size * 0.08, size * 0.46, size * 0.5, size * 0.86);
  rim.addColorStop(0, 'rgba(255, 122, 255, 0.14)');
  rim.addColorStop(0.5, 'rgba(90, 160, 255, 0.16)');
  rim.addColorStop(1, 'rgba(6, 14, 32, 0)');
  ctx.fillStyle = rim;
  ctx.fillRect(0, 0, size, size);

  // Soft noise overlay to avoid banding
  const noiseData = ctx.getImageData(0, 0, size, size);
  for (let i = 0; i < noiseData.data.length; i += 4) {
    const n = (Math.random() * 42) | 0;
    noiseData.data[i] += n * 0.6;
    noiseData.data[i + 1] += n * 0.85;
    noiseData.data[i + 2] += n + 14;
    noiseData.data[i + 3] = Math.min(255, noiseData.data[i + 3] + 14);
  }
  ctx.putImageData(noiseData, 0, 0);

  const tex = new THREE.CanvasTexture(canvas);
  tex.encoding = THREE.sRGBEncoding;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.repeat.set(1.0, 1.0);
  tex.needsUpdate = true;
  return tex;
};

export const getNebulaTexture = () => {
  if (cachedNebulaTexture) return cachedNebulaTexture;
  cachedNebulaTexture = buildNebulaTexture();
  return cachedNebulaTexture;
};
