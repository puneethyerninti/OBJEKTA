# OBJECTIVE: Complete OBJEKTA Project for Production

## CONTEXT

OBJEKTA is a browser-based collaborative 3D scene editor with an integrated asset marketplace. It consists of:

- **Frontend:** React 18 + React Three Fiber + Three.js WebGL editor
- **Backend:** Node.js/Express + MongoDB + Python FastAPI (AI service)
- **3D Engine:** WebGL 2, Rapier 3D physics, PBR materials, procedural generation, sculpting, animation
- **Collaboration:** Yjs CRDT + WebSocket real-time sync
- **Marketplace:** Full e-commerce with Stripe payments, product listings, reviews, seller dashboard
- **AI:** Multi-provider LLM (Groq, Gemini, OpenAI, Anthropic) with Python FastAPI micro-service
- **Auth:** JWT + OAuth + TOTP 2FA
- **Storage:** MongoDB / Disk / AWS S3 with resumable uploads (TUS + multipart)

**Current Status:** Many features are partially implemented, some are broken, some are missing. The project needs a comprehensive audit and targeted completion to be production-ready.

---

## TASK 1: COMPREHENSIVE FEATURE AUDIT

Please perform a complete end-to-end analysis of the OBJEKTA codebase:

### 1.1 Frontend Feature Completeness

