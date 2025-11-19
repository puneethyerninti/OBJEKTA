// src/components/Effects.jsx
// Defensive wrapper around EffectComposer to avoid runtime crashes seen at EffectComposer.tsx:141
// Provides optional post-processing effects with graceful degradation when WebGL context is lost
// Dev: If backend not running you can still test 3D by: cd backend && npm install && npm run dev
import React from 'react';
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';

// NOTE: Using a minimal effect set for compatibility with postprocessing 6.30.1 & three r152.
// Glitch & ChromaticAberration removed to avoid potential pass init issues in older matrix.

// Define effect settings as constants
const BLOOM_SETTINGS = {
  luminanceThreshold: 0.98,
  intensity: 0.7,
  mipmapBlur: true,
};

// Removed advanced effect configs for stability in pinned downgrade.

/**
 * Renders a collection of post-processing effects.
 */
export default function Effects({ children }) {
  try {
    // Auto quality: disable heavier effects on devices likely to struggle
    // Simplified: no dynamic quality logic in downgraded matrix.

    // Normalize any provided children (allows future extension: external effects array)
    const extraChildren = React.Children.toArray(children || []);

    // Build the effects list safely
    const effects = [
      <Bloom key="bloom" {...BLOOM_SETTINGS} />,
      <Vignette key="vignette" eskil={false} offset={0.1} darkness={1.08} />,
      ...extraChildren,
    ].filter(Boolean);

    // If no effects resolved, do not mount EffectComposer (prevents undefined length errors)
    if (effects.length === 0) {
      return null;
    }

    return <EffectComposer>{effects}</EffectComposer>;
  } catch (err) {
    console.debug('[OBJEKTA] Effects mount skipped (error)', err);
    return null; // swallow errors so Canvas continues rendering base scene
  }
}