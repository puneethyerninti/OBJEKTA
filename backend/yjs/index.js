// backend/yjs/index.js
// Y-WebSocket server integration for Yjs CRDT collaboration.
// Attaches a WebSocket upgrade handler to the existing HTTP server.
// Each project gets its own Y.Doc, keyed by projectId.

const WebSocket = require('ws');
const Project = require('../models/Project');
const { setupWSConnection, getYDoc } = require('./yjsServer');
const { verifyAccessToken } = require('../middleware/authMiddleware');

let wss = null;

function parseCookieToken(cookieHeader) {
  if (!cookieHeader || typeof cookieHeader !== 'string') return null;
  const parts = cookieHeader.split(';').map((part) => part.trim());
  for (const part of parts) {
    if (part.startsWith('objekta_token=')) {
      return decodeURIComponent(part.slice('objekta_token='.length));
    }
    if (part.startsWith('accessToken=')) {
      return decodeURIComponent(part.slice('accessToken='.length));
    }
  }
  return null;
}

function writeUpgradeError(socket, statusCode, statusText) {
  try {
    socket.write(`HTTP/1.1 ${statusCode} ${statusText}\r\nConnection: close\r\n\r\n`);
  } catch (e) {
    // ignore
  }
  try {
    socket.destroy();
  } catch (e) {
    // ignore
  }
}

async function canAccessProject(projectId, userId) {
  try {
    if (!projectId || !userId) return false;
    const project = await Project.findById(projectId).select('user collaborators').lean();
    if (!project) return false;

    const uid = String(userId);
    const ownerId = project.user?._id ? String(project.user._id) : project.user ? String(project.user) : null;
    if (ownerId && ownerId === uid) return true;

    if (Array.isArray(project.collaborators)) {
      return project.collaborators.some((c) => {
        const cid = c?._id ? String(c._id) : String(c);
        return cid === uid;
      });
    }

    return false;
  } catch (err) {
    return false;
  }
}

/**
 * Attach the Yjs WebSocket server to an existing HTTP server.
 * Clients connect via ws(s)://host/yjs/:projectId
 */
function initYjs(httpServer) {
  if (wss) return wss;

  wss = new WebSocket.Server({ noServer: true });

  httpServer.on('upgrade', async (request, socket, head) => {
    // Only handle /yjs/<projectId> paths
    const url = new URL(request.url, `http://${request.headers.host}`);
    // Accept /yjs/<projectId> or /yjs/<projectId>/<roomName> (y-websocket client appends room name)
    const match = url.pathname.match(/^\/yjs\/([a-zA-Z0-9_-]+)(?:\/.*)?$/);

    if (!match) {
      // Not a Yjs path — let socket.io or other handlers deal with it
      return;
    }

    const projectId = match[1];

    const tokenFromQuery = url.searchParams.get('token');
    const authHeader = request.headers.authorization;
    const tokenFromHeader = typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
      ? authHeader.split(' ')[1]
      : null;
    const tokenFromCookie = parseCookieToken(request.headers.cookie);
    const token = tokenFromQuery || tokenFromHeader || tokenFromCookie;

    const decoded = verifyAccessToken(token);
    if (!decoded?.id) {
      writeUpgradeError(socket, 401, 'Unauthorized');
      return;
    }

    const allowed = await canAccessProject(projectId, decoded.id);
    if (!allowed) {
      writeUpgradeError(socket, 403, 'Forbidden');
      return;
    }

    wss.handleUpgrade(request, socket, head, (ws) => {
      ws.projectId = projectId;
      ws.userId = String(decoded.id);
      wss.emit('connection', ws, request, projectId);
    });
  });

  wss.on('connection', (ws, request, projectId) => {
    const docName = `project:${projectId}`;
    setupWSConnection(ws, request, { docName, userId: ws.userId || null });
    console.log(`[Yjs] Client connected to doc "${docName}"`);
  });

  console.log('[Yjs] WebSocket server attached (upgrade handler on /yjs/:projectId)');
  return wss;
}

/**
 * Get the Y.Doc for a given project (creates if not yet active)
 */
function getProjectDoc(projectId) {
  return getYDoc(`project:${projectId}`);
}

module.exports = { initYjs, getProjectDoc };
