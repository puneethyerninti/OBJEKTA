// src/engine/PhysicsManager.js
// Core physics engine wrapping Rapier3D WASM
import RAPIER from "@dimforge/rapier3d-compat";

const GRAVITY_PRESETS = {
  earth: { x: 0, y: -9.81, z: 0 },
  moon: { x: 0, y: -1.62, z: 0 },
  mars: { x: 0, y: -3.72, z: 0 },
  zeroG: { x: 0, y: 0, z: 0 },
  water: { x: 0, y: -2.0, z: 0 },
  jupiter: { x: 0, y: -24.79, z: 0 },
};

const COLLIDER_TYPES = ["box", "sphere", "capsule", "cylinder", "convexHull", "trimesh"];

const BODY_TYPES = ["dynamic", "static", "kinematicPosition", "kinematicVelocity"];

const JOINT_TYPES = ["fixed", "revolute", "prismatic", "spherical", "spring"];

export { GRAVITY_PRESETS, COLLIDER_TYPES, BODY_TYPES, JOINT_TYPES };

export default class PhysicsManager {
  constructor() {
    this._rapier = null;
    this._world = null;
    this._running = false;
    this._ready = false;

    // body tracking: uuid → { rigidBody, collider, config }
    this._bodies = new Map();
    // joint tracking: jointId → { joint, bodyA_uuid, bodyB_uuid, config }
    this._joints = new Map();
    // trigger tracking: uuid → { collider, config }
    this._triggers = new Map();
    // snapshot for reset
    this._snapshot = null;

    this._fixedTimeStep = 1 / 60;
    this._subSteps = 1;
    this._gravityPreset = "earth";
    this._eventQueue = null;

    // callbacks
    this._onContactStart = null;
    this._onContactEnd = null;
    this._onTriggerEnter = null;
    this._onTriggerExit = null;
  }

  /* ───── Initialization ───── */

  async init() {
    if (this._ready) return;
    await RAPIER.init();
    this._rapier = RAPIER;
    const g = GRAVITY_PRESETS.earth;
    this._world = new RAPIER.World(new RAPIER.Vector3(g.x, g.y, g.z));
    this._eventQueue = new RAPIER.EventQueue(true);
    this._ready = true;
  }

  get ready() { return this._ready; }
  get running() { return this._running; }
  get world() { return this._world; }
  get rapier() { return this._rapier; }

  /* ───── Simulation Control ───── */

  play() {
    if (!this._ready) return;
    this._snapshot = this.takeSnapshot();
    this._running = true;
  }

  pause() { this._running = false; }

  reset() {
    this._running = false;
    if (this._snapshot) {
      this.restoreSnapshot(this._snapshot);
    }
  }

  step(dt) {
    if (!this._ready || !this._running) return false;
    this._world.timestep = this._fixedTimeStep;
    for (let i = 0; i < this._subSteps; i++) {
      this._world.step(this._eventQueue);
    }
    this._processEvents();
    return true;
  }

  /* ───── Gravity ───── */

  setGravity(x, y, z) {
    if (!this._world) return;
    this._world.gravity = new this._rapier.Vector3(x, y, z);
  }

  setGravityPreset(name) {
    const p = GRAVITY_PRESETS[name];
    if (!p) return;
    this._gravityPreset = name;
    this.setGravity(p.x, p.y, p.z);
  }

  getGravityPreset() { return this._gravityPreset; }

  getGravity() {
    if (!this._world) return { x: 0, y: -9.81, z: 0 };
    const g = this._world.gravity;
    return { x: g.x, y: g.y, z: g.z };
  }

  /* ───── Rigid Body Management ───── */

