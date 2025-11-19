import React, { Suspense, useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
// Navbar is provided globally by App layout — do not render it here to avoid duplicates
import "../index.css"; // <-- Your global CSS
import { useAuth } from "../contexts/AuthContext";
import useHackerText from "../hooks/useHackerText";

// --- 3D / 2D IMPORTS ---
import Scene from "../components/Scene";
import OverlayUI from "../components/OverlayUI";

// --- UTILITY: Throttling for scroll event performance ---
const throttle = (func, limit) => {
  let inThrottle;
  return function() {
    const context = this;
    const args = arguments;
    if (!inThrottle) {
      func.apply(context, args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
};

// --- AUTH MODAL EXTRACTED COMPONENT (CLEANUP) ---
const AuthModal = React.memo(({ authMode, setAuthMode, showAuthModal, setShowAuthModal, authForm, onAuthChange, doLogin, doSignup, authLoading, authErr, setAuthErr }) => {
    const title = authMode === "login" ? "Login to OBJEKTA" : "Create your OBJEKTA account";
    const submitHandler = authMode === "login" ? doLogin : doSignup;
    const submitText = authLoading ? (authMode === "login" ? "Signing in…" : "Creating…") : (authMode === "login" ? "Sign in" : "Create account");

    if (!showAuthModal) return null;

    return (
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="auth-title">
            <div className="auth-modal" role="document">
                <button className="close" onClick={() => setShowAuthModal(false)} aria-label="Close auth dialog">×</button>
                <form onSubmit={submitHandler}>
                    <h3 id="auth-title">{title}</h3>
                    <p className="text-muted">{authMode === "login" ? "Sign in to open your studio and access your projects." : "Join and save projects to the cloud."}</p>
                    
                    {authMode === "signup" && (
                        <input name="name" value={authForm.name} onChange={onAuthChange} required placeholder="Full name" className="auth-input" autoComplete="name" />
                    )}
                    
                    <input name="email" value={authForm.email} onChange={onAuthChange} required placeholder="Email" className="auth-input" autoComplete="email" />
                    
                    <input 
                        type="password" 
                        name="password" 
                        value={authForm.password} 
                        onChange={onAuthChange} 
                        required 
                        placeholder="Password" 
                        className="auth-input" 
                        autoComplete={authMode === "login" ? "current-password" : "new-password"}
                    />
                    
                    <div className="modal-actions">
                        <button type="submit" className={authMode === "login" ? "launch-btn" : "nav-btn-signup"} disabled={authLoading}>
                            {submitText}
                        </button>
                        <button
                            type="button"
                            className={authMode === "login" ? "nav-btn-signup" : "low-power-toggle"}
                            onClick={() => {
                                setAuthMode(authMode === "login" ? "signup" : "login");
                                setAuthErr(null);
                            }}
                            style={{ alignSelf: authMode === "signup" ? "center" : "unset" }}
                        >
                            {authMode === "login" ? "Create account" : "Have an account?"}
                        </button>
                    </div>
                    {authErr && <div className="error">{authErr}</div>}
                </form>
            </div>
        </div>
    );
});

// --- Single Model Lightbox (simplified without @google/model-viewer) ---
const ModelLightbox = React.memo(function ModelLightbox({ open, onClose, model }) {
    if (!open || !model) return null;
    return (
        <div className="modal-overlay model-lightbox" role="dialog" aria-modal="true">
            <div className="lightbox-content">
                <button className="close" onClick={onClose} aria-label="Close model viewer">×</button>
                <img
                    src={model.poster}
                    alt={model.alt}
                    style={{ width: "100%", height: "70vh", objectFit: "contain" }}
                />
                <div className="lightbox-meta">
                    <h3>{model.title}</h3>
                    <p>{model.desc}</p>
                </div>
            </div>
        </div>
    );
});

// --- MAIN HOME COMPONENT ---
export default function Home() {
    const showcaseRef = useRef(null);
    // Inline model-viewers removed in favor of a single lightbox viewer
    const { user, login, signup } = useAuth();
    const navigate = useNavigate();
    const [suspendScene, setSuspendScene] = useState(false);
    
    // Model loading state consolidated
    const [modelsState, setModelsState] = useState(
        [null, null, null].map(() => ({ progress: 0, ready: false, blobUrl: null }))
    );
    // Track visibility of each showcase card to limit concurrent WebGL contexts
    const [visibleCards, setVisibleCards] = useState([false, false, false]);
    const cardRefs = useRef([]);
    
    const [performanceMode, setPerformanceMode] = useState(() => {
        try {
            return JSON.parse(localStorage.getItem("objekta_performance_mode") || "true");
        } catch {
            return true;
        }
    });

    // Animated headline using hacker text effect
    const animatedHeadline = useHackerText("Design the Future in 3D");

    // --- SCROLLYTELLING STATE & OPTIMIZED HANDLER (PERFORMANCE FIX) ---
    const scrollRef = useRef(null);
    const [scrollProgress, setScrollProgress] = useState(0);

    // FIX: Throttled scroll handler to limit re-renders
    const handleScroll = useMemo(
        () =>
            throttle(() => {
                if (scrollRef.current) {
                    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
                    const progress = scrollTop / (scrollHeight - clientHeight);
                    setScrollProgress(isNaN(progress) ? 0 : progress);
                }
            }, 50), // Throttle to 50ms (adjust as needed)
        []
    );
    // --- END SCROLLYTELLING FIX ---

    // Wrapped in useCallback for stability and performance
    const togglePerformanceMode = useCallback(() => {
        setPerformanceMode((prev) => {
            const next = !prev;
            try {
                localStorage.setItem("objekta_performance_mode", JSON.stringify(next));
            } catch {}
            return next;
        });
    }, []);

    // Your existing models data
    const models = [
        { src: "/models/laptop_free.glb", poster: "/assets/laptop-poster.webp", alt: "Laptop", title: "Sculpt Reality", desc: "Craft stunning 3D models with intuitive tools and real-time feedback." },
        { src: "/models/cyberpunk_desk.glb", poster: "/assets/desk-poster.webp", alt: "Cyberpunk Desk", title: "Animate Your Vision", desc: "Bring your creations to life with a powerful, timeline-based animation system." },
        { src: "/models/porsche.glb", poster: "/assets/porsche-poster.webp", alt: "Porsche 911 Turbo", title: "Sell & Showcase", desc: "Monetize your assets on a built-in marketplace and share them seamlessly." },
    ];
    const featureItems = [
        { icon: (
            <svg className="icon" viewBox="0 0 24 24" fill="none" width="36" height="36" aria-hidden><path d="M12 2l8 4.5v10L12 21l-8-4.5v-10L12 2z" stroke="currentColor" strokeWidth="1.3" /><path d="M12 2v19" stroke="currentColor" strokeWidth="1.3" opacity=".7" /><path d="M4 6.5l8 4.5 8-4.5" stroke="currentColor" strokeWidth="1.3" opacity=".7" /></svg>
        ), title: "Real-time collaboration", desc: "Work on projects with your team simultaneously, no matter where you are." },
        { icon: (
            <svg className="icon" viewBox="0 0 24 24" fill="none" width="36" height="36" aria-hidden><path d="M8 12a4 4 0 100 8 4 4 0 000-8zM16 4a4 4 0 100 8 4 4 0 000-8z" stroke="currentColor" strokeWidth="1.3" /><path d="M10.5 14.5l3-5" stroke="currentColor" strokeWidth="1.3" opacity=".8" /></svg>
        ), title: "AI-powered assets", desc: "Generate and enhance models and textures using cutting-edge AI features." },
        { icon: (
            <svg className="icon" viewBox="0 0 24 24" fill="none" width="36" height="36" aria-hidden><path d="M14 4l6 6-6 6-6-6 6-6z" stroke="currentColor" strokeWidth="1.3" /><path d="M4 20l4-4" stroke="currentColor" strokeWidth="1.3" opacity=".7" /></svg>
        ), title: "Marketplace integration", desc: "Instantly buy and sell 3D models directly within the platform." },
    ];

    // Auth state and handlers
    const [showAuthModal, setShowAuthModal] = useState(false);
    const [authMode, setAuthMode] = useState("login");
    const [authForm, setAuthForm] = useState({ name: "", email: "", password: "" });
    const [authErr, setAuthErr] = useState(null);
    const [authLoading, setAuthLoading] = useState(false);
    const onAuthChange = useCallback((e) => setAuthForm((p) => ({ ...p, [e.target.name]: e.target.value })), []);

    // Lightbox state
    const [lightboxOpen, setLightboxOpen] = useState(false);
    const [activeModel, setActiveModel] = useState(null);

    // Auth handlers wrapped in useCallback
    const doLogin = useCallback(async (e) => {
        e?.preventDefault();
        setAuthErr(null);
        setAuthLoading(true);
        const res = await login(authForm.email, authForm.password);
        setAuthLoading(false);
        if (res.ok) {
            setShowAuthModal(false);
            setAuthForm({ name: "", email: "", password: "" });
            navigate("/dashboard");
        } else {
            setAuthErr(res.error || "Login failed");
        }
    }, [login, authForm.email, authForm.password, navigate]);

    const doSignup = useCallback(async (e) => {
        e?.preventDefault();
        setAuthErr(null);
        setAuthLoading(true);
        const res = await signup(authForm.name, authForm.email, authForm.password);
        setAuthLoading(false);
        if (res.ok) {
            setShowAuthModal(false);
            setAuthForm({ name: "", email: "", password: "" });
            navigate("/dashboard");
        } else {
            setAuthErr(res.error || "Signup failed");
        }
    }, [signup, authForm.name, authForm.email, authForm.password, navigate]);

    // Stats counters (animate when visible)
    const statsRef = useRef(null);
    const [statsVisible, setStatsVisible] = useState(false);
    const [stats, setStats] = useState([
        { label: "Creations exported", target: 12840, value: 0 },
        { label: "Live collaborators", target: 642, value: 0 },
        { label: "Marketplace assets", target: 3159, value: 0 },
    ]);

    useEffect(() => {
        const el = statsRef.current;
        if (!el) return;
        const io = new IntersectionObserver((entries) => {
            if (entries.some((e) => e.isIntersecting)) {
                setStatsVisible(true);
                io.disconnect();
            }
        }, { threshold: 0.25 });
        io.observe(el);
        return () => io.disconnect();
    }, []);

    useEffect(() => {
        if (!statsVisible) return;
        let raf;
        const start = performance.now();
        const duration = 1400;
        const easeOut = (t) => 1 - Math.pow(1 - t, 3);
        const tick = (ts) => {
            const p = Math.min(1, (ts - start) / duration);
            setStats((prev) => prev.map((s) => ({
                ...s,
                value: Math.floor(s.target * easeOut(p))
            })));
            if (p < 1) raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(raf);
    }, [statsVisible]);

    // Removed preloading of heavy models to reduce memory/GPU pressure

    // Model viewer removed to avoid dependency issues

    // Suspend R3F Scene when showcase is on screen to avoid multiple WebGL contexts
    useEffect(() => {
        if (!showcaseRef.current) return;
        const obs = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => setSuspendScene(entry.isIntersecting));
            },
            { threshold: 0.15 }
        );
        obs.observe(showcaseRef.current);
        return () => obs.disconnect();
    }, []);

    // No inline model-viewers; no sync needed

    // Per-card IntersectionObserver: mount <model-viewer> only when visible
    useEffect(() => {
        if (!cardRefs.current) return;
        const io = new IntersectionObserver(
            entries => {
                setVisibleCards(prev => {
                    const next = [...prev];
                    entries.forEach(entry => {
                        const idx = Number(entry.target.getAttribute('data-card-idx'));
                        if (!Number.isNaN(idx)) {
                            next[idx] = entry.isIntersecting || next[idx]; // once visible, keep true
                        }
                    });
                    return next;
                });
            },
            { threshold: 0.25 }
        );
        cardRefs.current.forEach(el => el && io.observe(el));
        return () => io.disconnect();
    }, []);

    // Reveal observer
    useEffect(() => {
        const revealEls = document.querySelectorAll(".reveal, .mini-card, .feature-card, .site-footer");
        if (!revealEls.length) return;
        const obs = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        entry.target.classList.add("is-visible");
                        obs.unobserve(entry.target);
                    }
                });
            },
            { threshold: 0.18 }
        );
        revealEls.forEach((el) => obs.observe(el));
        return () => obs.disconnect();
    }, []); 

    // Interaction Handlers wrapped in useCallback
    const goFullScreen = useCallback((element) => {
        if (!element) return;
        if (element.requestFullscreen) element.requestFullscreen();
        else if (element.webkitRequestFullscreen) element.webkitRequestFullscreen();
        else if (element.msRequestFullscreen) element.msRequestFullscreen();
    }, []);

    const handleVisualClick = useCallback((e, idx) => {
        setActiveModel(models[idx]);
        setLightboxOpen(true);
    }, [models]);

    const handleCardMouseMove = useCallback((e) => {
        const card = e.currentTarget;
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const { width, height } = rect;
        const rotateX = (y / height - 0.5) * -30;
        const rotateY = (x / width - 0.5) * 30;
        card.style.transform = `rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(1.03)`;
        card.style.setProperty('--mouse-x', `${x}px`);
        card.style.setProperty('--mouse-y', `${y}px`);
    }, []);

    const handleCardMouseLeave = useCallback((e) => {
        e.currentTarget.style.transform = 'rotateX(0deg) rotateY(0deg) scale(1)';
    }, []);


    return (
        <>
            {/* LAYER 1: THE 3D SCENE (BACKGROUND) */}
            <div id="canvas-container">
                <Suspense fallback={null}>
                    {/* Always render scene; pause only when showcase is in view */}
                    {!suspendScene && <Scene scrollProgress={scrollProgress} />}
                </Suspense>
            </div>

            {/* Decorative, lightweight animated background ornaments (CSS-only) */}
            <div className="bg-ornaments" aria-hidden />

            {/* LAYER 2: THE 2D CYBERPUNK UI (FOREGROUND) */}
            {/* Show the overlay UI when NOT in performance (low-power) mode */}
            {!performanceMode && <OverlayUI />}
            
            {/* LAYER 3: PAGE CONTENT (ON TOP) */}
            {/* MODIFIED: Added ref and onScroll for THROTTLED scrollytelling */}
            <div className="site-wrapper" ref={scrollRef} onScroll={handleScroll}> 
                {/* Navbar is provided by App layout; do not render it here to avoid duplicates */}

                <header className="hero-section reveal">
                    <h1 className="hero-title hero-title-gradient hero-shine">{animatedHeadline}</h1>
                    <p className="hero-subtitle hero-subtitle-muted">Create, collaborate, and ship 3D experiences at the speed of imagination.</p>

                    <div className="hero-actions">
                        <button
                            className="launch-btn cta-button"
                            aria-label="Launch Studio"
                            onClick={() => {
                                if (user) navigate("/dashboard");
                                else {
                                    setAuthMode("login");
                                    setShowAuthModal(true);
                                }
                            }}
                        >
                            {user ? `Open Studio${user?.name ? ` — ${user.name.split(" ")[0]}` : ""}` : "Launch Studio"}
                        </button>
                        <button
                            className={`low-power-toggle ${performanceMode ? "is-on" : ""}`}
                            onClick={togglePerformanceMode}
                            aria-pressed={performanceMode}
                            title="Toggle performance mode to reduce GPU load"
                        >
                            Performance Mode: {performanceMode ? "On" : "Off"}
                        </button>
                    </div>
                </header>

                {/* STAT STRIP */}
                <section className="stats-section reveal" ref={statsRef}>
                    {stats.map((s, i) => (
                        <div key={i} className="stat-card">
                            <div className="stat-value">{s.value.toLocaleString()}</div>
                            <div className="stat-label">{s.label}</div>
                        </div>
                    ))}
                </section>

                {/* TRUST/MARQUEE STRIP */}
                <section className="marquee-section reveal" aria-label="Trusted creators">
                    <div className="marquee-track">
                        <span>Creators • Studios • Agencies • Educators • </span>
                        <span>Creators • Studios • Agencies • Educators • </span>
                        <span>Creators • Studios • Agencies • Educators • </span>
                    </div>
                </section>

                {/* FEATURES SECTION */}
                <section className="features-section reveal">
                    <h2 className="section-title">A New Dimension of Workflow</h2>
                    <div className="features-grid">
                        {featureItems.map((item, idx) => (
                            <div key={idx} className="mini-card reveal" tabIndex={0}>
                                {item.icon}
                                <h3 className="card-title">{item.title}</h3>
                                <p className="card-description">{item.desc}</p>
                            </div>
                        ))}
                    </div>
                </section>

                {/* SHOWCASE SECTION */}
                <section className="showcase-section reveal" ref={showcaseRef}>
                    <h2 className="section-title">Built on the Future of Tech</h2>
                    <p className="section-subtitle">A showcase of assets created and shared on OBJEKTA.</p>
                            <div className="showcase-grid">
                                {models.map((model, idx) => (
                                    <div 
                                        key={idx} 
                                        className="feature-card"
                                        onMouseMove={handleCardMouseMove}
                                        onMouseLeave={handleCardMouseLeave}
                                    >
                                        <div
                                            className="card-visual"
                                            onClick={(e) => handleVisualClick(e, idx)}
                                            onKeyDown={(e) => {
                                                if (e.key === "Enter" || e.key === " ") {
                                                    e.preventDefault();
                                                    handleVisualClick(e, idx);
                                                }
                                            }}
                                            role="button"
                                            tabIndex={0}
                                            aria-label={`Open ${model.title}`}
                                        >
                                            <img src={model.poster} alt={model.alt} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                            <span className="fullscreen-hint">Click to View</span>
                                        </div>
                                        <div className="card-content">
                                            <h3>{model.title}</h3>
                                            <p>{model.desc}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                </section>

                {/* SITE FOOTER */}
                <footer className="site-footer reveal">
                    <p>&copy; {new Date().getFullYear()} OBJEKTA. All rights reserved.</p>
                    <p>
                        <a href="/about" onClick={(e) => e.preventDefault()}>About</a> &bull; 
                        <a href="/privacy" onClick={(e) => e.preventDefault()}>Privacy</a> &bull; 
                        <a href="/terms" onClick={(e) => e.preventDefault()}>Terms</a>
                    </p>
                </footer>
                
            </div>

            {/* ---------- Auth Modal (EXTRACTED) ---------- */}
            <AuthModal
                showAuthModal={showAuthModal}
                setShowAuthModal={setShowAuthModal}
                authMode={authMode}
                setAuthMode={setAuthMode}
                authForm={authForm}
                onAuthChange={onAuthChange}
                doLogin={doLogin}
                doSignup={doSignup}
                authLoading={authLoading}
                authErr={authErr}
                setAuthErr={setAuthErr}
                navigate={navigate}
            />

            {/* Single model lightbox */}
            <ModelLightbox
                open={lightboxOpen}
                onClose={() => setLightboxOpen(false)}
                model={activeModel}
            />

            {/* Inlined styles from original component + NEW LAYOUT FIXES */}
            <style>{`
                /* --- LAYOUT FIX: Full-screen canvas --- */
                html, body {
                    width: 100%;
                    height: 100%;
                    margin: 0;
                    padding: 0;
                    background-color: #060812; /* Fallback background */
                }

                #canvas-container {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100vw;
                    height: 100vh;
                    z-index: 1; /* Background layer */
                    pointer-events: none; /* Allow clicks to pass through to canvas if needed, but OrbitControls will catch them */
                }

                #canvas-container > div { /* Target the inner R3F canvas */
                    pointer-events: auto; /* Re-enable pointer events for OrbitControls */
                }
                
                /* Use global .site-wrapper from index.css (removed inline overrides) */

                /* Decorative background ornaments */
                .bg-ornaments {
                    position: fixed;
                    inset: 0;
                    z-index: 5;
                    pointer-events: none;
                    background:
                        radial-gradient(60vw 60vw at 20% 20%, rgba(37, 99, 235, 0.15), transparent 60%),
                        radial-gradient(50vw 50vw at 80% 70%, rgba(56, 189, 248, 0.12), transparent 60%);
                    animation: bgFloat 20s linear infinite alternate;
                }
                @keyframes bgFloat {
                    0% { filter: hue-rotate(0deg) saturate(1); }
                    100% { filter: hue-rotate(15deg) saturate(1.1); }
                }

                /* --- Enhanced Hero --- */
                .hero-title-gradient {
                    background: linear-gradient(100deg, #e8f1ff 20%, #b5d0ff 50%, #93c5fd 80%);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                    background-clip: text;
                    text-fill-color: transparent;
                }
                .hero-shine {
                    position: relative;
                }
                .hero-shine::after {
                    content: '';
                    position: absolute;
                    left: -30%;
                    top: 0;
                    height: 100%;
                    width: 30%;
                    transform: skewX(-20deg);
                    background: linear-gradient(90deg, transparent, rgba(255,255,255,0.35), transparent);
                    animation: shine 3.6s ease-in-out infinite;
                }
                @keyframes shine {
                    0% { left: -30%; }
                    100% { left: 120%; }
                }
                .hero-subtitle-muted {
                    opacity: 0.8;
                    max-width: 550px;
                }
                /* --- 3D Card Showcase --- */
                .showcase-grid {
                    perspective: 1800px;
                }
                .feature-card {
                    transform-style: preserve-3d;
                    transition: transform 0.05s ease-out;
                    will-change: transform;
                    position: relative;
                    overflow: hidden;
                    background: linear-gradient(160deg, rgba(9, 14, 32, 0.6), rgba(12, 22, 45, 0.4));
                    border: 1px solid rgba(37, 99, 235, 0.25);
                    border-radius: 14px;
                }
                /* --- Mouse Glow Effect --- */
                .feature-card::before {
                    content: '';
                    position: absolute;
                    left: 0;
                    top: 0;
                    width: 100%;
                    height: 100%;
                    background: radial-gradient(
                        350px circle at var(--mouse-x) var(--mouse-y),
                        rgba(127, 90, 240, 0.3),
                        rgba(127, 90, 240, 0.1),
                        transparent 60%
                    );
                    border-radius: inherit;
                    opacity: 0;
                    transition: opacity 0.3s ease-out;
                    z-index: 1;
                    pointer-events: none;
                }
                .feature-card:hover::before {
                    opacity: 1;
                }
                .card-visual, .card-content {
                    position: relative;
                    z-index: 2;
                }
                .card-visual {
                    transform: translateZ(25px);
                    aspect-ratio: 16/10;
                    overflow: hidden;
                }
                .card-content {
                    transform: translateZ(15px);
                    padding: 12px 14px 16px;
                }
                .card-content h3 { margin: 6px 0 4px; }
                .card-content p { opacity: .9; }

                /* Glitch effect on hover */
                .feature-card:hover { animation: glitch 0.2s ease-in-out; }
                @keyframes glitch {
                    0%, 100% { transform: translateX(0); }
                    20% { transform: translateX(-2px); }
                    40% { transform: translateX(2px); }
                    60% { transform: translateX(-2px); }
                    80% { transform: translateX(2px); }
                }

                /* Lightbox styling */
                .model-lightbox .lightbox-content {
                    width: min(100%, 980px);
                    background: linear-gradient(160deg, rgba(8, 13, 28, 0.85), rgba(6, 10, 24, 0.8));
                    border: 1px solid rgba(59, 130, 246, 0.3);
                    border-radius: 14px;
                    padding: 16px;
                    box-shadow: 0 18px 60px rgba(0,0,0,0.7);
                }
                .lightbox-meta { margin-top: 10px; }
                .lightbox-meta h3 { margin: 0 0 6px; }
                .lightbox-meta p { margin: 0; opacity: .85; }
                }
                /* --- Mini Card Polish --- */
                .mini-card {
                    border: 1px solid rgba(127, 90, 240, 0.1);
                    transition: transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
                }
                .mini-card:hover {
                    transform: translateY(-5px);
                    border-color: rgba(127, 90, 240, 0.3);
                    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
                }

                /* --- Stats Section --- */
                .stats-section {
                    display: grid;
                    grid-template-columns: repeat(3, minmax(0, 1fr));
                    gap: 18px;
                    margin: 30px auto 20px;
                    width: min(100%, 1100px);
                    padding: 0 16px;
                }
                .stat-card {
                    background: linear-gradient(160deg, rgba(30, 41, 59, 0.45), rgba(2,6,23,0.35));
                    border: 1px solid rgba(59, 130, 246, 0.25);
                    border-radius: 12px;
                    padding: 16px 18px;
                    text-align: center;
                    backdrop-filter: blur(6px);
                    -webkit-backdrop-filter: blur(6px);
                }
                .stat-value { font-size: 28px; font-weight: 800; color: #e8f1ff; }
                .stat-label { font-size: 13px; opacity: 0.8; }
                @media (max-width: 860px) {
                    .stats-section { grid-template-columns: 1fr; }
                }

                /* --- Marquee --- */
                .marquee-section { overflow: hidden; margin: 14px 0 0; }
                .marquee-track {
                    display: inline-block;
                    white-space: nowrap;
                    animation: marquee 24s linear infinite;
                    color: rgba(203, 213, 225, 0.8);
                }
                .marquee-track span { margin-right: 40px; letter-spacing: 0.12em; }
                @keyframes marquee {
                    0% { transform: translateX(0); }
                    100% { transform: translateX(-50%); }
                }
                /* --- Auth Modal Styles --- */
                .modal-overlay {
                    position: fixed;
                    inset: 0;
                    z-index: 9999;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: linear-gradient(180deg, rgba(2,6,12,0.6), rgba(2,6,12,0.45));
                    -webkit-backdrop-filter: blur(10px);
                    backdrop-filter: blur(10px);
                    padding: 1rem;
                }
                .auth-modal {
                    width: 420px;
                    max-width: calc(100% - 2rem);
                    background: linear-gradient(160deg, rgba(22, 18, 40, 0.7), rgba(12, 8, 28, 0.6));
                    border: 1px solid rgba(127, 90, 240, 0.15);
                    border-radius: 12px;
                    padding: 24px;
                    box-shadow: 0 18px 60px rgba(0,0,0,0.7);
                    color: var(--text-light);
                    position: relative;
                }
                .auth-modal h3 {
                    margin-bottom: 6px;
                    margin-top: 0;
                }
                .auth-modal .text-muted {
                    margin-top: 0;
                    margin-bottom: 16px;
                    font-size: 0.9rem;
                    opacity: 0.8;
                }
                .auth-modal .close {
                    position: absolute;
                    right: 18px;
                    top: 18px;
                    background: none;
                    border: none;
                    color: var(--text-light);
                    font-size: 24px;
                    line-height: 1;
                    cursor: pointer;
                    opacity: 0.7;
                    transition: opacity 0.2s, transform 0.2s;
                }
                .auth-modal .close:hover {
                    opacity: 1;
                    transform: scale(1.1);
                }
                .auth-input {
                    display: block;
                    width: 100%;
                    padding: 12px 14px;
                    margin: 10px 0;
                    background: rgba(0,0,0,0.2);
                    border: 1px solid rgba(127, 90, 240, 0.1);
                    border-radius: 10px;
                    color: var(--text-light);
                    font-weight: 500;
                    font-size: 1rem;
                    transition: border-color 0.2s, box-shadow 0.2s;
                }
                .auth-input:focus {
                    outline: none;
                    border-color: rgba(127, 90, 240, 0.5);
                    box-shadow: 0 0 15px rgba(127, 90, 240, 0.2);
                }
                .auth-input::placeholder { color: rgba(157,166,212,0.36); font-weight: 400; }
                .modal-actions {
                    display: flex;
                    gap: 12px;
                    margin-top: 16px;
                }
                .modal-actions button { 
                    min-width: 120px;
                    flex-grow: 1;
                }
                .modal-actions .nav-btn-signup,
                .modal-actions .low-power-toggle {
                    flex-grow: 0;
                    background: transparent;
                    border: 1px solid var(--accent-light);
                    color: var(--accent-light);
                }
                .modal-actions .nav-btn-signup:hover,
                .modal-actions .low-power-toggle:hover {
                    background: var(--accent-faint);
                    border-color: var(--accent);
                    color: var(--accent);
                }
                .error { 
                    color: #ff8a94; 
                    font-weight: 700; 
                    margin-top: 12px;
                    font-size: 0.9rem;
                }
                @media (max-width: 520px) {
                    .auth-modal { width: 100%; padding: 20px; border-radius: 10px; }
                    .auth-input { padding: 12px; }
                    .modal-actions {
                        flex-direction: column;
                    }
                }
            `}</style>
        </>
    );
}