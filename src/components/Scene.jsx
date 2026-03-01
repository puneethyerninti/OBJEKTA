// src/components/Scene.jsx
// REFACTORED: Seamless background scene – smooth fade-in, depth fog, ambient glow
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Canvas } from '@react-three/fiber';
import { PerspectiveCamera } from '@react-three/drei';
import Effects from './Effects';
import VolumetricTunnel from './Background/VolumetricTunnel';
import GalaxyBackground from './Background/GalaxyBackground';

export default function Scene() {
  const [effectsEnabled, setEffectsEnabled] = useState(false);
  const [useTunnelBackground, setUseTunnelBackground] = useState(false);
  const [useGalaxyBackground, setUseGalaxyBackground] = useState(true);
  const [ready, setReady] = useState(false);
  const wrapRef = useRef(null);
  const safeDpr = typeof window !== 'undefined' ? (window.devicePixelRatio || 1) : 1;

  useEffect(() => {
    const tunnelEnabled =
      (typeof window !== 'undefined' && window.__OBJEKTA_BG === 'tunnel') ||
      (typeof import.meta !== 'undefined' && import.meta.env && String(import.meta.env.VITE_ENABLE_TUNNEL_BG) === 'true');
    setUseTunnelBackground(tunnelEnabled);
    setUseGalaxyBackground(!tunnelEnabled);
  }, []);

  // Check WebGL2 support on mount
  useEffect(() => {
    try {
      const canvas = document.createElement('canvas');
      const gl2 = canvas.getContext('webgl2');
      const disable =
        (typeof window !== 'undefined' && !!window.__OBJEKTA_DISABLE_POSTFX) ||
        (typeof import.meta !== 'undefined' && import.meta.env && String(import.meta.env.VITE_DISABLE_POSTFX) === 'true');
      setEffectsEnabled(!!gl2 && !disable);
    } catch (_) {
      setEffectsEnabled(false);
    }
  }, []);

  // Smooth fade-in after first render frame
  const handleCreated = useCallback(({ gl }) => {
    try {
      gl.setClearColor(0x000000, 0);
    } catch (e) {
      console.debug('[Scene] Could not set clear color');
    }

    const canvas = gl.domElement;
    const disable =
      (typeof window !== 'undefined' && !!window.__OBJEKTA_DISABLE_POSTFX) ||
      (typeof import.meta !== 'undefined' && import.meta.env && String(import.meta.env.VITE_DISABLE_POSTFX) === 'true');
    const isWebGL2 = !!gl?.capabilities?.isWebGL2;

    const onLost = (e) => {
      try { e?.preventDefault(); } catch (er) {}
      if (!window.__OBJEKTA_CTX_LOST_REPORTED) {
        window.__OBJEKTA_CTX_LOST_REPORTED = true;
        console.debug('[Scene] WebGL context lost');
      }
      setEffectsEnabled(false);
    };

    const onRestored = () => {
      if (window.__OBJEKTA_CTX_LOST_REPORTED) {
        console.debug('[Scene] WebGL context restored');
      }
      window.__OBJEKTA_CTX_LOST_REPORTED = false;
      setTimeout(() => setEffectsEnabled(isWebGL2 && !disable), 100);
    };

    canvas.addEventListener('webglcontextlost', onLost, false);
    canvas.addEventListener('webglcontextrestored', onRestored, false);
    setEffectsEnabled(isWebGL2 && !disable);

    // Trigger smooth fade-in after first frame paints
    requestAnimationFrame(() => {
      requestAnimationFrame(() => setReady(true));
    });
  }, []);

  return (
    <div
      ref={wrapRef}
      className="scene-canvas-wrap"
      style={{
        position: 'fixed',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        opacity: ready ? 1 : 0,
        transition: 'opacity 1.6s cubic-bezier(0.16, 1, 0.3, 1)',
        willChange: 'opacity',
      }}
    >
      <Canvas
        eventSource={typeof document !== 'undefined' ? document : undefined}
        dpr={Math.min(2, safeDpr)}
        shadows={false}
        gl={{
          powerPreference: 'high-performance',
          antialias: true,
          alpha: true,
          stencil: false,
          depth: true,
          preserveDrawingBuffer: false,
        }}
        style={{ width: '100%', height: '100%' }}
        onCreated={handleCreated}
      >
        <PerspectiveCamera makeDefault fov={68} position={[0, 0.4, 9.5]} />

        {/* Subtle ambient fill so objects aren't pure black */}
        <ambientLight intensity={0.06} color="#4a6fff" />

        {/* Galaxy background; opt-out when tunnel flag is set */}
        {useGalaxyBackground && (
          <GalaxyBackground
            starCount={useTunnelBackground ? 0 : 3200}
            twinkle
            depth={220}
            parallaxStrength={1.15}
            scrollStrength={0.55}
            shootingCount={14}
          />
        )}

        {useTunnelBackground && (
          <VolumetricTunnel
            speed={5.8}
            nearColor="#7cf7ff"
            farColor="#2563eb"
            density={36}
            parallaxStrength={0.55}
          />
        )}

        {/* Post-Processing (guarded) */}
        {effectsEnabled && <Effects />}
      </Canvas>
    </div>
  );
}