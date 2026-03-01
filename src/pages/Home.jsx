// src/pages/Home.jsx
// PREMIUM: Figma-grade landing page with glassmorphism, micro-interactions, 3D showcase
import React, { useCallback, useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import HologramModal from "../components/HologramModal";
import PreviewGLTF from "../components/PreviewGLTF";
import Scene from "../components/Scene";
import { Canvas } from '@react-three/fiber';
import { PerspectiveCamera } from '@react-three/drei';
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { useAuth } from "../contexts/AuthContext";
import { assetUrl } from "../utils/assets";
import "../index.css";
import "../styles/home.css";

const FEATURE_ITEMS = [
  {
    title: "Collaborative Editing",
    desc: "Real-time presence, live cursors and shared scene state — teams can review and edit the same scene together.",
    badge: "01",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 7L12 3L4 7M20 7L12 11M20 7V17L12 21M12 11L4 7M12 11V21M4 7V17L12 21" />
      </svg>
    ),
  },
  {
    title: "Resumable Uploads",
    desc: "Large-file resumable uploads (tus), automatic thumbnails and versioning to keep pipelines moving.",
    badge: "02",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
        <polyline points="17 8 12 3 7 8" />
        <line x1="12" y1="3" x2="12" y2="15" />
      </svg>
    ),
  },
  {
    title: "Production Rendering",
    desc: "Physically-based materials, calibrated lighting and post-processing for accurate look-dev previews.",
    badge: "03",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
      </svg>
    ),
  },
];

const SHOWCASE_MODELS = [
  {
    src: "models/cyberpunk_desk.glb",
    title: "Command Desk",
    desc: "Multi-screen control deck for layout, approvals, and lighting passes.",
    accent: "violet",
    poster: "assets/desk-poster.webp",
    fullscreenTarget: [0, 1.0, 0],
  },
  {
    src: "models/laptop_free.glb",
    title: "Portable Rig",
    desc: "Travel-ready laptop kit showing shader tweaks and annotation overlays.",
    accent: "cyan",
    poster: "assets/laptop-poster.webp",
    previewPosition: [0, 0.45, 0],
    fullscreenPosition: [0, 0.75, 0],
    fullscreenFitSize: 4.2,
    fullscreenTarget: [0, 0.85, 0],
  },
  {
    src: "models/porsche.glb",
    title: "Concept Vehicle",
    desc: "Hero-grade automotive model tuned for material look-dev and lighting overrides.",
    accent: "amber",
    poster: "assets/porsche-poster.webp",
    fullscreenTarget: [0, 1.0, 0],
  },
  {
    src: "models/black_dragon_with_idle_animation.glb",
    title: "Black Dragon",
    desc: "Creature rig with idle animation and layered surface detail.",
    accent: "violet",
    poster: "assets/thumbnail-placeholder.svg",
    previewRotation: [Math.PI, 0, 0],
    fullscreenRotation: [Math.PI, 0, 0],
    fullscreenTarget: [0, 1.2, 0],
  },
  {
    src: "models/flynns_arcade.glb",
    title: "Flynn's Arcade",
    desc: "Retro interior scene built for neon lighting and cinematic depth.",
    accent: "cyan",
    poster: "assets/thumbnail-placeholder.svg",
    fullscreenTarget: [0, 1.0, 0],
  },
  {
    src: "models/gipsy_avenger_-_pacific_rim.glb",
    title: "Gipsy Avenger",
    desc: "Mech-scale asset optimized for real-time material previews.",
    accent: "amber",
    poster: "assets/thumbnail-placeholder.svg",
    fullscreenTarget: [0, 1.0, 0],
  },
  {
    src: "models/iphone_17_pro.glb",
    title: "iPhone 17 Pro",
    desc: "Product visualization mockup with clean PBR finishes.",
    accent: "cyan",
    poster: "assets/thumbnail-placeholder.svg",
    fullscreenTarget: [0, 1.0, 0],
  },
];

const TICKER_ITEMS = [
  "Three.js", "React Three Fiber", "WebGL 2.0", "glTF 2.0", "PBR Materials",
  "Real-time GI", "Mesh Optimization", "LOD System", "Post-Processing",
  "Collaborative", "Resumable Uploads", "Scene Presets",
];

