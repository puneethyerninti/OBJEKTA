import { deflate, inflate } from 'pako';

function toBase64(uint8) {
  try {
    if (typeof Buffer !== 'undefined') return Buffer.from(uint8).toString('base64');
  } catch (e) {}
  if (typeof btoa === 'function') {
    let binary = '';
    for (let i = 0; i < uint8.length; i++) binary += String.fromCharCode(uint8[i]);
    return btoa(binary);
  }
  throw new Error('No base64 encoder available');
}

function fromBase64(str) {
  if (typeof Buffer !== 'undefined') return Buffer.from(str, 'base64');
  if (typeof atob === 'function') {
    const bin = atob(str);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return arr;
  }
  throw new Error('No base64 decoder available');
}

export function serializeScene(snapshot) {
  const json = JSON.stringify(snapshot || {});
  return { json, size: json.length };
}

export function prepareSceneUpload(snapshot, { compressThresholdBytes = 5 * 1024 * 1024, preferBlobUploads = true, legacyBase64Fallback = false } = {}) {
  const { json, size } = serializeScene(snapshot);
  const shouldCompress = size >= compressThresholdBytes;

  if (!shouldCompress) {
    return { mode: 'inline', json, size, snapshot };
  }

  const deflated = deflate(json, { level: 6 });
  const compressedSize = deflated.length;
  const originalSize = size;

  if (legacyBase64Fallback) {
    const base64 = toBase64(deflated);
    return { mode: 'base64', base64, compressedSize, originalSize, encoding: 'deflate-base64' };
  }

  if (preferBlobUploads) {
    const blob = new Blob([deflated], { type: 'application/deflate' });
    return {
      mode: 'blob',
      blob,
      compressedSize,
      originalSize,
      encoding: 'deflate',
      fileName: `scene_${Date.now()}.deflate`,
    };
  }

  // fallback to inline even if large
  return { mode: 'inline', json, size: originalSize, snapshot };
}

export function inflateToJson(base64OrBuffer) {
  let buf;
  if (typeof base64OrBuffer === 'string') buf = fromBase64(base64OrBuffer);
  else buf = base64OrBuffer;
  const inflated = inflate(buf, { to: 'string' });
  return JSON.parse(inflated);
}

export default { prepareSceneUpload, serializeScene, inflateToJson };
