import React, { useMemo } from 'react';
import * as THREE from 'three';

export default function ContactShadow({
  radius = 6,
  opacity = 0.45,
  position = [0, -2.58, -14],
  color = '#000000',
  rotation = [-Math.PI / 2, 0, 0],
}) {
  // Create a radial gradient texture on a tiny canvas
  const texture = useMemo(() => {
    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d');
    const grd = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    grd.addColorStop(0, `rgba(0,0,0,1)`);
    grd.addColorStop(0.4, `rgba(0,0,0,0.6)`);
    grd.addColorStop(1, `rgba(0,0,0,0)`);
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, size, size);
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.needsUpdate = true;
    return tex;
  }, []);

  return (
    <mesh
      rotation={rotation}
      position={position}
      scale={[radius, radius, 1]}
      renderOrder={-0.5}
    >
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial
        map={texture}
        transparent={true}
        opacity={opacity}
        depthWrite={false}
        depthTest={true}
        toneMapped={false}
        color={color}
      />
    </mesh>
  );
}
