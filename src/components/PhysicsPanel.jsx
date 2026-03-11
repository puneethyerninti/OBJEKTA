// src/components/PhysicsPanel.jsx
// Physics properties panel for selected objects — rendered inside ObjectProperties
import React, { useState, useCallback, useMemo } from "react";
import { BODY_TYPES, COLLIDER_TYPES, GRAVITY_PRESETS, JOINT_TYPES } from "../hooks/usePhysics";

const ACCENT = "#7f5af0";

export default function PhysicsPanel({
  selected,
  physicsReady,
  physicsRunning,
  hasPhysicsBody,
  getPhysicsConfig,
  addPhysicsBody,
  removePhysicsBody,
  updatePhysicsBody,
  getJointsForBody,
  // Ragdoll
  onCreateRagdoll,
}) {
  const uuid = selected?.uuid;
  const hasBody = uuid ? hasPhysicsBody(uuid) : false;
  const config = hasBody ? getPhysicsConfig(uuid) : null;

  const [localType, setLocalType] = useState(config?.type || "dynamic");
  const [localCollider, setLocalCollider] = useState(config?.colliderType || "box");
  const [localMass, setLocalMass] = useState(config?.mass ?? 1);
  const [localFriction, setLocalFriction] = useState(config?.friction ?? 0.5);
  const [localRestitution, setLocalRestitution] = useState(config?.restitution ?? 0.3);
  const [localLinDamp, setLocalLinDamp] = useState(config?.linearDamping ?? 0.01);
  const [localAngDamp, setLocalAngDamp] = useState(config?.angularDamping ?? 0.05);
  const [localGravScale, setLocalGravScale] = useState(config?.gravityScale ?? 1.0);
  const [localCcd, setLocalCcd] = useState(config?.ccdEnabled ?? false);

  // Update local state when selected object changes
  React.useEffect(() => {
    if (!uuid) return;
    const cfg = hasPhysicsBody(uuid) ? getPhysicsConfig(uuid) : null;
    if (cfg) {
      setLocalType(cfg.type || "dynamic");
      setLocalCollider(cfg.colliderType || "box");
      setLocalMass(cfg.mass ?? 1);
      setLocalFriction(cfg.friction ?? 0.5);
      setLocalRestitution(cfg.restitution ?? 0.3);
      setLocalLinDamp(cfg.linearDamping ?? 0.01);
      setLocalAngDamp(cfg.angularDamping ?? 0.05);
      setLocalGravScale(cfg.gravityScale ?? 1.0);
      setLocalCcd(cfg.ccdEnabled ?? false);
    } else {
      setLocalType("dynamic");
      setLocalCollider("box");
      setLocalMass(1);
      setLocalFriction(0.5);
      setLocalRestitution(0.3);
      setLocalLinDamp(0.01);
      setLocalAngDamp(0.05);
      setLocalGravScale(1.0);
      setLocalCcd(false);
    }
  }, [uuid, hasPhysicsBody, getPhysicsConfig]);

  const handleEnable = useCallback(() => {
    if (!uuid) return;
    addPhysicsBody(uuid, {
      type: localType,
      colliderType: localCollider,
      mass: localMass,
      friction: localFriction,
      restitution: localRestitution,
      linearDamping: localLinDamp,
      angularDamping: localAngDamp,
      gravityScale: localGravScale,
      ccdEnabled: localCcd,
    });
  }, [uuid, localType, localCollider, localMass, localFriction, localRestitution, localLinDamp, localAngDamp, localGravScale, localCcd, addPhysicsBody]);

  const handleDisable = useCallback(() => {
    if (!uuid) return;
    removePhysicsBody(uuid);
  }, [uuid, removePhysicsBody]);

  const handleUpdate = useCallback((key, value) => {
    if (!uuid || !hasBody) return;
    updatePhysicsBody(uuid, { [key]: value });
  }, [uuid, hasBody, updatePhysicsBody]);

  // Check for skeleton (ragdoll candidate)
  const hasSkeleton = useMemo(() => {
    if (!selected) return false;
    let found = false;
    selected.traverse?.(c => { if (c.isBone || c.isSkinnedMesh) found = true; });
    return found;
  }, [selected]);

  const joints = hasBody ? (getJointsForBody?.(uuid) ?? []) : [];

  if (!physicsReady) {
    return (
      <div className="op-panel" style={{ opacity: 0.5 }}>
        <div className="op-panel-header">
          <span style={{ fontSize: 13, fontWeight: 600, color: "#ccc" }}>⚙ Physics</span>
        </div>
        <div style={{ padding: "8px 12px", fontSize: 12, color: "#888" }}>
          Loading Rapier physics engine…
        </div>
      </div>
    );
  }

  return (
    <div className="op-panel" data-depth="2" aria-label="Physics panel">
      <div className="op-panel-header" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: "#ccc" }}>⚙ Physics</span>
        {!hasBody ? (
          <button
            className="op-small-btn"
            style={{ background: ACCENT, color: "#fff", fontSize: 11 }}
            onClick={handleEnable}
            disabled={physicsRunning}
          >
            + Enable Physics
          </button>
        ) : (
          <button
            className="op-small-btn"
            style={{ background: "#e53e3e", color: "#fff", fontSize: 11 }}
            onClick={handleDisable}
            disabled={physicsRunning}
          >
            ✕ Remove
          </button>
        )}
      </div>

      {hasBody && (
        <div style={{ padding: "4px 12px 8px" }}>
          {/* Body Type */}
          <div className="op-texture-row" style={{ marginBottom: 6 }}>
            <label style={{ fontSize: 12, color: "#aaa", width: 80 }}>Body Type</label>
            <select
              className="op-select"
              value={localType}
              onChange={(e) => { setLocalType(e.target.value); handleUpdate("type", e.target.value); }}
              disabled={physicsRunning}
              style={{ flex: 1 }}
            >
              {BODY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          {/* Collider Shape */}
          <div className="op-texture-row" style={{ marginBottom: 6 }}>
            <label style={{ fontSize: 12, color: "#aaa", width: 80 }}>Collider</label>
            <select
              className="op-select"
              value={localCollider}
              onChange={(e) => { setLocalCollider(e.target.value); handleUpdate("colliderType", e.target.value); }}
              disabled={physicsRunning}
              style={{ flex: 1 }}
            >
              {COLLIDER_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          {/* Mass */}
          <div className="op-texture-row" style={{ marginBottom: 4 }}>
            <label style={{ fontSize: 12, color: "#aaa", width: 80 }}>Mass</label>
            <input
              className="op-range prop-slider"
              type="range" min="0.01" max="100" step="0.1"
              value={localMass}
              onChange={(e) => { const v = Number(e.target.value); setLocalMass(v); handleUpdate("mass", v); }}
              disabled={physicsRunning}
              style={{ flex: 1 }}
            />
            <span style={{ fontSize: 11, color: "#888", width: 40, textAlign: "right" }}>{localMass.toFixed(1)}</span>
          </div>

          {/* Friction */}
          <div className="op-texture-row" style={{ marginBottom: 4 }}>
            <label style={{ fontSize: 12, color: "#aaa", width: 80 }}>Friction</label>
            <input
              className="op-range prop-slider"
              type="range" min="0" max="2" step="0.01"
              value={localFriction}
              onChange={(e) => { const v = Number(e.target.value); setLocalFriction(v); handleUpdate("friction", v); }}
              disabled={physicsRunning}
              style={{ flex: 1 }}
            />
            <span style={{ fontSize: 11, color: "#888", width: 40, textAlign: "right" }}>{localFriction.toFixed(2)}</span>
          </div>

          {/* Restitution (Bounciness) */}
          <div className="op-texture-row" style={{ marginBottom: 4 }}>
            <label style={{ fontSize: 12, color: "#aaa", width: 80 }}>Bounce</label>
            <input
              className="op-range prop-slider"
              type="range" min="0" max="1" step="0.01"
              value={localRestitution}
              onChange={(e) => { const v = Number(e.target.value); setLocalRestitution(v); handleUpdate("restitution", v); }}
              disabled={physicsRunning}
              style={{ flex: 1 }}
            />
            <span style={{ fontSize: 11, color: "#888", width: 40, textAlign: "right" }}>{localRestitution.toFixed(2)}</span>
          </div>

          {/* Linear Damping */}
          <div className="op-texture-row" style={{ marginBottom: 4 }}>
            <label style={{ fontSize: 12, color: "#aaa", width: 80 }}>Lin Damp</label>
            <input
              className="op-range prop-slider"
              type="range" min="0" max="5" step="0.01"
              value={localLinDamp}
              onChange={(e) => { const v = Number(e.target.value); setLocalLinDamp(v); handleUpdate("linearDamping", v); }}
              disabled={physicsRunning}
              style={{ flex: 1 }}
            />
            <span style={{ fontSize: 11, color: "#888", width: 40, textAlign: "right" }}>{localLinDamp.toFixed(2)}</span>
          </div>

          {/* Angular Damping */}
          <div className="op-texture-row" style={{ marginBottom: 4 }}>
            <label style={{ fontSize: 12, color: "#aaa", width: 80 }}>Ang Damp</label>
            <input
              className="op-range prop-slider"
              type="range" min="0" max="5" step="0.01"
              value={localAngDamp}
              onChange={(e) => { const v = Number(e.target.value); setLocalAngDamp(v); handleUpdate("angularDamping", v); }}
              disabled={physicsRunning}
              style={{ flex: 1 }}
            />
            <span style={{ fontSize: 11, color: "#888", width: 40, textAlign: "right" }}>{localAngDamp.toFixed(2)}</span>
          </div>

          {/* Gravity Scale */}
          <div className="op-texture-row" style={{ marginBottom: 4 }}>
            <label style={{ fontSize: 12, color: "#aaa", width: 80 }}>Grav Scale</label>
            <input
              className="op-range prop-slider"
              type="range" min="-2" max="3" step="0.1"
              value={localGravScale}
              onChange={(e) => { const v = Number(e.target.value); setLocalGravScale(v); handleUpdate("gravityScale", v); }}
              disabled={physicsRunning}
              style={{ flex: 1 }}
            />
            <span style={{ fontSize: 11, color: "#888", width: 40, textAlign: "right" }}>{localGravScale.toFixed(1)}</span>
          </div>

          {/* CCD */}
          <div className="op-texture-row" style={{ marginBottom: 6 }}>
            <label className="op-inline-checkbox" style={{ fontSize: 12 }}>
              <input
                type="checkbox"
                checked={localCcd}
                onChange={(e) => { setLocalCcd(e.target.checked); handleUpdate("ccdEnabled", e.target.checked); }}
                disabled={physicsRunning}
              />
              <span style={{ color: "#aaa" }}>Continuous Collision Detection</span>
            </label>
          </div>

          {/* Joints info */}
          {joints.length > 0 && (
            <div style={{ fontSize: 11, color: "#888", padding: "4px 0", borderTop: "1px solid #333" }}>
              <span style={{ fontWeight: 600 }}>Joints:</span> {joints.map(j => j.type).join(", ")}
            </div>
          )}

          {/* Ragdoll button for skinned meshes */}
          {hasSkeleton && (
            <button
              className="op-small-btn"
              style={{ marginTop: 4, width: "100%", background: "#2d3748", color: "#e2e8f0", fontSize: 11 }}
              onClick={() => onCreateRagdoll?.(selected)}
              disabled={physicsRunning}
            >
              🦴 Generate Ragdoll
            </button>
          )}
        </div>
      )}
    </div>
  );
}
