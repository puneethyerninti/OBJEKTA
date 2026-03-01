// src/store/SceneGraphStore.js
import EventBus from "../utils/EventBus";

export const SceneGraphStore = {
  objects: {}, // id -> { object, metadata }
  selected: [], // array of ids (supports multi-selection)
  version: 0,
  _listeners: new Set(),

  /* -------------------- Subscription mechanism -------------------- */
  /** Subscribe to store changes. Returns an unsubscribe function. */
  subscribe(listener) {
    if (typeof listener === "function") this._listeners.add(listener);
    return () => this._listeners.delete(listener);
  },

  /** Notify all subscribers that the store changed. */
  _notify(detail) {
    for (const fn of this._listeners) {
      try { fn(this.version, detail); } catch (e) { /* swallow per-listener errors */ }
    }
  },

  /* -------------------- Core Object Ops -------------------- */
  addObject(id, object, metadata = {}) {
    this.objects[id] = { object, metadata };
    this.version++;
    EventBus.emit("scene:updated", { id, type: "add" });
    this._notify({ id, type: "add" });
  },

  removeObject(id) {
    delete this.objects[id];
    // remove from selection if present
    this.selected = this.selected.filter(selId => selId !== id);
    this.version++;
    EventBus.emit("scene:updated", { id, type: "remove" });
    this._notify({ id, type: "remove" });
  },

  renameObject(id, name) {
    if (this.objects[id]) {
      this.objects[id].metadata.name = name;
      if (this.objects[id].object) this.objects[id].object.name = name;
      this.version++;
      EventBus.emit("scene:updated", { id, type: "rename" });
      this._notify({ id, type: "rename" });
    }
  },

  /* -------------------- Selection Ops -------------------- */
  selectObject(id) {
    this.selected = id ? [id] : [];
    this.version++;
    EventBus.emit("object:selected", { id });
    EventBus.emit("objects:selected", [...this.selected]);
    this._notify({ type: "select" });
  },

  selectObjects(ids = []) {
    this.selected = Array.isArray(ids) ? [...ids] : [];
    this.version++;
    EventBus.emit("objects:selected", [...this.selected]);
    this._notify({ type: "select" });
  },

  toggleObjectSelection(id) {
    if (!id) return;
    if (this.selected.includes(id)) {
      this.selected = this.selected.filter(selId => selId !== id);
    } else {
      // Create a new array instead of mutating in-place
      this.selected = [...this.selected, id];
    }
    this.version++;
    EventBus.emit("objects:selected", [...this.selected]);
    this._notify({ type: "select" });
  },

  clearSelection() {
    this.selected = [];
    this.version++;
    EventBus.emit("objects:selected", []);
    this._notify({ type: "select" });
  },

  getSelected() {
    // returns array of objects (not just ids)
    return this.selected.map(id => this.objects[id]?.object).filter(Boolean);
  },

  getSelectedIds() {
    return [...this.selected];
  },

  /* -------------------- Reparenting -------------------- */
  reparentObject(childId, newParentId) {
    const child = this.objects[childId]?.object;
    // When newParentId is null/undefined, reparent to scene root (handled by caller)
    const parent = newParentId ? this.objects[newParentId]?.object : null;
    if (!child) {
      console.warn("SceneGraphStore.reparentObject: child not found", childId);
      return;
    }
    if (newParentId && !parent) {
      console.warn("SceneGraphStore.reparentObject: parent not found", newParentId);
      return;
    }
    if (newParentId && String(childId) === String(newParentId)) {
      console.warn("SceneGraphStore.reparentObject: cannot parent object to itself", childId);
      return;
    }

    // Prevent invalid cycle: child cannot be parented into its own descendant chain
    try {
      let p = parent;
      while (p) {
        if (p === child) {
          console.warn("SceneGraphStore.reparentObject: invalid cycle", { childId, newParentId });
          return;
        }
        p = p.parent;
      }
    } catch (e) {}

    try {
      // remove from old parent
      if (child.parent) child.parent.remove(child);
      // add to new parent (or leave detached for caller to handle root)
      if (parent) parent.add(child);

      this.version++;
      EventBus.emit("scene:updated", {
        type: "reparent",
        childId,
        newParentId,
      });
      this._notify({ type: "reparent", childId, newParentId });
    } catch (e) {
      console.warn("SceneGraphStore: reparent failed", e);
    }
  },

  /* -------------------- Utility -------------------- */
  getObjects() {
    return Object.values(this.objects).map(o => o.object);
  },

  bump() {
    this.version++;
    EventBus.emit("scene:updated", {});
    this._notify({ type: "bump" });
  }
};
