import React, { useCallback, useEffect, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { FiAlertTriangle, FiCheckCircle, FiClock, FiExternalLink, FiShield } from "react-icons/fi";
import Workspace from "../components/Workspace";
import { apiUrl } from "../utils/api";
import { usePageTitle } from "../hooks/usePageTitle";
import "../styles/ReviewViewer.css";

const STATUS_LABELS = {
  draft: "Draft",
  in_review: "In review",
  changes_requested: "Changes requested",
  approved: "Approved",
  published: "Published",
};

function formatDate(value) {
  if (!value) return "Not saved yet";
  try {
    return new Date(value).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "Not saved yet";
  }
}

function ReviewScene({ data }) {
  const workspaceRef = useRef(null);

  const loadScene = useCallback(() => {
    if (!data) return false;
    const api = workspaceRef.current;
    if (!api?.loadFromData) return false;
    api.loadFromData(data);
    setTimeout(() => api.frameAll?.(), 120);
    return true;
  }, [data]);

  useEffect(() => {
    let attempts = 0;
    const timer = window.setInterval(() => {
      attempts += 1;
      if (loadScene() || attempts > 40) window.clearInterval(timer);
    }, 100);
    return () => window.clearInterval(timer);
  }, [loadScene]);

  return (
    <DndProvider backend={HTML5Backend}>
      <Workspace ref={workspaceRef} showInternalPanels={false} panelTopOffset={0} />
    </DndProvider>
  );
}

export default function ReviewViewer() {
  const { token } = useParams();
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  usePageTitle(project?.title ? `${project.title} Review` : "Review");

  useEffect(() => {
    let cancelled = false;
    const fetchReview = async () => {
      setLoading(true);
      setError("");
      try {
        const res = await fetch(apiUrl(`/api/projects/review/${encodeURIComponent(token || "")}`), {
          cache: "no-store",
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.message || "Review link unavailable");
        if (!cancelled) setProject(data.project || null);
      } catch (err) {
        if (!cancelled) setError(err.message || "Review link unavailable");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchReview();
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (loading) {
    return (
      <main className="review-page review-page--center">
        <div className="review-loader" role="status">
          <FiClock />
          <span>Opening secure review...</span>
        </div>
      </main>
    );
  }

  if (error || !project) {
    return (
      <main className="review-page review-page--center">
        <section className="review-error">
          <FiAlertTriangle />
          <h1>Review link unavailable</h1>
          <p>{error || "This review link may have expired or been revoked."}</p>
          <Link to="/" className="review-link-btn">Go to OBJEKTA</Link>
        </section>
      </main>
    );
  }

  const status = project.reviewStatus || "in_review";

  return (
    <main className="review-page">
      <header className="review-header">
        <div>
          <div className="review-kicker">
            <FiShield />
            Secure 3D Review
          </div>
          <h1>{project.title || "Untitled Project"}</h1>
          {project.description && <p>{project.description}</p>}
        </div>
        <div className="review-header__meta">
          <span className={`review-status review-status--${status}`}>
            {status === "approved" ? <FiCheckCircle /> : <FiClock />}
            {STATUS_LABELS[status] || "In review"}
          </span>
          <span>Last saved {formatDate(project.lastSavedAt || project.updatedAt)}</span>
        </div>
      </header>

      <section className="review-workspace" aria-label="3D review viewport">
        <ReviewScene data={project.data} />
      </section>

      <aside className="review-sidepanel" aria-label="Review details">
        <div className="review-sidepanel__section">
          <h2>Review State</h2>
          <p>This link is read-only. Reviewers can inspect the latest shared scene without access to the owner workspace.</p>
        </div>
        <div className="review-sidepanel__grid">
          <div>
            <span>Status</span>
            <strong>{STATUS_LABELS[status] || "In review"}</strong>
          </div>
          <div>
            <span>Visibility</span>
            <strong>{project.visibility || "review"}</strong>
          </div>
          <div>
            <span>Approved version</span>
            <strong>{project.approvedVersion ? `v${project.approvedVersion}` : "None"}</strong>
          </div>
          <div>
            <span>Published</span>
            <strong>{project.publishedAt ? formatDate(project.publishedAt) : "No"}</strong>
          </div>
        </div>
        <a className="review-powered" href="/" target="_blank" rel="noreferrer">
          <FiExternalLink />
          Powered by OBJEKTA
        </a>
      </aside>
    </main>
  );
}
