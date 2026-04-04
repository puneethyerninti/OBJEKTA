// src/components/ViewportControls.jsx
// Professional 3D viewport controls similar to Blender - Gizmo modes, Shading, Snapping UI
import React, { useState, useCallback, useEffect, useRef } from "react";
import EventBus from "../utils/EventBus";
import * as SnapManager from "../engine/SnapManager";

const ACCENT = "#7f5af0";
const BTN_ACTIVE = "rgba(127, 90, 240, 0.35)";

// Viewport shading modes
const SHADING_MODES = [
  { id: "solid", label: "Solid", icon: "▣", desc: "Basic solid shading" },
  { id: "wireframe", label: "Wireframe", icon: "◫", desc: "Wireframe overlay" },
  { id: "material", label: "Material", icon: "◉", desc: "Material preview" },
  { id: "rendered", label: "Rendered", icon: "◎", desc: "Full render with effects" },
];

// Transform space modes
const SPACE_MODES = [
  { id: "world", label: "World", icon: "🌍" },
  { id: "local", label: "Local", icon: "📦" },
];

// Pivot point modes
const PIVOT_MODES = [
  { id: "center", label: "Bounding Box Center", icon: "⊞" },
  { id: "origin", label: "Origin", icon: "⊙" },
  { id: "cursor", label: "3D Cursor", icon: "⊕" },
  { id: "active", label: "Active Element", icon: "◆" },
];

// Snap types
const SNAP_TYPES = [
  { id: "increment", label: "Increment", icon: "▦" },
  { id: "vertex", label: "Vertex", icon: "•" },
  { id: "edge", label: "Edge", icon: "—" },
  { id: "face", label: "Face", icon: "▢" },
  { id: "grid", label: "Grid", icon: "⊞" },
];

