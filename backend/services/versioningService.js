// backend/services/versioningService.js
// Scene versioning with JSON diffs (RFC 6902-like) and periodic snapshots.

const Version = require("../models/Version");

const SNAPSHOT_INTERVAL = 10; // Store full snapshot every N versions

/**
 * Compute a minimal diff between two scene data objects.
 * Uses a simplified RFC 6902-like format for object-level changes.
 * Each scene is expected to be { objects: { [id]: {...} }, ... }
 */
function computeDiff(oldData, newData) {
  const ops = [];
  const oldObjects = oldData?.objects || {};
  const newObjects = newData?.objects || {};

  const allKeys = new Set([...Object.keys(oldObjects), ...Object.keys(newObjects)]);
  const added = [];
  const removed = [];
  const modified = [];

  for (const key of allKeys) {
    const oldVal = oldObjects[key];
    const newVal = newObjects[key];

    if (!oldVal && newVal) {
      ops.push({ op: "add", path: `/objects/${key}`, value: newVal });
      added.push(key);
    } else if (oldVal && !newVal) {
      ops.push({ op: "remove", path: `/objects/${key}` });
      removed.push(key);
    } else if (oldVal && newVal) {
      // Check for property-level changes
      const propOps = diffObject(oldVal, newVal, `/objects/${key}`);
      if (propOps.length > 0) {
        ops.push(...propOps);
        modified.push(key);
      }
    }
  }

  // Diff top-level non-objects keys (environment, camera, effects, etc.)
  for (const key of Object.keys(newData || {})) {
    if (key === "objects") continue;
    if (JSON.stringify(oldData?.[key]) !== JSON.stringify(newData?.[key])) {
      ops.push({ op: "replace", path: `/${key}`, value: newData[key] });
    }
  }
  // Check for removed top-level keys
  for (const key of Object.keys(oldData || {})) {
    if (key === "objects") continue;
    if (!(key in (newData || {}))) {
      ops.push({ op: "remove", path: `/${key}` });
    }
  }

  return { ops, added, removed, modified };
}

/**
 * Shallow diff two objects, returning patch ops for changed properties.
 */
function diffObject(oldObj, newObj, basePath) {
  const ops = [];
  const allKeys = new Set([...Object.keys(oldObj || {}), ...Object.keys(newObj || {})]);

  for (const key of allKeys) {
    const oldVal = oldObj?.[key];
    const newVal = newObj?.[key];
    const path = `${basePath}/${key}`;

    if (oldVal === undefined && newVal !== undefined) {
      ops.push({ op: "add", path, value: newVal });
    } else if (oldVal !== undefined && newVal === undefined) {
      ops.push({ op: "remove", path });
    } else if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
      ops.push({ op: "replace", path, value: newVal });
    }
  }

  return ops;
}

/**
 * Apply a diff to reconstruct data from a snapshot + subsequent diffs.
 */
function applyDiff(data, diff) {
  const result = JSON.parse(JSON.stringify(data)); // deep clone

  for (const op of diff) {
    const pathParts = op.path.split("/").filter(Boolean);

    if (op.op === "add" || op.op === "replace") {
      setDeep(result, pathParts, op.value);
    } else if (op.op === "remove") {
      removeDeep(result, pathParts);
    }
  }

  return result;
}

function setDeep(obj, pathParts, value) {
  let current = obj;
  for (let i = 0; i < pathParts.length - 1; i++) {
    if (current[pathParts[i]] === undefined) current[pathParts[i]] = {};
    current = current[pathParts[i]];
  }
  current[pathParts[pathParts.length - 1]] = JSON.parse(JSON.stringify(value));
}

function removeDeep(obj, pathParts) {
  let current = obj;
  for (let i = 0; i < pathParts.length - 1; i++) {
    if (!current[pathParts[i]]) return;
    current = current[pathParts[i]];
  }
  delete current[pathParts[pathParts.length - 1]];
}

/**
 * Create a new version for a project save.
 * @param {string} projectId
 * @param {string} authorId
 * @param {object} newSceneData - current full scene data
 * @param {string} message - optional commit message
 */
