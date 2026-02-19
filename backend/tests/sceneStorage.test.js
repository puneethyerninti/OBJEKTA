const fs = require('fs');
const os = require('os');
const path = require('path');
const zlib = require('zlib');
const { test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const { processScenePayload } = require('../utils/sceneStorage');

let tmpDir;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'objekta-scenes-'));
});

afterEach(() => {
  if (tmpDir && fs.existsSync(tmpDir)) {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

function makeSceneBuffer(sizeKb = 20) {
  const payload = { nodes: [] };
  for (let i = 0; i < sizeKb; i++) {
    payload.nodes.push({ id: i, name: `node-${i}`, transform: [i, i, i] });
  }
  const json = JSON.stringify(payload);
  return Buffer.from(json, 'utf8');
}

test('processScenePayload keeps inline data when under threshold', async () => {
  const buffer = makeSceneBuffer(2);
  const sceneFile = {
    path: path.join(tmpDir, 'scene.deflate'),
    destination: tmpDir,
    filename: 'scene.deflate',
  };
  fs.writeFileSync(sceneFile.path, zlib.deflateSync(buffer));

  const result = await processScenePayload({ sceneFile, inlineData: undefined, maxInlineBytes: 200 * 1024, sceneDir: tmpDir });
  assert.strictEqual(result.sceneStorageType, 'inline');
  assert.ok(result.inlineData);
  assert.ok(result.sceneOriginalSize > 0);
});

test('processScenePayload stores to disk when over threshold', async () => {
  const buffer = makeSceneBuffer(300); // large
  const sceneFile = {
    path: path.join(tmpDir, 'scene.deflate'),
    destination: tmpDir,
    filename: 'scene.deflate',
  };
  fs.writeFileSync(sceneFile.path, zlib.deflateSync(buffer));

  const result = await processScenePayload({ sceneFile, inlineData: undefined, maxInlineBytes: 1024, sceneDir: tmpDir });
  assert.strictEqual(result.sceneStorageType, 'disk');
  assert.ok(result.sceneFilePath);
  assert.ok(fs.existsSync(result.sceneFilePath));
  assert.ok(result.sceneCompressedSize > 0);
});
