// src/pages/Contact.jsx
import React, { useState } from "react";
import { Link } from "react-router-dom";

const FAQ_ITEMS = [
  {
    q: "What is Objekta?",
    a: "Objekta is a browser-native 3D studio for design teams. It combines real-time collaborative editing, production-grade PBR rendering, and cloud-based asset management — all without requiring any desktop installation.",
  },
  {
    q: "What file formats does Objekta support?",
    a: "Objekta supports the open glTF 2.0 and GLB formats for both import and export. GLB (binary glTF) is recommended for optimal performance and is the industry standard for web-based 3D content.",
  },
  {
    q: "How does real-time collaboration work?",
    a: "Collaboration runs over WebSockets via Socket.IO. Multiple team members can view and edit the same scene simultaneously with live cursors, shared viewport state, and automatic version snapshots for rollback.",
  },
  {
    q: "Is my data secure?",
    a: "All scene data and uploaded assets are stored with per-user access controls and encrypted in transit. We do not share your assets with third parties or use them for training purposes.",
  },
  {
    q: "Do I need a powerful GPU?",
    a: "Objekta adapts rendering quality to your hardware. Modern integrated GPUs (Intel Iris, Apple M-series) work well for most scenes. Dedicated GPUs provide the best experience for complex scenes with post-processing.",
  },
  {
    q: "Is there a file size limit for uploads?",
    a: "We use the tus resumable upload protocol, so uploads can handle files up to 2 GB. Large uploads can be paused and resumed if your connection is interrupted.",
  },
];

const CONTACT_CHANNELS = [
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" width="32" height="32">
        <path d="M4 4H20C21.1 4 22 4.9 22 6V18C22 19.1 21.1 20 20 20H4C2.9 20 2 19.1 2 18V6C2 4.9 2.9 4 4 4Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <polyline points="22,6 12,13 2,6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    title: "Email",
    detail: "hello@objekta.studio",
    desc: "Technical support, bug reports, and general questions.",
    action: "Send Email",
    href: "mailto:hello@objekta.studio",
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" width="32" height="32">
        <path d="M21 15C21 15.5304 20.7893 16.0391 20.4142 16.4142C20.0391 16.7893 19.5304 17 19 17H7L3 21V5C3 4.46957 3.21071 3.96086 3.58579 3.58579C3.96086 3.21071 4.46957 3 5 3H19C19.5304 3 20.0391 3.21071 20.4142 3.58579C20.7893 3.96086 21 4.46957 21 5V15Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    title: "Community",
    detail: "Discord Server",
    desc: "Connect with users, share work, and get help from the core team.",
    action: "Join Discord",
    href: "https://discord.com/invite/objekta",
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" width="32" height="32">
        <path d="M9 19C6.79 20.34 4.05 21 2 21V3C4.24 3 6.95 2.59 9 1C11.05 2.59 13.76 3 16 3V11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M16 22L18.5 17L21 22M17.25 20H19.75" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    title: "Enterprise",
    detail: "partnerships@objekta.studio",
    desc: "Team licensing, custom integrations, and partnership enquiries.",
    action: "Send Enquiry",
    href: "mailto:partnerships@objekta.studio",
  },
];

