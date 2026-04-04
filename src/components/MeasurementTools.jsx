// src/components/MeasurementTools.jsx
// Distance, angle, and dimension measurement tools for the 3D editor
import React, { useState, useEffect, useCallback, useRef } from "react";
import * as THREE from "three";
import EventBus from "../utils/EventBus";

const ACCENT = "#7f5af0";

// Measurement modes
const MODES = {
  DISTANCE: "distance",
  ANGLE: "angle",
  DIMENSION: "dimension",
};

// Active measurement state (module-scoped for direct manipulation)
let measurementState = {
  active: false,
  mode: MODES.DISTANCE,
  points: [],
  tempPoint: null,
  measurements: [],
};

/**
 * Calculate distance between two 3D points
 */
function calculateDistance(p1, p2) {
  return p1.distanceTo(p2);
}

/**
 * Calculate angle between three points (vertex at p2)
 */
function calculateAngle(p1, p2, p3) {
  const v1 = new THREE.Vector3().subVectors(p1, p2).normalize();
  const v2 = new THREE.Vector3().subVectors(p3, p2).normalize();
  const angle = Math.acos(Math.max(-1, Math.min(1, v1.dot(v2))));
  return THREE.MathUtils.radToDeg(angle);
}

/**
 * Format distance for display
 */
function formatDistance(dist, unit = "m") {
  if (dist < 0.01) return `${(dist * 1000).toFixed(1)} mm`;
  if (dist < 1) return `${(dist * 100).toFixed(1)} cm`;
  return `${dist.toFixed(3)} ${unit}`;
}

/**
 * Create a line mesh between two points
 */
function createLineMesh(p1, p2, color = 0x7f5af0) {
  const geometry = new THREE.BufferGeometry().setFromPoints([p1, p2]);
  const material = new THREE.LineBasicMaterial({ color, linewidth: 2, depthTest: false, transparent: true, opacity: 0.8 });
  const line = new THREE.Line(geometry, material);
  line.renderOrder = 9999;
  line.userData.__measurement = true;
  return line;
}

/**
 * Create a point marker mesh
 */
function createPointMarker(position, color = 0x7f5af0) {
  const geometry = new THREE.SphereGeometry(0.02, 8, 8);
  const material = new THREE.MeshBasicMaterial({ color, depthTest: false, transparent: true, opacity: 0.9 });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.copy(position);
  mesh.renderOrder = 9999;
  mesh.userData.__measurement = true;
  return mesh;
}

/**
 * Create measurement label (using CSS2DRenderer or sprite)
 */
function createLabel(text, position, scene) {
  // Create a simple sprite-based label
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  canvas.width = 256;
  canvas.height = 64;

  ctx.fillStyle = "rgba(26, 32, 44, 0.9)";
  ctx.roundRect(0, 0, canvas.width, canvas.height, 8);
  ctx.fill();

  ctx.font = "bold 24px system-ui, sans-serif";
  ctx.fillStyle = "#e2e8f0";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, canvas.width / 2, canvas.height / 2);

  const texture = new THREE.CanvasTexture(canvas);
  const material = new THREE.SpriteMaterial({ map: texture, depthTest: false, transparent: true });
  const sprite = new THREE.Sprite(material);
  sprite.position.copy(position);
  sprite.scale.set(0.5, 0.125, 1);
  sprite.renderOrder = 10000;
  sprite.userData.__measurement = true;
  sprite.userData.__label = true;

  return sprite;
}

