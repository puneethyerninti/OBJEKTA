// src/engine/HistoryEngine.js
import { SceneGraphStore } from "../store/SceneGraphStore";
import EventBus from "../utils/EventBus";

export const HistoryEngine = {
  undoStack: [],
  redoStack: [],
  maxHistory: 50, // limit memory usage

  /**
   * Capture current scene state
   */
  snapshot(action = "update") {
    const snapshot = JSON.stringify(SceneGraphStore.objects);

    this.undoStack.push({
      state: snapshot,
      action,
    });

    if (this.undoStack.length > this.maxHistory) {
      this.undoStack.shift();
    }

    // Clear redo stack when a new action occurs
    this.redoStack = [];
  },

  /**
   * Undo last action
   */
  undo() {
    if (this.undoStack.length === 0) return;

    const last = this.undoStack.pop();
    this.redoStack.push(last);

    const prev = this.undoStack[this.undoStack.length - 1];
    if (prev) {
      this._restore(prev.state);
    } else {
      this._restore("{}"); // empty scene
    }

    EventBus.emit("history:undo", { action: last.action });
  },

  /**
   * Redo undone action
   */
  redo() {
    if (this.redoStack.length === 0) return;

    const next = this.redoStack.pop();
    this.undoStack.push(next);

    this._restore(next.state);
    EventBus.emit("history:redo", { action: next.action });
  },

  /**
   * Restore SceneGraphStore from snapshot
   */
  _restore(stateJSON) {
    try {
      const state = JSON.parse(stateJSON);

      // reset scene
      SceneGraphStore.objects = {};
      SceneGraphStore.selected = null;

      // rebuild scene
      Object.entries(state).forEach(([id, { object, metadata }]) => {
        SceneGraphStore.objects[id] = {
          object, // may need deep clone in future
          metadata,
        };
      });

      SceneGraphStore.bump();
    } catch (err) {
      console.error("History restore failed:", err);
    }
  },
};
