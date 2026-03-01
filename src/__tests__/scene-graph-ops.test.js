// src/__tests__/scene-graph-ops.test.js
// Phase 7 — SceneGraphOps engine tests

import { describe, it, expect, beforeEach } from "vitest";
import * as THREE from "three";
import { SceneGraphStore } from "../store/SceneGraphStore";
import {
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
} from "../engine/SceneGraphOps";

/* ── Helper to reset store & create test meshes ──────────────────── */
function resetStore() {
  SceneGraphStore.objects = {};
  SceneGraphStore.selected = [];
  SceneGraphStore.version = 0;
}

function makeMesh(name = "TestMesh") {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshStandardMaterial({ color: 0x888888 }),
  );
  mesh.name = name;
  return mesh;
}

function addMesh(id, name = "Mesh") {
  const m = makeMesh(name);
  // Create a fake parent scene so parent operations work
  const scene = new THREE.Scene();
  scene.add(m);
  SceneGraphStore.addObject(id, m, { name, type: "mesh" });
  return m;
}

/* ═══════════════════════════════════════════════════════════════════════
   lock / unlock
   ═══════════════════════════════════════════════════════════════════ */
describe("lockObjects / unlockObjects", () => {
  beforeEach(resetStore);

  it("locks an object", () => {
    addMesh("a", "A");
    lockObjects(["a"]);
    expect(isLocked("a")).toBe(true);
  });

  it("unlocks an object", () => {
    addMesh("a", "A");
    lockObjects(["a"]);
    unlockObjects(["a"]);
    expect(isLocked("a")).toBe(false);
  });

  it("returns false for unknown id", () => {
    expect(isLocked("nonexistent")).toBe(false);
  });

  it("getLockedIds returns all locked", () => {
    addMesh("a"); addMesh("b"); addMesh("c");
    lockObjects(["a", "c"]);
    const locked = getLockedIds();
    expect(locked).toContain("a");
    expect(locked).toContain("c");
    expect(locked).not.toContain("b");
  });
});

/* ═══════════════════════════════════════════════════════════════════════
   hide / show / toggleVisibility
   ═══════════════════════════════════════════════════════════════════ */
describe("hideObjects / showObjects / toggleVisibility", () => {
  beforeEach(resetStore);

  it("hides an object", () => {
    const m = addMesh("a");
    hideObjects(["a"]);
    expect(m.visible).toBe(false);
    expect(isHidden("a")).toBe(true);
  });

  it("shows a hidden object", () => {
    const m = addMesh("a");
    hideObjects(["a"]);
    showObjects(["a"]);
    expect(m.visible).toBe(true);
    expect(isHidden("a")).toBe(false);
  });

  it("toggleVisibility flips state", () => {
    addMesh("a");
    const v1 = toggleVisibility("a");
    expect(v1).toBe(false);
    const v2 = toggleVisibility("a");
    expect(v2).toBe(true);
  });

  it("getHiddenIds returns correct set", () => {
    addMesh("a"); addMesh("b");
    hideObjects(["b"]);
    const hidden = getHiddenIds();
    expect(hidden).toContain("b");
    expect(hidden).not.toContain("a");
  });
});

/* ═══════════════════════════════════════════════════════════════════════
   duplicateObjects
   ═══════════════════════════════════════════════════════════════════ */
describe("duplicateObjects", () => {
  beforeEach(resetStore);

  it("clones objects with new IDs", () => {
    addMesh("a", "MeshA");
    const clones = duplicateObjects(["a"]);
    expect(clones.length).toBe(1);
    expect(clones[0].id).not.toBe("a");
    expect(clones[0].object.name).toContain("Copy");
  });

  it("clones have offset position", () => {
    const m = addMesh("a");
    m.position.set(0, 0, 0);
    const clones = duplicateObjects(["a"], new THREE.Vector3(2, 0, 0));
    expect(clones[0].object.position.x).toBeCloseTo(2, 1);
  });

  it("clones have independent materials", () => {
    const m = addMesh("a");
    const clones = duplicateObjects(["a"]);
    clones[0].object.traverse((c) => {
      if (c.isMesh) c.material.color.set(0xff0000);
    });
    // Original should be unchanged
    expect(m.material.color.getHex()).not.toBe(0xff0000);
  });

  it("returns empty array for empty input", () => {
    expect(duplicateObjects([])).toEqual([]);
  });

  it("selects the clones", () => {
    addMesh("a");
    const clones = duplicateObjects(["a"]);
    expect(SceneGraphStore.selected).toContain(clones[0].id);
  });
});

