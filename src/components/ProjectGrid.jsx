import React from 'react';
import PropTypes from 'prop-types';
import { ProjectCard } from './ProjectCard';
import { FiFolder } from 'react-icons/fi';

function ProjectGrid({ projects, loading, filteredProjects, presenceMap, saveProgressMap, onOpen, onPreview, onDuplicate, onContext, onOpenStudio, viewMode, timeAgo }) {
  if (loading || projects === null) {
    return (
      <div className={`projects-grid ${viewMode === 'list' ? 'list-view' : ''}`} role="list" aria-busy="true" aria-label="Loading projects">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={`skeleton-${i}`} className="project-card skeleton-card" aria-hidden="true" role="listitem">
            <div className="skeleton-thumb" />
            <div className="skeleton-body">
              <div className="skeleton-line w-60" />
              <div className="skeleton-line w-40" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!Array.isArray(filteredProjects) || filteredProjects.length === 0) {
    return (
      <div className="empty-state-card">
        <div className="empty-icon-wrap"><FiFolder size={32} /></div>
        <h4 className="empty-title">No projects found</h4>
        <p className="empty-desc">Create your first project or adjust your search filters.</p>
      </div>
    );
  }

  return (
    <div className={`projects-grid ${viewMode === 'list' ? 'list-view' : ''}`} role="list" aria-label="Projects">
      {filteredProjects.map((p, i) => (
        <ProjectCard
          key={(p._id || `${p.title || 'untitled'}-${i}`) + '-' + i}
          project={p}
          thumbSrc={p.thumbnailUrl}
          presence={presenceMap?.[p._id]}
          saveProgress={saveProgressMap}
          onOpen={onOpen}
          onPreview={onPreview}
          onDuplicate={onDuplicate}
          onContext={onContext}
          onOpenStudio={onOpenStudio}
          timeAgo={timeAgo}
        />
      ))}
    </div>
  );
}

ProjectGrid.propTypes = {
  projects: PropTypes.array,
  loading: PropTypes.bool,
  filteredProjects: PropTypes.array,
  presenceMap: PropTypes.object,
  saveProgressMap: PropTypes.object,
  onOpen: PropTypes.func,
  onPreview: PropTypes.func,
  onDuplicate: PropTypes.func,
  onContext: PropTypes.func,
  onOpenStudio: PropTypes.func,
  viewMode: PropTypes.string,
  timeAgo: PropTypes.func,
};

export default React.memo(ProjectGrid);
