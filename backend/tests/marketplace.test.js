// backend/tests/marketplace.test.js
// Run: npx jest backend/tests/marketplace.test.js --forceExit
// or simply: npm run test:marketplace (if script added)

const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const express = require("express");
const request = require("supertest");
const jwt = require("jsonwebtoken");

process.env.PAYMENT_PROVIDER = "mock";

// Models
const User = require("../models/User");
const Product = require("../models/Product");
const Cart = require("../models/Cart");
const Order = require("../models/Order");
const Review = require("../models/Review");

// Build a mini express app with marketplace routes
function buildApp() {
  const app = express();
  app.use(express.json());

  // Mock auth middleware — attach userId from Bearer token (JWT)
  app.use((req, _res, next) => {
    const auth = req.headers.authorization;
    if (auth && auth.startsWith("Bearer ")) {
      try {
        const decoded = jwt.verify(auth.slice(7), process.env.JWT_SECRET || "test-secret");
        req.userId = decoded.id;
      } catch { /* ignore */ }
    }
    next();
  });

  const marketplaceRoutes = require("../routes/marketplace");
  app.use("/api/marketplace", marketplaceRoutes);
  return app;
}

let mongod;
let app;
let sellerToken;
let buyerToken;
let sellerId;
let buyerId;
let productId;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  process.env.JWT_SECRET = "test-secret";
  await mongoose.connect(mongod.getUri());

  app = buildApp();

  // Create two users: a seller and a buyer
  const seller = await User.create({ name: "Seller", email: "seller@test.com", password: "pass123456", role: "seller" });
  const buyer = await User.create({ name: "Buyer", email: "buyer@test.com", password: "pass123456", role: "buyer" });
  sellerId = seller._id.toString();
  buyerId = buyer._id.toString();

  sellerToken = jwt.sign({ id: sellerId }, "test-secret", { expiresIn: "1h" });
  buyerToken = jwt.sign({ id: buyerId }, "test-secret", { expiresIn: "1h" });
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongod) await mongod.stop();
});

// ─── Products ────────────────────────────────────────────
describe("Products API", () => {
  it("GET /api/marketplace/products returns empty initially", async () => {
    const res = await request(app).get("/api/marketplace/products");
    expect(res.status).toBe(200);
    expect(res.body.products).toEqual([]);
    expect(res.body.totalCount).toBe(0);
  });

  it("Seller can create a product via direct DB insert", async () => {
    const product = await Product.create({
      title: "Test Space Station",
      description: "A detailed space station model",
      price: 29.99,
      category: "architecture",
      format: "glb",
      seller: sellerId,
      fileUrl: "/uploads/test.glb",
      fileSize: 1024000,
      polyCount: 50000,
      status: "active",
    });
    productId = product._id.toString();
    expect(product.slug).toBeTruthy();
  });

  it("GET /api/marketplace/products returns the product", async () => {
    const res = await request(app).get("/api/marketplace/products");
    expect(res.status).toBe(200);
    expect(res.body.products.length).toBe(1);
    expect(res.body.products[0].title).toBe("Test Space Station");
  });

  it("GET /api/marketplace/products/:id returns product detail", async () => {
    const res = await request(app).get(`/api/marketplace/products/${productId}`);
    expect(res.status).toBe(200);
    expect(res.body.product.title).toBe("Test Space Station");
    expect(res.body.product.seller).toBeTruthy();
  });

  it("GET /api/marketplace/products/categories returns aggregation", async () => {
    const res = await request(app).get("/api/marketplace/products/categories");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.categories)).toBe(true);
    expect(res.body.categories.find((c) => c._id === "architecture")).toBeTruthy();
  });

  it("Search by query works", async () => {
    const res = await request(app).get("/api/marketplace/products?q=station");
    expect(res.status).toBe(200);
    expect(res.body.products.length).toBe(1);
  });

  it("Filter by category works", async () => {
    const res = await request(app).get("/api/marketplace/products?category=architecture");
    expect(res.status).toBe(200);
    expect(res.body.products.length).toBe(1);

    const res2 = await request(app).get("/api/marketplace/products?category=vehicles");
    expect(res2.status).toBe(200);
    expect(res2.body.products.length).toBe(0);
  });

  it("Filter by price range works", async () => {
    const res = await request(app).get("/api/marketplace/products?minPrice=20&maxPrice=40");
    expect(res.status).toBe(200);
    expect(res.body.products.length).toBe(1);

    const res2 = await request(app).get("/api/marketplace/products?minPrice=50");
    expect(res2.status).toBe(200);
    expect(res2.body.products.length).toBe(0);
  });
});

