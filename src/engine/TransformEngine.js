// engine/TransformEngine.js
import EventBus from "../utils/EventBus.js";
import { SceneGraphStore } from "../store/SceneGraphStore.js";

export class TransformEngine {
  static applyTransform(id, transform) {
    const obj = SceneGraphStore.objects[id];
    if (!obj) return;

    // Apply Three.js transform
    Object.assign(obj.object.position, transform.position || {});
    Object.assign(obj.object.rotation, transform.rotation || {});
    Object.assign(obj.object.scale, transform.scale || {});

    EventBus.emit("transform:applied", { id, transform });
  }
}
