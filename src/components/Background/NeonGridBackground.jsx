/**
 * README: Render <NeonGridBackground /> inside a relatively positioned container.
 * Place it before content so the canvas sits behind text.
 */
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';
import { BlendFunction } from 'postprocessing';

const isWebGLAvailable = () => {
  if (typeof window === 'undefined' || typeof document === 'undefined') return false;
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    return !!(window.WebGLRenderingContext && gl);
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

const vertexShader = `
  varying vec3 vWorldPosition;

  void main() {
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPos.xyz;
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;

const fragmentShader = `
  precision highp float;

  varying vec3 vWorldPosition;

  uniform float uTime;
  uniform vec3 uPrimary;
  uniform vec3 uSecondary;
  uniform vec3 uCamPos;
  uniform float uGridScale;
  uniform float uLineWidth;
  uniform vec2 uFlowSpeed;
  uniform vec2 uOffset;
  uniform vec2 uSweepDirA;
  uniform vec2 uSweepDirB;
  uniform float uSweepSpeedA;
  uniform float uSweepSpeedB;
  uniform float uNodePulse;

  float gridLine(float coord, float width) {
    float line = abs(fract(coord) - 0.5);
    return 1.0 - smoothstep(width, width + 0.02, line);
  }

  void main() {
    vec2 grid = vWorldPosition.xz * uGridScale + uOffset + (uFlowSpeed * uTime);
    float fineLine = max(gridLine(grid.x, uLineWidth), gridLine(grid.y, uLineWidth));

    vec2 majorGrid = grid * 0.2;
    float majorLine = max(gridLine(majorGrid.x, uLineWidth * 1.4), gridLine(majorGrid.y, uLineWidth * 1.4));

    float line = max(fineLine * 0.6, majorLine);

    float sweepA = 0.55 + 0.45 * sin(uTime * uSweepSpeedA + dot(vWorldPosition.xz, uSweepDirA) * 0.22);
    float sweepB = 0.55 + 0.45 * sin(uTime * uSweepSpeedB + dot(vWorldPosition.xz, uSweepDirB) * 0.18);
    float sweep = mix(sweepA, sweepB, 0.45);

    vec2 cell = fract(grid) - 0.5;
    float node = 1.0 - smoothstep(0.04, 0.18, length(cell));
    float nodePulse = 0.6 + 0.4 * sin(uTime * 1.2 + (grid.x + grid.y) * 0.1);
    float nodeGlow = node * nodePulse * uNodePulse;

    float glow = line * sweep + nodeGlow * 0.35;

    float dist = length(vWorldPosition - uCamPos);
    float fade = smoothstep(55.0, 10.0, dist);
    float horizon = smoothstep(-10.0, 16.0, vWorldPosition.z);

    vec3 color = mix(uSecondary, uPrimary, glow);
    float alpha = glow * fade * (0.48 + 0.42 * horizon);

    gl_FragColor = vec4(color, alpha);
  }
`;

const GridPlane = ({ paused, settings }) => {
  const materialRef = useRef(null);
  const { camera } = useThree();

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader,
        fragmentShader,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: {
          uTime: { value: 0 },
          uPrimary: { value: new THREE.Color(settings.primary) },
          uSecondary: { value: new THREE.Color(settings.secondary) },
          uCamPos: { value: new THREE.Vector3() },
          uGridScale: { value: settings.gridScale },
          uLineWidth: { value: settings.lineWidth },
          uFlowSpeed: { value: new THREE.Vector2(settings.flowX, settings.flowY) },
          uOffset: { value: new THREE.Vector2(settings.offsetX, settings.offsetY) },
          uSweepDirA: { value: new THREE.Vector2(0.9, 0.35).normalize() },
          uSweepDirB: { value: new THREE.Vector2(-0.5, 0.85).normalize() },
          uSweepSpeedA: { value: settings.sweepSpeedA },
          uSweepSpeedB: { value: settings.sweepSpeedB },
          uNodePulse: { value: settings.nodePulse },
        },
      }),
    [],
  );

  useEffect(() => () => material.dispose(), [material]);

  useFrame((state) => {
    if (!paused) {
      material.uniforms.uTime.value = state.clock.getElapsedTime();
    }
    material.uniforms.uCamPos.value.copy(camera.position);
  });

  return (
    <mesh rotation={[-Math.PI / 2.2, 0, 0]} position={[0, settings.height, settings.depth]}>
      <planeGeometry args={[220, 220, 1, 1]} />
      <primitive object={material} attach="material" ref={materialRef} />
    </mesh>
  );
};

const HazePlane = () => (
  <mesh rotation={[-Math.PI / 2.2, 0, 0]} position={[0, -4.7, -6]}>
    <planeGeometry args={[220, 220, 1, 1]} />
    <meshBasicMaterial
      color="#07111c"
      transparent
      opacity={0.25}
      depthWrite={false}
    />
  </mesh>
);

const ParallaxRig = ({ paused }) => {
  const { camera } = useThree();
  const pointer = useRef({ x: 0, y: 0 });
  const target = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const handleMove = (event) => {
      const x = (event.clientX / window.innerWidth) * 2 - 1;
      const y = (event.clientY / window.innerHeight) * 2 - 1;
      pointer.current.x = x;
      pointer.current.y = y;
    };
    const handleScroll = () => {
      target.current.y = Math.min(0.4, window.scrollY / (window.innerHeight * 3));
    };
    window.addEventListener('pointermove', handleMove, { passive: true });
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  useFrame(() => {
    if (paused) return;
    const ease = 0.05;
    target.current.x += (pointer.current.x * 0.6 - target.current.x) * ease;
    target.current.y += (pointer.current.y * -0.4 - target.current.y) * ease;
    const baseX = 0;
    const baseY = 8;
    const baseZ = 18;
    camera.position.x = baseX + target.current.x * 1.2;
    camera.position.y = baseY + target.current.y * 1.1;
    camera.position.z = baseZ;
    camera.lookAt(0, 0, -10);
  });

  return null;
};

const GRID_LAYERS = [
  {
    primary: '#36eaff',
    secondary: '#4d6bff',
    gridScale: 0.32,
    lineWidth: 0.02,
    flowX: 0.02,
    flowY: 0.01,
    offsetX: 0.0,
    offsetY: 0.0,
    sweepSpeedA: 0.7,
    sweepSpeedB: 0.55,
    nodePulse: 0.6,
    height: -4.5,
    depth: -6,
  },
  {
    primary: '#5ff3ff',
    secondary: '#5a7bff',
    gridScale: 0.22,
    lineWidth: 0.018,
    flowX: 0.01,
    flowY: 0.008,
    offsetX: 0.4,
    offsetY: 0.2,
    sweepSpeedA: 0.6,
    sweepSpeedB: 0.5,
    nodePulse: 0.45,
    height: -4.75,
    depth: -8,
  },
  {
    primary: '#7cf7ff',
    secondary: '#6c8cff',
    gridScale: 0.16,
    lineWidth: 0.015,
    flowX: 0.006,
    flowY: 0.004,
    offsetX: -0.6,
    offsetY: 0.3,
    sweepSpeedA: 0.45,
    sweepSpeedB: 0.4,
    nodePulse: 0.3,
    height: -5.0,
    depth: -11,
  },
];

const NeonGridBackground = ({ className = '' }) => {
  const prefersReducedMotion = usePrefersReducedMotion();
  const isLowPower = useLowPowerHint();
  const isHidden = usePageVisibility();
  const [webglAvailable, setWebglAvailable] = useState(true);

  useEffect(() => {
    setWebglAvailable(isWebGLAvailable());
  }, []);

  const shouldFallback = prefersReducedMotion || !webglAvailable;
  const dpr = isLowPower ? 0.75 : 1.1;
  const paused = prefersReducedMotion || isHidden;

  if (shouldFallback) {
    return (
      <div
        className={`neon-grid-background ${className}`.trim()}
        aria-hidden="true"
      >
        <div className="neon-grid-fallback" />
      </div>
    );
  }

  return (
    <div className={`neon-grid-background ${className}`.trim()} aria-hidden="true">
      <Canvas
        dpr={dpr}
        gl={{ alpha: true, antialias: !isLowPower, powerPreference: 'high-performance' }}
        camera={{ position: [0, 8, 18], fov: 48, near: 0.1, far: 200 }}
        frameloop={paused ? 'demand' : 'always'}
        style={{ width: '100%', height: '100%' }}
      >
        <color attach="background" args={['transparent']} />
        <fog attach="fog" args={['#03060d', 12, 60]} />
        <HazePlane />
        {GRID_LAYERS.map((settings, index) => (
          <GridPlane key={`grid-${index}`} paused={paused} settings={settings} />
        ))}
        <ParallaxRig paused={paused} />
        {!isLowPower && !prefersReducedMotion && (
          <EffectComposer resolutionScale={0.75} multisampling={0}>
            <Bloom
              intensity={0.35}
              luminanceThreshold={0.25}
              luminanceSmoothing={0.85}
              mipmapBlur
              blendFunction={BlendFunction.SCREEN}
            />
            <Vignette eskil={false} offset={0.2} darkness={0.55} />
          </EffectComposer>
        )}
      </Canvas>
    </div>
  );
};

export default NeonGridBackground;
