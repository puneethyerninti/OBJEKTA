// src/pages/Home.jsx
// REFACTORED: Production-ready homepage with single Canvas architecture
import React, { useCallback, useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import OverlayUI from "../components/OverlayUI";
import HologramModal from "../components/HologramModal";
import PreviewGLTF from "../components/PreviewGLTF";
import { Canvas } from '@react-three/fiber';
import { PerspectiveCamera } from '@react-three/drei';
import { useAuth } from "../contexts/AuthContext";
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
    src: "/models/cyberpunk_desk.glb",
    title: "Command Desk",
    desc: "Multi-screen control deck for layout, approvals, and lighting passes.",
    accent: "violet",
    poster: "/assets/desk-poster.webp",
  },
  {
    src: "/models/laptop_free.glb",
    title: "Portable Rig",
    desc: "Travel-ready laptop kit showing shader tweaks and annotation overlays.",
    accent: "cyan",
    poster: "/assets/laptop-poster.webp",
  },
  {
    src: "/models/porsche.glb",
    title: "Concept Vehicle",
    desc: "Hero-grade automotive model tuned for material look-dev and lighting overrides.",
    accent: "amber",
    poster: "/assets/porsche-poster.webp",
  },
  {
    src: "/models/black_dragon_with_idle_animation.glb",
    title: "Black Dragon",
    desc: "Creature rig with idle animation and layered surface detail.",
    accent: "violet",
    poster: "/assets/thumbnail-placeholder.svg",
  },
  {
    src: "/models/flynns_arcade.glb",
    title: "Flynn's Arcade",
    desc: "Retro interior scene built for neon lighting and cinematic depth.",
    accent: "cyan",
    poster: "/assets/thumbnail-placeholder.svg",
  },
  {
    src: "/models/gipsy_avenger_-_pacific_rim.glb",
    title: "Gipsy Avenger",
    desc: "Mech-scale asset optimized for real-time material previews.",
    accent: "amber",
    poster: "/assets/thumbnail-placeholder.svg",
  },
  {
    src: "/models/iphone_17_pro.glb",
    title: "iPhone 17 Pro",
    desc: "Product visualization mockup with clean PBR finishes.",
    accent: "cyan",
    poster: "/assets/thumbnail-placeholder.svg",
  },
];



