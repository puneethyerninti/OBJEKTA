// src/components/PostFXPanel.jsx
// ---------------------------------------------------------------------------
// Phase 8 — Post-Processing & Environment Controls Panel.
// Sub-tabs: "Effects" and "Environment".
// ---------------------------------------------------------------------------

import React, { useState, useEffect, useCallback } from "react";
import * as PostFXManager from "../engine/PostFXManager";
import * as EnvironmentManager from "../engine/EnvironmentManager";
import "../styles/PostFXPanel.css";

/* ═══════════════════════════════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════════════════════════ */

function Toggle({ value, onChange, label }) {
  return (
    <div className="pfx-toggle-row">
      <span className="pfx-toggle-label">{label}</span>
      <button
        className={`pfx-toggle ${value ? "pfx-toggle--on" : ""}`}
        onClick={() => onChange(!value)}
        aria-pressed={value}
        aria-label={`Toggle ${label}`}
      />
    </div>
  );
}

function Slider({ label, value, min, max, step, onChange, format }) {
  const display = format ? format(value) : typeof value === "number" ? value.toFixed(2) : value;
  return (
    <div className="pfx-slider-row">
      <span className="pfx-slider-label">{label}</span>
      <input
        className="pfx-slider"
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
      />
      <span className="pfx-slider-value">{display}</span>
    </div>
  );
}