  addBody(uuid, config = {}) {
    if (!this._ready) return null;
    if (this._bodies.has(uuid)) this.removeBody(uuid);

    const {
      type = "dynamic",
      position = { x: 0, y: 0, z: 0 },
      rotation = { x: 0, y: 0, z: 0, w: 1 },
      mass = 1,
      friction = 0.5,
      restitution = 0.3,
      linearDamping = 0.01,
      angularDamping = 0.05,
      colliderType = "box",
      colliderSize = { x: 0.5, y: 0.5, z: 0.5 },
      radius = 0.5,
      halfHeight = 0.5,
      vertices = null,
      indices = null,
      ccdEnabled = false,
      gravityScale = 1.0,
    } = config;

    // Create rigid body descriptor
    let bodyDesc;
    switch (type) {
      case "static":
        bodyDesc = this._rapier.RigidBodyDesc.fixed();
        break;
      case "kinematicPosition":
        bodyDesc = this._rapier.RigidBodyDesc.kinematicPositionBased();
        break;
      case "kinematicVelocity":
        bodyDesc = this._rapier.RigidBodyDesc.kinematicVelocityBased();
        break;
      default:
        bodyDesc = this._rapier.RigidBodyDesc.dynamic();
        break;
    }

    bodyDesc.setTranslation(position.x, position.y, position.z);
    bodyDesc.setRotation(rotation);
    bodyDesc.setLinearDamping(linearDamping);
    bodyDesc.setAngularDamping(angularDamping);
    bodyDesc.setGravityScale(gravityScale);
    if (ccdEnabled) bodyDesc.setCcdEnabled(true);

    const body = this._world.createRigidBody(bodyDesc);

    // Create collider
    const collider = this._createCollider(body, colliderType, {
      colliderSize, radius, halfHeight, vertices, indices,
      mass, friction, restitution,
    });

    this._bodies.set(uuid, { rigidBody: body, collider, config: { ...config, type } });
    return body;
  }

  removeBody(uuid) {
    const entry = this._bodies.get(uuid);
    if (!entry) return;
    // Remove any joints connected to this body
    for (const [jid, jdata] of this._joints) {
      if (jdata.bodyA_uuid === uuid || jdata.bodyB_uuid === uuid) {
        this.removeJoint(jid);
      }
    }
    try { this._world.removeRigidBody(entry.rigidBody); } catch (e) {}
    this._bodies.delete(uuid);
  }

  hasBody(uuid) { return this._bodies.has(uuid); }

  getBody(uuid) { return this._bodies.get(uuid)?.rigidBody ?? null; }

  getBodyConfig(uuid) { return this._bodies.get(uuid)?.config ?? null; }

  updateBodyConfig(uuid, patch) {
    const entry = this._bodies.get(uuid);
    if (!entry) return;
    const newConfig = { ...entry.config, ...patch };

    // If body type changed, rebuild
    if (patch.type && patch.type !== entry.config.type) {
      const pos = entry.rigidBody.translation();
      const rot = entry.rigidBody.rotation();
      newConfig.position = { x: pos.x, y: pos.y, z: pos.z };
      newConfig.rotation = { x: rot.x, y: rot.y, z: rot.z, w: rot.w };
      this.removeBody(uuid);
      this.addBody(uuid, newConfig);
      return;
    }

    // Update properties in place
    const body = entry.rigidBody;
    if (patch.linearDamping != null) body.setLinearDamping(patch.linearDamping);
    if (patch.angularDamping != null) body.setAngularDamping(patch.angularDamping);
    if (patch.gravityScale != null) body.setGravityScale(patch.gravityScale, true);
    if (patch.ccdEnabled != null) body.enableCcd(patch.ccdEnabled);

    // If collider properties changed, rebuild collider
    if (patch.colliderType || patch.colliderSize || patch.radius || patch.halfHeight ||
        patch.mass != null || patch.friction != null || patch.restitution != null) {
      if (entry.collider) {
        try { this._world.removeCollider(entry.collider, false); } catch (e) {}
      }
      const merged = { ...entry.config, ...patch };
      entry.collider = this._createCollider(body, merged.colliderType || "box", {
        colliderSize: merged.colliderSize || { x: 0.5, y: 0.5, z: 0.5 },
        radius: merged.radius || 0.5,
        halfHeight: merged.halfHeight || 0.5,
        vertices: merged.vertices,
        indices: merged.indices,
        mass: merged.mass ?? 1,
        friction: merged.friction ?? 0.5,
        restitution: merged.restitution ?? 0.3,
      });
    }

    entry.config = newConfig;
  }

  /* ───── Collider Creation ───── */

