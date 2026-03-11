// src/components/JointEditor.jsx
// UI panel for creating and managing physics joints between two selected objects
import React, { useState, useCallback } from "react";
import { JOINT_TYPES } from "../hooks/usePhysics";

const ACCENT = "#7f5af0";

export default function JointEditor({
  selectedA,
  selectedB,
  onAddJoint,
  onRemoveJoint,
  getJoints,
  physicsRunning,
  hasPhysicsBody,
}) {
  const [jointType, setJointType] = useState("fixed");
  const [axis, setAxis] = useState({ x: 0, y: 1, z: 0 });
  const [limitsEnabled, setLimitsEnabled] = useState(false);
  const [limitsMin, setLimitsMin] = useState(-90);
  const [limitsMax, setLimitsMax] = useState(90);
  const [stiffness, setStiffness] = useState(100);
  const [damping, setDamping] = useState(10);
  const [restLength, setRestLength] = useState(1);

  const canCreate = selectedA && selectedB && selectedA !== selectedB &&
    hasPhysicsBody?.(selectedA) && hasPhysicsBody?.(selectedB);

  const handleCreate = useCallback(() => {
    if (!canCreate) return;
    const config = {
      axis,
      limitsEnabled,
      limitsMin: (limitsMin * Math.PI) / 180,
      limitsMax: (limitsMax * Math.PI) / 180,
      stiffness: jointType === "spring" ? stiffness : 0,
      damping: jointType === "spring" ? damping : 0,
      restLength: jointType === "spring" ? restLength : 0,
    };
    onAddJoint?.(selectedA, selectedB, jointType, config);
  }, [selectedA, selectedB, jointType, axis, limitsEnabled, limitsMin, limitsMax, stiffness, damping, restLength, canCreate, onAddJoint]);

  const joints = getJoints?.() ?? [];

  return (
    <div
      style={{
        background: "rgba(26,32,44,0.95)",
        borderRadius: 8,
        padding: "10px 14px",
        border: "1px solid #2d3748",
        maxWidth: 300,
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 600, color: "#e2e8f0", marginBottom: 8 }}>
        🔗 Joint Editor
      </div>

      {/* Create joint */}
      <div style={{ marginBottom: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
          <label style={{ fontSize: 11, color: "#a0aec0", width: 50 }}>Type</label>
          <select
            value={jointType}
            onChange={(e) => setJointType(e.target.value)}
            style={{
              flex: 1, background: "#2d3748", color: "#e2e8f0",
              border: "1px solid #4a5568", borderRadius: 4, padding: "2px 4px", fontSize: 11,
            }}
          >
            {JOINT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>

        {/* Axis for revolute/prismatic */}
        {(jointType === "revolute" || jointType === "prismatic") && (
          <div style={{ display: "flex", gap: 4, marginBottom: 6, alignItems: "center" }}>
            <label style={{ fontSize: 11, color: "#a0aec0", width: 50 }}>Axis</label>
            {["x", "y", "z"].map((a) => (
              <label key={a} style={{ fontSize: 11, color: "#a0aec0", display: "flex", alignItems: "center", gap: 2 }}>
                <input
                  type="radio"
                  name="joint-axis"
                  checked={axis[a] === 1}
                  onChange={() => setAxis({ x: a === "x" ? 1 : 0, y: a === "y" ? 1 : 0, z: a === "z" ? 1 : 0 })}
                />
                {a.toUpperCase()}
              </label>
            ))}
          </div>
        )}

        {/* Limits for revolute/prismatic */}
        {(jointType === "revolute" || jointType === "prismatic") && (
          <>
            <label style={{ fontSize: 11, color: "#a0aec0", display: "flex", alignItems: "center", gap: 4, marginBottom: 4 }}>
              <input type="checkbox" checked={limitsEnabled} onChange={(e) => setLimitsEnabled(e.target.checked)} />
              Enable Limits
            </label>
            {limitsEnabled && (
              <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
                <div>
                  <label style={{ fontSize: 10, color: "#718096" }}>Min°</label>
                  <input
                    type="number"
                    value={limitsMin}
                    onChange={(e) => setLimitsMin(Number(e.target.value))}
                    style={{ width: 50, background: "#2d3748", color: "#e2e8f0", border: "1px solid #4a5568", borderRadius: 3, padding: "1px 3px", fontSize: 11 }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 10, color: "#718096" }}>Max°</label>
                  <input
                    type="number"
                    value={limitsMax}
                    onChange={(e) => setLimitsMax(Number(e.target.value))}
                    style={{ width: 50, background: "#2d3748", color: "#e2e8f0", border: "1px solid #4a5568", borderRadius: 3, padding: "1px 3px", fontSize: 11 }}
                  />
                </div>
              </div>
            )}
          </>
        )}

        {/* Spring params */}
        {jointType === "spring" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 6 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <label style={{ fontSize: 11, color: "#a0aec0", width: 60 }}>Stiffness</label>
              <input
                type="number"
                value={stiffness}
                onChange={(e) => setStiffness(Number(e.target.value))}
                style={{ width: 60, background: "#2d3748", color: "#e2e8f0", border: "1px solid #4a5568", borderRadius: 3, padding: "1px 3px", fontSize: 11 }}
              />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <label style={{ fontSize: 11, color: "#a0aec0", width: 60 }}>Damping</label>
              <input
                type="number"
                value={damping}
                onChange={(e) => setDamping(Number(e.target.value))}
                style={{ width: 60, background: "#2d3748", color: "#e2e8f0", border: "1px solid #4a5568", borderRadius: 3, padding: "1px 3px", fontSize: 11 }}
              />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <label style={{ fontSize: 11, color: "#a0aec0", width: 60 }}>Rest Len</label>
              <input
                type="number"
                value={restLength}
                onChange={(e) => setRestLength(Number(e.target.value))}
                style={{ width: 60, background: "#2d3748", color: "#e2e8f0", border: "1px solid #4a5568", borderRadius: 3, padding: "1px 3px", fontSize: 11 }}
              />
            </div>
          </div>
        )}

        <button
          onClick={handleCreate}
          disabled={!canCreate || physicsRunning}
          style={{
            width: "100%",
            background: canCreate ? ACCENT : "#4a5568",
            color: "#fff",
            border: "none",
            borderRadius: 4,
            padding: "4px 8px",
            fontSize: 11,
            cursor: canCreate ? "pointer" : "default",
            opacity: (canCreate && !physicsRunning) ? 1 : 0.5,
          }}
        >
          Create Joint
        </button>

        {!canCreate && (
          <div style={{ fontSize: 10, color: "#718096", marginTop: 4 }}>
            Select two objects with physics bodies to create a joint.
          </div>
        )}
      </div>

      {/* Existing joints list */}
      {joints.length > 0 && (
        <div style={{ borderTop: "1px solid #2d3748", paddingTop: 6 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: "#a0aec0", marginBottom: 4 }}>
            Active Joints ({joints.length})
          </div>
          {joints.map((j) => (
            <div
              key={j.id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "3px 0",
                fontSize: 11,
                color: "#a0aec0",
              }}
            >
              <span>{j.type} ({j.id})</span>
              <button
                onClick={() => onRemoveJoint?.(j.id)}
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
