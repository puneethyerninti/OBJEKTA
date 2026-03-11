// src/components/TriggerVolumePanel.jsx
// UI for creating and managing invisible trigger volumes
import React, { useState, useCallback } from "react";
import * as THREE from "three";

const ACCENT = "#7f5af0";

export default function TriggerVolumePanel({
  scene,
  addTrigger,
  removeTrigger,
  physicsRunning,
  onTriggerEnter,
  onTriggerExit,
}) {
  const [shape, setShape] = useState("box");
  const [size, setSize] = useState({ x: 2, y: 2, z: 2 });
  const [radius, setRadius] = useState(1);
  const [triggers, setTriggers] = useState([]);

  const handleCreate = useCallback(() => {
    if (!scene) return;

    // Create a visual representation
    let geometry;
    if (shape === "sphere") {
      geometry = new THREE.SphereGeometry(radius, 16, 12);
    } else {
      geometry = new THREE.BoxGeometry(size.x, size.y, size.z);
    }
    const material = new THREE.MeshBasicMaterial({
      color: 0x44bbff,
      wireframe: true,
      transparent: true,
      opacity: 0.3,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = `Trigger_${Date.now().toString(36)}`;
    mesh.userData.__objekta = true;
    mesh.userData.__trigger = true;
    mesh.position.set(0, size.y / 2, 0);

    // Find user group
    let userGroup = scene.getObjectByName("_user_group");
    if (!userGroup) {
      userGroup = scene;
    }
    userGroup.add(mesh);

    // Register as physics trigger
    const config = {
      position: { x: mesh.position.x, y: mesh.position.y, z: mesh.position.z },
      shape,
      size,
      radius,
    };
    addTrigger?.(mesh.uuid, config);

    setTriggers(prev => [...prev, { uuid: mesh.uuid, name: mesh.name, shape }]);
  }, [scene, shape, size, radius, addTrigger]);

  const handleRemove = useCallback((uuid) => {
    if (!scene) return;
    const obj = scene.getObjectByProperty("uuid", uuid);
    if (obj) {
      obj.parent?.remove(obj);
      obj.geometry?.dispose();
      obj.material?.dispose();
    }
    removeTrigger?.(uuid);
    setTriggers(prev => prev.filter(t => t.uuid !== uuid));
  }, [scene, removeTrigger]);

  return (
    <div
      style={{
        background: "rgba(26,32,44,0.95)",
        borderRadius: 8,
        padding: "10px 14px",
        border: "1px solid #2d3748",
        maxWidth: 280,
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 600, color: "#e2e8f0", marginBottom: 8 }}>
        🎯 Trigger Volumes
      </div>

      {/* Shape */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <label style={{ fontSize: 11, color: "#a0aec0", width: 50 }}>Shape</label>
        <select
          value={shape}
          onChange={(e) => setShape(e.target.value)}
          style={{
            flex: 1, background: "#2d3748", color: "#e2e8f0",
            border: "1px solid #4a5568", borderRadius: 4, padding: "2px 4px", fontSize: 11,
          }}
        >
          <option value="box">Box</option>
          <option value="sphere">Sphere</option>
        </select>
      </div>

      {/* Size params */}
      {shape === "box" ? (
        <div style={{ display: "flex", gap: 4, marginBottom: 6 }}>
          {["x", "y", "z"].map((axis) => (
            <div key={axis}>
              <label style={{ fontSize: 10, color: "#718096" }}>{axis.toUpperCase()}</label>
              <input
                type="number"
                value={size[axis]}
                onChange={(e) => setSize(prev => ({ ...prev, [axis]: Number(e.target.value) || 1 }))}
                style={{ width: 45, background: "#2d3748", color: "#e2e8f0", border: "1px solid #4a5568", borderRadius: 3, padding: "1px 3px", fontSize: 11 }}
                min={0.1}
                step={0.1}
              />
            </div>
          ))}
        </div>
      ) : (
        <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 6 }}>
          <label style={{ fontSize: 11, color: "#a0aec0", width: 50 }}>Radius</label>
          <input
            type="number"
            value={radius}
            onChange={(e) => setRadius(Number(e.target.value) || 0.5)}
            style={{ width: 60, background: "#2d3748", color: "#e2e8f0", border: "1px solid #4a5568", borderRadius: 3, padding: "1px 3px", fontSize: 11 }}
            min={0.1}
            step={0.1}
          />
        </div>
      )}

      <button
        onClick={handleCreate}
        disabled={physicsRunning}
        style={{
          width: "100%",
          background: ACCENT,
          color: "#fff",
          border: "none",
          borderRadius: 4,
          padding: "4px 8px",
          fontSize: 11,
          cursor: physicsRunning ? "default" : "pointer",
          opacity: physicsRunning ? 0.5 : 1,
          marginBottom: 6,
        }}
      >
        + Create Trigger
      </button>

      {/* Active triggers */}
      {triggers.length > 0 && (
        <div style={{ borderTop: "1px solid #2d3748", paddingTop: 6 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: "#a0aec0", marginBottom: 4 }}>
            Active ({triggers.length})
          </div>
          {triggers.map((t) => (
            <div
              key={t.uuid}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "3px 0",
                fontSize: 11,
                color: "#a0aec0",
              }}
            >
              <span>{t.name} ({t.shape})</span>
              <button
                onClick={() => handleRemove(t.uuid)}
                disabled={physicsRunning}
                style={{
                  background: "#e53e3e",
                  color: "#fff",
                  border: "none",
                  borderRadius: 3,
                  padding: "1px 6px",
                  fontSize: 10,
                  cursor: "pointer",
                }}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
