// src/components/HologramModal.jsx
// Production-ready fullscreen modal for 3D model viewing
import React, { useEffect, useRef, Suspense, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import Hologram from "./Hologram";

export default function HologramModal({ model, onClose }) {
  const modalRef = useRef(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Try to enter native fullscreen when this modal mounts.
  useEffect(() => {
    const el = modalRef.current;
    let entered = false;
    if (el && el.requestFullscreen) {
      el.requestFullscreen().then(() => {
        entered = true;
        setIsFullscreen(Boolean(document.fullscreenElement));
      }).catch(() => {
        // ignore failures (browser may block fullscreen in some cases)
        setIsFullscreen(Boolean(document.fullscreenElement));
      });
    }

    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      // If we entered fullscreen, try to exit it on unmount
      if (entered && document.fullscreenElement) {
        try { document.exitFullscreen(); } catch (e) { /* ignore */ }
      }
    };
  }, []);

  const closeModal = async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      }
    } catch (e) {
      // ignore
    }
    onClose();
  };

  // Handle ESC key to close
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === "Escape") closeModal();
    };
    document.addEventListener("keydown", handleEscape);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "";
    };
  }, []);

  const colorMap = {
    violet: new THREE.Color("#a78bfa"),
    cyan: new THREE.Color("#22d3ee"),
    amber: new THREE.Color("#fbbf24"),
  };
  const safeDpr = typeof window !== "undefined" ? (window.devicePixelRatio || 1) : 1;
  const color = colorMap[model.accent] || colorMap.cyan;
  const modalPosition = model.fullscreenPosition || model.previewPosition || [0, 0, 0];
  const modalRotation = model.fullscreenRotation || model.previewRotation || [0, 0, 0];
  const modalTarget = model.fullscreenTarget || [0, 1.0, 0];
  const modalFitSize = isFullscreen
    ? (model.fullscreenFitSize || 5)
    : (model.modalFitSize || 3.5);

  return (
    <div
      className="hologram-modal-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div
        ref={modalRef}
        className={`hologram-modal-container ${isFullscreen ? 'hologram-fullscreen' : ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button (hidden when native fullscreen is active) */}
        {!isFullscreen && (
          <button
            type="button"
            className="hologram-modal-close"
            onClick={closeModal}
            aria-label="Close modal"
          >
            ×
          </button>
        )}

        {/* 3D Canvas */}
        <div className="hologram-modal-canvas" style={{ width: '100%', height: isFullscreen ? '100vh' : '60vh' }}>
          <Canvas
            style={{ width: '100%', height: '100%' }}
            dpr={Math.min(1.5, safeDpr)}
            shadows={false}
            gl={{
              alpha: true,
              antialias: true,
              powerPreference: "high-performance",
              toneMapping: THREE.ACESFilmicToneMapping,
              toneMappingExposure: 1.2,
            }}
            camera={{ position: [0, 2, 12], fov: isFullscreen ? 45 : 50 }}
          >
            <ambientLight intensity={1.2} />
            <spotLight
              position={[10, 10, 10]}
              angle={0.2}
              penumbra={0.8}
              intensity={15}
              color={color}
            />
            <pointLight position={[-10, -10, -10]} intensity={1.5} color={color} />
            <pointLight position={[5, -5, 5]} intensity={1} color="#ffffff" />
            <directionalLight position={[0, 10, 5]} intensity={2} color="#ffffff" />
            
            <Suspense fallback={null}>
              <Hologram
                modelPath={model.src}
                color={color}
                scale={isFullscreen ? 1.8 : 1.4}
                fitSize={modalFitSize}
                fitAxis="max"
                showPlaceholder={!isFullscreen}
                position={modalPosition}
                rotation={modalRotation}
              />
            </Suspense>
            
            <OrbitControls
              enableZoom={true}
              enablePan={true}
              autoRotate={true}
              autoRotateSpeed={1.2}
              target={modalTarget}
              minDistance={3}
              maxDistance={30}
            />
          </Canvas>
        </div>

        {/* Footer Info - hidden when native fullscreen is active */}
        {!isFullscreen && (
          <div className="hologram-modal-footer">
            <div>
              <span className="hologram-modal-badge">Preview</span>
              <h3 className="hologram-modal-title" id="modal-title">{model.title}</h3>
              <p className="hologram-modal-desc">{model.desc}</p>
            </div>
            <div className="hologram-modal-actions">
              <a
                href={model.src}
                download
                className="hologram-modal-btn hologram-modal-btn-primary"
              >
                Download GLB
              </a>
              <button
                type="button"
                onClick={closeModal}
                className="hologram-modal-btn hologram-modal-btn-secondary"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
