import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';

const DEFAULT_NEAR = '#6ff3ff';
const DEFAULT_FAR = '#2563eb';
const BASE_DEPTH = 90;

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

const makeRadialTexture = (inner, outer) => {
  if (typeof document === 'undefined') return null;
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(size / 2, size / 2, size * 0.1, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, `${inner}ff`);
  gradient.addColorStop(1, `${outer}00`);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.encoding = THREE.sRGBEncoding;
  return texture;
};

const buildRingData = (count, depth) =>
  new Array(count).fill(0).map((_, i) => ({
    baseZ: -i * (depth / count),
    wobble: 0.35 + Math.random() * 0.45,
    angular: Math.random() * Math.PI * 2,
    scale: 1 + i * 0.018,
  }));

const buildSheetData = (count, depth) =>
  new Array(count).fill(0).map((_, i) => ({
    baseZ: -3 - i * (depth / count),
    angle: Math.random() * Math.PI * 2,
    tilt: -0.12 + Math.random() * 0.24,
    offsetX: (Math.random() - 0.5) * 2.5,
    offsetY: (Math.random() - 0.5) * 1.8,
    stretch: 0.8 + Math.random() * 0.5,
  }));

const ParallaxTarget = ({ strength, parallax }) => {
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const handleMove = (event) => {
      const x = (event.clientX / window.innerWidth) * 2 - 1;
      const y = (event.clientY / window.innerHeight) * 2 - 1;
      parallax.current.targetX = x * strength;
      parallax.current.targetY = -y * strength * 0.7;
    };
    const handleScroll = () => {
      const scrollProgress = Math.min(0.6, window.scrollY / (window.innerHeight * 2.5));
      parallax.current.targetZ = scrollProgress * -4;
    };
    window.addEventListener('pointermove', handleMove, { passive: true });
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('scroll', handleScroll);
    };
  }, [strength, parallax]);

  return null;
};

const TunnelRings = ({ count, depth, speed, colorNear, colorFar, parallax, paused }) => {
  const meshRef = useRef(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const data = useMemo(() => buildRingData(count, depth), [count, depth]);
  const near = useMemo(() => new THREE.Color(colorNear), [colorNear]);
  const far = useMemo(() => new THREE.Color(colorFar), [colorFar]);
  const color = useMemo(() => new THREE.Color(), []);

  useEffect(() => {
    if (!meshRef.current) return;
    for (let i = 0; i < count; i += 1) {
      const mix = i / count;
      color.lerpColors(near, far, mix);
      meshRef.current.setColorAt(i, color);
    }
    meshRef.current.instanceColor.needsUpdate = true;
  }, [color, near, far, count]);

  useFrame((state) => {
    if (!meshRef.current) return;
    const time = state.clock.getElapsedTime();
    const travel = (time * speed) % depth;

    for (let i = 0; i < count; i += 1) {
      const ring = data[i];
      let z = ring.baseZ + travel;
      if (z > 4) z -= depth;
      const wobble = ring.wobble * Math.sin(time * 0.6 + ring.angular);
      const scale = ring.scale + wobble * 0.08;

      dummy.position.set(
        parallax.current.x * 0.35,
        parallax.current.y * 0.25,
        z + parallax.current.z,
      );
      dummy.rotation.set(Math.PI / 2, 0, time * 0.08 + ring.angular * 0.25);
      dummy.scale.setScalar(scale);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    }

    if (!paused) {
      meshRef.current.instanceMatrix.needsUpdate = true;
    }
  });

  return (
    <instancedMesh ref={meshRef} args={[null, null, count]}
      castShadow={false}
      receiveShadow={false}
    >
      <torusGeometry args={[3.2, 0.09, 12, 64]} />
      <meshStandardMaterial
        color={colorNear}
        emissive={colorFar}
        emissiveIntensity={1.3}
        roughness={0.35}
        metalness={0.08}
        transparent
        opacity={0.9}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </instancedMesh>
  );
};

const LightSheets = ({ count, depth, speed, texture, parallax, paused }) => {
  const meshRef = useRef(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const data = useMemo(() => buildSheetData(count, depth), [count, depth]);

  useFrame((state) => {
    if (!meshRef.current) return;
    const time = state.clock.getElapsedTime();
    const travel = (time * speed * 0.55) % depth;

    for (let i = 0; i < count; i += 1) {
      const sheet = data[i];
      let z = sheet.baseZ + travel;
      if (z > 8) z -= depth;
      const drift = Math.sin(time * 0.5 + sheet.angle) * 0.6;

      dummy.position.set(
        sheet.offsetX + parallax.current.x * 0.5,
        sheet.offsetY + parallax.current.y * 0.35,
        z + parallax.current.z,
      );
      dummy.rotation.set(-Math.PI / 2 + sheet.tilt, sheet.angle, sheet.tilt * 1.5);
      const scale = sheet.stretch + Math.sin(time * 0.6 + sheet.angle) * 0.08 + 1.0;
      dummy.scale.set(6.4 * scale, 6.4 * (0.28 + sheet.stretch), 1);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    }

    if (!paused) {
      meshRef.current.instanceMatrix.needsUpdate = true;
    }
  });

  return (
    <instancedMesh ref={meshRef} args={[null, null, count]}
      castShadow={false}
      receiveShadow={false}
    >
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial
        map={texture}
        transparent
        opacity={0.42}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        toneMapped={false}
        color={new THREE.Color('#9fd3ff')}
      />
    </instancedMesh>
  );
};

const StarDust = ({ count, depth, parallax, paused }) => {
  const pointsRef = useRef(null);
  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i += 1) {
      arr[i * 3] = (Math.random() - 0.5) * 6.5;
      arr[i * 3 + 1] = (Math.random() - 0.5) * 3.5;
      arr[i * 3 + 2] = -Math.random() * depth;
    }
    return arr;
  }, [count, depth]);

  useFrame((state, delta) => {
    if (!pointsRef.current) return;
    if (paused) return;
    const positionsAttr = pointsRef.current.geometry.attributes.position;
    const len = positionsAttr.count;
    for (let i = 0; i < len; i += 1) {
      let z = positionsAttr.getZ(i) + delta * 6;
      if (z > 4) z -= depth;
      positionsAttr.setZ(i, z);
    }
    positionsAttr.needsUpdate = true;
    pointsRef.current.position.set(parallax.current.x * 0.25, parallax.current.y * 0.18, parallax.current.z);
  });

  return (
    <points ref={pointsRef} frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={positions.length / 3} array={positions} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial
        size={0.04}
        sizeAttenuation
        depthWrite={false}
        transparent
        opacity={0.6}
        blending={THREE.AdditiveBlending}
        color="#b9e2ff"
      />
    </points>
  );
};

