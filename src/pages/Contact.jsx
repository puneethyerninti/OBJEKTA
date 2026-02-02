// src/pages/Contact.jsx
import React, { useState } from "react";
import { Link } from "react-router-dom";

const FAQ_ITEMS = [
  {
    q: "What is OBJEKTA?",
    a: "OBJEKTA is a web-based 3D design platform that enables real-time collaboration, studio-grade rendering, and seamless asset pipelines directly in your browser."
  },
  {
    q: "Is there a free trial?",
    a: "Yes! We offer a 14-day free trial with full access to all features. No credit card required."
  },
  {
    q: "What file formats do you support?",
    a: "We support GLB, GLTF, FBX, OBJ, USDZ, and more. Export options include GLB, USDZ, and FBX for production use."
  },
  {
    q: "Can I collaborate with my team?",
    a: "Absolutely! OBJEKTA is built for teams with real-time multiplayer editing, live cursors, comments, and version control."
  },
];

const CONTACT_METHODS = [
  {
    icon: "💬",
    title: "Live Chat",
    desc: "Real-time support",
    detail: "Available Mon-Fri, 9AM-6PM EST",
    action: "Start Chat",
  },
  {
    icon: "📧",
    title: "Email Support",
    desc: "Get help via email",
    detail: "hello@objekta.studio",
    action: "Send Email",
  },
  {
    icon: "🌐",
    title: "Community",
    desc: "Join our Discord",
    detail: "5,000+ members online",
    action: "Join Discord",
  },
  {
    icon: "📞",
    title: "Sales Team",
    desc: "Enterprise inquiries",
    detail: "+1 (555) 123-4567",
    action: "Call Now",
  },
];

const SOCIAL_LINKS = [
  { name: "Twitter", icon: "🐦", url: "#" },
  { name: "LinkedIn", icon: "💼", url: "#" },
  { name: "Instagram", icon: "📸", url: "#" },
  { name: "YouTube", icon: "📺", url: "#" },
];

