// src/components/PhysicsToolbar.jsx
// Physics simulation controls — play/pause/reset, gravity presets, debug viz
import React, { useState, useCallback } from "react";
import { GRAVITY_PRESETS } from "../hooks/usePhysics";

const PRESET_LABELS = {
  earth: "🌍 Earth (9.81)",
  moon: "🌙 Moon (1.62)",
  mars: "🔴 Mars (3.72)",
  zeroG: "🚀 Zero-G",
  water: "🌊 Water (2.0)",
  jupiter: "⭐ Jupiter (24.79)",
};

export default function PhysicsToolbar({
  physicsReady,
  physicsRunning,
  gravity,
  debugVisible,
  bodies,
  onPlay,
  onPause,
  onReset,
  onGravityChange,
  onDebugToggle,
  onBakePhysics,
}) {
  const [expanded, setExpanded] = useState(false);

  if (!physicsReady) return null;

  const bodyCount = bodies?.length ?? 0;

  return (
    <div
      style={{
        position: "absolute",
        bottom: 56,
        left: "50%",
        transform: "translateX(-50%)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 4,
        zIndex: 40,
        pointerEvents: "auto",
      }}
    >
      {/* Expanded panel */}
      {expanded && (
        <div
          style={{
            background: "rgba(26,32,44,0.95)",
            borderRadius: 8,
            padding: "8px 12px",
            display: "flex",
            flexDirection: "column",
            gap: 6,
            border: "1px solid #2d3748",
            minWidth: 220,
            backdropFilter: "blur(8px)",
          }}
        >
          {/* Gravity preset */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 11, color: "#a0aec0", width: 50 }}>Gravity</span>
            <select
              value={gravity}
              onChange={(e) => onGravityChange?.(e.target.value)}
              style={{
                flex: 1,
                background: "#2d3748",
                color: "#e2e8f0",
                border: "1px solid #4a5568",
                borderRadius: 4,
                padding: "2px 4px",
                fontSize: 11,
              }}
            >
              {Object.keys(GRAVITY_PRESETS).map((key) => (
                <option key={key} value={key}>
                  {PRESET_LABELS[key] || key}
                </option>
              ))}
            </select>
          </div>

          {/* Debug wireframe toggle */}
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "#a0aec0", cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={debugVisible}
              onChange={(e) => onDebugToggle?.(e.target.checked)}
            />
            Show Collider Debug
          </label>

          {/* Body count */}
          <div style={{ fontSize: 10, color: "#718096" }}>
            {bodyCount} physics {bodyCount === 1 ? "body" : "bodies"} active
          </div>

          {/* Bake to keyframes */}
          {bodyCount > 0 && (
            <button
              onClick={() => onBakePhysics?.()}
              style={{
                background: "#2d3748",
                color: "#e2e8f0",
                border: "1px solid #4a5568",
                borderRadius: 4,
                padding: "3px 8px",
                fontSize: 11,
                cursor: "pointer",
              }}
              disabled={physicsRunning}
            >
              📹 Bake to Keyframes
            </button>
          )}
        </div>
      )}

      {/* Main controls bar */}
      <div
        style={{
          background: "rgba(26,32,44,0.92)",
          borderRadius: 8,
          padding: "4px 8px",
          display: "flex",
          alignItems: "center",
          gap: 6,
          border: "1px solid #2d3748",
          backdropFilter: "blur(8px)",
        }}
      >
        {/* Toggle expand */}
        <button
          onClick={() => setExpanded(v => !v)}
          title="Physics Settings"
          style={{
            background: expanded ? "#4a5568" : "transparent",
            border: "none",
            color: "#a0aec0",
            cursor: "pointer",
            fontSize: 14,
            padding: "2px 4px",
            borderRadius: 4,
          }}
        >
          ⚙
        </button>

        <div style={{ width: 1, height: 20, background: "#4a5568" }} />

        {/* Play / Pause */}
        {!physicsRunning ? (
          <button
            onClick={onPlay}
            title="Play Physics"
            disabled={bodyCount === 0}
            style={{
              background: bodyCount > 0 ? "#38a169" : "#4a5568",
              border: "none",
              color: "#fff",
              cursor: bodyCount > 0 ? "pointer" : "default",
              fontSize: 14,
              padding: "4px 10px",
              borderRadius: 4,
              fontWeight: 700,
            }}
          >
            ▶
          </button>
        ) : (
          <button
            onClick={onPause}
            title="Pause Physics"
            style={{
              background: "#dd6b20",
              border: "none",
              color: "#fff",
              cursor: "pointer",
              fontSize: 14,
              padding: "4px 10px",
              borderRadius: 4,
              fontWeight: 700,
            }}
          >
            ⏸
          </button>
        )}

        {/* Reset */}
        <button
          onClick={onReset}
          title="Reset Physics"
          disabled={bodyCount === 0}
          style={{
            background: "transparent",
            border: "1px solid #4a5568",
            color: "#a0aec0",
            cursor: bodyCount > 0 ? "pointer" : "default",
            fontSize: 12,
            padding: "4px 8px",
            borderRadius: 4,
          }}
        >
          ⏹ Reset
        </button>

        {/* Status */}
        <span style={{ fontSize: 10, color: physicsRunning ? "#68d391" : "#718096", minWidth: 40 }}>
          {physicsRunning ? "LIVE" : bodyCount > 0 ? `${bodyCount} bod` : "OFF"}
        </span>
      </div>
    </div>
  );
}
