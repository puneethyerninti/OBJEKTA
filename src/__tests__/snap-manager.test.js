// src/__tests__/snap-manager.test.js
// Phase 7 — SnapManager engine tests

import { describe, it, expect, beforeEach } from "vitest";
import * as THREE from "three";
import {
  SNAP_PRESETS,
  setEnabled,
  isEnabled,
  setGridSize,
  getGridSize,
  setAngleStep,
  getAngleStep,
  setScaleStep,
  getScaleStep,
  setSurfaceSnap,
  isSurfaceSnap,
  setAxisConstraint,
  getAxisConstraint,
  applyPreset,
  getState,
  snapScalar,
  snapPosition,
  snapAngle,
  snapRotation,
  snapScale,
  snapToSurface,
  createSnapGrid,
} from "../engine/SnapManager";

/* ── Reset snap state before each test ───────────────────────────── */
beforeEach(() => {
  setEnabled(false);
  setGridSize(0.5);
  setAngleStep(15);
  setScaleStep(0.1);
  setSurfaceSnap(false);
  setAxisConstraint(null);
});

/* ═══════════════════════════════════════════════════════════════════════
   SNAP_PRESETS
   ═══════════════════════════════════════════════════════════════════ */
describe("SNAP_PRESETS", () => {
  it("is a non-empty array", () => {
    expect(Array.isArray(SNAP_PRESETS)).toBe(true);
    expect(SNAP_PRESETS.length).toBeGreaterThanOrEqual(5);
  });

  it("each preset has id, label, grid, angle", () => {
    for (const p of SNAP_PRESETS) {
      expect(p).toHaveProperty("id");
      expect(p).toHaveProperty("label");
      expect(typeof p.grid).toBe("number");
      expect(typeof p.angle).toBe("number");
    }
  });
});

/* ═══════════════════════════════════════════════════════════════════════
   Configuration
   ═══════════════════════════════════════════════════════════════════ */
describe("Configuration", () => {
  it("setEnabled / isEnabled", () => {
    expect(isEnabled()).toBe(false);
    setEnabled(true);
    expect(isEnabled()).toBe(true);
  });

  it("setGridSize / getGridSize", () => {
    setGridSize(1.5);
    expect(getGridSize()).toBe(1.5);
  });

  it("setAngleStep / getAngleStep", () => {
    setAngleStep(45);
    expect(getAngleStep()).toBe(45);
  });

  it("setScaleStep / getScaleStep", () => {
    setScaleStep(0.25);
    expect(getScaleStep()).toBe(0.25);
  });

  it("setSurfaceSnap / isSurfaceSnap", () => {
    setSurfaceSnap(true);
    expect(isSurfaceSnap()).toBe(true);
  });

  it("setAxisConstraint / getAxisConstraint", () => {
    setAxisConstraint("x");
    expect(getAxisConstraint()).toBe("x");
    setAxisConstraint(null);
    expect(getAxisConstraint()).toBeNull();
  });

  it("getState returns full state copy", () => {
    setEnabled(true);
    setGridSize(2.0);
    const s = getState();
    expect(s.enabled).toBe(true);
    expect(s.gridSize).toBe(2.0);
  });

  it("applyPreset sets state", () => {
    applyPreset("large");
    expect(isEnabled()).toBe(true);
    expect(getGridSize()).toBe(1.0);
    expect(getAngleStep()).toBe(45);
  });

  it("applyPreset 'none' disables", () => {
    setEnabled(true);
    applyPreset("none");
    expect(isEnabled()).toBe(false);
  });
});

/* ═══════════════════════════════════════════════════════════════════════
   snapScalar
   ═══════════════════════════════════════════════════════════════════ */
describe("snapScalar", () => {
  it("returns unsnapped value when disabled", () => {
    expect(snapScalar(1.23)).toBe(1.23);
  });

  it("snaps to grid when enabled", () => {
    setEnabled(true);
    setGridSize(0.5);
    expect(snapScalar(1.23)).toBeCloseTo(1.0, 5);
    expect(snapScalar(1.3)).toBeCloseTo(1.5, 5);
  });

  it("uses custom step override", () => {
    setEnabled(true);
    expect(snapScalar(0.7, 0.25)).toBeCloseTo(0.75, 5);
  });
});

/* ═══════════════════════════════════════════════════════════════════════
   snapPosition
   ═══════════════════════════════════════════════════════════════════ */
