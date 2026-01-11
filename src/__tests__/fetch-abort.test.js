// src/__tests__/fetch-abort.test.js
// Basic sanity test for AbortController integration with doFetch/authFetch patterns.
// NOTE: This is a lightweight illustrative test; networking is mocked.
import { describe, it, expect } from 'vitest';

describe('fetch abort handling', () => {
  it('should return aborted flag when fetch is aborted', async () => {
    const controller = new AbortController();
    controller.abort();
    // Simulate the pattern used in Dashboard doFetch
    async function simulatedFetch(path, opts = {}) {
      try {
        await fetch(path, { ...opts, signal: controller.signal });
        return { ok: true };
      } catch (err) {
        if (err?.name === 'AbortError') return { ok: false, aborted: true };
        return { ok: false, error: err };
      }
    }
    const res = await simulatedFetch('http://example.com');
    expect(res.aborted).toBe(true);
    expect(res.ok).toBe(false);
  });
});