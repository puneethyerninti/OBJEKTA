// src/engine/SceneGraphOps.js
// ---------------------------------------------------------------------------
// Phase 7 — Scene Graph Operations engine.
// Provides high-level operations on the scene graph: group, ungroup,
// duplicate, remove, lock/unlock, hide/show, and reorder.
// All ops go through SceneGraphStore and emit EventBus events.
// ---------------------------------------------------------------------------

import * as THREE from "three";
import { SceneGraphStore } from "../store/SceneGraphStore";
import EventBus from "../utils/EventBus";

/* ═══════════════════════════════════════════════════════════════════════════
   GROUP — wrap selected objects in a THREE.Group
   ═══════════════════════════════════════════════════════════════════════ */

/**
 * Group the given object IDs under a new Group.
 * @param {string[]} ids — IDs of objects in SceneGraphStore
 * @param {string} [name] — optional group name
 * @returns {{ groupId: string, group: THREE.Group } | null}
 */
export function groupObjects(ids, name = "Group") {
  if (!Array.isArray(ids) || ids.length < 2) return null;

  const objects = ids
    .map((id) => ({ id, rec: SceneGraphStore.objects[id] }))
    .filter((r) => r.rec?.object);

  if (objects.length < 2) return null;

  const group = new THREE.Group();
  group.name = name;

  // Find common parent (use first object's parent or scene root)
  const firstParent = objects[0].rec.object.parent;

  // Compute centroid for the group position
  const centroid = new THREE.Vector3();
  for (const { rec } of objects) {
    const wp = new THREE.Vector3();
    rec.object.getWorldPosition(wp);
    centroid.add(wp);
  }
  centroid.divideScalar(objects.length);
  group.position.copy(centroid);

  // Add objects to group, adjusting their local positions
  for (const { id, rec } of objects) {
    const obj = rec.object;
    const worldPos = new THREE.Vector3();
    obj.getWorldPosition(worldPos);
    const worldQuat = new THREE.Quaternion();
    obj.getWorldQuaternion(worldQuat);
    const worldScale = new THREE.Vector3();
    obj.getWorldScale(worldScale);

    if (obj.parent) obj.parent.remove(obj);

    // Convert world position to local (relative to group)
    obj.position.copy(worldPos.sub(centroid));
    obj.quaternion.copy(worldQuat);
    obj.scale.copy(worldScale);

    group.add(obj);
  }

  // Add group to the common parent
  if (firstParent) {
    firstParent.add(group);
  }

  // Register group in store
  const groupId = "group_" + Date.now().toString(36);
  SceneGraphStore.addObject(groupId, group, { name, type: "group" });

  // Select the new group
  SceneGraphStore.selectObject(groupId);

  EventBus.emit("scene:updated", { type: "group", groupId, childIds: ids });
  return { groupId, group };
}

/* ═══════════════════════════════════════════════════════════════════════════
   UNGROUP — dissolve a group, reparenting children to the group's parent
   ═══════════════════════════════════════════════════════════════════════ */

/**
 * Ungroup an object (must be a Group).
 * @param {string} groupId — ID in SceneGraphStore
 * @returns {string[]} IDs of freed children
 */
export function ungroupObject(groupId) {
  const rec = SceneGraphStore.objects[groupId];
  if (!rec?.object) return [];

  const group = rec.object;
  if (!group.isGroup && !group.isObject3D) return [];

  const parent = group.parent;
  const children = [...group.children]; // snapshot
  const freedIds = [];

  for (const child of children) {
    // Convert to world coords
    const worldPos = new THREE.Vector3();
    child.getWorldPosition(worldPos);
    const worldQuat = new THREE.Quaternion();
    child.getWorldQuaternion(worldQuat);
    const worldScale = new THREE.Vector3();
    child.getWorldScale(worldScale);

    group.remove(child);

    child.position.copy(worldPos);
    child.quaternion.copy(worldQuat);
    child.scale.copy(worldScale);

    if (parent) parent.add(child);

    // Find ID in store or register
    const existingId = Object.keys(SceneGraphStore.objects).find(
      (id) => SceneGraphStore.objects[id]?.object === child,
    );
    if (existingId) {
      freedIds.push(existingId);
    } else {
      const newId = "obj_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 6);
      SceneGraphStore.addObject(newId, child, { name: child.name || "Object" });
      freedIds.push(newId);
    }
  }

  // Remove the empty group
  if (parent) parent.remove(group);
  SceneGraphStore.removeObject(groupId);

  // Select the freed children
  SceneGraphStore.selectObjects(freedIds);

  EventBus.emit("scene:updated", { type: "ungroup", groupId, freedIds });
  return freedIds;
}

