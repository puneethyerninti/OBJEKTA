import React, { useCallback, useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { apiUrl } from "../utils/api";

export default function VersionTimeline({ projectId, onRestore, onNotify }) {
  const { authFetch } = useAuth() || {};
  const [versions, setVersions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [comparing, setComparing] = useState(null);
  const [diff, setDiff] = useState(null);
  const [restoring, setRestoring] = useState(null);

  const fetchVersions = useCallback(async (p = 1) => {
    if (!projectId || !authFetch) return;
    setLoading(true);
    try {
      const res = await authFetch(apiUrl(`/api/versions/${projectId}?page=${p}&limit=20`));
      if (res?.ok) {
        const data = await res.json();
        setVersions(data.versions || []);
        setTotalPages(data.totalPages || 1);
        setPage(data.page || 1);
      }
    } catch (e) {
      console.error("Failed to fetch versions:", e);
    } finally {
      setLoading(false);
    }
  }, [projectId, authFetch]);

  useEffect(() => { fetchVersions(1); }, [fetchVersions]);

  const handleCompare = useCallback(async (from, to) => {
    if (!authFetch) return;
    setComparing(`${from}-${to}`);
    setDiff(null);
    try {
      const res = await authFetch(apiUrl(`/api/versions/${projectId}/diff/${from}/${to}`));
      if (res?.ok) {
        const data = await res.json();
        setDiff(data);
      }
    } catch (e) {
      console.error("Failed to fetch diff:", e);
    } finally {
      setComparing(null);
    }
  }, [projectId, authFetch]);

  const handleRestore = useCallback(async (versionNumber) => {
    if (!authFetch) return;
    const confirmed = window.confirm(`Restore to version ${versionNumber}? This will create a new version with the current state first.`);
    if (!confirmed) return;
    setRestoring(versionNumber);
    try {
      const res = await authFetch(apiUrl(`/api/versions/${projectId}/restore/${versionNumber}`), { method: "POST" });
      if (res?.ok) {
        const data = await res.json();
        onNotify?.("success", `Restored to version ${versionNumber}`);
        onRestore?.(data.project);
        fetchVersions(1);
      } else {
        onNotify?.("error", "Failed to restore version");
      }
    } catch (e) {
      onNotify?.("error", "Failed to restore version");
    } finally {
      setRestoring(null);
    }
  }, [projectId, authFetch, onRestore, onNotify, fetchVersions]);

  const formatDate = (d) => {
    if (!d) return "";
    return new Date(d).toLocaleString(undefined, {
      month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
    });
  };

  if (!projectId) {
    return (
      <div style={{ color: "var(--text-muted)", fontSize: 13 }}>
        Save your project to enable version history.
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <div style={{ fontWeight: 700 }}>Version History</div>
        <button className="studio-btn" onClick={() => fetchVersions(page)} disabled={loading}>
          {loading ? "Loading..." : "Refresh"}
        </button>
      </div>

      {versions.length === 0 && !loading && (
        <div style={{ color: "var(--text-muted)", fontSize: 13 }}>
          No versions yet. Versions are created automatically when you save.
        </div>
      )}

      {versions.map((v, i) => (
        <div key={v.versionNumber} style={{
          border: "1px solid rgba(255,255,255,0.06)",
          borderRadius: 10,
          padding: 10,
          display: "flex",
          flexDirection: "column",
          gap: 6,
          position: "relative",
        }}>
          {/* Timeline connector */}
          {i < versions.length - 1 && (
            <div style={{
              position: "absolute", left: 18, top: 38, bottom: -12,
              width: 2, background: "rgba(255,255,255,0.08)",
            }} />
          )}

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{
              width: 10, height: 10, borderRadius: "50%",
              background: v.isSnapshot ? "#f59e0b" : "#6366f1",
              flexShrink: 0,
            }} />
            <div style={{ fontWeight: 600, fontSize: 14 }}>
              v{v.versionNumber}
              {v.isSnapshot && <span style={{ fontSize: 11, color: "#f59e0b", marginLeft: 6 }}>snapshot</span>}
            </div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginLeft: "auto" }}>
              {formatDate(v.createdAt)}
            </div>
          </div>

          {v.message && (
            <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>{v.message}</div>
          )}

          {/* Stats */}
          <div style={{ display: "flex", gap: 12, fontSize: 12, color: "var(--text-muted)" }}>
            {v.objectCount > 0 && <span>{v.objectCount} objects</span>}
            {v.addedObjects?.length > 0 && <span style={{ color: "#22c55e" }}>+{v.addedObjects.length}</span>}
            {v.removedObjects?.length > 0 && <span style={{ color: "#ef4444" }}>-{v.removedObjects.length}</span>}
            {v.modifiedObjects?.length > 0 && <span style={{ color: "#f59e0b" }}>~{v.modifiedObjects.length}</span>}
          </div>

          <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
            <button
              className="studio-btn"
              onClick={() => handleRestore(v.versionNumber)}
              disabled={restoring === v.versionNumber}
            >
              {restoring === v.versionNumber ? "Restoring..." : "Restore"}
            </button>
            {i < versions.length - 1 && (
              <button
                className="studio-btn"
                onClick={() => handleCompare(versions[i + 1].versionNumber, v.versionNumber)}
                disabled={comparing === `${versions[i + 1].versionNumber}-${v.versionNumber}`}
              >
                {comparing === `${versions[i + 1].versionNumber}-${v.versionNumber}` ? "..." : "Compare"}
              </button>
            )}
          </div>
        </div>
      ))}

      {/* Diff Viewer inline */}
      {diff && (
        <DiffViewer diff={diff} onClose={() => setDiff(null)} />
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 4 }}>
          <button className="studio-btn" onClick={() => fetchVersions(page - 1)} disabled={page <= 1 || loading}>
            Prev
          </button>
          <span style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: "32px" }}>
            {page} / {totalPages}
          </span>
          <button className="studio-btn" onClick={() => fetchVersions(page + 1)} disabled={page >= totalPages || loading}>
            Next
          </button>
        </div>
      )}
    </div>
  );
}

