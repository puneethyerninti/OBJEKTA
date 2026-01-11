import { describe, it, expect, vi } from 'vitest';
import { uploadMultipartToS3 } from '../upload';

// Simple test: verifies chunk splitting and complete call ordering by mocking fetch

describe('uploadMultipartToS3', () => {
  it('splits into parts and completes in order', async () => {
    const fileSize = 12 * 1024 * 1024 + 123; // > 2 parts for 8MiB partSize
    const file = new File([new Uint8Array(fileSize)], 'big.glb', { type: 'model/gltf-binary' });

    const fetchMock = vi.spyOn(global, 'fetch');

    // 1) start
    fetchMock.mockImplementationOnce(async () => new Response(JSON.stringify({ uploadId: 'u1', key: 'k1', bucket: 'b1', partSize: 8 * 1024 * 1024, parts: 2 }), { status: 200 }));

    // 2) sign part 1
    fetchMock.mockImplementationOnce(async () => new Response(JSON.stringify({ url: 'https://s3/p1' }), { status: 200 }));
    // PUT part 1
    fetchMock.mockImplementationOnce(async () => new Response(null, { status: 200, headers: { ETag: 'etag1' } }));

    // 3) sign part 2
    fetchMock.mockImplementationOnce(async () => new Response(JSON.stringify({ url: 'https://s3/p2' }), { status: 200 }));
    // PUT part 2
    fetchMock.mockImplementationOnce(async () => new Response(null, { status: 200, headers: { ETag: 'etag2' } }));

    // 4) complete
    fetchMock.mockImplementationOnce(async () => new Response(JSON.stringify({ ok: true, key: 'k1' }), { status: 200 }));

    const res = await uploadMultipartToS3({ file, projectId: 'p1', onProgress: () => {} });
    expect(res.key).toBe('k1');

    // verify calls sequence
    expect(fetchMock).toHaveBeenCalledTimes(6);

    fetchMock.mockRestore();
  });
});
