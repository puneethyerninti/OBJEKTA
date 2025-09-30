// src/components/SculptToolbar.jsx
import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";

/**
 * SculptToolbar (v3)
 * Props:
 *  - workspaceRef: forwardRef to Workspace (optional)
 *  - rendererSelector: CSS selector fallback for renderer DOM element (optional)
 *  - preferLeft: boolean (optional) - if true, prefer left docking when auto-placement
 */
export default function SculptToolbar({ workspaceRef, rendererSelector = null, preferLeft = false }) {
  // sculpt UI state
  const [active, setActive] = useState(false);
  const [mode, setMode] = useState("inflate");
  const [radius, setRadius] = useState(0.25);
  const [strength, setStrength] = useState(0.6);
  const [symmetry, setSymmetry] = useState({ x: false, y: false, z: false });

  // UI layout / persistence state
  const localKeyPos = "objekta_sculpt_toolbar_pos_v3";
  const localKeyPinned = "objekta_sculpt_toolbar_pinned_v3";
  const localKeyCollapsed = "objekta_sculpt_toolbar_collapsed_v3";

  const [userPos, setUserPos] = useState(() => {
    try { const raw = localStorage.getItem(localKeyPos); return raw ? JSON.parse(raw) : null; } catch { return null; }
  });
  const [pinned, setPinned] = useState(() => {
    try { return localStorage.getItem(localKeyPinned) === "1"; } catch { return false; }
  });
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem(localKeyCollapsed) === "1"; } catch { return false; }
  });

  // auto dock style (used when not pinned / no userPos)
  const [dockStyle, setDockStyle] = useState({ left: null, right: "16px", top: "20px", bottom: null });

  // brush overlay state (screen coords) and pixel radius
  const [brushOverlay, setBrushOverlay] = useState({ x: -9999, y: -9999, visible: false, pxRadius: 24 });

  // refs
  const toolbarRef = useRef(null);
  const rendererElemRef = useRef(null);
  const draggingRef = useRef(null);
  const rafRef = useRef(null);
  const pointerDownRef = useRef(false);
  const lastPressureRef = useRef(0);
  const modes = ["inflate", "deflate", "grab", "smooth", "pinch", "flatten"];

  // safe API getter (workspaceRef or global fallback)
  const getApi = () => workspaceRef?.current ?? (typeof window !== "undefined" ? window.__OBJEKTA_WORKSPACE : null);
  const callApi = (name, ...args) => {
    try {
      const api = getApi();
      if (!api) return;
      const fn = api[name];
      if (typeof fn === "function") return fn(...args);
    } catch (e) {}
  };

  // ---------- find renderer element ----------
  useEffect(() => {
    const findRenderer = () => {
      try {
        const api = getApi();
        if (api) {
          const r = api.getRenderer?.(); // global fallback uses this
          if (r && r.domElement) return r.domElement;
        }
      } catch (e) {}
      if (rendererSelector) {
        const q = document.querySelector(rendererSelector);
        if (q) return q;
      }
      const byId = document.querySelector("#obekta-renderer");
      if (byId) return byId;
      const canv = document.querySelector("canvas");
      if (canv) return canv;
      return document.body;
    };

    rendererElemRef.current = findRenderer();
    rafRef.current = requestAnimationFrame(() => adjustDockPosition());
    window.addEventListener("resize", adjustDockPosition);
    window.addEventListener("orientationchange", adjustDockPosition);
    return () => {
      try { cancelAnimationFrame(rafRef.current); } catch (e) {}
      window.removeEventListener("resize", adjustDockPosition);
      window.removeEventListener("orientationchange", adjustDockPosition);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------- auto docking & collision avoidance ----------
  const rectsIntersect = (a, b) => {
    if (!a || !b) return false;
    return !(a.right < b.left || a.left > b.right || a.bottom < b.top || a.top > b.bottom);
  };

  function adjustDockPosition() {
    // don't override a pinned user position
    if (pinned || userPos) return;

    const el = toolbarRef.current;
    const rendererEl = rendererElemRef.current || document.body;
    if (!el || !rendererEl) return;

    const rRect = rendererEl.getBoundingClientRect();
    const tRect = el.getBoundingClientRect();
    const p = document.querySelector(".studio-panel.properties-panel");
    const pRect = p ? p.getBoundingClientRect() : null;
    const margin = 16;

    // mobile narrow -> bottom center
    if (window.innerWidth < 720) {
      setDockStyle({
        left: `${Math.max(8, Math.round((window.innerWidth - tRect.width) / 2))}px`,
        right: null,
        top: null,
        bottom: `${margin}px`,
      });
      return;
    }

    if (preferLeft) {
      setDockStyle({
        left: `${Math.round(rRect.left + margin)}px`,
        right: null,
        top: `${Math.round(rRect.top + margin)}px`,
        bottom: null,
      });
      return;
    }

    // prefer top-right inside renderer
    const proposed = {
      left: Math.round(rRect.right - margin - tRect.width),
      right: Math.round(rRect.right - margin),
      top: Math.round(rRect.top + margin),
      bottom: Math.round(rRect.top + margin + tRect.height),
    };

    if (pRect && rectsIntersect(proposed, pRect)) {
      // collision -> dock left inside renderer
      setDockStyle({
        left: `${Math.round(rRect.left + margin)}px`,
        right: null,
        top: `${Math.round(rRect.top + margin)}px`,
        bottom: null,
      });
      return;
    }

    // else top-right anchored relative to viewport
    const distanceFromRight = Math.round(window.innerWidth - rRect.right + margin);
    setDockStyle({
      left: null,
      right: `${Math.max(12, distanceFromRight)}px`,
      top: `${Math.round(rRect.top + margin)}px`,
      bottom: null,
    });
  }

  // ---------- brush overlay & pressure (attach to renderer) ----------
  useEffect(() => {
    const el = rendererElemRef.current || document.body;
    if (!el) return;
    let mounted = true;

    const onPointerMove = (ev) => {
      if (!mounted) return;
      const rect = el.getBoundingClientRect();
      const cx = ev.clientX;
      const cy = ev.clientY;
      const inside = cx >= rect.left && cx <= rect.right && cy >= rect.top && cy <= rect.bottom;

      // try precise projection if workspace exposes renderer + camera
      try {
        const api = getApi();
        const renderer = api?.getRenderer?.();
        const camera = api?.getCamera?.();
        if (renderer && camera) {
          const ndc = new THREE.Vector3(
            ((cx - rect.left) / rect.width) * 2 - 1,
            -((cy - rect.top) / rect.height) * 2 + 1,
            0.5
          );
          const world = ndc.clone().unproject(camera);
          const camDir = new THREE.Vector3();
          camera.getWorldDirection(camDir);
          const right = new THREE.Vector3().crossVectors(camera.up, camDir).normalize();
          const secWorld = world.clone().add(right.clone().multiplyScalar(radius));
          const p1 = world.clone().project(camera);
          const p2 = secWorld.clone().project(camera);
          const px1 = (p1.x * 0.5 + 0.5) * rect.width + rect.left;
          const py1 = (-p1.y * 0.5 + 0.5) * rect.height + rect.top;
          const px2 = (p2.x * 0.5 + 0.5) * rect.width + rect.left;
          const py2 = (-p2.y * 0.5 + 0.5) * rect.height + rect.top;
          const pxRadius = Math.max(4, Math.round(Math.hypot(px2 - px1, py2 - py1)));
          setBrushOverlay({ x: cx, y: cy, visible: active && inside, pxRadius });
          return;
        }
      } catch (e) { /* fallback below */ }

      // fallback heuristic
      const width = Math.max(200, rect.width || window.innerWidth);
      const pxRadius = Math.max(8, Math.round(radius * 100 * (width / 800)));
      setBrushOverlay({ x: cx, y: cy, visible: active && inside, pxRadius });
    };

    const onPointerDown = (ev) => {
      pointerDownRef.current = true;
      lastPressureRef.current = ev.pressure ?? 0.5;
      // if device provides pressure and workspace supports setSculptStrength, scale strength
      const api = getApi();
      if (typeof ev.pressure === "number" && api?.setSculptStrength) {
        const scaled = Math.max(0.01, strength * (ev.pressure || 1));
        try { api.setSculptStrength(scaled); } catch (e) {}
      }
    };

    const onPointerUp = (ev) => {
      pointerDownRef.current = false;
      lastPressureRef.current = 0;
      // restore strength to UI strength if workspace method exists
      const api = getApi();
      if (api?.setSculptStrength) {
        try { api.setSculptStrength(strength); } catch (e) {}
      }
    };

    el.addEventListener("pointermove", onPointerMove, { passive: true });
    el.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointerup", onPointerUp);

    return () => {
      mounted = false;
      el.removeEventListener("pointermove", onPointerMove);
      el.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, [active, radius, strength]);

  // ---------- header drag to move (pointer events) ----------
  useEffect(() => {
    const header = toolbarRef.current?.querySelector(".sculpt-header");
    if (!header) return;

    const onPointerDown = (ev) => {
      // only left button
      if (ev.button !== 0) return;
      ev.preventDefault();
      const tRect = toolbarRef.current.getBoundingClientRect();
      draggingRef.current = {
        offsetX: ev.clientX - tRect.left,
        offsetY: ev.clientY - tRect.top,
      };
      header.setPointerCapture?.(ev.pointerId);
      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", onPointerUp);
      try { toolbarRef.current.style.cursor = "grabbing"; } catch (e) {}
    };

    const onPointerMove = (ev) => {
      if (!draggingRef.current) return;
      ev.preventDefault();
      const posX = ev.clientX - draggingRef.current.offsetX;
      const posY = ev.clientY - draggingRef.current.offsetY;
      // clamp
      const w = Math.max(120, toolbarRef.current.offsetWidth || 240);
      const h = Math.max(48, toolbarRef.current.offsetHeight || 160);
      const clampedX = Math.min(Math.max(8, posX), window.innerWidth - w - 8);
      const clampedY = Math.min(Math.max(8, posY), window.innerHeight - h - 8);

      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        setUserPos({ x: clampedX, y: clampedY });
      });
    };

    const onPointerUp = (ev) => {
      if (!draggingRef.current) return;
      try { header.releasePointerCapture?.(ev.pointerId); } catch (e) {}
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      try { toolbarRef.current.style.cursor = "grab"; } catch (e) {}

      // snapping to edges relative to renderer
      const snapThreshold = 28;
      const rendererEl = rendererElemRef.current || document.body;
      const rRect = rendererEl.getBoundingClientRect();
      const tRect = toolbarRef.current.getBoundingClientRect();
      const up = userPos || { x: tRect.left, y: tRect.top };
      const centerX = up.x + tRect.width / 2;
      const centerY = up.y + tRect.height / 2;
      const distLeft = Math.abs(centerX - rRect.left);
      const distRight = Math.abs(rRect.right - centerX);
      const distTop = Math.abs(centerY - rRect.top);
      const distBottom = Math.abs(rRect.bottom - centerY);

      const snapped = { ...up };

      if (distLeft < snapThreshold) {
        snapped.x = Math.max(8, Math.round(rRect.left + 12));
      } else if (distRight < snapThreshold) {
        snapped.x = Math.min(window.innerWidth - tRect.width - 8, Math.round(rRect.right - tRect.width - 12));
      }

      if (distTop < snapThreshold) {
        snapped.y = Math.max(8, Math.round(rRect.top + 12));
      } else if (distBottom < snapThreshold) {
        snapped.y = Math.min(window.innerHeight - tRect.height - 8, Math.round(rRect.bottom - tRect.height - 12));
      }

      setUserPos(snapped);
      try { localStorage.setItem(localKeyPos, JSON.stringify(snapped)); } catch (e) {}
      draggingRef.current = null;
    };

    header.addEventListener("pointerdown", onPointerDown);
    return () => header.removeEventListener("pointerdown", onPointerDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userPos]);

  // double-click header to reset auto-dock
  useEffect(() => {
    const header = toolbarRef.current?.querySelector(".sculpt-header");
    if (!header) return;
    const onDbl = (e) => { e.preventDefault(); setUserPos(null); try { localStorage.removeItem(localKeyPos); } catch (e) {} requestAnimationFrame(() => adjustDockPosition()); };
    header.addEventListener("dblclick", onDbl);
    return () => header.removeEventListener("dblclick", onDbl);
  }, []);

  // keep persisted pinned/collapsed in localStorage
  useEffect(() => {
    try { localStorage.setItem(localKeyPinned, pinned ? "1" : "0"); } catch (e) {}
  }, [pinned]);
  useEffect(() => {
    try { localStorage.setItem(localKeyCollapsed, collapsed ? "1" : "0"); } catch (e) {}
  }, [collapsed]);

  // ensure userPos stays in viewport on resize
  useEffect(() => {
    const onResize = () => {
      if (!userPos) { adjustDockPosition(); return; }
      const w = toolbarRef.current?.offsetWidth || 240;
      const h = toolbarRef.current?.offsetHeight || 140;
      const clampedX = Math.min(Math.max(8, userPos.x), window.innerWidth - w - 8);
      const clampedY = Math.min(Math.max(8, userPos.y), window.innerHeight - h - 8);
      if (clampedX !== userPos.x || clampedY !== userPos.y) {
        const next = { x: clampedX, y: clampedY };
        setUserPos(next);
        try { localStorage.setItem(localKeyPos, JSON.stringify(next)); } catch (e) {}
      }
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [userPos]);

  // sync react -> workspace functions (defensive)
  useEffect(() => { callApi("setSculptRadius", radius); }, [radius]);
  useEffect(() => { callApi("setSculptStrength", strength); }, [strength]);
  useEffect(() => { callApi("setSculptMode", mode); }, [mode]);
  useEffect(() => { callApi("setSculptSymmetry", symmetry); }, [symmetry]);

  // Start/Stop sculpt (UI button)
  const toggleActive = () => {
    if (!active) {
      callApi("startSculpting");
      callApi("setControlsEnabled", false);
      setActive(true);
    } else {
      callApi("stopSculpting");
      callApi("setControlsEnabled", true);
      setActive(false);
    }
    // recalc dock to avoid overlap
    requestAnimationFrame(() => adjustDockPosition());
  };

  const undo = () => callApi("undo");
  const redo = () => callApi("redo");

  // global keyboard: B, 1-6, +/-  (kept)
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "b" || e.key === "B") toggleActive();
      const idx = parseInt(e.key, 10);
      if (!Number.isNaN(idx) && idx >= 1 && idx <= modes.length) setMode(modes[idx - 1]);
      if (e.key === "+") setRadius((r) => Math.min(5, r * 1.2));
      if (e.key === "-") setRadius((r) => Math.max(0.001, r / 1.2));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // keyboard nudge when toolbar focused (arrow keys), Shift for bigger step
  const onToolbarKeyDown = (e) => {
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) return;
    e.preventDefault();
    const step = e.shiftKey ? 16 : 4;
    const cur = userPos || (() => {
      const el = toolbarRef.current;
      const r = el?.getBoundingClientRect?.();
      return r ? { x: Math.round(r.left), y: Math.round(r.top) } : { x: 24, y: 24 };
    })();
    let nx = cur.x, ny = cur.y;
    if (e.key === "ArrowLeft") nx -= step;
    if (e.key === "ArrowRight") nx += step;
    if (e.key === "ArrowUp") ny -= step;
    if (e.key === "ArrowDown") ny += step;
    const w = toolbarRef.current?.offsetWidth || 240;
    const h = toolbarRef.current?.offsetHeight || 140;
    nx = Math.min(Math.max(8, nx), window.innerWidth - w - 8);
    ny = Math.min(Math.max(8, ny), window.innerHeight - h - 8);
    const next = { x: nx, y: ny };
    setUserPos(next);
    try { localStorage.setItem(localKeyPos, JSON.stringify(next)); } catch (e) {}
  };

  // cleanup sculpt on unmount
  useEffect(() => {
    return () => { if (active) { callApi("stopSculpting"); callApi("setControlsEnabled", true); } };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // build style (userPos wins over dockStyle)
  const buildStyle = () => {
    const base = {
      position: "fixed",
      zIndex: 1200,
      transition: "left 120ms ease, right 120ms ease, top 120ms ease, bottom 120ms ease",
      cursor: draggingRef.current ? "grabbing" : "grab",
      userSelect: "none",
      maxWidth: "calc(100vw - 32px)",
    };
    if (userPos && typeof userPos.x === "number" && typeof userPos.y === "number") {
      return { ...base, left: `${userPos.x}px`, top: `${userPos.y}px` };
    }
    const out = { ...base };
    if (dockStyle.left) out.left = dockStyle.left;
    else if (dockStyle.right) out.right = dockStyle.right;
    if (dockStyle.top) out.top = dockStyle.top;
    else if (dockStyle.bottom) out.bottom = dockStyle.bottom;
    return out;
  };

  // small helpers: toggle pinned/collapsed and reset
  const togglePinned = () => { setPinned((v) => !v); };
  const toggleCollapsed = () => { setCollapsed((v) => !v); };
  const resetDock = () => { setUserPos(null); setPinned(false); try { localStorage.removeItem(localKeyPos); localStorage.removeItem(localKeyPinned); } catch (e) {} requestAnimationFrame(() => adjustDockPosition()); };

  // render
  if (collapsed) {
    // compact minimized button
    const style = buildStyle();
    return (
      <>
        <div
          ref={toolbarRef}
          role="toolbar"
          aria-label="Sculpt toolbar (collapsed)"
          tabIndex={0}
          onKeyDown={onToolbarKeyDown}
          style={{ ...style, width: 48, height: 48, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 12, padding: 8 }}
          title="Sculpt (collapsed) — click to expand"
        >
          <button
            onClick={() => setCollapsed(false)}
            style={{ width: 40, height: 40, borderRadius: 8, background: "rgba(255,255,255,0.06)", color: "#fff", border: "none", cursor: "pointer" }}
          >
            ✦
          </button>
        </div>

        {brushOverlay.visible && (
          <div aria-hidden style={{
            position: "fixed",
            left: `${brushOverlay.x}px`,
            top: `${brushOverlay.y}px`,
            transform: "translate(-50%,-50%)",
            width: `${brushOverlay.pxRadius * 2}px`,
            height: `${brushOverlay.pxRadius * 2}px`,
            borderRadius: "50%",
            border: "2px dashed rgba(255,255,255,0.6)",
            mixBlendMode: "screen",
            pointerEvents: "none",
            zIndex: 1100,
          }} />
        )}
      </>
    );
  }

  return (
    <>
      <div
        ref={toolbarRef}
        role="toolbar"
        aria-label="Sculpt toolbar"
        tabIndex={0}
        onKeyDown={onToolbarKeyDown}
        style={buildStyle()}
        className="sculpt-toolbar"
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <div
            className="sculpt-header"
            style={{ fontWeight: 700, cursor: "grab", display: "flex", alignItems: "center", gap: 8 }}
            title="Drag to move — double-click to reset"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ opacity: 0.9 }}>
              <path d="M7 9h10M7 15h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Sculpt
          </div>

          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <button onClick={undo} className="px-2 py-1 rounded" style={{ background: "rgba(255,255,255,0.04)", color: "#fff", border: "none" }}>Undo</button>
            <button onClick={redo} className="px-2 py-1 rounded" style={{ background: "rgba(255,255,255,0.04)", color: "#fff", border: "none" }}>Redo</button>

            <button
              onClick={togglePinned}
              title={pinned ? "Unpin (stop auto-docking)" : "Pin (keep current position)"}
              style={{ marginLeft: 6, background: pinned ? "rgba(127,90,240,0.95)" : "rgba(255,255,255,0.04)", color: "#fff", border: "none", padding: "6px 8px", borderRadius: 8 }}
            >
              {pinned ? "📌" : "📍"}
            </button>

            <button
              onClick={() => setCollapsed(true)}
              title="Collapse toolbar"
              style={{ marginLeft: 6, background: "rgba(255,255,255,0.04)", color: "#fff", border: "none", padding: "6px 8px", borderRadius: 8 }}
            >
              ―
            </button>
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
          <button
            onClick={toggleActive}
            style={{ flex: 1, padding: "8px 10px", borderRadius: 8, background: active ? "linear-gradient(90deg,#16a34a,#059669)" : "rgba(255,255,255,0.04)", color: "#fff", border: "none" }}
          >
            {active ? "Stop" : "Start"}
          </button>
          <div style={{ padding: "8px 10px", borderRadius: 8, background: "rgba(255,255,255,0.04)", color: "#fff" }} title="Toggle (B)">B</div>
        </div>

        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 12, marginBottom: 6 }}>Mode</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {modes.map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                style={{
                  padding: "6px 8px",
                  borderRadius: 8,
                  background: mode === m ? "rgba(99,102,241,0.95)" : "rgba(255,255,255,0.04)",
                  color: "#fff",
                  border: "none",
                  cursor: "pointer"
                }}
              >
                {m}
              </button>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 12, marginBottom: 6 }}>Radius: {radius.toFixed(2)}</div>
          <input type="range" min="0.01" max="5" step="0.01" value={radius} onChange={(e) => setRadius(parseFloat(e.target.value))} style={{ width: "100%" }} />
        </div>

        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 12, marginBottom: 6 }}>Strength: {strength.toFixed(2)}</div>
          <input type="range" min="0.01" max="2" step="0.01" value={strength} onChange={(e) => setStrength(parseFloat(e.target.value))} style={{ width: "100%" }} />
        </div>

        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 12, marginBottom: 6 }}>Symmetry</div>
          <div style={{ display: "flex", gap: 8 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 6 }}><input type="checkbox" checked={symmetry.x} onChange={() => setSymmetry(s => ({ ...s, x: !s.x }))} />X</label>
            <label style={{ display: "flex", alignItems: "center", gap: 6 }}><input type="checkbox" checked={symmetry.y} onChange={() => setSymmetry(s => ({ ...s, y: !s.y }))} />Y</label>
            <label style={{ display: "flex", alignItems: "center", gap: 6 }}><input type="checkbox" checked={symmetry.z} onChange={() => setSymmetry(s => ({ ...s, z: !s.z }))} />Z</label>
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, justifyContent: "space-between", alignItems: "center", marginTop: 6 }}>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.65)" }}>Shortcuts: B · 1-6 · +/-</div>
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={resetDock} style={{ background: "rgba(255,255,255,0.03)", color: "#fff", border: "none", padding: "6px 8px", borderRadius: 6 }}>Reset</button>
          </div>
        </div>
      </div>

      {/* Brush preview overlay */}
      {brushOverlay.visible && (
        <div aria-hidden style={{
          position: "fixed",
          left: `${brushOverlay.x}px`,
          top: `${brushOverlay.y}px`,
          transform: "translate(-50%,-50%)",
          width: `${brushOverlay.pxRadius * 2}px`,
          height: `${brushOverlay.pxRadius * 2}px`,
          borderRadius: "50%",
          border: "2px dashed rgba(255,255,255,0.6)",
          mixBlendMode: "screen",
          pointerEvents: "none",
          zIndex: 1100,
        }} />
      )}
    </>
  );
}
