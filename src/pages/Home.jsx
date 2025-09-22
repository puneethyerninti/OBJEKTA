// src/pages/Home.jsx
import React, { useEffect, useRef, useState, useCallback } from "react";
import * as THREE from "three";
import { Link } from "react-router-dom";
import Navbar from "../components/Navbar";
import "../index.css";

/**
 * Home page
 * - Single Navbar usage (controlled via isNavOpen / onToggleNav)
 * - Canvas ref for Three.js
 * - Lazy model-viewer import
 * - Low-power toggle persisted to localStorage
 */

export default function Home() {
  const canvasRef = useRef(null);
  const showcaseRef = useRef(null);
  const [isNavOpen, setIsNavOpen] = useState(false);
  const [modelViewerLoaded, setModelViewerLoaded] = useState(false);

  const [lowPower, setLowPower] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("objekta_low_power") || "false");
    } catch {
      return false;
    }
  });

  const toggleLowPower = useCallback(() => {
    setLowPower((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("objekta_low_power", JSON.stringify(next));
      } catch {}
      return next;
    });
  }, []);

  // lazy-load model-viewer when showcase scrolls into view
  useEffect(() => {
    if (!showcaseRef.current || modelViewerLoaded) return;
    const ob = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            import("@google/model-viewer")
              .then(() => setModelViewerLoaded(true))
              .catch(() => setModelViewerLoaded(false));
            ob.disconnect();
          }
        });
      },
      { threshold: 0.2 }
    );
    ob.observe(showcaseRef.current);
    return () => ob.disconnect();
  }, [modelViewerLoaded]);

  // reveal observer (animate once)
  useEffect(() => {
    const revealEls = document.querySelectorAll(".reveal, .mini-card, .feature-card");
    if (!revealEls.length) return;
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            obs.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.18 }
    );
    revealEls.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, []);

  // Three.js background
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    let dpr = lowPower ? Math.min(window.devicePixelRatio || 1, 1) : Math.min(window.devicePixelRatio || 1, 2);
    renderer.setPixelRatio(dpr);
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    try {
      if ("outputColorSpace" in renderer) renderer.outputColorSpace = THREE.SRGBColorSpace;
      else if ("outputEncoding" in renderer) renderer.outputEncoding = THREE.sRGBEncoding;
    } catch (e) {}
    renderer.setClearColor(0x0e0e1f, 0);

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x0b0b14, 0.0004);
    const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 5000);
    camera.position.set(0, 120, 1500);
    scene.add(camera);

    const baseLayers = [
      { count: 900, radius: 300, size: 1.2, speed: 0.06, hue: 250 },
      { count: 1400, radius: 600, size: 0.9, speed: 0.03, hue: 280 },
      { count: 2000, radius: 1000, size: 0.6, speed: 0.015, hue: 300 },
    ];
    const viewportScale = window.innerWidth < 768 ? 0.12 : window.innerWidth < 1200 ? 0.45 : 1.0;
    const powerScale = lowPower ? 0.28 : 1.0;
    const layers = baseLayers.map((l) => ({ ...l, count: Math.max(32, Math.floor(l.count * viewportScale * powerScale)) }));

    const starGroups = [];
    const tmpColor = new THREE.Color();

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
        const l = 0.55 + Math.random() * 0.2;
        tmpColor.setHSL(h, s, l);

        colors[i * 3] = tmpColor.r;
        colors[i * 3 + 1] = tmpColor.g;
        colors[i * 3 + 2] = tmpColor.b;
      }

      geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));

      const material = new THREE.PointsMaterial({
        size: Math.max(0.06, size * dpr * (lowPower ? 0.7 : 1)),
        vertexColors: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        transparent: true,
        opacity: 0.85,
        sizeAttenuation: true,
      });

      const points = new THREE.Points(geometry, material);
      scene.add(points);

      return { points, speed, baseSize: material.size, material, twinkleOffset: Math.random() * Math.PI * 2, geometry };
    }

    layers.forEach((layer) => starGroups.push(createStarLayer(layer)));

    // Neon grid (shader) — skip if lowPower
    let gridMesh = null;
    let gridUniforms = null;
    if (!lowPower) {
      const gridSize = 4000;
      const gridGeom = new THREE.PlaneGeometry(gridSize, gridSize, 1, 1);
      gridGeom.rotateX(-Math.PI / 2);
      gridGeom.translate(0, -0.5, 0);

      gridUniforms = {
        uColorBase: { value: new THREE.Color(0x051024) },
        uColorLine: { value: new THREE.Color(0x7f5af0) },
        uColorGlow: { value: new THREE.Color(0x00d7ff) },
        uScale: { value: 60.0 },
        uThickness: { value: 0.02 },
        uTime: { value: 0.0 },
        uFadeStart: { value: 200.0 },
        uFadeEnd: { value: 1600.0 },
      };

      const gridMat = new THREE.ShaderMaterial({
        uniforms: gridUniforms,
        vertexShader: `
          precision highp float;
          uniform float uScale;
          varying vec2 vUv;
          varying vec3 vPos;
          void main() {
            vUv = uv * uScale;
            vPos = position;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          precision highp float;
          uniform vec3 uColorBase;
          uniform vec3 uColorLine;
          uniform vec3 uColorGlow;
          uniform float uThickness;
          uniform float uTime;
          uniform float uFadeStart;
          uniform float uFadeEnd;
          varying vec2 vUv;
          varying vec3 vPos;

          float gridLine(float x) {
            float fx = abs(fract(x) - 0.5);
            return 1.0 - smoothstep(0.0, 0.5 * uThickness, fx);
          }

          void main() {
            float gx = gridLine(vUv.x);
            float gy = gridLine(vUv.y);
            float g = max(gx, gy);
            float d = length(vPos.xz);
            float fade = 1.0 - smoothstep(uFadeStart, uFadeEnd, d);
            float shimmer = 0.5 + 0.5 * sin(uTime * 1.6 + (vUv.x + vUv.y) * 0.01);
            vec3 neon = mix(uColorLine, uColorGlow, 0.5 + 0.5 * sin(uTime * 2.0)) * (0.9 + 0.2 * shimmer);
            vec3 color = mix(uColorBase, neon, g);
            float alpha = clamp(g * 1.0 * fade, 0.0, 1.0);
            float halo = smoothstep(0.0, 0.02, max(gx, gy)) * 0.25;
            color += neon * halo * 0.6;
            gl_FragColor = vec4(color, alpha);
          }
        `,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });

      gridMesh = new THREE.Mesh(gridGeom, gridMat);
      gridMesh.position.y = -0.5;
      scene.add(gridMesh);
    }

    // Animation loop (throttled when lowPower)
    let mounted = true;
    let rafId = null;
    let prevTime = performance.now();
    const targetFPS = lowPower ? 20 : 60;
    const frameMs = 1000 / targetFPS;

    const onVisibility = () => {};
    document.addEventListener("visibilitychange", onVisibility);

    function frame(now) {
      if (!mounted) return;
      rafId = requestAnimationFrame(frame);

      if (document.hidden) return;
      const elapsedMs = now - prevTime;
      if (elapsedMs < frameMs) return;

      const dt = elapsedMs / 1000;
      const t = now / 1000;

      starGroups.forEach((grp, i) => {
        grp.points.rotation.y += grp.speed * dt;
        grp.points.rotation.x = Math.sin(t * (0.03 + i * 0.01)) * 0.0005;
        grp.points.position.y = Math.sin(t * (0.2 + i * 0.06)) * (6 + i * 2);

        const twinkle = Math.sin(t * (2.5 + i * 0.6) + grp.twinkleOffset) * (grp.baseSize * 0.25);
        grp.material.size = Math.max(0.06 * dpr, grp.baseSize + twinkle);
      });

      if (gridUniforms) gridUniforms.uTime.value = t;

      const drift = Math.sin(t * 0.02) * 60;
      camera.position.x = drift;
      camera.lookAt(0, 0, 0);

      renderer.render(scene, camera);
      prevTime = now;
    }

    rafId = requestAnimationFrame(frame);

    // Resize handler (rAF coalesced)
    let resizeRaf = null;
    function onResize() {
      if (resizeRaf) cancelAnimationFrame(resizeRaf);
      resizeRaf = requestAnimationFrame(() => {
        dpr = lowPower ? Math.min(window.devicePixelRatio || 1, 1) : Math.min(window.devicePixelRatio || 1, 2);
        renderer.setPixelRatio(dpr);
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight, false);
        resizeRaf = null;
      });
    }
    window.addEventListener("resize", onResize);

    // Cleanup
    return () => {
      mounted = false;
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("resize", onResize);
      if (rafId) cancelAnimationFrame(rafId);
      if (resizeRaf) cancelAnimationFrame(resizeRaf);

      starGroups.forEach((grp) => {
        try {
          grp.material.dispose();
        } catch (e) {}
        try {
          grp.geometry.dispose();
        } catch (e) {}
        try {
          scene.remove(grp.points);
        } catch (e) {}
      });

      if (gridMesh) {
        try {
          gridMesh.material.dispose();
        } catch (e) {}
        try {
          gridMesh.geometry.dispose();
        } catch (e) {}
        try {
          scene.remove(gridMesh);
        } catch (e) {}
      }

      scene.traverse((obj) => {
        if (obj.isMesh) {
          if (obj.geometry)
            try {
              obj.geometry.dispose();
            } catch (e) {}
          if (obj.material) {
            if (Array.isArray(obj.material))
              obj.material.forEach((m) => {
                try {
                  m.dispose();
                } catch (e) {}
              });
            else
              try {
                obj.material.dispose();
              } catch (e) {}
          }
        }
      });

      try {
        renderer.dispose();
      } catch (e) {}
    };
  }, [lowPower]);

  const goFullScreen = (element) => {
    if (!element) return;
    if (element.requestFullscreen) element.requestFullscreen();
    else if (element.webkitRequestFullscreen) element.webkitRequestFullscreen();
    else if (element.msRequestFullscreen) element.msRequestFullscreen();
  };

  const models = [
    { src: "/models/laptop_free.glb", alt: "Laptop", title: "Sculpt Reality", desc: "Craft stunning 3D models with intuitive tools and real-time feedback." },
    { src: "/models/cyberpunk_desk.glb", alt: "Cyberpunk Desk", title: "Animate Your Vision", desc: "Bring your creations to life with a powerful, timeline-based animation system." },
    { src: "/models/porsche.glb", alt: "Porsche 911 Turbo", title: "Sell & Showcase", desc: "Monetize your assets on a built-in marketplace and share them seamlessly." },
  ];

  const featureItems = [
    {
      icon: (
        <svg className="icon" viewBox="0 0 24 24" fill="none" width="36" height="36" aria-hidden>
          <path d="M12 2l8 4.5v10L12 21l-8-4.5v-10L12 2z" stroke="currentColor" strokeWidth="1.3" />
          <path d="M12 2v19" stroke="currentColor" strokeWidth="1.3" opacity=".7" />
          <path d="M4 6.5l8 4.5 8-4.5" stroke="currentColor" strokeWidth="1.3" opacity=".7" />
        </svg>
      ),
      title: "Real-time collaboration",
      desc: "Work on projects with your team simultaneously, no matter where you are.",
    },
    {
      icon: (
        <svg className="icon" viewBox="0 0 24 24" fill="none" width="36" height="36" aria-hidden>
          <path d="M8 12a4 4 0 100 8 4 4 0 000-8zM16 4a4 4 0 100 8 4 4 0 000-8z" stroke="currentColor" strokeWidth="1.3" />
          <path d="M10.5 14.5l3-5" stroke="currentColor" strokeWidth="1.3" opacity=".8" />
        </svg>
      ),
      title: "AI-powered assets",
      desc: "Generate and enhance models and textures using cutting-edge AI features.",
    },
    {
      icon: (
        <svg className="icon" viewBox="0 0 24 24" fill="none" width="36" height="36" aria-hidden>
          <path d="M14 4l6 6-6 6-6-6 6-6z" stroke="currentColor" strokeWidth="1.3" />
          <path d="M4 20l4-4" stroke="currentColor" strokeWidth="1.3" opacity=".7" />
        </svg>
      ),
      title: "Marketplace integration",
      desc: "Instantly buy and sell 3D models directly within the platform.",
    },
  ];

  return (
    <>
      <canvas id="three-canvas" ref={canvasRef} aria-hidden="true" />

      <div className="site-wrapper">
        <Navbar isNavOpen={isNavOpen} onToggleNav={() => setIsNavOpen((s) => !s)} />

        <header className="hero-section reveal">
          <h1 className="hero-title">Redefine 3D Creation</h1>
          <p className="hero-subtitle">An advanced 3D editor for everyone. From AI-powered design to real-time collaboration.</p>

          <div className="hero-actions">
            <Link to="/studio">
              <button className="launch-btn cta-button" aria-label="Launch Studio">
                 Launch Studio
              </button>
            </Link>

            <button
              className={`low-power-toggle ${lowPower ? "is-on" : ""}`}
              onClick={toggleLowPower}
              aria-pressed={lowPower}
              title="Toggle reduced-graphics / power saving mode"
            >
              {lowPower ? "Low Power: On" : "Low Power: Off"}
            </button>
          </div>
        </header>

        <section className="features-section reveal">
          <h2 className="section-title">A New Dimension of Workflow</h2>
          <div className="features-grid">
            {featureItems.map((item, idx) => (
              <div key={idx} className="mini-card reveal" tabIndex={0}>
                {item.icon}
                <h3 className="card-title">{item.title}</h3>
                <p className="card-description">{item.desc}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="showcase-section reveal" ref={showcaseRef}>
          <h2 className="section-title">Built on the Future of Tech</h2>
          <p className="section-subtitle">A showcase of assets created and shared on OBJEKTA.</p>

          <div className="showcase-grid">
            {models.map((model, idx) => (
              <div key={idx} className="feature-card">
                <div
                  className="card-visual"
                  onClick={(e) => goFullScreen(e.currentTarget.querySelector("model-viewer"))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      goFullScreen(e.currentTarget.querySelector("model-viewer"));
                    }
                  }}
                  role="button"
                  tabIndex={0}
                  aria-label={`Open ${model.title}`}
                >
                  {modelViewerLoaded ? (
                    <model-viewer
                      src={model.src}
                      alt={model.alt}
                      auto-rotate
                      camera-controls
                      interaction-prompt="none"
                      style={{ width: "100%", height: "100%" }}
                    />
                  ) : (
                    <div className="model-placeholder" aria-hidden>
                      <div className="placeholder-icon" />
                    </div>
                  )}
                  <span className="fullscreen-hint">Click to View</span>
                </div>

                <div className="card-content">
                  <h3>{model.title}</h3>
                  <p>{model.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
