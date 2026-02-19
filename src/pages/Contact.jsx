// src/pages/Contact.jsx
import React, { useState } from "react";
import { Link } from "react-router-dom";

const FAQ_ITEMS = [
  {
    q: "What is Objekta?",
    a: "Objekta is a web-based 3D studio that enables real-time collaboration, studio-grade rendering, and asset management directly in your browser â€” no installation required.",
  },
  {
    q: "What file formats are supported?",
    a: "We support GLB and GLTF for import. GLB is the recommended format for best compatibility with the renderer and asset pipeline.",
  },
  {
    q: "Can I collaborate with my team?",
    a: "Yes. Objekta supports real-time multiplayer editing, live cursors, shared scene state, and version snapshots for distributed teams.",
  },
  {
    q: "Is my scene data stored securely?",
    a: "Scene files and uploads are stored on our backend with per-user access controls. We do not share your assets with third parties.",
  },
];

const CONTACT_METHODS = [
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" width="28" height="28">
        <path d="M4 4H20C21.1 4 22 4.9 22 6V18C22 19.1 21.1 20 20 20H4C2.9 20 2 19.1 2 18V6C2 4.9 2.9 4 4 4Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <polyline points="22,6 12,13 2,6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    title: "Email Support",
    desc: "Reach out for help, feedback, or bug reports.",
    detail: "hello@objekta.studio",
    action: "Send Email",
    href: "mailto:hello@objekta.studio",
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" width="28" height="28">
        <path d="M21 15C21 15.5304 20.7893 16.0391 20.4142 16.4142C20.0391 16.7893 19.5304 17 19 17H7L3 21V5C3 4.46957 3.21071 3.96086 3.58579 3.58579C3.96086 3.21071 4.46957 3 5 3H19C19.5304 3 20.0391 3.21071 20.4142 3.58579C20.7893 3.96086 21 4.46957 21 5V15Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    title: "Community Discord",
    desc: "Connect with other Objekta users and the core team.",
    detail: "Join the server â†’",
    action: "Open Discord",
    href: "#",
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" width="28" height="28">
        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
        <path d="M12 8V12L15 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
    title: "Response Time",
    desc: "Email queries are typically answered within one business day.",
    detail: "Mon â€“ Fri",
    action: null,
    href: null,
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" width="28" height="28">
        <path d="M9 19C6.79 20.34 4.05 21 2 21V3C4.24 3 6.95 2.59 9 1C11.05 2.59 13.76 3 16 3V11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M16 22L18.5 17L21 22M17.25 20H19.75" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    title: "Enterprise & Partnerships",
    desc: "Team licensing, custom integrations, and partnership enquiries.",
    detail: "partnerships@objekta.studio",
    action: "Send Enquiry",
    href: "mailto:partnerships@objekta.studio",
  },
];

const SOCIAL_LINKS = [
  { name: "Twitter / X", url: "#" },
  { name: "LinkedIn",    url: "#" },
  { name: "GitHub",      url: "#" },
  { name: "YouTube",     url: "#" },
];