function DiffViewer({ diff, onClose }) {
  if (!diff) return null;

  const { from, to, diff: diffData } = diff;
  const ops = diffData?.ops || [];
  const added = ops.filter(o => o.op === "add");
  const removed = ops.filter(o => o.op === "remove");
  const modified = ops.filter(o => o.op === "replace");

  return (
    <div style={{
      border: "1px solid rgba(255,255,255,0.1)",
      borderRadius: 10,
      padding: 12,
      background: "rgba(0,0,0,0.2)",
      display: "flex",
      flexDirection: "column",
      gap: 8,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontWeight: 700, fontSize: 13 }}>
          Changes: v{from} → v{to}
        </div>
        <button className="studio-btn" onClick={onClose} style={{ padding: "2px 8px", fontSize: 12 }}>
          ✕
        </button>
      </div>

      <div style={{ display: "flex", gap: 16, fontSize: 13 }}>
        <span style={{ color: "#22c55e" }}>+{added.length} added</span>
        <span style={{ color: "#ef4444" }}>-{removed.length} removed</span>
        <span style={{ color: "#f59e0b" }}>~{modified.length} modified</span>
      </div>

      {ops.length === 0 && (
        <div style={{ color: "var(--text-muted)", fontSize: 12 }}>No changes between these versions.</div>
      )}

      <div style={{ maxHeight: 200, overflowY: "auto", display: "flex", flexDirection: "column", gap: 4 }}>
        {added.map((op, i) => (
          <div key={`a-${i}`} style={{ fontSize: 12, padding: "4px 8px", borderRadius: 6, background: "rgba(34,197,94,0.1)", color: "#22c55e" }}>
            + {op.key || "object"}
          </div>
        ))}
        {removed.map((op, i) => (
          <div key={`r-${i}`} style={{ fontSize: 12, padding: "4px 8px", borderRadius: 6, background: "rgba(239,68,68,0.1)", color: "#ef4444" }}>
            − {op.key || "object"}
          </div>
        ))}
        {modified.map((op, i) => (
          <div key={`m-${i}`} style={{ fontSize: 12, padding: "4px 8px", borderRadius: 6, background: "rgba(245,158,11,0.1)", color: "#f59e0b" }}>
            ~ {op.key || "object"}
          </div>
        ))}
      </div>
    </div>
  );
}