export default function ViewportControls({
  workspaceRef,
  transformMode = "translate",
  onTransformModeChange,
  shadingMode = "rendered",
  onShadingModeChange,
  snapEnabled = false,
  onSnapToggle,
  snapSize = 0.5,
  onSnapSizeChange,
}) {
  const [space, setSpace] = useState("world"); // world | local
  const [pivot, setPivot] = useState("center");
  const [snapType, setSnapType] = useState("increment");
  const [showSnapMenu, setShowSnapMenu] = useState(false);
  const [showShadingMenu, setShowShadingMenu] = useState(false);
  const [overlays, setOverlays] = useState({
    grid: true,
    axes: true,
    helpers: true,
    gizmo: true,
    stats: false,
  });

  const snapMenuRef = useRef(null);
  const shadingMenuRef = useRef(null);

  // Close menus on outside click
  useEffect(() => {
    const handler = (e) => {
      if (snapMenuRef.current && !snapMenuRef.current.contains(e.target)) {
        setShowSnapMenu(false);
      }
      if (shadingMenuRef.current && !shadingMenuRef.current.contains(e.target)) {
        setShowShadingMenu(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Update transform space
  const handleSpaceChange = useCallback((newSpace) => {
    setSpace(newSpace);
    try {
      const ws = workspaceRef?.current;
      if (ws?.setTransformSpace) {
        ws.setTransformSpace(newSpace);
      }
      EventBus?.emit?.("transform:space:change", { space: newSpace });
    } catch (e) {}
  }, [workspaceRef]);

  // Update pivot mode
  const handlePivotChange = useCallback((newPivot) => {
    setPivot(newPivot);
    try {
      EventBus?.emit?.("transform:pivot:change", { pivot: newPivot });
    } catch (e) {}
  }, []);

  // Handle viewport shading
  const handleShadingChange = useCallback((mode) => {
    onShadingModeChange?.(mode);
    setShowShadingMenu(false);
    try {
      const ws = workspaceRef?.current;
      if (ws?.setViewportShading) {
        ws.setViewportShading(mode);
      }
      EventBus?.emit?.("viewport:shading:change", { mode });
    } catch (e) {}
  }, [workspaceRef, onShadingModeChange]);

  // Handle snap type change
  const handleSnapTypeChange = useCallback((type) => {
    setSnapType(type);
    try {
      // Update SnapManager based on selected type
      SnapManager.setSurfaceSnap(type === "face");
      SnapManager.setVertexSnap(type === "vertex" || type === "increment");
      SnapManager.setEdgeSnap(type === "edge" || type === "increment");
      SnapManager.setCenterSnap(type === "increment" || type === "vertex");
      EventBus?.emit?.("snap:type:change", { type });
    } catch (e) {}
  }, []);

  // Toggle overlay visibility
  const toggleOverlay = useCallback((key) => {
    setOverlays((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      try {
        EventBus?.emit?.("viewport:overlay:toggle", { key, visible: next[key] });
      } catch (e) {}
      return next;
    });
  }, []);

  // Keyboard shortcuts for transform modes (G/R/S like Blender)
  useEffect(() => {
    const onKey = (e) => {
      const tag = e.target?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select" || e.target?.isContentEditable) return;

      const key = e.key.toLowerCase();

      // G = Grab (translate)
      if (key === "g" && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        onTransformModeChange?.("translate");
      }
      // R = Rotate
      else if (key === "r" && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        onTransformModeChange?.("rotate");
      }
      // S = Scale
      else if (key === "s" && !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey) {
        e.preventDefault();
        onTransformModeChange?.("scale");
      }
      // X/Y/Z = Axis constraint
      else if (["x", "y", "z"].includes(key) && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        const current = SnapManager.getAxisConstraint();
        SnapManager.setAxisConstraint(current === key ? null : key);
        EventBus?.emit?.("snap:axis:change", { axis: SnapManager.getAxisConstraint() });
      }
      // Tab = Toggle space
      else if (key === "tab" && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
        // Don't prevent default tab behavior, but toggle space
      }
      // Z = Wireframe toggle (like Blender)
      else if (key === "z" && !e.ctrlKey && !e.metaKey && e.shiftKey) {
        e.preventDefault();
        const modes = ["solid", "wireframe", "material", "rendered"];
        const currentIdx = modes.indexOf(shadingMode);
        const nextIdx = (currentIdx + 1) % modes.length;
        handleShadingChange(modes[nextIdx]);
      }
      // Period (.) = Frame selected (Blender: Numpad .)
      else if (key === "." && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        try {
          workspaceRef?.current?.frameSelection?.();
        } catch (err) {}
      }
      // Home = Frame all
      else if (key === "home" && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        try {
          workspaceRef?.current?.frameAll?.();
        } catch (err) {}
      }
      // Alt+S = Toggle snap
      else if (key === "s" && e.altKey && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        const newEnabled = !SnapManager.isEnabled();
        SnapManager.setEnabled(newEnabled);
        onSnapToggle?.(newEnabled);
        EventBus?.emit?.("snap:enabled", { enabled: newEnabled });
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onTransformModeChange, shadingMode, handleShadingChange, workspaceRef, onSnapToggle]);

  const btnStyle = (active) => ({
    background: active ? BTN_ACTIVE : "rgba(0,0,0,0.4)",
    border: "1px solid " + (active ? ACCENT : "#444"),
    color: active ? "#fff" : "#aaa",
    padding: "4px 8px",
    borderRadius: 4,
    cursor: "pointer",
    fontSize: 11,
    fontWeight: active ? 600 : 400,
    minWidth: 32,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    transition: "all 0.15s ease",
  });

  const iconBtnStyle = (active) => ({
    ...btnStyle(active),
    padding: "4px 6px",
    minWidth: 28,
    fontSize: 13,
  });

  return (
    <div
      style={{
        position: "absolute",
        top: 12,
        left: "50%",
        transform: "translateX(-50%)",
        display: "flex",
        gap: 4,
        alignItems: "center",
        background: "rgba(26, 32, 44, 0.92)",
        padding: "6px 10px",
        borderRadius: 8,
        border: "1px solid #2d3748",
        backdropFilter: "blur(8px)",
        zIndex: 100,
        pointerEvents: "auto",
      }}
    >
      {/* Transform Mode Buttons */}
      <div style={{ display: "flex", gap: 2 }} title="Transform Mode (G/R/S)">
        <button
          style={iconBtnStyle(transformMode === "translate")}
          onClick={() => onTransformModeChange?.("translate")}
          title="Move (G)"
        >
          ⊹
        </button>
        <button
          style={iconBtnStyle(transformMode === "rotate")}
          onClick={() => onTransformModeChange?.("rotate")}
          title="Rotate (R)"
        >
          ↻
        </button>
        <button
          style={iconBtnStyle(transformMode === "scale")}
          onClick={() => onTransformModeChange?.("scale")}
          title="Scale (S)"
        >
          ⤢
        </button>
      </div>

      <div style={{ width: 1, height: 20, background: "#444", margin: "0 4px" }} />

      {/* Transform Space Toggle */}
      <div style={{ display: "flex", gap: 2 }} title="Transform Space">
        {SPACE_MODES.map((mode) => (
          <button
            key={mode.id}
            style={iconBtnStyle(space === mode.id)}
            onClick={() => handleSpaceChange(mode.id)}
            title={`${mode.label} Space`}
          >
            {mode.icon}
          </button>
        ))}
      </div>

      <div style={{ width: 1, height: 20, background: "#444", margin: "0 4px" }} />

      {/* Snap Toggle & Menu */}
      <div style={{ position: "relative" }} ref={snapMenuRef}>
        <button
          style={{
            ...iconBtnStyle(snapEnabled),
            background: snapEnabled ? "rgba(72, 187, 120, 0.3)" : "rgba(0,0,0,0.4)",
            borderColor: snapEnabled ? "#48bb78" : "#444",
          }}
          onClick={() => onSnapToggle?.(!snapEnabled)}
          onContextMenu={(e) => {
            e.preventDefault();
            setShowSnapMenu((v) => !v);
          }}
          title="Snap Toggle (Right-click for options)"
        >
          🧲
        </button>
        {showSnapMenu && (
          <div
            style={{
              position: "absolute",
              top: "100%",
              left: 0,
              marginTop: 4,
              background: "rgba(26, 32, 44, 0.98)",
              border: "1px solid #2d3748",
              borderRadius: 6,
              padding: 8,
              minWidth: 180,
              zIndex: 1000,
            }}
          >
            <div style={{ fontSize: 10, color: "#718096", marginBottom: 6, fontWeight: 600 }}>
              SNAP OPTIONS
            </div>
            {/* Snap Type */}
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 10, color: "#a0aec0", marginBottom: 4 }}>Snap To:</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                {SNAP_TYPES.map((type) => (
                  <button
                    key={type.id}
                    style={{
                      ...btnStyle(snapType === type.id),
                      padding: "2px 6px",
                      fontSize: 10,
                    }}
                    onClick={() => handleSnapTypeChange(type.id)}
                    title={type.label}
                  >
                    {type.icon} {type.label}
                  </button>
                ))}
              </div>
            </div>
            {/* Snap Size */}
            <div>
              <div style={{ fontSize: 10, color: "#a0aec0", marginBottom: 4 }}>
                Grid Size: {snapSize.toFixed(2)}
              </div>
              <input
                type="range"
                min="0.05"
                max="2"
                step="0.05"
                value={snapSize}
                onChange={(e) => onSnapSizeChange?.(parseFloat(e.target.value))}
                style={{ width: "100%" }}
              />
            </div>
            {/* Angle Snap */}
            <div style={{ marginTop: 8 }}>
              <div style={{ fontSize: 10, color: "#a0aec0", marginBottom: 4 }}>
                Angle Snap: {SnapManager.getAngleStep()}°
              </div>
              <div style={{ display: "flex", gap: 4 }}>
                {[5, 15, 30, 45, 90].map((deg) => (
                  <button
                    key={deg}
                    style={{
                      ...btnStyle(SnapManager.getAngleStep() === deg),
                      padding: "2px 6px",
                      fontSize: 10,
                      flex: 1,
                    }}
                    onClick={() => {
                      SnapManager.setAngleStep(deg);
                      EventBus?.emit?.("snap:angle:change", { angle: deg });
                    }}
                  >
                    {deg}°
                  </button>
                ))}
              </div>
            </div>
            {/* Smart Snap Threshold */}
            <div style={{ marginTop: 8 }}>
              <div style={{ fontSize: 10, color: "#a0aec0", marginBottom: 4 }}>
                Snap Threshold: {SnapManager.getSnapThreshold()}px
              </div>
              <input
                type="range"
                min="5"
                max="50"
                step="5"
                value={SnapManager.getSnapThreshold()}
                onChange={(e) => {
                  SnapManager.setSnapThreshold(parseInt(e.target.value));
                  EventBus?.emit?.("snap:settings:changed", { threshold: parseInt(e.target.value) });
                }}
                style={{ width: "100%" }}
              />
            </div>
            {/* Smart Snap Toggles */}
            <div style={{ marginTop: 8 }}>
              <div style={{ fontSize: 10, color: "#a0aec0", marginBottom: 4 }}>Smart Snap:</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10, color: "#cbd5e0", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={SnapManager.isVertexSnap()}
                    onChange={(e) => {
                      SnapManager.setVertexSnap(e.target.checked);
                      EventBus?.emit?.("snap:settings:changed", { vertexSnap: e.target.checked });
                    }}
                    style={{ margin: 0 }}
                  />
                  • Vertex
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10, color: "#cbd5e0", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={SnapManager.isEdgeSnap()}
                    onChange={(e) => {
                      SnapManager.setEdgeSnap(e.target.checked);
                      EventBus?.emit?.("snap:settings:changed", { edgeSnap: e.target.checked });
                    }}
                    style={{ margin: 0 }}
                  />
                  — Edge
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10, color: "#cbd5e0", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={SnapManager.isCenterSnap()}
                    onChange={(e) => {
                      SnapManager.setCenterSnap(e.target.checked);
                      EventBus?.emit?.("snap:settings:changed", { centerSnap: e.target.checked });
                    }}
                    style={{ margin: 0 }}
                  />
                  ⊙ Center
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10, color: "#cbd5e0", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={SnapManager.isShowIndicators()}
                    onChange={(e) => {
                      SnapManager.setShowIndicators(e.target.checked);
                      EventBus?.emit?.("snap:settings:changed", { showIndicators: e.target.checked });
                    }}
                    style={{ margin: 0 }}
                  />
                  👁 Show Indicators
                </label>
              </div>
            </div>
          </div>
        )}
      </div>

      <div style={{ width: 1, height: 20, background: "#444", margin: "0 4px" }} />

      {/* Viewport Shading */}
      <div style={{ position: "relative" }} ref={shadingMenuRef}>
        <button
          style={btnStyle(false)}
          onClick={() => setShowShadingMenu((v) => !v)}
          title="Viewport Shading (Shift+Z to cycle)"
        >
          {SHADING_MODES.find((m) => m.id === shadingMode)?.icon || "◎"}{" "}
          <span style={{ fontSize: 10 }}>
            {SHADING_MODES.find((m) => m.id === shadingMode)?.label || "Rendered"}
          </span>
        </button>
        {showShadingMenu && (
          <div
            style={{
              position: "absolute",
              top: "100%",
              left: 0,
              marginTop: 4,
              background: "rgba(26, 32, 44, 0.98)",
              border: "1px solid #2d3748",
              borderRadius: 6,
              padding: 8,
              minWidth: 160,
              zIndex: 1000,
            }}
          >
            <div style={{ fontSize: 10, color: "#718096", marginBottom: 6, fontWeight: 600 }}>
              SHADING
            </div>
            {SHADING_MODES.map((mode) => (
              <button
                key={mode.id}
                style={{
                  ...btnStyle(shadingMode === mode.id),
                  width: "100%",
                  marginBottom: 4,
                  justifyContent: "flex-start",
                }}
                onClick={() => handleShadingChange(mode.id)}
              >
                <span style={{ width: 20 }}>{mode.icon}</span>
                {mode.label}
              </button>
            ))}
            <div
              style={{ height: 1, background: "#2d3748", margin: "8px 0" }}
            />
            <div style={{ fontSize: 10, color: "#718096", marginBottom: 6, fontWeight: 600 }}>
              OVERLAYS
            </div>
            {Object.entries(overlays).map(([key, visible]) => (
              <label
                key={key}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  fontSize: 11,
                  color: "#a0aec0",
                  cursor: "pointer",
                  padding: "2px 0",
                }}
              >
                <input
                  type="checkbox"
                  checked={visible}
                  onChange={() => toggleOverlay(key)}
                />
                {key.charAt(0).toUpperCase() + key.slice(1)}
              </label>
            ))}
          </div>
        )}
      </div>

      <div style={{ width: 1, height: 20, background: "#444", margin: "0 4px" }} />

      {/* Pivot Point */}
      <select
        value={pivot}
        onChange={(e) => handlePivotChange(e.target.value)}
        style={{
          background: "rgba(0,0,0,0.4)",
          border: "1px solid #444",
          color: "#aaa",
          padding: "4px 6px",
          borderRadius: 4,
          fontSize: 10,
          cursor: "pointer",
        }}
        title="Pivot Point"
      >
        {PIVOT_MODES.map((mode) => (
          <option key={mode.id} value={mode.id}>
            {mode.icon} {mode.label}
          </option>
        ))}
      </select>
    </div>
  );
}
