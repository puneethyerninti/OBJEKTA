import * as THREE from 'three';

let cachedNebulaTexture = null;

const buildNebulaTexture = () => {
  if (typeof document === 'undefined') return null;
  const size = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  // Deeper, richer core glow
  const core = ctx.createRadialGradient(size * 0.42, size * 0.44, size * 0.08, size * 0.5, size * 0.5, size * 0.78);
  core.addColorStop(0, 'rgba(138, 244, 255, 0.62)');
  core.addColorStop(0.18, 'rgba(120, 180, 255, 0.48)');
  core.addColorStop(0.45, 'rgba(80, 120, 220, 0.28)');
  core.addColorStop(0.72, 'rgba(28, 62, 150, 0.12)');
  core.addColorStop(1, 'rgba(3, 6, 16, 0)');
  ctx.fillStyle = core;
  ctx.fillRect(0, 0, size, size);

  // Secondary warm accent glow for colour richness
  const warm = ctx.createRadialGradient(size * 0.6, size * 0.38, size * 0.05, size * 0.55, size * 0.45, size * 0.52);
  warm.addColorStop(0, 'rgba(180, 100, 255, 0.18)');
  warm.addColorStop(0.4, 'rgba(127, 90, 240, 0.1)');
  warm.addColorStop(1, 'rgba(6, 14, 32, 0)');
  ctx.fillStyle = warm;
  ctx.fillRect(0, 0, size, size);

  // Outer rim haze
  const rim = ctx.createRadialGradient(size * 0.56, size * 0.48, size * 0.08, size * 0.48, size * 0.5, size * 0.88);
  rim.addColorStop(0, 'rgba(255, 122, 255, 0.1)');
  rim.addColorStop(0.35, 'rgba(90, 160, 255, 0.12)');
  rim.addColorStop(0.7, 'rgba(40, 70, 160, 0.06)');
  rim.addColorStop(1, 'rgba(3, 6, 16, 0)');
  ctx.fillStyle = rim;
  ctx.fillRect(0, 0, size, size);

  // Soft noise overlay to avoid banding — gentler for seamless look
  const noiseData = ctx.getImageData(0, 0, size, size);
  for (let i = 0; i < noiseData.data.length; i += 4) {
    const n = (Math.random() * 28) | 0;
    noiseData.data[i] += n * 0.45;
    noiseData.data[i + 1] += n * 0.65;
    noiseData.data[i + 2] += n + 8;
    noiseData.data[i + 3] = Math.min(255, noiseData.data[i + 3] + 8);
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
