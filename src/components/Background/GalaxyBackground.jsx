import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { getNebulaTexture } from './nebulaTexture';

const buildStars = (count, depth) => {
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const color = new THREE.Color();
  for (let i = 0; i < count; i += 1) {
    const i3 = i * 3;
    const r = THREE.MathUtils.randFloat(12, 48);
    const theta = THREE.MathUtils.randFloatSpread(Math.PI * 2);
    const y = THREE.MathUtils.randFloatSpread(16);
    positions[i3] = Math.cos(theta) * r;
    positions[i3 + 1] = y;
    positions[i3 + 2] = -Math.random() * depth;
    const hue = 200 + Math.random() * 60;
    const sat = 0.4 + Math.random() * 0.25;
    const light = 0.65 + Math.random() * 0.35;
    color.setHSL(hue / 360, sat, light);
    colors[i3] = color.r;
    colors[i3 + 1] = color.g;
    colors[i3 + 2] = color.b;
  }
  return { positions, colors };
};

const Stars = ({ count, depth, twinkle, parallax }) => {
  const pointsRef = useRef(null);
  const { positions, colors } = useMemo(() => buildStars(count, depth), [count, depth]);
  useFrame((state) => {
    if (!pointsRef.current) return;
    const t = state.clock.getElapsedTime();
    pointsRef.current.rotation.z = t * 0.01;
    pointsRef.current.material.opacity = twinkle ? 0.7 + Math.sin(t * 1.2) * 0.12 : 0.8;
    if (parallax?.current) {
      pointsRef.current.position.set(
        parallax.current.x * 0.9,
        parallax.current.y * 0.7,
        parallax.current.z * 7,
      );
    }
  });
  return (
    <points ref={pointsRef} frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={positions.length / 3} array={positions} itemSize={3} />
        <bufferAttribute attach="attributes-color" count={colors.length / 3} array={colors} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial
        size={0.05}
        sizeAttenuation
        depthWrite={false}
        transparent
        opacity={0.82}
        vertexColors
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
};

const NebulaSheets = ({ texture, parallax, activeRef }) => {
  const group = useRef(null);
  const mats = useRef([]);

  useEffect(() => {
    if (!texture) return;
    texture.center.set(0.5, 0.5);
  }, [texture]);

  useFrame((state) => {
    if (!group.current || activeRef?.current === false) return;
    const t = state.clock.getElapsedTime();
    group.current.rotation.z = t * 0.009 + parallax.current.x * 0.06;
    mats.current.forEach((mat, idx) => {
      if (!mat?.map) return;
      mat.map.rotation = 0.1 * idx + Math.sin(t * 0.22 + idx) * 0.08;
      mat.map.offset.x = Math.sin(t * 0.05 + idx * 0.4) * 0.05;
      mat.map.offset.y = Math.cos(t * 0.045 + idx * 0.35) * 0.05;
    });
  });

  return (
    <group ref={group}>
      {[0, 1, 2].map((idx) => (
        <mesh
          key={idx}
          rotation={[Math.PI / 2.35, 0, Math.PI * 0.5 + idx * 0.24]}
          position={[0, -0.6 + idx * 0.55, -10 - idx * 8]}
        >
          <planeGeometry args={[62, 38]} />
          <meshBasicMaterial
            ref={(m) => { mats.current[idx] = m; }}
            map={texture}
            transparent
            opacity={0.72 - idx * 0.16}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
            toneMapped={false}
            color={idx === 0 ? '#9fe8ff' : idx === 1 ? '#6f8dff' : '#3f4f9f'}
          />
        </mesh>
      ))}
    </group>
  );
};

const ShootingStars = ({ count, depth, parallax, prefersReducedMotion, activeRef }) => {
  const meshRef = useRef(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const data = useRef([]);

  const reset = (i) => {
    data.current[i] = {
      x: THREE.MathUtils.randFloatSpread(14),
      y: THREE.MathUtils.randFloat(2, 6),
      z: -THREE.MathUtils.randFloat(6, depth),
      speed: THREE.MathUtils.randFloat(10, 18),
      len: THREE.MathUtils.randFloat(1.4, 2.3),
      tilt: THREE.MathUtils.degToRad(THREE.MathUtils.randFloat(12, 32)),
    };
  };

  useEffect(() => {
    data.current = new Array(count).fill(0).map((_, i) => {
      const obj = {};
      reset(i);
      return obj;
    });
  }, [count]);

  useFrame((state, delta) => {
    if (!meshRef.current || prefersReducedMotion || activeRef?.current === false) return;
    const t = state.clock.getElapsedTime();
    for (let i = 0; i < count; i += 1) {
      const s = data.current[i];
      s.x += s.speed * delta * 0.8;
      s.y += s.speed * delta * 0.18;
      s.z += s.speed * delta * 0.65;
      if (s.x > 9 || s.y > 7 || s.z > -1) {
        reset(i);
        continue;
      }

      dummy.position.set(
        s.x + parallax.current.x * 0.6,
        s.y + parallax.current.y * 0.5,
        s.z + parallax.current.z * 8,
      );
      dummy.rotation.set(-Math.PI / 2 + s.tilt, 0, t * 0.2);
      dummy.scale.set(s.len, s.len * 0.22, 1);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[null, null, count]} renderOrder={5}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial
        transparent
        opacity={0.8}
        color="#9bd5ff"
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        toneMapped={false}
      />
    </instancedMesh>
  );
};

const CursorGlow = ({ texture, parallax, activeRef }) => {
  const meshRef = useRef(null);
  const target = useRef(new THREE.Vector3(0, 0, -18));
  const uniforms = useMemo(() => ({
    uColor: { value: new THREE.Color('#9cd8ff') },
  }), []);

  useFrame((state) => {
    if (!meshRef.current || activeRef?.current === false) return;
    const t = state.clock.getElapsedTime();
    const orbitX = Math.sin(t * 0.18) * 1.6;
    const orbitY = Math.cos(t * 0.14) * 1.2;
    target.current.set(orbitX, orbitY, -18);
    meshRef.current.position.lerp(target.current, 0.08);
    meshRef.current.rotation.z = t * 0.18;
    const pulse = 0.9 + Math.sin(t * 2.0) * 0.22;
    meshRef.current.scale.setScalar(4.4 + pulse * 1.6);
    uniforms.uColor.value.offsetHSL(0, 0, Math.sin(t * 0.4) * 0.01);
  });

  return (
    <mesh ref={meshRef} position={[0, 0, -18]} renderOrder={10}>
      <planeGeometry args={[6, 6]} />
      <shaderMaterial
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        toneMapped={false}
        uniforms={uniforms}
        vertexShader={`
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `}
        fragmentShader={`
          varying vec2 vUv;
          uniform vec3 uColor;
          void main() {
            vec2 p = vUv - 0.5;
            float d = length(p) * 2.2;
            float alpha = smoothstep(0.9, 0.35, d) * 0.65;
            vec3 col = mix(uColor, vec3(0.4, 0.8, 1.0), 1.0 - d);
            gl_FragColor = vec4(col, alpha);
          }
        `}
      />
    </mesh>
  );
};

const PointerOrbs = ({ parallax, prefersReducedMotion, activeRef }) => {
  const meshRef = useRef(null);
  const target = useRef(new THREE.Vector3());

  useFrame((state) => {
    if (!meshRef.current || activeRef?.current === false) return;
    const t = state.clock.getElapsedTime();
    const orbit = 1.25 + Math.sin(t * 0.7) * 0.25;
    target.current.set(Math.cos(t * 0.65) * orbit, Math.sin(t * 0.82) * orbit * 0.7, -10);
    meshRef.current.position.lerp(target.current, 0.08);
    const pulse = 1.05 + Math.sin(t * 2.2) * 0.24;
    meshRef.current.scale.setScalar(0.95 + pulse * 0.35);
    meshRef.current.material.opacity = 0.44 + Math.sin(t * 3.0) * 0.18;
  });

  return (
    <mesh ref={meshRef} position={[0, 0, -10]} renderOrder={11}>
      <sphereGeometry args={[0.32, 22, 22]} />
      <meshBasicMaterial
        color="#8ad8ff"
        transparent
        opacity={0.4}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        toneMapped={false}
      />
    </mesh>
  );
};

const AuroraBand = ({ parallax, activeRef }) => {
  const meshRef = useRef(null);
  useFrame((state) => {
    if (!meshRef.current || activeRef?.current === false) return;
    const t = state.clock.getElapsedTime();
    const wobble = Math.sin(t * 0.5) * 0.32;
    meshRef.current.position.y = 1.35 + wobble + parallax.current.y * 0.32;
    meshRef.current.rotation.z = 0.08 + parallax.current.x * 0.04 + Math.sin(t * 0.22) * 0.012;
  });

  return (
    <mesh ref={meshRef} position={[0, 1.35, -13]} rotation={[Math.PI / 2.45, 0, 0.08]} renderOrder={3}>
      <planeGeometry args={[48, 9, 96, 20]} />
      <shaderMaterial
        vertexShader={`
          varying vec2 vUv;
          void main() {
            vUv = uv;
            vec3 pos = position;
            pos.y += sin(uv.x * 12.0) * 0.35;
            pos.y += sin((uv.x + uv.y) * 6.0) * 0.24;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
          }
        `}
        fragmentShader={`
          varying vec2 vUv;
          void main() {
            float alpha = smoothstep(0.0, 0.2, vUv.y) * (1.0 - smoothstep(0.48, 1.0, vUv.y));
            vec3 col = mix(vec3(0.06, 0.18, 0.52), vec3(0.34, 0.78, 1.02), vUv.x);
            col += vec3(0.12, 0.24, 0.64) * sin(vUv.x * 12.0) * 0.24;
            gl_FragColor = vec4(col, alpha * 0.52);
          }
        `}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        toneMapped={false}
      />
    </mesh>
  );
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

const GalaxyBackground = ({ starCount = 2600, depth = 160, twinkle = true, parallaxStrength = 1.35, scrollStrength = 0.65, shootingCount = 12 }) => {
  const tex = useMemo(() => getNebulaTexture(), []);
  const { scene } = useThree();
  const groupRef = useRef(null);
  const parallax = useRef({ x: 0, y: 0, z: 0, tx: 0, ty: 0, tz: 0 });
  const prefersReducedMotion = usePrefersReducedMotion();
  const prefersSaveData = useRef(false);
  const isActive = useRef(true);

  useEffect(() => {
    return undefined;
  }, [parallaxStrength, scrollStrength]);

  useMemo(() => {
    scene.background = new THREE.Color('#040814');
    scene.fog = new THREE.FogExp2('#040814', 0.012);
  }, [scene]);

  useEffect(() => {
    if (typeof document === 'undefined') return undefined;
    const updateVisibility = () => {
      isActive.current = !document.hidden;
    };
    updateVisibility();
    document.addEventListener('visibilitychange', updateVisibility);
    return () => document.removeEventListener('visibilitychange', updateVisibility);
  }, []);

  useEffect(() => {
    if (typeof navigator === 'undefined') return undefined;
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    prefersSaveData.current = !!connection?.saveData;
    return undefined;
  }, []);

  useFrame((state) => {
    if (!groupRef.current || isActive.current === false) return;
    const motionScale = prefersReducedMotion || prefersSaveData.current ? 0.5 : 1;
    const t = state.clock.getElapsedTime();
    const driftX = Math.sin(t * 0.12) * parallaxStrength * 0.65;
    const driftY = Math.cos(t * 0.1) * parallaxStrength * 0.52;
    const driftZ = Math.sin(t * 0.08) * scrollStrength * 0.8;
    parallax.current.tx = driftX;
    parallax.current.ty = driftY;
    parallax.current.tz = driftZ;
    const maxOffset = 2.7 * motionScale;
    parallax.current.x = THREE.MathUtils.clamp(
      parallax.current.x + (parallax.current.tx - parallax.current.x) * 0.085 * motionScale,
      -maxOffset,
      maxOffset,
    );
    parallax.current.y = THREE.MathUtils.clamp(
      parallax.current.y + (parallax.current.ty - parallax.current.y) * 0.085 * motionScale,
      -maxOffset,
      maxOffset,
    );
    parallax.current.z = THREE.MathUtils.clamp(
      parallax.current.z + (parallax.current.tz - parallax.current.z) * 0.11 * motionScale,
      -maxOffset,
      maxOffset,
    );
    // Base offset keeps glow centered behind hero while parallax adds subtle motion
    groupRef.current.position.set(0.45 + parallax.current.x, 0.25 + parallax.current.y * 0.8, -6 + parallax.current.z * 6);
    groupRef.current.rotation.y = parallax.current.x * 0.05;
    groupRef.current.rotation.x = parallax.current.y * 0.04;
    groupRef.current.rotation.z += (0.00035 + Math.sin(t * 0.12) * 0.0002) * motionScale;
  });

  return (
    <group ref={groupRef} position={[0, 0, -6]}>
      <NebulaSheets texture={tex} parallax={parallax} activeRef={isActive} />
      <Stars count={starCount} depth={depth} twinkle={twinkle && !prefersReducedMotion} parallax={parallax} />
      <ShootingStars
        count={shootingCount}
        depth={depth}
        parallax={parallax}
        prefersReducedMotion={prefersReducedMotion}
        activeRef={isActive}
      />
      {!prefersReducedMotion && <CursorGlow texture={tex} parallax={parallax} activeRef={isActive} />}
      {!prefersReducedMotion && <PointerOrbs parallax={parallax} prefersReducedMotion={prefersReducedMotion} activeRef={isActive} />}
      {!prefersReducedMotion && <AuroraBand parallax={parallax} activeRef={isActive} />}
    </group>
  );
};

export default GalaxyBackground;
