// backend/yjs/yjsServer.js
// Lightweight Yjs WebSocket server utilities.
// Manages Y.Doc instances and handles sync + awareness messages.

const Y = require('yjs');
const syncProtocol = require('y-protocols/sync');
const awarenessProtocol = require('y-protocols/awareness');
const encoding = require('lib0/encoding');
const decoding = require('lib0/decoding');

const messageSync = 0;
const messageAwareness = 1;

/** @type {Map<string, { doc: Y.Doc, awareness: awarenessProtocol.Awareness, conns: Set<WebSocket> }>} */
const docs = new Map();

function getYDoc(docName) {
  let entry = docs.get(docName);
  if (!entry) {
    const doc = new Y.Doc();
    const awareness = new awarenessProtocol.Awareness(doc);

    awareness.on('update', ({ added, updated, removed }, _origin) => {
      const changedClients = added.concat(updated, removed);
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, messageAwareness);
      encoding.writeVarUint8Array(encoder, awarenessProtocol.encodeAwarenessUpdate(awareness, changedClients));
      const msg = encoding.toUint8Array(encoder);
      broadcastToDoc(docName, msg);
    });

    doc.on('update', (update, origin) => {
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, messageSync);
      syncProtocol.writeUpdate(encoder, update);
      const msg = encoding.toUint8Array(encoder);
      broadcastToDoc(docName, msg, origin);
    });

    entry = { doc, awareness, conns: new Set() };
    docs.set(docName, entry);
  }
  return entry;
}

function broadcastToDoc(docName, msg, excludeOrigin) {
  const entry = docs.get(docName);
  if (!entry) return;
  entry.conns.forEach((conn) => {
    if (conn !== excludeOrigin && conn.readyState === 1 /* OPEN */) {
      try { conn.send(msg); } catch (e) { /* ignore */ }
    }
  });
}

function setupWSConnection(conn, _req, { docName }) {
  const { doc, awareness, conns } = getYDoc(docName);
  conns.add(conn);
  conn._docName = docName;

  // Send initial sync step 1
  const encoder = encoding.createEncoder();
  encoding.writeVarUint(encoder, messageSync);
  syncProtocol.writeSyncStep1(encoder, doc);
  conn.send(encoding.toUint8Array(encoder));

  // Send current awareness state
  const awarenessStates = awareness.getStates();
  if (awarenessStates.size > 0) {
    const awarenessEncoder = encoding.createEncoder();
    encoding.writeVarUint(awarenessEncoder, messageAwareness);
    encoding.writeVarUint8Array(awarenessEncoder, awarenessProtocol.encodeAwarenessUpdate(awareness, Array.from(awarenessStates.keys())));
    conn.send(encoding.toUint8Array(awarenessEncoder));
  }

  conn.on('message', (rawMsg) => {
    try {
      const buf = rawMsg instanceof ArrayBuffer ? new Uint8Array(rawMsg) : new Uint8Array(rawMsg);
      const decoder = decoding.createDecoder(buf);
      const msgType = decoding.readVarUint(decoder);

      if (msgType === messageSync) {
        const syncEncoder = encoding.createEncoder();
        encoding.writeVarUint(syncEncoder, messageSync);
        syncProtocol.readSyncMessage(decoder, syncEncoder, doc, conn);
        if (encoding.length(syncEncoder) > 1) {
          conn.send(encoding.toUint8Array(syncEncoder));
        }
      } else if (msgType === messageAwareness) {
        awarenessProtocol.applyAwarenessUpdate(awareness, decoding.readVarUint8Array(decoder), conn);
      }
    } catch (err) {
      console.error('[Yjs] Message error:', err.message);
    }
  });

  conn.on('close', () => {
    conns.delete(conn);
    awarenessProtocol.removeAwarenessStates(awareness, [doc.clientID], null);
    // Clean up empty docs after a delay
    if (conns.size === 0) {
      setTimeout(() => {
        const entry = docs.get(docName);
        if (entry && entry.conns.size === 0) {
          entry.doc.destroy();
          entry.awareness.destroy();
          docs.delete(docName);
          console.log(`[Yjs] Cleaned up doc "${docName}"`);
        }
      }, 30000);
    }
  });
}

module.exports = { setupWSConnection, getYDoc, docs };
