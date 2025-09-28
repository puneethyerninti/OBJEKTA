// src/engine/commands/TransformCommand.js
import { SceneGraphStore } from "../../store/SceneGraphStore";
import * as THREE from "three";

/**
 * TransformCommand: captures before/after transforms for one or more objects.
 * before/after maps: { uuid: { position: [x,y,z], rotation: [x,y,z], scale: [x,y,z] } }
 */
export default class TransformCommand {
  constructor(ids = [], before = {}, after = {}) {
    this.ids = Array.isArray(ids) ? ids : Object.keys(after || {});
    this.before = before || {};
    this.after = after || {};
    this.label = "transform";
  }

  do() {
    this._apply(this.after);
  }

  undo() {
    this._apply(this.before);
  }

  _apply(map) {
    try {
      this.ids.forEach((id) => {
        const rec = SceneGraphStore.objects?.[id]?.object;
        if (!rec) return;
        const s = map[id];
        if (!s) return;
        try {
          if (s.position && rec.position) rec.position.set(s.position[0], s.position[1], s.position[2]);
          if (s.rotation && rec.rotation) rec.rotation.set(s.rotation[0], s.rotation[1], s.rotation[2]);
          if (s.scale && rec.scale) rec.scale.set(s.scale[0], s.scale[1], s.scale[2]);
          rec.updateMatrixWorld(true);
        } catch (e) { console.warn("TransformCommand apply error", e); }
      });
      // emit scene update so UI reacts (EventBus is optional)
      try { const EB = require("../../utils/EventBus").default; EB?.emit?.("scene:updated", { type: "transform-command" }); } catch (e) {}
    } catch (e) { console.warn("TransformCommand _apply failed", e); }
  }
}