const VolumetricTunnel = ({
  speed = 5.5,
  nearColor = DEFAULT_NEAR,
  farColor = DEFAULT_FAR,
  density = 40,
  parallaxStrength = 0.55,
}) => {
  const prefersReducedMotion = usePrefersReducedMotion();
  const isLowPower = useLowPowerHint();
  const isHidden = usePageVisibility();
  const texture = useMemo(() => makeRadialTexture('#ffffff', '#0b1530'), []);
  const parallax = useRef({ x: 0, y: 0, z: 0, targetX: 0, targetY: 0, targetZ: 0 });
  const ringCount = Math.max(16, Math.floor(isLowPower ? density * 0.6 : density));
  const sheetCount = isLowPower ? 5 : 9;
  const depth = BASE_DEPTH;
  const paused = prefersReducedMotion || isHidden;

  useFrame(() => {
    if (prefersReducedMotion) return;
    parallax.current.x += (parallax.current.targetX - parallax.current.x) * 0.04;
    parallax.current.y += (parallax.current.targetY - parallax.current.y) * 0.04;
    parallax.current.z += (parallax.current.targetZ - parallax.current.z) * 0.06;
  });

  if (prefersReducedMotion) return null;

  return (
    <group position={[0, 0, -6]}>
      <ParallaxTarget strength={parallaxStrength} parallax={parallax} />
      <TunnelRings
        count={ringCount}
        depth={depth}
        speed={isLowPower ? speed * 0.7 : speed}
        colorNear={nearColor}
        colorFar={farColor}
        parallax={parallax}
        paused={paused}
      />
      <LightSheets
        count={sheetCount}
        depth={depth}
        speed={isLowPower ? speed * 0.5 : speed}
        texture={texture}
        parallax={parallax}
        paused={paused}
      />
      <StarDust
        count={isLowPower ? 220 : 420}
        depth={depth}
        parallax={parallax}
        paused={paused}
      />
    </group>
  );
};

export default VolumetricTunnel;
