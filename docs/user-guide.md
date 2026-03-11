# OBJEKTA — User Guide

## Table of Contents

1. [Getting Started](#getting-started)
2. [Studio Walkthrough](#studio-walkthrough)
3. [Scene Objects](#scene-objects)
4. [Keyboard Shortcuts](#keyboard-shortcuts)
5. [Materials & Textures](#materials--textures)
6. [Lighting](#lighting)
7. [Animation](#animation)
8. [Physics](#physics)
9. [Import & Export](#import--export)
10. [Collaboration](#collaboration)
11. [Backups & Version History](#backups--version-history)
12. [Marketplace](#marketplace)
13. [Account & Settings](#account--settings)

---

## Getting Started

### Creating an Account

1. Visit the OBJEKTA homepage and click **Sign Up**
2. Enter your name, email, and a secure password (minimum 6 characters)
3. Verify your email by clicking the link sent to your inbox
4. Log in with your credentials

**Google Sign-In:** Click "Continue with Google" for one-click OAuth login.

### Creating Your First Project

1. From the **Dashboard**, click **New Project**
2. Give your project a title and optional description
3. You'll be taken to the **Studio** editor
4. Start adding objects from the left sidebar palette

### Dashboard Overview

Your dashboard shows:
- **Project grid** — All your projects with thumbnails, last saved time, and progress
- **Activity feed** — Recent changes across all projects
- **Collaborators** — People you've worked with

---

## Studio Walkthrough

The Studio is where you build 3D scenes. It consists of:

### Layout

| Area | Location | Purpose |
|------|----------|---------|
| **Toolbar** | Top | Transform tools, camera, add objects |
| **Viewport** | Center | 3D canvas for visual editing |
| **Outliner** | Left panel | Scene hierarchy tree |
| **Properties** | Right panel | Selected object properties |
| **Timeline** | Bottom | Animation keyframes & scrubber |

### Viewport Navigation

- **Orbit:** Left mouse drag (or touch drag)
- **Pan:** Middle mouse drag (or Shift + left drag)
- **Zoom:** Scroll wheel (or pinch)
- **Focus on object:** Select object, press `F`

### Camera Modes

- **Perspective** (default) — 3D perspective view
- **Orthographic** — Flat projection, useful for alignment
- **First-person fly** — WASD + mouse look for walkthrough
- **Preset views:** Numpad 1 (front), 3 (right), 7 (top), 5 (toggle ortho)

---

## Scene Objects

### Adding Objects

From the toolbar or palette, you can add:

- **Primitives:** Box, Sphere, Cylinder, Capsule, Cone, Torus, Plane
- **Lights:** Point, Spot, Directional, Area (RectArea)
- **Imported models:** GLB, GLTF, OBJ, FBX files

### Selecting Objects

- **Single select:** Click on object in viewport or outliner
- **Multi-select:** Shift+Click to add/remove from selection
- **Select all:** Ctrl+A (Cmd+A on Mac)
- **Box select:** Click and drag a rectangle in the viewport
- **Deselect:** Click empty space or press Escape

### Transforming Objects

Three transform modes available via toolbar or keyboard:

| Mode | Shortcut | Description |
|------|----------|-------------|
| **Translate** | `G` | Move objects along axes |
| **Rotate** | `R` | Rotate objects |
| **Scale** | `S` | Scale objects uniformly or per-axis |

- **Axis lock:** Click colored gizmo handles (red=X, green=Y, blue=Z)
- **Snap:** Hold Ctrl while transforming for grid snap

### Object Properties

Select an object to see its properties in the right panel:

- **Transform:** Position (X, Y, Z), Rotation, Scale
- **Material:** Color, metalness, roughness, emissive, textures
- **Geometry:** Dimensions specific to shape type
- **Physics:** Body type, collider, mass, friction (see Physics section)
- **Visibility:** Show/hide, cast/receive shadows

### Alignment Tools

With multiple objects selected:
- Align left/center/right along any axis
- Distribute evenly (even spacing)
- Measurement tool: Click two points to see distance

### Undo / Redo

- **Undo:** Ctrl+Z
- **Redo:** Ctrl+Shift+Z (or Ctrl+Y)

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `G` | Translate mode |
| `R` | Rotate mode |
| `S` | Scale mode |
| `F` | Focus on selected |
| `Delete` / `Backspace` | Delete selected |
| `Ctrl+A` | Select all |
| `Ctrl+Z` | Undo |
| `Ctrl+Shift+Z` | Redo |
| `Ctrl+S` | Save project |
| `Ctrl+D` | Duplicate selected |
| `Ctrl+C` / `Ctrl+V` | Copy / Paste |
| `Escape` | Deselect all |
| `H` | Toggle object visibility |
| `Numpad 1` | Front view |
| `Numpad 3` | Right view |
| `Numpad 7` | Top view |
| `Numpad 5` | Toggle perspective/orthographic |

---

## Materials & Textures

### Material Library

Open the **Materials** tab in the right panel to access:
- **Preset materials:** Wood, Metal, Glass, Concrete, Fabric, etc.
- **PBR properties:** Albedo, normal map, roughness map, metalness map, AO map
- **Custom materials:** Create and save your own material presets

### Applying Materials

1. Select an object
2. Open Material properties
3. Choose from the library or adjust PBR sliders
4. Upload texture maps (drag & drop or file picker)

### AI Material Suggestions

Click "AI Suggest" to get PBR material recommendations based on your object's name and context.

---

## Lighting

### Light Types

| Type | Description | Best For |
|------|-------------|----------|
| **Directional** | Parallel rays from far away | Sun/moon lighting |
| **Point** | Emits in all directions from a point | Lamps, bulbs |
| **Spot** | Cone-shaped light | Flashlights, stage lights |
| **Area (RectArea)** | Soft rectangular light | Window light, studio |

### Light Properties

- **Intensity:** Brightness (0–100)
- **Color:** Light color picker
- **Shadows:** Enable/disable shadow casting
- **Shadow bias:** Fine-tune shadow artifacts
- **Distance / Decay:** Falloff for point/spot lights
- **Angle / Penumbra:** Cone control for spotlights

### Environment

- **HDRI maps:** Upload `.hdr` or `.exr` files for image-based lighting
- **Background color:** Set a solid environment color
- **Contact shadows:** Enable soft ground shadows

---

## Animation

### Keyframe Editor

1. Open the **Timeline** panel at the bottom
2. Select an object
3. Set the time cursor to a frame
4. Change the object's transform
5. Click **Add Keyframe** (or it auto-keys when enabled)

### Easing Curves

16 built-in easing functions:
- Linear, Ease-In, Ease-Out, Ease-In-Out
- Quad, Cubic, Quart, Quint, Sine, Expo, Circ, Back, Elastic, Bounce
- Custom cubic bezier curves

### Playback Controls

- **Play/Pause:** Spacebar or play button
- **Speed:** 0.25x, 0.5x, 1x, 2x, 4x
- **Loop modes:** Once, Loop, Ping-Pong
- **Markers:** Add named markers for key moments

### Animation Export

Animations are baked into exported GLB files as `AnimationClip` tracks, compatible with any Three.js or glTF viewer.

---

## Physics

### Enabling Physics

1. Open the **Physics** tab in object properties
2. Choose a **body type:**
   - **Static** — Immovable (floors, walls)
   - **Dynamic** — Fully simulated (falling objects)
   - **Kinematic** — Manually controlled, affects others

### Collider Shapes

- **Box** — Axis-aligned bounding box
- **Sphere** — Bounding sphere
- **Capsule** — Cylindrical with rounded ends
- **Cylinder** — Exact cylinder
- **Convex hull** — Tight fit around complex shapes
- **Triangle mesh** — Exact geometry (static only)

### Physics Properties

| Property | Description |
|----------|-------------|
| Mass | Weight (affects gravity, collisions) |
| Friction | Surface grip (0 = ice, 1 = rubber) |
| Restitution | Bounciness (0 = no bounce, 1 = full) |
| Damping | Air resistance (linear + angular) |
| Gravity scale | Per-object gravity multiplier |
| CCD | Continuous collision for fast objects |

### Joints & Constraints

Connect two objects with physics joints:
- **Fixed** — Rigid connection
- **Revolute (Hinge)** — Rotates around one axis (doors)
- **Prismatic (Slider)** — Slides along one axis (pistons)
- **Spherical (Ball)** — Rotates freely (shoulders)
- **Spring** — Elastic connection with stiffness/damping

### Gravity Presets

Quick-switch gravity: Earth, Moon, Mars, Zero-G, Water, Jupiter

### Bake to Keyframes

Simulate physics, then bake the resulting motion into animation keyframes for export.

---

## Import & Export

### Supported Import Formats

| Format | Extension | Notes |
|--------|-----------|-------|
| glTF Binary | `.glb` | Recommended — includes meshes, materials, animations |
| glTF | `.gltf` | JSON format with external files |
| OBJ | `.obj` | Geometry only (no materials by default) |
| FBX | `.fbx` | Supports animations and rigs |
| ZIP | `.zip` | Auto-extracted archives containing models |

### Importing Models

- **Drag & drop** files onto the viewport
- **File menu → Import** to browse files
- **URL import** for hosted models

Large files (>50MB) use resumable multi-part upload with progress tracking.

### Exporting

- **GLB Export:** File menu → Export → GLB (includes scene, materials, animations)
- **Scene JSON:** Saved automatically with each project save

### Auto-Thumbnails

A 256×256 thumbnail is automatically generated after each model import for project previews.

---

## Collaboration

### Real-Time Co-Editing

OBJEKTA supports real-time collaborative editing via CRDT (Yjs):

1. **Share project:** From the dashboard, click the share icon and invite collaborators by email
2. **Permission levels:**
   - **Owner** — Full control, can delete project
   - **Editor** — Can modify scene, add objects
   - **Viewer** — Read-only access

### Presence Indicators

- Colored cursor spheres show other users' positions in 3D
- Name labels float above cursors
- Selection highlights show what others are editing
- Connection status indicator (Synced / Syncing / Offline + user count)

### Object Locking

When you select an object, it's automatically locked to prevent conflicts. Other users see a lock icon and can't modify it until you deselect.

### Offline Support

Changes made while offline are preserved locally and auto-synced when you reconnect.

---

## Backups & Version History

### Local Backups

OBJEKTA automatically saves backups to your browser's local storage (IndexedDB + localStorage). View and restore backups from the **Backups** tab in the right panel.

### Version History (Server)

When your project is saved to the server, versions are created automatically:

- Each save computes a diff against the previous version
- Every 10 saves, a full snapshot is stored
- **Version Timeline** shows all versions with timestamps and change stats
- **Compare:** View added/removed/modified objects between any two versions
- **Restore:** Roll back to any previous version (creates a new version first)

---

## Marketplace

### Browsing

Visit **Marketplace** from the navigation bar to browse 3D assets:

- **Search:** Full-text search by title, description, tags
- **Filter:** By category (furniture, architecture, nature, etc.)
- **Sort:** By price, rating, newest, popularity

### Purchasing

1. Click **Add to Cart** on a product
2. Go to **Cart** to review items
3. Proceed to **Checkout**
4. Complete payment (Stripe)
5. Downloads become available in **Order History**

### Downloads

- Purchased assets have **signed download URLs** (24-hour expiry)
- Up to 5 downloads per item
- Expired links can be **refreshed** from Order History
- License type shown: Standard (personal), Extended (commercial), Exclusive

### Selling

1. Apply for **Seller** role from your profile
2. Go to **Seller Dashboard**
3. Click **New Product** to create a listing
4. Upload your 3D asset file and thumbnail
5. Set price, category, description, and license type
6. Track sales, revenue, and orders from your dashboard

---

## Account & Settings

### Profile

- View/edit your profile from the **Account** menu
- Change password, manage 2FA, view active sessions

### Two-Factor Authentication (2FA)

1. Go to Account → Security
2. Click **Enable 2FA**
3. Scan the QR code with an authenticator app (Google Authenticator, Authy, etc.)
4. Enter the 6-digit code to verify
5. Save your **backup codes** somewhere safe — each can be used once if you lose your phone

### Password Reset

1. Click **Forgot Password** on the login page
2. Enter your email address
3. Check your inbox for a reset link
4. Set a new password

### Admin Panel

Admins can access `/admin` to:
- View platform statistics (total users, new users, revenue)
- Search and filter users
- Change user roles (buyer/seller/admin)
- Suspend/unsuspend accounts

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Scene won't load | Clear browser cache, check network tab for errors |
| Models appear black | Check lighting — add a directional or point light |
| Physics objects fall through floor | Ensure floor has a **static** body with a collider |
| Collaboration not syncing | Check connection indicator (bottom-right), refresh if offline |
| Export missing animations | Ensure keyframes exist and use GLB (not OBJ) format |
| Login redirecting loop | Clear cookies/localStorage, try incognito mode |

---

## API Reference

Interactive API documentation is available at `/api/docs` when running the backend server. This includes all 57 REST endpoints with request/response schemas, authentication requirements, and example payloads.

For the raw OpenAPI JSON spec, visit `/api/docs.json`.
