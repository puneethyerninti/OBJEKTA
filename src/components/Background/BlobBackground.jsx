/**
 * README: Render <BlobBackground /> inside a relatively positioned hero container.
 * Place it before your hero content so the canvas sits behind text.
 */
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useState } from 'react';
import * as THREE from 'three';
import PostProcess from './PostProcess';
import blobVert from '../../shaders/blob.vert?raw';
import blobFrag from '../../shaders/blob.frag?raw';

/** @typedef {'high' | 'medium' | 'low'} Quality */

const QUALITY_SETTINGS = {
  high: {
    dpr: 1.5,
    bloomIntensity: 1.35,
    bloomThreshold: 0.2,
    bloomSmoothing: 0.6,
    vignetteDarkness: 0.4,
  },
  medium: {
    dpr: 1.0,
    bloomIntensity: 0.95,
    bloomThreshold: 0.28,
    bloomSmoothing: 0.75,
    vignetteDarkness: 0.5,
  },
  low: {
    dpr: 0.75,
    bloomIntensity: 0.7,
    bloomThreshold: 0.35,
    bloomSmoothing: 0.85,
    vignetteDarkness: 0.56,
  },
};

const DEFAULT_QUALITY = 'medium';

const isWebGLAvailable = () => {
  if (typeof window === 'undefined' || typeof document === 'undefined') return false;
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    const available = !!(window.WebGLRenderingContext && gl);
    // Release the test context to avoid leaking WebGL contexts
    if (gl) {
      const ext = gl.getExtension('WEBGL_lose_context');
      if (ext) ext.loseContext();
    }
    return available;
  } catch (error) {
    return false;
  }
};

const usePrefersReducedMotion = () => {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined;
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setPrefersReducedMotion(mediaQuery.matches);
    update();

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', update);
      return () => mediaQuery.removeEventListener('change', update);
    }

    mediaQuery.addListener(update);
    return () => mediaQuery.removeListener(update);
  }, []);

  return prefersReducedMotion;
};

const useLowPowerHint = () => {
  const [isLowPower, setIsLowPower] = useState(false);

  useEffect(() => {
    if (typeof navigator === 'undefined') return;
    const deviceMemory = navigator.deviceMemory ?? 4;
    const cores = navigator.hardwareConcurrency ?? 4;
    setIsLowPower(deviceMemory <= 4 || cores <= 4);
  }, []);

  return isLowPower;
};

const useIsMobile = () => {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined;
    const mediaQuery = window.matchMedia('(max-width: 768px)');
    const update = () => setIsMobile(mediaQuery.matches);
    update();

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', update);
      return () => mediaQuery.removeEventListener('change', update);
    }

    mediaQuery.addListener(update);
    return () => mediaQuery.removeListener(update);
  }, []);

  return isMobile;
};

const usePageVisibility = () => {
  const [isHidden, setIsHidden] = useState(false);

  useEffect(() => {
    if (typeof document === 'undefined') return undefined;
    const update = () => setIsHidden(document.hidden);
    update();
    document.addEventListener('visibilitychange', update);
    return () => document.removeEventListener('visibilitychange', update);
  }, []);

  return isHidden;
};

const BlobPlane = ({ paused }) => {
  const { size, viewport, gl } = useThree();

  const shaderMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: blobVert,
        fragmentShader: blobFrag,
        transparent: true,
        depthWrite: false,
        uniforms: {
          uTime: { value: 0 },
          uResolution: { value: new THREE.Vector2(1, 1) },
        },
      }),
    [],
  );

  useEffect(() => {
    const pixelRatio = gl.getPixelRatio();
    shaderMaterial.uniforms.uResolution.value.set(
      size.width * pixelRatio,
      size.height * pixelRatio,
    );
  }, [gl, shaderMaterial, size.height, size.width]);

  useEffect(() => () => shaderMaterial.dispose(), [shaderMaterial]);

  useFrame((state) => {
    if (paused) return;
    shaderMaterial.uniforms.uTime.value = state.clock.getElapsedTime();
  });

  return (
    <mesh scale={[viewport.width, viewport.height, 1]} frustumCulled={false}>
      <planeGeometry args={[1, 1, 1, 1]} />
      <primitive object={shaderMaterial} attach="material" />
    </mesh>
  );
};

/**
 * @param {{ quality?: Quality, className?: string }} props
 */
const BlobBackground = ({ quality = DEFAULT_QUALITY, className = '' }) => {
  const prefersReducedMotion = usePrefersReducedMotion();
  const isLowPower = useLowPowerHint();
  const isMobile = useIsMobile();
  const isHidden = usePageVisibility();
  const [webglAvailable, setWebglAvailable] = useState(true);

  useEffect(() => {
    setWebglAvailable(isWebGLAvailable());
  }, []);

  const effectiveQuality = QUALITY_SETTINGS[quality] ? quality : DEFAULT_QUALITY;
  const settings = QUALITY_SETTINGS[effectiveQuality];
  const shouldFallback = prefersReducedMotion || !webglAvailable;
  const downsampleScale = isLowPower || isMobile ? 0.5 : 1;
  const dprScale = isLowPower || isMobile ? 0.8 : 1;
  const dpr = Math.max(0.5, settings.dpr * dprScale);
  const paused = prefersReducedMotion || isHidden;

  if (shouldFallback) {
    return (
      <div
        className={`absolute inset-0 pointer-events-none ${className}`.trim()}
        aria-hidden="true"
        style={{ zIndex: 'var(--z-canvas)' }}
      >
        <div className="bg-blob-fallback absolute inset-0" />
      </div>
    );
  }

  return (
    <div
      className={`absolute inset-0 pointer-events-none ${className}`.trim()}
      aria-hidden="true"
      style={{ zIndex: 'var(--z-canvas)' }}
    >
      <Canvas
        dpr={dpr}
        orthographic
        gl={{
          alpha: true,
          antialias: quality !== 'low',
          powerPreference: isLowPower ? 'low-power' : 'high-performance',
        }}
        camera={{ position: [0, 0, 2], zoom: 1 }}
        frameloop={paused ? 'never' : 'always'}
        style={{ width: '100%', height: '100%' }}
      >
        <color attach="background" args={['transparent']} />
        <BlobPlane paused={paused} />
        <PostProcess
          quality={effectiveQuality}
          downsampleScale={downsampleScale}
          bloomIntensity={settings.bloomIntensity}
          bloomThreshold={settings.bloomThreshold}
          bloomSmoothing={settings.bloomSmoothing}
          vignetteDarkness={settings.vignetteDarkness}
        />
      </Canvas>
    </div>
  );
};

export default BlobBackground;
