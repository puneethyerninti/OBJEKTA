import React, { useCallback, useEffect, useRef, useState } from "react";
import "../styles/SculptToolbar.css";

/**
 * SculptToolbar — Floating sculpt-mode toolbox.
 *
 * Responsibilities:
 *   • Mode / radius / strength / symmetry UI
 *   • Start / stop sculpting via workspace API
 *   • Draggable header
 *   • Keyboard shortcuts
 *
 * Pointer events for actual sculpting are handled by Workspace.jsx — this
 * component does NOT attach its own pointer listeners to the canvas.
 */

const MODES = [
  { key: "inflate",  icon: "↑", label: "Inflate" },
  { key: "deflate",  icon: "↓", label: "Deflate" },
  { key: "smooth",   icon: "≈", label: "Smooth" },
  { key: "flatten",  icon: "─", label: "Flatten" },
  { key: "pinch",    icon: "◇", label: "Pinch" },
  { key: "grab",     icon: "✋", label: "Grab" },
  { key: "clay",     icon: "▧", label: "Clay" },
  { key: "crease",   icon: "⌄", label: "Crease" },
];

export default function SculptToolbar({ workspaceRef }) {
  const [active, setActive] = useState(false);
  const [mode, setMode] = useState("inflate");
  const [radius, setRadius] = useState(0.25);
  const [strength, setStrength] = useState(0.6);
  const [symmetry, setSymmetry] = useState({ x: false, y: false, z: false });

  const toolbarRef = useRef(null);
  const draggingRef = useRef(null);
  const posRef = useRef(null);
  const [pos, setPos] = useState(null); // { x, y } or null for default

  // ── Workspace API helper ──
  const getApi = useCallback(() => {
    try {
      if (workspaceRef?.current) return workspaceRef.current;
      if (typeof window !== "undefined" && window.__OBJEKTA_WORKSPACE) return window.__OBJEKTA_WORKSPACE;
    } catch (_) {}
    return null;
  }, [workspaceRef]);

  const callApi = useCallback((name, ...args) => {
    try {
      const api = getApi();
      if (api && typeof api[name] === "function") return api[name](...args);
    } catch (_) {}
  }, [getApi]);

  // ── Sync settings to workspace ──
  useEffect(() => { callApi("setSculptRadius", radius); }, [radius, callApi]);
  useEffect(() => { callApi("setSculptStrength", strength); }, [strength, callApi]);
  useEffect(() => { callApi("setSculptMode", mode); }, [mode, callApi]);
  useEffect(() => { callApi("setSculptSymmetry", symmetry); }, [symmetry, callApi]);

  // ── Start / stop sculpting ──
  const toggleActive = useCallback(() => {
    if (!active) {
      callApi("startSculpting");
      callApi("setControlsEnabled", false);
      setActive(true);
    } else {
      callApi("stopSculpting");
      callApi("setControlsEnabled", true);
      setActive(false);
    }
  }, [active, callApi]);

  const undo = () => callApi("undo");
  const redo = () => callApi("redo");

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      try {
        const api = workspaceRef?.current || window.__OBJEKTA_WORKSPACE;
        if (api) {
          api.stopSculpting?.();
          api.setControlsEnabled?.(true);
        }
      } catch (_) {}
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Keyboard shortcuts ──
  useEffect(() => {
    const onKey = (e) => {
      const tag = e.target?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select" || e.target?.isContentEditable) return;

      if (e.key === "b" || e.key === "B") { toggleActive(); return; }
      const idx = parseInt(e.key, 10);
      if (!Number.isNaN(idx) && idx >= 1 && idx <= MODES.length) { setMode(MODES[idx - 1].key); return; }
      if (e.key === "+" || e.key === "=") { setRadius((r) => Math.min(5, +(r * 1.15).toFixed(3))); return; }
      if (e.key === "-") { setRadius((r) => Math.max(0.01, +(r / 1.15).toFixed(3))); return; }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggleActive]);

  // ── Drag header ──
  useEffect(() => {
    const header = toolbarRef.current?.querySelector(".sculpt-toolbar__header");
    if (!header) return;

    const onDown = (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      const rect = toolbarRef.current.getBoundingClientRect();
      draggingRef.current = { ox: e.clientX - rect.left, oy: e.clientY - rect.top };
      header.setPointerCapture?.(e.pointerId);
      toolbarRef.current.classList.add("dragging");

      const onMove = (ev) => {
        if (!draggingRef.current) return;
        const x = ev.clientX - draggingRef.current.ox;
        const y = ev.clientY - draggingRef.current.oy;
        const w = toolbarRef.current.offsetWidth || 260;
        const h = toolbarRef.current.offsetHeight || 200;
        const cx = Math.min(Math.max(4, x), window.innerWidth - w - 4);
        const cy = Math.min(Math.max(4, y), window.innerHeight - h - 4);
        posRef.current = { x: cx, y: cy };
        setPos({ x: cx, y: cy });
      };
      const onUp = (ev) => {
        draggingRef.current = null;
        toolbarRef.current?.classList.remove("dragging");
        header.releasePointerCapture?.(ev.pointerId);
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    };

    header.addEventListener("pointerdown", onDown);
    return () => header.removeEventListener("pointerdown", onDown);
  }, []);

  // Double-click header resets position
  useEffect(() => {
    const header = toolbarRef.current?.querySelector(".sculpt-toolbar__header");
    if (!header) return;
    const onDbl = () => { setPos(null); posRef.current = null; };
    header.addEventListener("dblclick", onDbl);
    return () => header.removeEventListener("dblclick", onDbl);
  }, []);

  const style = pos ? { left: `${pos.x}px`, top: `${pos.y}px`, right: "auto" } : {};

  return (
    <div ref={toolbarRef} className="sculpt-toolbar" style={style} role="toolbar" aria-label="Sculpt toolbar">
      {/* Header */}
      <div className="sculpt-toolbar__header">
        <div className="sculpt-toolbar__title">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M7 9h10M7 15h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
          Sculpt
        </div>
        <div className="sculpt-toolbar__actions">
          <button className="sculpt-toolbar__btn" onClick={undo} aria-label="Undo">↩</button>
          <button className="sculpt-toolbar__btn" onClick={redo} aria-label="Redo">↪</button>
        </div>
      </div>

      {/* Toggle */}
      <button
        className={`sculpt-toolbar__toggle${active ? " sculpt-toolbar__toggle--active" : ""}`}
        onClick={toggleActive}
        aria-pressed={active}
      >
        {active ? "■  Stop Sculpting" : "▶  Start Sculpting"}
      </button>

      {/* Modes */}
      <div className="sculpt-toolbar__label">Brush (1–{MODES.length})</div>
      <div className="sculpt-toolbar__modes">
        {MODES.map((m) => (
          <button
            key={m.key}
            className={`sculpt-toolbar__mode-btn${mode === m.key ? " sculpt-toolbar__mode-btn--active" : ""}`}
            onClick={() => setMode(m.key)}
            aria-pressed={mode === m.key}
            title={m.label}
          >
            <span style={{ fontSize: 16 }}>{m.icon}</span>
            {m.label}
          </button>
        ))}
      </div>

      {/* Radius */}
      <div className="sculpt-toolbar__slider-group">
        <div className="sculpt-toolbar__slider-header">
          <span className="sculpt-toolbar__label">Radius</span>
          <span className="sculpt-toolbar__slider-value">{radius.toFixed(2)}</span>
        </div>
        <input
          className="sculpt-toolbar__slider"
          type="range" min="0.01" max="5" step="0.01"
          value={radius}
          onChange={(e) => setRadius(parseFloat(e.target.value))}
          aria-label="Sculpt radius"
        />
      </div>

      {/* Strength */}
      <div className="sculpt-toolbar__slider-group">
        <div className="sculpt-toolbar__slider-header">
          <span className="sculpt-toolbar__label">Strength</span>
          <span className="sculpt-toolbar__slider-value">{strength.toFixed(2)}</span>
        </div>
        <input
          className="sculpt-toolbar__slider"
          type="range" min="0.01" max="2" step="0.01"
          value={strength}
          onChange={(e) => setStrength(parseFloat(e.target.value))}
          aria-label="Sculpt strength"
        />
      </div>

      {/* Symmetry */}
      <div className="sculpt-toolbar__label">Symmetry</div>
      <div className="sculpt-toolbar__symmetry">
        {["x", "y", "z"].map((axis) => (
          <label key={axis}>
            <input
              type="checkbox"
              checked={symmetry[axis]}
              onChange={() => setSymmetry((s) => ({ ...s, [axis]: !s[axis] }))}
            />
            {axis.toUpperCase()}
          </label>
        ))}
      </div>

      {/* Footer */}
      <div className="sculpt-toolbar__footer">
        <span className="sculpt-toolbar__shortcuts">B · 1-{MODES.length} · +/−</span>
        <button className="sculpt-toolbar__btn" onClick={() => { setPos(null); posRef.current = null; }} aria-label="Reset position">
          Reset
        </button>
      </div>
    </div>
  );
}
