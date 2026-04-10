// src/collaboration/useCollaboration.js
// React hook for integrating Yjs collaboration with the Studio.
// Bridges CollaborationProvider ↔ Workspace imperative methods.

import { useState, useEffect, useRef, useCallback } from 'react';
import { collabProvider } from './CollaborationProvider';

/**
 * @param {object} opts
 * @param {string|null} opts.projectId
 * @param {{ id: string, name: string }|null} opts.user
 * @param {string|null} [opts.authToken]
 * @param {React.RefObject} opts.workspaceRef
 * @param {Function} [opts.onToast]
 */
export function useCollaboration({ projectId, user, authToken = null, workspaceRef, onToast }) {
  const [status, setStatus] = useState('disconnected');
  const [remoteUsers, setRemoteUsers] = useState([]);
  const [yjsConnected, setYjsConnected] = useState(false);
  const suppressRef = useRef(false);

  // Connect/disconnect when projectId changes
  useEffect(() => {
    if (!projectId || !user?.id) {
      collabProvider.disconnect();
      setYjsConnected(false);
      setStatus('disconnected');
      return;
    }

    collabProvider.connect(projectId, user, undefined, authToken || undefined);
    setYjsConnected(true);

    const unsub1 = collabProvider.onStatusChange((s) => {
      setStatus(s);
      if (s === 'connected') {
        onToast?.({ type: 'info', message: 'Real-time collaboration active' });
      }
    });

    const unsub2 = collabProvider.onAwarenessChange(() => {
      setRemoteUsers(collabProvider.getRemoteUsers());
    });

    // React to remote Y.Doc object changes → apply to Workspace
    const unsub3 = collabProvider.onObjectChange((event, objectsMap) => {
      if (suppressRef.current) return;
      // We receive granular CRDT updates; apply them to the workspace
      try {
        const ws = workspaceRef.current;
        if (!ws) return;
        const scene = ws.getScene?.() || ws.scene;
        if (!scene) return;

        objectsMap.forEach((objMap, objectId) => {
          if (!(objMap instanceof Map || (objMap && typeof objMap.get === 'function'))) return;
          const obj = scene.getObjectByProperty?.('uuid', objectId);
          if (!obj) return;

          // Apply position
          const pos = objMap.get('position');
          if (pos && Array.isArray(pos) && pos.length === 3) {
            obj.position.set(pos[0], pos[1], pos[2]);
          }
          // Apply rotation
          const rot = objMap.get('rotation');
          if (rot && Array.isArray(rot) && rot.length === 3) {
            obj.rotation.set(rot[0], rot[1], rot[2]);
          }
          // Apply scale
          const scl = objMap.get('scale');
          if (scl && Array.isArray(scl) && scl.length === 3) {
            obj.scale.set(scl[0], scl[1], scl[2]);
          }
          // Apply visibility
          const vis = objMap.get('visible');
          if (vis !== undefined) obj.visible = vis;
          // Apply name
          const name = objMap.get('name');
          if (name !== undefined) obj.name = name;
        });
      } catch (e) {
        console.warn('[useCollaboration] Failed to apply remote change:', e);
      }
    });

    return () => {
      unsub1();
      unsub2();
      unsub3();
      collabProvider.disconnect();
      setYjsConnected(false);
      setStatus('disconnected');
    };
  }, [authToken, projectId, user?.id]);

  // Push local transform changes to Y.Doc
  const pushObjectUpdate = useCallback((objectId, data) => {
    if (!yjsConnected) return;
    suppressRef.current = true;
    collabProvider.setObject(objectId, data);
    // Use queueMicrotask to re-enable after current Y.Doc transaction completes
    queueMicrotask(() => { suppressRef.current = false; });
  }, [yjsConnected]);

  const pushObjectRemove = useCallback((objectId) => {
    if (!yjsConnected) return;
    suppressRef.current = true;
    collabProvider.removeObject(objectId);
    queueMicrotask(() => { suppressRef.current = false; });
  }, [yjsConnected]);

  const lockObject = useCallback((objectId) => {
    collabProvider.lockObject(objectId);
  }, []);

  const unlockObject = useCallback((objectId) => {
    collabProvider.unlockObject(objectId);
  }, []);

  const isLockedByOther = useCallback((objectId) => {
    return collabProvider.isLockedByOther(objectId);
  }, []);

  const setCursor = useCallback((position) => {
    collabProvider.setCursor(position);
  }, []);

  const prevSelectedRef = useRef([]);

  const setSelectedObjects = useCallback((ids) => {
    // Auto-unlock previously selected, auto-lock newly selected
    const prev = prevSelectedRef.current;
    const next = ids || [];
    prev.forEach(id => { if (!next.includes(id)) collabProvider.unlockObject(id); });
    next.forEach(id => { if (!prev.includes(id)) collabProvider.lockObject(id); });
    prevSelectedRef.current = next;
    collabProvider.setSelectedObjects(next);
  }, []);

  return {
    status,
    yjsConnected,
    remoteUsers,
    pushObjectUpdate,
    pushObjectRemove,
    lockObject,
    unlockObject,
    isLockedByOther,
    setCursor,
    setSelectedObjects,
    provider: collabProvider,
  };
}

export default useCollaboration;
