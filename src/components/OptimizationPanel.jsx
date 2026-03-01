// src/components/OptimizationPanel.jsx
// Phase 4 — Scene Optimization & Export Panel
// Provides: scene stats, performance budget, optimization actions, export controls.

import React, { useState, useCallback } from "react";
import {
  getSceneStats,
  findDuplicateGeometries,
  findDuplicateMaterials,
  deduplicateMaterials,
  checkPerformanceBudget,
  getOptimizationRecommendations,
} from "../engine/SceneOptimizer";
import {
  estimateExportSize,
  stripMetadata,
  formatBytes,
  EXPORT_PRESETS,
} from "../engine/ExportPipeline";
import "../styles/AIAssistant.css"; // reuse existing panel styles

/* ── Inline SVG icons ──────────────────────────────────────── */
const IconStats = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="12" width="4" height="10"/><rect x="9" y="8" width="4" height="14"/><rect x="15" y="4" width="4" height="18"/></svg>
);
const IconBudget = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20V10"/><path d="M18 20V4"/><path d="M6 20v-4"/></svg>
);
const IconOptimize = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
);
const IconExport = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
);

function formatNum(n) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + "M";
  if (n >= 1000) return (n / 1000).toFixed(1) + "k";
  return String(Math.round(n));
}

/* ────────────────────────────────────────────────────────────── */
export default function OptimizationPanel({ workspaceRef, selected, pushToast }) {
  // Scene stats
  const [stats, setStats] = useState(null);
  // Performance budget
  const [budget, setBudget] = useState(null);
  // Recommendations
  const [recommendations, setRecommendations] = useState(null);
  // Export estimate
  const [exportEstimate, setExportEstimate] = useState(null);
  // Duplicate info
  const [dupGeoms, setDupGeoms] = useState(null);
  const [dupMats, setDupMats] = useState(null);
  // Busy
  const [busy, setBusy] = useState(false);
  // Export preset
  const [exportPreset, setExportPreset] = useState("medium");

  /* Helper to get scene objects */
  const getSceneObjects = useCallback(() => {
    return workspaceRef.current?.getSceneObjects?.() ?? [];
  }, [workspaceRef]);

  const getScene = useCallback(() => {
    return workspaceRef.current?.scene ?? null;
  }, [workspaceRef]);

  /* ═══════════════════════════════════════════════════════════ *
   *  Section 1: Scene Statistics                                *
   * ═══════════════════════════════════════════════════════════ */
  const handleGetStats = useCallback(() => {
    const objs = getSceneObjects();
    const scene = getScene();
    if (objs.length === 0) {
      pushToast?.({ type: "warning", message: "Scene is empty" });
      return;
    }
    const s = getSceneStats(objs, scene);
    setStats(s);
    pushToast?.({ type: "info", message: `${s.meshCount} meshes, ${formatNum(s.triangles)} tris` });
  }, [getSceneObjects, getScene, pushToast]);

  /* ═══════════════════════════════════════════════════════════ *
   *  Section 2: Performance Budget                              *
   * ═══════════════════════════════════════════════════════════ */
  const handleCheckBudget = useCallback(() => {
    const objs = getSceneObjects();
    const scene = getScene();
    if (objs.length === 0) {
      pushToast?.({ type: "warning", message: "Scene is empty" });
      return;
    }
    const result = checkPerformanceBudget(objs, scene);
    setBudget(result);

    const recs = getOptimizationRecommendations(objs, scene);
    setRecommendations(recs);

    pushToast?.({ type: "info", message: `Performance score: ${result.score}%` });
  }, [getSceneObjects, getScene, pushToast]);

  /* ═══════════════════════════════════════════════════════════ *
   *  Section 3: Optimization Actions                            *
   * ═══════════════════════════════════════════════════════════ */
  const handleFindDuplicates = useCallback(() => {
    const objs = getSceneObjects();
    if (objs.length === 0) return;
    const dg = findDuplicateGeometries(objs);
    const dm = findDuplicateMaterials(objs);
    setDupGeoms(dg);
    setDupMats(dm);
    pushToast?.({ type: "info", message: `Found ${dg.length} geometry groups, ${dm.length} material groups` });
  }, [getSceneObjects, pushToast]);

  const handleMergeMaterials = useCallback(() => {
    const objs = getSceneObjects();
    if (objs.length === 0) return;
    setBusy(true);
    try {
      const result = deduplicateMaterials(objs);
      pushToast?.({ type: "success", message: `Merged ${result.merged} duplicate material(s)` });
      // Refresh stats
      handleGetStats();
    } catch (err) {
      pushToast?.({ type: "error", message: `Material merge failed: ${err.message}` });
    } finally {
      setBusy(false);
    }
  }, [getSceneObjects, pushToast, handleGetStats]);

  const handleStripMetadata = useCallback(() => {
    const objs = getSceneObjects();
    if (objs.length === 0) return;
    const result = stripMetadata(objs);
    pushToast?.({ type: "success", message: `Cleaned ${result.cleaned} metadata entries` });
  }, [getSceneObjects, pushToast]);

  /* ═══════════════════════════════════════════════════════════ *
   *  Section 4: Export Controls                                 *
   * ═══════════════════════════════════════════════════════════ */
  const handleEstimateSize = useCallback(() => {
    const objs = getSceneObjects();
    if (objs.length === 0) {
      pushToast?.({ type: "warning", message: "Scene is empty" });
      return;
    }
    const est = estimateExportSize(objs);
    setExportEstimate(est);
    pushToast?.({ type: "info", message: `Estimated export: ${formatBytes(est.totalBytes)}` });
  }, [getSceneObjects, pushToast]);

  const handleExport = useCallback(async () => {
    if (!workspaceRef.current?.exportGLTF) {
      pushToast?.({ type: "error", message: "Export function not available" });
      return;
    }
    setBusy(true);
    try {
      await workspaceRef.current.exportGLTF(true, { download: true });
      pushToast?.({ type: "success", message: "GLB exported successfully!" });
    } catch (err) {
      pushToast?.({ type: "error", message: `Export failed: ${err.message}` });
    } finally {
      setBusy(false);
    }
  }, [workspaceRef, pushToast]);

  /* ═══════════════════════════════════════════════════════════ *
   *  RENDER                                                     *
   * ═══════════════════════════════════════════════════════════ */
  return (
    <div className="ai-assistant-panel optimize-panel">
      <div className="ai-panel-header" style={{ borderBottom: "2px solid #f59e0b" }}>
        <h3>Scene Optimizer</h3>
        <span className="ai-status-badge" style={{ background: "#f59e0b22", color: "#f59e0b" }}>
          Phase 4
        </span>
      </div>

      {/* ── Section 1: Scene Stats ─────────────────────────────── */}
      <div className="ai-section">
        <h4 className="ai-section-title">
          <IconStats /> Scene Statistics
        </h4>
        <button className="ai-action-btn" onClick={handleGetStats} disabled={busy}>
          Analyze Scene
        </button>
        {stats && (
          <div className="ai-result-card" style={{ marginTop: 8 }}>
            <table className="optimize-stats-table">
              <tbody>
                <tr><td>Meshes</td><td>{stats.meshCount}</td></tr>
                <tr><td>Triangles</td><td>{formatNum(stats.triangles)}</td></tr>
                <tr><td>Vertices</td><td>{formatNum(stats.vertices)}</td></tr>
                <tr><td>Draw Calls</td><td>{stats.drawCalls}</td></tr>
                <tr><td>Materials</td><td>{stats.uniqueMaterials}</td></tr>
                <tr><td>Textures</td><td>{stats.uniqueTextures}</td></tr>
                <tr><td>Geometries</td><td>{stats.uniqueGeometries}</td></tr>
                <tr><td>Lights</td><td>{stats.lights}</td></tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Section 2: Performance Budget ──────────────────────── */}
      <div className="ai-section">
        <h4 className="ai-section-title">
          <IconBudget /> Performance Budget
        </h4>
        <button className="ai-action-btn" onClick={handleCheckBudget} disabled={busy}>
          Check Budget
        </button>
        {budget && (
          <div className="ai-result-card" style={{ marginTop: 8 }}>
            <div className="optimize-score" style={{
              fontSize: "1.5rem",
              fontWeight: 700,
              color: budget.score >= 80 ? "#22c55e" : budget.score >= 50 ? "#f59e0b" : "#ef4444",
              marginBottom: 8,
            }}>
              Score: {budget.score}%
            </div>
            {budget.details.map((d, i) => (
              <div key={i} className="optimize-budget-row">
                <span className={`optimize-dot ${d.ok ? "dot-ok" : "dot-warn"}`} />
                <span className="optimize-cat">{d.category}</span>
                <span className="optimize-val">
                  {formatNum(d.value)} / {formatNum(d.target)}
                </span>
              </div>
            ))}
          </div>
        )}
        {recommendations && recommendations.length > 0 && (
          <div className="ai-result-card" style={{ marginTop: 8 }}>
            <h5 style={{ margin: "0 0 6px", fontSize: "0.85rem", color: "#f59e0b" }}>Recommendations</h5>
            <ul className="optimize-recs">
              {recommendations.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* ── Section 3: Optimize ────────────────────────────────── */}
      <div className="ai-section">
        <h4 className="ai-section-title">
          <IconOptimize /> Optimization Actions
        </h4>
        <div className="ai-actions-row">
          <button className="ai-action-btn" onClick={handleFindDuplicates} disabled={busy}>
            Find Duplicates
          </button>
          <button className="ai-action-btn" onClick={handleMergeMaterials} disabled={busy}>
            Merge Materials
          </button>
          <button className="ai-action-btn" onClick={handleStripMetadata} disabled={busy}>
            Strip Metadata
          </button>
        </div>
        {dupGeoms && dupGeoms.length > 0 && (
          <div className="ai-result-card" style={{ marginTop: 8 }}>
            <h5 style={{ margin: "0 0 4px", fontSize: "0.8rem" }}>Duplicate Geometries ({dupGeoms.length} group{dupGeoms.length !== 1 ? "s" : ""})</h5>
            {dupGeoms.slice(0, 5).map((g, i) => (
              <div key={i} className="optimize-dup-item">
                {g.meshes.length} meshes share same geometry: {g.meshes.slice(0, 3).map(m => `"${m.name || "unnamed"}"`).join(", ")}
                {g.meshes.length > 3 ? ` +${g.meshes.length - 3} more` : ""}
              </div>
            ))}
          </div>
        )}
        {dupMats && dupMats.length > 0 && (
          <div className="ai-result-card" style={{ marginTop: 8 }}>
            <h5 style={{ margin: "0 0 4px", fontSize: "0.8rem" }}>Duplicate Materials ({dupMats.length} group{dupMats.length !== 1 ? "s" : ""})</h5>
            {dupMats.slice(0, 5).map((g, i) => (
              <div key={i} className="optimize-dup-item">
                {g.materials.length} identical materials across {g.meshes.length} mesh(es)
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Section 4: Export ──────────────────────────────────── */}
      <div className="ai-section">
        <h4 className="ai-section-title">
          <IconExport /> Export
        </h4>

        {/* Preset selector */}
        <div className="optimize-preset-row">
          <label className="optimize-label">Quality Preset:</label>
          <select
            className="optimize-select"
            value={exportPreset}
            onChange={(e) => setExportPreset(e.target.value)}
          >
            {Object.entries(EXPORT_PRESETS).map(([key, preset]) => (
              <option key={key} value={key}>{preset.label}</option>
            ))}
          </select>
        </div>
        <div className="optimize-preset-desc">
          {EXPORT_PRESETS[exportPreset]?.description}
        </div>

        <div className="ai-actions-row" style={{ marginTop: 8 }}>
          <button className="ai-action-btn" onClick={handleEstimateSize} disabled={busy}>
            Estimate Size
          </button>
          <button
            className="ai-action-btn optimize-export-btn"
            onClick={handleExport}
            disabled={busy}
          >
            {busy ? "Exporting…" : "Export GLB"}
          </button>
        </div>

        {exportEstimate && (
          <div className="ai-result-card" style={{ marginTop: 8 }}>
            <div className="optimize-export-summary">
              <span>Total: <strong>{formatBytes(exportEstimate.totalBytes)}</strong></span>
              <span>Geometry: {formatBytes(exportEstimate.geometryBytes)}</span>
              <span>Textures: {formatBytes(exportEstimate.textureBytes)}</span>
              <span>{exportEstimate.meshCount} mesh(es)</span>
            </div>
            {exportEstimate.breakdown.length > 0 && exportEstimate.breakdown.length <= 10 && (
              <details className="optimize-breakdown">
                <summary>Breakdown per mesh</summary>
                {exportEstimate.breakdown.map((b, i) => (
                  <div key={i} className="optimize-dup-item">
                    "{b.name}" — geo: {formatBytes(b.geometryBytes)}, tex: {formatBytes(b.textureBytes)}
                  </div>
                ))}
              </details>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
