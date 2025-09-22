// src/components/Outliner.jsx
import React, { useCallback, useEffect, useRef, useState, useMemo } from "react";
import EventBus from "../utils/EventBus";
import { SceneGraphStore } from "../store/SceneGraphStore";
import * as THREE from "three";

/**
 * Outliner.jsx
 * - Robustly reads objects from SceneGraphStore or falls back to window.__OBJEKTA_WORKSPACE
 * - Subscribes to EventBus ("scene:updated", "object:selected")
 * - Emits "object:selected" when user selects an object
 * - Supports rename, toggle visibility, delete with safe fallbacks
 * - Improved accessibility (keyboard: Enter selects, F2 rename, Del delete)
 */

/* Helpers */
const isUserObject = (o) => {
  if (!o) return false;
  try {
    if (typeof o.userData?.__objekta !== "undefined") return !!o.userData.__objekta;
    if (typeof o.name === "string" && o.name.startsWith("_")) return false;
  } catch (e) {
    // ignore
  }
  return true;
};

const disposeObjectSimple = (obj) => {
  try {
    obj.traverse((n) => {
      if (n.isMesh) {
        try { n.geometry?.dispose?.(); } catch (e) {}
        try {
          if (Array.isArray(n.material)) n.material.forEach((m) => m?.dispose?.());
          else n.material?.dispose?.();
        } catch (e) {}
        try { if (n.material?.map) n.material.map.dispose?.(); } catch (e) {}
      }
    });
  } catch (e) {}
};

/* OutlinerItem: recursive render of object + actions */
const OutlinerItem = React.memo(function OutlinerItem({
  obj,
  depth = 0,
  selectedId,
  onSelect,
  onRename,
  onDelete,
  onToggleVisibility,
}) {
  const [open, setOpen] = useState(true);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(obj?.name || "");

  useEffect(() => { setName(obj?.name || ""); }, [obj?.name]);

  const children = useMemo(() => (Array.isArray(obj?.children) ? obj.children.filter((c) => isUserObject(c)) : []), [obj]);
  const hasChildren = children.length > 0;
  const isSelected = selectedId === obj?.uuid;

  const handlePrimaryClick = useCallback((e) => {
    e?.stopPropagation();
    if (!obj) return;
    onSelect?.(obj);
  }, [obj, onSelect]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onSelect?.(obj);
    } else if (e.key === "F2") {
      e.preventDefault();
      setEditing(true);
    } else if (e.key === "Delete") {
      e.preventDefault();
      if (confirm(`Delete '${obj.name || obj.type}'?`)) onDelete?.(obj);
    }
  }, [obj, onSelect, onDelete]);

  const handleRenameBlur = useCallback(() => {
    setEditing(false);
    const newName = (name || "").trim();
    if (newName && newName !== (obj?.name || "")) {
      onRename?.(obj, newName);
    } else {
      // restore displayed name from obj in case it changed externally
      setName(obj?.name || "");
    }
  }, [name, obj, onRename]);

  return (
    <div
      className="outliner-item"
      role="treeitem"
      aria-expanded={hasChildren ? open : undefined}
      aria-selected={isSelected}
      style={{ paddingLeft: depth * 12, marginBottom: 6 }}
      onKeyDown={handleKeyDown}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {hasChildren ? (
          <button
            type="button"
            aria-label={open ? "collapse" : "expand"}
            onClick={(ev) => { ev.stopPropagation(); setOpen((v) => !v); }}
            className="icon-btn"
            style={{ width: 20, height: 24 }}
          >
            {open ? "▾" : "▸"}
          </button>
        ) : (
          <div style={{ width: 20, height: 24 }} />
        )}

        <div
          role="button"
          tabIndex={0}
          onClick={handlePrimaryClick}
          onDoubleClick={() => onSelect?.(obj)}
          style={{
            flex: 1,
            cursor: "pointer",
            padding: "6px 8px",
            borderRadius: 6,
            background: isSelected ? "rgba(127,90,240,0.12)" : "transparent",
            display: "flex",
            alignItems: "center",
            gap: 8,
            minWidth: 0,
          }}
        >
          {editing ? (
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={handleRenameBlur}
              onKeyDown={(e) => {
                if (e.key === "Enter") { handleRenameBlur(); }
                if (e.key === "Escape") { setEditing(false); setName(obj?.name || ""); }
              }}
              autoFocus
              style={{ width: "100%", padding: 6, fontSize: 13 }}
            />
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", overflow: "hidden" }}>
              <div style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 13 }}>
                {obj?.name || obj?.type || "object"}
              </div>
              <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                {obj?.type === "Group" ? "" : ""}
              </div>
            </div>
          )}
        </div>

        <button type="button" title="Rename (F2)" onClick={(e) => { e.stopPropagation(); setEditing(true); }} className="icon-btn">✎</button>
        <button type="button" title={obj?.visible ? "Hide" : "Show"} onClick={(e) => { e.stopPropagation(); onToggleVisibility?.(obj); }} className="icon-btn" aria-pressed={!!obj?.visible}>
          {obj?.visible ? "👁" : "🚫"}
        </button>
        <button type="button" title="Delete" onClick={(e) => { e.stopPropagation(); if (confirm(`Delete '${obj?.name || obj?.type}'?`)) onDelete?.(obj); }} className="icon-btn">🗑</button>
      </div>

      {hasChildren && open && (
        <div role="group" style={{ marginTop: 6 }}>
          {children.map((c) => (
            <OutlinerItem
              key={c.uuid}
              obj={c}
              depth={depth + 1}
              selectedId={selectedId}
              onSelect={onSelect}
              onRename={onRename}
              onDelete={onDelete}
              onToggleVisibility={onToggleVisibility}
            />
          ))}
        </div>
      )}
    </div>
  );
});

