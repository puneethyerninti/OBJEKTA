// src/App.jsx
import React, { useEffect, useState } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";

// Pages (keep your existing pages)
import Home from "./pages/Home";
import About from "./pages/About";
import Contact from "./pages/Contact";
import Gallery from "./pages/Gallery";
import Projects from "./pages/Projects";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Studio from "./pages/Studio";

// New dashboard (intermediate)
import Dashboard from "./pages/Dashboard";

// Auth context (NOTE: path is ./contexts/AuthContext)
import { AuthProvider, useAuth } from "./contexts/AuthContext";

// DnD
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";

function Layout({ children }) {
  return (
    <div className="app-shell">
      <Navbar />
      <main>{children}</main>
      <Footer />
    </div>
  );
}

function PrivateRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div style={{ padding: 24, color: "white" }}>Loading…</div>;
  return user ? children : <Navigate to="/" replace />;
}

export default function App() {
  // Global handler for WebGL context loss: show a small banner so user can refresh or enable performance mode
  const [ctxLost, setCtxLost] = useState(false);
  useEffect(() => {
    const onLost = (e) => {
      console.warn('Global WebGL context lost', e);
      setCtxLost(true);
    };
    window.addEventListener('webglcontextlost', onLost, false);
    return () => window.removeEventListener('webglcontextlost', onLost, false);
  }, []);

  const ContextBanner = () => ctxLost ? (
    <div style={{ position: 'fixed', top: 12, left: '50%', transform: 'translateX(-50%)', zIndex: 1200 }}>
      <div style={{ background: 'linear-gradient(90deg,#3ab4ff, #7f5af0)', color: '#021', padding: '8px 12px', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.5)' }}>
        WebGL context lost — try refreshing or enable Performance Mode.
        <button onClick={() => window.location.reload()} style={{ marginLeft: 12, padding: '6px 10px', borderRadius: 8 }}>Reload</button>
      </div>
    </div>
  ) : null;
  return (
    <AuthProvider>
      <ContextBanner />
      <Router>
        <Routes>
          {/* Public pages */}
          <Route path="/" element={<Layout><Home /></Layout>} />
          <Route path="/about" element={<Layout><About /></Layout>} />
          <Route path="/gallery" element={<Layout><Gallery /></Layout>} />
          <Route path="/projects" element={<Layout><Projects /></Layout>} />
          <Route path="/contact" element={<Layout><Contact /></Layout>} />
          <Route path="/login" element={<Layout><Login /></Layout>} />
          <Route path="/register" element={<Layout><Register /></Layout>} />

          {/* Dashboard — requires login */}
          <Route
            path="/dashboard"
            element={
              <PrivateRoute>
                <Layout><Dashboard /></Layout>
              </PrivateRoute>
            }
          />

          {/* Studio — requires login and uses DnD provider */}
          <Route
            path="/studio"
            element={
              <PrivateRoute>
                <DndProvider backend={HTML5Backend}>
                  <Studio />
                </DndProvider>
              </PrivateRoute>
            }
          />

          {/* fallback */}
          <Route path="*" element={<h1 style={{ padding: "2rem" }}>404 — Not Found</h1>} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}
