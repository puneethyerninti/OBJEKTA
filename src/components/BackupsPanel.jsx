import React, { useCallback, useEffect, useMemo, useState } from "react";

const LOCAL_DATA_KEY = "objekta_local_backups";
const LOCAL_GLB_INDEX_KEY = "objekta_local_backups_v1";

const DB_SCENE = "objekta_backups_db_v1";
const DB_GLB = "OBJEKTA_DB_v1";
const STORE_BACKUPS = "backups";

function parseLocalArray(key) {
	try {
		const raw = localStorage.getItem(key);
		const parsed = raw ? JSON.parse(raw) : [];
		return Array.isArray(parsed) ? parsed : [];
	} catch (e) {
		return [];
	}
}

function openDb(name) {
	return new Promise((resolve, reject) => {
		try {
			const req = indexedDB.open(name, 1);
			req.onerror = () => reject(req.error);
			req.onsuccess = () => resolve(req.result);
			req.onupgradeneeded = (e) => {
				const db = e.target.result;
				if (!db.objectStoreNames.contains(STORE_BACKUPS)) {
					db.createObjectStore(STORE_BACKUPS, { keyPath: "id" });
				}
			};
		} catch (e) {
			reject(e);
		}
	});
}

async function readAllFromDb(name) {
	try {
		const db = await openDb(name);
		return await new Promise((resolve) => {
			const tx = db.transaction(STORE_BACKUPS, "readonly");
			const store = tx.objectStore(STORE_BACKUPS);
			const req = store.getAll();
			req.onerror = () => resolve([]);
			req.onsuccess = () => resolve(req.result || []);
		});
	} catch (e) {
		return [];
	}
}

async function deleteFromDb(name, id) {
	try {
		const db = await openDb(name);
		return await new Promise((resolve) => {
			const tx = db.transaction(STORE_BACKUPS, "readwrite");
			const store = tx.objectStore(STORE_BACKUPS);
			const req = store.delete(id);
			req.onerror = () => resolve(false);
			req.onsuccess = () => resolve(true);
		});
	} catch (e) {
		return false;
	}
}

function formatBytes(bytes) {
	if (!Number.isFinite(bytes)) return "n/a";
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
	return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export default function BackupsPanel({ onRestore, onNotify }) {
	const [items, setItems] = useState([]);
	const [loading, setLoading] = useState(false);

	const refresh = useCallback(async () => {
		setLoading(true);
		try {
			const localData = parseLocalArray(LOCAL_DATA_KEY).map((b) => ({
				id: b.id,
				name: b.name || "Local backup",
				createdAt: b.lastSavedAt || b.createdAt || null,
				type: "scene-data",
				source: "localStorage",
				data: b.data || null,
			}));

			const localGlbIndex = parseLocalArray(LOCAL_GLB_INDEX_KEY).map((b) => ({
				id: b.id,
				name: b.name || "GLB backup",
				createdAt: b.createdAt || null,
				type: "glb-index",
				source: "localStorage",
				size: b.size || null,
				url: b.url || null,
				meta: b.meta || null,
			}));

			const [idbScene, idbGlb] = await Promise.all([
				readAllFromDb(DB_SCENE),
				readAllFromDb(DB_GLB),
			]);

			const idbSceneItems = (idbScene || []).map((b) => ({
				id: b.id,
				name: b?.data?.name || b?.data?.title || "IndexedDB backup",
				createdAt: b.createdAt || null,
				type: "scene-data",
				source: "indexedDB",
				dbName: DB_SCENE,
				data: b.data || null,
			}));

			const idbGlbItems = (idbGlb || []).map((b) => ({
				id: b.id,
				name: b.name || "GLB backup",
				createdAt: b.createdAt || null,
				type: "glb-blob",
				source: "indexedDB",
				dbName: DB_GLB,
				blob: b.blob || null,
				size: b?.blob?.size || null,
				meta: b.meta || null,
			}));

			const merged = new Map();
			const add = (entry) => {
				const key = `${entry.type}:${entry.id}`;
				const existing = merged.get(key);
				if (!existing) {
					merged.set(key, entry);
					return;
				}
				merged.set(key, {
					...existing,
					...entry,
					data: entry.data || existing.data,
					blob: entry.blob || existing.blob,
					url: entry.url || existing.url,
					meta: entry.meta || existing.meta,
					name: entry.name || existing.name,
					createdAt: entry.createdAt || existing.createdAt,
					size: entry.size || existing.size,
					dbName: entry.dbName || existing.dbName,
				});
			};

			[...localData, ...idbSceneItems, ...localGlbIndex, ...idbGlbItems].forEach(add);

			const list = Array.from(merged.values()).sort((a, b) => {
				const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
				const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
				return tb - ta;
			});

			setItems(list);
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		refresh();
	}, [refresh]);

	const hasBackups = items.length > 0;

	const handleDelete = useCallback(async (entry) => {
		if (!entry) return;
		let ok = true;

		if (entry.source === "localStorage") {
			try {
				const key = entry.type === "scene-data" ? LOCAL_DATA_KEY : LOCAL_GLB_INDEX_KEY;
				const list = parseLocalArray(key).filter((b) => b.id !== entry.id);
				localStorage.setItem(key, JSON.stringify(list));
			} catch (e) {
				ok = false;
			}
		}

		if (entry.source === "indexedDB" && entry.dbName) {
			const deleted = await deleteFromDb(entry.dbName, entry.id);
			if (!deleted) ok = false;
		}

		if (entry.type === "glb-blob") {
			try {
				const list = parseLocalArray(LOCAL_GLB_INDEX_KEY).filter((b) => b.id !== entry.id);
				localStorage.setItem(LOCAL_GLB_INDEX_KEY, JSON.stringify(list));
			} catch (e) {
				ok = false;
			}
		}

		if (!ok) onNotify?.("error", "Failed to delete backup.");
		await refresh();
	}, [onNotify, refresh]);

	const renderMeta = (entry) => {
		const date = entry.createdAt ? new Date(entry.createdAt).toLocaleString() : "";
		const size = entry.size ? formatBytes(entry.size) : "";
		const parts = [date, size].filter(Boolean).join(" · ");
		return parts || "";
	};

	return (
		<div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
			<div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
				<div style={{ fontWeight: 700 }}>Backups</div>
				<button className="studio-btn" onClick={refresh} disabled={loading}>
					{loading ? "Refreshing..." : "Refresh"}
				</button>
			</div>

			{!hasBackups && (
				<div style={{ color: "var(--text-muted)", fontSize: 13 }}>
					No local backups found.
				</div>
			)}

			{items.map((entry) => (
				<div key={`${entry.type}-${entry.id}`} style={{
					border: "1px solid rgba(255,255,255,0.06)",
					borderRadius: 10,
					padding: 10,
					display: "flex",
					flexDirection: "column",
					gap: 6,
				}}>
					<div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
						<div style={{ fontWeight: 600 }}>{entry.name}</div>
						<div style={{ fontSize: 12, color: "var(--text-muted)" }}>{entry.type.replace("-", " ")}</div>
					</div>
					<div style={{ fontSize: 12, color: "var(--text-muted)" }}>{renderMeta(entry)}</div>
					<div style={{ display: "flex", gap: 8, marginTop: 4 }}>
						<button className="studio-btn" onClick={() => onRestore?.(entry)}>Restore</button>
						<button className="studio-btn" onClick={() => handleDelete(entry)}>Delete</button>
					</div>
				</div>
			))}
		</div>
	);
}
