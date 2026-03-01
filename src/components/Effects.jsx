// src/components/Effects.jsx
// Seamless post-processing pipeline — soft bloom glow + cinematic vignette
// Defensive wrapper around EffectComposer to avoid runtime crashes
// Provides optional post-processing effects with graceful degradation when WebGL context is lost
import React from 'react';
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';

// Tuned bloom for ethereal galaxy glow — lower threshold catches stars + nebula
const BLOOM_SETTINGS = {
  luminanceThreshold: 0.42,
  luminanceSmoothing: 0.85,
  intensity: 1.1,
  mipmapBlur: true,
};

/**
 * Renders a collection of post-processing effects.
 */
export default function Effects({ children }) {
  try {
    const extraChildren = React.Children.toArray(children || []);

    const effects = [
      <Bloom key="bloom" {...BLOOM_SETTINGS} />,
      <Vignette key="vignette" eskil={false} offset={0.25} darkness={0.72} />,
      ...extraChildren,
    ].filter(Boolean);

    if (effects.length === 0) {
      return null;
    }

    return <EffectComposer>{effects}</EffectComposer>;
  } catch (err) {
    console.debug('[OBJEKTA] Effects mount skipped (error)', err);
    return null;
  }
}