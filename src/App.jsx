// src/App.jsx
import React, { useEffect, useState } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from "react-router-dom";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import ErrorBoundary from "./components/ErrorBoundary";

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

// Admin panel
import Admin from "./pages/Admin";

// Auth flow pages
import VerifyEmailPage from "./pages/VerifyEmail";
import ForgotPasswordPage from "./pages/ForgotPassword";
import ResetPasswordPage from "./pages/ResetPassword";

// Marketplace pages
import MarketplacePage from "./pages/marketplace/MarketplacePage";
import ProductDetail from "./pages/marketplace/ProductDetail";
import CartPage from "./pages/marketplace/CartPage";
import CheckoutPage from "./pages/marketplace/CheckoutPage";
import OrderHistory from "./pages/marketplace/OrderHistory";
import OrderTracking from "./pages/marketplace/OrderTracking";
import SellerDashboard from "./pages/marketplace/SellerDashboard";

// Auth context (NOTE: path is ./contexts/AuthContext)
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { useNavigate } from "react-router-dom";

// DnD
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";

function Layout({ children }) {
  const { pathname } = useLocation();
  // Dashboard is fullscreen — no global navbar/footer chrome needed.
  const hideChromeRoutes = ["/dashboard", "/studio"];
  const hideChrome = hideChromeRoutes.some((r) => pathname.startsWith(r));
  if (hideChrome) {
    return <>{children}</>;
  }
  return (
    <div className="app-shell">
      <Navbar />
      <div>{children}</div>
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
      <ErrorBoundary>
        <ContextBanner />
        <Router>
          <AppInit />
          <Routes>
          {/* Public pages */}
          <Route path="/" element={<Layout><Home /></Layout>} />
          <Route path="/about" element={<Layout><About /></Layout>} />
          <Route path="/gallery" element={<Layout><Gallery /></Layout>} />
          <Route path="/projects" element={<Layout><Projects /></Layout>} />
          <Route path="/contact" element={<Layout><Contact /></Layout>} />
          <Route path="/login" element={<Layout><Login /></Layout>} />
          <Route path="/register" element={<Layout><Register /></Layout>} />
          <Route path="/verify-email" element={<Layout><VerifyEmailPage /></Layout>} />
          <Route path="/reset-password" element={<Layout><ResetPasswordPage /></Layout>} />
          <Route path="/forgot-password" element={<Layout><ForgotPasswordPage /></Layout>} />

          {/* Dashboard — requires login */}
          <Route
            path="/dashboard"
            element={
              <PrivateRoute>
                <Layout><Dashboard /></Layout>
              </PrivateRoute>
            }
          />

          {/* Admin panel — requires admin role */}
          <Route
            path="/admin"
            element={
              <PrivateRoute>
                <Admin />
              </PrivateRoute>
            }
          />

          {/* Marketplace — public browse, auth for cart/checkout/seller */}
          <Route path="/marketplace" element={<Layout><MarketplacePage /></Layout>} />
          <Route path="/marketplace/product/:idOrSlug" element={<Layout><ProductDetail /></Layout>} />
          <Route path="/marketplace/cart" element={<Layout><PrivateRoute><CartPage /></PrivateRoute></Layout>} />
          <Route path="/marketplace/checkout" element={<Layout><PrivateRoute><CheckoutPage /></PrivateRoute></Layout>} />
          <Route path="/marketplace/orders" element={<Layout><PrivateRoute><OrderHistory /></PrivateRoute></Layout>} />
          <Route path="/marketplace/orders/:orderId" element={<Layout><PrivateRoute><OrderTracking /></PrivateRoute></Layout>} />
          <Route path="/marketplace/seller" element={<Layout><PrivateRoute><SellerDashboard /></PrivateRoute></Layout>} />

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
      </ErrorBoundary>
    </AuthProvider>
  );
}

function AppInit() {
  // runs inside Router and AuthProvider
  const { authWithProvider } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || window.__GOOGLE_CLIENT_ID__;
    if (!clientId) return;
    if (!window.google || !window.google.accounts) return;

    const handleCredentialResponse = async (response) => {
      const idToken = response?.credential;
      if (!idToken) return;
      try {
        const r = await authWithProvider('google', idToken);
        if (r?.ok) navigate('/dashboard');
      } catch (e) {
        console.warn('Google credential handler error', e);
      }
    };

    try {
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: handleCredentialResponse,
      });

      // render a default button into any placeholder with id 'g_id_signin'
      const placeholder = document.getElementById('g_id_signin');
      if (placeholder) {
        window.google.accounts.id.renderButton(placeholder, { theme: 'outline', size: 'large' });
      }
    } catch (e) {
      console.debug('Google ID initialization skipped', e);
    }
  }, [authWithProvider, navigate]);

  return null;
}
