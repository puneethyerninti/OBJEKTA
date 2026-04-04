/**
 * README: Render <SpaceBackground /> inside a relatively positioned hero container.
 * Place it before your hero content so the canvas sits behind text.
 */
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import PostProcess from './PostProcess';
import planetVert from '../../shaders/planet.vert?raw';
import planetFrag from '../../shaders/planet.frag?raw';
import atmosphereFrag from '../../shaders/atmosphere.frag?raw';
import ringFrag from '../../shaders/ring.frag?raw';
import starVert from '../../shaders/starfield.vert?raw';
import starFrag from '../../shaders/starfield.frag?raw';

/** @typedef {'high' | 'medium' | 'low'} Quality */

const QUALITY_SETTINGS = {
  high: { dpr: 1.5, bloom: 0.75, threshold: 0.3, smoothing: 0.75, vignette: 0.32 },
  medium: { dpr: 1.0, bloom: 0.6, threshold: 0.35, smoothing: 0.8, vignette: 0.4 },
  low: { dpr: 0.75, bloom: 0.45, threshold: 0.4, smoothing: 0.85, vignette: 0.48 },
};

const DEFAULT_QUALITY = 'high';

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

const Starfield = ({ count = 4500, radius = 14, paused }) => {
  const materialRef = useRef(null);

  const geometry = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const seeds = new Float32Array(count);
    for (let i = 0; i < count; i += 1) {
      const r = radius * Math.cbrt(Math.random());
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(THREE.MathUtils.randFloatSpread(2));
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi);
      sizes[i] = THREE.MathUtils.randFloat(0.6, 1.6);
      seeds[i] = Math.random();
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
    return geo;
  }, [count, radius]);

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: starVert,
        fragmentShader: starFrag,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: {
          uTime: { value: 0 },
          uTint: { value: new THREE.Color('#cfe8ff') },
          uIntensity: { value: 1.0 },
        },
      }),
    [],
  );

  useEffect(() => () => material.dispose(), [material]);
  useEffect(() => () => geometry.dispose(), [geometry]);

  useFrame((state) => {
    if (paused) return;
    material.uniforms.uTime.value = state.clock.getElapsedTime();
  });

  return <points geometry={geometry} material={material} ref={materialRef} />;
};

const Planet = ({ paused }) => {
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: planetVert,
        fragmentShader: planetFrag,
        uniforms: {
          uTime: { value: 0 },
          uLightDir: { value: new THREE.Vector3(1, 0.4, 0.2).normalize() },
        },
      }),
    [],
  );

  useEffect(() => () => material.dispose(), [material]);

  useFrame((state) => {
    if (paused) return;
    material.uniforms.uTime.value = state.clock.getElapsedTime();
  });

  return (
    <mesh position={[0, 0.15, -2.2]} scale={2.35}>
      <icosahedronGeometry args={[1, 5]} />
      <primitive object={material} attach="material" />
    </mesh>
  );
};

const Atmosphere = ({ paused }) => {
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: planetVert,
        fragmentShader: atmosphereFrag,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: {
          uTime: { value: 0 },
          uGlowColor: { value: new THREE.Color('#58d2ff') },
        },
      }),
    [],
  );

  useEffect(() => () => material.dispose(), [material]);

  useFrame((state) => {
    if (paused) return;
    material.uniforms.uTime.value = state.clock.getElapsedTime();
  });

  return (
    <mesh position={[0, 0.15, -2.2]} scale={2.5}>
      <icosahedronGeometry args={[1, 5]} />
      <primitive object={material} attach="material" />
    </mesh>
  );
};

const Ring = ({ paused }) => {
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: planetVert,
        fragmentShader: ringFrag,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        uniforms: {
          uTime: { value: 0 },
        },
      }),
    [],
  );

  useEffect(() => () => material.dispose(), [material]);

  useFrame((state) => {
    if (paused) return;
    material.uniforms.uTime.value = state.clock.getElapsedTime();
  });

  return (
    <mesh position={[0, 0.15, -2.2]} rotation={[0.45, 0.1, -0.2]} scale={2.55}>
      <ringGeometry args={[1.2, 1.8, 128, 2]} />
      <primitive object={material} attach="material" />
    </mesh>
  );
};

const DustBelt = ({ count = 700, paused }) => {
  const pointsRef = useRef(null);

  const geometry = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const seeds = new Float32Array(count);
    for (let i = 0; i < count; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const radius = THREE.MathUtils.randFloat(1.35, 1.75);
      positions[i * 3] = Math.cos(angle) * radius;
      positions[i * 3 + 1] = THREE.MathUtils.randFloatSpread(0.06);
      positions[i * 3 + 2] = Math.sin(angle) * radius;
      seeds[i] = Math.random();
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
    return geo;
  }, [count]);

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: starVert,
        fragmentShader: starFrag,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: {
          uTime: { value: 0 },
          uTint: { value: new THREE.Color('#7cc8ff') },
          uIntensity: { value: 0.6 },
        },
      }),
    [],
  );

  useEffect(() => () => material.dispose(), [material]);
  useEffect(() => () => geometry.dispose(), [geometry]);

  useFrame((state) => {
    if (paused) return;
    material.uniforms.uTime.value = state.clock.getElapsedTime();
    if (pointsRef.current) {
      pointsRef.current.rotation.y = state.clock.getElapsedTime() * 0.08;
    }
  });

  return (
    <points ref={pointsRef} geometry={geometry} material={material} position={[0, 0.15, -2.2]} />
  );
};

