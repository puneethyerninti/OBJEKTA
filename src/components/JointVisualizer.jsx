// src/components/JointVisualizer.jsx
// Draws debug lines connecting jointed physics bodies
import { useRef, useEffect } from "react";
import * as THREE from "three";

export default function JointVisualizer({ scene, getJoints, debugVisible }) {
  const linesRef = useRef([]);

  useEffect(() => {
    if (!scene || !debugVisible) {
      // Clean up
      for (const line of linesRef.current) {
        scene?.remove(line);
        line.geometry.dispose();
        line.material.dispose();
      }
      linesRef.current = [];
      return;
    }

    let raf;
    let running = true;

    const colors = {
      fixed: 0xff4444,
      revolute: 0x44ff44,
      prismatic: 0x4488ff,
      spherical: 0xffaa00,
      spring: 0xff44ff,
    };

    const update = () => {
      if (!running) return;

      const joints = getJoints?.() ?? [];

      // Remove old lines
      for (const line of linesRef.current) {
        scene.remove(line);
        line.geometry.dispose();
        line.material.dispose();
      }
      linesRef.current = [];

      // Draw new lines
      for (const j of joints) {
        const objA = scene.getObjectByProperty("uuid", j.bodyA);
        const objB = scene.getObjectByProperty("uuid", j.bodyB);
        if (!objA || !objB) continue;

        const color = colors[j.type] || 0xffffff;
        const geometry = new THREE.BufferGeometry().setFromPoints([
          objA.position.clone(),
          objB.position.clone(),
        ]);
        const material = new THREE.LineBasicMaterial({
          color,
          depthTest: false,
          transparent: true,
          opacity: 0.7,
          linewidth: 2,
        });
        const line = new THREE.Line(geometry, material);
        line.name = "_joint_viz_" + j.id;
        line.frustumCulled = false;
        line.renderOrder = 998;
        scene.add(line);
        linesRef.current.push(line);
      }

      raf = requestAnimationFrame(update);
    };

    update();

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      for (const line of linesRef.current) {
        scene.remove(line);
        line.geometry.dispose();
        line.material.dispose();
      }
      linesRef.current = [];
    };
  }, [scene, getJoints, debugVisible]);

  return null;
}