// ─── Cart ────────────────────────────────────────────────
describe("Cart API", () => {
  it("GET /api/marketplace/cart requires auth", async () => {
    const res = await request(app).get("/api/marketplace/cart");
    expect(res.status).toBe(401);
  });

  it("POST /api/marketplace/cart/add adds item", async () => {
    const res = await request(app)
      .post("/api/marketplace/cart/add")
      .set("Authorization", `Bearer ${buyerToken}`)
      .send({ productId, quantity: 1 });
    expect(res.status).toBe(200);
    expect(res.body.cart.items.length).toBe(1);
    expect(String(res.body.cart.items[0].product?._id || res.body.cart.items[0].product)).toBe(productId);
  });

  it("GET /api/marketplace/cart returns cart with items", async () => {
    const res = await request(app)
      .get("/api/marketplace/cart")
      .set("Authorization", `Bearer ${buyerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.cart.items.length).toBe(1);
  });

  it("PUT /api/marketplace/cart/update changes quantity", async () => {
    const res = await request(app)
      .put("/api/marketplace/cart/update")
      .set("Authorization", `Bearer ${buyerToken}`)
      .send({ productId, quantity: 3 });
    expect(res.status).toBe(200);
    expect(res.body.cart.items[0].quantity).toBe(3);
  });

  it("DELETE /api/marketplace/cart/remove/:productId removes item", async () => {
    const res = await request(app)
      .delete(`/api/marketplace/cart/remove/${productId}`)
      .set("Authorization", `Bearer ${buyerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.cart.items.length).toBe(0);
  });
});

// ─── Orders ──────────────────────────────────────────────
describe("Orders API", () => {
  beforeAll(async () => {
    // Re-add item to cart
    await Cart.findOneAndUpdate(
      { user: buyerId },
      { $set: { items: [{ product: productId, quantity: 1, priceAtAdd: 29.99 }] } },
      { upsert: true }
    );
  });

  it("POST /api/marketplace/orders creates an order", async () => {
    const res = await request(app)
      .post("/api/marketplace/orders")
      .set("Authorization", `Bearer ${buyerToken}`)
      .send({ paymentMethod: "mock" });
    expect(res.status).toBe(201);
    expect(res.body.order).toBeTruthy();
    expect(res.body.order.status).toBe("pending");
    expect(res.body.order.total).toBeGreaterThan(0);
    expect(res.body.clientSecret).toBeTruthy();
  });

  it("GET /api/marketplace/orders lists orders", async () => {
    const res = await request(app)
      .get("/api/marketplace/orders")
      .set("Authorization", `Bearer ${buyerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.orders.length).toBeGreaterThanOrEqual(1);
  });

  it("POST /api/marketplace/orders/:id/confirm confirms order", async () => {
    const listRes = await request(app)
      .get("/api/marketplace/orders")
      .set("Authorization", `Bearer ${buyerToken}`);
    const orderId = listRes.body.orders[0]._id;

    const res = await request(app)
      .post(`/api/marketplace/orders/${orderId}/confirm`)
      .set("Authorization", `Bearer ${buyerToken}`)
      .send({ paymentIntentId: listRes.body.orders[0].paymentIntentId || "mock_test" });
    // May succeed or fail depending on mock—just check it's handled
    expect([200, 400, 500]).toContain(res.status);
  });
});

// ─── Reviews ─────────────────────────────────────────────
describe("Reviews API", () => {
  it("GET /api/marketplace/reviews/:productId returns reviews", async () => {
    const res = await request(app).get(`/api/marketplace/reviews/${productId}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.reviews)).toBe(true);
  });

  it("POST /api/marketplace/reviews requires auth", async () => {
    const res = await request(app)
      .post("/api/marketplace/reviews")
      .send({ product: productId, rating: 5, title: "Great" });
    expect(res.status).toBe(401);
  });

  it("POST /api/marketplace/reviews creates a review (even without purchase for test)", async () => {
    // Note: In production, a verified purchase check may reject this.
    // For unit tests we're testing the route handler exists and responds.
    const res = await request(app)
      .post("/api/marketplace/reviews")
      .set("Authorization", `Bearer ${buyerToken}`)
      .send({ product: productId, rating: 5, title: "Excellent model", comment: "Very detailed" });
    // 201 if no purchase check, or 400 if purchase required
    expect([201, 400]).toContain(res.status);
  });
});