/* ═══════════════════════════════════════════════════════════════════════════
   DUPLICATE / CLONE
   ═══════════════════════════════════════════════════════════════════════ */

/**
 * Deep-clone objects by their IDs.
 * @param {string[]} ids — IDs in SceneGraphStore
 * @param {THREE.Vector3} [offset] — position offset for clones
 * @returns {{ id: string, object: THREE.Object3D }[]}
 */
export function duplicateObjects(ids, offset = null) {
  if (!Array.isArray(ids) || ids.length === 0) return [];

  const cloned = [];
  const defaultOffset = offset || new THREE.Vector3(1, 0, 0);

  for (const id of ids) {
    const rec = SceneGraphStore.objects[id];
    if (!rec?.object) continue;

    const clone = rec.object.clone(true);
    clone.name = (rec.object.name || "Object") + " Copy";

    // Offset position
    clone.position.add(defaultOffset);

    // Clone materials (avoid shared material mutation)
    clone.traverse((child) => {
      if (child.isMesh && child.material) {
        if (Array.isArray(child.material)) {
          child.material = child.material.map((m) => m.clone());
        } else {
          child.material = child.material.clone();
        }
      }
    });

    // Add to same parent
    const parent = rec.object.parent;
    if (parent) parent.add(clone);

    const newId = "dup_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 6);
    SceneGraphStore.addObject(newId, clone, {
      name: clone.name,
      type: rec.metadata?.type || "mesh",
    });
    cloned.push({ id: newId, object: clone });
  }

  // Select clones
  if (cloned.length > 0) {
    SceneGraphStore.selectObjects(cloned.map((c) => c.id));
  }

  EventBus.emit("scene:updated", { type: "duplicate", cloneIds: cloned.map((c) => c.id) });
  return cloned;
}

/* ═══════════════════════════════════════════════════════════════════════════
   REMOVE — delete objects from scene
   ═══════════════════════════════════════════════════════════════════════ */

/**
 * Remove objects by IDs, disposing geometries & materials.
 * @param {string[]} ids
 * @returns {number} count removed
 */
export function removeObjects(ids) {
  if (!Array.isArray(ids) || ids.length === 0) return 0;

  let count = 0;
  for (const id of ids) {
    const rec = SceneGraphStore.objects[id];
    if (!rec?.object) continue;

    const obj = rec.object;

    // Remove from scene
    if (obj.parent) obj.parent.remove(obj);

    // Dispose resources
    obj.traverse((child) => {
      if (child.geometry) {
        try { child.geometry.dispose(); } catch (e) { /* ignore */ }
      }
      if (child.material) {
        const materials = Array.isArray(child.material) ? child.material : [child.material];
        for (const mat of materials) {
          try {
            // Dispose texture maps
            for (const key of Object.keys(mat)) {
              if (mat[key]?.isTexture) {
                try { mat[key].dispose(); } catch (e) { /* ignore */ }
              }
            }
            mat.dispose();
          } catch (e) { /* ignore */ }
        }
      }
    });

    SceneGraphStore.removeObject(id);
    count++;
  }

  EventBus.emit("scene:updated", { type: "remove-batch", count });
  return count;
}

/* ═══════════════════════════════════════════════════════════════════════════
   LOCK / UNLOCK — prevent selection & transforms
   ═══════════════════════════════════════════════════════════════════════ */

/**
 * Lock objects — sets userData.__locked = true.
 * @param {string[]} ids
 */
export function lockObjects(ids) {
  if (!Array.isArray(ids)) return;
  for (const id of ids) {
    const rec = SceneGraphStore.objects[id];
    if (!rec?.object) continue;
    rec.object.userData.__locked = true;
    if (rec.metadata) rec.metadata.locked = true;
  }
  SceneGraphStore.bump();
  EventBus.emit("scene:updated", { type: "lock", ids });
}

/**
 * Unlock objects.
 * @param {string[]} ids
 */
export function unlockObjects(ids) {
  if (!Array.isArray(ids)) return;
  for (const id of ids) {
    const rec = SceneGraphStore.objects[id];
    if (!rec?.object) continue;
    rec.object.userData.__locked = false;
    if (rec.metadata) rec.metadata.locked = false;
  }
  SceneGraphStore.bump();
  EventBus.emit("scene:updated", { type: "unlock", ids });
}

/**
 * Check if an object is locked.
 * @param {string} id
 * @returns {boolean}
 */
export function isLocked(id) {
  const rec = SceneGraphStore.objects[id];
  return !!(rec?.object?.userData?.__locked || rec?.metadata?.locked);
}

/* ═══════════════════════════════════════════════════════════════════════════
   HIDE / SHOW — toggle visibility
   ═══════════════════════════════════════════════════════════════════════ */

/**
 * Hide objects.
 * @param {string[]} ids
 */
