// src/components/Outliner.jsx
import React, { useCallback, useEffect, useRef, useState, useMemo } from "react";
import EventBus from "../utils/EventBus";
import { SceneGraphStore } from "../store/SceneGraphStore";
import * as THREE from "three";
import "../styles/Outliner.css";

/**
 * Outliner — improved syncing and UX.
 *
 * Key features:
 * - Prefer workspaceRef (if provided) to fetch scene & objects.
 * - Listen to EventBus "scene:updated" and "object:selected" events.
 * - Build a hierarchical tree from the user-group children.
 * - Scroll selected item into view and support keyboard navigation.
 */

const isUserObject = (o) => {
  if (!o) return false;
  try {
    if (typeof o.userData?.__objekta !== "undefined") return !!o.userData.__objekta;
    if (typeof o.name === "string" && o.name.startsWith("_")) return false;
  } catch (e) {}
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

const OutlinerItem = React.memo(function OutlinerItem({
  obj,
  depth = 0,
  selectedIds = [],
  dragOverId = null,
  onSelect,
  onRename,
  onDelete,
  onToggleVisibility,
  onDropItem,
  onDragEnter,
  onDragLeave,
}) {
  const [open, setOpen] = useState(true);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(obj?.name || "");
  const itemRef = useRef(null);

  useEffect(() => { setName(obj?.name || ""); }, [obj?.name]);

  const children = useMemo(() => (Array.isArray(obj?.children) ? obj.children.filter((c) => isUserObject(c)) : []), [obj]);
  const hasChildren = children.length > 0;
  const isSelected = selectedIds.includes(obj?.uuid);
  const isDragOver = dragOverId === obj?.uuid;

  // Scroll into view when selected
  useEffect(() => {
    if (isSelected && itemRef.current) {
      try { itemRef.current.scrollIntoView({ block: "nearest", behavior: "smooth", inline: "nearest" }); } catch (e) {}
    }
  }, [isSelected]);

  const handlePrimaryClick = useCallback((e) => {
    e?.stopPropagation();
    if (!obj) return;
    const isMulti = !!(e?.ctrlKey || e?.metaKey);
    onSelect?.(obj, { multi: isMulti });
  }, [obj, onSelect]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onSelect?.(obj, { multi: e.ctrlKey || e.metaKey });
    } else if (e.key === "F2") {
      e.preventDefault(); setEditing(true);
    } else if (e.key === "Delete") {
      e.preventDefault(); if (confirm(`Delete '${obj.name || obj.type}'?`)) onDelete?.(obj);
    } else if (e.key === "ArrowRight" && hasChildren && !open) {
      e.preventDefault(); setOpen(true);
    } else if (e.key === "ArrowLeft" && hasChildren && open) {
      e.preventDefault(); setOpen(false);
    }
  }, [obj, onSelect, onDelete, hasChildren, open]);

  const handleRenameBlur = useCallback(() => {
    setEditing(false);
    const newName = (name || "").trim();
    if (newName && newName !== (obj?.name || "")) {
      onRename?.(obj, newName);
    } else setName(obj?.name || "");
  }, [name, obj, onRename]);

  // Drag & Drop handlers
  const handleDragStart = useCallback((e) => {
    e.stopPropagation();
    try { e.dataTransfer.setData('text/plain', obj.uuid); e.dataTransfer.effectAllowed = 'move'; } catch (err) {}
  }, [obj]);

  const handleDragOver = useCallback((e) => {
    e.preventDefault(); e.stopPropagation();
    try { e.dataTransfer.dropEffect = 'move'; } catch (err) {}
    onDragEnter?.(obj?.uuid);
  }, [onDragEnter, obj]);

  const handleDragLeave = useCallback((e) => { e.preventDefault(); e.stopPropagation(); onDragLeave?.(obj?.uuid); }, [onDragLeave, obj]);

  const handleDrop = useCallback((e) => {
    e.preventDefault(); e.stopPropagation();
    try {
      const dragged = e.dataTransfer.getData('text/plain');
      if (dragged) onDropItem?.(dragged, obj?.uuid);
    } catch (err) {}
  }, [onDropItem, obj]);

  return (
    <div
      ref={itemRef}
      className={`outliner-item ${isDragOver ? 'drag-over' : ''} ${isSelected ? 'selected' : ''}`}
      role="treeitem"
      aria-expanded={hasChildren ? open : undefined}
      aria-selected={isSelected}
      style={{ ['--depth']: depth }}
      onKeyDown={handleKeyDown}
      draggable
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="outliner-row">
        {hasChildren ? (
          <button type="button" aria-label={open ? "collapse" : "expand"} onClick={(ev) => { ev.stopPropagation(); setOpen((v) => !v); }} className="icon-btn toggle-btn">{open ? "▾" : "▸"}</button>
        ) : (<div className="toggle-placeholder" />)}

        <div role="button" tabIndex={0} onClick={handlePrimaryClick} onDoubleClick={() => onSelect?.(obj, { multi: false })} className="outliner-content" >
          {editing ? (
            <input
              className="outliner-edit-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={handleRenameBlur}
              onKeyDown={(e) => { if (e.key === 'Enter') handleRenameBlur(); if (e.key === 'Escape') { setEditing(false); setName(obj?.name || ''); } }}
              autoFocus
            />
          ) : (
            <div className="outliner-label-wrap">
              <div className="outliner-label" title={obj?.name || obj?.type || 'object'}>{obj?.name || obj?.type || 'object'}</div>
              <div className="outliner-sub" aria-hidden>{obj?.type === 'Group' ? '' : ''}</div>
            </div>
          )}
        </div>

        <button type="button" className="icon-btn" title="Rename (F2)" onClick={(e) => { e.stopPropagation(); setEditing(true); }}>✎</button>
        <button type="button" className="icon-btn" title={obj?.visible ? "Hide" : "Show"} onClick={(e) => { e.stopPropagation(); onToggleVisibility?.(obj); }} aria-pressed={!!obj?.visible}>{obj?.visible ? '👁' : '🚫'}</button>
        <button type="button" className="icon-btn" title="Delete" onClick={(e) => { e.stopPropagation(); if (confirm(`Delete '${obj?.name || obj?.type}'?`)) onDelete?.(obj); }}>🗑</button>
      </div>

      {hasChildren && open && (
        <div role="group" className="outliner-children">
          {children.map((c) => (
            <OutlinerItem
              key={c.uuid}
              obj={c}
              depth={depth + 1}
              selectedIds={selectedIds}
              dragOverId={dragOverId}
              onSelect={onSelect}
              onRename={onRename}
              onDelete={onDelete}
              onToggleVisibility={onToggleVisibility}
              onDropItem={onDropItem}
              onDragEnter={onDragEnter}
              onDragLeave={onDragLeave}
            />
          ))}
        </div>
      )}
    </div>
  );
});

