// src/pages/Home.jsx
// REFACTORED: Production-ready homepage with single Canvas architecture
import React, { useCallback, useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import Scene from "../components/Scene";
import OverlayUI from "../components/OverlayUI";
import HologramModal from "../components/HologramModal";
import PreviewGLTF from "../components/PreviewGLTF";
import { Canvas } from '@react-three/fiber';
import { PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
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
];



export default function Home() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [prefetched, setPrefetched] = useState({});
  const [activeModel, setActiveModel] = useState(null);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const prefetchedRef = useRef({});

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mediaQuery.matches);
    const handler = (e) => setPrefersReducedMotion(e.matches);
    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  }, []);

  // Prefetch showcase GLTFs on mount so previews appear quickly
  useEffect(() => {
    let mounted = true;
    // Prefetch as raw ArrayBuffer to allow parsing inside each Canvas instance.
    SHOWCASE_MODELS.forEach((m) => {
      if (prefetchedRef.current[m.src]) return;
      fetch(m.src).then((res) => res.arrayBuffer()).then((arr) => {
        if (!mounted) return;
        prefetchedRef.current[m.src] = arr;
        setPrefetched({ ...prefetchedRef.current });
      }).catch((err) => {
        console.debug('[Home] prefetch failed', m.src, err);
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
      {/* Single Background Canvas - ONLY instance on page */}
      <div style={{ 
        position: "fixed", 
        inset: 0, 
        zIndex: 0, 
        pointerEvents: "none",
        opacity: 0.7,
      }}>
        <Scene />
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
      
      <Navbar />

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
          <div className="features-grid">
            {FEATURE_ITEMS.map((item) => (
              <article 
                key={item.title} 
                className="feature-card-mini panel-glass card-3d is-visible" 
                data-tilt="8"
              >
                <span className="feature-badge">{item.badge}</span>
                <h3 className="feature-title">{item.title}</h3>
                <p className="feature-desc">{item.desc}</p>
              </article>
            ))}
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