export function hideObjects(ids) {
  if (!Array.isArray(ids)) return;
  for (const id of ids) {
    const rec = SceneGraphStore.objects[id];
    if (!rec?.object) continue;
    rec.object.visible = false;
    if (rec.metadata) rec.metadata.hidden = true;
  }
  SceneGraphStore.bump();
  EventBus.emit("scene:updated", { type: "hide", ids });
}

/**
 * Show objects.
 * @param {string[]} ids
 */
export function showObjects(ids) {
  if (!Array.isArray(ids)) return;
  for (const id of ids) {
    const rec = SceneGraphStore.objects[id];
    if (!rec?.object) continue;
    rec.object.visible = true;
    if (rec.metadata) rec.metadata.hidden = false;
  }
  SceneGraphStore.bump();
  EventBus.emit("scene:updated", { type: "show", ids });
}

/**
 * Toggle visibility for a single object.
 * @param {string} id
 * @returns {boolean} new visibility state
 */
export function toggleVisibility(id) {
  const rec = SceneGraphStore.objects[id];
  if (!rec?.object) return true;
  const newVis = !rec.object.visible;
  rec.object.visible = newVis;
  if (rec.metadata) rec.metadata.hidden = !newVis;
  SceneGraphStore.bump();
  EventBus.emit("scene:updated", { type: "visibility", id, visible: newVis });
  return newVis;
}

/**
 * Check if an object is hidden.
 * @param {string} id
 * @returns {boolean}
 */
export function isHidden(id) {
  const rec = SceneGraphStore.objects[id];
  return rec?.object ? !rec.object.visible : false;
}

/* ═══════════════════════════════════════════════════════════════════════════
   REORDER — move object up/down in its parent's children list
   ═══════════════════════════════════════════════════════════════════════ */

/**
 * Move an object within its parent's children array.
 * @param {string} id
 * @param {"up"|"down"} direction
 * @returns {boolean}
 */
export function reorderObject(id, direction) {
  const rec = SceneGraphStore.objects[id];
  if (!rec?.object?.parent) return false;

  const parent = rec.object.parent;
  const idx = parent.children.indexOf(rec.object);
  if (idx === -1) return false;

  const newIdx = direction === "up" ? idx - 1 : idx + 1;
  if (newIdx < 0 || newIdx >= parent.children.length) return false;

  // Swap
  const temp = parent.children[newIdx];
  parent.children[newIdx] = rec.object;
  parent.children[idx] = temp;

  SceneGraphStore.bump();
  EventBus.emit("scene:updated", { type: "reorder", id, direction });
  return true;
}

/* ═══════════════════════════════════════════════════════════════════════════
   FOCUS / FRAME — zoom camera to object bounds
   ═══════════════════════════════════════════════════════════════════════ */

/**
 * Compute the bounding box of objects by IDs.
 * @param {string[]} ids
 * @returns {THREE.Box3 | null}
 */
export function computeBounds(ids) {
  if (!Array.isArray(ids) || ids.length === 0) return null;

  const box = new THREE.Box3();
  let hasContent = false;

  for (const id of ids) {
    const rec = SceneGraphStore.objects[id];
    if (!rec?.object) continue;
    const objBox = new THREE.Box3().setFromObject(rec.object);
    if (!objBox.isEmpty()) {
      box.union(objBox);
      hasContent = true;
    }
  }

  return hasContent ? box : null;
}

/* ═══════════════════════════════════════════════════════════════════════════
   QUERY helpers
   ═══════════════════════════════════════════════════════════════════════ */

/**
 * Get all object IDs matching a filter.
 * @param {(id: string, rec: { object, metadata }) => boolean} filterFn
 * @returns {string[]}
 */
export function queryObjects(filterFn) {
  return Object.entries(SceneGraphStore.objects)
    .filter(([id, rec]) => filterFn(id, rec))
    .map(([id]) => id);
}

/**
 * Get all locked objects.
 * @returns {string[]}
 */
export function getLockedIds() {
  return queryObjects((id) => isLocked(id));
}

/**
 * Get all hidden objects.
 * @returns {string[]}
 */
export function getHiddenIds() {
  return queryObjects((id) => isHidden(id));
}

/**
 * Count total objects in the scene.
 * @returns {number}
 */
export function objectCount() {
  return Object.keys(SceneGraphStore.objects).length;
}

export default {
  groupObjects,
  ungroupObject,
  duplicateObjects,
  removeObjects,
  lockObjects,
  unlockObjects,
  isLocked,
  hideObjects,
  showObjects,
  toggleVisibility,
  isHidden,
  reorderObject,
  computeBounds,
  queryObjects,
  getLockedIds,
  getHiddenIds,
  objectCount,
};