export default function Outliner({ workspaceRef = null, onSelect: onSelectProp = null, className = "", style = {} }) {
  const [items, setItems] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [filter, setFilter] = useState("");
  const [dragOverId, setDragOverId] = useState(null);
  const mountedRef = useRef(true);

  // Build tree from scene / store / workspace
  const buildTree = useCallback(() => {
    try {
      // prefer SceneGraphStore.getObjects if available (flattened)
      if (SceneGraphStore && typeof SceneGraphStore.getObjects === "function") {
        const objs = SceneGraphStore.getObjects() || [];
        if (Array.isArray(objs)) return objs.filter((o) => isUserObject(o));
      }

      // prefer workspaceRef / global workspace
      const globalWs = workspaceRef?.current ?? window.__OBJEKTA_WORKSPACE ?? null;
      if (globalWs) {
        if (typeof globalWs.getSceneObjects === "function") {
          const list = globalWs.getSceneObjects() || [];
          return list.filter((o) => isUserObject(o));
        }
        const scene = typeof globalWs.getScene === "function" ? globalWs.getScene() : (globalWs.scene || null);
        if (scene) {
          const ug = scene._user_group ?? scene._userGroup ?? null;
          if (ug) return Array.from(ug.children).filter((o) => isUserObject(o));
          // fallback to top-level scene children
          return Array.from(scene.children).filter((o) => isUserObject(o));
        }
      }

      // fallback to SceneGraphStore.objects map
      if (SceneGraphStore && SceneGraphStore.objects && typeof SceneGraphStore.objects === "object") {
        return Object.values(SceneGraphStore.objects).map((x) => x.object).filter((o) => isUserObject(o));
      }
    } catch (e) {
      console.warn("Outliner.buildTree fallback failed", e);
    }
    return [];
  }, [workspaceRef]);

  const refresh = useCallback(() => {
    if (!mountedRef.current) return;
    try {
      const list = buildTree();
      list.sort((a, b) => String((a.name || a.type || "")).localeCompare(String((b.name || b.type || ""))));
      setItems(list);

      // update selection from store if provided
      try {
        if (SceneGraphStore && typeof SceneGraphStore.getSelected === "function") {
          const sel = SceneGraphStore.getSelected();
          if (sel) { setSelectedId(sel); setSelectedIds([sel]); }
        } else if (SceneGraphStore && typeof SceneGraphStore.selected !== "undefined") {
          const sel = SceneGraphStore.selected || null;
          if (sel) { setSelectedId(sel); setSelectedIds([sel]); }
        }
      } catch (e) {}
    } catch (e) {
      console.warn("Outliner: refresh failed", e);
    }
  }, [buildTree]);

  useEffect(() => {
    mountedRef.current = true;
    refresh();

    const onSceneUpdated = () => refresh();
    const onObjectSelected = (payload) => {
      const id = typeof payload === "string" ? payload : payload?.id ?? payload?.uuid ?? payload;
      if (!id) return;
      setSelectedIds([id]); setSelectedId(id);
    };

    try { EventBus?.on?.("scene:updated", onSceneUpdated); } catch (e) {}
    try { EventBus?.on?.("object:selected", onObjectSelected); } catch (e) {}

    // If the host workspace doesn't emit events often, ensure periodic refresh as a fallback
    const iv = setInterval(() => {
      try { refresh(); } catch (e) {}
    }, 1500);

    return () => {
      mountedRef.current = false;
      try { EventBus?.off?.("scene:updated", onSceneUpdated); } catch (e) {}
      try { EventBus?.off?.("object:selected", onObjectSelected); } catch (e) {}
      clearInterval(iv);
    };
  }, [refresh]);

  const findObjectByUUID = useCallback((uuid) => {
    try {
      // workspace-first
      const globalWs = workspaceRef?.current ?? window.__OBJEKTA_WORKSPACE ?? null;
      if (globalWs) {
        try {
          const scene = typeof globalWs.getScene === "function" ? globalWs.getScene() : (globalWs.scene || null);
          if (scene) return scene.getObjectByProperty('uuid', uuid);
          if (typeof globalWs.getSceneObjects === 'function') {
            const arr = globalWs.getSceneObjects() || [];
            const flat = [];
            const pushChildren = (o) => {
              if (!o) return;
              flat.push(o);
              if (Array.isArray(o.children)) o.children.forEach(pushChildren);
            };
            arr.forEach(pushChildren);
            return flat.find((o) => o.uuid === uuid) || null;
          }
        } catch (e) {}
      }

      // SceneGraphStore fallback
      if (SceneGraphStore && SceneGraphStore.objects && typeof SceneGraphStore.objects === "object") {
        const rec = SceneGraphStore.objects[uuid];
        return rec ? rec.object : null;
      }
    } catch (e) {}
    return null;
  }, [workspaceRef]);

  const handleSelect = useCallback((obj, opts = {}) => {
    if (!obj) return;
    const id = obj.uuid;
    const multi = !!opts.multi;
    setSelectedId(id);
    setSelectedIds((prev) => {
      if (multi) {
        const exists = prev.includes(id);
        const next = exists ? prev.filter((x) => x !== id) : [...prev, id];
        try { EventBus?.emit?.('objects:selected', next); } catch (e) {}
        return next;
      }
      try { EventBus?.emit?.('object:selected', id); } catch (e) {}
      try { EventBus?.emit?.('objects:selected', [id]); } catch (e) {}
      return [id];
    });

    // store selection if API is present
    try {
      if (SceneGraphStore && typeof SceneGraphStore.selectObject === "function") SceneGraphStore.selectObject(id);
      else if (SceneGraphStore && typeof SceneGraphStore.setSelected === "function") SceneGraphStore.setSelected(id);
    } catch (e) {}

    // try workspace selection API
    try { if (workspaceRef && workspaceRef.current && typeof workspaceRef.current.selectObject === "function") workspaceRef.current.selectObject(obj); } catch (e) {}
    try { onSelectProp?.(obj); } catch (e) {}
  }, [workspaceRef, onSelectProp]);

  const handleRename = useCallback((obj, newName) => {
    if (!obj) return;
    try {
      if (SceneGraphStore && typeof SceneGraphStore.renameObject === "function") {
        SceneGraphStore.renameObject(obj.uuid, newName);
        EventBus?.emit?.('scene:updated');
        return;
      }
    } catch (e) {}
    try { obj.name = newName; EventBus?.emit?.('scene:updated'); } catch (e) { console.warn('Outliner: rename fallback failed', e); }
  }, []);

  const handleDelete = useCallback((obj) => {
    if (!obj) return;
    try {
      if (SceneGraphStore && typeof SceneGraphStore.removeObject === "function") {
        SceneGraphStore.removeObject(obj.uuid);
        EventBus?.emit?.('scene:updated');
        return;
      }
    } catch (e) {}

    try {
      if (workspaceRef && workspaceRef.current && typeof workspaceRef.current.deleteSelected === "function") {
        if (typeof workspaceRef.current.selectObject === "function") workspaceRef.current.selectObject(obj);
        workspaceRef.current.deleteSelected();
        EventBus?.emit?.('scene:updated');
        return;
      }
    } catch (e) {}

    try { disposeObjectSimple(obj); if (obj.parent) obj.parent.remove(obj); EventBus?.emit?.('scene:updated'); } catch (e) { console.warn('Outliner: delete fallback failed', e); }
  }, [workspaceRef]);

  const handleToggleVisibility = useCallback((obj) => {
    if (!obj) return;
    try { obj.visible = !obj.visible; EventBus?.emit?.('scene:updated'); } catch (e) { console.warn('Outliner: toggle visibility failed', e); }
  }, []);

  const handleDropItem = useCallback((draggedId, targetId) => {
    if (!draggedId) return;
    try {
      if (SceneGraphStore && typeof SceneGraphStore.reparentObject === 'function') {
        SceneGraphStore.reparentObject(draggedId, targetId || null);
        EventBus?.emit?.('scene:updated');
        setDragOverId(null);
        refresh();
        return;
      }
    } catch (e) {}

    try {
      const child = findObjectByUUID(draggedId);
      const parent = targetId ? findObjectByUUID(targetId) : null;
      if (!child) return;
      // prevent parenting into self/descendant
      let p = parent;
      while (p) {
        if (p.uuid === child.uuid) {
          console.warn('Cannot parent object into its own descendant');
          return;
        }
        p = p.parent;
      }
      if (child.parent) child.parent.remove(child);
      if (parent) parent.add(child);
      else {
        const globalWs = workspaceRef?.current ?? window.__OBJEKTA_WORKSPACE ?? null;
        const scene = globalWs?.getScene?.() ?? globalWs?.scene ?? null;
        const userGroup = scene?._user_group ?? scene?._userGroup ?? null;
        if (userGroup) userGroup.add(child);
        else if (scene) scene.add(child);
      }
      EventBus?.emit?.('scene:updated');
      setDragOverId(null);
      refresh();
    } catch (e) { console.warn('Outliner: drop fallback failed', e); }
  }, [findObjectByUUID, refresh, workspaceRef]);

  const handleDragEnter = useCallback((uuid) => { setDragOverId(uuid); }, []);
  const handleDragLeave = useCallback((uuid) => { setDragOverId((cur) => (cur === uuid ? null : cur)); }, []);

  const filtered = useMemo(() => {
    const q = (filter || "").trim().toLowerCase();
    if (!q) return items;
    return items.filter((it) => {
      try { return (it.name || it.type || "").toLowerCase().includes(q); } catch (e) { return true; }
    });
  }, [items, filter]);

  return (
    <div className={`outliner-root ${className}`} style={{ ...style }}>
      <div className="outliner-header">
        <div className="outliner-title">Outliner</div>
        <div className="outliner-spacer" />
        <input className="outliner-filter" placeholder="Filter..." value={filter} onChange={(e) => setFilter(e.target.value)} />
      </div>

      <div role="tree" className="outliner-tree">
        {filtered.length === 0 && <div className="outliner-empty">No objects</div>}
        {filtered.map((it) => (
          <OutlinerItem
            key={it.uuid}
            obj={it}
            depth={0}
            selectedIds={selectedIds}
            dragOverId={dragOverId}
            onSelect={handleSelect}
            onRename={handleRename}
            onDelete={(o) => { if (confirm(`Delete '${o.name || o.type}'?`)) handleDelete(o); }}
            onToggleVisibility={handleToggleVisibility}
            onDropItem={handleDropItem}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
          />
        ))}
      </div>
    </div>
  );
}
