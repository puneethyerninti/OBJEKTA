// backend/middleware/projectPermissions.js
// Middleware to check project-level permissions (owner, editor, viewer).

const Project = require('../models/Project');

/**
 * Returns the user's role for a given project.
 * @param {string} userId
 * @param {object} project - Mongoose Project document
 * @returns {'owner' | 'editor' | 'viewer' | null}
 */
function getUserRole(userId, project) {
  if (!userId || !project) return null;
  const uid = String(userId);

  // Owner check
  if (project.user && String(project.user) === uid) return 'owner';
  if (project.user?._id && String(project.user._id) === uid) return 'owner';

  // Collaborator check
  const isCollab = (project.collaborators || []).some(c => String(c._id || c) === uid);
  if (!isCollab) return null;

  // Check explicit role
  const roles = project.collaboratorRoles;
  if (roles && roles instanceof Map) {
    return roles.get(uid) || 'editor'; // default collaborators to editor
  }
  if (roles && typeof roles === 'object') {
    return roles[uid] || 'editor';
  }
  return 'editor';
}

/**
 * Middleware factory: require at least the given permission level.
 * Permission hierarchy: owner > editor > viewer
 * Expects req.params.projectId or req.params.id and req.user._id
 */
function requireProjectRole(...allowedRoles) {
  return async (req, res, next) => {
    try {
      const projectId = req.params.projectId || req.params.id;
      if (!projectId) return res.status(400).json({ error: 'Missing project ID' });

      const userId = req.user?._id || req.user?.id;
      if (!userId) return res.status(401).json({ error: 'Not authenticated' });

      const project = await Project.findById(projectId).lean();
      if (!project) return res.status(404).json({ error: 'Project not found' });

      const role = getUserRole(userId, project);
      if (!role) return res.status(403).json({ error: 'Not a collaborator on this project' });

      if (!allowedRoles.includes(role)) {
        return res.status(403).json({ error: `Role "${role}" insufficient. Required: ${allowedRoles.join('/')}` });
      }

      req.projectRole = role;
      req.project = project;
      next();
    } catch (err) {
      console.error('[projectPermissions] Error:', err.message);
      res.status(500).json({ error: 'Permission check failed' });
    }
  };
}

module.exports = { getUserRole, requireProjectRole };
