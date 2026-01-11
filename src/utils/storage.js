// src/utils/storage.js
// Helpers to request additional persistent storage/quota for large local assets

export async function ensurePersistentStorage() {
  if (!('storage' in navigator) || !navigator.storage?.persist) {
    return { supported: false, persisted: false, quota: null };
  }
  try {
    const persisted = await navigator.storage.persisted();
    if (persisted) {
      const quota = await navigator.storage.estimate();
      return { supported: true, persisted: true, quota };
    }
    const granted = await navigator.storage.persist();
    const quota = await navigator.storage.estimate();
    return { supported: true, persisted: granted, quota };
  } catch (err) {
    console.warn('[Storage] persist() failed', err);
    return { supported: true, persisted: false, quota: null, error: err };
  }
}

export async function logQuotaIfAny(label = 'Storage') {
  if (!('storage' in navigator) || !navigator.storage?.estimate) return null;
  try {
    const { quota, usage } = await navigator.storage.estimate();
    console.log(`[${label}] quota=${formatBytes(quota)} usage=${formatBytes(usage)}`);
    return { quota, usage };
  } catch (err) {
    console.warn(`[${label}] estimate failed`, err);
    return null;
  }
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return 'n/a';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1073741824) return `${(bytes / 1048576).toFixed(1)} MB`;
  return `${(bytes / 1073741824).toFixed(2)} GB`;
}
