// src/components/marketplace/ModelPreview3D.jsx
// Lightweight 3D preview of a .glb model — used in product cards and detail pages.
import React, { Suspense, useRef, useState, useEffect } from "react";
import { Canvas, useFrame, useLoader } from "@react-three/fiber";
import { OrbitControls, Environment, Center } from "@react-three/drei";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import * as THREE from "three";

// ─── Auto-rotating model inside the canvas ─────────────────────
function RotatingModel({ url, autoRotate }) {
  const gltf = useLoader(GLTFLoader, url);
  const groupRef = useRef();

  // Fit model into a unit sphere so previews are uniform
  useEffect(() => {
    if (!gltf.scene) return;
    const box = new THREE.Box3().setFromObject(gltf.scene);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    const scale = 2 / maxDim;
    gltf.scene.scale.setScalar(scale);
    gltf.scene.position.set(-center.x * scale, -center.y * scale, -center.z * scale);
  }, [gltf]);

  useFrame((_, delta) => {
    if (autoRotate && groupRef.current) {
      groupRef.current.rotation.y += delta * 0.4;
    }
  });

  return (
    <group ref={groupRef}>
      <primitive object={gltf.scene} />
    </group>
  );
}

// ─── Loading placeholder ────────────────────────────────────────
function Loader3D() {
  return (
    <mesh>
      <boxGeometry args={[0.5, 0.5, 0.5]} />
      <meshStandardMaterial color="#7f5af0" wireframe />
    </mesh>
  );
}

// ─── Main component ─────────────────────────────────────────────
export default function ModelPreview3D({
  url,
  autoRotate = true,
  interactive = false,
  height = "100%",
  className = "",
}) {
  const [error, setError] = useState(false);

  if (!url || error) {
    return (
      <div
        className={`mp-model-preview-fallback ${className}`}
        style={{ height, display: "flex", alignItems: "center", justifyContent: "center" }}
      >
        <span style={{ color: "#555", fontSize: "0.8rem" }}>3D Preview unavailable</span>
      </div>
    );
  }

  return (
    <div className={`mp-model-preview ${className}`} style={{ height, position: "relative" }}>
      <Canvas
        camera={{ position: [0, 1, 3], fov: 45 }}
        gl={{ antialias: true, alpha: true, preserveDrawingBuffer: false, powerPreference: "low-power" }}
        dpr={[1, 1.5]}
        performance={{ min: 0.5 }}
        onCreated={({ gl }) => {
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.2;
        }}
      >
        <ambientLight intensity={0.6} />
        <directionalLight position={[5, 5, 5]} intensity={1} />
        <directionalLight position={[-3, 2, -4]} intensity={0.3} />
        <Environment preset="city" background={false} />
        <Suspense fallback={<Loader3D />}>
          <Center>
            <RotatingModel url={url} autoRotate={autoRotate && !interactive} />
          </Center>
        </Suspense>
        {interactive && (
          <OrbitControls
            enablePan={false}
            enableZoom={true}
            minDistance={1.5}
            maxDistance={8}
            autoRotate={autoRotate}
            autoRotateSpeed={1.5}
          />
        )}
      </Canvas>
      {interactive && (
        <div className="mp-model-hint">Drag to rotate &bull; Scroll to zoom</div>
      )}
    </div>
  );
}
