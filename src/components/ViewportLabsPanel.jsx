// src/components/ViewportLabsPanel.jsx
// Lightweight viewport overlay tools: reference overlay and echo trails
import React, { useEffect, useState } from "react";

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

export default function ViewportLabsPanel({
  reference,
  onReferenceToggle,
  onReferenceCapture,
  onReferenceImport,
  onReferenceClear,
  onReferenceOpacityChange,
  onReferenceWipeChange,
  echo,
  onEchoToggle,
  onEchoCountChange,
  onEchoOpacityChange,
  onEchoColorChange,
  onEchoClear,
}) {
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      return localStorage.getItem("objekta_viewport_labs_collapsed") === "true";
    } catch (e) {
      return false;
    }
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem("objekta_viewport_labs_collapsed", String(collapsed));
    } catch (e) {}
  }, [collapsed]);

  const referenceEnabled = !!reference?.enabled && !!reference?.image;
  const opacity = clamp(Number(reference?.opacity ?? 0.45), 0, 1);
  const wipe = clamp(Number(reference?.wipe ?? 100), 0, 100);
  const clip = `inset(0 ${100 - wipe}% 0 0)`;

  return (
    <div className="viewport-labs">
      {referenceEnabled && (
        <div className="reference-overlay" aria-hidden="true">
          <img
            className="reference-overlay__image"
            src={reference.image}
            alt=""
            style={{ opacity, clipPath: clip }}
          />
        </div>
      )}

      <div className={`viewport-labs-panel ${collapsed ? "is-collapsed" : ""}`}>
        <div className="viewport-labs-panel__header">
          <div className="viewport-labs-panel__title">VIEWPORT LABS</div>
          <button
            className="studio-btn icon-btn"
            type="button"
            onClick={() => setCollapsed((v) => !v)}
            aria-label={collapsed ? "Expand viewport labs" : "Collapse viewport labs"}
            title={collapsed ? "Expand" : "Collapse"}
          >
            {collapsed ? "+" : "-"}
          </button>
        </div>

        {!collapsed && (
          <div className="viewport-labs-panel__body">
            <div className="labs-section">
              <div className="labs-section__title">Reference Overlay</div>
              <div className="labs-row">
                <label className="labs-toggle">
                  <input
                    type="checkbox"
                    checked={!!reference?.enabled}
                    onChange={(e) => onReferenceToggle?.(e.target.checked)}
                    aria-label="Toggle reference overlay"
                  />
                  Show
                </label>
                <button className="studio-btn" type="button" onClick={() => onReferenceCapture?.()}>
                  Capture
                </button>
                <label className="studio-btn" title="Import reference image">
                  Import
                  <input
                    className="sr-only"
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) onReferenceImport?.(file);
                      e.target.value = "";
                    }}
                    aria-label="Import reference image"
                  />
                </label>
                <button className="studio-btn" type="button" onClick={() => onReferenceClear?.()} disabled={!reference?.image}>
                  Clear
                </button>
              </div>
              <div className="labs-row labs-row--slider">
                <label>Opacity</label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={opacity}
                  onChange={(e) => onReferenceOpacityChange?.(parseFloat(e.target.value))}
                  aria-label="Reference opacity"
                />
              </div>
              <div className="labs-row labs-row--slider">
                <label>Wipe</label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="1"
                  value={wipe}
                  onChange={(e) => onReferenceWipeChange?.(parseFloat(e.target.value))}
                  aria-label="Reference wipe"
                />
              </div>
              <div className="viewport-labs-panel__meta">Alt+Shift+R capture, Alt+Shift+O toggle</div>
            </div>

            <div className="labs-section">
              <div className="labs-section__title">Echo Trails</div>
              <div className="labs-row">
                <label className="labs-toggle">
                  <input
                    type="checkbox"
                    checked={!!echo?.enabled}
                    onChange={(e) => onEchoToggle?.(e.target.checked)}
                    aria-label="Toggle echo trails"
                  />
                  Enable
                </label>
                <button className="studio-btn" type="button" onClick={() => onEchoClear?.()} disabled={!echo?.enabled}>
                  Clear
                </button>
              </div>
              <div className="labs-row labs-row--slider">
                <label>Count</label>
                <input
                  type="range"
                  min="1"
                  max="20"
                  step="1"
                  value={clamp(Number(echo?.count ?? 8), 1, 20)}
                  onChange={(e) => onEchoCountChange?.(parseInt(e.target.value, 10))}
                  aria-label="Echo count"
                />
              </div>
              <div className="labs-row labs-row--slider">
                <label>Opacity</label>
                <input
                  type="range"
                  min="0.05"
                  max="1"
                  step="0.05"
                  value={clamp(Number(echo?.opacity ?? 0.35), 0.05, 1)}
                  onChange={(e) => onEchoOpacityChange?.(parseFloat(e.target.value))}
                  aria-label="Echo opacity"
                />
              </div>
              <div className="labs-row labs-row--color">
                <label>Color</label>
                <input
                  type="color"
                  value={typeof echo?.color === "string" ? echo.color : "#7f5af0"}
                  onChange={(e) => onEchoColorChange?.(e.target.value)}
                  aria-label="Echo color"
                />
              </div>
              <div className="viewport-labs-panel__meta">Alt+Shift+E toggle</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
