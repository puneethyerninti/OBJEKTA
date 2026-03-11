// src/collaboration/CollabCursors.jsx
// Renders remote users' 3D cursors in the scene as colored spheres with name labels.

import React, { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';

/**
 * CollabCursors — renders remote user cursors in the Three.js scene.
 * Must be rendered inside a component that has access to the scene ref.
 *
 * @param {{ remoteUsers: Array, scene: THREE.Scene }} props
 */
export default function CollabCursors({ remoteUsers, scene }) {
  const cursorsRef = useRef(new Map()); // clientId → { mesh, sprite }

  useEffect(() => {
    if (!scene) return;
    const existing = cursorsRef.current;

    // Remove cursors for users who left
    existing.forEach((entry, clientId) => {
      if (!remoteUsers.find(u => u.clientId === clientId)) {
        scene.remove(entry.group);
        entry.group.traverse(n => {
          n.geometry?.dispose?.();
          n.material?.dispose?.();
          if (n.material?.map) n.material.map.dispose();
        });
        existing.delete(clientId);
      }
    });

    // Add/update cursors for remote users
    remoteUsers.forEach(({ clientId, user }) => {
      if (!user.cursor) {
        // User has no cursor position — hide if exists
        const entry = existing.get(clientId);
        if (entry) entry.group.visible = false;
        return;
      }

      let entry = existing.get(clientId);
      if (!entry) {
        const group = new THREE.Group();
        group.name = `_collab_cursor_${clientId}`;

        // Sphere
        const geo = new THREE.SphereGeometry(0.08, 12, 12);
        const mat = new THREE.MeshBasicMaterial({ color: user.color || '#FF6B6B', transparent: true, opacity: 0.8 });
        const mesh = new THREE.Mesh(geo, mat);
        group.add(mesh);

        // Name label (using a canvas-based sprite)
        const sprite = createLabelSprite(user.name || 'User', user.color || '#FF6B6B');
        sprite.position.set(0, 0.2, 0);
        sprite.scale.set(0.5, 0.15, 1);
        group.add(sprite);

        scene.add(group);
        entry = { group, mesh, sprite };
        existing.set(clientId, entry);
      }

      entry.group.visible = true;
      entry.group.position.set(user.cursor.x, user.cursor.y, user.cursor.z);
      // Update color if changed
      entry.mesh.material.color.set(user.color || '#FF6B6B');
    });
  }, [remoteUsers, scene]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cursorsRef.current.forEach((entry) => {
        try {
          entry.group.parent?.remove(entry.group);
          entry.group.traverse(n => {
            n.geometry?.dispose?.();
            n.material?.dispose?.();
          });
        } catch (e) {}
      });
      cursorsRef.current.clear();
    };
  }, []);

  return null; // This is a side-effect component
}

function createLabelSprite(text, bgColor) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');

  // Background pill
  ctx.fillStyle = bgColor;
  ctx.beginPath();
  ctx.roundRect(0, 0, 256, 64, 16);
  ctx.fill();

  // Text
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 28px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text.slice(0, 12), 128, 32);

  const texture = new THREE.CanvasTexture(canvas);
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false });
  return new THREE.Sprite(material);
}
