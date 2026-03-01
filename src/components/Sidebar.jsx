import React from 'react';
import PropTypes from 'prop-types';
import {
  FiHome, FiLayout, FiGlobe, FiDownload, FiPlus,
  FiHardDrive, FiLogOut, FiCommand,
} from 'react-icons/fi';

function Sidebar({ user, stats, onCreate, onOpenStudio, onLogout, onImport, onMarketplace, onNavigateHome }) {
  const initials = user?.name
    ? user.name.split(' ').map(n => n[0]).slice(0, 2).join('')
    : user?.email?.[0]?.toUpperCase() || 'U';

  const storagePercent = Math.min(100, Math.round(((stats.storageMB ?? 0) / 500) * 100));

  return (
    <aside className="dash-sidebar" aria-label="Sidebar">
      {/* Brand */}
      <div className="sidebar-brand">
        <div className="sidebar-logo" aria-hidden><FiCommand size={18} /></div>
        <span className="sidebar-brand-text">Objekta</span>
      </div>

      {/* Navigation */}
      <nav className="sidebar-nav">
        <button className="sidebar-nav-item sidebar-nav-item--active" onClick={onNavigateHome}>
          <FiHome size={18} /> Dashboard
        </button>
        <button className="sidebar-nav-item" onClick={onOpenStudio}>
          <FiLayout size={18} /> Studio
        </button>
        <button className="sidebar-nav-item" onClick={onMarketplace}>
          <FiGlobe size={18} /> Marketplace
        </button>
        <button className="sidebar-nav-item" onClick={onImport}>
          <FiDownload size={18} /> Import
        </button>
      </nav>

      <div className="sidebar-divider" />

      {/* Create */}
      <button className="sidebar-create-btn" onClick={onCreate}>
        <FiPlus size={18} /> New Project
      </button>

      {/* Storage */}
      <div className="sidebar-storage">
        <div className="storage-header">
          <span><FiHardDrive size={12} /> Storage</span>
          <span>{stats.storageMB ?? 0} / 500 MB</span>
        </div>
        <div className="storage-bar">
          <div className="storage-fill" style={{ width: `${storagePercent}%` }} />
        </div>
      </div>

      {/* Profile */}
      <div className="sidebar-profile">
        <div className="sidebar-avatar" aria-hidden>{initials}</div>
        <div className="sidebar-user-info">
          <div className="sidebar-user-name">{user?.name || 'Creator'}</div>
          <div className="sidebar-user-email">{user?.email}</div>
        </div>
        <button className="sidebar-logout-btn" onClick={onLogout} aria-label="Logout" title="Logout">
          <FiLogOut size={16} />
        </button>
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
  onMarketplace: PropTypes.func,
  onNavigateHome: PropTypes.func,
};

export default React.memo(Sidebar);
