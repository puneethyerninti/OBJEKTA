// backend/yjs/index.js
// Y-WebSocket server integration for Yjs CRDT collaboration.
// Attaches a WebSocket upgrade handler to the existing HTTP server.
// Each project gets its own Y.Doc, keyed by projectId.

const WebSocket = require('ws');
const Y = require('yjs');
const { setupWSConnection, getYDoc } = require('./yjsServer');

let wss = null;

/**
 * Attach the Yjs WebSocket server to an existing HTTP server.
 * Clients connect via ws(s)://host/yjs/:projectId
 */
function initYjs(httpServer) {
  if (wss) return wss;

  wss = new WebSocket.Server({ noServer: true });

  httpServer.on('upgrade', (request, socket, head) => {
    // Only handle /yjs/<projectId> paths
    const url = new URL(request.url, `http://${request.headers.host}`);
    // Accept /yjs/<projectId> or /yjs/<projectId>/<roomName> (y-websocket client appends room name)
    const match = url.pathname.match(/^\/yjs\/([a-zA-Z0-9_-]+)(?:\/.*)?$/);

    if (!match) {
      // Not a Yjs path — let socket.io or other handlers deal with it
      return;
    }

    const projectId = match[1];

    wss.handleUpgrade(request, socket, head, (ws) => {
      ws.projectId = projectId;
      wss.emit('connection', ws, request, projectId);
    });
  });

  wss.on('connection', (ws, request, projectId) => {
    const docName = `project:${projectId}`;
    setupWSConnection(ws, request, { docName });
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