/* Main Outliner component */
export default function Outliner({ workspaceRef = null, onSelect: onSelectProp = null, className = "", style = {} }) {
  const [items, setItems] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [filter, setFilter] = useState("");
  const mountedRef = useRef(true);

  const getTopLevelObjects = useCallback(() => {
    // Try SceneGraphStore preferred access patterns
    try {
      if (SceneGraphStore && typeof SceneGraphStore.getObjects === "function") {
        const objs = SceneGraphStore.getObjects() || [];
        return objs.filter((o) => isUserObject(o));
      }
      if (SceneGraphStore && SceneGraphStore.objects && typeof SceneGraphStore.objects === "object") {
        return Object.values(SceneGraphStore.objects).map((x) => x.object).filter((o) => isUserObject(o));
      }
      // try store getter for selected
      if (SceneGraphStore && typeof SceneGraphStore.getSelected === "function") {
        const sel = SceneGraphStore.getSelected?.();
        if (sel) setSelectedId(sel);
      } else if (SceneGraphStore && typeof SceneGraphStore.selected !== "undefined") {
        setSelectedId(SceneGraphStore.selected || null);
      }
    } catch (e) {
      // ignore
    }

    // fallback to global workspace helpers
    try {
      const globalWs = window.__OBJEKTA_WORKSPACE;
      if (globalWs) {
        if (typeof globalWs.getSceneObjects === "function") {
          const objs = globalWs.getSceneObjects() || [];
          return objs.filter((o) => isUserObject(o));
        }
        if (typeof globalWs.getScene === "function") {
          const s = globalWs.getScene();
          const ug = s?._user_group ?? s?._userGroup;
          if (ug) return Array.from(ug.children).filter((o) => isUserObject(o));
        }
        if (globalWs.scene) {
          const s = globalWs.scene;
          const ug = s?._user_group ?? s?._userGroup;
          if (ug) return Array.from(ug.children).filter((o) => isUserObject(o));
        }
      }
    } catch (e) {
      // ignore
    }

    return [];
  }, []);

  const refresh = useCallback(() => {
    if (!mountedRef.current) return;
    try {
      const list = getTopLevelObjects();
      // sort by name for predictable ordering
      list.sort((a, b) => (String(a.name || a.type || "").localeCompare(String(b.name || b.type || ""))));
      setItems(list);
      // try to sync selection from store (best-effort)
      try {
        if (SceneGraphStore && typeof SceneGraphStore.getSelected === "function") {
          setSelectedId(SceneGraphStore.getSelected() || null);
        } else if (SceneGraphStore && typeof SceneGraphStore.selected !== "undefined") {
          setSelectedId(SceneGraphStore.selected || null);
        }
      } catch (e) {}
    } catch (e) {
      console.warn("Outliner: refresh failed", e);
    }
  }, [getTopLevelObjects]);

  useEffect(() => {
    mountedRef.current = true;
    refresh();

    const onSceneUpdated = () => refresh();
    const onObjectSelected = (payload) => {
      const id = typeof payload === "string" ? payload : payload?.id ?? payload?.uuid ?? payload;
      setSelectedId(id || null);
    };

    try { EventBus?.on?.("scene:updated", onSceneUpdated); } catch (e) {}
    try { EventBus?.on?.("object:selected", onObjectSelected); } catch (e) {}

    // polling fallback in case external code doesn't emit events
    const iv = setInterval(() => refresh(), 1200);

    return () => {
      mountedRef.current = false;
      try { EventBus?.off?.("scene:updated", onSceneUpdated); } catch (e) {}
      try { EventBus?.off?.("object:selected", onObjectSelected); } catch (e) {}
      clearInterval(iv);
    };
  }, [refresh]);

  const handleSelect = useCallback((obj) => {
    if (!obj) return;
    const id = obj.uuid;
    setSelectedId(id);

    // prefer SceneGraphStore select API
    try {
      if (SceneGraphStore && typeof SceneGraphStore.selectObject === "function") {
        SceneGraphStore.selectObject(id);
      } else if (SceneGraphStore && typeof SceneGraphStore.setSelected === "function") {
        SceneGraphStore.setSelected(id);
      }
    } catch (e) {}

    // ask workspace to select if available
    try {
      if (workspaceRef && workspaceRef.current && typeof workspaceRef.current.selectObject === "function") {
        workspaceRef.current.selectObject(obj);
      }
    } catch (e) {}

    // emit for other listeners
    try { EventBus?.emit?.("object:selected", id); } catch (e) {}

    // call prop callback
    try { onSelectProp?.(obj); } catch (e) {}
  }, [onSelectProp, workspaceRef]);

  const handleRename = useCallback((obj, newName) => {
    if (!obj) return;
    try {
      if (SceneGraphStore && typeof SceneGraphStore.renameObject === "function") {
        SceneGraphStore.renameObject(obj.uuid, newName);
        EventBus?.emit?.("scene:updated");
        return;
      }
    } catch (e) { /* fallback */ }

    // fallback to set name directly and emit update
    try {
      obj.name = newName;
      EventBus?.emit?.("scene:updated");
    } catch (e) { console.warn("Outliner: rename fallback failed", e); }
  }, []);

  const handleDelete = useCallback((obj) => {
    if (!obj) return;
    try {
      // prefer store removal
      if (SceneGraphStore && typeof SceneGraphStore.removeObject === "function") {
        SceneGraphStore.removeObject(obj.uuid);
        EventBus?.emit?.("scene:updated");
        return;
      }
    } catch (e) {}

    // workspace deleteSelected fallback
    try {
      if (workspaceRef && workspaceRef.current && typeof workspaceRef.current.deleteSelected === "function") {
        if (typeof workspaceRef.current.selectObject === "function") workspaceRef.current.selectObject(obj);
        workspaceRef.current.deleteSelected();
        EventBus?.emit?.("scene:updated");
        return;
      }
    } catch (e) {}

    // last resort: dispose + remove
    try {
      disposeObjectSimple(obj);
      if (obj.parent) obj.parent.remove(obj);
      EventBus?.emit?.("scene:updated");
    } catch (e) { console.warn("Outliner: delete fallback failed", e); }
  }, [workspaceRef]);

  const handleToggleVisibility = useCallback((obj) => {
    if (!obj) return;
    try {
      obj.visible = !obj.visible;
      EventBus?.emit?.("scene:updated");
    } catch (e) { console.warn("Outliner: toggle visibility failed", e); }
  }, []);

  const filtered = useMemo(() => {
    const q = (filter || "").trim().toLowerCase();
    if (!q) return items;
    return items.filter((it) => {
      try { return (it.name || it.type || "").toLowerCase().includes(q); } catch (e) { return true; }
    });
  }, [items, filter]);

  return (
    <div className={`outliner-root ${className}`} style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", ...style }}>
      <div style={{ padding: 8, borderBottom: "1px solid rgba(255,255,255,0.04)", display: "flex", gap: 8, alignItems: "center" }}>
        <div style={{ fontWeight: 700 }}>Outliner</div>
        <div style={{ flex: 1 }} />
        <input
          placeholder="Filter..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          style={{ padding: 6, minWidth: 120, borderRadius: 6, border: "1px solid rgba(255,255,255,0.04)", background: "transparent", color: "inherit" }}
        />
      </div>

      <div role="tree" style={{ padding: 8, overflowY: "auto", flex: 1 }}>
        {filtered.length === 0 && <div style={{ color: "var(--text-muted)", padding: 8 }}>No objects</div>}
        {filtered.map((it) => (
          <OutlinerItem
            key={it.uuid}
            obj={it}
            depth={0}
            selectedId={selectedId}
            onSelect={handleSelect}
            onRename={handleRename}
            onDelete={(o) => { if (confirm(`Delete '${o.name || o.type}'?`)) handleDelete(o); }}
            onToggleVisibility={handleToggleVisibility}
          />
        ))}
      </div>
    </div>
  );
}
