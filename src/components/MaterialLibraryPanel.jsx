// src/components/MaterialLibraryPanel.jsx
// ---------------------------------------------------------------------------
// Phase 6 — Material Library & Procedural Textures panel.
// Appears as a tab in the right-side Studio inspector.
// Three sections:
//   (1) PBR Material Library — browse, search, preview, apply
//   (2) Procedural Textures — generate and apply texture maps
//   (3) Custom Presets — save current material as preset
// ---------------------------------------------------------------------------

import React, { useState, useCallback, useMemo, useEffect, useRef } from "react";
import {
  FiSearch,
  FiDroplet,
  FiGrid,
  FiSave,
  FiCheck,
  FiRotateCcw,
  FiX,
} from "react-icons/fi";
import {
  MATERIAL_CATEGORIES,
  MATERIAL_PRESETS,
  getPresetsByCategory,
  searchPresets,
  applyPreset,
  rollbackPreset,
  extractMaterialParams,
  createCustomPreset,
  buildMaterial,
} from "../engine/MaterialLibrary";
import { TEXTURE_CATALOG, applyTextureDescriptor } from "../engine/TextureGenerator";

import "../styles/MaterialLibraryPanel.css";

export default function MaterialLibraryPanel({ workspaceRef, selected, pushToast }) {
  const [tab, setTab] = useState("library");          // library | textures | custom
  const [activeCategory, setActiveCategory] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [lastRollback, setLastRollback] = useState(null);
  const [customPresets, setCustomPresets] = useState([]);
  const [customName, setCustomName] = useState("");
  const [selectedTexType, setSelectedTexType] = useState(null);
  const [texChannel, setTexChannel] = useState("color");

  // ── Filtered presets ─────────────────────────────────────────────
  const filteredPresets = useMemo(() => {
    if (searchQuery.trim()) return searchPresets(searchQuery);
    if (activeCategory) return getPresetsByCategory(activeCategory);
    return MATERIAL_PRESETS;
  }, [searchQuery, activeCategory]);

  // ── Helper to request a viewport render after material changes ──
  const markDirty = useCallback(() => {
    try { workspaceRef?.current?.markDirty?.(); } catch (e) {}
  }, [workspaceRef]);

  // ── Apply a material preset to selected mesh ────────────────────
  const handleApplyPreset = useCallback(
    (preset) => {
      if (!selected?.isMesh) {
        pushToast?.({ type: "warning", message: "Select a mesh to apply material" });
        return;
      }
      try {
        const rollback = applyPreset(selected, preset);

        // If preset has a texture descriptor, apply it
        if (preset.texture) {
          applyTextureDescriptor(selected.material, preset.texture);
        }

        setLastRollback(rollback);
        markDirty();
        pushToast?.({ type: "info", message: `Applied: ${preset.name}` });
      } catch (err) {
        pushToast?.({ type: "error", message: `Failed: ${err.message}` });
      }
    },
    [selected, pushToast, markDirty],
  );

  // ── Undo last material application ──────────────────────────────
  const handleUndo = useCallback(() => {
    if (!lastRollback) return;
    rollbackPreset(lastRollback);
    setLastRollback(null);
    markDirty();
    pushToast?.({ type: "info", message: "Material reverted" });
  }, [lastRollback, pushToast, markDirty]);

  // ── Apply procedural texture ────────────────────────────────────
  const handleApplyTexture = useCallback(
    (texEntry) => {
      if (!selected?.isMesh || !selected.material) {
        pushToast?.({ type: "warning", message: "Select a mesh first" });
        return;
      }
      try {
        const tex = texEntry.fn({ size: 256 });
        const channelMap = {
          color: "map",
          roughness: "roughnessMap",
          metalness: "metalnessMap",
          emissive: "emissiveMap",
          normal: "normalMap",
          ao: "aoMap",
        };
        const slot = channelMap[texChannel] || "map";
        selected.material[slot] = tex;
        selected.material.needsUpdate = true;
        markDirty();
        pushToast?.({ type: "info", message: `${texEntry.label} → ${texChannel}` });
      } catch (err) {
        pushToast?.({ type: "error", message: err.message });
      }
    },
    [selected, texChannel, pushToast, markDirty],
  );

  // ── Save custom preset ──────────────────────────────────────────
  const handleSaveCustom = useCallback(() => {
    if (!selected?.isMesh) {
      pushToast?.({ type: "warning", message: "Select a mesh first" });
      return;
    }
    try {
      const preset = createCustomPreset(selected, customName || "My Material");
      setCustomPresets((prev) => [preset, ...prev]);
      setCustomName("");
      pushToast?.({ type: "info", message: `Saved: ${preset.name}` });
    } catch (err) {
      pushToast?.({ type: "error", message: err.message });
    }
  }, [selected, customName, pushToast]);

  // ── Remove custom preset ────────────────────────────────────────
  const removeCustom = useCallback((id) => {
    setCustomPresets((prev) => prev.filter((p) => p.id !== id));
  }, []);

  // ── Current material info ───────────────────────────────────────
  const currentParams = useMemo(() => {
    if (!selected?.isMesh) return null;
    return extractMaterialParams(selected);
  }, [selected]);

  return (
    <div className="matlib-panel">
      {/* Sub-tabs */}
      <div className="matlib-tabs">
        <button
          className={`matlib-tab ${tab === "library" ? "matlib-tab--active" : ""}`}
          onClick={() => setTab("library")}
        >
          <FiDroplet /> Library
        </button>
        <button
          className={`matlib-tab ${tab === "textures" ? "matlib-tab--active" : ""}`}
          onClick={() => setTab("textures")}
        >
          <FiGrid /> Textures
        </button>
        <button
          className={`matlib-tab ${tab === "custom" ? "matlib-tab--active" : ""}`}
          onClick={() => setTab("custom")}
        >
          <FiSave /> Custom
        </button>
      </div>

      {/* ── Library Tab ─────────────────────────────────────────── */}
      {tab === "library" && (
        <div className="matlib-section">
          {/* Search */}
          <div className="matlib-search-row">
            <FiSearch className="matlib-search-icon" />
            <input
              className="studio-input matlib-search"
              placeholder="Search materials…"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                if (e.target.value) setActiveCategory(null);
              }}
              aria-label="Search materials"
            />
            {searchQuery && (
              <button className="matlib-clear-btn" onClick={() => setSearchQuery("")}>
                <FiX />
              </button>
            )}
          </div>

          {/* Category chips */}
          <div className="matlib-categories">
            <button
              className={`matlib-chip ${!activeCategory && !searchQuery ? "matlib-chip--active" : ""}`}
              onClick={() => { setActiveCategory(null); setSearchQuery(""); }}
            >
              All
            </button>
            {MATERIAL_CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                className={`matlib-chip ${activeCategory === cat.id ? "matlib-chip--active" : ""}`}
                onClick={() => { setActiveCategory(cat.id); setSearchQuery(""); }}
                title={cat.label}
              >
                {cat.icon} {cat.label}
              </button>
            ))}
          </div>

          {/* Undo last */}
          {lastRollback && (
            <button className="studio-btn matlib-undo-btn" onClick={handleUndo}>
              <FiRotateCcw /> Undo material change
            </button>
          )}

          {/* Material grid */}
          <div className="matlib-grid">
            {filteredPresets.map((preset) => (
              <MaterialCard
                key={preset.id}
                preset={preset}
                onApply={() => handleApplyPreset(preset)}
                disabled={!selected?.isMesh}
              />
            ))}
            {filteredPresets.length === 0 && (
              <div className="panel-empty matlib-empty">No materials match your search.</div>
            )}
          </div>
        </div>
      )}

      {/* ── Textures Tab ────────────────────────────────────────── */}
      {tab === "textures" && (
        <div className="matlib-section">
          <p className="matlib-hint">
            Generate procedural textures and apply them to the selected mesh's material channels.
          </p>

          {/* Channel selector */}
          <div className="matlib-channel-row">
            <span className="matlib-channel-label">Target channel:</span>
            <select
              className="studio-input matlib-channel-select"
              value={texChannel}
              onChange={(e) => setTexChannel(e.target.value)}
            >
              <option value="color">Color (albedo)</option>
              <option value="roughness">Roughness</option>
              <option value="metalness">Metalness</option>
              <option value="emissive">Emissive</option>
              <option value="normal">Normal</option>
              <option value="ao">Ambient Occlusion</option>
            </select>
          </div>

          {/* Texture generator grid */}
          <div className="matlib-tex-grid">
            {TEXTURE_CATALOG.map((tex) => (
              <button
                key={tex.id}
                className="matlib-tex-card"
                onClick={() => handleApplyTexture(tex)}
                disabled={!selected?.isMesh}
                title={`Apply ${tex.label} to ${texChannel}`}
              >
                <span className="matlib-tex-icon">{tex.icon}</span>
                <span className="matlib-tex-label">{tex.label}</span>
              </button>
            ))}
          </div>

          {/* Current material info */}
          {currentParams && (
            <div className="matlib-current">
              <div className="panel-title">Current Material</div>
              <div className="matlib-current-props">
                {currentParams.color && (
                  <span className="matlib-prop">
                    <span className="matlib-swatch" style={{ background: currentParams.color }} />
                    {currentParams.color}
                  </span>
                )}
                {currentParams.roughness != null && (
                  <span className="matlib-prop">R: {currentParams.roughness.toFixed(2)}</span>
                )}
                {currentParams.metalness != null && (
                  <span className="matlib-prop">M: {currentParams.metalness.toFixed(2)}</span>
                )}
                {currentParams.emissive && (
                  <span className="matlib-prop">
                    E: <span className="matlib-swatch" style={{ background: currentParams.emissive }} />
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Custom Tab ──────────────────────────────────────────── */}
      {tab === "custom" && (
        <div className="matlib-section">
          <p className="matlib-hint">
            Save the selected mesh's current material as a reusable preset.
          </p>

          <div className="matlib-save-row">
            <input
              className="studio-input matlib-save-input"
              placeholder="Preset name…"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              aria-label="Custom preset name"
            />
            <button
              className="studio-btn matlib-save-btn"
              onClick={handleSaveCustom}
              disabled={!selected?.isMesh}
            >
              <FiSave /> Save
            </button>
          </div>

          {customPresets.length === 0 ? (
            <div className="panel-empty matlib-empty">No custom presets yet.</div>
          ) : (
            <div className="matlib-grid">
              {customPresets.map((preset) => (
                <div key={preset.id} className="matlib-custom-card">
                  <MaterialCard
                    preset={preset}
                    onApply={() => handleApplyPreset(preset)}
                    disabled={!selected?.isMesh}
                  />
                  <button
                    className="matlib-remove-custom"
                    onClick={() => removeCustom(preset.id)}
                    title="Remove"
                  >
                    <FiX />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   MaterialCard — individual preset card with color swatch preview
   ═══════════════════════════════════════════════════════════════════════ */

function MaterialCard({ preset, onApply, disabled }) {
  const params = preset.params || {};
  const bgColor = params.color || "#808080";
  const isTransparent = params.transparent;
  const isEmissive = params.emissive;

  // Build a CSS preview that hints at the material
  const swatchStyle = useMemo(() => {
    const style = {
      background: bgColor,
    };

    // Metallic shimmer
    if ((params.metalness || 0) > 0.5) {
      style.background = `linear-gradient(135deg, ${bgColor} 30%, ${lighten(bgColor, 30)} 50%, ${bgColor} 70%)`;
    }

    // Emissive glow
    if (isEmissive) {
      style.boxShadow = `0 0 8px 2px ${params.emissive}`;
    }

    // Transparent
    if (isTransparent) {
      const op = params.opacity ?? 0.5;
      style.opacity = Math.max(0.3, op);
    }

    return style;
  }, [params, bgColor, isTransparent, isEmissive]);

  return (
    <button
      className="matlib-card"
      onClick={onApply}
      disabled={disabled}
      title={`${preset.name}\nRough: ${params.roughness ?? "?"} Metal: ${params.metalness ?? "?"}`}
    >
      <div className="matlib-card-swatch" style={swatchStyle}>
        {params.wireframe && <span className="matlib-wireframe-icon">◇</span>}
      </div>
      <span className="matlib-card-name">{preset.name}</span>
      <span className="matlib-card-meta">
        R:{(params.roughness ?? 0).toFixed(1)} M:{(params.metalness ?? 0).toFixed(1)}
      </span>
    </button>
  );
}

/* Lighten a hex color by a % amount. */
function lighten(hex, pct) {
  let r = parseInt(hex.slice(1, 3), 16);
  let g = parseInt(hex.slice(3, 5), 16);
  let b = parseInt(hex.slice(5, 7), 16);
  r = Math.min(255, r + Math.round((255 - r) * pct / 100));
  g = Math.min(255, g + Math.round((255 - g) * pct / 100));
  b = Math.min(255, b + Math.round((255 - b) * pct / 100));
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}
