import React, { useCallback } from 'react';
import PropTypes from 'prop-types';
import Thumbnail from './Thumbnail';

const ProjectCard = React.memo(function ProjectCard({
  project,
  thumbSrc,
  presence,
  saveProgress,
  onOpen,
  onPreview,
  onDuplicate,
  onContext,
  onOpenStudio,
}) {
  const progressFraction = typeof saveProgress?.[project._id] === 'number' ? saveProgress[project._id] : null;
  const progressPercent = progressFraction != null ? Math.round(progressFraction * 100) : project.progress || 0;

  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === 'Enter') onOpen?.(project);
      if (e.key === ' ' || (e.shiftKey && e.key === 'F10')) {
        e.preventDefault();
        onContext?.(e, project);
      }
    },
    [onOpen, onContext, project]
  );

  return (
    <article
      className="project-card card-3d neon-rim"
      tabIndex={0}
      role="button"
      aria-label={project.title}
      onClick={() => onOpen?.(project)}
      onKeyDown={handleKeyDown}
      onContextMenu={(e) => onContext?.(e, project)}
    >
      <div className="thumb">
        <Thumbnail src={thumbSrc} alt={project.title} onError={(e) => { e.target.onerror = null; e.target.src = '/placeholder-thumb.svg'; }} />

        {progressFraction != null ? (
          <div className="upload-overlay" aria-hidden>
            <div className="upload-text">Saving… {Math.round(progressFraction * 100)}%</div>
            <div className="upload-bar" aria-hidden>
              <div style={{ width: `${Math.round(progressFraction * 100)}%` }} />
            </div>
          </div>
        ) : (
          <div className="progress-badge hud-badge">{progressPercent}%</div>
        )}

        <div className="collab-overlay" aria-hidden>
          {(project.collaborators || []).slice(0, 3).map((c, idx) => (
            <div className="collab-dot" key={idx} title={typeof c === 'string' ? c : c.name}>
              {typeof c === 'string' ? c[0] : c.name ? c.name[0] : 'U'}
            </div>
          ))}
          {(project.collaborators || []).length > 3 && <div className="collab-dot" title="More">+{(project.collaborators || []).length - 3}</div>}

          {presence && presence.length > 0 && (
            <div style={{ marginLeft: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 10, height: 10, borderRadius: 20, background: 'var(--success)', boxShadow: '0 6px 12px rgba(39,210,122,0.12)' }} />
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>{presence.length} online</div>
            </div>
          )}
        </div>
      </div>

      <div className="card-body">
        <div className="card-title" title={project.title}>{project.title}</div>
        <div className="card-meta">
          <div className="date text-muted">{project.updatedAt ? new Date(project.updatedAt).toLocaleDateString() : ''}</div>
          <div className="card-actions">
            <button className="btn btn-ghost btn-small" onClick={(e) => { e.stopPropagation(); onOpenStudio?.(project); }}>
              Open
            </button>
            <button className="btn btn-ghost btn-small" onClick={(e) => { e.stopPropagation(); onPreview?.(project); }}>
              Preview
            </button>
            <button className="btn btn-ghost btn-small" onClick={(e) => { e.stopPropagation(); onDuplicate?.(project); }}>
              Duplicate
            </button>
          </div>
        </div>
      </div>
    </article>
  );
});

ProjectCard.propTypes = {
  project: PropTypes.object.isRequired,
  thumbSrc: PropTypes.string,
  presence: PropTypes.array,
  saveProgress: PropTypes.object,
  onOpen: PropTypes.func,
  onPreview: PropTypes.func,
  onDuplicate: PropTypes.func,
  onContext: PropTypes.func,
  onOpenStudio: PropTypes.func,
};

export { ProjectCard };
