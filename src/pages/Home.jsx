// src/pages/Home.jsx
import React, { useEffect, useRef, useState, useCallback } from "react";
import * as THREE from "three";
import { Link } from "react-router-dom";
import Navbar from "../components/Navbar";
import "../index.css";

/**
 * Home page:
 * - Three.js background
 * - features section
 * - showcase with GLB preloader + per-card loading overlays & progress
 * - lazy model-viewer import
 */

export default function Home() {
  const canvasRef = useRef(null);
  const showcaseRef = useRef(null);
  const [isNavOpen, setIsNavOpen] = useState(false);
  const [modelViewerLoaded, setModelViewerLoaded] = useState(false);

  // Per-model preload state
  const [modelProgress, setModelProgress] = useState([0, 0, 0]);
  const [modelReady, setModelReady] = useState([false, false, false]);
  const [modelBlobUrls, setModelBlobUrls] = useState([null, null, null]);

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

  // models list (we preload these)
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

  // -------------------------
  // Preload GLB using streaming fetch so we can show progress
  // -------------------------
  useEffect(() => {
    let cancelled = false;
    const controllers = [];

    async function preloadModel(index, url) {
      try {
        const controller = new AbortController();
        controllers.push(controller);

        const res = await fetch(url, { signal: controller.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const contentLength = res.headers.get("content-length");
        const total = contentLength ? parseInt(contentLength, 10) : 0;

        if (!res.body || typeof res.body.getReader !== "function") {
          // fallback to blob if streaming not supported
          const blob = await res.blob();
          if (cancelled) return;
          const blobUrl = URL.createObjectURL(blob);
          setModelBlobUrls((prev) => {
            const next = [...prev];
            next[index] = blobUrl;
            return next;
          });
          setModelProgress((prev) => {
            const next = [...prev];
            next[index] = 100;
            return next;
          });
          setModelReady((prev) => {
            const next = [...prev];
            next[index] = true;
            return next;
          });
          return;
        }

        const reader = res.body.getReader();
        const chunks = [];
        let received = 0;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
          received += value.length || value.byteLength || (value instanceof Uint8Array ? value.length : 0);
          if (cancelled) {
            try { controller.abort(); } catch {}
            return;
          }
          if (total) {
            const percent = Math.min(100, Math.round((received / total) * 100));
            setModelProgress((prev) => {
              const next = [...prev];
              next[index] = percent;
              return next;
            });
          } else {
            // indeterminate: increase to show activity (cap at 95)
            setModelProgress((prev) => {
              const next = [...prev];
              next[index] = Math.min(95, (prev[index] || 0) + 5);
              return next;
            });
          }
        }

        const blob = new Blob(chunks, { type: "model/gltf-binary" });
        if (cancelled) return;
        const blobUrl = URL.createObjectURL(blob);

        setModelBlobUrls((prev) => {
          const next = [...prev];
          next[index] = blobUrl;
          return next;
        });
        setModelProgress((prev) => {
          const next = [...prev];
          next[index] = 100;
          return next;
        });
        // mark as ready — the model's binary is available. We'll also listen to model-viewer 'load' event.
        setModelReady((prev) => {
          const next = [...prev];
          next[index] = true;
          return next;
        });
      } catch (err) {
        if (cancelled) return;
        console.warn("Preload failed for", url, err);
        setModelProgress((prev) => {
          const next = [...prev];
          next[index] = 0;
          return next;
        });
      }
    }

    models.forEach((m, i) => preloadModel(i, m.src));

    return () => {
      cancelled = true;
      controllers.forEach((c) => {
        try { c.abort(); } catch {}
      });
      // revoke blob URLs on unmount
      setTimeout(() => {
        setModelBlobUrls((prev) => {
          prev.forEach((u) => { if (u) URL.revokeObjectURL(u); });
          return [null, null, null];
        });
      }, 0);
    };
  }, []); // run once

  // -------------------------
  // lazy-load model-viewer when showcase scrolls into view
  // -------------------------
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

  // -------------------------
  // Attach listeners to model-viewer elements to be sure overlays hide when viewer finishes loading
  // -------------------------
  useEffect(() => {
    if (!modelViewerLoaded) return;
    // find all model-viewer elements that we render (we set data-model-idx)
    const viewers = Array.from(document.querySelectorAll('model-viewer[data-model-idx]'));
    const removeFns = [];

    viewers.forEach((v) => {
      const idx = Number(v.dataset.modelIdx);
      if (Number.isNaN(idx)) return;

      const onLoad = () => {
        // mark complete and ensure progress shows 100
        setModelReady((prev) => {
          const next = [...prev];
          next[idx] = true;
          return next;
        });
        setModelProgress((prev) => {
          const next = [...prev];
          next[idx] = 100;
          return next;
        });
      };

      v.addEventListener("load", onLoad);
      removeFns.push(() => v.removeEventListener("load", onLoad));
    });

    return () => removeFns.forEach((fn) => fn());
  }, [modelViewerLoaded, modelBlobUrls]);

  // -------------------------
  // reveal observer (animate once)
  // -------------------------
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

  // -------------------------
  // Three.js background (kept robust)
  // -------------------------
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    let dpr = lowPower ? Math.min(window.devicePixelRatio || 1, 1) : Math.min(window.devicePixelRatio || 1, 2);
    renderer.setPixelRatio(dpr);

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x0b0b14, 0.0004);
    const camera = new THREE.PerspectiveCamera(
      55,
      (canvas.clientWidth || window.innerWidth) / (canvas.clientHeight || window.innerHeight),
      0.1,
      5000
    );
    camera.position.set(0, 120, 1500);
    scene.add(camera);

    const resizeRendererToDisplaySize = () => {
      const w = Math.max(1, canvas.clientWidth || window.innerWidth);
      const h = Math.max(1, canvas.clientHeight || window.innerHeight);
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      dpr = lowPower ? Math.min(window.devicePixelRatio || 1, 1) : Math.min(window.devicePixelRatio || 1, 2);
    };

    resizeRendererToDisplaySize();

    try {
      if ("outputColorSpace" in renderer) renderer.outputColorSpace = THREE.SRGBColorSpace;
      else if ("outputEncoding" in renderer) renderer.outputEncoding = THREE.sRGBEncoding;
    } catch (e) {}

    renderer.setClearColor(0x0e0e1f, 0);

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

    const onVisibility = () => {
      if (document.hidden) {
        if (rafId) cancelAnimationFrame(rafId);
        rafId = null;
      } else {
        prevTime = performance.now();
        if (!rafId) rafId = requestAnimationFrame(frame);
      }
    };
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
        resizeRendererToDisplaySize();
        starGroups.forEach((grp) => {
          try {
            grp.material.size = Math.max(0.06 * dpr, grp.baseSize);
          } catch (e) {}
        });
        resizeRaf = null;
      });
    }
    window.addEventListener("resize", onResize);

    // WebGL context sanity
    try {
      const gl = renderer.getContext();
      if (!gl) console.warn("WebGL context is null - WebGL might be unavailable");
    } catch (err) {
      console.warn("Error checking WebGL context", err);
    }

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

  // click handler (uses blob URL if available)
  const handleVisualClick = (e, idx) => {
    const mv = e.currentTarget.querySelector("model-viewer");
    if (!mv) {
      console.warn("model-viewer not loaded yet — try again after scrolling to showcase.");
      return;
    }
    goFullScreen(mv);
  };

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

        {/* FEATURES SECTION */}
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

        {/* SHOWCASE WITH PRELOAD + OVERLAYS */}
        <section className="showcase-section reveal" ref={showcaseRef}>
          <h2 className="section-title">Built on the Future of Tech</h2>
          <p className="section-subtitle">A showcase of assets created and shared on OBJEKTA.</p>

          <div className="showcase-grid">
            {models.map((model, idx) => {
              const blobUrl = modelBlobUrls[idx];
              const ready = modelReady[idx];
              const progress = modelProgress[idx] ?? 0;
              return (
                <div key={idx} className="feature-card">
                  <div
                    className="card-visual"
                    onClick={(e) => handleVisualClick(e, idx)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        handleVisualClick(e, idx);
                      }
                    }}
                    role="button"
                    tabIndex={0}
                    aria-label={`Open ${model.title}`}
                  >
                    {/* model-viewer or placeholder (viewer first so overlay sits after it in DOM) */}
                    {modelViewerLoaded && (blobUrl || model.src) ? (
                      <model-viewer
                        data-model-idx={idx}
                        src={blobUrl || model.src}
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

                    {/* loading overlay (last child -> sits on top) */}
                    {!ready && (
                      <div className="loading-overlay fade-in" aria-hidden>
                        <div className="spinner" />
                        {progress > 0 ? (
                          <div className="progress-text">{progress}%</div>
                        ) : (
                          <div className="progress-text">loading…</div>
                        )}
                      </div>
                    )}

                    <span className="fullscreen-hint">Click to View</span>
                  </div>

                  <div className="card-content">
                    <h3>{model.title}</h3>
                    <p>{model.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </>
  );
}
