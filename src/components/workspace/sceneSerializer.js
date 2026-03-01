// src/components/workspace/sceneSerializer.js
// Pure scene serialization / deserialization utilities extracted from Workspace.jsx.
// All functions accept explicit parameters instead of closing over component refs.

import * as THREE from "three";

/**
 * Build a compact, JSON-safe summary for a single scene object.
 * @param {THREE.Object3D} obj
 * @returns {Object}
 */
export function summarizeObject(obj) {
  const summary = {
    uuid: obj.uuid,
    name: obj.name || "",
    type: obj.type || (obj.isMesh ? "Mesh" : "Object3D"),
    position: { x: obj.position.x, y: obj.position.y, z: obj.position.z },
    rotation: { x: obj.rotation.x, y: obj.rotation.y, z: obj.rotation.z },
    scale:    { x: obj.scale.x,    y: obj.scale.y,    z: obj.scale.z },
    geometry: { type: null, tris: 0 },
    material: { color: null, roughness: null, metalness: null, map: null },
    userData: obj.userData || {},
  };

  let foundMesh = null;
  obj.traverse((n) => { if (!foundMesh && n.isMesh && n.geometry) foundMesh = n; });

  if (foundMesh) {
    const geom = foundMesh.geometry;
    try {
      summary.geometry.type = geom.type || null;
      if (geom.index) summary.geometry.tris = Math.round(geom.index.count / 3);
      else if (geom.attributes?.position) summary.geometry.tris = Math.round(geom.attributes.position.count / 3);
    } catch { /* ignore */ }

    const mat = Array.isArray(foundMesh.material) ? foundMesh.material[0] : foundMesh.material;
    if (mat) {
      try {
        if (mat.color) summary.material.color = "#" + mat.color.getHexString();
        if (typeof mat.roughness === "number") summary.material.roughness = mat.roughness;
        if (typeof mat.metalness === "number") summary.material.metalness = mat.metalness;
        summary.material.map = null; // avoid blob URLs
      } catch { /* ignore */ }
    }
  }
  return summary;
}

/**
 * Collect all light info from a scene.
 * @param {THREE.Scene} scene
 * @returns {Array<Object>}
 */
export function collectLights(scene) {
  const lights = [];
  scene.traverse((n) => {
    if (!n.isLight) return;
    try {
      lights.push({
        uuid:      n.uuid,
        name:      n.name || "",
        type:      n.type || "Light",
        color:     "#" + new THREE.Color(n.color || 0xffffff).getHexString(),
        intensity: typeof n.intensity === "number" ? n.intensity : null,
        position:  n.position ? { x: n.position.x, y: n.position.y, z: n.position.z } : null,
        target:    n.target   ? { x: n.target.position.x, y: n.target.position.y, z: n.target.position.z } : null,
        distance:  n.distance || null,
        angle:     n.angle    || null,
      });
    } catch { /* ignore */ }
  });
  return lights;
}

/**
 * Collect all camera info from a scene.
 * @param {THREE.Scene} scene
 * @returns {Array<Object>}
 */
export function collectCameras(scene) {
  const cameras = [];
  scene.traverse((n) => {
    if (!n.isCamera) return;
    try {
      cameras.push({
        uuid:     n.uuid,
        name:     n.name || "",
        type:     n.type || "Camera",
        fov:      n.fov || null,
        position: n.position ? { x: n.position.x, y: n.position.y, z: n.position.z } : null,
      });
    } catch { /* ignore */ }
  });
  return cameras;
}

/**
 * Compute a quick scene summary (triangle count, object count).
 * @param {THREE.Object3D[]} objs – user objects
 * @returns {{ totalTris: number, objects: number, objectsList: Array }}
 */
export function computeSceneSummary(objs) {
  let totalTris = 0;
  const objectsList = objs.map((o) => {
    let tris = 0;
    o.traverse((n) => {
      if (n.isMesh && n.geometry) {
        try {
          if (n.geometry.index) tris += n.geometry.index.count / 3;
          else if (n.geometry.attributes?.position) tris += n.geometry.attributes.position.count / 3;
        } catch { /* ignore */ }
      }
    });
    totalTris += tris;
    return { uuid: o.uuid, name: o.name, tris: Math.round(tris) };
  });
  return { totalTris: Math.round(totalTris), objects: objectsList.length, objectsList };
}
