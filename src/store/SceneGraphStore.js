// src/store/SceneGraphStore.js
import EventBus from "../utils/EventBus";

export const SceneGraphStore = {
  objects: {}, // id -> { object, metadata }
  selected: null,
  version: 0,

  addObject(id, object, metadata = {}) {
    this.objects[id] = { object, metadata };
    this.version++;
    EventBus.emit("scene:updated", { id, type: "add" });
  },

  removeObject(id) {
    delete this.objects[id];
    if (this.selected === id) this.selected = null;
    this.version++;
    EventBus.emit("scene:updated", { id, type: "remove" });
  },

  selectObject(id) {
    this.selected = id;
    this.version++;
    EventBus.emit("object:selected", { id });
  },

  renameObject(id, name) {
    if (this.objects[id]) {
      this.objects[id].metadata.name = name;
      if (this.objects[id].object) this.objects[id].object.name = name;
      this.version++;
      EventBus.emit("scene:updated", { id, type: "rename" });
    }
  },

  getObjects() {
    return Object.values(this.objects).map(o => o.object);
  },

  bump() {
    this.version++;
    EventBus.emit("scene:updated", { });
  }
};
