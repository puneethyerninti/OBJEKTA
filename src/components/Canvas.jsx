import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDrop } from "react-dnd";
import { PALETTE_TYPE } from "./Sidebar";

const BG = "#0b0b18";
const GRID_MINOR = "#222247";
const GRID_MAJOR = "#2d2d60";

function useId() {
  return () => `${Date.now()}_${Math.round(Math.random() * 1e9)}`;
}

export default function Canvas() {
  const makeId = useId();
  const wrapRef = useRef(null);

  // viewport
  const [scale, setScale] = useState(1);        // zoom
  const [offset, setOffset] = useState({ x: 0, y: 0 }); // pan

  // elements on canvas
  const [els, setEls] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const selected = useMemo(() => els.find(e => e.id === selectedId) || null, [els, selectedId]);

  // snap
  const [snap, setSnap] = useState(true);
  const gridSize = 20;

  // helpers
  const clientToWorld = useCallback((clientX, clientY) => {
    const rect = wrapRef.current.getBoundingClientRect();
    const x = (clientX - rect.left - rect.width/2 - offset.x) / scale;
    const y = (clientY - rect.top  - rect.height/2 - offset.y) / scale;
    return { x, y };
  }, [offset, scale]);

  const worldToClient = useCallback((x, y) => {
    const rect = wrapRef.current.getBoundingClientRect();
    return {
      x: rect.left + rect.width/2 + offset.x + x * scale,
      y: rect.top  + rect.height/2 + offset.y + y * scale,
    };
  }, [offset, scale]);

  const snapVal = (v) => (snap ? Math.round(v / gridSize) * gridSize : v);

  const defaultsFor = (kind) => {
    switch (kind) {
      case "rect":   return { w: 160, h: 100, fill: "#8a2be2" };
      case "circle": return { w: 120, h: 120, fill: "#5b2cff" };
      case "text":   return { w: 220, h: 40,  text: "Sample Text", fill: "#eaeafe" };
      case "button": return { w: 160, h: 44,  text: "Button",     fill: "#5b2cff" };
      case "image":  return { w: 200, h: 140, src: "" };
      default:       return { w: 120, h: 80 };
    }
  };

  // DnD drop
  const [{ isOver }, drop] = useDrop(() => ({
    accept: PALETTE_TYPE,
    drop: (item, monitor) => {
      const pt = monitor.getClientOffset();
      if (!pt) return;
      const world = clientToWorld(pt.x, pt.y);
      const d = defaultsFor(item.kind);
      const el = {
        id: makeId(),
        kind: item.kind,
        x: snapVal(world.x - d.w/2),
        y: snapVal(world.y - d.h/2),
        ...d,
        r: 0, // rotation reserved
      };
      setEls((p) => [...p, el]);
      setSelectedId(el.id);
    },
    collect: (m) => ({ isOver: m.isOver() }),
  }), [clientToWorld, makeId, snap]);

  // wheel zoom
  useEffect(() => {
    const node = wrapRef.current;
    if (!node) return;
    const onWheel = (e) => {
      e.preventDefault();
      const dir = Math.sign(e.deltaY);
      const zoomFactor = 1 - dir * 0.1;
      const rect = node.getBoundingClientRect();
      const mouse = { x: e.clientX - rect.left, y: e.clientY - rect.top };

      // world coords before zoom
      const worldBefore = clientToWorld(e.clientX, e.clientY);

      setScale((s) => Math.max(0.2, Math.min(4, s * zoomFactor)));

      // keep pointer anchored
      const worldAfter = clientToWorld(e.clientX, e.clientY);
      setOffset((o) => ({
        x: o.x + (worldAfter.x - worldBefore.x) * scale,
        y: o.y + (worldAfter.y - worldBefore.y) * scale,
      }));
    };
    node.addEventListener("wheel", onWheel, { passive: false });
    return () => node.removeEventListener("wheel", onWheel);
  }, [clientToWorld, scale]);

  // middle-mouse pan
  useEffect(() => {
    const node = wrapRef.current;
    if (!node) return;
    let panning = false;
    let sx = 0, sy = 0;

    const down = (e) => {
      if (e.button !== 1) return; // middle
      e.preventDefault();
      panning = true;
      sx = e.clientX;
      sy = e.clientY;
      node.style.cursor = "grabbing";
    };
    const move = (e) => {
      if (!panning) return;
      setOffset((o) => ({ x: o.x + (e.clientX - sx), y: o.y + (e.clientY - sy) }));
      sx = e.clientX; sy = e.clientY;
    };
    const up = () => {
      panning = false;
      node.style.cursor = "default";
    };

    node.addEventListener("mousedown", down);
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    return () => {
      node.removeEventListener("mousedown", down);
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
  }, []);

  // keyboard: delete selection
  useEffect(() => {
    const onKey = (e) => {
      if ((e.key === "Delete" || e.key === "Backspace") && selected) {
        setEls((p) => p.filter((x) => x.id !== selected.id));
        setSelectedId(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected]);

  // drag move
  const startDragMove = (el, e) => {
    e.stopPropagation();
    setSelectedId(el.id);
    const start = { x: e.clientX, y: e.clientY, ex: el.x, ey: el.y };
    const move = (ev) => {
      const dx = (ev.clientX - start.x) / scale;
      const dy = (ev.clientY - start.y) / scale;
      const nx = snapVal(start.ex + dx);
      const ny = snapVal(start.ey + dy);
      setEls((p) => p.map((it) => (it.id === el.id ? { ...it, x: nx, y: ny } : it)));
    };
    const up = () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  };

  // resize handles
  const startResize = (el, dir, e) => {
    e.stopPropagation();
    setSelectedId(el.id);
    const start = { x: e.clientX, y: e.clientY, ...el };
    const move = (ev) => {
      const dx = (ev.clientX - start.x) / scale;
      const dy = (ev.clientY - start.y) / scale;

      let x = start.x, y = start.y, w = start.w, h = start.h;

      if (dir.includes("e")) w = snapVal(Math.max(20, start.w + dx));
      if (dir.includes("s")) h = snapVal(Math.max(20, start.h + dy));
      if (dir.includes("w")) { const nw = Math.max(20, start.w - dx); x = snapVal(start.x + (start.w - nw)); w = snapVal(nw); }
      if (dir.includes("n")) { const nh = Math.max(20, start.h - dy); y = snapVal(start.y + (start.h - nh)); h = snapVal(nh); }

      setEls((p) => p.map((it) => (it.id === el.id ? { ...it, x, y, w, h } : it)));
    };
    const up = () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  };

  // Render helpers
  const Grid = () => {
    const style = {
      position: "absolute",
      inset: 0,
      background: BG,
      // two-layer grid
      backgroundImage: `
        linear-gradient(${GRID_MINOR} 1px, transparent 1px),
        linear-gradient(90deg, ${GRID_MINOR} 1px, transparent 1px),
        linear-gradient(${GRID_MAJOR} 1px, transparent 1px),
        linear-gradient(90deg, ${GRID_MAJOR} 1px, transparent 1px)
      `,
      backgroundSize: `
        ${gridSize * scale}px ${gridSize * scale}px,
        ${gridSize * scale}px ${gridSize * scale}px,
        ${gridSize * 5 * scale}px ${gridSize * 5 * scale}px,
        ${gridSize * 5 * scale}px ${gridSize * 5 * scale}px
      `,
      backgroundPosition: `
        calc(50% + ${offset.x}px) calc(50% + ${offset.y}px),
        calc(50% + ${offset.x}px) calc(50% + ${offset.y}px),
        calc(50% + ${offset.x}px) calc(50% + ${offset.y}px),
        calc(50% + ${offset.x}px) calc(50% + ${offset.y}px)
      `,
    };
    return <div style={style} />;
  };

  const Element = ({ el }) => {
    const { x, y, w, h, kind } = el;
    const { x: cx, y: cy } = worldToClient(x, y);

    const base = {
      position: "absolute",
      left: cx,
      top: cy,
      width: w * scale,
      height: h * scale,
      transform: `translate(-50%, -50%)`, // because worldToClient uses element top-left; adjust to top-left anchor
      // Actually we output top-left in world coords; easier: remove translate and compute top-left:
    };

    // correction: compute top-left client directly
    const topLeft = worldToClient(x, y);
    const styleWrap = {
      position: "absolute",
      left: topLeft.x,
      top: topLeft.y,
      width: w * scale,
      height: h * scale,
      boxSizing: "border-box",
      outline: selectedId === el.id ? "2px solid #6b39ff" : "1px solid #2a2a4c",
      borderRadius: 10,
      cursor: "grab",
      userSelect: "none",
      background: kind === "text" ? "transparent" :
                  kind === "button" ? el.fill || "#5b2cff" :
                  kind === "circle" ? "transparent" :
                  el.fill || "#8a2be2",
    };

    return (
      <div
        style={styleWrap}
        onMouseDown={(e) => startDragMove(el, e)}
        onClick={(e) => { e.stopPropagation(); setSelectedId(el.id); }}
      >
        {/* visuals */}
        {kind === "circle" && (
          <div style={{
            width: "100%", height: "100%", borderRadius: "50%",
            background: el.fill || "#5b2cff", boxShadow: "0 6px 16px rgba(0,0,0,0.25)"
          }} />
        )}
        {kind === "rect" && (
          <div style={{ width: "100%", height: "100%", borderRadius: 12, boxShadow: "0 6px 16px rgba(0,0,0,0.25)" }} />
        )}
        {kind === "text" && (
          <div style={{
            width: "100%", height: "100%", color: el.fill || "#eaeafe",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: Math.round(16 * scale), fontWeight: 600, letterSpacing: 0.2
          }}>
            {el.text || "Sample Text"}
          </div>
        )}
        {kind === "button" && (
          <button style={{
            width: "100%", height: "100%", color: "#fff", border: "none",
            borderRadius: 12, fontWeight: 700, letterSpacing: 0.3, cursor: "inherit"
          }}>
            {el.text || "Button"}
          </button>
        )}
        {kind === "image" && (
          <div style={{
            width: "100%", height: "100%",
            background: "linear-gradient(135deg, #202040, #141428)",
            border: "1px dashed #3a3a64", color: "#c9c9f1",
            display: "grid", placeItems: "center", fontSize: 12, borderRadius: 10
          }}>
            Image
          </div>
        )}

        {/* resize handles if selected */}
        {selectedId === el.id && (
          <>
            {["n","s","e","w","ne","nw","se","sw"].map((dir) => {
              const handleStyle = handlePosition(dir, w*scale, h*scale);
              return (
                <div
                  key={dir}
                  onMouseDown={(e) => startResize(el, dir, e)}
                  style={{
                    position:"absolute",
                    ...handleStyle,
                    width: 10, height: 10, borderRadius: 2,
                    background: "#6b39ff", border: "1px solid #ffffff33",
                    cursor: cursorFor(dir),
                  }}
                />
              );
            })}
          </>
        )}
      </div>
    );
  };

  return (
    <section
      ref={(n) => {
        drop(n);
        wrapRef.current = n;
      }}
      onMouseDown={() => setSelectedId(null)}
      style={{
        flex: 1,
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* top bar */}
      <div style={{
        position: "absolute", top: 8, left: 8, zIndex: 3,
        display: "flex", gap: 8, alignItems: "center",
        background: "#151528", border: "1px solid #23233d",
        borderRadius: 10, padding: "6px 10px", color:"#dcdcf7"
      }}>
        <label style={{ display:"flex", gap:6, alignItems:"center", fontSize:12 }}>
          <input type="checkbox" checked={snap} onChange={(e)=>setSnap(e.target.checked)} />
          Snap {gridSize}px
        </label>
        <span style={{ opacity:.8, fontSize:12 }}>Zoom: {Math.round(scale*100)}%</span>
        <span style={{ opacity:.6, fontSize:12 }}>Pan: {offset.x}, {offset.y}</span>
      </div>

      {/* grid */}
      <Grid />

      {/* center origin crosshair */}
      <div style={{
        position:"absolute", left:"50%", top:"50%", width:1, height:"100%",
        background:"#ffffff10", transform:`translateX(${offset.x}px) translateY(0)`, pointerEvents:"none"
      }}/>
      <div style={{
        position:"absolute", left:0, top:"50%", height:1, width:"100%",
        background:"#ffffff10", transform:`translateY(${offset.y}px)`, pointerEvents:"none"
      }}/>

      {/* content layer (elements) */}
      <div
        style={{
          position: "absolute",
          left: "50%", top: "50%",
          transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px)) scale(${scale})`,
          transformOrigin: "0 0",
          width: 4000, height: 4000, // huge virtual area
        }}
      >
        {/* selection blocker visually via outline on selected element, handled inside Element */}
      </div>

      {/* Absolutely position each element using worldToClient */}
      {els.map((el) => <Element key={el.id} el={el} />)}

      {/* empty hint */}
      {els.length === 0 && !isOver && (
        <div style={{
          position:"absolute", inset:0, display:"grid", placeItems:"center",
          color:"#9a9ad2", fontSize:14, pointerEvents:"none"
        }}>
          Drag from the left toolbar and drop here
        </div>
      )}
    </section>
  );
}

/* ---------- small helpers for resize handles ---------- */
function handlePosition(dir, w, h) {
  const half = 5;
  const pos = {};
  if (dir.includes("n")) pos.top = -half;
  if (dir.includes("s")) pos.bottom = -half;
  if (dir.includes("w")) pos.left = -half;
  if (dir.includes("e")) pos.right = -half;
  if (dir === "n" || dir === "s") { pos.left = "50%"; pos.transform = "translateX(-50%)"; }
  if (dir === "e" || dir === "w") { pos.top  = "50%"; pos.transform = "translateY(-50%)"; }
  if (dir === "ne") { pos.top = -half; pos.right = -half; }
  if (dir === "nw") { pos.top = -half; pos.left = -half; }
  if (dir === "se") { pos.bottom = -half; pos.right = -half; }
  if (dir === "sw") { pos.bottom = -half; pos.left = -half; }
  return pos;
}
function cursorFor(dir) {
  switch (dir) {
    case "n": return "ns-resize";
    case "s": return "ns-resize";
    case "e": return "ew-resize";
    case "w": return "ew-resize";
    case "ne": return "nesw-resize";
    case "sw": return "nesw-resize";
    case "nw": return "nwse-resize";
    case "se": return "nwse-resize";
    default: return "default";
  }
}
