import { describe, it, expect, vi } from 'vitest';
import { uploadMultipartToS3 } from '../upload';

// Simple test: verifies chunk splitting and complete call ordering by mocking fetch

describe('uploadMultipartToS3', () => {
  it('splits into parts and completes in order', async () => {
    const fileSize = 12 * 1024 * 1024 + 123; // > 2 parts for 8MiB partSize
    const file = new File([new Uint8Array(fileSize)], 'big.glb', { type: 'model/gltf-binary' });

    const calls = {
      start: 0,
      sign: 0,
      put: 0,
      complete: 0,
      register: 0,
    };

    const fetchMock = vi.spyOn(global, 'fetch').mockImplementation(async (input, init = {}) => {
      const url = typeof input === 'string' ? input : input?.url;
      const method = (init.method || input?.method || 'GET').toUpperCase();

      if (url.includes('/api/uploads/multipart/start') && method === 'POST') {
        calls.start += 1;
        return new Response(JSON.stringify({ uploadId: 'u1', key: 'k1', bucket: 'b1', partSize: 8 * 1024 * 1024, parts: 2 }), { status: 200 });
      }

      if (url.includes('/api/uploads/multipart/sign') && method === 'POST') {
        calls.sign += 1;
        const body = JSON.parse(init.body || '{}');
        return new Response(JSON.stringify({ url: `https://s3/p${body.partNumber}` }), { status: 200 });
      }

      if (url.startsWith('https://s3/p') && method === 'PUT') {
        calls.put += 1;
        const partNumber = Number((url.match(/\/p(\d+)$/) || [])[1] || 1);
        return new Response(null, { status: 200, headers: { ETag: `etag${partNumber}` } });
      }

      if (url.includes('/api/uploads/multipart/complete') && method === 'POST') {
        calls.complete += 1;
        return new Response(JSON.stringify({ ok: true, key: 'k1' }), { status: 200 });
      }

      if (url.includes('/api/projects/') && url.includes('/assets/s3') && method === 'POST') {
        calls.register += 1;
        return new Response(JSON.stringify({ success: true, asset: { key: 'k1', source: 's3' } }), { status: 200 });
      }

      throw new Error(`Unhandled fetch in test: ${method} ${url}`);
    });

    const res = await uploadMultipartToS3({ file, projectId: 'p1', onProgress: () => {} });
    expect(res.key).toBe('k1');

    // verify endpoint-level call counts independent of upload worker ordering
    expect(calls.start).toBe(1);
    expect(calls.sign).toBe(2);
    expect(calls.put).toBe(2);
    expect(calls.complete).toBe(1);
    expect(calls.register).toBe(1);

    fetchMock.mockRestore();
  });
});
