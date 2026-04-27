import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock fetch globally ──────────────────────────────────
const mockProducts = [
  {
    _id: "p1",
    title: "Cyber Dragon",
    slug: "cyber-dragon",
    price: 49.99,
    category: "characters",
    format: "glb",
    thumbnail: "",
    avgRating: 4.5,
    reviewCount: 12,
    polyCount: 75000,
    seller: { name: "ArtistX" },
    status: "active",
    featured: true,
    animated: false,
    textured: true,
    rigged: true,
    tags: ["dragon", "cyber"],
  },
];

const mockCart = {
  items: [
    { product: { _id: "p1", title: "Cyber Dragon", price: 49.99, thumbnail: "" }, quantity: 2, priceAtAdd: 49.99 },
  ],
};

function createFetchMock() {
  return vi.fn(async (url) => {
    const urlStr = typeof url === "string" ? url : url.toString();
    if (urlStr.includes("/products/categories")) {
      return { ok: true, json: async () => ({ success: true, categories: [{ _id: "characters", count: 5 }] }) };
    }
    if (urlStr.includes("/products")) {
      return { ok: true, json: async () => ({ success: true, products: mockProducts, totalCount: 1, totalPages: 1, page: 1 }) };
    }
    if (urlStr.includes("/cart")) {
      return { ok: true, json: async () => ({ success: true, cart: mockCart }) };
    }
    if (urlStr.includes("/orders")) {
      return { ok: true, json: async () => ({ success: true, orders: [], total: 0 }) };
    }
    if (urlStr.includes("/seller/stats")) {
      return { ok: true, json: async () => ({ success: true, stats: { totalProducts: 3, totalSold: 15, grossRevenue: 450, netRevenue: 405 } }) };
    }
    return { ok: true, json: async () => ({ success: true }) };
  });
}

// ─── MarketplaceStore Tests ──────────────────────────────
describe("MarketplaceStore", () => {
  let useMarketplaceStore;

  beforeEach(async () => {
    vi.resetModules();
    global.fetch = createFetchMock();
    // Mock localStorage
    const storage = {};
    vi.stubGlobal("localStorage", {
      getItem: vi.fn((k) => storage[k] || null),
      setItem: vi.fn((k, v) => { storage[k] = v; }),
      removeItem: vi.fn((k) => { delete storage[k]; }),
    });
    storage["objekta_token"] = "mock-jwt-token";

    const mod = await import("../store/MarketplaceStore");
    useMarketplaceStore = mod.useMarketplaceStore;
  });

  it("initializes with empty state", () => {
    const state = useMarketplaceStore.getState();
    expect(state.products).toEqual([]);
    expect(state.cart.items).toEqual([]);
    expect(state.orders).toEqual([]);
    expect(state.productsLoading).toBe(false);
  });

  it("fetchProducts populates products", async () => {
    const { fetchProducts } = useMarketplaceStore.getState();
    await fetchProducts();
    const state = useMarketplaceStore.getState();
    expect(state.products.length).toBe(1);
    expect(state.products[0].title).toBe("Cyber Dragon");
    expect(state.totalProducts).toBe(1);
  });

  it("fetchProducts sends correct query params", async () => {
    const { setFilters, fetchProducts } = useMarketplaceStore.getState();
    setFilters({ q: "dragon", category: "characters" });
    await fetchProducts(1);
    expect(global.fetch).toHaveBeenCalled();
    const callUrl = global.fetch.mock.calls.find((c) => c[0].includes("products"))?.[0];
    expect(callUrl).toContain("q=dragon");
    expect(callUrl).toContain("category=characters");
  });

  it("fetchCart populates cart items", async () => {
    const { fetchCart } = useMarketplaceStore.getState();
    await fetchCart();
    const state = useMarketplaceStore.getState();
    expect(state.cart.items.length).toBe(1);
    expect(state.cart.items[0].quantity).toBe(2);
  });

  it("addToCart calls API", async () => {
    global.fetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        items: [
          { product: { _id: "p1", title: "Cyber Dragon", price: 49.99, thumbnail: "" }, quantity: 1, priceAtAdd: 49.99 },
        ],
      }),
    }));
    const { addToCart } = useMarketplaceStore.getState();
    await addToCart("p1", 1);
    expect(global.fetch).toHaveBeenCalled();
  });

  it("addNotification appends and respects max", () => {
    const store = useMarketplaceStore.getState();
    for (let i = 0; i < 55; i++) {
      store.addNotification({ type: "info", message: `msg ${i}` });
    }
    const state = useMarketplaceStore.getState();
    expect(state.notifications.length).toBeLessThanOrEqual(50);
  });
});

// ─── Component Smoke Tests ───────────────────────────────
// These verify components at least import and export correctly

describe("Component exports", () => {
  it("StarRating exports a React component", async () => {
    const mod = await import("../components/marketplace/StarRating");
    expect(typeof mod.default).toBe("function");
  });

  it("ProductCard exports a React component", async () => {
    const mod = await import("../components/marketplace/ProductCard");
    expect(typeof mod.default).toBe("function");
  });

  it("Pagination exports a React component", async () => {
    const mod = await import("../components/marketplace/Pagination");
    expect(typeof mod.default).toBe("function");
  });

  it("SearchBar exports a React component", async () => {
    const mod = await import("../components/marketplace/SearchBar");
    expect(typeof mod.default).toBe("function");
  });

  it("ProductFilters exports a React component", async () => {
    const mod = await import("../components/marketplace/ProductFilters");
    expect(typeof mod.default).toBe("function");
  });

  it("CartSidebar exports a React component", async () => {
    const mod = await import("../components/marketplace/CartSidebar");
    expect(typeof mod.default).toBe("function");
  });

  it("CheckoutForm exports a React component", async () => {
    const mod = await import("../components/marketplace/CheckoutForm");
    expect(typeof mod.default).toBe("function");
  });

  it("OrderLiveStatus exports a React component", async () => {
    const mod = await import("../components/marketplace/OrderLiveStatus");
    expect(typeof mod.default).toBe("function");
  });

  it("ReviewSection exports a React component", async () => {
    const mod = await import("../components/marketplace/ReviewSection");
    expect(typeof mod.default).toBe("function");
  });

  it("Breadcrumbs exports a React component", async () => {
    const mod = await import("../components/marketplace/Breadcrumbs");
    expect(typeof mod.default).toBe("function");
  });
});

// ─── Page Smoke Tests ────────────────────────────────────
describe("Page exports", () => {
  it("MarketplacePage exports", async () => {
    const mod = await import("../pages/marketplace/MarketplacePage");
    expect(typeof mod.default).toBe("function");
  });

  it("ProductDetail exports", async () => {
    const mod = await import("../pages/marketplace/ProductDetail");
    expect(typeof mod.default).toBe("function");
  }, 15000);

  it("CartPage exports", async () => {
    const mod = await import("../pages/marketplace/CartPage");
    expect(typeof mod.default).toBe("function");
  });

  it("CheckoutPage exports", async () => {
    const mod = await import("../pages/marketplace/CheckoutPage");
    expect(typeof mod.default).toBe("function");
  });

  it("OrderHistory exports", async () => {
    const mod = await import("../pages/marketplace/OrderHistory");
    expect(typeof mod.default).toBe("function");
  });

  it("OrderTracking exports", async () => {
    const mod = await import("../pages/marketplace/OrderTracking");
    expect(typeof mod.default).toBe("function");
  });

  it("SellerDashboard exports", async () => {
    const mod = await import("../pages/marketplace/SellerDashboard");
    expect(typeof mod.default).toBe("function");
  });
});
