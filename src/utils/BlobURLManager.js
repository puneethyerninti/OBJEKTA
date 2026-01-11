// Refcounted Blob URL manager to avoid premature revocation and leaks.
const refs = new Map();

function create(blob) {
  if (!blob) return null;
  const url = URL.createObjectURL(blob);
  refs.set(url, (refs.get(url) || 0) + 1);
  return url;
}

function retain(url) {
  if (!url) return;
  refs.set(url, (refs.get(url) || 0) + 1);
}

function release(url) {
  if (!url) return;
  const count = refs.get(url) || 0;
  const next = Math.max(0, count - 1);
  if (next === 0) {
    try { URL.revokeObjectURL(url); } catch (e) { console.warn('[BlobURLManager] revoke failed', e); }
    refs.delete(url);
  } else {
    refs.set(url, next);
  }
}

function forceRevoke(url) {
  if (!url) return;
  try { URL.revokeObjectURL(url); } catch (e) { console.warn('[BlobURLManager] force revoke failed', e); }
  refs.delete(url);
}

export default { create, retain, release, forceRevoke };
