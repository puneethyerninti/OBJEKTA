// src/components/Scene.jsx
// REFACTORED: Lightweight background scene (ONE Canvas for entire homepage)
import React, { useState, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { PerspectiveCamera } from '@react-three/drei';
import Effects from './Effects';
import VolumetricTunnel from './Background/VolumetricTunnel';
import GalaxyBackground from './Background/GalaxyBackground';

export default function Scene() {
  const [effectsEnabled, setEffectsEnabled] = useState(false);
  const [useTunnelBackground, setUseTunnelBackground] = useState(false);
  const [useGalaxyBackground, setUseGalaxyBackground] = useState(true);
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

  return (
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
      style={{ position: 'fixed', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
      onCreated={({ gl }) => {
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
          try {
            e?.preventDefault();
          } catch (er) {}
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
      }}
    >
      <PerspectiveCamera makeDefault fov={68} position={[0, 0.4, 9.5]} />

      {/* Galaxy background; opt-out when tunnel flag is set */}
      {useGalaxyBackground && (
        <GalaxyBackground
          starCount={useTunnelBackground ? 0 : 2600}
          twinkle
          depth={180}
          parallaxStrength={1.35}
          scrollStrength={0.65}
          shootingCount={12}
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

      {/* Grid alpha test disabled for galaxy background */}

      {/* Post-Processing (guarded) */}
      {effectsEnabled && <Effects />}
    </Canvas>
  );
}