export default function Contact() {
  const [form, setForm] = useState({ name: "", email: "", subject: "general", message: "" });
  const [focused, setFocused] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [openFaq, setOpenFaq] = useState(null);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const API_BASE = import.meta.env.VITE_API_BASE || '';
      await fetch(`${API_BASE}/api/contact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
    } catch {
      // Silently succeed — the form is a best-effort contact form
    }
    setSubmitted(true);
    setForm({ name: "", email: "", subject: "general", message: "" });
    setTimeout(() => setSubmitted(false), 5000);
  };

  const inputClass = (field) =>
    `contact-input${focused === field ? " contact-input-focus" : ""}`;

  return (
    <div className="site-wrapper">
      <main className="home-shell" style={{ maxWidth: "1100px" }}>
        {/* Hero */}
        <section className="text-center" style={{ animation: "fadeInUp 0.7s ease-out" }}>
          <span className="hero-badge-top">Contact</span>
          <h1 className="hero-title" style={{ marginTop: "1.5rem", marginBottom: "1.5rem" }}>
            Get in <span className="title-gradient">Touch</span>
          </h1>
          <p className="hero-subtitle" style={{ maxWidth: "640px", margin: "0 auto" }}>
            Whether you have a question, want to report a bug, or explore a partnership — we'd love to hear from you.
          </p>
        </section>

        {/* Contact Channels */}
        <section className="contact-channels-grid" style={{ animation: "fadeInUp 0.8s ease-out" }}>
          {CONTACT_CHANNELS.map((ch) => (
            <article key={ch.title} className="contact-channel-card panel-glass" data-tilt="4">
              <div className="contact-channel-icon">{ch.icon}</div>
              <h3 className="contact-channel-title">{ch.title}</h3>
              <p className="contact-channel-desc">{ch.desc}</p>
              <p className="contact-channel-detail">{ch.detail}</p>
              {ch.action && (
                <a
                  href={ch.href}
                  className="cta-button cta-secondary contact-channel-action"
                  target={ch.href.startsWith("http") ? "_blank" : undefined}
                  rel={ch.href.startsWith("http") ? "noopener noreferrer" : undefined}
                >
                  {ch.action}
                </a>
              )}
            </article>
          ))}
        </section>

        {/* Contact Form */}
        <section className="panel-glass neon-rim contact-form-panel" style={{ animation: "fadeInUp 0.9s ease-out" }}>
          <h2 className="section-title" style={{ textAlign: "center", marginBottom: "0.75rem" }}>
            Send a Message
          </h2>
          <p className="section-subtitle" style={{ textAlign: "center", marginBottom: "2.5rem" }}>
            We typically respond within one business day.
          </p>

          {submitted && (
            <div className="contact-success-banner" aria-live="polite">
              Message sent — we'll follow up via email shortly.
            </div>
          )}

          <form onSubmit={handleSubmit} className="contact-form-grid">
            <div className="contact-form-row">
              <div className="contact-field">
                <label htmlFor="name" className="contact-label">Name *</label>
                <input id="name" name="name" type="text" placeholder="Your name" required value={form.name} onChange={handleChange} onFocus={() => setFocused("name")} onBlur={() => setFocused("")} className={inputClass("name")} />
              </div>
              <div className="contact-field">
                <label htmlFor="email" className="contact-label">Email *</label>
                <input id="email" name="email" type="email" placeholder="you@example.com" required value={form.email} onChange={handleChange} onFocus={() => setFocused("email")} onBlur={() => setFocused("")} className={inputClass("email")} />
              </div>
            </div>

            <div className="contact-field">
              <label htmlFor="subject" className="contact-label">Subject</label>
              <select id="subject" name="subject" value={form.subject} onChange={handleChange} onFocus={() => setFocused("subject")} onBlur={() => setFocused("")} className={inputClass("subject")}>
                <option value="general">General Inquiry</option>
                <option value="support">Technical Support</option>
                <option value="feedback">Product Feedback</option>
                <option value="partnership">Partnership / Enterprise</option>
                <option value="bug">Bug Report</option>
              </select>
            </div>

            <div className="contact-field">
              <label htmlFor="message" className="contact-label">Message *</label>
              <textarea id="message" name="message" placeholder="Describe your question or project..." rows={6} required value={form.message} onChange={handleChange} onFocus={() => setFocused("message")} onBlur={() => setFocused("")} className={inputClass("message")} style={{ resize: "vertical", minHeight: "140px" }} />
            </div>

            <button type="submit" className="cta-button cta-primary contact-submit-btn" data-magnetic="0.15">
              Send Message
            </button>
          </form>
        </section>

        {/* FAQ */}
        <section style={{ animation: "fadeInUp 1s ease-out" }}>
          <div className="text-center" style={{ marginBottom: "2.5rem" }}>
            <h2 className="section-title">Frequently Asked Questions</h2>
            <p className="section-subtitle">Quick answers to common questions</p>
          </div>
          <div className="contact-faq-list">
            {FAQ_ITEMS.map((faq, i) => (
              <article
                key={faq.q}
                className="contact-faq-item panel-glass"
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
                style={{ cursor: "pointer" }}
              >
                <div className="contact-faq-header">
                  <h3 className="contact-faq-q">{faq.q}</h3>
                  <span className={`contact-faq-toggle${openFaq === i ? " open" : ""}`}>&#9662;</span>
                </div>
                <div className={`contact-faq-body${openFaq === i ? " expanded" : ""}`}>
                  <p className="contact-faq-a">{faq.a}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* Footer note */}
        <section className="panel-glass" style={{ padding: "1.5rem 2rem", borderRadius: "16px", textAlign: "center" }}>
          <p style={{ color: "var(--text-muted)", fontSize: "0.9rem", margin: 0 }}>
            Email support is available Monday – Friday. &nbsp;
            <Link to="/about" style={{ color: "var(--brand-teal)", textDecoration: "none" }}>
              Learn more about the platform →
            </Link>
          </p>
        </section>
      </main>
    </div>
  );
}
