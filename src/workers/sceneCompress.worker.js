// Web Worker: stringify + deflate off the main thread
import { deflate } from 'pako';

self.onmessage = async (e) => {
  const { scene, id } = e.data || {};
  try {
    const json = JSON.stringify(scene);
    const encoded = new TextEncoder().encode(json);
    const deflated = deflate(encoded);
    // Transfer ArrayBuffer back for zero-copy
    self.postMessage({ id, ok: true, buffer: deflated.buffer, compressedSize: deflated.byteLength, originalSize: encoded.byteLength }, [deflated.buffer]);
  } catch (err) {
    self.postMessage({ id, ok: false, error: err?.message || 'compress failed' });
  }
};
