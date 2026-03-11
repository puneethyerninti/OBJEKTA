// src/components/ProceduralPanel.jsx
// ---------------------------------------------------------------------------
// Phase 5 — Procedural Generation & Scene Presets panel.
// Appears as a tab in the right-side Studio inspector.
// Two sections: (1) Procedural Generators with parameter controls,
// (2) Scene Presets with one-click apply.
// ---------------------------------------------------------------------------

import React, { useState, useCallback, useMemo } from "react";
import { FiBox, FiGrid, FiLayers, FiPlay, FiRotateCcw } from "react-icons/fi";
import { PROCEDURAL_CATALOG } from "../engine/ProceduralGenerator";
import { PRESET_CATALOG } from "../engine/ScenePresets";
import { SceneGraphStore } from "../store/SceneGraphStore";
import EventBus from "../utils/EventBus";

import "../styles/ProceduralPanel.css";

export default function ProceduralPanel({ workspaceRef, pushToast }) {
  const [activeGen, setActiveGen] = useState(null);   // selected generator id
  const [params, setParams] = useState({});            // current param values
  const [tab, setTab] = useState("generators");        // generators | presets

  // ── Initialize params when selecting a generator ─────────────────
  const selectGenerator = useCallback((gen) => {
    setActiveGen(gen.id);
    const defaults = {};
    for (const p of gen.params) {
      defaults[p.key] = p.default;
    }
    setParams(defaults);
  }, []);

  // ── Update a single param ────────────────────────────────────────
  const updateParam = useCallback((key, value) => {
    setParams((prev) => ({ ...prev, [key]: value }));
  }, []);

  // ── Generate & add to scene ──────────────────────────────────────
  const handleGenerate = useCallback(() => {
    const gen = PROCEDURAL_CATALOG.find((g) => g.id === activeGen);
    if (!gen) return;
    try {
      const result = gen.fn(params);
      addToScene(result, workspaceRef, pushToast);
      pushToast?.({ type: "info", message: `Generated: ${gen.label}` });
    } catch (err) {
      pushToast?.({ type: "error", message: `Generation failed: ${err.message}` });
    }
  }, [activeGen, params, workspaceRef, pushToast]);

  // ── Apply preset ─────────────────────────────────────────────────
  const handlePreset = useCallback((preset) => {
    try {
      const result = preset.fn();
      addToScene(result, workspaceRef, pushToast);
      pushToast?.({ type: "info", message: `Applied preset: ${preset.label}` });
    } catch (err) {
      pushToast?.({ type: "error", message: `Preset failed: ${err.message}` });
    }
  }, [workspaceRef, pushToast]);

  // Current generator definition
  const currentGen = useMemo(
    () => PROCEDURAL_CATALOG.find((g) => g.id === activeGen),
    [activeGen],
  );

  return (
    <div className="procedural-panel">
      {/* Tab bar */}
      <div className="proc-tab-bar">
        <button
          className={`proc-tab ${tab === "generators" ? "proc-tab--active" : ""}`}
          onClick={() => setTab("generators")}
        >
          <FiBox /> Generators
        </button>
        <button
          className={`proc-tab ${tab === "presets" ? "proc-tab--active" : ""}`}
          onClick={() => setTab("presets")}
        >
          <FiLayers /> Presets
        </button>
      </div>

      {/* ── Generators Tab ──────────────────────────────────────────── */}
      {tab === "generators" && (
        <div className="proc-section">
          <div className="proc-grid">
            {PROCEDURAL_CATALOG.map((gen) => (
              <button
                key={gen.id}
                className={`proc-card ${activeGen === gen.id ? "proc-card--active" : ""}`}
                onClick={() => selectGenerator(gen)}
                title={gen.label}
              >
                <span className="proc-card-icon">{gen.icon}</span>
                <span className="proc-card-label">{gen.label}</span>
              </button>
            ))}
          </div>

          {/* Parameter controls */}
          {currentGen && (
            <div className="proc-params">
              <div className="panel-title proc-params-title">
                {currentGen.icon} {currentGen.label} Parameters
              </div>
              {currentGen.params.map((p) => (
                <ParamControl
                  key={p.key}
                  param={p}
                  value={params[p.key]}
                  onChange={(v) => updateParam(p.key, v)}
                />
              ))}
              <button className="studio-btn proc-generate-btn" onClick={handleGenerate}>
                <FiPlay /> Generate
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Presets Tab ─────────────────────────────────────────────── */}
      {tab === "presets" && (
        <div className="proc-section">
          <p className="proc-hint">Apply a complete scene template. Objects and lights will be added to your scene.</p>
          <div className="proc-preset-list">
            {PRESET_CATALOG.map((preset) => (
              <button
                key={preset.id}
                className="proc-preset-card"
                onClick={() => handlePreset(preset)}
              >
                <span className="proc-preset-icon">{preset.icon}</span>
                <div className="proc-preset-info">
                  <span className="proc-preset-label">{preset.label}</span>
                  <span className="proc-preset-desc">{preset.description}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   ParamControl — renders the right input for each parameter type
   ═══════════════════════════════════════════════════════════════════════ */

function ParamControl({ param, value, onChange }) {
  const { key, label, type, min, max } = param;

  if (type === "int" || type === "float") {
    const step = type === "int" ? 1 : 0.01;
    return (
      <label className="proc-param-row">
        <span className="proc-param-label">{label}</span>
        <input
          type="range"
          className="proc-slider"
          min={min}
          max={max}
          step={step}
          value={value ?? param.default}
          onChange={(e) => onChange(type === "int" ? parseInt(e.target.value, 10) : parseFloat(e.target.value))}
        />
        <span className="proc-param-value">
          {type === "float" ? (value ?? param.default).toFixed(2) : (value ?? param.default)}
        </span>
      </label>
    );
  }

  if (type === "color") {
    return (
      <label className="proc-param-row">
        <span className="proc-param-label">{label}</span>
        <input
          type="color"
          className="proc-color-input"
          value={value ?? param.default}
          onChange={(e) => onChange(e.target.value)}
        />
        <span className="proc-param-value">{value ?? param.default}</span>
      </label>
    );
  }

  if (type === "bool") {
    return (
      <label className="proc-param-row">
        <span className="proc-param-label">{label}</span>
        <input
          type="checkbox"
          className="proc-checkbox"
          checked={value ?? param.default}
          onChange={(e) => onChange(e.target.checked)}
        />
      </label>
    );
  }

  // Fallback: text
  return (
    <label className="proc-param-row">
      <span className="proc-param-label">{label}</span>
      <input
        type="text"
        className="studio-input proc-text-input"
        value={value ?? param.default ?? ""}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Utility: add a generated object to the scene
   ═══════════════════════════════════════════════════════════════════════ */

function addToScene(object, workspaceRef, pushToast) {
  const ws = workspaceRef?.current;
  if (!ws) {
    pushToast?.({ type: "warning", message: "Workspace not available" });
    return;
  }

  // Tag the object and all its descendants as __objekta so they are
  // selectable, saveable, and visible to raycaster / scene graph store.
  object.userData = object.userData || {};
  object.userData.__objekta = true;
  object.traverse((child) => {
    child.userData = child.userData || {};
    child.userData.__objekta = true;
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });

  // Use the dedicated addObject method (no normalization, with undo, BVH, etc.)
  if (typeof ws.addObject === "function") {
    try {
      ws.addObject(object);
      return;
    } catch (e) {
      // fall through to manual path
    }
  }

  // Fallback: add directly to scene and register manually
  const scene = ws.scene;
  if (!scene) {
    pushToast?.({ type: "error", message: "Cannot add object — no scene reference" });
    return;
  }

  scene.add(object);

  try {
    SceneGraphStore.addObject(object.uuid, object, {
      name: object.name || "Procedural",
      type: "procedural",
    });
    object.traverse((child) => {
      if (child !== object) {
        SceneGraphStore.addObject(child.uuid, child, {
          name: child.name || "ProceduralChild",
          type: child.isMesh ? "mesh" : child.isLight ? "light" : "group",
        });
      }
    });
  } catch (e) {}

  try { EventBus.emit("scene:updated", { id: object.uuid, type: "add" }); } catch (e) {}

  if (typeof ws.selectObject === "function") {
    try { ws.selectObject(object); } catch (e) {}
  }
  if (typeof ws.markDirty === "function") {
    try { ws.markDirty(); } catch (e) {}
  }
}