  _createCollider(body, type, opts) {
    const { colliderSize, radius, halfHeight, vertices, indices, mass, friction, restitution } = opts;
    let desc;

    switch (type) {
      case "sphere":
        desc = this._rapier.ColliderDesc.ball(radius);
        break;
      case "capsule":
        desc = this._rapier.ColliderDesc.capsule(halfHeight, radius);
        break;
      case "cylinder":
        desc = this._rapier.ColliderDesc.cylinder(halfHeight, radius);
        break;
      case "convexHull":
        if (vertices) {
          desc = this._rapier.ColliderDesc.convexHull(new Float32Array(vertices));
        }
        if (!desc) desc = this._rapier.ColliderDesc.cuboid(colliderSize.x, colliderSize.y, colliderSize.z);
        break;
      case "trimesh":
        if (vertices && indices) {
          desc = this._rapier.ColliderDesc.trimesh(
            new Float32Array(vertices),
            new Uint32Array(indices)
          );
        }
        if (!desc) desc = this._rapier.ColliderDesc.cuboid(colliderSize.x, colliderSize.y, colliderSize.z);
        break;
      default: // box
        desc = this._rapier.ColliderDesc.cuboid(colliderSize.x, colliderSize.y, colliderSize.z);
        break;
    }

    desc.setMass(mass);
    desc.setFriction(friction);
    desc.setRestitution(restitution);

    return this._world.createCollider(desc, body);
  }

  /* ───── Auto Collider from Three.js Object ───── */

  computeColliderConfig(object3d, colliderType = "box") {
    if (!object3d) return null;
    const THREE = globalThis.THREE || (object3d.constructor?.prototype?.isObject3D ? null : null);

    // Compute bounding box in local space
    const box = new (object3d.constructor?.prototype?.isObject3D ? 
      Object.getPrototypeOf(object3d).constructor : Function)();
    
    // Use geometry if available directly
    let geometry = object3d.geometry;
    if (!geometry) {
      // Try to find first mesh in hierarchy
      object3d.traverse?.(c => { if (!geometry && c.geometry) geometry = c.geometry; });
    }
    if (!geometry) return { colliderType: "box", colliderSize: { x: 0.5, y: 0.5, z: 0.5 } };

    geometry.computeBoundingBox?.();
    const bb = geometry.boundingBox;
    if (!bb) return { colliderType: "box", colliderSize: { x: 0.5, y: 0.5, z: 0.5 } };

    const sx = object3d.scale?.x ?? 1;
    const sy = object3d.scale?.y ?? 1;
    const sz = object3d.scale?.z ?? 1;

    const halfX = ((bb.max.x - bb.min.x) / 2) * Math.abs(sx);
    const halfY = ((bb.max.y - bb.min.y) / 2) * Math.abs(sy);
    const halfZ = ((bb.max.z - bb.min.z) / 2) * Math.abs(sz);

    const result = {
      colliderType,
      colliderSize: { x: halfX || 0.5, y: halfY || 0.5, z: halfZ || 0.5 },
      radius: Math.max(halfX, halfY, halfZ) || 0.5,
      halfHeight: halfY || 0.5,
    };

    if (colliderType === "convexHull" || colliderType === "trimesh") {
      const pos = geometry.attributes?.position;
      if (pos) {
        const arr = [];
        for (let i = 0; i < pos.count; i++) {
          arr.push(pos.getX(i) * sx, pos.getY(i) * sy, pos.getZ(i) * sz);
        }
        result.vertices = arr;
      }
      if (colliderType === "trimesh" && geometry.index) {
        result.indices = Array.from(geometry.index.array);
      }
    }

    return result;
  }

  /* ───── Body Transform Sync ───── */

  syncToThreeObject(uuid, object3d) {
    const entry = this._bodies.get(uuid);
    if (!entry || !object3d) return false;
    const body = entry.rigidBody;
    const pos = body.translation();
    const rot = body.rotation();
    object3d.position.set(pos.x, pos.y, pos.z);
    object3d.quaternion.set(rot.x, rot.y, rot.z, rot.w);
    return true;
  }

