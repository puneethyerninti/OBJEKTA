// src/components/HologramModal.jsx
// Production-ready fullscreen modal for 3D model viewing
import React, { useEffect, useRef, Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import Hologram from "./Hologram";

export default function HologramModal({ model, onClose }) {
  const modalRef = useRef(null);

  // Handle ESC key to close
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleEscape);
    document.body.style.overflow = "hidden";
    
    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  const colorMap = {
    violet: new THREE.Color("#a78bfa"),
    cyan: new THREE.Color("#22d3ee"),
    amber: new THREE.Color("#fbbf24"),
  };
  const color = colorMap[model.accent] || colorMap.cyan;

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
        className="hologram-modal-container"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          type="button"
          className="hologram-modal-close"
          onClick={onClose}
          aria-label="Close modal"
        >
          ×
        </button>

        {/* 3D Canvas */}
        <div className="hologram-modal-canvas">
          <Canvas
            dpr={Math.min(1.5, window.devicePixelRatio || 1)}
            shadows={false}
            gl={{
              alpha: true,
              antialias: true,
              powerPreference: "high-performance",
              toneMapping: THREE.ACESFilmicToneMapping,
              toneMappingExposure: 1.2,
            }}
            camera={{ position: [-0.5, 1, 10], fov: 75 }}
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
                scale={1.2}
                fitSize={2.8}
                fitAxis="max"
              />
            </Suspense>
            
            <OrbitControls
              enableZoom={true}
              enablePan={false}
              autoRotate={true}
              autoRotateSpeed={1.2}
              target={[0, 1.5, 0]}
              minDistance={5}
              maxDistance={25}
            />
          </Canvas>
        </div>

        {/* Footer Info */}
        <div className="hologram-modal-footer">
          <div>
            <span className="hologram-modal-badge">Fullscreen Mode</span>
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
              onClick={onClose}
              className="hologram-modal-btn hologram-modal-btn-secondary"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
