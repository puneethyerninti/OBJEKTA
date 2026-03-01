// src/components/workspace/HistoryManager.js
// Command-pattern undo/redo manager extracted from Workspace.jsx
// so it can be unit-tested independently.

/**
 * Minimal command object used by HistoryManager.
 */
export class Cmd {
  /**
   * @param {() => void} redoFn  – execute / redo action
   * @param {() => void} undoFn  – undo action
   * @param {string}     [label] – human-readable label for debug
   */
  constructor(redoFn, undoFn, label = "") {
    this.redo  = redoFn;
    this.undo  = undoFn;
    this.label = label;
  }
}

/**
 * Stack-based undo/redo manager with a configurable depth limit.
 */
export class HistoryManager {
  /**
   * @param {number} limit  – max number of commands to keep
   * @param {() => void} [onMutate] – optional callback fired after undo/redo
   */
  constructor(limit = 200, onMutate = null) {
    this.limit    = limit;
    this.stack    = [];
    this.index    = -1;
    this._onMutate = onMutate;
  }

  /** Push a new command, discarding any redo history. */
  push(cmd) {
    this.stack.splice(this.index + 1);
    this.stack.push(cmd);
    if (this.stack.length > this.limit) this.stack.shift();
    this.index = this.stack.length - 1;
  }

  /** Undo the last command if possible. */
  undo() {
    if (this.index < 0) return;
    try { this.stack[this.index].undo(); } catch (e) { console.warn("Undo failed", e); }
    this.index--;
    if (this._onMutate) this._onMutate("undo");
  }

  /** Redo the next command if possible. */
  redo() {
    if (this.index >= this.stack.length - 1) return;
    this.index++;
    try { this.stack[this.index].redo(); } catch (e) { console.warn("Redo failed", e); }
    if (this._onMutate) this._onMutate("redo");
  }

  /** Clear all history. */
  clear() {
    this.stack = [];
    this.index = -1;
  }

  /** Number of commands in the stack. */
  get length() {
    return this.stack.length;
  }

  /** Whether an undo operation is available. */
  get canUndo() {
    return this.index >= 0;
  }

  /** Whether a redo operation is available. */
  get canRedo() {
    return this.index < this.stack.length - 1;
  }
}
