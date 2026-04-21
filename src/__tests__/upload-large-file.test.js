import { describe, it, expect, vi } from 'vitest';
import { uploadLargeFile } from '../utils/upload';

// Mock tus-js-client Upload
vi.mock('tus-js-client', () => {
  return {
    Upload: class MockUpload {
      constructor(file, opts) {
        this.file = file;
        this.opts = opts;
        this.url = 'http://localhost:5000/api/uploads/tus/mock/' + (file.name || 'file');
      }
      start() {
        // simulate async
        setTimeout(() => {
          if (this.opts?.onProgress) this.opts.onProgress(this.file.size, this.file.size);
          this.opts?.onSuccess?.();
        }, 0);
      }
    }
  }
});

describe('uploadLargeFile strategy chooser', () => {
  it('uses presign for small files', async () => {
    const small = new File([new Uint8Array(1024 * 1024)], 'small.glb', { type: 'model/gltf-binary' });
    const fm = vi.spyOn(global, 'fetch');

    // presign
    fm.mockImplementationOnce(async () => new Response(JSON.stringify({ url: 'https://s3/put', key: 'k-small' }), { status: 200 }));
    // PUT
    fm.mockImplementationOnce(async () => new Response(null, { status: 200 }));
    // register
    fm.mockImplementationOnce(async () => new Response(JSON.stringify({ success: true, asset: { key: 'k-small', source: 's3' } }), { status: 200 }));

    const res = await uploadLargeFile({ file: small, projectId: 'p1' });
    expect(res.asset).toBeTruthy();
    fm.mockRestore();
  });

  it('uses multipart for large files', async () => {
    const big = new File([new Uint8Array(60 * 1024 * 1024)], 'big.glb', { type: 'model/gltf-binary' });
    const fm = vi.spyOn(global, 'fetch').mockImplementation(async (input, init = {}) => {
      const url = typeof input === 'string' ? input : input?.url;
      const method = (init.method || input?.method || 'GET').toUpperCase();

      if (url.includes('/api/uploads/multipart/start') && method === 'POST') {
        return new Response(JSON.stringify({ uploadId: 'u1', key: 'k-big', bucket: 'b', partSize: 8 * 1024 * 1024, parts: 8 }), { status: 200 });
      }

      if (url.includes('/api/uploads/multipart/sign') && method === 'POST') {
        const body = JSON.parse(init.body || '{}');
        return new Response(JSON.stringify({ url: `https://s3/part${body.partNumber}` }), { status: 200 });
      }

      if (url.startsWith('https://s3/part') && method === 'PUT') {
        const partNumber = Number((url.match(/part(\d+)$/) || [])[1] || 1);
        return new Response(null, { status: 200, headers: { ETag: `etag${partNumber}` } });
      }

      if (url.includes('/api/uploads/multipart/complete') && method === 'POST') {
        return new Response(JSON.stringify({ ok: true, key: 'k-big' }), { status: 200 });
      }

      if (url.includes('/api/projects/') && url.includes('/assets/s3') && method === 'POST') {
        return new Response(JSON.stringify({ success: true, asset: { key: 'k-big', source: 's3' } }), { status: 200 });
      }

      throw new Error(`Unhandled fetch in test: ${method} ${url}`);
    });

    const res = await uploadLargeFile({ file: big, projectId: 'p1' });
    expect(res.asset).toBeTruthy();
    fm.mockRestore();
  });

  it('falls back to tus when multipart fails', async () => {
    const big = new File([new Uint8Array(60 * 1024 * 1024)], 'big.glb', { type: 'model/gltf-binary' });
    const fm = vi.spyOn(global, 'fetch').mockImplementation(async (input, init = {}) => {
      const url = typeof input === 'string' ? input : input?.url;
      const method = (init.method || input?.method || 'GET').toUpperCase();

      if (url.includes('/api/uploads/multipart/start') && method === 'POST') {
        return new Response('err', { status: 500 });
      }

      if (url.includes('/api/projects/') && url.includes('/assets/s3') && method === 'POST') {
        return new Response(JSON.stringify({ success: true, asset: { url: 'http://localhost:5000/api/uploads/tus/mock/big.glb', source: 'tus' } }), { status: 200 });
      }

      throw new Error(`Unhandled fetch in test: ${method} ${url}`);
    });

    const res = await uploadLargeFile({ file: big, projectId: 'p1' });
    // may or may not contain asset depending on registration; in this test we mocked registration OK
    expect(res.asset).toBeTruthy();
    fm.mockRestore();
  });
});
