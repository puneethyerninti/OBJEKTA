import { describe, it, expect, vi } from 'vitest';
import { uploadSmallViaPresign } from '../utils/upload';

// Mocks for fetch

describe('asset registration after presign upload', () => {
  it('calls registration with correct metadata', async () => {
    const file = new File([new Uint8Array(1024)], 'scene.glb', { type: 'model/gltf-binary' });

    const fetchMock = vi.spyOn(global, 'fetch');

    // presign
    fetchMock.mockImplementationOnce(async () => new Response(JSON.stringify({ url: 'https://s3/put', key: 'k-presign' }), { status: 200 }));
    // PUT part
    fetchMock.mockImplementationOnce(async () => new Response(null, { status: 200 }));
    // register
    fetchMock.mockImplementationOnce(async (input, init) => {
      const body = JSON.parse(init.body);
      expect(body.key).toBe('k-presign');
      expect(body.filename).toBe('scene.glb');
      expect(body.contentType).toBe('model/gltf-binary');
      expect(body.size).toBe(1024);
      return new Response(JSON.stringify({ success: true, asset: { key: 'k-presign', filename: 'scene.glb' } }), { status: 200 });
    });

    const res = await uploadSmallViaPresign({ file, projectId: 'p1', onProgress: () => {} });
    expect(res.key).toBe('k-presign');
    expect(res.asset).toBeTruthy();

    fetchMock.mockRestore();
  });
});