export default function MeasurementTools({ workspaceRef, visible = false, onClose }) {
  const [mode, setMode] = useState(MODES.DISTANCE);
  const [isActive, setIsActive] = useState(false);
  const [measurements, setMeasurements] = useState([]);
  const [points, setPoints] = useState([]);
  const [showLabels, setShowLabels] = useState(true);
  const measurementGroupRef = useRef(null);

  // Initialize measurement group in scene
  useEffect(() => {
    if (!visible) return;

    const ws = workspaceRef?.current;
    const scene = ws?.scene;
    if (!scene) return;

    // Create or find measurement group
    let group = scene.getObjectByName("__measurementGroup");
    if (!group) {
      group = new THREE.Group();
      group.name = "__measurementGroup";
      group.userData.__helper = true;
      scene.add(group);
    }
    measurementGroupRef.current = group;

    return () => {
      // Cleanup measurements on unmount
      if (measurementGroupRef.current) {
        measurementGroupRef.current.traverse((child) => {
          if (child.geometry) child.geometry.dispose();
          if (child.material) {
            if (Array.isArray(child.material)) {
              child.material.forEach((m) => m.dispose());
            } else {
              child.material.dispose();
            }
          }
        });
        scene.remove(measurementGroupRef.current);
      }
    };
  }, [visible, workspaceRef]);

  // Handle point picking
  const handleSceneClick = useCallback((event) => {
    if (!isActive) return;

    const ws = workspaceRef?.current;
    if (!ws) return;

    const scene = ws.scene;
    const camera = ws.scene?.parent?.children?.find((c) => c.isCamera) || null;
    const renderer = ws.renderer;

    if (!scene || !camera || !renderer) return;

    // Calculate mouse position
    const rect = renderer.domElement.getBoundingClientRect();
    const mouse = new THREE.Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1
    );

    // Raycast
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, camera);

    // Filter out measurement objects
    const intersectable = [];
    scene.traverse((obj) => {
      if (obj.isMesh && !obj.userData.__measurement && !obj.userData.__helper) {
        intersectable.push(obj);
      }
    });

    const intersects = raycaster.intersectObjects(intersectable, true);

    if (intersects.length > 0) {
      const point = intersects[0].point.clone();
      addPoint(point);
    }
  }, [isActive, workspaceRef]);

  // Add a measurement point
  const addPoint = useCallback((point) => {
    const group = measurementGroupRef.current;
    if (!group) return;

    // Add point marker
    const marker = createPointMarker(point);
    group.add(marker);

    const newPoints = [...points, point];
    setPoints(newPoints);

    // Check if measurement is complete
    if (mode === MODES.DISTANCE && newPoints.length === 2) {
      completeMeasurement(newPoints, MODES.DISTANCE);
    } else if (mode === MODES.ANGLE && newPoints.length === 3) {
      completeMeasurement(newPoints, MODES.ANGLE);
    }
  }, [points, mode]);

  // Complete a measurement
  const completeMeasurement = useCallback((pts, measurementMode) => {
    const group = measurementGroupRef.current;
    if (!group) return;

    let value, label, labelPos;

    if (measurementMode === MODES.DISTANCE) {
      const dist = calculateDistance(pts[0], pts[1]);
      value = dist;
      label = formatDistance(dist);
      labelPos = new THREE.Vector3().addVectors(pts[0], pts[1]).multiplyScalar(0.5);

      // Create line
      const line = createLineMesh(pts[0], pts[1]);
      group.add(line);
    } else if (measurementMode === MODES.ANGLE) {
      const angle = calculateAngle(pts[0], pts[1], pts[2]);
      value = angle;
      label = `${angle.toFixed(1)}°`;
      labelPos = pts[1].clone();

      // Create angle lines
      const line1 = createLineMesh(pts[0], pts[1], 0x48bb78);
      const line2 = createLineMesh(pts[1], pts[2], 0x48bb78);
      group.add(line1, line2);
    }

    // Create label sprite
    if (showLabels) {
      const labelSprite = createLabel(label, labelPos);
      group.add(labelSprite);
    }

    // Store measurement
    const measurement = {
      id: Date.now(),
      mode: measurementMode,
      points: pts.map((p) => p.clone()),
      value,
      label,
    };

    setMeasurements((prev) => [...prev, measurement]);
    setPoints([]);

    // Emit event
    EventBus?.emit?.("measurement:complete", measurement);
  }, [showLabels]);

  // Clear all measurements
  const clearMeasurements = useCallback(() => {
    const group = measurementGroupRef.current;
    if (group) {
      while (group.children.length > 0) {
        const child = group.children[0];
        if (child.geometry) child.geometry.dispose();
        if (child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach((m) => m.dispose());
          } else {
            child.material.dispose();
          }
        }
        group.remove(child);
      }
    }
    setMeasurements([]);
    setPoints([]);
  }, []);

  // Delete specific measurement
  const deleteMeasurement = useCallback((id) => {
    setMeasurements((prev) => prev.filter((m) => m.id !== id));
    // Note: Would need to track which scene objects belong to which measurement
    // For simplicity, we don't remove individual measurements from the scene
  }, []);

  // Setup click handler
  useEffect(() => {
    if (!visible || !isActive) return;

    const ws = workspaceRef?.current;
    const canvas = ws?.renderer?.domElement || ws?.scene?.userData?.canvas;
    if (!canvas) return;

    canvas.addEventListener("click", handleSceneClick);
    return () => canvas.removeEventListener("click", handleSceneClick);
  }, [visible, isActive, handleSceneClick, workspaceRef]);

  if (!visible) return null;

  return (
    <div
      style={{
        position: "absolute",
        bottom: 120,
        right: 20,
        width: 260,
        background: "rgba(26, 32, 44, 0.95)",
        border: "1px solid #2d3748",
        borderRadius: 10,
        overflow: "hidden",
        backdropFilter: "blur(8px)",
        zIndex: 100,
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "10px 14px",
          borderBottom: "1px solid #2d3748",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <span style={{ fontWeight: 600, color: "#e2e8f0", fontSize: 13 }}>
          📏 Measurement Tools
        </span>
        <button
          onClick={onClose}
          style={{
            background: "transparent",
            border: "none",
            color: "#718096",
            cursor: "pointer",
            fontSize: 16,
          }}
        >
          ×
        </button>
      </div>

      {/* Mode selection */}
      <div style={{ padding: "10px 14px", borderBottom: "1px solid #2d3748" }}>
        <div style={{ fontSize: 10, color: "#718096", marginBottom: 6 }}>Mode</div>
        <div style={{ display: "flex", gap: 6 }}>
          <button
            onClick={() => { setMode(MODES.DISTANCE); setPoints([]); }}
            style={{
              flex: 1,
              padding: "6px 10px",
              background: mode === MODES.DISTANCE ? "rgba(127, 90, 240, 0.3)" : "rgba(0,0,0,0.3)",
              border: `1px solid ${mode === MODES.DISTANCE ? ACCENT : "#4a5568"}`,
              borderRadius: 6,
              color: mode === MODES.DISTANCE ? "#e2e8f0" : "#a0aec0",
              fontSize: 11,
              cursor: "pointer",
            }}
          >
            Distance
          </button>
          <button
            onClick={() => { setMode(MODES.ANGLE); setPoints([]); }}
            style={{
              flex: 1,
              padding: "6px 10px",
              background: mode === MODES.ANGLE ? "rgba(127, 90, 240, 0.3)" : "rgba(0,0,0,0.3)",
              border: `1px solid ${mode === MODES.ANGLE ? ACCENT : "#4a5568"}`,
              borderRadius: 6,
              color: mode === MODES.ANGLE ? "#e2e8f0" : "#a0aec0",
              fontSize: 11,
              cursor: "pointer",
            }}
          >
            Angle
          </button>
        </div>
      </div>

      {/* Active state toggle */}
      <div style={{ padding: "10px 14px", borderBottom: "1px solid #2d3748" }}>
        <button
          onClick={() => setIsActive((v) => !v)}
          style={{
            width: "100%",
            padding: "8px",
            background: isActive ? "rgba(72, 187, 120, 0.3)" : "rgba(0,0,0,0.3)",
            border: `1px solid ${isActive ? "#48bb78" : "#4a5568"}`,
            borderRadius: 6,
            color: isActive ? "#68d391" : "#a0aec0",
            fontSize: 12,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          {isActive ? "● Measuring Active" : "○ Click to Start Measuring"}
        </button>
        {isActive && (
          <div style={{ marginTop: 8, fontSize: 10, color: "#718096" }}>
            {mode === MODES.DISTANCE
              ? `Click 2 points to measure distance. ${points.length}/2 selected.`
              : `Click 3 points to measure angle. ${points.length}/3 selected.`}
          </div>
        )}
      </div>

      {/* Options */}
      <div style={{ padding: "10px 14px", borderBottom: "1px solid #2d3748" }}>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, color: "#a0aec0", cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={showLabels}
            onChange={(e) => setShowLabels(e.target.checked)}
          />
          Show measurement labels
        </label>
      </div>

      {/* Measurements list */}
      <div style={{ padding: "10px 14px", maxHeight: 150, overflowY: "auto" }}>
        <div style={{ fontSize: 10, color: "#718096", marginBottom: 6 }}>
          Measurements ({measurements.length})
        </div>
        {measurements.length === 0 ? (
          <div style={{ fontSize: 11, color: "#4a5568", fontStyle: "italic" }}>
            No measurements yet
          </div>
        ) : (
          measurements.map((m) => (
            <div
              key={m.id}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "6px 8px",
                background: "rgba(0,0,0,0.2)",
                borderRadius: 4,
                marginBottom: 4,
              }}
            >
              <span style={{ fontSize: 11, color: "#e2e8f0" }}>
                {m.mode === MODES.DISTANCE ? "📏" : "📐"} {m.label}
              </span>
              <button
                onClick={() => deleteMeasurement(m.id)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#e53e3e",
                  cursor: "pointer",
                  fontSize: 12,
                  padding: "2px 6px",
                }}
              >
                ✕
              </button>
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      <div style={{ padding: "10px 14px", borderTop: "1px solid #2d3748" }}>
        <button
          onClick={clearMeasurements}
          style={{
            width: "100%",
            padding: "6px",
            background: "rgba(229, 62, 62, 0.2)",
            border: "1px solid #e53e3e",
            borderRadius: 6,
            color: "#fc8181",
            fontSize: 11,
            cursor: "pointer",
          }}
        >
          Clear All Measurements
        </button>
      </div>
    </div>
  );
}