describe("snapPosition", () => {
  it("returns unsnapped when disabled", () => {
    const v = new THREE.Vector3(1.23, 4.56, 7.89);
    snapPosition(v);
    expect(v.x).toBeCloseTo(1.23, 5);
  });

  it("snaps all axes when enabled", () => {
    setEnabled(true);
    setGridSize(1.0);
    const v = new THREE.Vector3(1.7, 2.3, 3.8);
    snapPosition(v);
    expect(v.x).toBeCloseTo(2.0, 5);
    expect(v.y).toBeCloseTo(2.0, 5);
    expect(v.z).toBeCloseTo(4.0, 5);
  });

  it("respects axis constraint", () => {
    setEnabled(true);
    setGridSize(1.0);
    setAxisConstraint("x");
    const v = new THREE.Vector3(1.7, 2.3, 3.8);
    snapPosition(v);
    expect(v.x).toBeCloseTo(2.0, 5);
    expect(v.y).toBeCloseTo(2.3, 5); // unsnapped
    expect(v.z).toBeCloseTo(3.8, 5); // unsnapped
  });
});

/* ═══════════════════════════════════════════════════════════════════════
   snapAngle
   ═══════════════════════════════════════════════════════════════════ */
describe("snapAngle", () => {
  it("returns unsnapped when disabled", () => {
    const val = Math.PI * 0.3;
    expect(snapAngle(val)).toBe(val);
  });

  it("snaps angle to 15° steps", () => {
    setEnabled(true);
    setAngleStep(15);
    const input = (20 * Math.PI) / 180; // 20deg -> should snap to 15deg
    const result = snapAngle(input);
    expect(result).toBeCloseTo((15 * Math.PI) / 180, 3);
  });

  it("snaps to 45° steps", () => {
    setEnabled(true);
    setAngleStep(45);
    const input = (50 * Math.PI) / 180;
    const result = snapAngle(input);
    expect(result).toBeCloseTo((45 * Math.PI) / 180, 3);
  });
});

/* ═══════════════════════════════════════════════════════════════════════
   snapRotation
   ═══════════════════════════════════════════════════════════════════ */
describe("snapRotation", () => {
  it("snaps euler rotation to steps", () => {
    setEnabled(true);
    setAngleStep(90);
    const euler = new THREE.Euler(
      (100 * Math.PI) / 180,
      (50 * Math.PI) / 180,
      (170 * Math.PI) / 180,
    );
    snapRotation(euler);
    expect(euler.x).toBeCloseTo((90 * Math.PI) / 180, 3);
    expect(euler.y).toBeCloseTo((90 * Math.PI) / 180, 3);
    expect(euler.z).toBeCloseTo((180 * Math.PI) / 180, 3);
  });
});

/* ═══════════════════════════════════════════════════════════════════════
   snapScale
   ═══════════════════════════════════════════════════════════════════ */
describe("snapScale", () => {
  it("snaps scale to step", () => {
    setEnabled(true);
    setScaleStep(0.5);
    const s = new THREE.Vector3(1.3, 0.7, 2.1);
    snapScale(s);
    expect(s.x).toBeCloseTo(1.5, 5);
    expect(s.y).toBeCloseTo(0.5, 5);
    expect(s.z).toBeCloseTo(2.0, 5);
  });

  it("prevents scale below step minimum", () => {
    setEnabled(true);
    setScaleStep(0.5);
    const s = new THREE.Vector3(0.1, 0.2, 0.3);
    snapScale(s);
    expect(s.x).toBeGreaterThanOrEqual(0.5);
    expect(s.y).toBeGreaterThanOrEqual(0.5);
    expect(s.z).toBeGreaterThanOrEqual(0.5);
  });
});

/* ═══════════════════════════════════════════════════════════════════════
   snapToSurface
   ═══════════════════════════════════════════════════════════════════ */
describe("snapToSurface", () => {
  it("returns hit:false when no surfaces", () => {
    const pos = new THREE.Vector3(0, 5, 0);
    const result = snapToSurface(pos, []);
    expect(result.hit).toBe(false);
  });

  it("snaps to surface when a mesh is below", () => {
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(20, 20),
      new THREE.MeshBasicMaterial(),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0;
    floor.updateMatrixWorld(true);

    const pos = new THREE.Vector3(0, 5, 0);
    const result = snapToSurface(pos, [floor]);
    expect(result.hit).toBe(true);
    expect(result.point.y).toBeCloseTo(0, 0);
  });
});

/* ═══════════════════════════════════════════════════════════════════════
   createSnapGrid
   ═══════════════════════════════════════════════════════════════════ */
describe("createSnapGrid", () => {
  it("returns a GridHelper instance", () => {
    setGridSize(1.0);
    const grid = createSnapGrid();
    expect(grid).toBeInstanceOf(THREE.GridHelper);
    expect(grid.name).toBe("__snapGrid");
  });
});
