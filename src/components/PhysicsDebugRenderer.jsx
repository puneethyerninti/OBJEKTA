// src/components/PhysicsDebugRenderer.jsx
// Renders Rapier's debug wireframes as Three.js LineSegments
import { useRef, useEffect } from "react";
import * as THREE from "three";

export default function PhysicsDebugRenderer({ scene, physicsManager, visible }) {
  const meshRef = useRef(null);

  useEffect(() => {
    if (!scene) return;
    const lineSegments = new THREE.LineSegments(
      new THREE.BufferGeometry(),
      new THREE.LineBasicMaterial({ color: 0x00ff88, depthTest: false, transparent: true, opacity: 0.5 })
    );
    lineSegments.name = "_physics_debug";
    lineSegments.frustumCulled = false;
    lineSegments.renderOrder = 999;
    scene.add(lineSegments);
    meshRef.current = lineSegments;

    return () => {
      scene.remove(lineSegments);
      lineSegments.geometry.dispose();
      lineSegments.material.dispose();
      meshRef.current = null;
    };
  }, [scene]);

  useEffect(() => {
    if (!meshRef.current) return;
    meshRef.current.visible = !!visible;
  }, [visible]);

  // Update debug geometry every frame via external call
  useEffect(() => {
    if (!physicsManager?.current || !meshRef.current) return;
    let raf;
    let running = true;
    const update = () => {
      if (!running) return;
      const mgr = physicsManager.current;
      const mesh = meshRef.current;
      if (mgr?.ready && mesh?.visible) {
        const debug = mgr.getDebugLines();
        if (debug?.vertices?.length) {
          mesh.geometry.setAttribute(
            "position",
            new THREE.Float32BufferAttribute(debug.vertices, 3)
          );
          if (debug.colors?.length) {
            mesh.geometry.setAttribute(
              "color",
              new THREE.Float32BufferAttribute(debug.colors, 4)
            );
            mesh.material.vertexColors = true;
          }
          mesh.geometry.attributes.position.needsUpdate = true;
        }
      }
      raf = requestAnimationFrame(update);
    };
    update();
    return () => { running = false; cancelAnimationFrame(raf); };
  }, [physicsManager, visible]);

  return null;
}
