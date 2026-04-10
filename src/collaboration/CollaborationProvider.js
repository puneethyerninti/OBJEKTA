// src/collaboration/CollaborationProvider.js
// Manages the Yjs Y.Doc, WebSocket provider, and awareness protocol
// for real-time CRDT-based scene collaboration.

import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { Awareness } from 'y-protocols/awareness';

/**
 * Y.Doc Schema:
 *
 * ydoc.getMap('objects')     — Y.Map<objectId, Y.Map>
 *   Each object entry is a Y.Map with keys:
 *     uuid, type, name, position (Y.Array[3]),
 *     rotation (Y.Array[3]), scale (Y.Array[3]),
 *     material (Y.Map), visible, locked, lockedBy
 *
 * ydoc.getMap('scene')       — Y.Map
 *   environmentMap, environmentColor, fogEnabled, fogColor, fogDensity, gridVisible
 *
 * ydoc.getMap('meta')        — Y.Map
 *   projectId, title, lastSavedAt
 *
 * awareness.setLocalStateField('user', { id, name, color, cursor, selectedObjects })
 */

const USER_COLORS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4',
  '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F',
  '#BB8FCE', '#85C1E9', '#F0B27A', '#82E0AA',
];

export class CollaborationProvider {
  constructor() {
    /** @type {Y.Doc | null} */
    this.doc = null;
    /** @type {WebsocketProvider | null} */
    this.wsProvider = null;
    /** @type {string | null} */
    this.projectId = null;
    /** @type {string | null} */
    this.authToken = null;
    /** @type {Function[]} */
    this._listeners = [];
    /** @type {'disconnected' | 'connecting' | 'connected'} */
    this.status = 'disconnected';
    this._statusListeners = new Set();
    this._objectChangeListeners = new Set();
    this._awarenessListeners = new Set();
  }

  /**
   * Connect to a project's Y.Doc via the Yjs WebSocket server.
   * @param {string} projectId
   * @param {{ id: string, name: string }} user - Current user info
   * @param {string} [wsUrl] - WebSocket base URL (auto-detected if omitted)
   * @param {string} [authToken] - Access token for authenticated websocket upgrades
   */
  connect(projectId, user, wsUrl, authToken) {
    const normalizedToken = authToken || null;
    if (this.projectId === projectId && this.wsProvider && this.authToken === normalizedToken) return;
    this.disconnect();

    this.projectId = projectId;
    this.authToken = normalizedToken;
    this.doc = new Y.Doc();

    // Derive WebSocket URL
    if (!wsUrl) {
      const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.hostname;
      const port = import.meta.env?.VITE_BACKEND_PORT || '5000';
      wsUrl = `${proto}//${host}:${port}`;
    }
    // y-websocket appends the room name as a path segment to the server URL,
    // so we use /yjs as server URL and the projectId as room name.
    // This produces ws://host:port/yjs/<projectId> which the backend expects.
    const fullUrl = `${wsUrl}/yjs`;

    this.wsProvider = new WebsocketProvider(fullUrl, projectId, this.doc, {
      connect: true,
      awareness: new Awareness(this.doc),
      resyncInterval: 5000,
      maxBackoffTime: 10000,
      params: normalizedToken ? { token: normalizedToken } : undefined,
    });

    // Set local awareness state
    const colorIndex = Math.abs(hashCode(user.id || 'anon')) % USER_COLORS.length;
    this.wsProvider.awareness.setLocalStateField('user', {
      id: user.id,
      name: user.name || 'Anonymous',
      color: USER_COLORS[colorIndex],
      cursor: null,
      selectedObjects: [],
    });

    // Track connection status
    this.wsProvider.on('status', ({ status }) => {
      this.status = status;
      this._statusListeners.forEach(fn => fn(status));
    });

    // Listen for awareness changes
    this.wsProvider.awareness.on('change', (changes) => {
      this._awarenessListeners.forEach(fn => fn(changes, this.wsProvider.awareness));
    });

    // Listen for Y.Map('objects') changes
    const objectsMap = this.doc.getMap('objects');
    const objectObserver = (event) => {
      this._objectChangeListeners.forEach(fn => fn(event, objectsMap));
    };
    objectsMap.observe(objectObserver);
    this._listeners.push(() => objectsMap.unobserve(objectObserver));

    // Deep-observe for property changes on individual objects
    const objectDeepObserver = (events) => {
      this._objectChangeListeners.forEach(fn => fn(events, objectsMap));
    };
    objectsMap.observeDeep(objectDeepObserver);
    this._listeners.push(() => objectsMap.unobserveDeep(objectDeepObserver));
  }

  /**
   * Disconnect from the current project
   */
  disconnect() {
    this._listeners.forEach(fn => fn());
    this._listeners = [];
    if (this.wsProvider) {
      this.wsProvider.disconnect();
      this.wsProvider.destroy();
      this.wsProvider = null;
    }
    if (this.doc) {
      this.doc.destroy();
      this.doc = null;
    }
    this.projectId = null;
    this.authToken = null;
    this.status = 'disconnected';
    this._statusListeners.forEach(fn => fn('disconnected'));
  }