export default function Contact() {
  const [formData, setFormData] = useState({ name: '', email: '', company: '', message: '', subject: 'general' });
  const [focused, setFocused] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [activeTab, setActiveTab] = useState('contact');

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    console.log('Form submitted:', formData);
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 3000);
  };

  return (
    <div className="site-wrapper">
      {/* Background effects */}
      <div className="grid-glow" aria-hidden="true" />
      <div className="scanline-overlay" aria-hidden="true" />

      <main className="home-shell" style={{ maxWidth: '1100px' }}>
        <section className="text-center mb-12" style={{ animation: 'fade-up 0.7s ease-out' }}>
          <span className="hero-badge-top" style={{ display: 'inline-block', marginBottom: '1.5rem' }}>
            Get in Touch
          </span>
          <h1 className="hero-title" style={{ marginBottom: '1.5rem' }}>
            Let's Build
            <span className="title-gradient"> Together</span>
          </h1>
          <p className="hero-subtitle" style={{ maxWidth: '720px', margin: '0 auto 2rem' }}>
            Have questions, feedback, or collaboration ideas? Our team is here 24/7 to help you bring your 3D vision to life.
          </p>
        </section>

        {/* Tabs */}
        <section className="flex justify-center gap-4 mb-12" style={{ animation: 'fade-up 0.75s ease-out' }}>
          {['contact', 'faq'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className="cta-button"
              style={{
                background: activeTab === tab ? 'linear-gradient(135deg, var(--brand-purple), var(--brand-teal))' : 'rgba(127,90,240,0.1)',
                color: activeTab === tab ? '#fff' : 'var(--text-muted)',
                border: activeTab === tab ? 'none' : '1px solid rgba(127,90,240,0.3)',
                textTransform: 'capitalize',
                padding: '0.75rem 2rem',
                fontSize: '0.95rem'
              }}
            >
              {tab === 'faq' ? 'FAQ' : 'Contact Us'}
            </button>
          ))}
        </section>

        {activeTab === 'contact' && (
          <>
            {/* Contact Methods Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12" style={{ animation: 'fade-up 0.8s ease-out' }}>
              {CONTACT_METHODS.map((method) => (
                <article key={method.title} className="panel-glass card-3d" style={{ padding: '2rem', textAlign: 'center', borderRadius: '16px', cursor: 'pointer' }} data-tilt="4">
                  <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>{method.icon}</div>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: '700', marginBottom: '0.5rem', color: 'var(--brand-teal)' }}>
                    {method.title}
                  </h3>
                  <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>{method.desc}</p>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-light)', marginBottom: '1rem', fontWeight: '600' }}>
                    {method.detail}
                  </p>
                  <button
                    className="cta-button cta-secondary"
                    style={{ width: '100%', padding: '0.6rem', fontSize: '0.85rem' }}
                  >
                    {method.action}
                  </button>
                </article>
              ))}
            </div>

            {/* Contact Form */}
            <section className="panel-glass neon-rim" style={{ padding: '3rem', borderRadius: '24px', animation: 'fade-up 0.9s ease-out', marginBottom: '3rem' }}>
              <h2 className="section-title" style={{ textAlign: 'center', marginBottom: '1rem', fontSize: '1.8rem' }}>
                Send Us a Message
              </h2>
              <p className="section-subtitle" style={{ textAlign: 'center', marginBottom: '2rem' }}>
                Fill out the form below and we'll get back to you within 24 hours.
              </p>

              {submitted && (
                <div style={{
                  background: 'linear-gradient(135deg, rgba(0,215,255,0.2), rgba(127,90,240,0.2))',
                  border: '1px solid var(--brand-teal)',
                  borderRadius: '12px',
                  padding: '1rem',
                  marginBottom: '2rem',
                  textAlign: 'center',
                  color: 'var(--brand-teal)',
                  fontWeight: '600'
                }}>
                  ✓ Message sent successfully! We'll be in touch soon.
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label
                      className="block mb-2"
                      htmlFor="name"
                      style={{ color: 'var(--text-light)', fontWeight: '600', fontSize: '0.95rem' }}
                    >
                      Name *
                    </label>
                    <input
                      id="name"
                      name="name"
                      type="text"
                      placeholder="John Doe"
                      value={formData.name}
                      onChange={handleChange}
                      onFocus={() => setFocused('name')}
                      onBlur={() => setFocused('')}
                      required
                      className="w-full p-3 rounded-lg text-white transition-all duration-200"
                      style={{
                        background: 'rgba(8,10,26,0.6)',
                        border: focused === 'name' ? '2px solid var(--brand-teal)' : '1px solid rgba(127,90,240,0.2)',
                        boxShadow: focused === 'name' ? '0 0 20px rgba(0,215,255,0.15)' : 'none',
                        outline: 'none'
                      }}
                    />
                  </div>

                  <div>
                    <label
                      className="block mb-2"
                      htmlFor="email"
                      style={{ color: 'var(--text-light)', fontWeight: '600', fontSize: '0.95rem' }}
                    >
                      Email *
                    </label>
                    <input
                      id="email"
                      name="email"
                      type="email"
                      placeholder="john@example.com"
                      value={formData.email}
                      onChange={handleChange}
                      onFocus={() => setFocused('email')}
                      onBlur={() => setFocused('')}
                      required
                      className="w-full p-3 rounded-lg text-white transition-all duration-200"
                      style={{
                        background: 'rgba(8,10,26,0.6)',
                        border: focused === 'email' ? '2px solid var(--brand-teal)' : '1px solid rgba(127,90,240,0.2)',
                        boxShadow: focused === 'email' ? '0 0 20px rgba(0,215,255,0.15)' : 'none',
                        outline: 'none'
                      }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label
                      className="block mb-2"
                      htmlFor="company"
                      style={{ color: 'var(--text-light)', fontWeight: '600', fontSize: '0.95rem' }}
                    >
                      Company
                    </label>
                    <input
                      id="company"
                      name="company"
                      type="text"
                      placeholder="Acme Studios"
                      value={formData.company}
                      onChange={handleChange}
                      onFocus={() => setFocused('company')}
                      onBlur={() => setFocused('')}
                      className="w-full p-3 rounded-lg text-white transition-all duration-200"
                      style={{
                        background: 'rgba(8,10,26,0.6)',
                        border: focused === 'company' ? '2px solid var(--brand-teal)' : '1px solid rgba(127,90,240,0.2)',
                        boxShadow: focused === 'company' ? '0 0 20px rgba(0,215,255,0.15)' : 'none',
                        outline: 'none'
                      }}
                    />
                  </div>

                  <div>
                    <label
                      className="block mb-2"
                      htmlFor="subject"
                      style={{ color: 'var(--text-light)', fontWeight: '600', fontSize: '0.95rem' }}
                    >
                      Subject
                    </label>
                    <select
                      id="subject"
                      name="subject"
                      value={formData.subject}
                      onChange={handleChange}
                      onFocus={() => setFocused('subject')}
                      onBlur={() => setFocused('')}
                      className="w-full p-3 rounded-lg text-white transition-all duration-200"
                      style={{
                        background: 'rgba(8,10,26,0.6)',
                        border: focused === 'subject' ? '2px solid var(--brand-teal)' : '1px solid rgba(127,90,240,0.2)',
                        boxShadow: focused === 'subject' ? '0 0 20px rgba(0,215,255,0.15)' : 'none',
                        outline: 'none',
                        cursor: 'pointer'
                      }}
                    >
                      <option value="general">General Inquiry</option>
                      <option value="support">Technical Support</option>
                      <option value="sales">Sales & Pricing</option>
                      <option value="partnership">Partnership</option>
                      <option value="feedback">Feedback</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label
                    className="block mb-2"
                    htmlFor="message"
                    style={{ color: 'var(--text-light)', fontWeight: '600', fontSize: '0.95rem' }}
                  >
                    Message *
                  </label>
                  <textarea
                    id="message"
                    name="message"
                    placeholder="Tell us about your project or question..."
                    rows={6}
                    value={formData.message}
                    onChange={handleChange}
                    onFocus={() => setFocused('message')}
                    onBlur={() => setFocused('')}
                    required
                    className="w-full p-3 rounded-lg text-white transition-all duration-200"
                    style={{
                      background: 'rgba(8,10,26,0.6)',
                      border: focused === 'message' ? '2px solid var(--brand-teal)' : '1px solid rgba(127,90,240,0.2)',
                      boxShadow: focused === 'message' ? '0 0 20px rgba(0,215,255,0.15)' : 'none',
                      outline: 'none',
                      resize: 'vertical',
                      minHeight: '120px'
                    }}
                  />
                </div>

                <button
                  type="submit"
                  className="cta-button cta-primary"
                  data-magnetic="0.15"
                  style={{ width: '100%', padding: '1rem', fontSize: '1.1rem', fontWeight: '700' }}
                >
                  Send Message
                </button>
              </form>
            </section>

            {/* Social Links */}
            <section className="text-center" style={{ marginBottom: '3rem' }}>
              <h3 style={{ fontSize: '1.2rem', fontWeight: '600', marginBottom: '1.5rem', color: 'var(--text-light)' }}>
                Follow Us
              </h3>
              <div style={{ display: 'flex', justifyContent: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
                {SOCIAL_LINKS.map((social) => (
                  <a
                    key={social.name}
                    href={social.url}
                    className="panel-glass"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      padding: '0.75rem 1.5rem',
                      borderRadius: '12px',
                      textDecoration: 'none',
                      color: 'var(--text-light)',
                      fontSize: '0.95rem',
                      fontWeight: '600',
                      transition: 'transform 0.2s, box-shadow 0.2s'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateY(-2px)';
                      e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,215,255,0.2)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  >
                    <span style={{ fontSize: '1.3rem' }}>{social.icon}</span>
                    {social.name}
                  </a>
                ))}
              </div>
            </section>
          </>
        )}

        {activeTab === 'faq' && (
          <section style={{ animation: 'fade-up 0.8s ease-out', marginBottom: '3rem' }}>
            <div className="text-center" style={{ marginBottom: '3rem' }}>
              <h2 className="section-title">Frequently Asked Questions</h2>
              <p className="section-subtitle">Quick answers to common questions</p>
            </div>
            <div className="space-y-4" style={{ maxWidth: '800px', margin: '0 auto' }}>
              {FAQ_ITEMS.map((faq, idx) => (
                <article
                  key={idx}
                  className="panel-glass"
                  style={{ padding: '2rem', borderRadius: '16px' }}
                >
                  <h3 style={{ fontSize: '1.2rem', fontWeight: '700', marginBottom: '1rem', color: 'var(--brand-teal)' }}>
                    {faq.q}
                  </h3>
                  <p style={{ color: 'var(--text-muted)', lineHeight: '1.7', fontSize: '0.95rem' }}>
                    {faq.a}
                  </p>
                </article>
              ))}
            </div>
            <div className="text-center" style={{ marginTop: '3rem' }}>
              <p style={{ color: 'var(--text-muted)', marginBottom: '1rem' }}>
                Still have questions?
              </p>
              <button
                onClick={() => setActiveTab('contact')}
                className="cta-button cta-primary"
                data-magnetic="0.15"
              >
                Contact Support
              </button>
            </div>
          </section>
        )}

        {/* Additional Info */}
        <section className="panel-glass" style={{ padding: '2rem', borderRadius: '16px', textAlign: 'center' }}>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', marginBottom: '0.5rem' }}>
            Average response time: <span style={{ color: 'var(--brand-teal)', fontWeight: '700' }}>2-4 hours</span>
          </p>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            Enterprise support available 24/7 • <Link to="/about" style={{ color: 'var(--brand-teal)', textDecoration: 'none' }}>Learn more →</Link>
          </p>
        </section>
      </main>
    </div>
  );
}
