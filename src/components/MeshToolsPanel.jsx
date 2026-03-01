// src/components/MeshToolsPanel.jsx
// Phase 3 — Mesh Intelligence UI panel
// Provides: mesh analysis, decimation controls, UV hints, LOD generation.

import React, { useState, useCallback } from "react";
import { analyzeMesh, analyzeScene, suggestUVStrategy } from "../engine/MeshAnalyzer";
import { decimateMesh, previewDecimation } from "../engine/MeshDecimator";
import { previewLODTiers, replaceMeshWithLOD } from "../engine/LODGenerator";
import "../styles/AIAssistant.css"; // mesh-tools styles are in the same file

/* ─── small icon helpers (SVG inline to avoid extra deps) ──── */
const IconAnalyze = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
);
const IconDecimate = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>
);
const IconUV = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>
);
const IconLOD = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
);

function formatNum(n) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + "M";
  if (n >= 1000) return (n / 1000).toFixed(1) + "k";
  return String(n);
}

/* ────────────────────────────────────────────────────────────── */
export default function MeshToolsPanel({ workspaceRef, selected, pushToast }) {
  // Analysis state
  const [analysis, setAnalysis] = useState(null);
  const [sceneAnalysis, setSceneAnalysis] = useState(null);

  // Decimation state
  const [decimateRatio, setDecimateRatio] = useState(0.5);
  const [decimatePreview, setDecimatePreview] = useState(null);
  const [decimateResult, setDecimateResult] = useState(null);

  // UV hints state
  const [uvHints, setUvHints] = useState(null);

  // LOD state
  const [lodPreview, setLodPreview] = useState(null);
  const [lodResult, setLodResult] = useState(null);

  // Busy flag
  const [busy, setBusy] = useState(false);

  /* ─────── Selected mesh helper ─────── */
  const getSelectedMesh = useCallback(() => {
    const sel = selected;
    if (!sel) return null;
    let found = null;
    if (sel.isMesh && sel.geometry) return sel;
    sel.traverse?.((n) => { if (!found && n.isMesh && n.geometry) found = n; });
    return found;
  }, [selected]);

  /* ═══════════════════════════════════════════════════════════ *
   *  Section 1: Mesh Analysis                                   *
   * ═══════════════════════════════════════════════════════════ */
  const handleAnalyzeMesh = useCallback(() => {
    const mesh = getSelectedMesh();
    if (!mesh) {
      pushToast?.({ type: "warning", message: "No mesh selected" });
      return;
    }
    const info = analyzeMesh(mesh);
    setAnalysis(info);
    pushToast?.({ type: "info", message: `Analyzed: ${info?.triangles ?? 0} tris, ${info?.vertices ?? 0} verts` });
  }, [getSelectedMesh, pushToast]);

  const handleAnalyzeScene = useCallback(() => {
    const objs = workspaceRef.current?.getSceneObjects?.() ?? [];
    if (objs.length === 0) {
      pushToast?.({ type: "warning", message: "Scene is empty" });
      return;
    }
    const info = analyzeScene(objs);
    setSceneAnalysis(info);
    pushToast?.({ type: "info", message: `Scene: ${info.meshCount} meshes, ${formatNum(info.totalTriangles)} tris` });
  }, [workspaceRef, pushToast]);

  /* ═══════════════════════════════════════════════════════════ *
   *  Section 2: Decimation                                      *
   * ═══════════════════════════════════════════════════════════ */
  const handleDecimatePreview = useCallback(() => {
    const mesh = getSelectedMesh();
    if (!mesh) { pushToast?.({ type: "warning", message: "No mesh selected" }); return; }
    const preview = previewDecimation(mesh.geometry, decimateRatio);
    setDecimatePreview(preview);
  }, [getSelectedMesh, decimateRatio, pushToast]);

  const handleDecimateApply = useCallback(() => {
    const mesh = getSelectedMesh();
    if (!mesh) { pushToast?.({ type: "warning", message: "No mesh selected" }); return; }
    setBusy(true);
    try {
      const result = decimateMesh(mesh, decimateRatio);
      if (result) {
        setDecimateResult(result);
        setDecimatePreview(null);
        setAnalysis(null); // reset analysis after geometry change
        pushToast?.({ type: "success", message: `Decimated: ${formatNum(result.before.tris)} → ${formatNum(result.after.tris)} tris` });
      }
    } catch (e) {
      pushToast?.({ type: "error", message: "Decimation failed: " + e.message });
    } finally {
      setBusy(false);
    }
  }, [getSelectedMesh, decimateRatio, pushToast]);

  /* ═══════════════════════════════════════════════════════════ *
   *  Section 3: UV Hints                                        *
   * ═══════════════════════════════════════════════════════════ */
  const handleUVHints = useCallback(() => {
    const mesh = getSelectedMesh();
    if (!mesh) { pushToast?.({ type: "warning", message: "No mesh selected" }); return; }
    const hints = suggestUVStrategy(mesh);
    setUvHints(hints);
  }, [getSelectedMesh, pushToast]);

  /* ═══════════════════════════════════════════════════════════ *
   *  Section 4: LOD Generation                                  *
   * ═══════════════════════════════════════════════════════════ */
  const handleLODPreview = useCallback(() => {
    const mesh = getSelectedMesh();
    if (!mesh) { pushToast?.({ type: "warning", message: "No mesh selected" }); return; }
    const preview = previewLODTiers(mesh.geometry);
    setLodPreview(preview);
  }, [getSelectedMesh, pushToast]);

  const handleLODApply = useCallback(() => {
    const mesh = getSelectedMesh();
    if (!mesh) { pushToast?.({ type: "warning", message: "No mesh selected" }); return; }
    const parent = mesh.parent || workspaceRef.current?.scene;
    if (!parent) { pushToast?.({ type: "error", message: "Cannot find parent for LOD placement" }); return; }
    setBusy(true);
    try {
      const result = replaceMeshWithLOD(mesh, parent);
      if (result) {
        setLodResult(result.tiers);
        setLodPreview(null);
        setAnalysis(null);
        pushToast?.({ type: "success", message: `LOD created: ${result.tiers.length} levels` });
      }
    } catch (e) {
      pushToast?.({ type: "error", message: "LOD generation failed: " + e.message });
    } finally {
      setBusy(false);
    }
  }, [getSelectedMesh, workspaceRef, pushToast]);

  /* ═══════════════════════════════════════════════════════════ *
   *  Render                                                     *
   * ═══════════════════════════════════════════════════════════ */
  return (
    <div className="mesh-tools-panel">
      {/* ── Section: Mesh Analysis ── */}
      <div className="mesh-section">
        <div className="mesh-section-header">
          <IconAnalyze />
          <span className="mesh-section-title">Mesh Analysis</span>
        </div>
        <div className="mesh-section-desc">Inspect geometry stats, UV quality, and identify issues.</div>
        <div className="mesh-action-row">
          <button className="studio-btn" onClick={handleAnalyzeMesh} disabled={!selected || busy}>
            Analyze Selected
          </button>
          <button className="studio-btn" onClick={handleAnalyzeScene} disabled={busy}>
            Analyze Scene
          </button>
        </div>

        {/* Selected mesh analysis */}
        {analysis && (
          <div style={{ marginTop: 6 }}>
            <div className="mesh-stat"><span>Name</span><span className="mesh-stat-value">{analysis.name}</span></div>
            <div className="mesh-stat"><span>Triangles</span><span className="mesh-stat-value">{formatNum(analysis.triangles)}</span></div>
            <div className="mesh-stat"><span>Vertices</span><span className="mesh-stat-value">{formatNum(analysis.vertices)}</span></div>
            <div className="mesh-stat"><span>Indexed</span><span className="mesh-stat-value">{analysis.indexed ? "Yes" : "No"}</span></div>
            <div className="mesh-stat"><span>UVs</span><span className="mesh-stat-value">{analysis.hasUV ? "Yes" : "No"}</span></div>
            <div className="mesh-stat"><span>Normals</span><span className="mesh-stat-value">{analysis.hasNormals ? "Yes" : "No"}</span></div>
            <div className="mesh-stat"><span>Material</span><span className="mesh-stat-value">{analysis.materialType}</span></div>
            <div className="mesh-stat">
              <span>Bounds</span>
              <span className="mesh-stat-value">
                {analysis.boundingBox.size.x.toFixed(2)} × {analysis.boundingBox.size.y.toFixed(2)} × {analysis.boundingBox.size.z.toFixed(2)}
              </span>
            </div>
            {analysis.uvAnalysis && (
              <>
                <div className="mesh-stat"><span>UV Coverage</span><span className="mesh-stat-value">{analysis.uvAnalysis.coverage}%</span></div>
                <div className="mesh-stat"><span>UV Overlap</span><span className="mesh-stat-value">~{analysis.uvAnalysis.overlapEstimate}%</span></div>
                {analysis.uvAnalysis.outOfBoundsPercent > 0 && (
                  <div className="mesh-stat"><span>UV Out-of-Bounds</span><span className="mesh-stat-value">{analysis.uvAnalysis.outOfBoundsPercent}%</span></div>
                )}
              </>
            )}
          </div>
        )}

        {/* Scene analysis */}
        {sceneAnalysis && (
          <div style={{ marginTop: 6 }}>
            <div className="mesh-stat"><span>Total Meshes</span><span className="mesh-stat-value">{sceneAnalysis.meshCount}</span></div>
            <div className="mesh-stat"><span>Total Triangles</span><span className="mesh-stat-value">{formatNum(sceneAnalysis.totalTriangles)}</span></div>
            <div className="mesh-stat"><span>Total Vertices</span><span className="mesh-stat-value">{formatNum(sceneAnalysis.totalVertices)}</span></div>
            {sceneAnalysis.issues.length > 0 && (
              <div style={{ marginTop: 4 }}>
                {sceneAnalysis.issues.map((issue, i) => (
                  <div
                    key={i}
                    className={`mesh-result-msg ${issue.severity === "error" ? "error" : issue.severity === "warning" ? "warning" : "success"}`}
                  >
                    <strong>{issue.mesh}:</strong> {issue.message}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Section: Decimation ── */}
      <div className="mesh-section">
        <div className="mesh-section-header">
          <IconDecimate />
          <span className="mesh-section-title">Auto Decimation</span>
        </div>
        <div className="mesh-section-desc">Reduce triangle count using vertex-clustering. Lower ratio = fewer tris.</div>
        <div className="mesh-controls">
          <div className="mesh-slider-row">
            <span className="mesh-slider-label">Ratio</span>
            <input
              type="range"
              className="mesh-slider"
              min="0.05"
              max="1"
              step="0.05"
              value={decimateRatio}
              onChange={(e) => { setDecimateRatio(parseFloat(e.target.value)); setDecimatePreview(null); }}
            />
            <span className="mesh-slider-value">{Math.round(decimateRatio * 100)}%</span>
          </div>
          <div className="mesh-action-row">
            <button className="studio-btn" onClick={handleDecimatePreview} disabled={!selected || busy}>Preview</button>
            <button className="launch-btn" onClick={handleDecimateApply} disabled={!selected || busy}>
              {busy ? "Working…" : "Apply"}
            </button>
          </div>
        </div>

        {decimatePreview && (
          <div style={{ marginTop: 6 }}>
            <div className="mesh-stat"><span>Before</span><span className="mesh-stat-value">{formatNum(decimatePreview.originalTris)} tris / {formatNum(decimatePreview.originalVerts)} verts</span></div>
            <div className="mesh-stat"><span>After (est.)</span><span className="mesh-stat-value">{formatNum(decimatePreview.estimatedTris)} tris / {formatNum(decimatePreview.estimatedVerts)} verts</span></div>
          </div>
        )}

        {decimateResult && (
          <div className="mesh-result-msg success">
            Decimated: {formatNum(decimateResult.before.tris)} → {formatNum(decimateResult.after.tris)} tris
            ({Math.round((1 - decimateResult.after.tris / (decimateResult.before.tris || 1)) * 100)}% reduction)
          </div>
        )}
      </div>

      {/* ── Section: UV Hints ── */}
      <div className="mesh-section">
        <div className="mesh-section-header">
          <IconUV />
          <span className="mesh-section-title">Smart UV Hints</span>
        </div>
        <div className="mesh-section-desc">Analyze mesh shape to suggest the best UV unwrap strategy.</div>
        <div className="mesh-action-row">
          <button className="studio-btn" onClick={handleUVHints} disabled={!selected || busy}>
            Get UV Hints
          </button>
        </div>

        {uvHints && (
          <div style={{ marginTop: 6 }}>
            <div className="mesh-stat"><span>Mesh</span><span className="mesh-stat-value">{uvHints.meshName}</span></div>
            <div className="mesh-stat"><span>Shape</span><span className="mesh-stat-value">{uvHints.shapeProfile}</span></div>
            <div className="mesh-stat"><span>Has UVs</span><span className="mesh-stat-value">{uvHints.hasExistingUV ? "Yes" : "No"}</span></div>
            <div className="mesh-stat">
              <span>Size</span>
              <span className="mesh-stat-value">{uvHints.boundingSize.x} × {uvHints.boundingSize.y} × {uvHints.boundingSize.z}</span>
            </div>
            {uvHints.hints.length > 0 ? (
              <div style={{ marginTop: 4 }}>
                {uvHints.hints.map((h, i) => (
                  <div key={i} className={`mesh-result-msg ${h.type === "fix" ? "warning" : "success"}`}>
                    {h.type === "projection" && <><strong>Projection:</strong> {h.method} — {h.reason}</>}
                    {h.type === "fix" && <><strong>Fix:</strong> {h.reason}</>}
                    {h.type === "tip" && <><strong>Tip:</strong> {h.reason}</>}
                  </div>
                ))}
              </div>
            ) : (
              <div className="mesh-result-msg success">UVs look good — no issues detected.</div>
            )}
          </div>
        )}
      </div>

      {/* ── Section: LOD Generation ── */}
      <div className="mesh-section">
        <div className="mesh-section-header">
          <IconLOD />
          <span className="mesh-section-title">LOD Generator</span>
        </div>
        <div className="mesh-section-desc">Auto-generate Level-of-Detail variants for distance-based performance.</div>
        <div className="mesh-action-row">
          <button className="studio-btn" onClick={handleLODPreview} disabled={!selected || busy}>Preview LOD</button>
          <button className="launch-btn" onClick={handleLODApply} disabled={!selected || busy}>
            {busy ? "Working…" : "Generate LOD"}
          </button>
        </div>

        {lodPreview && (
          <div className="mesh-lod-preview">
            {lodPreview.map((tier, i) => (
              <div key={i} className="mesh-lod-card">
                <div className="mesh-lod-card-label">{tier.name}</div>
                <div className="mesh-lod-card-value">{formatNum(tier.estimatedTris)} tris</div>
                <div style={{ fontSize: 9, color: "var(--text-muted)" }}>{tier.distance}m</div>
              </div>
            ))}
          </div>
        )}

        {lodResult && (
          <div style={{ marginTop: 4 }}>
            <div className="mesh-result-msg success">
              LOD created with {lodResult.length} levels
            </div>
            <div className="mesh-lod-preview" style={{ marginTop: 4 }}>
              {lodResult.map((tier, i) => (
                <div key={i} className="mesh-lod-card">
                  <div className="mesh-lod-card-label">{tier.name}</div>
                  <div className="mesh-lod-card-value">{formatNum(tier.triangles)} tris</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