  // -- Y.Doc accessors --

  /** @returns {Y.Map} objects map */
  getObjectsMap() {
    return this.doc?.getMap('objects') || null;
  }

  /** @returns {Y.Map} scene settings map */
  getSceneMap() {
    return this.doc?.getMap('scene') || null;
  }

  /** @returns {Y.Map} meta map */
  getMetaMap() {
    return this.doc?.getMap('meta') || null;
  }

  /** @returns {Awareness | null} */
  getAwareness() {
    return this.wsProvider?.awareness || null;
  }

  // -- Scene object CRDT operations --

  /**
   * Add or update an object in the shared Y.Doc.
   * @param {string} objectId
   * @param {object} data - { type, name, position, rotation, scale, material, visible, ... }
   */
  setObject(objectId, data) {
    if (!this.doc) return;
    const objectsMap = this.doc.getMap('objects');
    this.doc.transact(() => {
      let objMap = objectsMap.get(objectId);
      if (!objMap) {
        objMap = new Y.Map();
        objectsMap.set(objectId, objMap);
      }
      for (const [key, value] of Object.entries(data)) {
        if (key === 'position' || key === 'rotation' || key === 'scale') {
          // Store vectors as plain arrays so network payload stays small
          objMap.set(key, Array.isArray(value) ? value : [value.x, value.y, value.z]);
        } else {
          objMap.set(key, value);
        }
      }
    });
  }

  /**
   * Remove an object from the shared Y.Doc (tombstone via deletion).
   */
  removeObject(objectId) {
    if (!this.doc) return;
    const objectsMap = this.doc.getMap('objects');
    this.doc.transact(() => {
      objectsMap.delete(objectId);
    });
  }

  /**
   * Lock an object for the current user (prevents others from editing).
   */
  lockObject(objectId) {
    if (!this.doc) return;
    const objectsMap = this.doc.getMap('objects');
    const objMap = objectsMap.get(objectId);
    if (objMap) {
      const awareness = this.getAwareness();
      const userId = awareness?.getLocalState()?.user?.id || 'unknown';
      this.doc.transact(() => {
        objMap.set('locked', true);
        objMap.set('lockedBy', userId);
      });
    }
  }

  /**
   * Unlock an object.
   */
  unlockObject(objectId) {
    if (!this.doc) return;
    const objectsMap = this.doc.getMap('objects');
    const objMap = objectsMap.get(objectId);
    if (objMap) {
      this.doc.transact(() => {
        objMap.set('locked', false);
        objMap.set('lockedBy', null);
      });
    }
  }

  /**
   * Check if an object is locked by another user.
   */
  isLockedByOther(objectId) {
    if (!this.doc) return false;
    const objectsMap = this.doc.getMap('objects');
    const objMap = objectsMap.get(objectId);
    if (!objMap) return false;
    const locked = objMap.get('locked');
    if (!locked) return false;
    const lockedBy = objMap.get('lockedBy');
    const myId = this.getAwareness()?.getLocalState()?.user?.id;
    return lockedBy && lockedBy !== myId;
  }

  // -- Awareness helpers --

  /**
   * Update the local user's cursor position (3D world coordinates).
   */
  setCursor(position) {
    const awareness = this.getAwareness();
    if (!awareness) return;
    awareness.setLocalStateField('user', {
      ...awareness.getLocalState()?.user,
      cursor: position ? { x: position.x, y: position.y, z: position.z } : null,
    });
  }

  /**
   * Update the local user's selected objects.
   */
  setSelectedObjects(objectIds) {
    const awareness = this.getAwareness();
    if (!awareness) return;
    awareness.setLocalStateField('user', {
      ...awareness.getLocalState()?.user,
      selectedObjects: objectIds || [],
    });
  }

  /**
   * Get all remote users' awareness states.
   * @returns {Array<{ clientId: number, user: { id, name, color, cursor, selectedObjects } }>}
   */
  getRemoteUsers() {
    const awareness = this.getAwareness();
    if (!awareness) return [];
    const localClientId = this.doc?.clientID;
    const users = [];
    awareness.getStates().forEach((state, clientId) => {
      if (clientId !== localClientId && state.user) {
        users.push({ clientId, user: state.user });
      }
    });
    return users;
  }

  // -- Event subscription --

  onStatusChange(fn) { this._statusListeners.add(fn); return () => this._statusListeners.delete(fn); }
  onObjectChange(fn) { this._objectChangeListeners.add(fn); return () => this._objectChangeListeners.delete(fn); }
  onAwarenessChange(fn) { this._awarenessListeners.add(fn); return () => this._awarenessListeners.delete(fn); }
}

function hashCode(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}

// Singleton instance
export const collabProvider = new CollaborationProvider();
export default collabProvider;
