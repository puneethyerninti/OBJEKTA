import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { usePageTitle } from "../hooks/usePageTitle";
import { useAuth } from "../contexts/AuthContext";
import { ArrowRight, BookOpenText, ShieldCheck, Workflow, Layers3, Users, Gauge } from "lucide-react";
import "../styles/Documentation.css";

const DOC_SECTIONS = [
  {
    title: "Platform Overview",
    icon: <BookOpenText size={20} />,
    points: [
      "Home and Gallery communicate visual direction and product capability.",
      "Dashboard centralizes projects, momentum metrics, and team activity.",
      "Studio provides browser-native 3D authoring with collaboration and versioning.",
    ],
  },
  {
    title: "Delivery Workflow",
    icon: <Workflow size={20} />,
    points: [
      "Create project scopes and assign owners in Dashboard.",
      "Build and iterate in Studio with reusable materials and scene presets.",
      "Run reviews, approve versions, and ship marketplace or client outputs.",
    ],
  },
  {
    title: "Quality Standards",
    icon: <Gauge size={20} />,
    points: [
      "Consistent naming conventions for projects, scenes, and exported assets.",
      "Version checkpoints before major edits, lighting changes, and material passes.",
      "Document approvals and final publish state for each deliverable.",
    ],
  },
  {
    title: "Security and Access",
    icon: <ShieldCheck size={20} />,
    points: [
      "JWT-based authentication with secure session management.",
      "Role-based controls for contributors, reviewers, and administrators.",
      "Protected project collaboration with scoped sharing practices.",
    ],
  },
];

const START_GUIDE = [
  {
    step: "01",
    title: "Create Account and Workspace",
    desc: "Sign in, create your first workspace, and define project naming rules before asset import.",
  },
  {
    step: "02",
    title: "Import Models and Configure Scene",
    desc: "Upload GLB assets, validate materials and lighting, and save a clean baseline version.",
  },
  {
    step: "03",
    title: "Collaborate and Review",
    desc: "Invite collaborators, collect feedback in real-time, and lock review checkpoints.",
  },
  {
    step: "04",
    title: "Export and Publish",
    desc: "Export validated assets for production pipelines or publish approved outputs to marketplace.",
  },
];

export default function Documentation() {
  usePageTitle("Documentation");
  const navigate = useNavigate();
  const { user } = useAuth();

  return (
    <div className="site-wrapper documentation-page">
      <main className="documentation-main">
        <section className="documentation-hero">
          <div className="documentation-hero-badge">
            <Layers3 size={16} />
            Product Documentation
          </div>
          <h1>
            Objekta <span>Documentation Center</span>
          </h1>
          <p>
            Professional operating guidance for teams building, reviewing, and delivering interactive 3D projects in Objekta.
            Use this page as the in-product source of truth for workflow, quality, and release standards.
          </p>
          <div className="documentation-hero-actions">
            <button
              type="button"
              className="doc-btn doc-btn-primary"
              onClick={() => navigate(user ? "/dashboard" : "/login")}
            >
              {user ? "Open Dashboard" : "Start with Objekta"}
              <ArrowRight size={18} />
            </button>
            <a
              href="https://github.com/puneethyerninti/OBJEKTA#readme"
              target="_blank"
              rel="noopener noreferrer"
              className="doc-btn doc-btn-ghost"
            >
              Full README
            </a>
          </div>
        </section>

        <section className="documentation-start-guide" aria-label="Quick start guide">
          <header>
            <h2>Implementation Sequence</h2>
            <p>Follow this sequence to keep teams aligned and reduce rework.</p>
          </header>
          <div className="doc-step-grid">
            {START_GUIDE.map((item) => (
              <article key={item.step} className="doc-step-card">
                <span className="doc-step-index">{item.step}</span>
                <h3>{item.title}</h3>
                <p>{item.desc}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="documentation-sections" aria-label="Documentation sections">
          <header>
            <h2>Operational Standards</h2>
            <p>Core principles to ensure continuity from first concept to final delivery.</p>
          </header>
          <div className="doc-section-grid">
            {DOC_SECTIONS.map((section) => (
              <article key={section.title} className="doc-section-card">
                <div className="doc-section-head">
                  <span className="doc-section-icon">{section.icon}</span>
                  <h3>{section.title}</h3>
                </div>
                <ul>
                  {section.points.map((point) => (
                    <li key={point}>{point}</li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </section>

        <section className="documentation-callout">
          <div className="documentation-callout-copy">
            <h2>Need workflow support for your team?</h2>
            <p>
              For implementation guidance, onboarding playbooks, or enterprise collaboration setup,
              contact the Objekta team with your production goals.
            </p>
          </div>
          <div className="documentation-callout-actions">
            <Link to="/contact" className="doc-btn doc-btn-primary">
              Contact Product Team
              <Users size={18} />
            </Link>
            <Link to="/projects" className="doc-btn doc-btn-ghost">
              Explore Project Templates
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