async function createVersion(projectId, authorId, newSceneData, message = "") {
  // Get the latest version for this project
  const latestVersion = await Version.findOne({ project: projectId })
    .sort({ versionNumber: -1 })
    .lean();

  const versionNumber = latestVersion ? latestVersion.versionNumber + 1 : 1;
  const isSnapshot = versionNumber === 1 || versionNumber % SNAPSHOT_INTERVAL === 0;

  let diff = null;
  let diffSize = 0;
  let added = [];
  let removed = [];
  let modified = [];

  if (latestVersion) {
    // We need the previous full state to compute diff
    const prevState = await reconstructVersion(projectId, latestVersion.versionNumber);
    const diffResult = computeDiff(prevState, newSceneData);
    diff = diffResult.ops;
    diffSize = JSON.stringify(diff).length;
    added = diffResult.added;
    removed = diffResult.removed;
    modified = diffResult.modified;

    // Skip empty diffs (no changes)
    if (diff.length === 0 && !isSnapshot) return latestVersion;
  }

  const objectCount = Object.keys(newSceneData?.objects || {}).length;

  const version = await Version.create({
    project: projectId,
    versionNumber,
    author: authorId,
    message: message || `Save #${versionNumber}`,
    diff: isSnapshot ? null : diff,
    diffSize: isSnapshot ? 0 : diffSize,
    snapshot: isSnapshot ? newSceneData : null,
    snapshotSize: isSnapshot ? JSON.stringify(newSceneData).length : 0,
    isSnapshot,
    objectCount,
    addedObjects: added,
    removedObjects: removed,
    modifiedObjects: modified,
  });

  return version;
}

/**
 * Reconstruct the scene state at a given version number.
 */
async function reconstructVersion(projectId, targetVersionNumber) {
  // Find the nearest snapshot at or before the target
  const snapshot = await Version.findOne({
    project: projectId,
    versionNumber: { $lte: targetVersionNumber },
    isSnapshot: true,
  })
    .sort({ versionNumber: -1 })
    .lean();

  if (!snapshot) {
    // No snapshot found — this shouldn't happen if version 1 is always a snapshot
    // Fall back to empty state
    return { objects: {} };
  }

  let state = snapshot.snapshot || { objects: {} };

  // Apply all diffs between the snapshot and the target version
  if (snapshot.versionNumber < targetVersionNumber) {
    const diffs = await Version.find({
      project: projectId,
      versionNumber: { $gt: snapshot.versionNumber, $lte: targetVersionNumber },
      isSnapshot: false,
    })
      .sort({ versionNumber: 1 })
      .lean();

    for (const v of diffs) {
      if (v.diff && v.diff.length > 0) {
        state = applyDiff(state, v.diff);
      }
    }
  }

  return state;
}

/**
 * Get version history for a project (metadata only, no diffs/snapshots).
 */
async function getVersionHistory(projectId, { page = 1, limit = 20 } = {}) {
  const skip = (Math.max(1, page) - 1) * limit;
  const [versions, total] = await Promise.all([
    Version.find({ project: projectId })
      .select("-diff -snapshot")
      .populate("author", "name email avatar")
      .sort({ versionNumber: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Version.countDocuments({ project: projectId }),
  ]);

  return { versions, total, page, totalPages: Math.ceil(total / limit) };
}

/**
 * Get the diff summary between two versions.
 */
async function getVersionDiff(projectId, fromVersion, toVersion) {
  const [fromState, toState] = await Promise.all([
    reconstructVersion(projectId, fromVersion),
    reconstructVersion(projectId, toVersion),
  ]);

  const { ops, added, removed, modified } = computeDiff(fromState, toState);

  return {
    from: fromVersion,
    to: toVersion,
    ops,
    summary: {
      added: added.length,
      removed: removed.length,
      modified: modified.length,
      addedIds: added,
      removedIds: removed,
      modifiedIds: modified,
    },
  };
}

module.exports = {
  computeDiff,
  applyDiff,
  createVersion,
  reconstructVersion,
  getVersionHistory,
  getVersionDiff,
  SNAPSHOT_INTERVAL,
};
