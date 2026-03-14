# OBJEKTA

**A browser-based collaborative 3D scene editor, design studio, and asset marketplace.**

OBJEKTA lets you build, animate, sculpt, and collaborate on 3D scenes entirely in the browser. It ships with a full PBR material system, WASM-powered physics, AI-assisted editing, real-time multi-user collaboration via CRDT, and an integrated marketplace for buying and selling 3D assets.

**Production URL:** [https://objekta.app](https://objekta.app)

---

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Repository Layout](#repository-layout)
- [Prerequisites](#prerequisites)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Docker](#docker)
- [Testing](#testing)
- [CI/CD](#cicd)
- [Deployment](#deployment)
- [Architecture](#architecture)
- [API Documentation](#api-documentation)
- [Contributing](#contributing)
- [License](#license)

---

## Features

### 3D Scene Editor (Studio)
- **Viewport:** WebGL 2 renderer with PBR shading, adaptive resolution, wireframe mode, and camera bookmarks.
- **Primitives & Lights:** Drag-and-drop palette with shapes (cube, sphere, cone, plane, cylinder, torus), lights (point, spot, directional, area), helpers, and cameras.
- **Transform Controls:** Translate, rotate, and scale with grid snapping, angle snapping, surface snapping, and axis constraints.
- **Sculpting:** 8 brush modes (Inflate, Deflate, Smooth, Flatten, Pinch, Grab, Clay, Crease) with configurable radius, strength, and XYZ symmetry.
- **Material Editor:** Full PBR properties (color, roughness, metalness, opacity, emissive, wireframe) with six texture map slots (base color, normal, roughness, metalness, emissive, AO).
- **Material Library:** 9 categories (Metals, Woods, Stones, Plastics, Glass, Fabrics, Organic, Emissive, Special) with dozens of presets.
- **Procedural Generation:** Parametric stairs, walls, floors, terrain, scatter patterns, and grids.
- **Animation Engine:** Track-based keyframe animation with 15+ easing functions, cubic bezier support, pingpong/loop modes, and playback rate control.
- **Physics Simulation:** Rapier 3D (WASM) with dynamic/static/kinematic bodies, 6 collider types, 5 joint types, gravity presets (Earth, Moon, Mars, Zero-G, Water, Jupiter), trigger volumes, ragdolls, and bake-to-keyframes.
- **Post-Processing:** Bloom, custom GLSL shaders (hologram, grid, blob, planet, atmosphere), ocean shader, rain particles.
- **Import/Export:** GLB/glTF 2.0 with DRACO compression, KTX2 textures, and meshopt decoder. Drag-and-drop file import.
- **Scene Optimization:** Duplicate detection, material deduplication, geometry merging, texture analysis, LOD generation (4 tiers), and mesh decimation.
- **Undo/Redo:** Command-based history with full state tracking.

### Real-Time Collaboration
- **CRDT Sync:** Yjs documents over WebSocket for conflict-free collaborative editing of scene objects, environment settings, and project metadata.
- **Live Presence:** Cursor positions, user avatars, and selection highlights for all connected users.
- **Object Locking:** Prevents concurrent edits on the same object.
- **Project Rooms:** Socket.IO rooms for scoped real-time events and scene patch broadcasting.

### AI Assistant
- **Multi-Provider LLM:** Groq (Llama 3.3 70B), Google Gemini (2.0 Flash), OpenAI (GPT-4o Mini), and Anthropic (Claude Sonnet) with automatic fallback.
- **Python FastAPI Micro-Service:** Task-specific prompt engineering with structured response validation.
- **Capabilities:** Free-form chat about your scene, scene description, PBR material suggestions, object naming, and optimization analysis.
- **Browser-Side ML:** Hugging Face Transformers in a Web Worker for local inference.

### 3D Asset Marketplace
- **Catalog:** Product listings with search (full-text), filters (category, price range, format, featured), sorting, and pagination.
- **Seller Dashboard:** Product management, sales stats, gross/net revenue, and order tracking.
- **Shopping Cart & Checkout:** Stripe payment integration with a 10% platform fee.
- **Signed Downloads:** HMAC-SHA256 signed URLs with expiry, download count limits, and license tracking.
- **Reviews & Ratings:** Verified purchase reviews with rating distribution.
- **Real-Time Events:** Live order notifications and inventory updates via Socket.IO.

### Authentication & Security
- **JWT Auth:** Short-lived access tokens (15 min) with rotating refresh tokens (7 day, SHA-256 hashed).
- **Google OAuth:** Server-side `id_token` verification with auto-registration.
- **Two-Factor Authentication:** TOTP-based 2FA with QR code setup and 8 backup codes.
- **Email Verification & Password Reset:** Token-based flows with expiry.
- **Role-Based Access Control:** Buyer, seller, and admin roles with project-level editor/viewer permissions.
- **Security Hardening:** Helmet headers, rate limiting (300 req/15min API, 120 req/15min uploads), CORS, request IDs, bcrypt password hashing.

### Project Management
- **Dashboard:** Create, rename, delete, and browse projects with grid view.
- **Version History:** Automatic versioning on every save with JSON diffs (RFC 6902), periodic full snapshots, version diffing, and point-in-time restore.
- **Autosave:** IndexedDB client-side backup with server-side persistence.
- **Tiered Storage:** Inline MongoDB (< 12 MB), compressed disk storage, or AWS S3 with CloudFront.
- **Resumable Uploads:** TUS protocol for large files, S3 presigned URLs for direct-to-cloud, and multipart uploads up to 5 GB.

### Admin Panel
- User management with role assignment, account suspension, search/filter, and platform-wide statistics.

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 18, React Router 7, Vite 4, Tailwind CSS 4, Framer Motion 12 |
| **3D Rendering** | Three.js 0.152.2, @react-three/fiber 8, @react-three/drei 9, @react-three/postprocessing 2 |
| **Physics** | Rapier 3D (@dimforge/rapier3d-compat) — WASM |
| **Collaboration** | Yjs 13 (CRDT) + WebSocket, Socket.IO 4 |
| **State Management** | Zustand 5, custom observable stores, React Context |
| **Drag & Drop** | react-dnd 16 (HTML5 backend) |
| **Backend** | Node.js 20, Express 4, Mongoose 7 |
| **Database** | MongoDB 7 |
| **AI Service** | Python FastAPI, multi-provider LLM (Groq, Gemini, OpenAI, Anthropic) |
| **Browser ML** | @huggingface/transformers 3 (Web Worker) |
| **Payments** | Stripe 20 (with mock provider for dev) |
| **File Storage** | AWS S3, TUS resumable uploads, local multer |
| **Auth** | JWT, Google OAuth, TOTP 2FA (otpauth) |
| **API Docs** | Swagger/OpenAPI 3.0.3 (57 documented endpoints) |
| **Testing** | Vitest (unit), Playwright (E2E), Jest (backend) |
| **CI/CD** | GitHub Actions (4 parallel jobs) |
| **Deployment** | Docker, Render.com, Vercel |
| **Compression** | pako (deflate for scene data) |
| **Custom Shaders** | GLSL (hologram, grid, blob, planet, starfield, atmosphere) |

---

## Repository Layout

```
objekta/
├── src/                          # Frontend source
│   ├── pages/                    # Route-level pages (Home, Studio, Dashboard, Admin, Auth, Marketplace)
│   ├── components/               # UI components (Workspace, Palette, Outliner, MaterialEditor, SculptToolbar, ...)
│   │   ├── Background/           # Animated backgrounds (Galaxy, Tunnel, Blob, Space, NeonGrid)
│   │   ├── marketplace/          # Marketplace UI (ProductCard, CartSidebar, CheckoutForm, ...)
│   │   └── workspace/            # History manager, camera utils, scene serializer
│   ├── engine/                   # Core 3D engine modules (no React dependencies)
│   │   ├── AnimationEngine.js    #   Keyframe animation system
│   │   ├── PhysicsManager.js     #   Rapier 3D wrapper
│   │   ├── MaterialLibrary.js    #   PBR material presets
│   │   ├── ProceduralGenerator.js#   Parametric mesh generation
│   │   ├── SceneOptimizer.js     #   Mesh decimation, LOD, deduplication
│   │   ├── PostFXManager.js      #   Post-processing effects
│   │   ├── SnapManager.js        #   Grid/angle/surface snapping
│   │   └── ...                   #   (15+ engine modules)
│   ├── collaboration/            # Yjs CRDT provider, hooks, cursor/presence components
│   ├── store/                    # Zustand stores (AI, Marketplace, SceneGraph, Texture)
│   ├── services/                 # API clients (aiService)
│   ├── contexts/                 # React contexts (AuthContext)
│   ├── hooks/                    # Custom hooks (usePhysics, useCollaboration, useHackerText)
│   ├── shaders/                  # GLSL shader source files
│   ├── workers/                  # Web Workers (AI inference, scene compression)
│   ├── styles/                   # CSS modules per component
│   ├── utils/                    # Shared utilities (API, upload, EventBus, storage, ...)
│   ├── __tests__/                # 21 unit test files
│   ├── App.jsx                   # Router and layout
│   ├── main.jsx                  # React entry point
│   └── index.css                 # Tailwind + global design system
├── backend/                      # Backend source
│   ├── server.js                 # Express app entry point
│   ├── config/                   # DB connection, Swagger spec, env validation
│   ├── controllers/              # Auth controller
│   ├── middleware/                # JWT auth, project permissions
│   ├── models/                   # Mongoose models (User, Project, Scene, Product, Order, Cart, Review, Version)
│   ├── routes/                   # API route handlers
│   │   ├── auth.js               #   Authentication (register, login, OAuth, 2FA, admin)
│   │   ├── projects.js           #   Project CRUD + assets
│   │   ├── scenes.js             #   Scene save/load
│   │   ├── uploads.js            #   S3 presigned + multipart + TUS
│   │   ├── ai.js                 #   AI chat, describe, suggest, optimize
│   │   ├── versions.js           #   Version history, diff, restore
│   │   ├── collaborators.js      #   Collaborator listing
│   │   ├── activity.js           #   Activity feed
│   │   └── marketplace/          #   Products, cart, orders, payments, reviews, seller, downloads
│   ├── services/                 # AI providers, email, payments, versioning
│   ├── socket.js                 # Socket.IO server (presence, project sync)
│   ├── socket/                   # Marketplace real-time events
│   ├── yjs/                      # Yjs CRDT WebSocket server
│   ├── utils/                    # Scene storage (inline/disk/S3)
│   ├── scripts/                  # Seed scripts (marketplace)
│   ├── tests/                    # Backend tests (Jest)
│   ├── uploads/                  # Local file storage
│   ├── ai_service/               # Python FastAPI AI micro-service
│   │   ├── main.py               #   Endpoints: chat, describe, suggest-material, optimize, suggest-names
│   │   └── requirements.txt      #   fastapi, uvicorn, httpx, pydantic
│   └── package.json
├── public/                       # Static assets (models, icons, posters)
├── tests/                        # E2E tests (Playwright)
├── docs/                         # User guide (450 lines)
├── .github/workflows/ci.yml     # CI pipeline
├── Dockerfile                    # Multi-stage build (frontend + backend)
├── docker-compose.yml            # Dev: MongoDB + Backend + Frontend
├── docker-compose.staging.yml    # Staging: MongoDB + Backend (serves static frontend)
├── render.yaml                   # Render.com deployment blueprint
├── vercel.json                   # Vercel SPA config
├── vite.config.js                # Vite config with chunk splitting
├── tailwind.config.js            # Tailwind config
├── playwright.config.js          # E2E test config
├── vitest.config.js              # Unit test config
└── package.json                  # Frontend dependencies and scripts
```

---

## Prerequisites

- **Node.js** 20+
- **MongoDB** 7+ (local or Atlas)
- **Python** 3.10+ (only if running the AI micro-service)
- **npm** 9+

Optional:
- **Docker** & **Docker Compose** (for containerized development)
- **AWS S3** credentials (for cloud file storage)
- **Stripe** keys (for marketplace payments)

---

## Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/puneethyerninti/OBJEKTA.git
cd OBJEKTA
```

### 2. Configure environment variables

```bash
# Root (frontend)
cp .env.example .env

# Backend
cp backend/.env.example backend/.env
```

Edit both `.env` files with your values (see [Environment Variables](#environment-variables)).

### 3. Install dependencies and start

```bash
# Terminal 1 — Frontend
npm install
npm run dev
# → http://localhost:5173

# Terminal 2 — Backend
cd backend
npm install
npm run dev
# → http://localhost:5000
```

### 4. (Optional) Start the AI micro-service

```bash
cd backend/ai_service
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8100
```

### 5. Open in browser

Navigate to `http://localhost:5173`. The Vite dev server proxies `/api` and `/socket.io` to the backend automatically.

---

## Environment Variables

### Frontend (`.env` at project root)

| Variable | Description | Example |
|---|---|---|
| `VITE_API_BASE` | Backend API URL | `http://localhost:5000` |
| `VITE_GOOGLE_CLIENT_ID` | Google OAuth client ID | `123456.apps.googleusercontent.com` |
| `VITE_ASSET_BASE` | CDN / S3 base URL for assets | `https://cdn.objekta.app` |
| `VITE_STRIPE_PUBLISHABLE_KEY` | Stripe publishable key | `pk_test_...` |

### Backend (`backend/.env`)

| Variable | Description | Default |
|---|---|---|
| `PORT` | Server port | `5000` |
| `NODE_ENV` | Environment | `development` |
| `MONGO_URI` | MongoDB connection string | `mongodb://localhost:27017/objekta` |
| `JWT_SECRET` | JWT signing secret | *(required)* |
| `JWT_EXPIRES_IN` | Long-lived token expiry | `7d` |
| `FRONTEND_ORIGIN` | Allowed CORS origins (comma-separated) | `http://localhost:5173` |
| **AWS S3** | | |
| `AWS_REGION` | AWS region | `ap-south-1` |
| `AWS_ACCESS_KEY_ID` | AWS access key | |
| `AWS_SECRET_ACCESS_KEY` | AWS secret key | |
| `S3_BUCKET` | S3 bucket name | |
| `S3_PUBLIC_BASE` | CloudFront / public URL base | |
| **AI** | | |
| `GROQ_API_KEY` | Groq API key (free tier) | |
| `GEMINI_API_KEY` | Google Gemini API key | |
| `OPENAI_API_KEY` | OpenAI API key | |
| `ANTHROPIC_API_KEY` | Anthropic API key | |
| `AI_PROVIDER` | Force a specific provider | *(auto-detect)* |
| `AI_MODEL` | Override default model | *(provider default)* |
| `AI_SERVICE_URL` | Python AI service URL | `http://127.0.0.1:8100` |
| **Payments** | | |
| `PAYMENT_PROVIDER` | `stripe` or `mock` | `stripe` |
| `STRIPE_SECRET_KEY` | Stripe secret key | |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret | |
| `PLATFORM_FEE_PERCENT` | Marketplace platform fee | `10` |
| **Email** | | |
| `EMAIL_PROVIDER` | `console` or `smtp` | `console` |
| `SMTP_HOST` | SMTP server host | |
| `SMTP_PORT` | SMTP server port | `587` |
| `SMTP_USER` | SMTP username | |
| `SMTP_PASS` | SMTP password | |
| `SMTP_FROM` | From email address | |
| **Security** | | |
| `RATE_LIMIT_MAX` | API rate limit (per 15 min) | `300` |
| `UPLOAD_RATE_LIMIT_MAX` | Upload rate limit (per 15 min) | `120` |
| `DOWNLOAD_SECRET` | HMAC secret for download tokens | |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID | |

---

## Docker

### Development

```bash
docker-compose up
```

Starts three services:
- **mongo** — MongoDB 7 on port 27017
- **backend** — Express API on port 5000
- **frontend** — Vite dev server on port 5173

### Staging / Production-like

```bash
docker-compose -f docker-compose.staging.yml up
```

Builds the frontend into static files and serves them from the Express backend (single service + MongoDB).

### Standalone image

```bash
docker build -t objekta .
docker run -p 5000:5000 --env-file backend/.env objekta
```

The multi-stage Dockerfile builds the frontend (Node 20 Alpine) and serves everything via the backend.

---

## Testing

### Unit Tests (Frontend)

```bash
npm test              # Watch mode
npm run test:run      # Single run
```

Uses Vitest with 21 test files covering components, stores, and utilities.

### Backend Tests

```bash
cd backend
npm test
```

Uses Jest with `mongodb-memory-server` for isolated database testing. Covers marketplace flows and scene storage.

### End-to-End Tests

```bash
npx playwright install --with-deps chromium
npx playwright test
```

Playwright tests covering authentication, collaboration, marketplace, project management, and the studio editor. Automatically starts both frontend and backend.

### Marketplace-specific Tests

```bash
npm run test:marketplace        # Frontend
cd backend && npm run test:marketplace  # Backend
```

---

## CI/CD

GitHub Actions (`.github/workflows/ci.yml`) runs on pushes to `main`/`develop` and on pull requests:

| Job | Steps |
|---|---|
| **frontend** | `npm ci` → `lint` → `vitest` → `build` |
| **backend** | `npm ci` → `jest` (marketplace + scene storage tests) |
| **docker** | Builds Docker image (depends on frontend + backend passing) |
| **e2e** | Starts MongoDB service → installs Playwright → runs E2E suite |

Failed E2E runs upload Playwright reports as artifacts (retained 7 days).

---

## Deployment

The project supports multiple deployment targets:

| Platform | Config File | Notes |
|---|---|---|
| **Render.com** | `render.yaml` | Blueprint with `objekta-backend` (Node web service) + `objekta-frontend` (static site) |
| **Vercel** | `vercel.json` | Frontend SPA with catch-all rewrite to `index.html` |
| **Docker** | `Dockerfile`, `docker-compose*.yml` | Self-hosted or any container platform |
| **Heroku** | `backend/Procfile` | `web: node server.js` |

---

## Architecture

```
┌───────────────────────────────────────────────────────────────┐
│                        BROWSER                                │
│                                                               │
│  React SPA ──── React Three Fiber ──── Three.js (WebGL 2)    │
│     │                   │                     │               │
│  Zustand Stores    Rapier WASM         Custom GLSL Shaders    │
│     │              (Physics)           (Hologram, Grid, ...)  │
│     │                                                         │
│  Yjs Y.Doc ◄──── WebSocket ────► Yjs CRDT Server             │
│  Socket.IO ◄──── WebSocket ────► Socket.IO Server             │
│     │                                                         │
│  REST API  ◄──── HTTP/Fetch ───► Express API                  │
│  TUS Client ◄─── HTTP ─────────► TUS Server                   │
│  S3 Direct  ◄─── Presigned URL ─► AWS S3                      │
│  HF Transformers (Web Worker) — local inference               │
└───────────────────────────────────────────────────────────────┘

┌───────────────────────────────────────────────────────────────┐
│                     BACKEND (Node.js)                         │
│                                                               │
│  Express 4         Socket.IO 4         Yjs WebSocket Server   │
│     │                  │                       │              │
│  Routes (57 endpoints) │              Y.Doc per project       │
│  ├─ Auth (JWT, OAuth, 2FA)                                    │
│  ├─ Projects (CRUD, assets, S3)                               │
│  ├─ Scenes (save/load)                                        │
│  ├─ Versions (diff, restore)                                  │
│  ├─ AI (chat, describe, suggest, optimize)                    │
│  ├─ Uploads (presigned, multipart, TUS)                       │
│  ├─ Marketplace (products, cart, orders, payments, reviews)   │
│  └─ Admin (users, stats)                                      │
│     │                                                         │
│  Mongoose 7 ───► MongoDB 7                                    │
│  @aws-sdk ──────► AWS S3                                      │
│  Stripe SDK ────► Stripe API                                  │
│  Nodemailer ────► SMTP                                        │
└───────────────────────────────────────────────────────────────┘

┌───────────────────────────────────────────────────────────────┐
│                  AI SERVICE (Python FastAPI)                   │
│                                                               │
│  Multi-provider LLM:                                          │
│  ├─ Groq (Llama 3.3 70B)         ← free tier, default        │
│  ├─ Google Gemini (2.0 Flash)     ← free tier                 │
│  ├─ OpenAI (GPT-4o Mini)         ← paid                      │
│  └─ Anthropic (Claude Sonnet)    ← paid                      │
│                                                               │
│  Task-specific prompts for: chat, describe, material,         │
│  optimization, naming — with structured response validation   │
└───────────────────────────────────────────────────────────────┘
```

### Data Flow

1. **Scene Editing:** User interactions update React state → Three.js scene → Yjs Y.Doc broadcasts changes to all connected clients.
2. **Project Save:** Scene is serialized → compressed (pako deflate) → stored inline in MongoDB (< 12 MB), on disk, or in S3. A version diff is created automatically.
3. **File Uploads:** Small files go through multer. Large files use TUS (resumable) or S3 presigned URLs (direct browser-to-cloud).
4. **AI Assistance:** Frontend sends scene context + prompt → backend proxies to Python FastAPI service → falls back to direct LLM calls if Python is unavailable → response streamed back to chat panel.
5. **Marketplace Purchases:** Cart → Stripe payment intent → webhook confirms payment → signed download URLs generated → seller notified via Socket.IO.

---

## API Documentation

The backend serves interactive Swagger/OpenAPI documentation with 57 documented endpoints:

```
http://localhost:5000/api/docs
```

Spec JSON is available at `/api/docs.json`.

---

## Scripts Reference

### Frontend (`package.json`)

| Script | Description |
|---|---|
| `npm run dev` | Start Vite dev server (port 5173) |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Preview production build locally |
| `npm test` | Run Vitest in watch mode |
| `npm run test:run` | Run Vitest once |
| `npm run test:marketplace` | Run marketplace-specific tests |
| `npm run test:e2e` | Run Playwright E2E suite |
| `npm run lint` | ESLint check |
| `npm run format` | Prettier format |
| `npm run reset` | Reset Vite cache |

### Backend (`backend/package.json`)

| Script | Description |
|---|---|
| `npm start` | Start production server |
| `npm run dev` | Start with nodemon (hot reload) |
| `npm test` | Run Jest tests |
| `npm run test:marketplace` | Run marketplace tests only |
| `npm run seed:marketplace` | Seed sample marketplace products |

---

## Keyboard Shortcuts (Studio)

| Shortcut | Action |
|---|---|
| `W` | Translate mode |
| `E` | Rotate mode |
| `R` | Scale mode |
| `Delete` | Delete selected object |
| `Ctrl+Z` | Undo |
| `Ctrl+Shift+Z` | Redo |
| `Ctrl+S` | Save project |
| `B` | Toggle sculpt mode |
| `1`–`8` | Select sculpt brush (in sculpt mode) |
| `+` / `-` | Increase / decrease brush radius |

---

## Troubleshooting

- **EffectComposer / postprocessing crashes:** The project pins specific Three.js and postprocessing versions via `package.json` overrides. If upgrading, upgrade `three`, `postprocessing`, `@react-three/fiber`, `@react-three/drei`, and `@react-three/postprocessing` together.
- **WebGL context lost:** The app registers a global `webglcontextlost` handler and shows a recovery prompt. Try refreshing or enabling performance mode.
- **Port conflicts (Windows):** Use `npx kill-port <port>` or change the `PORT` env variable.
- **MongoDB connection errors:** Verify `MONGO_URI` is correct and the MongoDB instance is running.
- **AI not responding:** Check that at least one `*_API_KEY` is set in `backend/.env`, or start the Python AI service on port 8100.

---

## Contributing

1. Fork the repository and create a feature branch.
2. Follow existing code style — run `npm run lint` and `npm run format` before submitting.
3. Write tests for new features.
4. Open a pull request against `main`.

---

## License

Check the repository for an explicit license file. If none is present, contact the maintainers for licensing details.

---

**Repository:** [github.com/puneethyerninti/OBJEKTA](https://github.com/puneethyerninti/OBJEKTA)