function ColorRow({ label, value, onChange }) {
  return (
    <div className="pfx-color-row">
      <span className="pfx-slider-label">{label}</span>
      <div style={{ position: "relative", display: "inline-block" }}>
        <div
          className="pfx-color-swatch"
          style={{ backgroundColor: value }}
        />
        <input
          className="pfx-color-input"
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
      <span className="pfx-slider-value">{value}</span>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   EFFECTS TAB
   ═══════════════════════════════════════════════════════════════════════ */

function EffectsTab({ config, pushToast }) {
  /* ── Preset selector ─────────────────────────────────────────── */
  const handlePreset = useCallback((presetId) => {
    PostFXManager.applyPreset(presetId);
    pushToast?.(`Applied "${presetId}" post-FX preset`);
  }, [pushToast]);

  return (
    <div className="pfx-section">
      {/* Presets */}
      <div className="pfx-section-header">
        <span className="pfx-section-title">Presets</span>
        <button className="pfx-reset-btn" onClick={() => { PostFXManager.resetAll(); pushToast?.("Reset all effects"); }}>
          Reset All
        </button>
      </div>
      <div className="pfx-preset-grid">
        {PostFXManager.POSTFX_PRESETS.map((p) => (
          <button
            key={p.id}
            className="pfx-preset-card"
            onClick={() => handlePreset(p.id)}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Bloom */}
      <EffectSection title="Bloom" effectKey="bloom" config={config.bloom}>
        <Slider label="Strength" value={config.bloom.strength} min={0} max={3} step={0.05} onChange={(v) => PostFXManager.updateEffect("bloom", { strength: v })} />
        <Slider label="Radius" value={config.bloom.radius} min={0} max={1} step={0.05} onChange={(v) => PostFXManager.updateEffect("bloom", { radius: v })} />
        <Slider label="Threshold" value={config.bloom.threshold} min={0} max={1} step={0.01} onChange={(v) => PostFXManager.updateEffect("bloom", { threshold: v })} />
      </EffectSection>

      {/* SSAO */}
      <EffectSection title="SSAO" effectKey="ssao" config={config.ssao}>
        <Slider label="Radius" value={config.ssao.radius} min={0.1} max={2} step={0.05} onChange={(v) => PostFXManager.updateEffect("ssao", { radius: v })} />
        <Slider label="Intensity" value={config.ssao.intensity} min={0} max={3} step={0.1} onChange={(v) => PostFXManager.updateEffect("ssao", { intensity: v })} />
        <Slider label="Samples" value={config.ssao.samples} min={4} max={64} step={4} format={(v) => String(Math.round(v))} onChange={(v) => PostFXManager.updateEffect("ssao", { samples: Math.round(v) })} />
      </EffectSection>

      {/* DOF */}
      <EffectSection title="Depth of Field" effectKey="dof" config={config.dof}>
        <Slider label="Focus Dist" value={config.dof.focusDistance} min={0.5} max={50} step={0.5} onChange={(v) => PostFXManager.updateEffect("dof", { focusDistance: v })} />
        <Slider label="Focal Length" value={config.dof.focalLength} min={10} max={200} step={5} format={(v) => `${Math.round(v)}mm`} onChange={(v) => PostFXManager.updateEffect("dof", { focalLength: v })} />
        <Slider label="Bokeh Scale" value={config.dof.bokehScale} min={0} max={10} step={0.5} onChange={(v) => PostFXManager.updateEffect("dof", { bokehScale: v })} />
      </EffectSection>

      {/* Outline */}
      <EffectSection title="Outline" effectKey="outline" config={config.outline}>
        <ColorRow label="Color" value={config.outline.color} onChange={(v) => PostFXManager.updateEffect("outline", { color: v })} />
        <Slider label="Thickness" value={config.outline.thickness} min={0.5} max={5} step={0.5} onChange={(v) => PostFXManager.updateEffect("outline", { thickness: v })} />
        <Slider label="Strength" value={config.outline.strength} min={0.5} max={10} step={0.5} onChange={(v) => PostFXManager.updateEffect("outline", { strength: v })} />
        <Toggle label="Pulse" value={config.outline.pulse} onChange={(v) => PostFXManager.updateEffect("outline", { pulse: v })} />
      </EffectSection>

      {/* Chromatic Aberration */}
      <EffectSection title="Chromatic Aberration" effectKey="chromaticAberration" config={config.chromaticAberration}>
        <Slider label="Offset" value={config.chromaticAberration.offset} min={0} max={0.02} step={0.001} format={(v) => v.toFixed(3)} onChange={(v) => PostFXManager.updateEffect("chromaticAberration", { offset: v })} />
        <Toggle label="Radial" value={config.chromaticAberration.radial} onChange={(v) => PostFXManager.updateEffect("chromaticAberration", { radial: v })} />
      </EffectSection>

      {/* Tone Mapping */}
      <div className="pfx-section">
        <div className="pfx-section-header">
          <span className="pfx-section-title">Tone Mapping</span>
          <button
            className={`pfx-toggle ${config.toneMapping.enabled ? "pfx-toggle--on" : ""}`}
            onClick={() => PostFXManager.setEffectEnabled("toneMapping", !config.toneMapping.enabled)}
            aria-pressed={config.toneMapping.enabled}
            aria-label="Toggle Tone Mapping"
          />
        </div>
        {config.toneMapping.enabled && (
          <>
            <div className="pfx-slider-row">
              <span className="pfx-slider-label">Mode</span>
              <select
                className="pfx-select"
                value={config.toneMapping.mode}
                onChange={(e) => PostFXManager.updateEffect("toneMapping", { mode: e.target.value })}
              >
                {PostFXManager.TONEMAPPING_MODES.map((m) => (
                  <option key={m.id} value={m.id}>{m.label}</option>
                ))}
              </select>
            </div>
            <Slider label="Exposure" value={config.toneMapping.exposure} min={0.1} max={3} step={0.05} onChange={(v) => PostFXManager.updateEffect("toneMapping", { exposure: v })} />
          </>
        )}
      </div>

      {/* Color Grading */}
      <div className="pfx-section">
        <div className="pfx-section-header">
          <span className="pfx-section-title">Color Grading</span>
          <button
            className={`pfx-toggle ${config.colorGrading.enabled ? "pfx-toggle--on" : ""}`}
            onClick={() => PostFXManager.setEffectEnabled("colorGrading", !config.colorGrading.enabled)}
            aria-pressed={config.colorGrading.enabled}
            aria-label="Toggle Color Grading"
          />
        </div>
        {config.colorGrading.enabled && (
          <>
            <div className="pfx-slider-row">
              <span className="pfx-slider-label">Preset</span>
              <select
                className="pfx-select"
                value={config.colorGrading.preset}
                onChange={(e) => PostFXManager.applyColorGrading(e.target.value)}
              >
                {PostFXManager.COLOR_GRADING_PRESETS.map((p) => (
                  <option key={p.id} value={p.id}>{p.label}</option>
                ))}
              </select>
            </div>
            <Slider label="Brightness" value={config.colorGrading.brightness} min={-0.5} max={0.5} step={0.01} onChange={(v) => PostFXManager.updateEffect("colorGrading", { brightness: v })} />
            <Slider label="Contrast" value={config.colorGrading.contrast} min={-0.5} max={0.5} step={0.01} onChange={(v) => PostFXManager.updateEffect("colorGrading", { contrast: v })} />
            <Slider label="Saturation" value={config.colorGrading.saturation} min={-1} max={1} step={0.05} onChange={(v) => PostFXManager.updateEffect("colorGrading", { saturation: v })} />
            <Slider label="Hue Shift" value={config.colorGrading.hueShift} min={-180} max={180} step={5} format={(v) => `${Math.round(v)}°`} onChange={(v) => PostFXManager.updateEffect("colorGrading", { hueShift: v })} />
          </>
        )}
      </div>

      {/* Film Grain */}
      <EffectSection title="Film Grain" effectKey="filmGrain" config={config.filmGrain}>
        <Slider label="Intensity" value={config.filmGrain.intensity} min={0} max={1} step={0.05} onChange={(v) => PostFXManager.updateEffect("filmGrain", { intensity: v })} />
        <Toggle label="Animated" value={config.filmGrain.animated} onChange={(v) => PostFXManager.updateEffect("filmGrain", { animated: v })} />
      </EffectSection>

      {/* Vignette */}
      <EffectSection title="Vignette" effectKey="vignette" config={config.vignette}>
        <Slider label="Darkness" value={config.vignette.darkness} min={0} max={1} step={0.05} onChange={(v) => PostFXManager.updateEffect("vignette", { darkness: v })} />
        <Slider label="Offset" value={config.vignette.offset} min={0} max={1} step={0.05} onChange={(v) => PostFXManager.updateEffect("vignette", { offset: v })} />
      </EffectSection>
    </div>
  );
}

/* ── Reusable effect section with title & toggle ───────────────── */
function EffectSection({ title, effectKey, config, children }) {
  return (
    <div className="pfx-section">
      <div className="pfx-section-header">
        <span className="pfx-section-title">{title}</span>
        <button
          className={`pfx-toggle ${config.enabled ? "pfx-toggle--on" : ""}`}
          onClick={() => PostFXManager.setEffectEnabled(effectKey, !config.enabled)}
          aria-pressed={config.enabled}
          aria-label={`Toggle ${title}`}
        />
      </div>
      {config.enabled && children}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   ENVIRONMENT TAB
   ═══════════════════════════════════════════════════════════════════════ */

function EnvironmentTab({ envState, pushToast }) {
  const handlePreset = useCallback((presetId) => {
    EnvironmentManager.applyPreset(presetId);
    pushToast?.(`Applied "${presetId}" environment`);
  }, [pushToast]);

  return (
    <div className="pfx-section">
      {/* Presets */}
      <div className="pfx-section-header">
        <span className="pfx-section-title">Environment Preset</span>
        <button className="pfx-reset-btn" onClick={() => { EnvironmentManager.resetAll(); pushToast?.("Reset environment"); }}>
          Reset
        </button>
      </div>
      <div className="pfx-preset-grid">
        {EnvironmentManager.ENV_PRESETS.map((p) => (
          <button
            key={p.id}
            className={`pfx-preset-card ${envState.preset === p.id ? "pfx-preset-card--active" : ""}`}
            onClick={() => handlePreset(p.id)}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Background & Ambient */}
      <div className="pfx-section">
        <span className="pfx-section-title">Lighting & Background</span>
        <ColorRow label="Background" value={envState.backgroundColor} onChange={(v) => EnvironmentManager.setBackgroundColor(v)} />
        <ColorRow label="Ambient" value={envState.ambientColor} onChange={(v) => EnvironmentManager.setAmbientColor(v)} />
        <Slider label="Ambient Int." value={envState.ambientIntensity} min={0} max={2} step={0.05} onChange={(v) => EnvironmentManager.setAmbientIntensity(v)} />
        <Slider label="Env Intensity" value={envState.envMapIntensity} min={0} max={3} step={0.05} onChange={(v) => EnvironmentManager.setEnvMapIntensity(v)} />
        <Slider label="Env Rotation" value={envState.envRotation} min={0} max={360} step={5} format={(v) => `${Math.round(v)}°`} onChange={(v) => EnvironmentManager.setEnvRotation(v)} />
      </div>

      {/* Fog */}
      <div className="pfx-section">
        <div className="pfx-section-header">
          <span className="pfx-section-title">Fog</span>
          <button
            className={`pfx-toggle ${envState.fog.enabled ? "pfx-toggle--on" : ""}`}
            onClick={() => EnvironmentManager.setFogEnabled(!envState.fog.enabled)}
            aria-pressed={envState.fog.enabled}
            aria-label="Toggle Fog"
          />
        </div>
        {envState.fog.enabled && (
          <>
            <div className="pfx-slider-row">
              <span className="pfx-slider-label">Type</span>
              <select
                className="pfx-select"
                value={envState.fog.type}
                onChange={(e) => EnvironmentManager.setFogType(e.target.value)}
              >
                {EnvironmentManager.FOG_TYPES.map((f) => (
                  <option key={f.id} value={f.id}>{f.label}</option>
                ))}
              </select>
            </div>
            <ColorRow label="Color" value={envState.fog.color} onChange={(v) => EnvironmentManager.setFogColor(v)} />
            {envState.fog.type === "linear" && (
              <>
                <Slider label="Near" value={envState.fog.near} min={0} max={100} step={1} format={(v) => `${Math.round(v)}m`} onChange={(v) => EnvironmentManager.setFogNear(v)} />
                <Slider label="Far" value={envState.fog.far} min={5} max={500} step={5} format={(v) => `${Math.round(v)}m`} onChange={(v) => EnvironmentManager.setFogFar(v)} />
              </>
            )}
            {envState.fog.type === "exponential" && (
              <Slider label="Density" value={envState.fog.density} min={0.001} max={0.2} step={0.001} format={(v) => v.toFixed(3)} onChange={(v) => EnvironmentManager.setFogDensity(v)} />
            )}
          </>
        )}
      </div>

      {/* Ground Plane */}
      <div className="pfx-section">
        <span className="pfx-section-title">Ground Plane</span>
        <Toggle label="Show Ground" value={envState.groundPlane} onChange={(v) => EnvironmentManager.setGroundPlane(v)} />
        {envState.groundPlane && (
          <ColorRow label="Ground Color" value={envState.groundColor} onChange={(v) => EnvironmentManager.setGroundColor(v)} />
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN PANEL
   ═══════════════════════════════════════════════════════════════════════ */

export default function PostFXPanel({ pushToast }) {
  const [subTab, setSubTab] = useState("effects");
  const [fxConfig, setFxConfig] = useState(() => PostFXManager.getConfig());
  const [envState, setEnvState] = useState(() => EnvironmentManager.getState());

  useEffect(() => {
    const unsub1 = PostFXManager.subscribe((cfg) => setFxConfig(cfg));
    const unsub2 = EnvironmentManager.subscribe((st) => setEnvState(st));
    return () => { unsub1(); unsub2(); };
  }, []);

  return (
    <div className="postfx-panel">
      {/* Sub-tab bar */}
      <div className="pfx-tab-bar" role="tablist">
        <button
          className={`pfx-tab ${subTab === "effects" ? "pfx-tab--active" : ""}`}
          onClick={() => setSubTab("effects")}
          role="tab"
          aria-selected={subTab === "effects"}
        >
          🎬 Effects
        </button>
        <button
          className={`pfx-tab ${subTab === "environment" ? "pfx-tab--active" : ""}`}
          onClick={() => setSubTab("environment")}
          role="tab"
          aria-selected={subTab === "environment"}
        >
          🌍 Environment
        </button>
      </div>

      {/* Content */}
      {subTab === "effects" && <EffectsTab config={fxConfig} pushToast={pushToast} />}
      {subTab === "environment" && <EnvironmentTab envState={envState} pushToast={pushToast} />}
    </div>
  );
}
