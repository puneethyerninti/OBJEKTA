// src/collaboration/PresencePanel.jsx
// Small floating panel showing connected collaborators.

import React from 'react';

/**
 * PresencePanel — shows connected remote users with name and status dot.
 *
 * @param {{ remoteUsers: Array, yjsStatus: string, style?: object }} props
 */
export default function PresencePanel({ remoteUsers, yjsStatus, style }) {
  const statusColor = yjsStatus === 'connected' ? '#4ade80' : yjsStatus === 'connecting' ? '#facc15' : '#ef4444';
  const statusLabel = yjsStatus === 'connected' ? 'Connected' : yjsStatus === 'connecting' ? 'Connecting…' : 'Offline';

  return (
    <div style={{
      position: 'absolute', top: 56, right: 12, minWidth: 160, maxWidth: 220,
      background: 'rgba(0,0,0,0.6)', color: '#eee', fontSize: 12,
      borderRadius: 8, padding: '8px 10px', zIndex: 95,
      backdropFilter: 'blur(4px)', pointerEvents: 'auto',
      ...style,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: statusColor, display: 'inline-block', flexShrink: 0 }} />
        <span style={{ fontWeight: 600, fontSize: 11 }}>{statusLabel}</span>
        <span style={{ marginLeft: 'auto', opacity: 0.5, fontSize: 10 }}>Yjs</span>
      </div>

      {remoteUsers.length === 0 && (
        <div style={{ opacity: 0.5, fontSize: 11 }}>No other users</div>
      )}

      {remoteUsers.map(({ clientId, user }) => (
        <div key={clientId} style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '3px 0',
        }}>
          <span style={{
            width: 20, height: 20, borderRadius: '50%',
            background: user.color || '#888', display: 'flex', alignItems: 'center',
            justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#fff', flexShrink: 0,
          }}>
            {(user.name || '?')[0].toUpperCase()}
          </span>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 11 }}>
            {user.name || 'Anonymous'}
          </span>
          {user.selectedObjects?.length > 0 && (
            <span style={{ marginLeft: 'auto', opacity: 0.5, fontSize: 10 }}>
              editing
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