export default function Home() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [prefetched, setPrefetched] = useState({});
  const [activeModel, setActiveModel] = useState(null);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const prefetchedRef = useRef({});
  const backgroundVideoRef = useRef(null);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mediaQuery.matches);
    const handler = (e) => setPrefersReducedMotion(e.matches);
    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  }, []);

  // Keep background video reliably playing (with autoplay safeguards)
  useEffect(() => {
    const videoEl = backgroundVideoRef.current;
    if (!videoEl) return;

    // Ensure autoplay-friendly flags are set in JS as well
    videoEl.muted = true;
    videoEl.loop = true;
    videoEl.playsInline = true;

    const attemptPlay = () => {
      const maybePlay = videoEl.play();
      if (maybePlay && typeof maybePlay.catch === "function") {
        maybePlay.catch(() => {});
      }
    };

    // Try immediately and after metadata load for browsers that gate playback
    attemptPlay();
    videoEl.addEventListener("loadeddata", attemptPlay, { once: true });
    videoEl.addEventListener("canplay", attemptPlay, { once: true });

    return () => {
      videoEl.removeEventListener("loadeddata", attemptPlay);
      videoEl.removeEventListener("canplay", attemptPlay);
    };
  }, []);

  // Prefetch showcase GLTFs so they appear quickly
  useEffect(() => {
    let mounted = true;
    // Prefetch as raw ArrayBuffer to allow parsing inside each Canvas instance.
    const modelsToPrefetch = SHOWCASE_MODELS.map(m => m.src);

    modelsToPrefetch.forEach((src) => {
      if (prefetchedRef.current[src]) return;
      fetch(src).then((res) => res.arrayBuffer()).then((arr) => {
        if (!mounted) return;
        prefetchedRef.current[src] = arr;
        setPrefetched({ ...prefetchedRef.current });
      }).catch((err) => {
        console.debug('[Home] prefetch failed', src, err);
      });
    });

    return () => { mounted = false; };
  }, []);

  // Tilt effect (optimized with RAF throttling)
  useEffect(() => {
    if (prefersReducedMotion) return;
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
  }, [prefersReducedMotion]);

  // Respect reduced motion for background playback
  useEffect(() => {
    const videoEl = backgroundVideoRef.current;
    if (!videoEl) return;
    if (prefersReducedMotion) {
      videoEl.pause();
      return;
    }
    const maybePlay = videoEl.play();
    if (maybePlay && typeof maybePlay.catch === "function") {
      maybePlay.catch(() => {});
    }
  }, [prefersReducedMotion]);

  // Magnetic button effect (optimized)
  useEffect(() => {
    if (prefersReducedMotion) return;
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
  }, [prefersReducedMotion]);

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
      {/* Background video layer (replaces GLB city) */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 0,
          pointerEvents: "none",
          overflow: "hidden",
          opacity: 0.8,
          background: "radial-gradient(circle at 20% 20%, rgba(37, 99, 235, 0.25), transparent 40%), radial-gradient(circle at 80% 60%, rgba(168, 85, 247, 0.18), transparent 45%)",
        }}
        aria-hidden="true"
      >
        <video
          ref={backgroundVideoRef}
          src="/videos/cyberpunk.mp4"
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            filter: "saturate(1.1) contrast(1.05)",
            transform: "scale(1.02)",
          }}
        />
      </div>
      
      {/* UI Overlay (non-blocking) */}
      <div style={{ 
        position: "fixed", 
        inset: 0, 
        zIndex: 1, 
        pointerEvents: "none",
        opacity: 0.85,
      }}>
        <OverlayUI />
      </div>

      {/* Ambient particles (CSS-only, reduced from 3 to 2) */}
      {!prefersReducedMotion && (
        <div className="ambient-particles" aria-hidden="true">
          <div className="particle particle-1" />
          <div className="particle particle-2" />
        </div>
      )}

      <div className="grid-glow" aria-hidden="true" />
      <div className="scanline-overlay" aria-hidden="true" />
      
      <main className="home-shell">
        <section className="hero-grid">
          <div className="hero-copy">
            
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
            <div className="features-scroll-track" style={{ animationPlayState: 'running' }}>
              {[...FEATURE_ITEMS, ...FEATURE_ITEMS].map((item, idx) => (
                <article 
                  key={`${item.title}-${idx}`} 
                  className="feature-card-premium"
                  data-tilt="6"
                >
                  <div className="feature-card-glow" aria-hidden="true"></div>
                  <div className="feature-badge-wrapper">
                    <span className="feature-badge-premium">{item.badge}</span>
                    <div className="feature-badge-trail"></div>
                  </div>
                  <div className="feature-icon-container">
                    <svg className="feature-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      {idx % 3 === 0 && (
                        <>
                          <path d="M20 7L12 3L4 7M20 7L12 11M20 7V17L12 21M12 11L4 7M12 11V21M4 7V17L12 21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                          <circle cx="12" cy="12" r="2" fill="currentColor" opacity="0.6"/>
                        </>
                      )}
                      {idx % 3 === 1 && (
                        <>
                          <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="2"/>
                          <path d="M3 9H21M9 21V9" stroke="currentColor" strokeWidth="2"/>
                          <circle cx="15" cy="15" r="3" stroke="currentColor" strokeWidth="2"/>
                        </>
                      )}
                      {idx % 3 === 2 && (
                        <>
                          <path d="M13 2L3 14H12L11 22L21 10H12L13 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                          <circle cx="12" cy="12" r="1.5" fill="currentColor" opacity="0.8"/>
                        </>
                      )}
                    </svg>
                  </div>
                  <h3 className="feature-title-premium">{item.title}</h3>
                  <p className="feature-desc-premium">{item.desc}</p>
                  <div className="feature-card-border" aria-hidden="true"></div>
                  <div className="feature-hover-indicator">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <path d="M6 12L10 8L6 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
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
            {SHOWCASE_MODELS.map((model, index) => (
              <article
                key={model.title}
                className="showcase-card-v2"
                onClick={() => handleShowcaseOpen(model)}
                style={{ animationDelay: `${index * 0.15}s` }}
              >
                {/* Static preview (no Canvas - use poster image) */}
                <div className="showcase-preview">
                    <div className={`showcase-poster showcase-poster-${model.accent}`} style={{ backgroundColor: 'rgba(16, 18, 27, 0.95)' }}>
                      {/* If we prefetched the GLTF, render it immediately as a static preview */}
                      <div className="preview-canvas" style={{ width: '100%', height: '100%', position: 'relative' }}>
                        {/* Always render the actual model preview (static, no per-part animation) */}
                        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Canvas
                            style={{ width: '100%', height: '100%' }}
                            dpr={Math.min(2, window.devicePixelRatio || 1)}
                            gl={{ antialias: true, alpha: true }}
                            onCreated={({ gl }) => {
                              try {
                                if (typeof gl.useLegacyLights !== 'undefined') gl.useLegacyLights = false;
                              } catch (e) {}
                            }}
                          >
                            <PerspectiveCamera makeDefault fov={75} position={[-0.5, 1, 10]} />
                            <ambientLight intensity={0.9} />
                            <directionalLight intensity={0.6} position={[5, 5, 5]} />
                            <PreviewGLTF gltf={prefetched[model.src]} src={model.src} fitSize={6} fitAxis="y" position={[0, 0, 0]} />
                          </Canvas>
                        </div>
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
                        handleShowcaseOpen(model);
                      }}
                      aria-label={`View ${model.title} in fullscreen`}
                    >
                      Fullscreen
                    </button>
                    <a
                      href={model.src}
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
            ))}
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