For **each** of the following feature areas, determine:
- ✅ Fully implemented and functional
- ⚠️ Partially implemented (identify what's broken/missing)
- ❌ Not implemented or severely broken
- 🔴 Has known bugs or regressions

Analyze:

**Studio Editor:**
- [ ] Viewport (WebGL 2 rendering, camera controls, selection)
- [ ] Transform controls (translate, rotate, scale with snapping)
- [ ] Primitive creation (cube, sphere, cone, plane, cylinder, torus)
- [ ] Lights (point, spot, directional, area) + helpers
- [ ] Material editor (PBR properties: color, roughness, metalness, opacity, emissive, wireframe)
- [ ] Material library (9 categories, 50+ presets) — loading, applying, searching
- [ ] Texture mapping (base color, normal, roughness, metalness, emissive, AO) — upload, preview, VRAM management
- [ ] Sculpting (8 brushes: Inflate, Deflate, Smooth, Flatten, Pinch, Grab, Clay, Crease) — brush settings, symmetry, undo
- [ ] Procedural generation (stairs, walls, floors, terrain, scatter, grids) — parameter UI, preview
- [ ] Animation (keyframe editor, multiple tracks, easing functions, playback, pingpong/loop modes)
- [ ] Physics simulation (Rapier 3D bodies, colliders, joints, gravity presets, ragdoll, bake-to-keyframes)
- [ ] Post-processing (bloom, GLSL shaders: hologram, grid, blob, planet, atmosphere, ocean, rain particles)
- [ ] Import/Export (GLB/glTF 2.0, drag-and-drop, DRACO compression, KTX2, meshopt decoder)
- [ ] Scene optimization (duplicate detection, material dedup, mesh merging, LOD, decimation, VRAM analysis)
- [ ] Outliner (scene hierarchy, search, expand/collapse, drag-to-reorder reparenting)
- [ ] Properties panel (object metadata: name, tags, custom properties)
- [ ] Undo/Redo (command-based history, full state tracking)
- [ ] Autosave (IndexedDB backup + server sync)
- [ ] Keyboard shortcuts (W/E/R for modes, Delete, Ctrl+Z/Shift+Z, Ctrl+S, etc.)
- [ ] Camera bookmarks (save/restore camera states)

**Dashboard:**
- [ ] Project creation
- [ ] Project grid view (thumbnail, name, last modified, action buttons)
- [ ] Project rename, duplicate, delete
- [ ] Project search/filter
- [ ] Quick access to collaborators
- [ ] Recent projects list

**Collaboration Features:**
- [ ] Yjs CRDT sync (scene objects, properties, environment, camera)
- [ ] Live presence (connected users, avatars, cursors)
- [ ] Object locking (prevent concurrent edits)
- [ ] Permission system (owner, editor, viewer roles)
- [ ] Invite collaborators UI
- [ ] Collaboration warning/conflict indicators
- [ ] Real-time activity feed

**Marketplace (Frontend):**
- [ ] Product listing page (search, filters, sorting, pagination)
- [ ] Product detail page (images, description, specs, reviews, seller info)
- [ ] Shopping cart (add, remove, quantity, total price)
- [ ] Checkout flow (payment, order review, confirmation)
- [ ] Order history (list, detail, download links)
- [ ] Seller dashboard (product management, sales stats, order tracking)
- [ ] Review system (rating, verified purchase badge, review display)
- [ ] Search functionality (full-text + category filters)
- [ ] Related products / recommendations

**Authentication UI:**
- [ ] Registration form (email validation, password strength)
- [ ] Login form (email, password, TOTP 2FA code input)
- [ ] OAuth login (Google button, flow)
- [ ] Email verification (sent email UI, verify link)
- [ ] Forgot password (email, reset flow)
- [ ] Profile settings (avatar, name, email change)
- [ ] 2FA setup (QR code, backup codes display/download)
- [ ] Account suspension notices

**Admin Panel:**
- [ ] User management (list, search, role change, suspend/unsuspend)
- [ ] Platform stats (user counts, role breakdown, new users)
- [ ] Dashboard (key metrics)

**AI Chat Panel:**
- [ ] Chat interface (send message, display responses)
- [ ] Scene context (passed to AI)
- [ ] Chat history
- [ ] Streaming responses
- [ ] Error handling + fallback providers

**UI/UX Polish:**
- [ ] Loading states (spinners, skeletons)
- [ ] Error messages (user-friendly, actionable)
- [ ] Notifications (toasts, alerts)
- [ ] Mobile responsiveness (editor, dashboard, marketplace)
- [ ] Accessibility (keyboard nav, screen reader support, ARIA labels)
- [ ] Dark mode / theme toggle
- [ ] Animations / transitions (Framer Motion usage)

---

### 1.2 Backend API Completeness

For **each** endpoint and feature area:

**Authentication API:**
- [ ] POST `/api/auth/register` — email validation, password hashing, verification email
- [ ] POST `/api/auth/login` — password check, TOTP handling, token generation, refresh token rotation
- [ ] POST `/api/auth/oauth` — Google token verification, auto-registration
- [ ] POST `/api/auth/refresh` — token rotation, refresh token validation
- [ ] GET `/api/auth/verify-email` — token validation, email marking
- [ ] POST `/api/auth/forgot-password` — reset token generation, email dispatch
- [ ] POST `/api/auth/reset-password` — token validation, password update
- [ ] GET `/api/auth/me` — user profile, session data
- [ ] POST `/api/auth/resend-verification` — email dispatch
- [ ] POST `/api/auth/2fa/setup` — TOTP secret generation, QR code
- [ ] POST `/api/auth/2fa/verify` — TOTP validation, backup codes generation
- [ ] POST `/api/auth/2fa/disable` — password check, 2FA disable
- [ ] GET `/api/auth/admin/users` — user listing, search, filter, pagination
- [ ] GET `/api/auth/admin/stats` — platform metrics
- [ ] PUT `/api/auth/admin/users/:id/role` — role update, validation
- [ ] PUT `/api/auth/admin/users/:id/suspend` — account suspension

**Projects API:**
- [ ] GET `/api/projects` — user's projects + collaborations, pagination
- [ ] POST `/api/projects` — project creation, file uploads, thumbnail
- [ ] GET `/api/projects/:id` — full project detail, permission check
- [ ] PUT `/api/projects/:id` — update scene, metadata, environment, effects, camera state
- [ ] DELETE `/api/projects/:id` — delete project, clean up files
- [ ] POST `/api/projects/:id/assets` — add assets (GLB, etc.)
- [ ] POST `/api/projects/:id/assets/s3` — register external/S3 assets

**Scenes API:**
- [ ] POST `/api/scenes/save` — save scene JSON + GLB + environment
- [ ] GET `/api/scenes` — list scenes metadata
- [ ] GET `/api/scenes/:id` — full scene detail
- [ ] POST `/api/scenes/:id/update` — update scene

**Uploads API (S3 + TUS):**
- [ ] POST `/api/uploads/presign` — presigned PUT URL (15min expiry)
- [ ] POST `/api/uploads/multipart/start` — initiate multipart upload
- [ ] POST `/api/uploads/multipart/sign` — sign part upload URL
- [ ] POST `/api/uploads/multipart/complete` — complete multipart upload
- [ ] POST `/api/uploads/tus/finalize` — move TUS uploaded file to S3
- [ ] POST `/api/upload-glb` — direct GLB upload via multer

**Versions / History API:**
- [ ] GET `/api/versions/:projectId` — version history, pagination
- [ ] GET `/api/versions/:projectId/:versionNumber` — reconstruct specific version
- [ ] GET `/api/versions/:projectId/diff/:from/:to` — diff between versions
- [ ] POST `/api/versions/:projectId/restore/:versionNumber` — restore to version

**AI API:**
- [ ] POST `/api/ai/chat` — chat with scene context, fallback providers
- [ ] POST `/api/ai/describe` — detailed scene description
- [ ] POST `/api/ai/suggest-material` — PBR material suggestions
- [ ] POST `/api/ai/suggest-names` — object naming suggestions
- [ ] POST `/api/ai/optimize` — scene optimization analysis
- [ ] GET `/api/ai/status` — provider availability, Python service status

**Marketplace API:**

*Products:*
- [ ] GET `/api/marketplace/products` — listing, search, filter, sort, pagination
- [ ] GET `/api/marketplace/products/categories` — category counts
- [ ] GET `/api/marketplace/products/:idOrSlug` — single product detail
- [ ] POST `/api/marketplace/seller/products` — create product (upload asset + thumbnail)
- [ ] PUT `/api/marketplace/seller/products/:id` — update product
- [ ] DELETE `/api/marketplace/seller/products/:id` — soft delete product

*Cart:*
- [ ] GET `/api/marketplace/cart` — get user's cart
- [ ] POST `/api/marketplace/cart/add` — add item
- [ ] PUT `/api/marketplace/cart/update` — update quantity
- [ ] DELETE `/api/marketplace/cart/remove/:productId` — remove item
- [ ] DELETE `/api/marketplace/cart` — clear cart

*Orders:*
- [ ] POST `/api/marketplace/orders` — create order from cart (Stripe intent)
- [ ] POST `/api/marketplace/orders/:id/confirm` — confirm payment, generate download links
- [ ] GET `/api/marketplace/orders` — list buyer's orders
- [ ] GET `/api/marketplace/orders/:id` — single order detail

*Payments:*
- [ ] GET `/api/marketplace/payments/provider` — active payment gateway
- [ ] POST `/api/marketplace/payments/create-intent` — create payment intent
- [ ] POST `/api/marketplace/payments/refund` — refund order
- [ ] POST `/api/marketplace/payments/webhook` — Stripe webhook handler (signature verification)

*Reviews:*
- [ ] GET `/api/marketplace/reviews/:productId` — list reviews with rating distribution
- [ ] POST `/api/marketplace/reviews` — post review (duplicate check, verified purchase)
- [ ] DELETE `/api/marketplace/reviews/:id` — delete own review

*Downloads:*
- [ ] GET `/api/marketplace/downloads/:token` — serve signed download (validate token, expiry, count limits)
- [ ] POST `/api/marketplace/downloads/refresh/:orderId/:productId` — regenerate download URL

*Seller Dashboard:*
- [ ] GET `/api/marketplace/seller/products` — seller's product list
- [ ] GET `/api/marketplace/seller/stats` — sales stats (products, sold, revenue, orders)
- [ ] GET `/api/marketplace/seller/orders` — seller's orders

**Other Endpoints:**
- [ ] GET `/` — health check
- [ ] GET `/api/test` — backend OK
- [ ] GET `/health` — detailed health (uptime, DB status)
- [ ] GET `/api/docs` — Swagger UI
- [ ] GET `/api/docs.json` — OpenAPI spec
- [ ] GET `/api/collaborators` — list unique collaborators across projects
- [ ] GET `/api/activity` — activity feed

---

### 1.3 3D Engine Features

**Core Rendering:**
- [ ] WebGL 2 context (fallback to WebGL 1)
- [ ] Adaptive resolution scaling (performance-based)
- [ ] Wireframe mode toggle
- [ ] Multiple rendering passes (deferred rendering, forward rendering)
- [ ] Shadow mapping (PCF/CSM)
- [ ] Normal map computation / baking

**Mesh Operations:**
- [ ] Mesh merging (combine multiple geometries)
- [ ] Mesh decimation (polygon reduction with quality loss control)
- [ ] Duplicate detection (identical geometry + material)
- [ ] LOD generation (4 tiers: high, medium, low, ultra-low)
- [ ] Texture atlasing
- [ ] UV unwrapping / optimization

**Material System:**
- [ ] PBR material properties (metalness, roughness, AO, emissive)
- [ ] Texture slot support (6 slots: color, normal, roughness, metalness, emissive, AO)
- [ ] Texture import (JPG, PNG, EXR, HDR, KTX2)
- [ ] Normal map baking
- [ ] Material variants / material slots per object
- [ ] Material presets (50+ base materials, custom save)

**Sculpting System:**
- [ ] Brush switching (8 brushes)
- [ ] Brush parameters (radius, strength, falloff)
- [ ] XYZ symmetry
- [ ] Brush undo on sculpt operations
- [ ] Sculpt painting (vertex colors)
- [ ] Decimation during sculpt (performance)

**Physics & Dynamics:**
- [ ] Rapier 3D integration (WASM)
- [ ] Body types (dynamic, static, kinematic)
- [ ] Collider shapes (sphere, box, cylinder, capsule, cone, triangle mesh)
- [ ] Constraint types (fixed, revolute, prismatic, spherical, ball, distance)
- [ ] Gravity presets (Earth, Moon, Mars, Zero-G, Water, Jupiter)
- [ ] Trigger volumes (collider query interactions)
- [ ] Ragdoll animation
- [ ] Bake physics to keyframes

**Animation System:**
- [ ] Keyframe-based animation
- [ ] Multiple animation tracks
- [ ] Easing functions (15+ linear, ease-in, ease-out, back, elastic, bounce, custom bezier)
- [ ] Frame range / looping / pingpong modes
- [ ] Playback rate control
- [ ] Skeletal animation import
- [ ] Blending between animations
- [ ] Animation events / triggers

**Procedural Generation:**
- [ ] Parametric stairs (steps, width, depth, height)
- [ ] Parametric walls (segments, height, thickness, material)
- [ ] Parametric floors (grid size, tile size, material)
- [ ] Terrain generation (noise-based, height map)
- [ ] Scatter patterns (random placement, density control)
- [ ] Grid patterns (spacing, count, customizable primitives)
- [ ] Tree generation (LOD variants)
- [ ] Building generator (modular, customizable)

**Post-Processing Effects:**
- [ ] Bloom (threshold, intensity, radius)
- [ ] Motion blur
- [ ] Depth of field
- [ ] SSAO (screen-space ambient occlusion)
- [ ] FXAA / antialiasing
- [ ] Color grading
- [ ] Custom GLSL shaders:
  - [ ] Hologram effect
  - [ ] Grid overlay
  - [ ] Blob effect
  - [ ] Planet shader (procedural, with atmosphere)
  - [ ] Starfield / space skybox
  - [ ] Atmosphere shader (Rayleigh scattering)
  - [ ] Ocean shader (waves, foam)
  - [ ] Rain particles (particle system, occlusion)

**Import/Export:**
- [ ] GLB export (with DRACO compression)
- [ ] glTF 2.0 export (with extensions)
- [ ] GLB import (drag-and-drop)
- [ ] GLTF import with texture loading
- [ ] FBX import (if supported)
- [ ] OBJ import
- [ ] USDZ import (AR)
- [ ] Scene JSON export (custom format for versioning)

**Optimization & Analysis:**
- [ ] Real-time triangle/vertex count display
- [ ] Draw call analysis
- [ ] VRAM usage estimation
- [ ] Texture memory breakdown
- [ ] LOD impact analysis
- [ ] Performance profiling (frame time, render time)
- [ ] Mobile performance budget (triangle count, VRAM limits)

**Interaction & Tools:**
- [ ] Surface snapping (snap to mesh surface during transform)
- [ ] Grid snapping (position, angle)
- [ ] Angle snapping (rotation increments)
- [ ] Axis constraints (lock to X/Y/Z)
- [ ] Bounding box display
- [ ] Pivot mode (origin, center, bottom)
- [ ] Mirror / symmetry tools
- [ ] Batch operations (group select, bulk transform)

---

### 1.4 Real-Time Collaboration

**Yjs CRDT:**
- [ ] Y.Doc per project instance
- [ ] Sync protocol (step 1/2, state vector, updates)
- [ ] Awareness protocol (cursor positions, user presence)
- [ ] Automatic conflict resolution (CRDT properties)
- [ ] Document persistence (save/load from DB)
- [ ] Document cleanup (GC on disconnect)

**Socket.IO:**
- [ ] Project room joins/leaves
- [ ] Presence tracking (connected users per room)
- [ ] Scene patch broadcasting
- [ ] Marketplace events (order notifications, inventory updates)
- [ ] Activity feed events

**Conflict Handling:**
- [ ] Object lock timeout / release
- [ ] Concurrent edit warnings
- [ ] Merge conflict UI
- [ ] Last-write-wins fallback

---

### 1.5 Database & Data Integrity

**Models:**
- [ ] User (fields, indexes, hooks) — password hashing, token management
- [ ] Project (fields, indexes) — scene storage strategy selection, compression
- [ ] Scene (fields, indexes) — separate from Project
- [ ] Product (fields, indexes) — slug generation, text search
- [ ] Order (fields, indexes) — order status flow, payout tracking
- [ ] Cart (fields, indexes, virtuals) — auto-expiry
- [ ] Review (fields, indexes, hooks) — rating aggregation
- [ ] Version (fields, indexes) — diff storage, snapshot strategy

**Storage Strategy Selection:**
- [ ] Auto-selection based on scene size
- [ ] Migration between storage tiers
- [ ] Compression ratio tracking
- [ ] File integrity checks (checksums)

**Data Validation:**
- [ ] Mongoose schema validation
- [ ] Cross-field validation (order status transitions)
- [ ] Enum constraints (roles, payment methods)
- [ ] Index uniqueness enforcement

---

### 1.6 Security & Integrity

- [ ] HTTPS enforcement in production
- [ ] CORS whitelist (specific origins)
- [ ] Rate limiting (API: 300/15min, uploads: 120/15min)
- [ ] Input sanitization (XSS prevention)
- [ ] JWT secret rotation mechanism
- [ ] Refresh token rotation on use
- [ ] Password hashing (bcrypt, 10 rounds)
- [ ] TOTP 2FA validation
- [ ] Download token HMAC verification
- [ ] Stripe webhook signature verification
- [ ] File upload size limits (per file, per request)
- [ ] Multer virus scanning (if applicable)
- [ ] S3 bucket policies (private by default)

---

### 1.7 Testing Coverage

**Frontend:**
- [ ] Unit tests (components, stores, utilities) — target: > 70% coverage
- [ ] E2E tests (Playwright) — core user flows
- [ ] Visual regression tests (if present)
- [ ] Performance tests (bundle size, core metrics)

**Backend:**
- [ ] Unit tests (models, utilities) — target: > 60% coverage
- [ ] Integration tests (API endpoints, DB)
- [ ] Marketplace flow tests (cart, checkout, payment)
- [ ] Collaboration tests (Yjs sync, Socket.IO)

---

## TASK 2: IDENTIFY INCOMPLETE/BROKEN FEATURES

For **each** identified issue from Task 1:

1. **Feature Name**
2. **Status:** ❌ Broken | ⚠️ Partially done | 🔴 Has bugs | ⚠️ Missing
3. **Affected Files:** Which files/components need work
4. **Root Cause:** Why is it incomplete?
5. **Impact on Users:** What breaks?
6. **Dependencies:** What must be done first?
7. **Estimated Complexity:** 🟢 Simple | 🟡 Medium | 🔴 Hard

---

## TASK 3: PRIORITIZATION & IMPLEMENTATION ROADMAP

1. **Tier 1 — Critical (blocks production launch):**
   - Core editor functionality
   - Authentication (login, registration, session)
   - Project CRUD (create, save, load, delete)
   - File uploads (TUS, S3, multer)
   - Basic collaboration (Yjs sync on scene objects)
   - Stripe payment integration

2. **Tier 2 — High (users can't use the app effectively without):**
   - Marketplace search/filtering
   - Order history and downloads
   - Scene versioning and restore
   - Admin user management
   - Error handling and user feedback
   - UI polish (responsiveness, loading states)

3. **Tier 3 — Medium (nice-to-have, but good for launch):**
   - AI chat integration (fallback if unavailable)
   - Advanced physics features
   - All 8 sculpt brushes
   - All procedural generators
   - All post-processing effects
   - Material presets all loading correctly

4. **Tier 4 — Low (can ship in v1.1 or later):**
   - Mobile app / progressive web app features
   - Advanced optimizations (LOD auto-generation)
   - Marketplace recommendations
   - Advanced analytics

---

## TASK 4: IMPLEMENTATION & TESTING

For each incomplete feature in priority order:

1. **Audit Code:** Read all related files, understand current implementation
2. **Design:** Plan the minimal changes needed for correctness
3. **Implement:** Write code, follow existing patterns
4. **Test:** Add/update unit + integration tests
5. **Verify:** Manual testing if UI-related
6. **Document:** Update code comments and API docs if needed
7. **Mark Complete:** Confirm feature works end-to-end

---

## DELIVERABLES

At the end, provide:

1. **Audit Report:** Summary of current feature status across all areas
2. **Issues List:** All identified incomplete/broken features with details from Task 2
3. **Implementation Roadmap:** Prioritized list from Task 3
4. **Completion Checklist:** After implementation, a full list of everything that's now working
5. **Test Coverage Report:** What's been tested
6. **Production Readiness Assessment:** Is the project ready to launch? If not, what's still missing?

---

## ADDITIONAL NOTES

- **Production Checklist:** Use industry standards (OWASP, GDPR for EU users, PCI DSS if storing card data, etc.)
- **Performance:** Measure and optimize where it matters (First Contentful Paint, Time to Interactive, Largest Contentful Paint)
- **Accessibility:** WCAG 2.1 AA compliance (if stated as a goal)
- **Documentation:** Ensure swagger/OpenAPI is up-to-date with all endpoints
- **Error Messages:** User-friendly, actionable, not leaking stack traces
- **Monitoring & Logging:** Error tracking (Sentry?), usage analytics
- **Database Backups:** MongoDB backup strategy documented
- **Deployment:** CI/CD working, rollback strategy documented

---

## START HERE

1. Perform Task 1 (comprehensive audit).
2. Generate Task 2 (issues list with the 7 required fields).
3. Create Task 3 (prioritized roadmap).
4. Execute Task 4 (implementation, tier by tier, starting with Tier 1).
5. Deliver Task 5 (all reports and checklists).

Focus on production readiness and user experience. Every line of code should be tested, every error should be user-facing friendly, and every feature should work end-to-end.
