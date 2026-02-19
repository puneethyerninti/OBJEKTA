import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { normalizeModel } from '../components/GLBImporter.jsx';

function makeMesh({ position = [0, 0, 0], size = 2 }) {
  const geom = new THREE.BoxGeometry(size, size, size);
  const mat = new THREE.MeshStandardMaterial();
  const mesh = new THREE.Mesh(geom, mat);
  mesh.position.set(position[0], position[1], position[2]);
  return mesh;
}

function worldBox(obj) {
  const box = new THREE.Box3().setFromObject(obj);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  return { box, size, center };
}

describe('normalizeModel', () => {
  it('centers model at origin and scales down oversized assets', () => {
    const root = new THREE.Group();
    root.add(makeMesh({ position: [5, 2, -3], size: 20 }));

    normalizeModel(root, { alignToGround: true, maxDimension: 10 });

    const { box, size, center } = worldBox(root);
    expect(Math.abs(center.x)).toBeLessThan(1e-3);
    expect(Math.abs(center.z)).toBeLessThan(1e-3);
    // scaled to fit maxDimension ~= 10
    expect(size.x).toBeLessThanOrEqual(10.01);
    // grounded (min y ~= 0)
    expect(Math.abs(box.min.y)).toBeLessThan(1e-3);
    // center.y should reflect grounded placement (half height)
    expect(center.y).toBeGreaterThan(0);
  });

  it('runs only once per root (idempotent)', () => {
    const root = new THREE.Group();
    root.add(makeMesh({ position: [2, 4, 0], size: 4 }));

    normalizeModel(root, { alignToGround: false, maxDimension: 4 });
    const firstBox = worldBox(root).box.clone();
    normalizeModel(root, { alignToGround: false, maxDimension: 1 });
    const secondBox = worldBox(root).box.clone();

    expect(firstBox.min.equals(secondBox.min)).toBe(true);
    expect(firstBox.max.equals(secondBox.max)).toBe(true);
    expect(root.userData._normalized).toBe(true);
  });
});
