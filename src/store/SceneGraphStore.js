// src/store/SceneGraphStore.js
import EventBus from "../utils/EventBus";

export const SceneGraphStore = {
  objects: {}, // id -> { object, metadata }
  selected: [], // array of ids (supports multi-selection)
  version: 0,

  /* -------------------- Core Object Ops -------------------- */
  addObject(id, object, metadata = {}) {
    this.objects[id] = { object, metadata };
    this.version++;
    EventBus.emit("scene:updated", { id, type: "add" });
  },

  removeObject(id) {
    delete this.objects[id];
    // remove from selection if present
    this.selected = this.selected.filter(selId => selId !== id);
    this.version++;
    EventBus.emit("scene:updated", { id, type: "remove" });
  },

  renameObject(id, name) {
    if (this.objects[id]) {
      this.objects[id].metadata.name = name;
      if (this.objects[id].object) this.objects[id].object.name = name;
      this.version++;
      EventBus.emit("scene:updated", { id, type: "rename" });
    }
  },

  /* -------------------- Selection Ops -------------------- */
  selectObject(id) {
    this.selected = id ? [id] : [];
    this.version++;
    EventBus.emit("object:selected", { id });
    EventBus.emit("objects:selected", [...this.selected]);
  },

  selectObjects(ids = []) {
    this.selected = Array.isArray(ids) ? [...ids] : [];
    this.version++;
    EventBus.emit("objects:selected", [...this.selected]);
  },

  toggleObjectSelection(id) {
    if (!id) return;
    if (this.selected.includes(id)) {
      this.selected = this.selected.filter(selId => selId !== id);
    } else {
      this.selected.push(id);
    }
    this.version++;
    EventBus.emit("objects:selected", [...this.selected]);
  },

  clearSelection() {
    this.selected = [];
    this.version++;
    EventBus.emit("objects:selected", []);
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
    const parent = this.objects[newParentId]?.object;
    if (!child || !parent) return;

    try {
      // remove from old parent
      if (child.parent) child.parent.remove(child);
      // add to new parent
      parent.add(child);

      this.version++;
      EventBus.emit("scene:updated", {
        type: "reparent",
        childId,
        newParentId,
      });
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
  }
};
