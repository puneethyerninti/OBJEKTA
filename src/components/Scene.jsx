// src/components/Scene.jsx
// REFACTORED: Lightweight background scene (ONE Canvas for entire homepage)
import React, { Suspense, useState, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';
import TronGrid from './TronGrid';
import Hologram from './Hologram';
import Effects from './Effects';
import ContactShadow from './ContactShadow';
import GridAlphaTester from './GridAlphaTester';

export default function Scene({ prefetchedGltf }) {
  const [effectsEnabled, setEffectsEnabled] = useState(false);
  const [alphaTestOverride, setAlphaTestOverride] = useState(null);
  const [modelBounds, setModelBounds] = useState(null);

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
      dpr={Math.min(2, window.devicePixelRatio || 1)}
      shadows={false}
      gl={{
        powerPreference: 'high-performance',
        antialias: true,
        alpha: true,
        stencil: false,
        depth: true,
        preserveDrawingBuffer: false,
      }}
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
      <OrbitControls
        enableDamping={false}
        // Allow slightly closer camera to keep background model visible
        minDistance={3}
        maxDistance={20}
        target={[0, 1.5, 0]}
        enableRotate={true}
        enableZoom={true}
        enablePan={false}
      />

      <PerspectiveCamera makeDefault fov={70} position={[-0.5, 1, 6]} />

      {/* Exponential fog to reinforce depth cues */}
      <fogExp2 attach="fog" args={[0x000018, 0.025]} />

      {/* Minimal lighting for performance */}
      <ambientLight intensity={0.5} color="#0b1020" />
      <spotLight
        position={[0, 10, 0]}
        intensity={20}
        angle={Math.PI / 8}
        penumbra={0.5}
        color="#2563eb"
      />

      {/* Tron Grid: auto-aligned to model bounds when available */}
      <TronGrid
        // Reduce default grid size/density so it doesn't dominate before the model loads
        size={modelBounds ? Math.max(modelBounds.size.x, modelBounds.size.z) * 2.2 : 140}
        // density inversely proportional to model size for consistent spacing
        density={modelBounds ? Math.max(10, Math.floor(18 * (16 / Math.max(modelBounds.size.x, modelBounds.size.z)))) : 10}
        lineWidth={0.010}
        position={modelBounds ? [modelBounds.center.x, modelBounds.box.min.y - 0.02, modelBounds.center.z] : [0, -3, 0]}
        alphaTestOverride={alphaTestOverride}
      />

      {/* Background City (removed Suspense to show loading placeholder immediately) */}
      <Hologram
        modelPath="/models/cyberpunk_city.glb"
        gltf={prefetchedGltf}
        color={new THREE.Color('#6fb6ff')}
        // Tighter framing so city occupies more of the hero area
        scale={3}
        position={[0, 0.5, -3]}
        fitSize={10}
        fitAxis="y"
        onBoundsComputed={(data) => setModelBounds(data)}
      />
      {/* Soft contact shadow projected under the city to reinforce grounding */}
      <ContactShadow position={[0, -1.2, -3]} radius={10} opacity={0.45} />

      {/* Grid alpha test automated snapshotter (dev only). Enable by setting window.__OBJEKTA_AUTO_ALPHA_TEST = true in the console */}
      {typeof window !== 'undefined' && window.__OBJEKTA_AUTO_ALPHA_TEST && (
        <GridAlphaTester run={true} setAlpha={setAlphaTestOverride} />
      )}

      {/* Post-Processing (guarded) */}
      {effectsEnabled && <Effects />}
    </Canvas>
  );
}