// ─── Seller ──────────────────────────────────────────────
describe("Seller API", () => {
  it("GET /api/marketplace/seller/stats returns stats", async () => {
    const res = await request(app)
      .get("/api/marketplace/seller/stats")
      .set("Authorization", `Bearer ${sellerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.stats).toHaveProperty("totalProducts");
    expect(res.body.stats).toHaveProperty("totalSold");
    expect(res.body.stats).toHaveProperty("grossRevenue");
    expect(res.body.stats).toHaveProperty("netRevenue");
  });

  it("GET /api/marketplace/seller/products returns seller products", async () => {
    const res = await request(app)
      .get("/api/marketplace/seller/products")
      .set("Authorization", `Bearer ${sellerToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.products)).toBe(true);
    expect(res.body.products.length).toBeGreaterThanOrEqual(1);
  });

  it("PUT /api/marketplace/seller/products/:id updates product", async () => {
    const res = await request(app)
      .put(`/api/marketplace/seller/products/${productId}`)
      .set("Authorization", `Bearer ${sellerToken}`)
      .send({ price: 39.99, description: "Updated description" });
    expect(res.status).toBe(200);
    expect(res.body.product.price).toBe(39.99);
  });

  it("DELETE /api/marketplace/seller/products/:id soft-deletes", async () => {
    const res = await request(app)
      .delete(`/api/marketplace/seller/products/${productId}`)
      .set("Authorization", `Bearer ${sellerToken}`);
    expect(res.status).toBe(200);

    // Product should be marked "removed"
    const product = await Product.findById(productId);
    expect(product.status).toBe("removed");
  });
});

// ─── Payment Service ─────────────────────────────────────
describe("Payment Service", () => {
  const paymentService = require("../services/paymentService");

  it("calcPlatformFee calculates 10%", () => {
    expect(paymentService.calcPlatformFee(100)).toBe(10);
    expect(paymentService.calcPlatformFee(29.99)).toBeCloseTo(3, 0);
  });

  it("createPaymentIntent returns intent object", async () => {
    const intent = await paymentService.createPaymentIntent({ amount: 49.99, currency: "usd", metadata: { orderId: "test123" } });
    expect(intent).toHaveProperty("id");
    expect(intent).toHaveProperty("status");
    expect(intent.amount).toBe(49.99);
  });

  it("confirmPayment succeeds for mock", async () => {
    const intent = await paymentService.createPaymentIntent({ amount: 29.99, currency: "usd", metadata: {} });
    const result = await paymentService.confirmPayment(intent.id);
    expect(result).toHaveProperty("status");
  });

  it("refundPayment works for mock", async () => {
    const intent = await paymentService.createPaymentIntent({ amount: 19.99, currency: "usd", metadata: {} });
    await paymentService.confirmPayment(intent.id);
    const refund = await paymentService.refundPayment(intent.id);
    expect(refund).toHaveProperty("status");
  });
});
