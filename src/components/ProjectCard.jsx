import React, { useCallback } from 'react';
import PropTypes from 'prop-types';
import Thumbnail from './Thumbnail';
import {
  FiMoreHorizontal, FiExternalLink, FiEye, FiCopy,
} from 'react-icons/fi';

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
  timeAgo,
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

  const dateStr = timeAgo
    ? timeAgo(project.updatedAt || project.createdAt)
    : (project.updatedAt ? new Date(project.updatedAt).toLocaleDateString() : '');

  return (
    <div
      className="project-card"
      tabIndex={0}
      role="listitem"
      aria-label={`Project: ${project.title}`}
      onClick={() => onOpen?.(project)}
      onKeyDown={handleKeyDown}
      onContextMenu={(e) => { e.stopPropagation(); onContext?.(e, project); }}
    >
      {/* Thumbnail area */}
      <div className="card-thumb-wrap">
        <Thumbnail
          src={thumbSrc}
          alt={project.title}
          onError={(e) => { e.target.onerror = null; e.target.src = '/placeholder-thumb.svg'; }}
        />

        {/* Save progress overlay */}
        {progressFraction != null ? (
          <div className="card-save-overlay" aria-hidden>
            <div className="card-save-text">Saving… {Math.round(progressFraction * 100)}%</div>
            <div className="card-save-bar">
              <div style={{ width: `${Math.round(progressFraction * 100)}%` }} />
            </div>
          </div>
        ) : (
          <div className="card-progress-badge">
            <span className="card-progress-dot" />
            {progressPercent}%
          </div>
        )}

        <div className="card-thumb-overlay" />

        {/* Collaborator avatars */}
        {(project.collaborators || []).length > 0 && (
          <div className="card-collab-stack" aria-hidden>
            {(project.collaborators || []).slice(0, 3).map((c, idx) => (
              <div className="card-collab-dot" key={idx} title={typeof c === 'string' ? c : c.name}>
                {typeof c === 'string' ? c[0] : c.name ? c.name[0] : 'U'}
              </div>
            ))}
            {(project.collaborators || []).length > 3 && (
              <div className="card-collab-dot" title="More">+{(project.collaborators || []).length - 3}</div>
            )}
          </div>
        )}
      </div>

      {/* Card body */}
      <div className="card-body">
        <div className="card-title-row">
          <div className="card-title" title={project.title}>{project.title}</div>
          <button
            className="card-more-btn"
            aria-label="More actions"
            onClick={(e) => { e.stopPropagation(); onContext?.(e, project); }}
          >
            <FiMoreHorizontal size={16} />
          </button>
        </div>
        <div className="card-meta-row">
          <div className="card-date">
            {dateStr}
            {presence && presence.length > 0 && (
              <span className="card-presence">
                <span className="card-presence-dot" /> {presence.length} online
              </span>
            )}
          </div>
          <div className="card-actions">
            <button className="card-action-btn" aria-label={`Open ${project.title}`} onClick={(e) => { e.stopPropagation(); onOpenStudio?.(project); }}>
              <FiExternalLink size={12} /> Open
            </button>
            <button className="card-action-btn" aria-label={`Preview ${project.title}`} onClick={(e) => { e.stopPropagation(); onPreview?.(project); }}>
              <FiEye size={12} />
            </button>
            <button className="card-action-btn" aria-label={`Duplicate ${project.title}`} onClick={(e) => { e.stopPropagation(); onDuplicate?.(project); }}>
              <FiCopy size={12} />
            </button>
          </div>
        </div>
      </div>
    </div>
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
  timeAgo: PropTypes.func,
};

export { ProjectCard };
