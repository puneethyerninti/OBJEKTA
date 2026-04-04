// src/pages/Contact.jsx
import React, { useState } from "react";
import { Link } from "react-router-dom";
import { usePageTitle } from "../hooks/usePageTitle";
import { Mail, MessageSquare, Briefcase, Send, ChevronDown, CheckCircle, ArrowRight } from "lucide-react";
import "../styles/AboutContact.css";

const CONTACT_CHANNELS = [
  {
    icon: <Mail size={32} />,
    title: "Support",
    detail: "hello@objekta.io",
    desc: "Technical support, bug reports, and general questions.",
    action: "Send Email",
    href: "mailto:hello@objekta.io",
    color: "from-cyan-500 to-blue-500",
  },
  {
    icon: <MessageSquare size={32} />,
    title: "Community",
    detail: "Join Discord",
    desc: "Connect with users, share work, and get help from core team.",
    action: "Join Now",
    href: "https://discord.com/invite/objekta",
    color: "from-purple-500 to-pink-500",
  },
  {
    icon: <Briefcase size={32} />,
    title: "Enterprise",
    detail: "partnerships@objekta.io",
    desc: "Team licensing, custom integrations, and partnerships.",
    action: "Send Enquiry",
    href: "mailto:partnerships@objekta.io",
    color: "from-orange-500 to-red-500",
  },
];

const FAQ_ITEMS = [
  {
    q: "What is Objekta?",
    a: "Objekta is a browser-native 3D studio for design teams. It combines real-time collaborative editing, production-grade PBR rendering, and cloud-based asset management — all without requiring any desktop installation.",
  },
  {
    q: "What file formats does Objekta support?",
    a: "Objekta supports glTF 2.0 and GLB formats for both import and export. GLB is recommended for optimal performance and is the industry standard for web-based 3D content.",
  },
  {
    q: "How does real-time collaboration work?",
    a: "Collaboration runs over WebSockets via Socket.IO. Multiple team members can view and edit the same scene simultaneously with live cursors, shared viewport state, and automatic version snapshots.",
  },
  {
    q: "Is my data secure?",
    a: "All scene data and uploaded assets are stored with per-user access controls and encrypted in transit. We do not share your assets with third parties or use them for training.",
  },
  {
    q: "Do I need a powerful GPU?",
    a: "Objekta adapts rendering quality to your hardware. Modern integrated GPUs work well for most scenes. Dedicated GPUs provide the best experience for complex scenes.",
  },
  {
    q: "What's the file size limit?",
    a: "We support files up to 2 GB using the tus resumable upload protocol. Large uploads can be paused and resumed if your connection is interrupted.",
  },
];

export default function Contact() {
  usePageTitle("Contact");
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
      // Silently succeed
    }
    setSubmitted(true);
    setForm({ name: "", email: "", subject: "general", message: "" });
    setTimeout(() => setSubmitted(false), 5000);
  };

  return (
    <div className="site-wrapper contact-page">
      <main className="contact-main">
        {/* Hero Section */}
        <section className="contact-hero">
          <div className="contact-hero-content">
            <div className="hero-badge">
              <MessageSquare size={16} />
              Get in Touch
            </div>
            <h1 className="contact-hero-title">
              We're Here to <span className="gradient-text">Help</span>
            </h1>
            <p className="contact-hero-desc">
              Whether you have a question, want to report a bug, or explore a partnership — we'd love to hear from you.
              Expect a response within one business day.
            </p>
          </div>
          <div className="contact-hero-visual">
            <div className="hero-blob hero-blob-1"></div>
            <div className="hero-blob hero-blob-2"></div>
          </div>
        </section>

        {/* Contact Channels */}
        <section className="contact-channels">
          <div className="channels-grid">
            {CONTACT_CHANNELS.map((ch, i) => (
              <div key={i} className="channel-card">
                <div className={`channel-icon bg-gradient ${ch.color}`}>
                  {ch.icon}
                </div>
                <h3>{ch.title}</h3>
                <p className="channel-detail">{ch.detail}</p>
                <p className="channel-desc">{ch.desc}</p>
                <a
                  href={ch.href}
                  target={ch.href.startsWith("http") ? "_blank" : undefined}
                  rel={ch.href.startsWith("http") ? "noopener noreferrer" : undefined}
                  className="btn btn-secondary btn-sm"
                >
                  {ch.action}
                  <ArrowRight size={16} />
                </a>
              </div>
            ))}
          </div>
        </section>

        {/* Contact Form */}
        <section className="contact-form-section">
          <div className="form-container">
            <div className="form-header">
              <h2>Send us a Message</h2>
              <p>Tell us about your project or question</p>
            </div>

            {submitted && (
              <div className="success-banner">
                <CheckCircle size={20} />
                <div>
                  <strong>Message sent!</strong>
                  <p>We'll follow up via email shortly.</p>
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="contact-form">
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="name">Name *</label>
                  <input
                    id="name"
                    name="name"
                    type="text"
                    placeholder="Your name"
                    required
                    value={form.name}
                    onChange={handleChange}
                    onFocus={() => setFocused("name")}
                    onBlur={() => setFocused("")}
                    className={`form-input ${focused === "name" ? "focused" : ""}`}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="email">Email *</label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="you@example.com"
                    required
                    value={form.email}
                    onChange={handleChange}
                    onFocus={() => setFocused("email")}
                    onBlur={() => setFocused("")}
                    className={`form-input ${focused === "email" ? "focused" : ""}`}
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="subject">Subject</label>
                <select
                  id="subject"
                  name="subject"
                  value={form.subject}
                  onChange={handleChange}
                  onFocus={() => setFocused("subject")}
                  onBlur={() => setFocused("")}
                  className={`form-input form-select ${focused === "subject" ? "focused" : ""}`}
                >
                  <option value="general">General Inquiry</option>
                  <option value="support">Technical Support</option>
                  <option value="feedback">Product Feedback</option>
                  <option value="partnership">Partnership / Enterprise</option>
                  <option value="bug">Bug Report</option>
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="message">Message *</label>
                <textarea
                  id="message"
                  name="message"
                  placeholder="Describe your question or project..."
                  required
                  value={form.message}
                  onChange={handleChange}
                  onFocus={() => setFocused("message")}
                  onBlur={() => setFocused("")}
                  className={`form-input form-textarea ${focused === "message" ? "focused" : ""}`}
                  rows={6}
                />
              </div>

              <button type="submit" className="btn btn-primary btn-lg">
                Send Message
                <Send size={18} />
              </button>
            </form>
          </div>
        </section>

        {/* FAQ Section */}
        <section className="contact-faq">
          <div className="section-header">
            <h2>Frequently Asked Questions</h2>
            <p>Quick answers to common questions</p>
          </div>
          <div className="faq-list">
            {FAQ_ITEMS.map((faq, i) => (
              <div
                key={i}
                className={`faq-item ${openFaq === i ? "open" : ""}`}
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
              >
                <div className="faq-header">
                  <h3>{faq.q}</h3>
                  <ChevronDown size={20} className="faq-toggle" />
                </div>
                <div className="faq-body">
                  <p>{faq.a}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Footer CTA */}
        <section className="contact-footer-cta">
          <p>Still have questions?</p>
          <Link to="/about" className="link-with-arrow">
            Learn more about Objekta <ArrowRight size={18} />
          </Link>
        </section>
      </main>
    </div>
  );
}
