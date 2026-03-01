// src/pages/studio/backupDB.js
// IndexedDB helpers for offline backup storage when cloud upload fails.

import { BACKUP_DB_NAME, BACKUP_STORE_NAME } from "./constants";

/**
 * Open (or create) the backup IndexedDB database.
 * @returns {Promise<IDBDatabase>}
 */
export function initBackupDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(BACKUP_DB_NAME, 1);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(BACKUP_STORE_NAME)) {
        db.createObjectStore(BACKUP_STORE_NAME, { keyPath: "id" });
      }
    };
  });
}

/**
 * Persist a project snapshot into IndexedDB so it can be recovered later.
 * @param {string} projectId
 * @param {object} projectData  - serialized scene JSON
 * @returns {Promise<string|null>} backup id or null on failure
 */
export async function saveBackupToIndexedDB(projectId, projectData) {
  try {
    const db = await initBackupDB();
    const tx = db.transaction(BACKUP_STORE_NAME, "readwrite");
    const store = tx.objectStore(BACKUP_STORE_NAME);
    const backup = {
      id: `${projectId}_${Date.now()}`,
      projectId,
      data: projectData,
      createdAt: new Date().toISOString(),
    };
    return new Promise((resolve, reject) => {
      const req = store.add(backup);
      req.onerror = () => reject(req.error);
      req.onsuccess = () => {
        console.info(`[OBJEKTA] Backup saved to IndexedDB: ${backup.id}`);
        resolve(backup.id);
      };
    });
  } catch (err) {
    console.warn("[OBJEKTA] IndexedDB backup failed:", err);
    return null;
  }
}
