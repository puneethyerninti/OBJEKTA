import React, { useState, useRef, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

const PROJECTS = [
  {
    name: "Neon Workspace Revamp",
    status: "In Review",
    owner: "Design Ops",
    summary: "Lighting pass approval and shader polish for the home studio layout.",
    progress: 85,
    team: 4,
    deadline: "2 days",
  },
  {
    name: "Aurora Product Launch",
    status: "Client Preview",
    owner: "Marketing",
    summary: "Hero renders plus AR-ready exports for the launch campaign.",
    progress: 92,
    team: 6,
    deadline: "5 days",
  },
  {
    name: "Concept Vehicle Sprint",
    status: "Lighting QA",
    owner: "Automotive",
    summary: "Material variants, studio HDRIs, and presentation turntables.",
    progress: 67,
    team: 5,
    deadline: "1 week",
  },
  {
    name: "Character Animation",
    status: "In Progress",
    owner: "Game Studio",
    summary: "Rigging, skinning, and motion capture integration for hero character.",
    progress: 45,
    team: 3,
    deadline: "2 weeks",
  },
  {
    name: "VR Environment",
    status: "Planning",
    owner: "XR Team",
    summary: "Immersive 360° environment with interactive elements.",
    progress: 20,
    team: 7,
    deadline: "3 weeks",
  },
  {
    name: "Product Configurator",
    status: "Testing",
    owner: "E-commerce",
    summary: "Real-time product customization with material swapping.",
    progress: 78,
    team: 4,
    deadline: "4 days",
  },
];

const WORKFLOW_STEPS = [
  {
    title: "Ideate",
    desc: "Collect references, colorways, and scene briefs in one workspace.",
    icon: "💡",
  },
  {
    title: "Build",
    desc: "Iterate on meshes, lighting rigs, and materials with instant playback.",
    icon: "🔨",
  },
  {
    title: "Review",
    desc: "Invite stakeholders, compare versions, and lock approvals faster.",
    icon: "👀",
  },
  {
    title: "Ship",
    desc: "Export USDZ/GLB and publish ready-to-share assets instantly.",
    icon: "🚀",
  },
];

const PROJECT_TEMPLATES = [
  { name: "Product Showcase", desc: "Studio lighting and material setup", icon: "📦" },
  { name: "Character Design", desc: "Rigged character with animations", icon: "🎭" },
  { name: "Environment Scene", desc: "Atmospheric 3D environment", icon: "🌄" },
  { name: "Architectural Viz", desc: "Interior and exterior renders", icon: "🏢" },
];

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
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
          }
        });
      },
      { threshold: 0.1 }
    );

    cardsRef.current.forEach((card) => {
      if (card) observer.observe(card);
    });

    return () => observer.disconnect();
  }, [selectedStatus]);

  const statuses = ["All", "In Progress", "In Review", "Client Preview", "Testing", "Planning"];
  const filteredProjects = selectedStatus === "All" 
    ? PROJECTS 
    : PROJECTS.filter(p => p.status === selectedStatus);

  const sortedProjects = [...filteredProjects].sort((a, b) => {
    if (sortBy === "progress") return b.progress - a.progress;
    if (sortBy === "team") return b.team - a.team;
    return 0;
  });

  return (
    <div className="site-wrapper">
      {/* Background effects */}
      <div className="grid-glow" aria-hidden="true" />
      <div className="scanline-overlay" aria-hidden="true" />

      <main className="home-shell">
        {/* Hero Section */}
        <section className="text-center mb-14" style={{ animation: 'fade-up 0.7s ease-out' }}>
          <span className="hero-badge-top" style={{ display: 'inline-block', marginBottom: '1.5rem' }}>
            Project Hub
          </span>
          <h1 className="hero-title" style={{ marginBottom: '1.5rem' }}>
            Manage Your
            <span className="title-gradient"> Creative Pipeline</span>
          </h1>
          <p className="hero-subtitle" style={{ maxWidth: '720px', margin: '0 auto 2rem' }}>
            Track active projects, coordinate with teams, and deliver pixel-perfect assets on schedule.
          </p>
          <div className="hero-actions" style={{ justifyContent: 'center' }}>
            <button 
              onClick={() => navigate(studioTarget)} 
              className="cta-button cta-primary"
              data-magnetic="0.15"
            >
              {user ? 'Open Dashboard' : 'Start Free Trial'}
            </button>
            <Link to="/gallery" className="cta-button cta-secondary" data-magnetic="0.1">
              View Gallery
            </Link>
          </div>
        </section>

        {/* Workflow Steps */}
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-14" style={{ animation: 'fade-up 0.8s ease-out' }}>
          {WORKFLOW_STEPS.map((step, index) => (
            <div
              key={step.title}
              ref={(el) => (cardsRef.current[index] = el)}
              className="panel-glass card-3d"
              style={{ padding: '2rem', borderRadius: '16px', textAlign: 'center' }}
              data-tilt="5"
            >
              <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>{step.icon}</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--brand-teal)', fontWeight: '700', marginBottom: '0.5rem' }}>
                Step {index + 1}
              </div>
              <h3 style={{ fontSize: '1.3rem', fontWeight: '700', marginBottom: '0.75rem' }}>{step.title}</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: '1.6' }}>{step.desc}</p>
            </div>
          ))}
        </section>

        {/* Project Stats */}
        <section className="panel-glass" style={{ padding: '2rem', borderRadius: '20px', marginBottom: '3rem', animation: 'fade-up 0.85s ease-out' }}>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            <div>
              <div style={{ fontSize: '2.5rem', fontWeight: '800', color: 'var(--brand-teal)', marginBottom: '0.5rem' }}>
                {PROJECTS.length}
              </div>
              <div style={{ fontSize: '0.95rem', color: 'var(--text-muted)', fontWeight: '600' }}>Active Projects</div>
            </div>
            <div>
              <div style={{ fontSize: '2.5rem', fontWeight: '800', color: 'var(--brand-teal)', marginBottom: '0.5rem' }}>
                24
              </div>
              <div style={{ fontSize: '0.95rem', color: 'var(--text-muted)', fontWeight: '600' }}>Team Members</div>
            </div>
            <div>
              <div style={{ fontSize: '2.5rem', fontWeight: '800', color: 'var(--brand-teal)', marginBottom: '0.5rem' }}>
                89%
              </div>
              <div style={{ fontSize: '0.95rem', color: 'var(--text-muted)', fontWeight: '600' }}>Avg Progress</div>
            </div>
            <div>
              <div style={{ fontSize: '2.5rem', fontWeight: '800', color: 'var(--brand-teal)', marginBottom: '0.5rem' }}>
                12
              </div>
              <div style={{ fontSize: '0.95rem', color: 'var(--text-muted)', fontWeight: '600' }}>Completed</div>
            </div>
          </div>
        </section>

        {/* Filters & Sort */}
        <section style={{ marginBottom: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
            <h2 className="section-title" style={{ margin: 0, fontSize: '1.8rem' }}>Active Boards</h2>
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                style={{
                  background: 'rgba(8,10,26,0.8)',
                  border: '1px solid rgba(127,90,240,0.3)',
                  borderRadius: '10px',
                  padding: '0.6rem 1rem',
                  color: 'var(--text-light)',
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                  outline: 'none'
                }}
              >
                <option value="progress">Sort by Progress</option>
                <option value="team">Sort by Team Size</option>
              </select>
              <button
                onClick={() => navigate(studioTarget)}
                className="cta-button cta-primary"
                style={{ padding: '0.6rem 1.5rem', fontSize: '0.9rem' }}
              >
                + New Project
              </button>
            </div>
          </div>

          {/* Status Filters */}
          <div className="flex flex-wrap gap-3">
            {statuses.map((status) => (
              <button
                key={status}
                onClick={() => setSelectedStatus(status)}
                className="cta-button"
                style={{
                  background: selectedStatus === status ? 'linear-gradient(135deg, var(--brand-purple), var(--brand-teal))' : 'rgba(127,90,240,0.1)',
                  color: selectedStatus === status ? '#fff' : 'var(--text-muted)',
                  border: selectedStatus === status ? 'none' : '1px solid rgba(127,90,240,0.3)',
                  padding: '0.5rem 1rem',
                  fontSize: '0.85rem',
                  fontWeight: selectedStatus === status ? '700' : '500'
                }}
              >
                {status}
              </button>
            ))}
          </div>
        </section>

        {/* Projects Grid */}
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-16">
          {sortedProjects.map((project, idx) => (
            <article
              key={project.name}
              ref={(el) => (cardsRef.current[idx + 10] = el)}
              className="panel-glass card-3d showcase-card"
              style={{ borderRadius: '16px', padding: '2rem', cursor: 'pointer' }}
              data-tilt="4"
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <span style={{
                  fontSize: '0.75rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                  color: 'var(--brand-teal)',
                  fontWeight: '700',
                  padding: '0.4rem 0.8rem',
                  background: 'rgba(0,215,255,0.1)',
                  borderRadius: '6px'
                }}>
                  {project.status}
                </span>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  {project.owner}
                </span>
              </div>

              <h3 style={{ fontSize: '1.3rem', fontWeight: '700', marginBottom: '0.75rem' }}>
                {project.name}
              </h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: '1.6', marginBottom: '1.5rem' }}>
                {project.summary}
              </p>

              {/* Progress Bar */}
              <div style={{ marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.85rem' }}>
                  <span style={{ color: 'var(--text-light)', fontWeight: '600' }}>Progress</span>
                  <span style={{ color: 'var(--brand-teal)', fontWeight: '700' }}>{project.progress}%</span>
                </div>
                <div style={{ 
                  width: '100%',
                  height: '8px',
                  background: 'rgba(127,90,240,0.2)',
                  borderRadius: '10px',
                  overflow: 'hidden'
                }}>
                  <div style={{
                    width: `${project.progress}%`,
                    height: '100%',
                    background: 'linear-gradient(90deg, var(--brand-purple), var(--brand-teal))',
                    borderRadius: '10px',
                    transition: 'width 0.3s ease'
                  }} />
                </div>
              </div>

              {/* Project Meta */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '1rem', borderTop: '1px solid rgba(127,90,240,0.2)' }}>
                <div style={{ display: 'flex', gap: '1rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  <span>👥 {project.team}</span>
                  <span>⏱️ {project.deadline}</span>
                </div>
                <button
                  className="cta-button"
                  style={{
                    padding: '0.4rem 1rem',
                    fontSize: '0.8rem',
                    background: 'rgba(127,90,240,0.1)',
                    border: '1px solid rgba(127,90,240,0.3)'
                  }}
                >
                  View →
                </button>
              </div>
            </article>
          ))}
        </section>

        {/* Project Templates */}
        <section style={{ marginBottom: '4rem' }}>
          <div className="text-center" style={{ marginBottom: '3rem' }}>
            <h2 className="section-title">Start with a Template</h2>
            <p className="section-subtitle">Pre-configured setups to kickstart your next project</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {PROJECT_TEMPLATES.map((template, idx) => (
              <article
                key={template.name}
                ref={(el) => (cardsRef.current[idx + 30] = el)}
                className="panel-glass card-3d"
                style={{ padding: '2rem', borderRadius: '16px', textAlign: 'center', cursor: 'pointer' }}
                data-tilt="5"
              >
                <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>{template.icon}</div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: '700', marginBottom: '0.5rem' }}>
                  {template.name}
                </h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1rem' }}>
                  {template.desc}
                </p>
                <button
                  onClick={() => navigate(studioTarget)}
                  className="cta-button cta-secondary"
                  style={{ width: '100%', padding: '0.6rem', fontSize: '0.85rem' }}
                >
                  Use Template
                </button>
              </article>
            ))}
          </div>
        </section>

        {/* CTA Section */}
        <section className="panel-glass neon-rim" style={{ padding: '4rem 2rem', borderRadius: '24px', textAlign: 'center' }}>
          <h2 className="section-title" style={{ marginBottom: '1rem' }}>
            Ready to Streamline Your Workflow?
          </h2>
          <p className="section-subtitle" style={{ marginBottom: '2rem', maxWidth: '600px', margin: '0 auto 2rem' }}>
            Join teams using OBJEKTA to manage complex 3D projects with ease and deliver faster.
          </p>
          <div className="hero-actions" style={{ justifyContent: 'center' }}>
            <button 
              onClick={() => navigate(studioTarget)} 
              className="cta-button cta-primary"
              data-magnetic="0.18"
            >
              {user ? 'Create Project' : 'Get Started'}
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
