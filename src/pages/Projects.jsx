// src/pages/Projects.jsx
import React, { useState, useRef, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { usePageTitle } from "../hooks/usePageTitle";
import ModelViewerWrapper from "../components/ModelViewerWrapper";
import "../styles/PremiumPages.css";

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
  usePageTitle("Projects");
  const { user } = useAuth();
  const navigate = useNavigate();
  const dashboardTarget = user ? "/dashboard" : "/login";
  const studioEditorTarget = user ? "/studio" : "/login";
  const [selectedStatus, setSelectedStatus] = useState("All");
  const [sortBy, setSortBy] = useState("progress");
  const [selectedProject, setSelectedProject] = useState(null);
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
    <div className="site-wrapper projects-page-premium">
      <main className="projects-main-premium">
        {/* Hero Section */}
        <section className="projects-header-premium">
          <h1>Manage Your <span className="gradient-text">Creative Pipeline</span></h1>
          <p>
            Coordinate production work across teams, keep project quality consistent, and ship review-ready 3D deliverables on schedule.
          </p>
        </section>

        {/* Workflow Steps */}
        <section style={{ marginTop: "3rem", marginBottom: "3rem" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "2rem" }}>
            {WORKFLOW_STEPS.map((step, idx) => (
              <div key={step.title} className="project-card-premium" style={{ animationDelay: `${idx * 0.1}s` }}>
                <div style={{ fontSize: "2.5rem", fontWeight: 900, background: "var(--gradient-primary)", backgroundClip: "text", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", marginBottom: "1rem" }}>
                  {step.num}
                </div>
                <h3 style={{ fontSize: "1.1rem", fontWeight: 700, color: "white", margin: "0 0 0.75rem 0" }}>{step.title}</h3>
                <p style={{ fontSize: "0.95rem", color: "rgba(255,255,255,0.6)", margin: 0, lineHeight: "1.5" }}>{step.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Stats */}
        <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "2rem", marginBottom: "3rem" }}>
          {[
            { value: PROJECTS.length, label: "Active Projects" },
            { value: totalTeamMembers, label: "Team Members" },
            { value: `${avgProgress}%`, label: "Avg Progress" },
            { value: nearCompletion, label: "Near Completion" },
          ].map((stat, i) => (
            <div key={i} className="stat-card" style={{ animationDelay: `${i * 0.1}s` }}>
              <div className="stat-value">{stat.value}</div>
              <div className="stat-label">{stat.label}</div>
            </div>
          ))}
        </section>

        {/* Main Content Area */}
        <div style={{ display: "grid", gridTemplateColumns: selectedProject ? "1fr 400px" : "1fr", gap: "2rem", marginBottom: "2rem" }}>
          {/* Left: Project List */}
          <div>
            {/* Filter + Sort */}
            <section style={{ marginBottom: "2rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem", gap: "1rem", flexWrap: "wrap" }}>
                <h2 style={{ fontSize: "1.6rem", fontWeight: 700, margin: 0, color: "white" }}>Active Projects</h2>
                <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} style={{ padding: "0.75rem 1rem", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", color: "white", cursor: "pointer" }}>
                  <option value="progress">Sort by Progress</option>
                  <option value="team">Sort by Team Size</option>
                </select>
              </div>
              <div className="gallery-filter-bar">
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

            {/* Project Grid */}
            <section>
              {sortedProjects.length === 0 && (
                <div style={{ textAlign: "center", padding: "3rem" }}>
                  <h3 style={{ color: "white", marginBottom: "1rem" }}>No projects found</h3>
                  <p style={{ color: "rgba(255,255,255,0.6)", marginBottom: "2rem" }}>Try a different status filter or create a new project.</p>
                  <button onClick={() => setSelectedStatus("All")} className="btn btn-secondary">
                    Show All Projects
                  </button>
                </div>
              )}
              <div style={{ display: "grid", gridTemplateColumns: selectedProject ? "1fr" : "repeat(auto-fill, minmax(280px, 1fr))", gap: "2rem" }}>
                {sortedProjects.map((project, idx) => (
                  <article
                    key={project.name}
                    ref={(el) => (cardsRef.current[idx] = el)}
                    onClick={() => setSelectedProject(project)}
                    style={{
                      cursor: "pointer",
                      animationDelay: `${idx * 0.08}s`,
                      border: selectedProject?.name === project.name ? "2px solid #7f5af0" : "1px solid rgba(255,255,255,0.1)",
                      transform: selectedProject?.name === project.name ? "scale(1.02)" : "scale(1)",
                      transition: "all 0.3s ease",
                    }}
                    className="project-card-premium"
                  >
                    {/* Project Thumbnail/Model Preview */}
                    <div style={{
                      width: "100%",
                      height: "200px",
                      background: "linear-gradient(135deg, rgba(127,90,240,0.1), rgba(0,215,255,0.1))",
                      borderRadius: "12px",
                      overflow: "hidden",
                      marginBottom: "1rem",
                      position: "relative"
                    }}>
                      {project.glbUrl ? (
                        <ModelViewerWrapper
                          src={project.glbUrl}
                          autoRotate={true}
                          cameraControls={false}
                          style={{ width: '100%', height: '100%' }}
                        />
                      ) : (
                        <div style={{
                          width: '100%',
                          height: '100%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'rgba(255,255,255,0.3)'
                        }}>
                          No Model Available
                        </div>
                      )}
                    </div>

                    {/* Card Content */}
                    <div className="project-card-header-premium">
                      <span className="project-card-status-premium" style={{ color: statusColor(project.status), borderColor: statusColor(project.status) }}>
                        {project.status}
                      </span>
                      <span style={{ fontSize: "0.85rem", color: "rgba(255,255,255,0.6)" }}>{project.owner}</span>
                    </div>
                    <div className="project-card-body-premium">
                      <h3 className="project-card-title-premium">{project.name}</h3>
                      <p className="project-card-desc-premium">{project.summary}</p>

                      <div className="project-progress-bar-premium" style={{ marginTop: "1rem" }}>
                        <div className="project-progress-fill-premium" style={{ width: `${project.progress}%`, background: statusColor(project.status) }} />
                      </div>
                      <div style={{ fontSize: "0.85rem", color: "rgba(255,255,255,0.5)", marginTop: "0.5rem" }}>{project.progress}% complete</div>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          </div>

          {/* Right: Selected Project Details */}
          {selectedProject && (
            <div style={{
              position: "sticky",
              top: "80px",
              height: "fit-content",
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: "16px",
              padding: "1.5rem",
              animation: "fadeInUp 0.3s ease-out"
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: "1.5rem" }}>
                <h3 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 700, color: "white" }}>Details</h3>
                <button
                  onClick={() => setSelectedProject(null)}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "rgba(255,255,255,0.6)",
                    cursor: "pointer",
                    fontSize: "1.5rem"
                  }}
                >
                  ×
                </button>
              </div>

              {/* Project Info */}
              <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                <div>
                  <div style={{ fontSize: "0.8rem", color: "rgba(255,255,255,0.5)", textTransform: "uppercase", fontWeight: 600, marginBottom: "0.5rem" }}>Project Name</div>
                  <div style={{ fontSize: "1rem", color: "white", fontWeight: 600 }}>{selectedProject.name}</div>
                </div>

                <div>
                  <div style={{ fontSize: "0.8rem", color: "rgba(255,255,255,0.5)", textTransform: "uppercase", fontWeight: 600, marginBottom: "0.5rem" }}>Status</div>
                  <span style={{ color: statusColor(selectedProject.status), background: `${statusColor(selectedProject.status)}20`, padding: "0.4rem 0.8rem", borderRadius: "6px", fontSize: "0.9rem", fontWeight: 600 }}>
                    {selectedProject.status}
                  </span>
                </div>

                <div>
                  <div style={{ fontSize: "0.8rem", color: "rgba(255,255,255,0.5)", textTransform: "uppercase", fontWeight: 600, marginBottom: "0.5rem" }}>Progress</div>
                  <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                    <div style={{ flex: 1, height: "6px", background: "rgba(255,255,255,0.1)", borderRadius: "3px", overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${selectedProject.progress}%`, background: statusColor(selectedProject.status) }} />
                    </div>
                    <span style={{ color: statusColor(selectedProject.status), fontWeight: 700, minWidth: "3rem" }}>{selectedProject.progress}%</span>
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: "0.8rem", color: "rgba(255,255,255,0.5)", textTransform: "uppercase", fontWeight: 600, marginBottom: "0.5rem" }}>Team Size</div>
                  <div style={{ fontSize: "1rem", color: "white", fontWeight: 600 }}>{selectedProject.team} Members</div>
                </div>

                <div>
                  <div style={{ fontSize: "0.8rem", color: "rgba(255,255,255,0.5)", textTransform: "uppercase", fontWeight: 600, marginBottom: "0.5rem" }}>Deadline</div>
                  <div style={{ fontSize: "1rem", color: "white", fontWeight: 600 }}>{selectedProject.deadline}</div>
                </div>

                <div>
                  <div style={{ fontSize: "0.8rem", color: "rgba(255,255,255,0.5)", textTransform: "uppercase", fontWeight: 600, marginBottom: "0.5rem" }}>Owner</div>
                  <div style={{ fontSize: "1rem", color: "white", fontWeight: 600 }}>{selectedProject.owner}</div>
                </div>

                <div>
                  <div style={{ fontSize: "0.8rem", color: "rgba(255,255,255,0.5)", textTransform: "uppercase", fontWeight: 600, marginBottom: "0.5rem" }}>Description</div>
                  <p style={{ margin: 0, fontSize: "0.9rem", color: "rgba(255,255,255,0.7)", lineHeight: "1.5" }}>{selectedProject.summary}</p>
                </div>

                <button
                  onClick={() => navigate(studioEditorTarget)}
                  className="btn btn-primary"
                  style={{ marginTop: "1rem", width: "100%" }}
                >
                  {user ? "Open in Studio" : "Sign In to Open"}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Templates Section */}
        <section style={{ marginTop: "4rem", marginBottom: "3rem" }}>
          <div style={{ textAlign: "center", marginBottom: "2.5rem" }}>
            <h2 style={{ fontSize: "2rem", fontWeight: 900, background: "var(--gradient-primary)", backgroundClip: "text", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", margin: "0 0 0.5rem 0" }}>Start with a Template</h2>
            <p style={{ fontSize: "1.1rem", color: "rgba(255,255,255,0.6)", margin: 0 }}>Pre-configured project setups to accelerate your workflow</p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "2rem" }}>
            {PROJECT_TEMPLATES.map((tmpl, idx) => (
              <article key={tmpl.name} className="project-card-premium" style={{ animationDelay: `${idx * 0.1}s` }}>
                <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>{TEMPLATE_ICONS[tmpl.icon]}</div>
                <h3 className="project-card-title-premium">{tmpl.name}</h3>
                <p className="project-card-desc-premium">{tmpl.desc}</p>
                <button onClick={() => navigate(studioEditorTarget)} className="btn btn-primary" style={{ marginTop: "1rem", width: "100%" }}>
                  Use Template
                </button>
              </article>
            ))}
          </div>
        </section>

        {/* CTA Section */}
        <section className="about-cta">
          <h2>Ready to Streamline Your Workflow?</h2>
          <p>Use standardized workflows, documentation-driven reviews, and real-time collaboration to deliver confidently.</p>
          <div className="cta-actions">
            <button onClick={() => navigate(dashboardTarget)} className="btn btn-primary btn-lg">
              {user ? "Open Dashboard" : "Get Started"}
            </button>
            <Link to="/documentation" className="btn btn-secondary btn-lg">
              Read Workflow Documentation
            </Link>
            <Link to="/contact" className="btn btn-outline btn-lg">
              Contact Product Team
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
