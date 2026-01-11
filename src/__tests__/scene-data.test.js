import { describe, it, expect } from 'vitest';
import { prepareSceneUpload, inflateToJson } from '../utils/sceneData';

const bigScene = () => {
  const nodes = Array.from({ length: 2000 }, (_, i) => ({
    id: i,
    name: `node-${i}`,
    transform: { position: [i, i % 10, i % 7], rotation: [0, 0, 0], scale: [1, 1, 1] },
    material: { color: '#ffffff', roughness: 0.5, metalness: 0.1 },
  }));
  return { version: 1, nodes };
};

describe('prepareSceneUpload', () => {
  it('returns blob mode for large scenes when preferBlobUploads is true', () => {
    const scene = bigScene();
    const result = prepareSceneUpload(scene, { compressThresholdBytes: 5 * 1024, preferBlobUploads: true });
    expect(result.mode).toBe('blob');
    expect(result.blob).toBeInstanceOf(Blob);
    expect(result.encoding).toBe('deflate');
    expect(result.originalSize).toBeGreaterThan(5000);
  });

  it('supports legacy base64 fallback when requested', () => {
    const scene = bigScene();
    const result = prepareSceneUpload(scene, { compressThresholdBytes: 5 * 1024, legacyBase64Fallback: true });
    expect(result.mode).toBe('base64');
    expect(typeof result.base64).toBe('string');
    const parsed = inflateToJson(result.base64);
    expect(parsed.nodes.length).toBe(scene.nodes.length);
  });

  it('keeps inline mode for small scenes', () => {
    const scene = { a: 1 };
    const result = prepareSceneUpload(scene, { compressThresholdBytes: 1024, preferBlobUploads: true });
    expect(result.mode).toBe('inline');
    expect(result.json).toContain('"a":1');
  });
});
