// src/store/MarketplaceStore.js
// Zustand store for marketplace state: products, cart, orders, filters, real-time
import { create } from "zustand";
import { API_BASE } from "../utils/api";

function apiUrl(path) {
  return `${API_BASE.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;
}

function authHeaders(token) {
  const h = { "Content-Type": "application/json" };
  if (token) h["Authorization"] = `Bearer ${token}`;
  return h;
}

function getToken() {
  try {
    return localStorage.getItem("objekta_token") || null;
  } catch {
    return null;
  }
}

export const useMarketplaceStore = create((set, get) => ({
  // ─── Products ──────────────────────────────────────────────
  products: [],
  productDetail: null,
  categories: [],
  totalProducts: 0,
  totalPages: 1,
  currentPage: 1,
  productsLoading: false,
  productsError: null,

  filters: {
    q: "",
    category: "all",
    minPrice: "",
    maxPrice: "",
    format: "",
    sort: "newest",
    featured: false,
  },

  setFilters: (partial) =>
    set((s) => ({ filters: { ...s.filters, ...partial } })),

  fetchProducts: async (page = 1) => {
    set({ productsLoading: true, productsError: null });
    try {
      const f = get().filters;
      const params = new URLSearchParams();
      if (f.q) params.set("q", f.q);
      if (f.category && f.category !== "all") params.set("category", f.category);
      if (f.minPrice) params.set("minPrice", f.minPrice);
      if (f.maxPrice) params.set("maxPrice", f.maxPrice);
      if (f.format) params.set("format", f.format);
      if (f.sort) params.set("sort", f.sort);
      if (f.featured) params.set("featured", "true");
      params.set("page", page);
      params.set("limit", "24");

      const res = await fetch(apiUrl(`/api/marketplace/products?${params}`));
      const data = await res.json();
      if (data.success) {
        set({
          products: data.products,
          totalProducts: data.totalCount,
          totalPages: data.totalPages,
          currentPage: data.page,
          productsLoading: false,
        });
      } else {
        set({ productsError: data.message, productsLoading: false });
      }
    } catch (err) {
      set({ productsError: err.message, productsLoading: false });
    }
  },

  fetchProductDetail: async (idOrSlug) => {
    set({ productDetail: null, productsLoading: true });
    try {
      const res = await fetch(apiUrl(`/api/marketplace/products/${idOrSlug}`));
      const data = await res.json();
      if (data.success) {
        set({ productDetail: data.product, productsLoading: false });
      } else {
        set({ productsError: data.message, productsLoading: false });
      }
    } catch (err) {
      set({ productsError: err.message, productsLoading: false });
    }
  },

  fetchCategories: async () => {
    try {
      const res = await fetch(apiUrl("/api/marketplace/products/categories"));
      const data = await res.json();
      if (data.success) set({ categories: data.categories });
    } catch (err) {
      console.warn("Failed to fetch categories:", err);
    }
  },

  // ─── Cart ──────────────────────────────────────────────────
  cart: { items: [], total: 0 },
  cartLoading: false,
  cartError: null,

  fetchCart: async () => {
    const token = getToken();
    if (!token) return;
    set({ cartLoading: true });
    try {
      const res = await fetch(apiUrl("/api/marketplace/cart"), {
        headers: authHeaders(token),
      });
      const data = await res.json();
      if (data.success) set({ cart: data.cart, cartLoading: false });
      else set({ cartLoading: false });
    } catch (err) {
      set({ cartError: err.message, cartLoading: false });
    }
  },

  addToCart: async (productId) => {
    const token = getToken();
    if (!token) return { ok: false, error: "Login required" };
    try {
      const res = await fetch(apiUrl("/api/marketplace/cart/add"), {
        method: "POST",
        headers: authHeaders(token),
        body: JSON.stringify({ productId, quantity: 1 }),
      });
      const data = await res.json();
      if (data.success) {
        set({ cart: data.cart });
        return { ok: true };
      }
      return { ok: false, error: data.message };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  },

  updateCartItem: async (productId, quantity) => {
    const token = getToken();
    try {
      const res = await fetch(apiUrl("/api/marketplace/cart/update"), {
        method: "PUT",
        headers: authHeaders(token),
        body: JSON.stringify({ productId, quantity }),
      });
      const data = await res.json();
      if (data.success) set({ cart: data.cart });
    } catch (err) {
      console.error("Update cart error:", err);
    }
  },

  removeFromCart: async (productId) => {
    const token = getToken();
    try {
      const res = await fetch(apiUrl(`/api/marketplace/cart/remove/${productId}`), {
        method: "DELETE",
        headers: authHeaders(token),
      });
      const data = await res.json();
      if (data.success) set({ cart: data.cart });
    } catch (err) {
      console.error("Remove from cart error:", err);
    }
  },

  clearCart: async () => {
    const token = getToken();
    try {
      await fetch(apiUrl("/api/marketplace/cart"), {
        method: "DELETE",
        headers: authHeaders(token),
      });
      set({ cart: { items: [], total: 0 } });
    } catch (err) {
      console.error("Clear cart error:", err);
    }
  },

  // ─── Orders ────────────────────────────────────────────────
  orders: [],
  currentOrder: null,
  ordersLoading: false,
  ordersError: null,

  createOrder: async (paymentMethod = "stripe") => {
    const token = getToken();
    if (!token) return { ok: false, error: "Login required" };
    set({ ordersLoading: true });
    try {
      const res = await fetch(apiUrl("/api/marketplace/orders"), {
        method: "POST",
        headers: authHeaders(token),
        body: JSON.stringify({ paymentMethod }),
      });
      const data = await res.json();
      if (data.success) {
        set({ currentOrder: data.order, ordersLoading: false });
        return { ok: true, order: data.order, clientSecret: data.clientSecret, paymentProvider: data.paymentProvider };
      }
      set({ ordersError: data.message, ordersLoading: false });
      return { ok: false, error: data.message };
    } catch (err) {
      set({ ordersError: err.message, ordersLoading: false });
      return { ok: false, error: err.message };
    }
  },

  confirmOrder: async (orderId) => {
    const token = getToken();
    try {
      const res = await fetch(apiUrl(`/api/marketplace/orders/${orderId}/confirm`), {
        method: "POST",
        headers: authHeaders(token),
      });
      const data = await res.json();
      if (data.success) {
        set({ currentOrder: data.order, cart: { items: [], total: 0 } });
        return { ok: true, order: data.order };
      }
      return { ok: false, error: data.message };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  },

  fetchOrders: async (page = 1) => {
    const token = getToken();
    if (!token) return;
    set({ ordersLoading: true });
    try {
      const res = await fetch(apiUrl(`/api/marketplace/orders?page=${page}`), {
        headers: authHeaders(token),
      });
      const data = await res.json();
      if (data.success) set({ orders: data.orders, ordersLoading: false });
      else set({ ordersLoading: false });
    } catch (err) {
      set({ ordersError: err.message, ordersLoading: false });
    }
  },

  fetchOrderDetail: async (orderId) => {
    const token = getToken();
    try {
      const res = await fetch(apiUrl(`/api/marketplace/orders/${orderId}`), {
        headers: authHeaders(token),
      });
      const data = await res.json();
      if (data.success) set({ currentOrder: data.order });
    } catch (err) {
      console.error("Fetch order detail error:", err);
    }
  },

  // ─── Reviews ───────────────────────────────────────────────
  reviews: [],
  reviewsDistribution: [],
  reviewsLoading: false,

  fetchReviews: async (productId, page = 1) => {
    set({ reviewsLoading: true });
    try {
      const res = await fetch(apiUrl(`/api/marketplace/reviews/${productId}?page=${page}`));
      const data = await res.json();
      if (data.success) {
        set({
          reviews: data.reviews,
          reviewsDistribution: data.distribution,
          reviewsLoading: false,
        });
      } else {
        set({ reviewsLoading: false });
      }
    } catch (err) {
      set({ reviewsLoading: false });
    }
  },

  submitReview: async ({ productId, rating, title, body }) => {
    const token = getToken();
    if (!token) return { ok: false, error: "Login required" };
    try {
      const res = await fetch(apiUrl("/api/marketplace/reviews"), {
        method: "POST",
        headers: authHeaders(token),
        body: JSON.stringify({ productId, rating, title, body }),
      });
      const data = await res.json();
      if (data.success) {
        // Refresh reviews
        get().fetchReviews(productId);
        return { ok: true, review: data.review };
      }
      return { ok: false, error: data.message };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  },

  // ─── Seller ────────────────────────────────────────────────
  sellerProducts: [],
  sellerStats: null,
  sellerOrders: [],
  sellerLoading: false,

  fetchSellerProducts: async (page = 1) => {
    const token = getToken();
    if (!token) return;
    set({ sellerLoading: true });
    try {
      const res = await fetch(apiUrl(`/api/marketplace/seller/products?page=${page}`), {
        headers: authHeaders(token),
      });
      const data = await res.json();
      if (data.success) set({ sellerProducts: data.products, sellerLoading: false });
      else set({ sellerLoading: false });
    } catch (err) {
      set({ sellerLoading: false });
    }
  },

  fetchSellerStats: async () => {
    const token = getToken();
    if (!token) return;
    try {
      const res = await fetch(apiUrl("/api/marketplace/seller/stats"), {
        headers: authHeaders(token),
      });
      const data = await res.json();
      if (data.success) set({ sellerStats: data.stats });
    } catch (err) {
      console.warn("Fetch seller stats error:", err);
    }
  },

  fetchSellerOrders: async (page = 1) => {
    const token = getToken();
    if (!token) return;
    try {
      const res = await fetch(apiUrl(`/api/marketplace/seller/orders?page=${page}`), {
        headers: authHeaders(token),
      });
      const data = await res.json();
      if (data.success) set({ sellerOrders: data.orders });
    } catch (err) {
      console.warn("Fetch seller orders error:", err);
    }
  },

  createProduct: async (formData) => {
    const token = getToken();
    if (!token) return { ok: false, error: "Login required" };
    try {
      const res = await fetch(apiUrl("/api/marketplace/seller/products"), {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }, // no Content-Type for FormData
        body: formData,
      });
      const data = await res.json();
      if (data.success) {
        get().fetchSellerProducts();
        return { ok: true, product: data.product };
      }
      return { ok: false, error: data.message };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  },

  updateProduct: async (id, formData) => {
    const token = getToken();
    try {
      const res = await fetch(apiUrl(`/api/marketplace/seller/products/${id}`), {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json();
      if (data.success) {
        get().fetchSellerProducts();
        return { ok: true, product: data.product };
      }
      return { ok: false, error: data.message };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  },

  deleteProduct: async (id) => {
    const token = getToken();
    try {
      const res = await fetch(apiUrl(`/api/marketplace/seller/products/${id}`), {
        method: "DELETE",
        headers: authHeaders(token),
      });
      const data = await res.json();
      if (data.success) get().fetchSellerProducts();
      return { ok: data.success };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  },

  // ─── Real-time ─────────────────────────────────────────────
  socketConnected: false,
  notifications: [],

  addNotification: (notification) =>
    set((s) => ({
      notifications: [
        { id: Date.now(), timestamp: new Date(), ...notification },
        ...s.notifications,
      ].slice(0, 50),
    })),

  clearNotifications: () => set({ notifications: [] }),
}));
