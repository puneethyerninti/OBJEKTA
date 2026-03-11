# Objekta Marketplace

A real-time e-commerce marketplace for buying and selling 3D models, built into the Objekta platform.

---

## Features

- **Product Catalog** — Browse, search, filter 3D models by category, format, price, and more
- **Product Detail** — View specs (polycount, file size, textures, rigging), images, reviews
- **Shopping Cart** — Add/remove items, quantity management, sidebar + full-page views
- **Checkout** — Mock payment (instant dev testing) + Stripe test-mode support
- **Order Management** — Order history, per-order tracking with real-time status updates
- **Real-time Updates** — Socket.IO live order status (pending → confirmed → processing → delivered)
- **Reviews & Ratings** — Star ratings, distribution bars, verified purchase badges
- **Seller Dashboard** — Product management (create/edit/delete), stats (revenue/sold), order view
- **10% Platform Fee** — Automatic fee calculation on every order

---

## Architecture

```
Frontend (React 18 + Zustand + Tailwind CSS)
  ├── /marketplace          → Browse & search products
  ├── /marketplace/product/:id → Product detail + reviews
  ├── /marketplace/cart     → Shopping cart
  ├── /marketplace/checkout → Payment & order creation
  ├── /marketplace/orders   → Order history
  ├── /marketplace/orders/:id → Order tracking (live status)
  └── /marketplace/seller   → Seller dashboard

Backend (Express + MongoDB/Mongoose + Socket.IO)
  └── /api/marketplace/
      ├── products   → CRUD + search/filter
      ├── cart       → Per-user cart management
      ├── orders     → Create, confirm, list, track
      ├── payments   → Mock gateway + Stripe adapter
      ├── reviews    → CRUD with rating aggregation
      └── seller     → Seller product/order management
```

---

## Quick Start

### Prerequisites
- Node.js 20+
- MongoDB (local or Atlas)

### 1. Install dependencies
```bash
# Root (frontend)
npm install

# Backend
cd backend && npm install
```

### 2. Configure environment
```bash
cp .env.example .env
# Edit .env — set MONGO_URI, JWT_SECRET at minimum
```

### 3. Seed sample products
```bash
node backend/scripts/seed-marketplace.js
```

### 4. Run development servers
```bash
# Terminal 1 — Backend
cd backend && node server.js

# Terminal 2 — Frontend
npm run dev
```

### 5. Open the marketplace
Navigate to `http://localhost:5173/marketplace`

---

## Docker

```bash
docker-compose up --build
```

This starts:
- **MongoDB** on port 27017
- **Backend** on port 5000
- **Frontend dev server** on port 5173

---

## Payment Modes

| Mode | Env Var | Description |
|------|---------|-------------|
| **Mock** | `PAYMENT_PROVIDER=mock` | Instant dev testing, simulated 200-300ms delay, 5% random failure |
| **Stripe Test** | `PAYMENT_PROVIDER=stripe` | Stripe test-mode with `sk_test_` keys, real UI, no real charges |

### Switch to Stripe test-mode:
```env
PAYMENT_PROVIDER=stripe
STRIPE_SECRET_KEY=sk_test_your_key_here
STRIPE_WEBHOOK_SECRET=whsec_your_secret_here
```

---

## API Endpoints

### Products (Public)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/marketplace/products` | List/search products (query params: `q`, `category`, `minPrice`, `maxPrice`, `format`, `sort`, `page`, `limit`, `featured`, `seller`) |
| GET | `/api/marketplace/products/categories` | Category counts |
| GET | `/api/marketplace/products/:idOrSlug` | Product detail |

### Cart (Auth required)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/marketplace/cart` | Get user cart |
| POST | `/api/marketplace/cart/add` | Add item `{ productId, quantity }` |
| PUT | `/api/marketplace/cart/update` | Update quantity `{ productId, quantity }` |
| DELETE | `/api/marketplace/cart/remove/:productId` | Remove item |
| DELETE | `/api/marketplace/cart` | Clear cart |

### Orders (Auth required)
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/marketplace/orders` | Create order from cart `{ paymentMethod }` |
| POST | `/api/marketplace/orders/:id/confirm` | Confirm payment `{ paymentIntentId }` |
| GET | `/api/marketplace/orders` | List user orders |
| GET | `/api/marketplace/orders/:id` | Order detail |

### Payments
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/marketplace/payments/provider` | Current payment provider |
| POST | `/api/marketplace/payments/create-intent` | Create payment intent |
| POST | `/api/marketplace/payments/refund` | Refund a payment |
| POST | `/api/marketplace/payments/webhook` | Stripe webhook endpoint |

### Reviews
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/marketplace/reviews/:productId` | List reviews + distribution |
| POST | `/api/marketplace/reviews` | Create review (auth) |
| DELETE | `/api/marketplace/reviews/:id` | Delete own review (auth) |

### Seller (Auth required)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/marketplace/seller/products` | List seller's products |
| GET | `/api/marketplace/seller/stats` | Dashboard stats |
| GET | `/api/marketplace/seller/orders` | Orders for seller products |
| POST | `/api/marketplace/seller/products` | Create product (multipart) |
| PUT | `/api/marketplace/seller/products/:id` | Update product |
| DELETE | `/api/marketplace/seller/products/:id` | Soft-delete product |

---

## Socket.IO Events

| Event | Direction | Payload |
|-------|-----------|---------|
| `marketplace:join-seller` | Client → Server | `{ sellerId }` |
| `marketplace:leave-seller` | Client → Server | `{ sellerId }` |
| `marketplace:track-order` | Client → Server | `{ orderId }` |
| `marketplace:untrack-order` | Client → Server | `{ orderId }` |
| `order:created` | Server → Client | `{ order, buyerId }` |
| `order:status:update` | Server → Client | `{ orderId, status, order }` |
| `inventory:update` | Server → Client | `{ productId, sold, stock }` |

---

## Tests

### Frontend (vitest)
```bash
npx vitest run src/__tests__/marketplace.test.js
```

### Backend (jest + mongodb-memory-server)
```bash
cd backend
npm install --save-dev jest mongodb-memory-server supertest
npx jest tests/marketplace.test.js --forceExit
```

---

## File Structure

```
backend/
  models/          Product.js, Cart.js, Order.js, Review.js
  routes/marketplace/   index.js, products.js, cart.js, orders.js,
                        payments.js, reviews.js, seller.js
  services/        paymentService.js
  socket/          marketplace.js
  scripts/         seed-marketplace.js
  tests/           marketplace.test.js

src/
  store/           MarketplaceStore.js
  styles/          marketplace.css
  components/marketplace/
    StarRating, Breadcrumbs, Pagination, SearchBar,
    ProductFilters, ProductCard, CartSidebar,
    CheckoutForm, OrderLiveStatus, ReviewSection
  pages/marketplace/
    MarketplacePage, ProductDetail, CartPage,
    CheckoutPage, OrderHistory, OrderTracking,
    SellerDashboard
  __tests__/       marketplace.test.js
```

---

## Key Design Decisions

1. **MongoDB** — Uses existing Mongoose/MongoDB stack (not SQLite) to avoid dual-DB complexity and enable cross-collection references with existing User model
2. **Mock payments** — Default for zero-cost development; Stripe test-mode available via env toggle
3. **10% platform fee** — Calculated server-side in `paymentService.calcPlatformFee()`
4. **Soft deletes** — Seller product deletion sets `status: "removed"` rather than hard delete
5. **Zustand store** — Matches existing app state management pattern
6. **Glass UI** — Marketplace CSS follows the app's cyberpunk dark glass design language