  syncFromThreeObject(uuid, object3d) {
    const entry = this._bodies.get(uuid);
    if (!entry || !object3d) return;
    const body = entry.rigidBody;
    const p = object3d.position;
    const q = object3d.quaternion;
    if (entry.config.type === "kinematicPosition") {
      body.setNextKinematicTranslation({ x: p.x, y: p.y, z: p.z });
      body.setNextKinematicRotation({ x: q.x, y: q.y, z: q.z, w: q.w });
    } else {
      body.setTranslation({ x: p.x, y: p.y, z: p.z }, true);
      body.setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }, true);
      body.setLinvel({ x: 0, y: 0, z: 0 }, true);
      body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    }
  }

  /* ───── Forces & Impulses ───── */

  applyForce(uuid, force) {
    const body = this.getBody(uuid);
    if (!body) return;
    body.addForce(new this._rapier.Vector3(force.x, force.y, force.z), true);
  }

  applyImpulse(uuid, impulse) {
    const body = this.getBody(uuid);
    if (!body) return;
    body.applyImpulse(new this._rapier.Vector3(impulse.x, impulse.y, impulse.z), true);
  }

  applyTorque(uuid, torque) {
    const body = this.getBody(uuid);
    if (!body) return;
    body.addTorque(new this._rapier.Vector3(torque.x, torque.y, torque.z), true);
  }

  applyTorqueImpulse(uuid, impulse) {
    const body = this.getBody(uuid);
    if (!body) return;
    body.applyTorqueImpulse(new this._rapier.Vector3(impulse.x, impulse.y, impulse.z), true);
  }

  /* ───── Joints ───── */

  _nextJointId = 0;

  addJoint(uuidA, uuidB, type, config = {}) {
    const bodyA = this.getBody(uuidA);
    const bodyB = this.getBody(uuidB);
    if (!bodyA || !bodyB) return null;

    const {
      anchorA = { x: 0, y: 0, z: 0 },
      anchorB = { x: 0, y: 0, z: 0 },
      axis = { x: 0, y: 1, z: 0 },
      limitsEnabled = false,
      limitsMin = -Math.PI,
      limitsMax = Math.PI,
      stiffness = 0,
      damping = 0,
      restLength = 0,
    } = config;

    let jointData;
    const aA = new this._rapier.Vector3(anchorA.x, anchorA.y, anchorA.z);
    const aB = new this._rapier.Vector3(anchorB.x, anchorB.y, anchorB.z);
    const ax = new this._rapier.Vector3(axis.x, axis.y, axis.z);

    switch (type) {
      case "fixed":
        jointData = this._rapier.JointData.fixed(
          aA, { x: 0, y: 0, z: 0, w: 1 },
          aB, { x: 0, y: 0, z: 0, w: 1 }
        );
        break;
      case "revolute":
        jointData = this._rapier.JointData.revolute(aA, aB, ax);
        if (limitsEnabled) jointData.limitsEnabled = true;
        if (limitsEnabled) { jointData.limits = [limitsMin, limitsMax]; }
        break;
      case "prismatic":
        jointData = this._rapier.JointData.prismatic(aA, aB, ax);
        if (limitsEnabled) jointData.limitsEnabled = true;
        if (limitsEnabled) { jointData.limits = [limitsMin, limitsMax]; }
        break;
      case "spherical":
        jointData = this._rapier.JointData.spherical(aA, aB);
        break;
      case "spring":
        jointData = this._rapier.JointData.spring(restLength, stiffness, damping, aA, aB);
        break;
      default:
        return null;
    }

    const joint = this._world.createImpulseJoint(jointData, bodyA, bodyB, true);
    const id = `joint_${this._nextJointId++}`;
    this._joints.set(id, {
      joint,
      bodyA_uuid: uuidA,
      bodyB_uuid: uuidB,
      type,
      config: { anchorA, anchorB, axis, limitsEnabled, limitsMin, limitsMax, stiffness, damping, restLength },
    });
    return id;
  }

  removeJoint(jointId) {
    const entry = this._joints.get(jointId);
    if (!entry) return;
    try { this._world.removeImpulseJoint(entry.joint, true); } catch (e) {}
    this._joints.delete(jointId);
  }

  getJoints() {
    return Array.from(this._joints.entries()).map(([id, data]) => ({
      id,
      bodyA: data.bodyA_uuid,
      bodyB: data.bodyB_uuid,
      type: data.type,
      config: data.config,
    }));
  }

  getJointsForBody(uuid) {
    return this.getJoints().filter(j => j.bodyA === uuid || j.bodyB === uuid);
  }

  /* ───── Trigger Volumes ───── */

  addTrigger(uuid, config = {}) {
    if (!this._ready) return null;
    if (this._triggers.has(uuid)) this.removeTrigger(uuid);

    const {
      position = { x: 0, y: 0, z: 0 },
      size = { x: 1, y: 1, z: 1 },
      shape = "box",
      radius = 1,
    } = config;

    // Triggers use a fixed body + sensor collider
    const bodyDesc = this._rapier.RigidBodyDesc.fixed()
      .setTranslation(position.x, position.y, position.z);
    const body = this._world.createRigidBody(bodyDesc);

    let colliderDesc;
    if (shape === "sphere") {
      colliderDesc = this._rapier.ColliderDesc.ball(radius);
    } else {
      colliderDesc = this._rapier.ColliderDesc.cuboid(size.x / 2, size.y / 2, size.z / 2);
    }
    colliderDesc.setSensor(true);

    const collider = this._world.createCollider(colliderDesc, body);
    this._triggers.set(uuid, { body, collider, config: { ...config, shape } });
    return collider;
  }

  removeTrigger(uuid) {
    const entry = this._triggers.get(uuid);
    if (!entry) return;
    try { this._world.removeRigidBody(entry.body); } catch (e) {}
    this._triggers.delete(uuid);
  }

  hasTrigger(uuid) { return this._triggers.has(uuid); }

  /* ───── Raycasting ───── */

  raycast(origin, direction, maxDist = 100) {
    if (!this._ready) return null;
    const ray = new this._rapier.Ray(
      new this._rapier.Vector3(origin.x, origin.y, origin.z),
      new this._rapier.Vector3(direction.x, direction.y, direction.z)
    );
    const hit = this._world.castRay(ray, maxDist, true);
    if (!hit) return null;
    const point = ray.pointAt(hit.timeOfImpact);
    // Find which uuid this collider belongs to
    let hitUuid = null;
    for (const [uuid, entry] of this._bodies) {
      if (entry.collider?.handle === hit.collider?.handle) {
        hitUuid = uuid;
        break;
      }
    }
    return { uuid: hitUuid, point: { x: point.x, y: point.y, z: point.z }, distance: hit.timeOfImpact };
  }

  /* ───── Ragdoll System ───── */

  createRagdoll(rootBone, config = {}) {
    if (!rootBone) return [];
    const {
      mass = 1,
      friction = 0.5,
      restitution = 0.1,
      jointLimitsMin = -Math.PI / 4,
      jointLimitsMax = Math.PI / 4,
    } = config;

    const ragdollParts = [];
    const boneToUuid = new Map();

    const processBone = (bone, parentUuid) => {
      if (!bone.isBone) return;
      const uuid = bone.uuid;
      const worldPos = { x: 0, y: 0, z: 0 };
      if (bone.getWorldPosition) {
        const wp = bone.getWorldPosition(
          new (bone.position.constructor)(0, 0, 0)
        );
        worldPos.x = wp.x;
        worldPos.y = wp.y;
        worldPos.z = wp.z;
      }

      // Estimate capsule size from bone length
      let boneLength = 0.2;
      if (bone.children.length > 0) {
        const childBone = bone.children.find(c => c.isBone);
        if (childBone) {
          boneLength = Math.max(0.05, childBone.position.length());
        }
      }

      this.addBody(uuid, {
        type: parentUuid ? "dynamic" : "kinematicPosition",
        position: worldPos,
        mass,
        friction,
        restitution,
        colliderType: "capsule",
        radius: boneLength * 0.15,
        halfHeight: boneLength * 0.4,
      });

      boneToUuid.set(bone, uuid);

      if (parentUuid) {
        const jointId = this.addJoint(parentUuid, uuid, "revolute", {
          axis: { x: 0, y: 0, z: 1 },
          limitsEnabled: true,
          limitsMin: jointLimitsMin,
          limitsMax: jointLimitsMax,
        });
        ragdollParts.push({ boneUuid: uuid, parentUuid, jointId });
      } else {
        ragdollParts.push({ boneUuid: uuid, parentUuid: null, jointId: null });
      }

      for (const child of bone.children) {
        processBone(child, uuid);
      }
    };

    processBone(rootBone, null);
    return ragdollParts;
  }

  /* ───── Snapshot / Restore ───── */

  takeSnapshot() {
    const bodies = {};
    for (const [uuid, entry] of this._bodies) {
      const b = entry.rigidBody;
      const t = b.translation();
      const r = b.rotation();
      const lv = b.linvel();
      const av = b.angvel();
      bodies[uuid] = {
        config: { ...entry.config },
        position: { x: t.x, y: t.y, z: t.z },
        rotation: { x: r.x, y: r.y, z: r.z, w: r.w },
        linvel: { x: lv.x, y: lv.y, z: lv.z },
        angvel: { x: av.x, y: av.y, z: av.z },
      };
    }
    return { bodies, gravity: this.getGravity(), preset: this._gravityPreset };
  }

  restoreSnapshot(snapshot) {
    if (!snapshot) return;
    this._running = false;

    // Restore gravity
    this.setGravity(snapshot.gravity.x, snapshot.gravity.y, snapshot.gravity.z);
    this._gravityPreset = snapshot.preset || "earth";

    // Restore body states
    for (const [uuid, data] of Object.entries(snapshot.bodies)) {
      const entry = this._bodies.get(uuid);
      if (!entry) continue;
      const body = entry.rigidBody;
      body.setTranslation(data.position, true);
      body.setRotation(data.rotation, true);
      body.setLinvel(data.linvel, true);
      body.setAngvel(data.angvel, true);
    }
  }

  /* ───── Physics Bake to Animation ───── */

  bakeToKeyframes(duration = 5, fps = 30) {
    if (!this._ready) return {};
    const snapshot = this.takeSnapshot();
    const totalFrames = Math.ceil(duration * fps);
    const dt = 1 / fps;
    const tracks = {}; // uuid → [{ time, position, rotation }]

    // Temporarily enable simulation
    const wasRunning = this._running;
    this._running = true;
    this._world.timestep = dt;

    for (let f = 0; f <= totalFrames; f++) {
      for (const [uuid] of this._bodies) {
        const body = this._bodies.get(uuid)?.rigidBody;
        if (!body) continue;
        if (!tracks[uuid]) tracks[uuid] = [];
        const pos = body.translation();
        const rot = body.rotation();
        tracks[uuid].push({
          time: f * dt,
          position: { x: pos.x, y: pos.y, z: pos.z },
          rotation: { x: rot.x, y: rot.y, z: rot.z, w: rot.w },
        });
      }
      if (f < totalFrames) {
        this._world.step(this._eventQueue);
      }
    }

    // Restore original state
    this._running = wasRunning;
    this.restoreSnapshot(snapshot);
    return tracks;
  }

  /* ───── Event Processing ───── */

  _processEvents() {
    if (!this._eventQueue) return;
    this._eventQueue.drainCollisionEvents((h1, h2, started) => {
      // Find associated UUIDs
      let uuid1 = null, uuid2 = null;
      let isTrigger1 = false, isTrigger2 = false;

      for (const [uuid, entry] of this._bodies) {
        if (entry.collider?.handle === h1) uuid1 = uuid;
        if (entry.collider?.handle === h2) uuid2 = uuid;
      }
      for (const [uuid, entry] of this._triggers) {
        if (entry.collider?.handle === h1) { uuid1 = uuid; isTrigger1 = true; }
        if (entry.collider?.handle === h2) { uuid2 = uuid; isTrigger2 = true; }
      }

      if (isTrigger1 || isTrigger2) {
        if (started) {
          this._onTriggerEnter?.(uuid1, uuid2);
        } else {
          this._onTriggerExit?.(uuid1, uuid2);
        }
      } else {
        if (started) {
          this._onContactStart?.(uuid1, uuid2);
        } else {
          this._onContactEnd?.(uuid1, uuid2);
        }
      }
    });
  }

  onContactStart(fn) { this._onContactStart = fn; }
  onContactEnd(fn) { this._onContactEnd = fn; }
  onTriggerEnter(fn) { this._onTriggerEnter = fn; }
  onTriggerExit(fn) { this._onTriggerExit = fn; }

  /* ───── Config Accessors ───── */

  setTimeStep(dt) { this._fixedTimeStep = dt; }
  getTimeStep() { return this._fixedTimeStep; }
  setSubSteps(n) { this._subSteps = Math.max(1, n); }
  getSubSteps() { return this._subSteps; }

  /* ───── Debug ───── */

  getDebugLines() {
    if (!this._ready) return null;
    try {
      const buffers = this._world.debugRender();
      return buffers; // { vertices: Float32Array, colors: Float32Array }
    } catch (e) {
      return null;
    }
  }

  /* ───── Cleanup ───── */

  getAllBodies() {
    return Array.from(this._bodies.entries()).map(([uuid, entry]) => ({
      uuid,
      type: entry.config.type,
      colliderType: entry.config.colliderType,
      mass: entry.config.mass,
    }));
  }

  dispose() {
    this._running = false;
    for (const [uuid] of this._bodies) {
      try { this.removeBody(uuid); } catch (e) {}
    }
    for (const [uuid] of this._triggers) {
      try { this.removeTrigger(uuid); } catch (e) {}
    }
    this._bodies.clear();
    this._joints.clear();
    this._triggers.clear();
    try { this._world?.free?.(); } catch (e) {}
    this._world = null;
    this._ready = false;
    this._snapshot = null;
  }
}
