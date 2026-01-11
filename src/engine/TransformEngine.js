// src/engine/TransformEngine.js
import EventBus from "../utils/EventBus.js";
import { SceneGraphStore } from "../store/SceneGraphStore.js";
import { HistoryEngine } from "./HistoryEngine.js";

export class TransformEngine {
  /**
   * Apply transforms (position, rotation, scale) to an object
   * @param {string} id - Object ID
   * @param {Object} transform - { position, rotation, scale }
   * @param {boolean} recordHistory - Whether to snapshot for undo/redo
   */
  static applyTransform(id, transform, recordHistory = true) {
    const obj = SceneGraphStore.objects[id];
    if (!obj || !obj.object) return;

    const { position, rotation, scale } = transform;

    // Update position
    if (position) {
      if (position.x !== undefined) obj.object.position.x = position.x;
      if (position.y !== undefined) obj.object.position.y = position.y;
      if (position.z !== undefined) obj.object.position.z = position.z;
    }

    // Update rotation
    if (rotation) {
      if (rotation.x !== undefined) obj.object.rotation.x = rotation.x;
      if (rotation.y !== undefined) obj.object.rotation.y = rotation.y;
      if (rotation.z !== undefined) obj.object.rotation.z = rotation.z;
    }

    // Update scale
    if (scale) {
      if (scale.x !== undefined) obj.object.scale.x = scale.x;
      if (scale.y !== undefined) obj.object.scale.y = scale.y;
      if (scale.z !== undefined) obj.object.scale.z = scale.z;
    }

    if (recordHistory) {
      HistoryEngine.snapshot("transform");
    }

    EventBus.emit("transform:applied", { id, transform });
    SceneGraphStore.bump();
  }

  /**
   * Reset transform of an object to defaults
   */
  static resetTransform(id, recordHistory = true) {
    const obj = SceneGraphStore.objects[id];
    if (!obj || !obj.object) return;

    obj.object.position.set(0, 0, 0);
    obj.object.rotation.set(0, 0, 0);
    obj.object.scale.set(1, 1, 1);

    if (recordHistory) {
      HistoryEngine.snapshot("reset-transform");
    }

    EventBus.emit("transform:reset", { id });
    SceneGraphStore.bump();
  }

  /**
   * Get the current transform of an object
   */
  static getTransform(id) {
    const obj = SceneGraphStore.objects[id];
    if (!obj || !obj.object) return null;

    return {
      position: { ...obj.object.position },
      rotation: { ...obj.object.rotation },
      scale: { ...obj.object.scale },
    };
  }
}
