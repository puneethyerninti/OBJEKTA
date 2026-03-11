// src/collaboration/CollabSelectionHighlight.jsx
// Shows colored outlines on objects that remote users have selected.

import { useEffect, useRef } from 'react';
import * as THREE from 'three';

/**
 * CollabSelectionHighlight — adds colored BoxHelpers around objects selected by remote users.
 *
 * @param {{ remoteUsers: Array, scene: THREE.Scene }} props
 */
export default function CollabSelectionHighlight({ remoteUsers, scene }) {
  const helpersRef = useRef(new Map()); // `${clientId}:${objectId}` → BoxHelper

  useEffect(() => {
    if (!scene) return;
    const existing = helpersRef.current;

    // Build set of expected keys
    const expected = new Set();
    remoteUsers.forEach(({ clientId, user }) => {
      (user.selectedObjects || []).forEach(objId => {
        expected.add(`${clientId}:${objId}`);
      });
    });

    // Remove stale helpers
    existing.forEach((helper, key) => {
      if (!expected.has(key)) {
        scene.remove(helper);
        helper.geometry?.dispose?.();
        helper.material?.dispose?.();
        existing.delete(key);
      }
    });

    // Add/update helpers
    remoteUsers.forEach(({ clientId, user }) => {
      const color = user.color || '#FF6B6B';
      (user.selectedObjects || []).forEach(objId => {
        const key = `${clientId}:${objId}`;
        const obj = scene.getObjectByProperty('uuid', objId);
        if (!obj) return;

        let helper = existing.get(key);
        if (!helper) {
          helper = new THREE.BoxHelper(obj, color);
          helper.name = `_collab_sel_${key}`;
          helper.material.transparent = true;
          helper.material.opacity = 0.6;
          helper.material.depthTest = false;
          scene.add(helper);
          existing.set(key, helper);
        }
        helper.setFromObject(obj);
        helper.material.color.set(color);
        helper.update();
      });
    });
  }, [remoteUsers, scene]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      helpersRef.current.forEach((helper) => {
        try {
          helper.parent?.remove(helper);
          helper.geometry?.dispose?.();
          helper.material?.dispose?.();
        } catch (e) {}
      });
      helpersRef.current.clear();
    };
  }, []);

  return null;
}
