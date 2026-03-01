// src/pages/Projects.jsx
import React, { useState, useRef, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import ModelViewerWrapper from "../components/ModelViewerWrapper";

const PROJECTS = [
  { name: "Black Dragon", status: "In Review", owner: "Art", summary: "High-poly dragon with idle animation.", progress: 88, team: 3, deadline: "3 days", glbUrl: "/models/black_dragon_with_idle_animation.glb" },
  { name: "Cyberpunk Desk", status: "Lighting QA", owner: "Design Ops", summary: "Desk vignette with emissive details.", progress: 72, team: 2, deadline: "5 days", glbUrl: "/models/cyberpunk_desk.glb" },
  { name: "Flynn's Arcade", status: "Client Preview", owner: "Marketing", summary: "Retro arcade diorama for campaign visuals.", progress: 94, team: 4, deadline: "2 days", glbUrl: "/models/flynns_arcade.glb" },
  { name: "Gipsy Avenger", status: "In Progress", owner: "VFX", summary: "Mecha asset from Pacific Rim portfolio.", progress: 56, team: 5, deadline: "1 week", glbUrl: "/models/gipsy_avenger_-_pacific_rim.glb" },
  { name: "iPhone 17 Pro", status: "Testing", owner: "E-commerce", summary: "Product model for configurator and AR.", progress: 81, team: 3, deadline: "4 days", glbUrl: "/models/iphone_17_pro.glb" },
  { name: "Laptop Free", status: "Planning", owner: "Hardware", summary: "Lightweight laptop model for hero renders.", progress: 22, team: 2, deadline: "3 weeks", glbUrl: "/models/laptop_free.glb" },
  { name: "Porsche", status: "In Review", owner: "Automotive", summary: "Vehicle exterior with metallic shaders.", progress: 90, team: 6, deadline: "5 days", glbUrl: "/models/porsche.glb" },
];

const WORKFLOW_STEPS = [
  {
    title: "Ideate",
    desc: "Collect references, colorways, and scene briefs in one shared workspace.",
    num: "01",
  },
  {
    title: "Build",
    desc: "Iterate on meshes, lighting rigs, and materials with real-time playback.",
    num: "02",
  },
  {
    title: "Review",
    desc: "Invite stakeholders, compare versions side-by-side, and lock approvals.",
    num: "03",
  },
  {
    title: "Ship",
    desc: "Export production-ready GLB, USDZ and publish shareable links instantly.",
    num: "04",
  },
];

const PROJECT_TEMPLATES = [
  { name: "Product Showcase", desc: "Studio lighting with material presets", icon: "cube" },
  { name: "Character Design", desc: "Rigged character with animation clips", icon: "user" },
  { name: "Environment Scene", desc: "Atmospheric 3D world with day/night", icon: "globe" },
  { name: "Architectural Viz", desc: "Interior and exterior walkthrough", icon: "building" },
];

const TEMPLATE_ICONS = {
  cube: (
    <svg viewBox="0 0 24 24" fill="none" width="36" height="36" aria-hidden="true">
      <path d="M20 7L12 3L4 7M20 7L12 11M20 7V17L12 21M12 11L4 7M12 11V21M4 7V17L12 21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  user: (
    <svg viewBox="0 0 24 24" fill="none" width="36" height="36" aria-hidden="true">
      <path d="M20 21V19C20 17.9391 19.5786 16.9217 18.8284 16.1716C18.0783 15.4214 17.0609 15 16 15H8C6.93913 15 5.92172 15.4214 5.17157 16.1716C4.42143 16.9217 4 17.9391 4 19V21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="7" r="4" stroke="currentColor" strokeWidth="2" />
    </svg>
  ),
  globe: (
    <svg viewBox="0 0 24 24" fill="none" width="36" height="36" aria-hidden="true">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
      <path d="M2 12H22M12 2C14.5 4.5 15.5 8 15.5 12C15.5 16 14.5 19.5 12 22C9.5 19.5 8.5 16 8.5 12C8.5 8 9.5 4.5 12 2Z" stroke="currentColor" strokeWidth="2" />
    </svg>
  ),
  building: (
    <svg viewBox="0 0 24 24" fill="none" width="36" height="36" aria-hidden="true">
      <rect x="4" y="2" width="16" height="20" rx="2" stroke="currentColor" strokeWidth="2" />
      <path d="M9 22V18H15V22M9 6H10M14 6H15M9 10H10M14 10H15M9 14H10M14 14H15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  ),
};

export default function Projects() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const studioTarget = user ? "/dashboard" : "/login";
  const [selectedStatus, setSelectedStatus] = useState("All");
  const [sortBy, setSortBy] = useState("progress");
  const cardsRef = useRef([]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) entry.target.classList.add("is-visible");
        });
      },
      { threshold: 0.08 }
    );
    cardsRef.current.forEach((card) => {
      if (card) observer.observe(card);
    });
    return () => observer.disconnect();
  }, [selectedStatus]);

  const statuses = ["All", "In Progress", "In Review", "Client Preview", "Testing", "Planning", "Lighting QA"];
  const filteredProjects = selectedStatus === "All"
    ? PROJECTS
    : PROJECTS.filter((p) => p.status === selectedStatus);

  const sortedProjects = [...filteredProjects].sort((a, b) => {
    if (sortBy === "progress") return b.progress - a.progress;
    if (sortBy === "team") return b.team - a.team;
    return 0;
  });

  const totalTeamMembers = PROJECTS.reduce((sum, p) => sum + p.team, 0);
  const avgProgress = Math.round(PROJECTS.reduce((sum, p) => sum + p.progress, 0) / PROJECTS.length);
  const nearCompletion = PROJECTS.filter((p) => p.progress >= 80).length;

  const statusColor = (status) => {
    const map = {
      "In Progress": "#7f5af0",
      "In Review": "#00d7ff",
      "Client Preview": "#ff9a3e",
      Testing: "#b4ff3a",
      Planning: "#9da6d4",
      "Lighting QA": "#ff47a3",
    };
    return map[status] || "#7f5af0";
  };

  return (
    <div className="site-wrapper">
      <main className="home-shell">
        {/* Hero */}
        <section className="text-center" style={{ animation: "fadeInUp 0.7s ease-out", marginBottom: "3.5rem" }}>
          <span className="hero-badge-top">Project Hub</span>
          <h1 className="hero-title" style={{ marginBottom: "1.5rem" }}>
            Manage Your <span className="title-gradient">Creative Pipeline</span>
          </h1>
          <p className="hero-subtitle" style={{ maxWidth: "720px", margin: "0 auto 2rem" }}>
            Track active projects, coordinate across teams, and deliver production-ready 3D assets on schedule.
          </p>
          <div className="hero-actions" style={{ justifyContent: "center" }}>
            <button onClick={() => navigate(studioTarget)} className="cta-button cta-primary" data-magnetic="0.15">
              {user ? "Open Dashboard" : "Get Started Free"}
            </button>
            <Link to="/gallery" className="cta-button cta-secondary" data-magnetic="0.1">
              View Gallery
            </Link>
          </div>
        </section>

        {/* Workflow Steps */}
        <section className="projects-workflow-grid" style={{ animation: "fadeInUp 0.8s ease-out" }}>
          {WORKFLOW_STEPS.map((step) => (
            <div key={step.title} className="projects-workflow-card panel-glass" data-tilt="4">
              <span className="projects-step-num">{step.num}</span>
              <h3 className="projects-step-title">{step.title}</h3>
              <p className="projects-step-desc">{step.desc}</p>
            </div>
          ))}
        </section>

        {/* Stats */}
        <section className="projects-stats-bar panel-glass" style={{ animation: "fadeInUp 0.85s ease-out" }}>
          <div className="projects-stat">
            <span className="projects-stat-value">{PROJECTS.length}</span>
            <span className="projects-stat-label">Active Projects</span>
          </div>
          <div className="projects-stat">
            <span className="projects-stat-value">{totalTeamMembers}</span>
            <span className="projects-stat-label">Team Members</span>
          </div>
          <div className="projects-stat">
            <span className="projects-stat-value">{avgProgress}%</span>
            <span className="projects-stat-label">Avg Progress</span>
          </div>
          <div className="projects-stat">
            <span className="projects-stat-value">{nearCompletion}</span>
            <span className="projects-stat-label">Near Completion</span>
          </div>
        </section>

        {/* Filter + Sort */}
        <section className="projects-controls">
          <div className="projects-controls-top">
            <h2 className="section-title" style={{ margin: 0, fontSize: "1.6rem" }}>Active Boards</h2>
            <div className="projects-controls-actions">
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="projects-sort-select">
                <option value="progress">Sort by Progress</option>
                <option value="team">Sort by Team Size</option>
              </select>
              <button onClick={() => navigate(studioTarget)} className="cta-button cta-primary projects-new-btn">
                + New Project
              </button>
            </div>
          </div>
          <div className="projects-filter-bar">
            {statuses.map((status) => (
              <button
                key={status}
                onClick={() => setSelectedStatus(status)}
                className={`gallery-filter-btn${selectedStatus === status ? " active" : ""}`}
                aria-pressed={selectedStatus === status}
              >
                {status}
              </button>
            ))}
          </div>
        </section>

        {/* Project Cards */}
        <section className="projects-grid">
          {sortedProjects.length === 0 && (
            <article className="gallery-empty panel-glass">
              <h3>No boards found</h3>
              <p>Try a different status filter or create a new board.</p>
              <button onClick={() => setSelectedStatus("All")} className="cta-button cta-secondary" data-magnetic="0.1">
                Show All Boards
              </button>
            </article>
          )}
          {sortedProjects.map((project, idx) => (
            <article
              key={project.name}
              ref={(el) => (cardsRef.current[idx] = el)}
              className="projects-card panel-glass showcase-card"
              data-tilt="4"
            >
              <div className="projects-card-preview" style={{ height: 220, position: 'relative', overflow: 'hidden', borderRadius: 8 }}>
                {project.glbUrl ? (
                  <ModelViewerWrapper
                    src={project.glbUrl}
                    poster={project.thumbnailUrl || undefined}
                    autoRotate={true}
                    cameraControls={true}
                    className="projects-model-viewer"
                    style={{ width: '100%', height: '100%' }}
                  />
                ) : (
                  <div className="projects-card-graphic" style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {/* fallback graphic for non-GLB projects */}
                    <svg width="120" height="80" viewBox="0 0 120 80" fill="none" aria-hidden>
                      <rect x="2" y="2" width="116" height="76" rx="6" stroke="rgba(255,255,255,0.06)" fill="rgba(0,0,0,0.06)" />
                    </svg>
                  </div>
                )}
              </div>
              <div className="projects-card-header">
                <span className="projects-card-status" style={{ color: statusColor(project.status), borderColor: statusColor(project.status) }}>
                  {project.status}
                </span>
                <span className="projects-card-owner">{project.owner}</span>
              </div>
              <h3 className="projects-card-name">{project.name}</h3>
              <p className="projects-card-summary">{project.summary}</p>

              {/* Progress */}
              <div className="projects-progress-wrap">
                <div className="projects-progress-top">
                  <span className="projects-progress-label">Progress</span>
                  <span className="projects-progress-pct" style={{ color: statusColor(project.status) }}>{project.progress}%</span>
                </div>
                <div className="projects-progress-track">
                  <div className="projects-progress-fill" style={{ width: `${project.progress}%`, background: `linear-gradient(90deg, ${statusColor(project.status)}, var(--brand-teal))` }} />
                </div>
              </div>

              {/* Meta */}
              <div className="projects-card-meta">
                <div className="projects-card-meta-left">
                  <span>Team: {project.team}</span>
                  <span>Due: {project.deadline}</span>
                </div>
                <button className="cta-button projects-details-btn" onClick={() => navigate('/studio', { state: { importUrl: project.glbUrl } })}>View</button>
              </div>
            </article>
          ))}
        </section>

        {/* Templates */}
        <section style={{ marginTop: "4rem" }}>
          <div className="text-center" style={{ marginBottom: "2.5rem" }}>
            <h2 className="section-title">Start with a Template</h2>
            <p className="section-subtitle">Pre-configured project setups to accelerate your workflow</p>
          </div>
          <div className="projects-template-grid">
            {PROJECT_TEMPLATES.map((tmpl) => (
              <article key={tmpl.name} className="projects-template-card panel-glass" data-tilt="5">
                <div className="projects-template-icon">{TEMPLATE_ICONS[tmpl.icon]}</div>
                <h3 className="projects-template-name">{tmpl.name}</h3>
                <p className="projects-template-desc">{tmpl.desc}</p>
                <button onClick={() => navigate(studioTarget)} className="cta-button cta-secondary projects-template-btn">
                  Use Template
                </button>
              </article>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="panel-glass neon-rim gallery-cta-panel" style={{ marginTop: "4rem" }}>
          <h2 className="section-title" style={{ marginBottom: "1rem" }}>
            Ready to Streamline Your Workflow?
          </h2>
          <p className="section-subtitle" style={{ marginBottom: "2rem", maxWidth: "600px", margin: "0 auto 2rem" }}>
            Join teams using Objekta to manage complex 3D projects and deliver faster.
          </p>
          <div className="hero-actions" style={{ justifyContent: "center" }}>
            <button onClick={() => navigate(studioTarget)} className="cta-button cta-primary" data-magnetic="0.18">
              {user ? "Create Project" : "Get Started"}
            </button>
            <Link to="/contact" className="cta-button cta-secondary" data-magnetic="0.1">
              Talk to Sales
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
