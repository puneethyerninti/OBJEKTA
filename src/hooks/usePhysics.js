// src/hooks/usePhysics.js
// React hook bridging PhysicsManager ↔ Workspace scene
import { useRef, useEffect, useState, useCallback } from "react";
import PhysicsManager, { GRAVITY_PRESETS, BODY_TYPES, COLLIDER_TYPES, JOINT_TYPES } from "../engine/PhysicsManager";
import EventBus from "../utils/EventBus";

export { GRAVITY_PRESETS, BODY_TYPES, COLLIDER_TYPES, JOINT_TYPES };

export default function usePhysics(workspaceRef) {
  const managerRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [running, setRunning] = useState(false);
  const [gravity, setGravityState] = useState("earth");
  const [debugVisible, setDebugVisible] = useState(false);
  const [bodies, setBodies] = useState([]); // [{uuid, type, colliderType, mass}]

  // Lazily create singleton manager
  const getManager = useCallback(() => {
    if (!managerRef.current) {
      managerRef.current = new PhysicsManager();
    }
    return managerRef.current;
  }, []);

  // Init Rapier WASM
  useEffect(() => {
    let cancelled = false;
    const mgr = getManager();
    mgr.init().then(() => {
      if (!cancelled) {
        setReady(true);
      }
    }).catch(err => {
      console.error("[Physics] Rapier init failed:", err);
    });
    return () => { cancelled = true; };
  }, [getManager]);

  // Refresh bodies list
  const refreshBodies = useCallback(() => {
    const mgr = managerRef.current;
    if (!mgr) return;
    setBodies(mgr.getAllBodies());
  }, []);

  // Add physics body to object
  const addPhysicsBody = useCallback((uuid, config) => {
    const mgr = managerRef.current;
    if (!mgr?.ready) return;

    // Get Three.js object for auto-collider computation
    const ws = workspaceRef?.current;
    const obj = ws?.scene?.getObjectByProperty?.("uuid", uuid);
    if (!obj) return;

    // Compute collider from actual geometry
    const autoCollider = mgr.computeColliderConfig(obj, config.colliderType || "box");
    const merged = {
      ...autoCollider,
      ...config,
      position: { x: obj.position.x, y: obj.position.y, z: obj.position.z },
      rotation: { x: obj.quaternion.x, y: obj.quaternion.y, z: obj.quaternion.z, w: obj.quaternion.w },
    };

    mgr.addBody(uuid, merged);

    // Store physics config in userData for serialization
    obj.userData.__physics = {
      enabled: true,
      type: merged.type || "dynamic",
      colliderType: merged.colliderType || "box",
      mass: merged.mass ?? 1,
      friction: merged.friction ?? 0.5,
      restitution: merged.restitution ?? 0.3,
      linearDamping: merged.linearDamping ?? 0.01,
      angularDamping: merged.angularDamping ?? 0.05,
      gravityScale: merged.gravityScale ?? 1.0,
      ccdEnabled: merged.ccdEnabled ?? false,
    };

    refreshBodies();
  }, [workspaceRef, refreshBodies]);

  // Remove physics body
  const removePhysicsBody = useCallback((uuid) => {
    const mgr = managerRef.current;
    if (!mgr) return;
    mgr.removeBody(uuid);

    const ws = workspaceRef?.current;
    const obj = ws?.scene?.getObjectByProperty?.("uuid", uuid);
    if (obj?.userData) delete obj.userData.__physics;

    refreshBodies();
  }, [workspaceRef, refreshBodies]);

  // Update physics body config
  const updatePhysicsBody = useCallback((uuid, patch) => {
    const mgr = managerRef.current;
    if (!mgr) return;
    mgr.updateBodyConfig(uuid, patch);

    const ws = workspaceRef?.current;
    const obj = ws?.scene?.getObjectByProperty?.("uuid", uuid);
    if (obj?.userData?.__physics) {
      Object.assign(obj.userData.__physics, patch);
    }

    refreshBodies();
  }, [workspaceRef, refreshBodies]);

  // Check if object has physics
  const hasPhysicsBody = useCallback((uuid) => {
    return managerRef.current?.hasBody(uuid) ?? false;
  }, []);

  // Get physics config
  const getPhysicsConfig = useCallback((uuid) => {
    return managerRef.current?.getBodyConfig(uuid) ?? null;
  }, []);

  // Play/Pause/Reset
  const playPhysics = useCallback(() => {
    const mgr = managerRef.current;
    if (!mgr?.ready) return;

    // Sync all Three.js objects → physics bodies before starting
    const ws = workspaceRef?.current;
    if (ws) {
      for (const { uuid } of mgr.getAllBodies()) {
        const obj = ws.scene?.getObjectByProperty?.("uuid", uuid);
        if (obj) mgr.syncFromThreeObject(uuid, obj);
      }
    }

    mgr.play();
    setRunning(true);
  }, [workspaceRef]);

  const pausePhysics = useCallback(() => {
    managerRef.current?.pause();
    setRunning(false);
  }, []);

  const resetPhysics = useCallback(() => {
    const mgr = managerRef.current;
    if (!mgr) return;
    mgr.reset();
    setRunning(false);

    // Sync physics transforms back to Three.js
    const ws = workspaceRef?.current;
    if (ws) {
      for (const { uuid } of mgr.getAllBodies()) {
        const obj = ws.scene?.getObjectByProperty?.("uuid", uuid);
        if (obj) mgr.syncToThreeObject(uuid, obj);
      }
    }
  }, [workspaceRef]);

  // Step physics — called from render loop
  const stepPhysics = useCallback(() => {
    const mgr = managerRef.current;
    if (!mgr?.running) return false;

    const stepped = mgr.step();
    if (!stepped) return false;

    // Sync physics → Three.js for all dynamic bodies
    const ws = workspaceRef?.current;
    if (!ws) return true;

    let anyMoved = false;
    for (const [uuid, entry] of mgr._bodies) {
      if (entry.config.type === "static") continue;
      const obj = ws.scene?.getObjectByProperty?.("uuid", uuid);
      if (obj && mgr.syncToThreeObject(uuid, obj)) {
        anyMoved = true;
      }
    }
    return anyMoved;
  }, [workspaceRef]);

  // Gravity
  const setGravityPreset = useCallback((preset) => {
    managerRef.current?.setGravityPreset(preset);
    setGravityState(preset);
  }, []);

  // Joints
  const addJoint = useCallback((uuidA, uuidB, type, config) => {
    const id = managerRef.current?.addJoint(uuidA, uuidB, type, config);
    refreshBodies();
    return id;
  }, [refreshBodies]);

  const removeJoint = useCallback((jointId) => {
    managerRef.current?.removeJoint(jointId);
    refreshBodies();
  }, [refreshBodies]);

  const getJoints = useCallback(() => {
    return managerRef.current?.getJoints() ?? [];
  }, []);

  const getJointsForBody = useCallback((uuid) => {
    return managerRef.current?.getJointsForBody(uuid) ?? [];
  }, []);

  // Triggers
  const addTrigger = useCallback((uuid, config) => {
    return managerRef.current?.addTrigger(uuid, config) ?? null;
  }, []);

  const removeTrigger = useCallback((uuid) => {
    managerRef.current?.removeTrigger(uuid);
  }, []);

  // Force application
  const applyImpulse = useCallback((uuid, impulse) => {
    managerRef.current?.applyImpulse(uuid, impulse);
  }, []);

  const applyForce = useCallback((uuid, force) => {
    managerRef.current?.applyForce(uuid, force);
  }, []);

  // Debug visualization
  const getDebugLines = useCallback(() => {
    return managerRef.current?.getDebugLines() ?? null;
  }, []);

  // Ragdoll
  const createRagdoll = useCallback((rootBone, config) => {
    const parts = managerRef.current?.createRagdoll(rootBone, config) ?? [];
    refreshBodies();
    return parts;
  }, [refreshBodies]);

  // Bake physics to keyframes
  const bakeToKeyframes = useCallback((duration, fps) => {
    return managerRef.current?.bakeToKeyframes(duration, fps) ?? {};
  }, []);

  // Listen for scene:updated events to clean up removed objects
  useEffect(() => {
    const handler = (e) => {
      if (e?.type === "delete") {
        const mgr = managerRef.current;
        if (!mgr) return;
        // Clean up any physics bodies for deleted objects
        const allBodies = mgr.getAllBodies();
        const ws = workspaceRef?.current;
        if (!ws) return;
        for (const { uuid } of allBodies) {
          const obj = ws.scene?.getObjectByProperty?.("uuid", uuid);
          if (!obj) {
            mgr.removeBody(uuid);
          }
        }
        refreshBodies();
      }
    };
    EventBus.on("scene:updated", handler);
    return () => EventBus.off("scene:updated", handler);
  }, [workspaceRef, refreshBodies]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      managerRef.current?.dispose();
      managerRef.current = null;
    };
  }, []);

  return {
    ready,
    running,
    gravity,
    debugVisible,
    setDebugVisible,
    bodies,
    manager: managerRef,
    addPhysicsBody,
    removePhysicsBody,
    updatePhysicsBody,
    hasPhysicsBody,
    getPhysicsConfig,
    playPhysics,
    pausePhysics,
    resetPhysics,
    stepPhysics,
    setGravityPreset,
    addJoint,
    removeJoint,
    getJoints,
    getJointsForBody,
    addTrigger,
    removeTrigger,
    applyImpulse,
    applyForce,
    getDebugLines,
    createRagdoll,
    bakeToKeyframes,
    refreshBodies,
  };
}
