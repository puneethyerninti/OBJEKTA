// src/components/Palette.jsx
import React, { useMemo, useState, useCallback, useEffect, useRef } from "react";
import { useDragLayer } from "react-dnd";
import "../styles/Palette.css";

const PALETTE_TYPE = "PALETTE_ITEM";

const shapeIcons = {
  Cube: "▦", Sphere: "◯", Cone: "◭", Plane: "▭", Cylinder: "⬒",
  Torus: "◎", Empty: "⊙", "Axis Helper": "⟂", "Point Light": "●",
  "Spot Light": "◍", "Directional Light": "➤", Camera: "📷", Default: "■",
};

const DEFAULT_GROUPS = {
  Shapes: ["Cube", "Sphere", "Cone", "Plane", "Cylinder", "Torus"],
  Lights: ["Point Light", "Spot Light", "Directional Light"],
  Helpers: ["Empty", "Axis Helper"],
  Camera: ["Camera"],
};

const FILTERS = ["All", ...Object.keys(DEFAULT_GROUPS), "Misc"];
const STORAGE_KEY = "objekta_palette_sections_open_v2";

/* Drag preview shown while dragging from the palette */
const DragPreview = () => {
  const { isDragging, item, clientOffset } = useDragLayer((monitor) => ({
    isDragging: monitor.isDragging(),
    item: monitor.getItem(),
    clientOffset: monitor.getClientOffset(),
  }));

  if (!isDragging || !item || !clientOffset) return null;
  const icon = shapeIcons[item.name] || shapeIcons.Default;

  // keep preview centered at pointer, account for devicePixelRatio for crispness
  const PREVIEW_W = 180;
  const PREVIEW_H = 58;
  const left = clientOffset.x - PREVIEW_W / 2;
  const top = clientOffset.y - PREVIEW_H / 2;

  return (
    <div
      style={{
        position: "fixed",
        pointerEvents: "none",
        transform: `translate(${left}px, ${top}px) scale(0.98)`,
        opacity: 0.98,
        zIndex: 9999,
      }}
      aria-hidden
    >
      <div className="palette-drag-preview">
        <div className="palette-drag-preview-icon">{icon}</div>
        <div className="palette-drag-preview-meta">
          <div className="palette-drag-preview-title">{item.name}</div>
          {item.color && <div className="palette-drag-preview-sub">{item.color}</div>}
        </div>
      </div>
    </div>
  );
};

/* Single palette item (draggable + keyboard accessible) */
const PaletteItem = React.memo(({ item, onAdd }) => {
  // use native HTML5 drag for better cross-compatibility (react-dnd will still pick it up
  // when used with the DnD backend). The workspace uses react-dnd drop, so ensure we call onAdd on click/keyboard.
  const handleAdd = useCallback(() => onAdd?.(item.name, null, item), [item, onAdd]);

  const handleKey = useCallback(
    (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        handleAdd();
      }
    },
    [handleAdd]
  );

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`Add ${item.name}`}
      onClick={handleAdd}
      onKeyDown={handleKey}
      className="palette-item"
      title={item.name}
    >
      <div className="palette-item-inner">
        <div className="palette-item-icon">{shapeIcons[item.name] || shapeIcons.Default}</div>

        <div className="palette-item-body">
          <span className="palette-item-name">{item.name}</span>
        </div>

        {item.color && (
          <div className="palette-item-color" style={{ background: item.color }} />
        )}
      </div>
    </div>
  );
});

/* Collapsible section with debounced localStorage persistence */
const Section = ({ title, children, defaultOpen = true }) => {
  const [open, setOpen] = useState(defaultOpen);
  const saveTimeout = useRef(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const map = JSON.parse(raw);
        if (typeof map[title] === "boolean") setOpen(map[title]);
      }
    } catch (err) {}
  }, [title]);

  useEffect(() => {
    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(() => {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        const map = raw ? JSON.parse(raw) : {};
        map[title] = open;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
      } catch (err) {}
      finally { saveTimeout.current = null; }
    }, 160);
    return () => { if (saveTimeout.current) clearTimeout(saveTimeout.current); };
  }, [open, title]);

  return (
    <div className="palette-section">
      <button
        className="section-header"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        type="button"
      >
        <span>{title}</span>
        <span className={`section-arrow ${open ? "open" : ""}`}>▸</span>
      </button>
      {open && <div className="section-content">{children}</div>}
    </div>
  );
};

/* Main Palette component */
const Palette = ({ items = null, onAction }) => {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All");

  const normalizedItems = useMemo(() => {
    if (Array.isArray(items) && items.length > 0) {
      return items.map(it => (typeof it === "string" ? { name: it } : (it.name ? it : { name: String(it) })));
    }
    return Object.values(DEFAULT_GROUPS).flat().map(name => ({ name }));
  }, [items]);

  const grouped = useMemo(() => {
    const searchLower = search.trim().toLowerCase();
    const result = Object.fromEntries(Object.keys(DEFAULT_GROUPS).map(g => [g, []]));
    result.Misc = [];

    normalizedItems.forEach((it) => {
      if (searchLower && !it.name.toLowerCase().includes(searchLower)) return;

      let placed = false;
      for (const [group, names] of Object.entries(DEFAULT_GROUPS)) {
        if (names.includes(it.name)) {
          result[group].push(it);
          placed = true;
          break;
        }
      }
      if (!placed) result.Misc.push(it);
    });

    if (filter !== "All") {
      for (const group in result) {
        if (group !== filter) result[group] = [];
      }
    }

    return result;
  }, [normalizedItems, search, filter]);

  const hasAnyResults = Object.values(grouped).some(arr => arr.length > 0);

  const handleAdd = useCallback((name, _, itemData) => onAction?.(name, null, itemData), [onAction]);

  return (
    <div className="palette-container" style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <h3 className="palette-header">Palette</h3>
      <div className="palette-handle tilt-on-hover" aria-hidden />

      <input
        className="palette-search"
        type="text"
        placeholder="Search..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <div className="palette-filters" style={{ marginTop: 8 }}>
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`filter-btn ${filter === f ? "active" : ""}`}
            type="button"
          >
            {f}
          </button>
        ))}
      </div>

      <div style={{ flex: 1, overflowY: "auto", paddingRight: 6, marginTop: 8 }}>
        {Object.entries(grouped).map(([group, arr]) =>
          arr.length > 0 ? (
            <Section key={group} title={group}>
              {arr.map((it, idx) => (
                <PaletteItem key={`${it.name}-${idx}`} item={it} onAdd={handleAdd} />
              ))}
            </Section>
          ) : null
        )}

        {!hasAnyResults && (
          <div style={{ color: "var(--text-muted)", textAlign: "center", fontSize: 12, padding: 12 }}>
            No items found.
          </div>
        )}
      </div>

      <DragPreview />
    </div>
  );
};

export default Palette;
export { PALETTE_TYPE };
