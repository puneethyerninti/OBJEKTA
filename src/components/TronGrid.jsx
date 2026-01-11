import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// --- GLSL SHADERS (Tron Grid 2.0 - performant neon) ---
const gridVertexShader = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const gridFragmentShader = `
varying vec2 vUv;
uniform float uTime;
uniform vec3 uGridColor;
uniform float uDensity;
uniform float uLineWidth;
uniform float uSpeed;

// Lightweight pseudo-random for subtle dithering
float hash(vec2 p){
  p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
  return fract(sin(p.x + p.y) * 43758.5453);
}

void main(){
  // Scroll the UVs gently to create movement
  vec2 uv = vUv;
  // Much slower vertical motion to keep the grid understated
  uv.y += uTime * uSpeed * 0.02;

  // Compute grid lines
  vec2 g = abs(fract(uv * uDensity) - 0.5);
  float line = min(g.x, g.y);

  // Use screen-space derivative to compute an AA width
  float af = max(fwidth(line), 0.001);
  float targetWidth = max(uLineWidth, af * 0.6);

  // Smooth line with adaptive width using fwidth (better subpixel smoothing)
  float core = 1.0 - smoothstep(targetWidth * 0.5, targetWidth + af, line);

  // Diagonal pulse sweeping across (minimal, softened)
  float diag = fract((uv.x + uv.y) * 0.5 - uTime * uSpeed);
  float pulseRaw = 1.0 - abs(diag - 0.5) * 2.0;
  float pulse = smoothstep(0.0, 0.12, pulseRaw) * 0.45;

  // Vignette to keep edges calmer
  vec2 c = uv - 0.5;
  float vignette = 1.0 - smoothstep(0.48, 0.82, dot(c, c));

  // Very subtle noise to avoid banding (reduced amplitude)
  float grain = mix(0.99, 1.01, hash(uv + uTime * 0.07));

  // Soft cubic falloff for glow to make transitions smoother
  float glowBase = max(0.0, core);
  float glow = (pow(glowBase, 1.1) * 1.0 + pulse * 0.08) * vignette;

  // Vertical fade so the grid is stronger near the bottom (vUv.y ~ 0)
  float vfade = 1.0 - smoothstep(0.28, 0.98, vUv.y);
  glow *= vfade;

  vec3 finalCol = uGridColor * glow * grain * 0.85;
  float outA = clamp(glow, 0.0, 1.0);
  // Apply slight premultiplied alpha feel to avoid haloing with bloom
  gl_FragColor = vec4(finalCol * outA, outA);
}
`;

/**
 * Optimized Tron-style grid floor - 28x28 segments (784 triangles)
 * - Reduced from 100x100 (10,000 triangles) for much better performance
 * - Throttled useFrame updates (every 6th frame)
 * - Simplified shader calculations and reduced visual intensity
 */
export default function TronGrid({
  size = 100,
  // Use a smaller geometry for cheaper fill
  segments = 28,
  color = new THREE.Color('#60a5fa'),
  // Higher density for more gridlines
  density = 40,
  // Thicker lines for better visibility
  lineWidth = 0.025,
  // Slower motion for minimal appearance
  speed = 0.15,
  alphaTestOverride = null,
  ...props
}) {
  const materialRef = useRef();
  const meshRef = useRef();
  const frameCount = useRef(0);
  const targetPos = useRef(new THREE.Vector3(0, -2.6, 0));
  const currentScale = useRef(new THREE.Vector3(size, size, 1));
  const targetScale = useRef(new THREE.Vector3(size, size, 1));

  const shaderMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        // Slightly dimmer overall grid color to make lines more minimal
        uGridColor: { value: color.clone().multiplyScalar(0.9) },
        uDensity: { value: density },
        uLineWidth: { value: lineWidth },
        uSpeed: { value: speed },
      },
      vertexShader: gridVertexShader,
      fragmentShader: gridFragmentShader,
      transparent: true,
      // Allow grid fragments (non-discarded by alphaTest) to write depth
      // so they correctly occlude geometry in front of them.
      depthWrite: true,
      depthTest: true,
      // Discard nearly-transparent fragments so only visible neon lines write depth
      alphaTest: 0.02,
      toneMapped: false,
    });
  }, [color, density, lineWidth, speed]);

  // If a runtime override for alphaTest is provided (debug/testing), apply it
  React.useEffect(() => {
    if (materialRef.current && typeof alphaTestOverride === 'number') {
      // materialRef.current is a ShaderMaterial primitive
      materialRef.current.alphaTest = alphaTestOverride;
      materialRef.current.needsUpdate = true;
    }
  }, [alphaTestOverride]);

  // Update target scale/position when props change
  React.useEffect(() => {
    targetScale.current.set(size, size, 1);
  }, [size]);

  React.useEffect(() => {
    if (props.position) {
      const p = props.position;
      targetPos.current.set(p[0] || 0, p[1] || 0, p[2] || 0);
    }
  }, [props.position]);

  // Throttle updates to every 6th frame to minimize GPU work and animate transform
  useFrame((state) => {
    if (materialRef.current) {
      frameCount.current++;
      if (frameCount.current % 6 === 0) {
        materialRef.current.uniforms.uTime.value = state.clock.elapsedTime;
      }
    }

    // Smoothly interpolate mesh position and scale to avoid jumps when bounds update
    const mesh = meshRef.current;
    if (mesh) {
      // lerp position
      mesh.position.lerp(targetPos.current, 0.08);
      // lerp scale
      mesh.scale.lerp(targetScale.current, 0.08);
    }
  });

  return (
    <mesh
      // Render grid before holograms by default to avoid painter-order overlay
      ref={meshRef}
      renderOrder={-1}
      rotation={[-Math.PI / 2, 0, 0]}
      // initial position; will be animated via useFrame
      position={[targetPos.current.x, targetPos.current.y, targetPos.current.z]}
      // start with a scale matching requested size
      scale={[size, size, 1]}
      {...props}
    >
      {/* unit plane geometry, scale drives size */}
      <planeGeometry args={[1, 1, segments, segments]} />
      <primitive
        object={shaderMaterial}
        ref={materialRef}
        attach="material"
      />
    </mesh>
  );
}