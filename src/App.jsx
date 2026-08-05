// src/App.jsx
import React, { Suspense, lazy, useCallback, useEffect, useRef, useState } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import ErrorBoundary from "./components/ErrorBoundary";

// Eager page for first paint
import Home from "./pages/Home";
import About from "./pages/About";
import Contact from "./pages/Contact";

// Lazy pages for route-level code splitting
const Gallery = lazy(() => import("./pages/Gallery"));
const Projects = lazy(() => import("./pages/Projects"));
const Login = lazy(() => import("./pages/Login"));
const Register = lazy(() => import("./pages/Register"));
const Studio = lazy(() => import("./pages/Studio"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Documentation = lazy(() => import("./pages/Documentation"));
const Admin = lazy(() => import("./pages/Admin"));
const ReviewViewer = lazy(() => import("./pages/ReviewViewer"));
const VerifyEmailPage = lazy(() => import("./pages/VerifyEmail"));
const ForgotPasswordPage = lazy(() => import("./pages/ForgotPassword"));
const ResetPasswordPage = lazy(() => import("./pages/ResetPassword"));
const MarketplacePage = lazy(() => import("./pages/marketplace/MarketplacePage"));
const ProductDetail = lazy(() => import("./pages/marketplace/ProductDetail"));
const CartPage = lazy(() => import("./pages/marketplace/CartPage"));
const CheckoutPage = lazy(() => import("./pages/marketplace/CheckoutPage"));
const OrderHistory = lazy(() => import("./pages/marketplace/OrderHistory"));
const OrderTracking = lazy(() => import("./pages/marketplace/OrderTracking"));
const SellerDashboard = lazy(() => import("./pages/marketplace/SellerDashboard"));

// Auth context (NOTE: path is ./contexts/AuthContext)
import { AuthProvider, useAuth } from "./contexts/AuthContext";

// DnD
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";

function RouteLoading() {
  return (
    <div className="route-loader" role="status" aria-label="Loading">
      <div className="route-loader__orb" aria-hidden="true" />
      <div className="route-loader__ring" aria-hidden="true" />
    </div>
  );
}

function withSuspense(element) {
  return <Suspense fallback={<RouteLoading />}>{element}</Suspense>;
}

function Layout({ children }) {
  const { pathname } = useLocation();
  // Dashboard is fullscreen — no global navbar/footer chrome needed.
  const hideChromeRoutes = ["/dashboard", "/studio", "/review"];
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
  if (loading) return <RouteLoading />;
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
          <Route path="/gallery" element={<Layout>{withSuspense(<Gallery />)}</Layout>} />
          <Route path="/projects" element={<Layout>{withSuspense(<Projects />)}</Layout>} />
          <Route path="/documentation" element={<Layout>{withSuspense(<Documentation />)}</Layout>} />
          <Route path="/contact" element={<Layout><Contact /></Layout>} />
          <Route path="/review/:token" element={<Layout>{withSuspense(<ReviewViewer />)}</Layout>} />
          <Route path="/login" element={<Layout>{withSuspense(<Login />)}</Layout>} />
          <Route path="/register" element={<Layout>{withSuspense(<Register />)}</Layout>} />
          <Route path="/verify-email" element={<Layout>{withSuspense(<VerifyEmailPage />)}</Layout>} />
          <Route path="/reset-password" element={<Layout>{withSuspense(<ResetPasswordPage />)}</Layout>} />
          <Route path="/forgot-password" element={<Layout>{withSuspense(<ForgotPasswordPage />)}</Layout>} />

          {/* Dashboard — requires login */}
          <Route
            path="/dashboard"
            element={
              <PrivateRoute>
                <Layout>{withSuspense(<Dashboard />)}</Layout>
              </PrivateRoute>
            }
          />

          {/* Admin panel — requires admin role */}
          <Route
            path="/admin"
            element={
              <PrivateRoute>
                {withSuspense(<Admin />)}
              </PrivateRoute>
            }
          />

          {/* Marketplace — public browse, auth for cart/checkout/seller */}
          <Route path="/marketplace" element={<Layout>{withSuspense(<MarketplacePage />)}</Layout>} />
          <Route path="/marketplace/product/:idOrSlug" element={<Layout>{withSuspense(<ProductDetail />)}</Layout>} />
          <Route path="/marketplace/cart" element={<Layout><PrivateRoute>{withSuspense(<CartPage />)}</PrivateRoute></Layout>} />
          <Route path="/marketplace/checkout" element={<Layout><PrivateRoute>{withSuspense(<CheckoutPage />)}</PrivateRoute></Layout>} />
          <Route path="/marketplace/orders" element={<Layout><PrivateRoute>{withSuspense(<OrderHistory />)}</PrivateRoute></Layout>} />
          <Route path="/marketplace/orders/:orderId" element={<Layout><PrivateRoute>{withSuspense(<OrderTracking />)}</PrivateRoute></Layout>} />
          <Route path="/marketplace/seller" element={<Layout><PrivateRoute>{withSuspense(<SellerDashboard />)}</PrivateRoute></Layout>} />

          {/* Studio — requires login and uses DnD provider */}
          <Route
            path="/studio"
            element={
              <PrivateRoute>
                <DndProvider backend={HTML5Backend}>
                  {withSuspense(<Studio />)}
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
  const { pathname } = useLocation();
  const gsiInitRef = useRef(false);
  const [googleClientId, setGoogleClientId] = useState(
    () => (import.meta.env.VITE_GOOGLE_CLIENT_ID || window.__GOOGLE_CLIENT_ID__ || "").trim()
  );

  const renderButtonOnce = useCallback(() => {
    const placeholder = document.getElementById("g_id_signin");
    if (!placeholder) return;
    if (!window.google || !window.google.accounts || !window.google.accounts.id) return;
    if (placeholder.dataset.gsiRendered === "true") return;

    try {
      window.google.accounts.id.renderButton(placeholder, { theme: "outline", size: "large" });
      placeholder.dataset.gsiRendered = "true";
    } catch (e) {
      console.debug("Google ID button render skipped", e);
    }
  }, []);

  useEffect(() => {
    if (googleClientId) return;
    let disposed = false;

    const fetchRuntimeClientId = async () => {
      try {
        const apiBase = (window.__OBJEKTA_API_BASE || import.meta.env.VITE_API_BASE || "").replace(/\/$/, "");
        const runtimeConfigUrl = apiBase ? `${apiBase}/api/runtime-config` : "/api/runtime-config";
        const res = await fetch(runtimeConfigUrl, {
          cache: "no-store",
          credentials: "include",
        });
        if (!res.ok) return;
        const data = await res.json();
        const runtimeClientId = (data?.googleClientId || "").trim();
        if (!runtimeClientId || disposed) return;
        window.__GOOGLE_CLIENT_ID__ = runtimeClientId;
        setGoogleClientId(runtimeClientId);
      } catch (e) {
        console.debug("Runtime Google client id fetch skipped", e);
      }
    };

    fetchRuntimeClientId();
    return () => {
      disposed = true;
    };
  }, [googleClientId]);

  useEffect(() => {
    if (!googleClientId) return;
    let disposed = false;
    let pollId = null;
    let script = null;

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

    const initializeGsi = () => {
      if (disposed) return false;
      if (!window.google || !window.google.accounts || !window.google.accounts.id) return false;

      try {
        if (!window.__OBJEKTA_GSI_INITIALIZED && !gsiInitRef.current) {
          window.google.accounts.id.initialize({
            client_id: googleClientId,
            callback: handleCredentialResponse,
          });
          window.__OBJEKTA_GSI_INITIALIZED = true;
          gsiInitRef.current = true;
          window.dispatchEvent(new Event("objekta:gsi-ready"));
        }
        renderButtonOnce();
        return true;
      } catch (e) {
        console.debug('Google ID initialization skipped', e);
        return false;
      }
    };

    if (initializeGsi()) {
      return () => {
        disposed = true;
      };
    }

    script = document.querySelector('script[src="https://accounts.google.com/gsi/client"]');
    if (!script) {
      script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }

    const onLoad = () => {
      initializeGsi();
    };
    const onError = () => {
      console.warn('Google Identity Services failed to load');
    };

    script.addEventListener('load', onLoad);
    script.addEventListener('error', onError);

    pollId = window.setInterval(() => {
      if (initializeGsi()) {
        window.clearInterval(pollId);
        pollId = null;
      }
    }, 500);

    return () => {
      disposed = true;
      if (script) {
        script.removeEventListener('load', onLoad);
        script.removeEventListener('error', onError);
      }
      if (pollId) {
        window.clearInterval(pollId);
      }
    };
  }, [authWithProvider, googleClientId, navigate, renderButtonOnce]);

  useEffect(() => {
    if (!window.__OBJEKTA_GSI_INITIALIZED && !gsiInitRef.current) {
      return;
    }
    renderButtonOnce();
  }, [pathname, renderButtonOnce]);

  return null;
}