/* ═══════════════════════════════════════════════════════════════════════
   removeObjects
   ═══════════════════════════════════════════════════════════════════ */
describe("removeObjects", () => {
  beforeEach(resetStore);

  it("removes objects from store", () => {
    addMesh("a"); addMesh("b");
    const count = removeObjects(["a"]);
    expect(count).toBe(1);
    expect(SceneGraphStore.objects["a"]).toBeUndefined();
    expect(SceneGraphStore.objects["b"]).toBeDefined();
  });

  it("returns 0 for empty input", () => {
    expect(removeObjects([])).toBe(0);
  });

  it("removes object from its parent", () => {
    const m = addMesh("a");
    const parent = m.parent;
    removeObjects(["a"]);
    expect(parent.children).not.toContain(m);
  });
});

/* ═══════════════════════════════════════════════════════════════════════
   groupObjects / ungroupObject
   ═══════════════════════════════════════════════════════════════════ */
describe("groupObjects / ungroupObject", () => {
  beforeEach(resetStore);

  it("returns null for fewer than 2 objects", () => {
    addMesh("a");
    expect(groupObjects(["a"])).toBeNull();
  });

  it("groups 2+ objects into a Group", () => {
    addMesh("a"); addMesh("b");
    const result = groupObjects(["a", "b"], "MyGroup");
    expect(result).toBeTruthy();
    expect(result.group).toBeInstanceOf(THREE.Group);
    expect(result.group.name).toBe("MyGroup");
    expect(result.group.children.length).toBe(2);
  });

  it("ungroups returns freed child ids", () => {
    addMesh("a"); addMesh("b");
    const result = groupObjects(["a", "b"]);
    const freed = ungroupObject(result.groupId);
    expect(freed.length).toBe(2);
    // Group should be removed from store
    expect(SceneGraphStore.objects[result.groupId]).toBeUndefined();
  });

  it("ungroup on non-existent id returns empty array", () => {
    expect(ungroupObject("nonexistent")).toEqual([]);
  });
});

/* ═══════════════════════════════════════════════════════════════════════
   reorderObject
   ═══════════════════════════════════════════════════════════════════ */
describe("reorderObject", () => {
  beforeEach(resetStore);

  it("swaps object order in parent children", () => {
    const scene = new THREE.Scene();
    const m1 = makeMesh("A");
    const m2 = makeMesh("B");
    scene.add(m1, m2);
    SceneGraphStore.addObject("a", m1, { name: "A" });
    SceneGraphStore.addObject("b", m2, { name: "B" });

    // m1 is at index 0, m2 at index 1
    expect(scene.children.indexOf(m1)).toBe(0);
    const moved = reorderObject("a", "down");
    expect(moved).toBe(true);
    expect(scene.children.indexOf(m1)).toBe(1);
  });

  it("returns false for out-of-bounds move", () => {
    const scene = new THREE.Scene();
    const m1 = makeMesh("A");
    scene.add(m1);
    SceneGraphStore.addObject("a", m1, { name: "A" });
    expect(reorderObject("a", "up")).toBe(false);
  });
});

/* ═══════════════════════════════════════════════════════════════════════
   computeBounds
   ═══════════════════════════════════════════════════════════════════ */
describe("computeBounds", () => {
  beforeEach(resetStore);

  it("returns bounding box for objects", () => {
    const m = addMesh("a");
    m.position.set(5, 5, 5);
    m.updateMatrixWorld(true);
    const box = computeBounds(["a"]);
    expect(box).toBeInstanceOf(THREE.Box3);
    expect(box.min.x).toBeLessThan(6);
    expect(box.max.x).toBeGreaterThan(4);
  });

  it("returns null for empty ids", () => {
    expect(computeBounds([])).toBeNull();
  });
});

/* ═══════════════════════════════════════════════════════════════════════
   queryObjects / objectCount
   ═══════════════════════════════════════════════════════════════════ */
describe("queryObjects / objectCount", () => {
  beforeEach(resetStore);

  it("counts objects", () => {
    addMesh("a"); addMesh("b"); addMesh("c");
    expect(objectCount()).toBe(3);
  });

  it("filters objects by predicate", () => {
    addMesh("a"); addMesh("b");
    lockObjects(["a"]);
    const result = queryObjects((id, rec) => rec.metadata?.locked);
    expect(result).toEqual(["a"]);
  });
});