const createPreviewLoader = () => {
  const manager = new THREE.LoadingManager();

  class NullTextureLoader extends THREE.TextureLoader {
    load(url, onLoad) {
      const canvas = document.createElement('canvas');
      canvas.width = 1;
      canvas.height = 1;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = 'rgba(0,0,0,0)';
      ctx.fillRect(0, 0, 1, 1);
      const tex = new THREE.Texture(canvas);
      tex.encoding = THREE.sRGBEncoding;
      tex.needsUpdate = true;
      if (onLoad) setTimeout(() => onLoad(tex), 0);
      return tex;
    }
  }

  manager.addHandler(/blob:/, new NullTextureLoader(manager));
  manager.addHandler(/\.(jpg|jpeg|png|gif|bmp|tga|dds|ktx|ktx2|webp)$/i, new NullTextureLoader(manager));

  const loader = new GLTFLoader(manager);
  loader.setCrossOrigin('anonymous');
  if (typeof MeshoptDecoder !== 'undefined' && MeshoptDecoder) {
    try { loader.setMeshoptDecoder(MeshoptDecoder); } catch (e) {}
  }

  return loader;
};



export default function Home() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [saveData, setSaveData] = useState(false);
  const [deviceTier, setDeviceTier] = useState("full");
  const [showcaseVisible, setShowcaseVisible] = useState(true);
  const [visibleCards, setVisibleCards] = useState({});
  const [interactionsEnabled, setInteractionsEnabled] = useState(true);
  const [prefetched, setPrefetched] = useState({});
  const [parsedPrefetch, setParsedPrefetch] = useState({});
  const [progressMap, setProgressMap] = useState({});
  const [activeModel, setActiveModel] = useState(null);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const prefetchedRef = useRef({});
  const parsedRef = useRef({});
  const progressRef = useRef({});
  const heroVisibleRef = useRef(true);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mediaQuery.matches);
    const handler = (e) => setPrefersReducedMotion(e.matches);
    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  }, []);

  useEffect(() => {
    if (typeof navigator === "undefined") return undefined;
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    const save = !!connection?.saveData;
    setSaveData(save);
    const cores = typeof navigator.hardwareConcurrency === "number" ? navigator.hardwareConcurrency : 8;
    const tier = save ? "lite" : cores <= 6 ? "medium" : "full";
    setDeviceTier(tier);
    return undefined;
  }, []);

  useEffect(() => {
    const updateInteractions = () => {
      setInteractionsEnabled(!document.hidden && heroVisibleRef.current && !prefersReducedMotion);
    };
    if (typeof document === "undefined") return undefined;
    document.addEventListener("visibilitychange", updateInteractions);
    updateInteractions();
    return () => document.removeEventListener("visibilitychange", updateInteractions);
  }, [prefersReducedMotion]);


  // Prefetch showcase GLTFs so they appear quickly
  useEffect(() => {
    if (saveData) return;
    let mounted = true;
    const controllers = [];
    const updateProgress = (src, value) => {
      if (!mounted) return;
      const clamped = Math.min(100, Math.max(0, Math.round(value)));
      progressRef.current[src] = clamped;
      setProgressMap({ ...progressRef.current });
    };

    const modelsToPrefetch = SHOWCASE_MODELS.map((m) => assetUrl(m.src));
    const eager = modelsToPrefetch.slice(0, 3);
    const deferred = modelsToPrefetch.slice(3);

    if (typeof document !== "undefined") {
      eager.forEach((href) => {
        if (document.querySelector(`link[rel="preload"][href="${href}"]`)) return;
        const link = document.createElement("link");
        link.rel = "preload";
        link.as = "fetch";
        link.href = href;
        link.crossOrigin = "anonymous";
        document.head.appendChild(link);
      });
    }

    const loader = createPreviewLoader();

    const fetchWithProgress = async (src) => {
      updateProgress(src, 5);
      const controller = new AbortController();
      controllers.push(controller);
      const res = await fetch(src, { cache: "force-cache", priority: "high", signal: controller.signal });
      const total = Number(res.headers.get('content-length') || 0);
      if (!res.body) {
        const arr = await res.arrayBuffer();
        updateProgress(src, total ? 90 : 75);
        return arr;
      }
      const reader = res.body.getReader();
      let loaded = 0;
      const chunks = [];
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        loaded += value.byteLength;
        chunks.push(value);
        if (total) {
          updateProgress(src, (loaded / total) * 90);
        } else {
          updateProgress(src, Math.min(90, (progressRef.current[src] || 10) + 5));
        }
      }
      const combined = new Uint8Array(loaded);
      let offset = 0;
      chunks.forEach((chunk) => {
        combined.set(chunk, offset);
        offset += chunk.length;
      });
      updateProgress(src, total ? 92 : 88);
      return combined.buffer;
    };

    const loadModel = async (src) => {
      if (prefetchedRef.current[src] && parsedRef.current[src]) {
        updateProgress(src, 100);
        return;
      }
      try {
        const arr = prefetchedRef.current[src] || await fetchWithProgress(src);
        if (!arr || !mounted) return;
        if (!prefetchedRef.current[src]) {
          prefetchedRef.current[src] = arr;
          setPrefetched({ ...prefetchedRef.current });
        }
        if (parsedRef.current[src]) {
          updateProgress(src, 100);
          return;
        }
        loader.parse(arr, '', (data) => {
          if (!mounted) return;
          parsedRef.current[src] = data;
          setParsedPrefetch({ ...parsedRef.current });
          updateProgress(src, 100);
        }, (err) => {
          console.debug('[Home] preload parse failed', src, err);
          updateProgress(src, 100);
        });
      } catch (err) {
        console.debug('[Home] prefetch failed', src, err);
      }
    };

    // Load ALL models eagerly for instant display
    modelsToPrefetch.forEach((src) => {
      if (prefetchedRef.current[src] && parsedRef.current[src]) {
        updateProgress(src, 100);
        return;
      }
      loadModel(src);
    });

    return () => {
      mounted = false;
      controllers.forEach((c) => c.abort());
    };
  }, [saveData, showcaseVisible]);

  // Track hero visibility for interaction gating
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return undefined;
    const hero = document.querySelector(".hero-grid");
    if (!hero) return undefined;
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        heroVisibleRef.current = entry.isIntersecting;
        setInteractionsEnabled(!document.hidden && heroVisibleRef.current && !prefersReducedMotion);
      });
    }, { threshold: 0.2 });
    observer.observe(hero);
    return () => observer.disconnect();
  }, [prefersReducedMotion]);

  // Observe showcase section to trigger deferred prefetch
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return undefined;
    const section = document.querySelector("#showcase");
    if (!section) return undefined;
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) setShowcaseVisible(true);
      });
    }, { rootMargin: "200px" });
    observer.observe(section);
    return () => observer.disconnect();
  }, []);

  // Track showcase cards for lazy Canvas mount
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return undefined;
    const cards = document.querySelectorAll(".showcase-card-v2");
    if (!cards.length) return undefined;
    const observer = new IntersectionObserver((entries) => {
      setVisibleCards((prev) => {
        const next = { ...prev };
        entries.forEach((entry) => {
          const key = entry.target.dataset.key;
          if (!key) return;
          next[key] = entry.isIntersecting;
        });
        return next;
      });
    }, { rootMargin: "200px" });
    cards.forEach((card) => observer.observe(card));
    return () => observer.disconnect();
  }, []);


  // Tilt effect (optimized with RAF throttling)
  useEffect(() => {
    if (prefersReducedMotion || !interactionsEnabled) return;
    const tiltNodes = document.querySelectorAll("[data-tilt]");
    if (!tiltNodes.length) return;
    
    let rafId = null;
    const cleanups = [];
    
    tiltNodes.forEach((node) => {
      const limit = parseFloat(node.dataset.tilt || "8");
      let pendingX = "0deg";
      let pendingY = "0deg";
      
      const handleMove = (event) => {
        const rect = node.getBoundingClientRect();
        const offsetX = event.clientX - (rect.left + rect.width / 2);
        const offsetY = event.clientY - (rect.top + rect.height / 2);
        pendingX = `${(-offsetY / rect.height) * limit}deg`;
        pendingY = `${(offsetX / rect.width) * limit}deg`;
        
        if (!rafId) {
          rafId = requestAnimationFrame(() => {
            node.style.setProperty("--tilt-x", pendingX);
            node.style.setProperty("--tilt-y", pendingY);
            rafId = null;
          });
        }
      };
      
      const handleLeave = () => {
        node.style.setProperty("--tilt-x", "0deg");
        node.style.setProperty("--tilt-y", "0deg");
      };
      
      node.addEventListener("pointermove", handleMove, { passive: true });
      node.addEventListener("pointerleave", handleLeave);
      cleanups.push(() => {
        node.removeEventListener("pointermove", handleMove);
        node.removeEventListener("pointerleave", handleLeave);
      });
    });
    
    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      cleanups.forEach((fn) => fn());
    };
  }, [prefersReducedMotion, interactionsEnabled]);


  // Magnetic button effect (optimized)
  useEffect(() => {
    if (prefersReducedMotion || !interactionsEnabled) return;
    const magneticNodes = document.querySelectorAll("[data-magnetic]");
    if (!magneticNodes.length) return;
    
    let rafId = null;
    const cleanups = [];
    
    magneticNodes.forEach((node) => {
      const intensity = parseFloat(node.dataset.magnetic || "0.12");
      let pendingX = "0px";
      let pendingY = "0px";
      
      const handleMove = (event) => {
        const rect = node.getBoundingClientRect();
        const offsetX = event.clientX - (rect.left + rect.width / 2);
        const offsetY = event.clientY - (rect.top + rect.height / 2);
        pendingX = `${offsetX * intensity}px`;
        pendingY = `${offsetY * intensity}px`;
        
        if (!rafId) {
          rafId = requestAnimationFrame(() => {
            node.style.setProperty("--magnet-x", pendingX);
            node.style.setProperty("--magnet-y", pendingY);
            rafId = null;
          });
        }
      };
      
      const handleLeave = () => {
        node.style.setProperty("--magnet-x", "0px");
        node.style.setProperty("--magnet-y", "0px");
      };
      
      node.addEventListener("pointermove", handleMove, { passive: true });
      node.addEventListener("pointerleave", handleLeave);
      cleanups.push(() => {
        node.removeEventListener("pointermove", handleMove);
        node.removeEventListener("pointerleave", handleLeave);
      });
    });
    
    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      cleanups.forEach((fn) => fn());
    };
  }, [prefersReducedMotion, interactionsEnabled]);

  const handleLaunch = useCallback(() => {
    navigate(user ? "/dashboard" : "/login");
  }, [navigate, user]);

  const handleShowcaseOpen = useCallback((model) => {
    setActiveModel(model);
  }, []);

  const handleModalClose = useCallback(() => {
    setActiveModel(null);
  }, []);

  return (
    <div className="home-screen">
      <div className="scene-background" aria-hidden="true">
        <Scene />
      </div>
      <main className="home-shell">

        {/* ──── HERO ──── */}
        <section className="hp-hero" style={{ position: "relative", overflow: "hidden" }}>
          <div className="hp-hero-content">
            <span className="hp-badge">
              <span className="hp-badge-dot" aria-hidden />
              Web-Based 3D Studio
            </span>

            <h1 className="hp-title">
              Design immersive{" "}
              <span className="hp-title-gradient">3D workspaces</span>
            </h1>

            <p className="hp-subtitle">
              Objekta is a collaborative 3D scene editor — review meshes, iterate on <strong>materials</strong>,
              and approve lighting shots together in <strong>real time</strong> without leaving the browser.
            </p>

            <div className="hp-actions">
              <button
                type="button"
                className="hp-cta hp-cta-primary"
                onClick={handleLaunch}
                data-magnetic="0.18"
              >
                {user ? "Enter Studio" : "Start Free"}
              </button>
              <button
                type="button"
                className="hp-cta hp-cta-secondary"
                data-magnetic="0.1"
                aria-controls="showcase"
                onClick={() => document.querySelector("#showcase")?.scrollIntoView({ behavior: "smooth" })}
              >
                Explore Gallery
              </button>
            </div>

            <div className="hp-trust" aria-label="Platform highlights">
              <div className="hp-trust-item">
                <span className="hp-trust-value">7+</span>
                <span className="hp-trust-label">3D Models</span>
              </div>
              <span className="hp-trust-divider" aria-hidden />
              <div className="hp-trust-item">
                <span className="hp-trust-value">PBR</span>
                <span className="hp-trust-label">Materials</span>
              </div>
              <span className="hp-trust-divider" aria-hidden />
              <div className="hp-trust-item">
                <span className="hp-trust-value">Real-time</span>
                <span className="hp-trust-label">Collaboration</span>
              </div>
              <span className="hp-trust-divider" aria-hidden />
              <div className="hp-trust-item">
                <span className="hp-trust-value">WebGL 2</span>
                <span className="hp-trust-label">Rendering</span>
              </div>
            </div>
          </div>
        </section>

        {/* ──── TECH TICKER ──── */}
        <div className="hp-ticker" aria-hidden="true">
          <div className="hp-ticker-track">
            {[...TICKER_ITEMS, ...TICKER_ITEMS].map((item, i) => (
              <span key={i} className="hp-ticker-item">
                <span className="hp-ticker-dot" />
                {item}
              </span>
            ))}
          </div>
        </div>

        {/* ──── FEATURES ──── */}
        <section id="features" className="hp-features">
          <div className="hp-section-header">
            <span className="hp-section-badge">Core Capabilities</span>
            <h2 className="hp-section-title">
              Built for <span className="hp-gradient">production teams</span>
            </h2>
            <p className="hp-section-desc">
              Focused tools and UI patterns for team reviews, asset handoff and material
              look-development — designed to scale across projects and distributed studios.
            </p>
          </div>

          <div className="hp-features-grid">
            {FEATURE_ITEMS.map((item, idx) => (
              <article
                key={item.title}
                className="hp-feature-card"
                data-tilt="6"
              >
                <span className="hp-feature-number">{item.badge}</span>
                <div className="hp-feature-icon">{item.icon}</div>
                <h3 className="hp-feature-title">{item.title}</h3>
                <p className="hp-feature-desc">{item.desc}</p>
              </article>
            ))}
          </div>
        </section>

        {/* ──── SHOWCASE ──── */}
        <section id="showcase" className="hp-showcase">
          <div className="hp-section-header">
            <span className="hp-section-badge">Live Viewport Gallery</span>
            <h2 className="hp-section-title">
              Project gallery &amp; <span className="hp-gradient">previews</span>
            </h2>
            <p className="hp-section-desc">
              Open any project to inspect materials, lighting and animations in a live viewport.
              Previews are interactive and optimized for quick iteration.
            </p>
          </div>

          <div className="hp-showcase-grid">
            {SHOWCASE_MODELS.map((model, index) => {
              const modelSrc = assetUrl(model.src);
              const posterSrc = assetUrl(model.poster);
              const resolvedModel = { ...model, src: modelSrc, poster: posterSrc };
              const previewReady = Boolean(parsedPrefetch[modelSrc] || prefetched[modelSrc]);
              const progress = progressMap[modelSrc] ?? 0;
              const cardKey = model.title;
              const isVisible = visibleCards[cardKey];
              const shouldRenderPreview = Boolean(isVisible && (parsedPrefetch[modelSrc] || prefetched[modelSrc]));
              const dprCap = deviceTier === "full" ? 1.5 : deviceTier === "medium" ? 1.1 : 1;
              const devicePixelRatio = typeof window !== "undefined" ? (window.devicePixelRatio || 1) : 1;
              const ambientIntensity = deviceTier === "full" ? 1.1 : deviceTier === "medium" ? 0.95 : 0.75;
              const dirIntensity = deviceTier === "full" ? 0.9 : deviceTier === "medium" ? 0.75 : 0.6;

              return (
                <article
                  key={model.title}
                  className="hp-showcase-card showcase-card-v2"
                  data-key={cardKey}
                  onClick={() => handleShowcaseOpen(resolvedModel)}
                  style={{ animationDelay: `${index * 0.12}s` }}
                >
                  <div className="hp-preview">
                    <div className={`hp-preview-poster hp-preview-${model.accent}`}>
                      <div className="hp-preview-canvas">
                        {!previewReady && (
                          <div className="hp-loader">
                            <svg className="hp-loader-ring" viewBox="0 0 80 80" fill="none">
                              <circle cx="40" cy="40" r="35" stroke="rgba(127,90,240,0.1)" strokeWidth="2" />
                              <circle cx="40" cy="40" r="35" stroke="url(#hpGrad1)" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="55 165" className="hp-ring-spin" />
                              <circle cx="40" cy="40" r="26" stroke="rgba(0,215,255,0.08)" strokeWidth="1.5" />
                              <circle cx="40" cy="40" r="26" stroke="url(#hpGrad2)" strokeWidth="2" strokeLinecap="round" strokeDasharray="35 128" className="hp-ring-spin-reverse" />
                              <defs>
                                <linearGradient id="hpGrad1" x1="0" y1="0" x2="80" y2="80">
                                  <stop offset="0%" stopColor="#7f5af0" />
                                  <stop offset="100%" stopColor="#00d7ff" />
                                </linearGradient>
                                <linearGradient id="hpGrad2" x1="80" y1="0" x2="0" y2="80">
                                  <stop offset="0%" stopColor="#00d7ff" />
                                  <stop offset="100%" stopColor="#ff47a3" />
                                </linearGradient>
                              </defs>
                            </svg>
                            <div className="hp-loader-meta">
                              <span className="hp-loader-pct">{Math.max(5, progress)}%</span>
                              <div className="hp-loader-bar">
                                <div className="hp-loader-bar-fill" style={{ width: `${Math.max(5, progress)}%` }} />
                              </div>
                            </div>
                          </div>
                        )}
                        {shouldRenderPreview && (
                          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Canvas
                              eventSource={typeof document !== 'undefined' ? document : undefined}
                              style={{ width: '100%', height: '100%' }}
                              dpr={Math.min(dprCap, devicePixelRatio)}
                              frameloop="demand"
                              gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
                              onCreated={({ gl }) => {
                                try {
                                  if ('outputColorSpace' in gl) gl.outputColorSpace = THREE.SRGBColorSpace;
                                  gl.toneMappingExposure = 1.05;
                                  if (typeof gl.useLegacyLights !== 'undefined') gl.useLegacyLights = false;
                                } catch (e) {}
                              }}
                            >
                              <PerspectiveCamera makeDefault fov={50} position={[0, 1.5, 8]} />
                              <ambientLight intensity={ambientIntensity} />
                              <directionalLight intensity={dirIntensity} position={[5, 5, 5]} />
                              <directionalLight intensity={0.3} position={[-3, 2, -3]} />
                              <PreviewGLTF
                                gltf={parsedPrefetch[modelSrc] || prefetched[modelSrc]}
                                src={modelSrc}
                                fitSize={4.5}
                                fitAxis="max"
                                position={model.previewPosition || [0, 0, 0]}
                                rotation={model.previewRotation || [0, 0, 0]}
                              />
                            </Canvas>
                          </div>
                        )}
                      </div>
                      <div className="hp-preview-scan" aria-hidden="true" />
                    </div>
                  </div>

                  <div className="hp-card-body">
                    <span className="hp-card-tag">Real-time Render</span>
                    <h3 className="hp-card-title">{model.title}</h3>
                    <p className="hp-card-desc">{model.desc}</p>
                    <div className="hp-card-actions">
                      <button
                        type="button"
                        className="hp-btn hp-btn-primary"
                        onClick={(e) => { e.stopPropagation(); handleShowcaseOpen(resolvedModel); }}
                        aria-label={`View ${model.title} in fullscreen`}
                      >
                        Fullscreen
                      </button>
                      <a
                        href={modelSrc}
                        download
                        className="hp-btn hp-btn-ghost"
                        onClick={(e) => e.stopPropagation()}
                        aria-label={`Download ${model.title}`}
                      >
                        Download
                      </a>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        {/* ──── CTA BANNER ──── */}
        <section className="hp-cta-banner">
          <h2 className="hp-cta-banner-title">
            Ready to build your next 3D project?
          </h2>
          <p className="hp-cta-banner-desc">
            Start collaborating on production-quality 3D scenes today — no install, no plugins, just your browser.
          </p>
          <div className="hp-actions">
            <button
              type="button"
              className="hp-cta hp-cta-primary"
              onClick={handleLaunch}
            >
              {user ? "Open Dashboard" : "Get Started Free"}
            </button>
          </div>
        </section>

      </main>

      {/* Fullscreen Modal (only renders ONE Canvas when active) */}
      {activeModel && (
        <HologramModal
          model={activeModel}
          onClose={handleModalClose}
        />
      )}
    </div>
  );
}
