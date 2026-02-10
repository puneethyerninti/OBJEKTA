// src/pages/Home.jsx
// REFACTORED: Production-ready homepage with single Canvas architecture
import React, { useCallback, useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import HologramModal from "../components/HologramModal";
import PreviewGLTF from "../components/PreviewGLTF";
import Scene from "../components/Scene";
import OverlayUI from "../components/OverlayUI";
import { Canvas } from '@react-three/fiber';
import { PerspectiveCamera } from '@react-three/drei';
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { useAuth } from "../contexts/AuthContext";
import { assetUrl } from "../utils/assets";
import "../index.css";

const FEATURE_ITEMS = [
  {
    title: "Hologram Workspaces",
    desc: "Layered HUD panels, magnetized cursors, and GPU-native history scrubbing for cinematic playblasts.",
    badge: "01",
  },
  {
    title: "Procedural Materials",
    desc: "Author BRDF graphs, bake neon trims, and export USDZ/GLB with studio-calibrated color pipelines.",
    badge: "02",
  },
  {
    title: "Live Automation",
    desc: "Nightly renders, asset diffing, and headset-ready previews synced across distributed studios.",
    badge: "03",
  },
];

const SHOWCASE_MODELS = [
  {
    src: "models/cyberpunk_desk.glb",
    title: "Command Desk",
    desc: "Multi-screen control deck for layout, approvals, and lighting passes.",
    accent: "violet",
    poster: "assets/desk-poster.webp",
  },
  {
    src: "models/laptop_free.glb",
    title: "Portable Rig",
    desc: "Travel-ready laptop kit showing shader tweaks and annotation overlays.",
    accent: "cyan",
    poster: "assets/laptop-poster.webp",
  },
  {
    src: "models/porsche.glb",
    title: "Concept Vehicle",
    desc: "Hero-grade automotive model tuned for material look-dev and lighting overrides.",
    accent: "amber",
    poster: "assets/porsche-poster.webp",
  },
  {
    src: "models/black_dragon_with_idle_animation.glb",
    title: "Black Dragon",
    desc: "Creature rig with idle animation and layered surface detail.",
    accent: "violet",
    poster: "assets/thumbnail-placeholder.svg",
  },
  {
    src: "models/flynns_arcade.glb",
    title: "Flynn's Arcade",
    desc: "Retro interior scene built for neon lighting and cinematic depth.",
    accent: "cyan",
    poster: "assets/thumbnail-placeholder.svg",
  },
  {
    src: "models/gipsy_avenger_-_pacific_rim.glb",
    title: "Gipsy Avenger",
    desc: "Mech-scale asset optimized for real-time material previews.",
    accent: "amber",
    poster: "assets/thumbnail-placeholder.svg",
  },
  {
    src: "models/iphone_17_pro.glb",
    title: "iPhone 17 Pro",
    desc: "Product visualization mockup with clean PBR finishes.",
    accent: "cyan",
    poster: "assets/thumbnail-placeholder.svg",
  },
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
  const [showcaseVisible, setShowcaseVisible] = useState(false);
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

    eager.forEach((src) => {
      if (prefetchedRef.current[src] && parsedRef.current[src]) {
        updateProgress(src, 100);
        return;
      }
      loadModel(src);
    });

    const idleHandle = typeof requestIdleCallback !== "undefined"
      ? requestIdleCallback
      : (cb) => setTimeout(cb, 500);

    if (showcaseVisible) {
      deferred.forEach((src) => loadModel(src));
    } else {
      idleHandle(() => {
        if (!mounted || !showcaseVisible) return;
        deferred.forEach((src) => loadModel(src));
      });
    }

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
        <section className="hero-grid" style={{ position: "relative", overflow: "hidden" }}>
          <div className="hero-copy" style={{ position: "relative", zIndex: "var(--z-content)" }}>
            
            <h1 className="hero-title">
              Design immersive
              <span className="title-gradient"> 3D workspaces</span>
            </h1>
            <p className="hero-subtitle">
              Objekta is a web-first 3D design application for teams—review meshes, iterate on materials, and approve lighting shots together in real time without leaving the browser.
            </p>
            <div className="hero-actions">
              <button 
                type="button" 
                className="cta-button cta-primary" 
                onClick={handleLaunch} 
                data-magnetic="0.18"
              >
                {user ? "Enter Studio" : "Start Free"}
              </button>
              <button
                type="button"
                className="cta-button cta-secondary"
                data-magnetic="0.1"
                aria-controls="showcase"
                onClick={() => document.querySelector("#showcase")?.scrollIntoView({ behavior: "smooth" })}
              >
                Watch Workflow
              </button>
            </div>
          </div>
        </section>

        <section id="features" className="features-section neo-section">
          <div className="features-header">
            <h2 className="section-title">Engineered like a pro 3D suite.</h2>
            <p className="section-subtitle">
              Glass panels, depth cues, and tactile feedback keep complex scene management intuitive for distributed art teams.
            </p>
          </div>
          <div className="features-scroll-wrapper">
            <div className="features-scroll-track">
              {FEATURE_ITEMS.map((item, idx) => (
                <article
                  key={`${item.title}-${idx}`}
                  className="feature-card-premium"
                  data-tilt="6"
                >
                  <div className="feature-card-glow" aria-hidden="true"></div>
                  <div className="feature-icon-container">
                    <svg className="feature-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      {idx % 3 === 0 && (
                        <>
                          <path d="M20 7L12 3L4 7M20 7L12 11M20 7V17L12 21M12 11L4 7M12 11V21M4 7V17L12 21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          <circle cx="12" cy="12" r="2" fill="currentColor" opacity="0.6" />
                        </>
                      )}
                      {idx % 3 === 1 && (
                        <>
                          <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="2" />
                          <path d="M3 9H21M9 21V9" stroke="currentColor" strokeWidth="2" />
                          <circle cx="15" cy="15" r="3" stroke="currentColor" strokeWidth="2" />
                        </>
                      )}
                      {idx % 3 === 2 && (
                        <>
                          <path d="M13 2L3 14H12L11 22L21 10H12L13 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          <circle cx="12" cy="12" r="1.5" fill="currentColor" opacity="0.8" />
                        </>
                      )}
                    </svg>
                  </div>
                  <h3 className="feature-title-premium">{item.title}</h3>
                  <p className="feature-desc-premium">{item.desc}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="showcase" className="showcase-section-v2">
          <div className="showcase-header">
            <span className="showcase-badge">Live Viewport Gallery</span>
            <h2 className="showcase-title">Interactive 3D Experiences</h2>
            <p className="showcase-subtitle">
              Click any model to enter immersive fullscreen mode. Orbit, zoom, and explore each scene in real-time.
            </p>
          </div>

          <div className="showcase-grid-v2">
            {SHOWCASE_MODELS.map((model, index) => {
              const modelSrc = assetUrl(model.src);
              const posterSrc = assetUrl(model.poster);
              const resolvedModel = { ...model, src: modelSrc, poster: posterSrc };
              const previewReady = Boolean(parsedPrefetch[modelSrc] || prefetched[modelSrc]);
              const progress = progressMap[modelSrc] ?? 0;
              const cardKey = model.title;
              const isVisible = visibleCards[cardKey];
              const shouldRenderPreview = showcaseVisible && isVisible;
              const dprCap = deviceTier === "full" ? 1.5 : deviceTier === "medium" ? 1.1 : 1;
              const ambientIntensity = deviceTier === "full" ? 1.1 : deviceTier === "medium" ? 0.95 : 0.75;
              const dirIntensity = deviceTier === "full" ? 0.9 : deviceTier === "medium" ? 0.75 : 0.6;
              return (
              <article
                key={model.title}
                className="showcase-card-v2"
                data-key={cardKey}
                onClick={() => handleShowcaseOpen(resolvedModel)}
                style={{ animationDelay: `${index * 0.15}s` }}
              >
                <div className="showcase-preview">
                    <div className={`showcase-poster showcase-poster-${model.accent}`} style={{ backgroundColor: 'rgba(16, 18, 27, 0.95)' }}>
                      <div className="preview-canvas" style={{ width: '100%', height: '100%', position: 'relative' }}>
                        {!previewReady && (
                          <div className="preview-loader rich-loader">
                            <div className="loader-glow" aria-hidden="true" />
                            <div className="loader-ring" aria-hidden="true">
                              <div className="loader-dot" />
                            </div>
                            <div className="loader-meta">
                              <span className="loader-label">Preparing</span>
                              <span className="loader-value">{Math.max(5, progress)}%</span>
                            </div>
                            <div className="loader-bar" aria-hidden="true">
                              <div className="loader-bar-fill" style={{ width: `${Math.max(5, progress)}%` }} />
                            </div>
                          </div>
                        )}
                        {shouldRenderPreview && (
                          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Canvas
                              style={{ width: '100%', height: '100%' }}
                              dpr={Math.min(dprCap, window.devicePixelRatio || 1)}
                              frameloop="demand"
                              gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
                              onCreated={({ gl }) => {
                                try {
                                  if ('outputColorSpace' in gl) {
                                    gl.outputColorSpace = THREE.SRGBColorSpace;
                                  }
                                  gl.toneMappingExposure = 1.05;
                                  if (typeof gl.useLegacyLights !== 'undefined') gl.useLegacyLights = false;
                                } catch (e) {}
                              }}
                            >
                              <PerspectiveCamera makeDefault fov={75} position={[-0.5, 1, 10]} />
                              <ambientLight intensity={ambientIntensity} />
                              <directionalLight intensity={dirIntensity} position={[5, 5, 5]} />
                              <PreviewGLTF
                                gltf={parsedPrefetch[modelSrc] || prefetched[modelSrc]}
                                src={modelSrc}
                                fitSize={6}
                                fitAxis="y"
                                position={[0, 0, 0]}
                              />
                            </Canvas>
                          </div>
                        )}
                      </div>
                    </div>
                  <div className="showcase-expand-hint">
                    <span>⚡ Click to expand</span>
                  </div>
                </div>

                <div className="showcase-content">
                  <div className="showcase-meta">
                    <span className="showcase-tag">Real-time Render</span>
                  </div>
                  <h3 className="showcase-card-title">{model.title}</h3>
                  <p className="showcase-card-desc">{model.desc}</p>
                  <div className="showcase-actions">
                    <button
                      type="button"
                      className="showcase-btn showcase-btn-primary"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleShowcaseOpen(resolvedModel);
                      }}
                      aria-label={`View ${model.title} in fullscreen`}
                    >
                      Fullscreen
                    </button>
                    <a
                      href={modelSrc}
                      download
                      className="showcase-btn showcase-btn-secondary"
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

        <footer className="site-footer">
          <p>© 2025 Objekta. Built for 3D design teams.</p>
        </footer>
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