export default function Contact() {
  const [formData, setFormData] = useState({ name: "", email: "", company: "", message: "", subject: "general" });
  const [focused, setFocused] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [activeTab, setActiveTab] = useState("contact");

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleSubmit = (e) => {
    e.preventDefault();
    // In production this would POST to an API endpoint.
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 4000);
  };

  const inputStyle = (field) => ({
    background: "rgba(8,10,26,0.6)",
    border: focused === field ? "2px solid var(--brand-teal)" : "1px solid rgba(127,90,240,0.2)",
    boxShadow: focused === field ? "0 0 20px rgba(0,215,255,0.15)" : "none",
    outline: "none",
  });

  return (
    <div className="site-wrapper">
      <main className="home-shell" style={{ maxWidth: "1100px" }}>
        {/* Hero */}
        <section className="text-center" style={{ animation: "fade-up 0.7s ease-out" }}>
          <span className="hero-badge-top">Get in Touch</span>
          <h1 className="hero-title" style={{ marginTop: "1.5rem", marginBottom: "1.5rem" }}>
            Let's Build
            <span className="title-gradient"> Together</span>
          </h1>
          <p className="hero-subtitle" style={{ maxWidth: "680px", margin: "0 auto" }}>
            Questions, feedback, or collaboration ideas â€” we're reachable by email and Discord.
          </p>
        </section>

        {/* Tabs */}
        <section className="flex justify-center gap-4" style={{ animation: "fade-up 0.75s ease-out" }}>
          {["contact", "faq"].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className="cta-button"
              aria-pressed={activeTab === tab}
              style={{
                background: activeTab === tab ? "linear-gradient(135deg, var(--brand-purple), var(--brand-teal))" : "rgba(127,90,240,0.1)",
                color: activeTab === tab ? "#fff" : "var(--text-muted)",
                border: activeTab === tab ? "none" : "1px solid rgba(127,90,240,0.3)",
                textTransform: "capitalize",
                padding: "0.75rem 2rem",
                fontSize: "0.95rem",
              }}
            >
              {tab === "faq" ? "FAQ" : "Contact Us"}
            </button>
          ))}
        </section>

        {activeTab === "contact" && (
          <>
            {/* Contact Method Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6" style={{ animation: "fade-up 0.8s ease-out" }}>
              {CONTACT_METHODS.map((method) => (
                <article
                  key={method.title}
                  className="panel-glass card-3d"
                  style={{ padding: "2rem", textAlign: "center", borderRadius: "16px" }}
                  data-tilt="4"
                >
                  <div style={{ color: "var(--brand-teal)", marginBottom: "1rem", display: "flex", justifyContent: "center" }}>
                    {method.icon}
                  </div>
                  <h3 style={{ fontSize: "1.05rem", fontWeight: "700", marginBottom: "0.5rem", color: "var(--brand-teal)" }}>
                    {method.title}
                  </h3>
                  <p style={{ fontSize: "0.88rem", color: "var(--text-muted)", marginBottom: "0.5rem", lineHeight: "1.5" }}>
                    {method.desc}
                  </p>
                  <p style={{ fontSize: "0.85rem", color: "var(--text-light)", marginBottom: method.action ? "1rem" : 0, fontWeight: "600" }}>
                    {method.detail}
                  </p>
                  {method.action && (
                    method.href && method.href !== "#" ? (
                      <a href={method.href} className="cta-button cta-secondary" style={{ display: "block", padding: "0.6rem", fontSize: "0.85rem", textDecoration: "none" }}>
                        {method.action}
                      </a>
                    ) : (
                      <button className="cta-button cta-secondary" style={{ width: "100%", padding: "0.6rem", fontSize: "0.85rem" }}>
                        {method.action}
                      </button>
                    )
                  )}
                </article>
              ))}
            </div>

            {/* Contact Form */}
            <section
              className="panel-glass neon-rim"
              style={{ padding: "3rem", borderRadius: "24px", animation: "fade-up 0.9s ease-out" }}
            >
              <h2 className="section-title" style={{ textAlign: "center", marginBottom: "0.75rem", fontSize: "1.8rem" }}>
                Send Us a Message
              </h2>
              <p className="section-subtitle" style={{ textAlign: "center", marginBottom: "2rem" }}>
                Fill out the form and we'll follow up by email.
              </p>

              {submitted && (
                <div
                  style={{
                    background: "linear-gradient(135deg, rgba(0,215,255,0.15), rgba(127,90,240,0.15))",
                    border: "1px solid var(--brand-teal)",
                    borderRadius: "12px",
                    padding: "1rem",
                    marginBottom: "2rem",
                    textAlign: "center",
                    color: "var(--brand-teal)",
                    fontWeight: "600",
                  }}
                >
                  âœ“ Message sent â€” we'll be in touch soon.
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {[
                    { id: "name",    label: "Name *",    type: "text",  placeholder: "Your name",        required: true },
                    { id: "email",   label: "Email *",   type: "email", placeholder: "you@example.com",  required: true },
                    { id: "company", label: "Company",   type: "text",  placeholder: "Studio or company", required: false },
                  ].map((f) => (
                    <div key={f.id} className={f.id === "company" ? "md:col-span-1" : ""}>
                      <label className="block mb-2" htmlFor={f.id} style={{ color: "var(--text-light)", fontWeight: "600", fontSize: "0.95rem" }}>
                        {f.label}
                      </label>
                      <input
                        id={f.id}
                        name={f.id}
                        type={f.type}
                        placeholder={f.placeholder}
                        value={formData[f.id]}
                        onChange={handleChange}
                        onFocus={() => setFocused(f.id)}
                        onBlur={() => setFocused("")}
                        required={f.required}
                        className="w-full p-3 rounded-lg text-white transition-all duration-200"
                        style={inputStyle(f.id)}
                      />
                    </div>
                  ))}

                  <div>
                    <label className="block mb-2" htmlFor="subject" style={{ color: "var(--text-light)", fontWeight: "600", fontSize: "0.95rem" }}>
                      Subject
                    </label>
                    <select
                      id="subject"
                      name="subject"
                      value={formData.subject}
                      onChange={handleChange}
                      onFocus={() => setFocused("subject")}
                      onBlur={() => setFocused("")}
                      className="w-full p-3 rounded-lg text-white transition-all duration-200"
                      style={{ ...inputStyle("subject"), cursor: "pointer" }}
                    >
                      <option value="general">General Inquiry</option>
                      <option value="support">Technical Support</option>
                      <option value="feedback">Feedback</option>
                      <option value="partnership">Partnership</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block mb-2" htmlFor="message" style={{ color: "var(--text-light)", fontWeight: "600", fontSize: "0.95rem" }}>
                    Message *
                  </label>
                  <textarea
                    id="message"
                    name="message"
                    placeholder="Tell us about your project or question..."
                    rows={6}
                    value={formData.message}
                    onChange={handleChange}
                    onFocus={() => setFocused("message")}
                    onBlur={() => setFocused("")}
                    required
                    className="w-full p-3 rounded-lg text-white transition-all duration-200"
                    style={{ ...inputStyle("message"), resize: "vertical", minHeight: "120px" }}
                  />
                </div>

                <button
                  type="submit"
                  className="cta-button cta-primary"
                  data-magnetic="0.15"
                  style={{ width: "100%", padding: "1rem", fontSize: "1.05rem", fontWeight: "700" }}
                >
                  Send Message
                </button>
              </form>
            </section>

            {/* Social Links */}
            <section className="text-center">
              <h3 style={{ fontSize: "1.1rem", fontWeight: "600", marginBottom: "1.5rem", color: "var(--text-light)" }}>
                Follow the Project
              </h3>
              <div style={{ display: "flex", justifyContent: "center", gap: "1rem", flexWrap: "wrap" }}>
                {SOCIAL_LINKS.map((s) => (
                  <a
                    key={s.name}
                    href={s.url}
                    className="panel-glass"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      padding: "0.7rem 1.4rem",
                      borderRadius: "12px",
                      textDecoration: "none",
                      color: "var(--text-light)",
                      fontSize: "0.9rem",
                      fontWeight: "600",
                      transition: "transform 0.2s, box-shadow 0.2s",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = "translateY(-2px)";
                      e.currentTarget.style.boxShadow = "0 8px 24px rgba(0,215,255,0.2)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = "translateY(0)";
                      e.currentTarget.style.boxShadow = "none";
                    }}
                  >
                    {s.name}
                  </a>
                ))}
              </div>
            </section>
          </>
        )}

        {activeTab === "faq" && (
          <section style={{ animation: "fade-up 0.8s ease-out" }}>
            <div className="text-center" style={{ marginBottom: "3rem" }}>
              <h2 className="section-title">Frequently Asked Questions</h2>
              <p className="section-subtitle">Quick answers to common questions</p>
            </div>
            <div className="space-y-4" style={{ maxWidth: "800px", margin: "0 auto" }}>
              {FAQ_ITEMS.map((faq) => (
                <article key={faq.q} className="panel-glass" style={{ padding: "2rem", borderRadius: "16px" }}>
                  <h3 style={{ fontSize: "1.1rem", fontWeight: "700", marginBottom: "0.75rem", color: "var(--brand-teal)" }}>
                    {faq.q}
                  </h3>
                  <p style={{ color: "var(--text-muted)", lineHeight: "1.7", fontSize: "0.95rem", margin: 0 }}>
                    {faq.a}
                  </p>
                </article>
              ))}
            </div>
            <div className="text-center" style={{ marginTop: "3rem" }}>
              <p style={{ color: "var(--text-muted)", marginBottom: "1rem" }}>Still have questions?</p>
              <button onClick={() => setActiveTab("contact")} className="cta-button cta-primary" data-magnetic="0.15">
                Contact Us
              </button>
            </div>
          </section>
        )}

        {/* Footer note */}
        <section className="panel-glass" style={{ padding: "1.75rem 2rem", borderRadius: "16px", textAlign: "center" }}>
          <p style={{ color: "var(--text-muted)", fontSize: "0.9rem", margin: 0 }}>
            Email support is available Monâ€“Fri. &nbsp;
            <Link to="/about" style={{ color: "var(--brand-teal)", textDecoration: "none" }}>
              Learn more about the platform â†’
            </Link>
          </p>
        </section>
      </main>
    </div>
  );
}
