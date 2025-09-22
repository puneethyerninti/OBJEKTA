// src/effects/stars.js
import * as THREE from "three";

export default function initStars(canvasId = "three-canvas") {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  // Renderer
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  // Scene & Camera
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 3000);
  camera.position.set(0, 0, 400);
  scene.add(camera);

  // Star layers
  const layers = [
    { count: 1200, radius: 800, size: 1.2, speed: 0.002, hue: 250 },
    { count: 1800, radius: 1400, size: 0.8, speed: 0.0012, hue: 280 },
    { count: 2600, radius: 2200, size: 0.5, speed: 0.0006, hue: 300 },
  ];

  const starGroups = [];
  const tempColor = new THREE.Color();

  function createStarLayer({ count, radius, size, speed, hue }) {
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = radius * (0.8 + Math.random() * 0.4);

      positions[i * 3] = Math.sin(phi) * Math.cos(theta) * r;
      positions[i * 3 + 1] = Math.sin(phi) * Math.sin(theta) * r * 0.6;
      positions[i * 3 + 2] = Math.cos(phi) * r;

      const h = (hue + (Math.random() * 20 - 10)) / 360;
      const s = 0.5 + Math.random() * 0.2;
      const l = 0.6 + Math.random() * 0.15;

      tempColor.setHSL(h, s, l);
      colors[i * 3] = tempColor.r;
      colors[i * 3 + 1] = tempColor.g;
      colors[i * 3 + 2] = tempColor.b;
    }

    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
      size,
      vertexColors: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      transparent: true,
      opacity: 0.7,
      sizeAttenuation: true,
    });

    const points = new THREE.Points(geometry, material);
    scene.add(points);

    return {
      points,
      speed,
      baseSize: size,
      material,
      twinkleOffset: Math.random() * Math.PI * 2,
    };
  }

  layers.forEach(layer => starGroups.push(createStarLayer(layer)));

  let drift = 0;
  const clock = new THREE.Clock();
  let running = true;
  let rafId = null;

  function animate() {
    if (!running) return;
    rafId = requestAnimationFrame(animate);
    const t = clock.getElapsedTime();

    starGroups.forEach(grp => {
      grp.points.rotation.y = t * grp.speed;
      const twinkle = Math.sin(t * 2.5 + grp.twinkleOffset) * 0.12;
      grp.material.size = Math.max(0.1, grp.baseSize + twinkle);
    });

    drift += 0.0003;
    camera.position.x = Math.sin(drift) * 410;
    camera.position.z = Math.cos(drift) * 410;
    camera.lookAt(0, 0, 0);

    renderer.render(scene, camera);
  }

  function startRendering() {
    if (!running) {
      running = true;
      clock.start();
      animate();
    } else if (rafId === null) {
      animate();
    }
  }

  function stopRendering() {
    running = false;
    clock.stop();
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  }

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stopRendering();
    else setTimeout(startRendering, 60);
  });

  window.addEventListener("resize", () => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  });

  startRendering();

  // Return cleanup
  return () => {
    stopRendering();
    starGroups.forEach(grp => {
      grp.material.dispose();
      grp.points.geometry.dispose();
      scene.remove(grp.points);
    });
    renderer.dispose();
  };
}
