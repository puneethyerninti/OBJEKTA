import React from 'react';
import PropTypes from 'prop-types';
import { ProjectCard } from './ProjectCard';

function ProjectGrid({ projects, loading, filteredProjects, presenceMap, saveProgressMap, onOpen, onPreview, onDuplicate, onContext, onOpenStudio }) {
  if (loading || projects === null) {
    return (
      <div className="projects-grid" role="list" aria-busy="true" aria-label="Loading projects">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={`skeleton-${i}`} className="project-card skeleton" aria-hidden="true" role="listitem">
            <div className="thumb skeleton-box" />
            <div className="card-body">
              <div className="skeleton-line short" />
              <div className="skeleton-line" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!Array.isArray(filteredProjects) || filteredProjects.length === 0) {
    return <div className="mini-card">No projects match — try creating one or change your filters.</div>;
  }

  return (
    <div className="projects-grid dash-grid" role="list" aria-label="Projects">
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
};

export default React.memo(ProjectGrid);
