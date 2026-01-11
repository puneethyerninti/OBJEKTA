const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
}

function approxBytes(value) {
  try {
    if (typeof value === 'string') return Buffer.byteLength(value, 'utf8');
    return Buffer.byteLength(JSON.stringify(value || {}), 'utf8');
  } catch (e) {
    return 0;
  }
}

function inflateToString(buffer) {
  try {
    return zlib.inflateSync(buffer).toString('utf8');
  } catch (e) {
    // allow already-plain JSON fallthrough
    try { return buffer.toString('utf8'); } catch (err) {}
    throw e;
  }
}

function writeCompressedScene(buffer, sceneDir, preferredName = 'scene.deflate') {
  ensureDir(sceneDir);
  const safeName = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}_${preferredName}`;
  const fullPath = path.join(sceneDir, safeName);
  fs.writeFileSync(fullPath, buffer);
  return { fullPath, relativePath: fullPath, size: buffer.length };
}

async function processScenePayload({ sceneFile, inlineData, maxInlineBytes, sceneDir }) {
  const result = {
    inlineData: null,
    inlineSize: 0,
    sceneStorageType: 'inline',
    sceneFilePath: null,
    sceneOriginalSize: 0,
    sceneCompressedSize: 0,
    dataEncoding: null,
    dataCompressed: false,
  };

  // If a scene file was uploaded, prefer it over inline data
  if (sceneFile) {
    const fileBuffer = fs.readFileSync(sceneFile.path);
    const decompressed = inflateToString(fileBuffer);
    result.sceneOriginalSize = Buffer.byteLength(decompressed, 'utf8');
    result.sceneCompressedSize = fileBuffer.length;
    if (result.sceneOriginalSize <= maxInlineBytes) {
      result.inlineData = JSON.parse(decompressed);
      result.inlineSize = result.sceneOriginalSize;
      result.sceneStorageType = 'inline';
      fs.unlink(sceneFile.path, () => {});
      return result;
    }
    // keep compressed on disk
    if (sceneFile.destination !== sceneDir) {
      ensureDir(sceneDir);
      const target = path.join(sceneDir, path.basename(sceneFile.filename || sceneFile.path));
      fs.renameSync(sceneFile.path, target);
      result.sceneFilePath = target;
    } else {
      result.sceneFilePath = sceneFile.path;
    }
    result.sceneStorageType = 'disk';
    result.dataEncoding = 'deflate';
    result.dataCompressed = true;
    return result;
  }

  // Fallback to inline data (string or object) when no file was provided
  if (typeof inlineData !== 'undefined') {
    let jsonString = '';
    if (typeof inlineData === 'string') jsonString = inlineData;
    else jsonString = JSON.stringify(inlineData || {});
    result.sceneOriginalSize = Buffer.byteLength(jsonString, 'utf8');
    if (result.sceneOriginalSize <= maxInlineBytes) {
      result.inlineData = typeof inlineData === 'string' ? JSON.parse(jsonString) : inlineData;
      result.inlineSize = result.sceneOriginalSize;
      result.sceneStorageType = 'inline';
      return result;
    }
    // compress and store to disk
    const deflated = zlib.deflateSync(jsonString, { level: 6 });
    result.sceneCompressedSize = deflated.length;
    const written = writeCompressedScene(deflated, sceneDir, 'scene.deflate');
    result.sceneFilePath = written.fullPath;
    result.sceneStorageType = 'disk';
    result.dataEncoding = 'deflate';
    result.dataCompressed = true;
    return result;
  }

  // default empty
  result.inlineData = {};
  result.sceneOriginalSize = approxBytes({});
  return result;
}

function hydrateSceneFromFile(doc) {
  if (!doc || doc.sceneStorageType !== 'disk' || !doc.sceneFilePath) return doc;
  try {
    const buf = fs.readFileSync(doc.sceneFilePath);
    const str = inflateToString(buf);
    const parsed = JSON.parse(str);
    doc.data = parsed;
    doc.dataEncoding = 'deflate';
    doc.dataCompressed = true;
    doc.dataSize = Buffer.byteLength(str, 'utf8');
  } catch (e) {
    doc.dataError = `Failed to load scene file: ${e.message}`;
  }
  return doc;
}

module.exports = {
  processScenePayload,
  hydrateSceneFromFile,
  approxBytes,
};
