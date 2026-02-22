import React from 'react';
import PropTypes from 'prop-types';

function Sidebar({ user, stats, onCreate, onOpenStudio, onLogout, onImport }) {
  return (
    <aside className="dash-sidecard" aria-label="Sidebar">
      <div>
        <div className="dash-profile">
          <div className="avatar" aria-hidden>
            {user?.name ? user.name.split(' ').map((n) => n[0]).slice(0, 2).join('') : user?.email?.[0]?.toUpperCase() || 'U'}
          </div>
          <div className="profile-info">
            <div className="profile-name">{user?.name || user?.email || 'Creator'}</div>
            <div className="profile-email">{user?.email}</div>
          </div>
        </div>

        <div className="dash-stats">
          <div className="stat">
            <div className="stat-num">{stats.projects ?? '—'}</div>
            <div className="stat-label">Projects</div>
          </div>
          <div className="stat">
            <div className="stat-num">{stats.uploads ?? '—'}</div>
            <div className="stat-label">Uploads</div>
          </div>
          <div className="stat">
            <div className="stat-num">{stats.storageMB ?? '—'}MB</div>
            <div className="stat-label">Storage</div>
          </div>
        </div>

        <div className="dash-actions">
          <button className="btn btn-primary" onClick={onOpenStudio} aria-label="Open Studio">
            Open Studio
          </button>
          <button className="btn btn-ghost" onClick={onLogout} aria-label="Logout">
            Logout
          </button>
        </div>

        <div className="dash-member-since">
          Member since: <strong>{new Date(user?.createdAt || Date.now()).toLocaleDateString()}</strong>
        </div>
      </div>

      <div className="dash-member-since">
        <div className="muted-small">Quick actions</div>
        <div className="quick-actions-row">
          <button className="btn btn-primary" onClick={onCreate} aria-label="New project">
            New Project
          </button>
          <button className="btn btn-accent" onClick={onImport} aria-label="Import">
            Import
          </button>
        </div>
      </div>
    </aside>
  );
}

Sidebar.propTypes = {
  user: PropTypes.object,
  stats: PropTypes.object,
  onCreate: PropTypes.func,
  onOpenStudio: PropTypes.func,
  onLogout: PropTypes.func,
  onImport: PropTypes.func,
};

export default React.memo(Sidebar);