const NebulaPlane = ({ position, scale, speed = 0.02 }) => {
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: planetVert,
        fragmentShader: `
          precision highp float;
          uniform float uTime;
          varying vec2 vUv;
          float hash(vec2 p){
            p = fract(p * vec2(123.34, 456.21));
            p += dot(p, p + 45.32);
            return fract(p.x * p.y);
          }
          float noise(vec2 p){
            vec2 i = floor(p);
            vec2 f = fract(p);
            float a = hash(i);
            float b = hash(i + vec2(1.0, 0.0));
            float c = hash(i + vec2(0.0, 1.0));
            float d = hash(i + vec2(1.0, 1.0));
            vec2 u = f * f * (3.0 - 2.0 * f);
            return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
          }
          float fbm(vec2 p){
            float v = 0.0;
            float a = 0.5;
            for (int i = 0; i < 4; i++) {
              v += a * noise(p);
              p *= 2.0;
              a *= 0.5;
            }
            return v;
          }
          void main(){
            vec2 uv = vUv;
            float t = uTime * ${speed.toFixed(3)};
            vec2 q = uv * 3.0 + vec2(t * 0.2, -t * 0.15);
            float n = fbm(q);
            vec3 col = mix(vec3(0.05, 0.08, 0.18), vec3(0.22, 0.16, 0.42), n);
            col = mix(col, vec3(0.0, 0.45, 0.65), n * 0.45);
            float alpha = smoothstep(0.25, 0.85, n) * 0.18;
            gl_FragColor = vec4(col, alpha);
          }
        `,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        uniforms: { uTime: { value: 0 } },
      }),
    [speed],
  );

  useEffect(() => () => material.dispose(), [material]);

  useFrame((state) => {
    material.uniforms.uTime.value = state.clock.getElapsedTime();
  });

  return (
    <mesh position={position} scale={scale}>
      <planeGeometry args={[1, 1, 1, 1]} />
      <primitive object={material} attach="material" />
    </mesh>
  );
};

const SpaceScene = ({ paused }) => {
  const { viewport } = useThree();

  return (
    <group>
      <NebulaPlane position={[0, 0.2, -6]} scale={[viewport.width * 2, viewport.height * 2, 1]} speed={0.02} />
      <NebulaPlane position={[0.4, -0.3, -5.2]} scale={[viewport.width * 1.6, viewport.height * 1.6, 1]} speed={0.028} />
      <Starfield paused={paused} />
      <Planet paused={paused} />
      <Atmosphere paused={paused} />
      <Ring paused={paused} />
      <DustBelt paused={paused} />
    </group>
  );
};

/**
 * @param {{ quality?: Quality, className?: string }} props
 */
const SpaceBackground = ({ quality = DEFAULT_QUALITY, className = '' }) => {
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
  const shouldFallback = !webglAvailable && false;
  const downsampleScale = isLowPower || isMobile ? 0.5 : 1;
  const dprScale = isLowPower || isMobile ? 0.8 : 1;
  const dpr = Math.max(0.5, settings.dpr * dprScale);
  const paused = prefersReducedMotion || isHidden;

  const containerStyle = {
    position: 'fixed',
    inset: 0,
    pointerEvents: 'none',
    zIndex: 'var(--z-canvas)',
  };

  if (shouldFallback) {
    return (
      <div className={className} aria-hidden="true" style={containerStyle}>
        <div className="bg-blob-fallback" style={{ position: 'absolute', inset: 0 }} />
      </div>
    );
  }

  return (
    <div className={className} aria-hidden="true" style={containerStyle}>
      <Canvas
        dpr={dpr}
        camera={{ position: [0, 0, 6], fov: 45 }}
        gl={{
          alpha: true,
          antialias: quality !== 'low',
          powerPreference: isLowPower ? 'low-power' : 'high-performance',
        }}
        onCreated={({ gl }) => {
          gl.setClearColor(new THREE.Color('#05070d'), 1);
          gl.toneMappingExposure = 1.15;
          if ('outputColorSpace' in gl) {
            gl.outputColorSpace = THREE.SRGBColorSpace;
          }
        }}
        frameloop={paused ? 'never' : 'always'}
        style={{ width: '100%', height: '100%' }}
      >
        <color attach="background" args={['#05070d']} />
        <SpaceScene paused={paused} />
        <PostProcess
          quality={effectiveQuality}
          downsampleScale={downsampleScale}
          bloomIntensity={settings.bloom}
          bloomThreshold={settings.threshold}
          bloomSmoothing={settings.smoothing}
          vignetteDarkness={settings.vignette}
        />
      </Canvas>
    </div>
  );
};

export default SpaceBackground;
