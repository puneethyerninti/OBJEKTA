# Design Changelog — Cyberpunk/3D Theme Rollout

Date: 2025-11-19
Scope: Global design tokens/utilities, CSS theming across core panels, JSX class updates, a11y and motion safeguards.

## Overview
A unified cyberpunk/3D visual language was introduced using centralized design tokens and utility classes. Panel glass, neon rims, and subtle 3D interactions were added with reduced-motion and accessibility fallbacks. Key UI panels and several pages/components now consume these tokens/utilities.

## Design Tokens (src/index.css)
- Colors: `--cy-bg`, `--cy-panel`, `--cy-neon`, `--cy-cyan`, `--cy-magenta`, `--cy-acid`
- Effects: `--glass-alpha`
- Purpose: Standardize palette for neon/glass UI layers across app.

## Utilities (src/index.css)
- `.panel-glass`: Soft glass panel with backdrop blur and overlay grid
- `.neon-rim`: Subtle neon edge mask with sweeping glow
- `.card-3d`: 3D tilt, lift on hover, gentle float animation
- `.btn-neon` (+ variants `--primary`, `--outline`, `--ghost`): Button styling
- `.tilt-on-hover`: Micro-tilt interaction for small handles
- Motion: `@keyframes float-3d`, `pulse-neon`, `glow-sweep`, `tilt-on-hover-kf`
- Accessibility: Focus-visible rings, reduced-motion fallbacks for all anims

## CSS Panel Enhancements
- `src/styles/Studio.css`
  - Workspace hologram grid, toolbar glass/shimmer, status bar emissive
  - `.studio-canvas-wrap`, `.studio-hud`, `.floating-fab`
  - Compatibility: `mix-blend-mode: screen` (replacing `plus-lighter`)
- `src/styles/Palette.css`
  - Panel glass + animated grid overlay; swatches (`.swatch`) and handle (`.palette-handle`)
  - Compatibility: `mix-blend-mode: screen` (replacing `plus-lighter`)
- `src/styles/Outliner.css`
  - Neon grid background, connector accents, improved focus & scrollbars
  - Compatibility: `mix-blend-mode: screen`
- `src/styles/ObjectProperties.css`
  - Inspector glass/background, grid overlay, neon sliders/inputs
  - New helpers: `.prop-input`, `.prop-slider`, `.prop-toggle`; `[data-depth]` shadow intensities
- `src/styles/dashboard.css`
  - `.dash-grid`, `.hud-badge`, `.status-chip`, glass sidebar, command palette helpers

## JSX Updates
- `src/pages/Home.jsx`
  - Uses `home-bg`, `hero-panel panel-glass neon-rim card-3d`; `btn-neon` variants
- `src/pages/Studio.jsx`
  - Workspace uses `studio-canvas-wrap card-3d`; toolbar uses `studio-hud`; added `floating-fab`
- `src/components/Palette.jsx`
  - Adds `.palette-handle tilt-on-hover`
- `src/components/ProjectGrid.jsx`
  - Applies `.dash-grid`
- `src/components/ProjectCard.jsx`
  - Cards: `.card-3d neon-rim`; badges use `.hud-badge`
- `src/components/ObjectProperties.jsx`
  - Name input: `prop-input`
  - All numeric inputs via component: `op-numeric prop-input`
  - All range sliders: `op-range prop-slider`
  - Panels use `data-depth` for layered shadows: Transform=2, Material=3, Lighting=1, Textures=2

## Accessibility & Performance
- Focus-visible outlines for interactive controls
- Reduced motion: Disables animations under `prefers-reduced-motion`
- Backdrop blur constrained to panel surfaces to limit GPU cost
- Vendor prefix order fixed where required (`-webkit-mask` before `mask`)

## Migration Notes
- Prefer utilities over ad-hoc styles for consistency
- New component-friendly helpers: `.prop-input` and `.prop-slider` already wired in `ObjectProperties.jsx`
- For new panels, set `data-depth="1|2|3"` to control shadow intensity

## Verification Checklist
- Run: `npm run dev` (root) and open Studio/Dashboard/Home
- Check focus rings via keyboard tabbing
- Toggle OS reduced motion: ensure UI settles without animations
- Inspect Palette/Studio workspace grids render correctly and not overly bright

## Commit Suggestions (squash or keep as series)
1. feat(ui): add global cyberpunk tokens + utilities
2. feat(studio): neon grid, toolbar glass, HUD, blend-mode compatibility
3. feat(palette): panel glass, swatches/handle, blend-mode screen
4. feat(dashboard): dash grid, hud badges, cmd palette helpers
5. feat(outliner): neon grid, focus/scrollbar polish; compat tweaks
6. feat(inspector): prop inputs/sliders, depth shadows, wire numeric
7. chore(home+cards): adopt btn-neon, card-3d, neon-rim

Consider opening a PR titled: "Cyberpunk/3D Theme: Tokens, Utilities, and Panel Refresh" and include this changelog in the description.

## Upcoming Feature Roadmap (Rigging, Keyframing, Animation)

Phase 1 – Foundations (Incremental)
- Scene Metadata Extensions: Already added backend fields for `cameraState` and `effects`; next add `animationClips` (array of tracks) and `rigs` (skeletal data references).
- Keyframe Data Model: Introduce lightweight track format `{ id, targetUUID, property, times: [..], values: [..], interpolation }` serialized in scene JSON; keep numeric arrays compressed optionally via pako.
- Playback Controller: Frontend module to register tracks and advance them each frame (hooks into existing render loop before postprocessing). API: `addTrack(track)`, `removeTrack(id)`, `play()`, `pause()`, `seek(t)`.
- Camera Animation: First supported property set (position, quaternion, fov) for cinematic fly‑throughs.

Phase 2 – Rigging & Skeletal Support
- GLTF Import Enhancements: Detect and preserve existing `Skeleton` / `SkinnedMesh` nodes; expose list in `ObjectProperties` for selection.
- Basic Retarget Panel: Allow user to map source bones to target bones (UI stub with dropdown pairs, stored as mapping object).
- Pose Editor: UI to rotate bones at current timeline position; emits keyframes into per‑bone rotation tracks.
- Backend Storage: Persist `rigs` structure and `poses` snapshots; compress large arrays.

Phase 3 – Advanced Animation Tools
- Curve Editing: Bezier handle support for smoother interpolation (introduce `inTangent`/`outTangent` arrays to tracks where needed).
- Non-Linear Animation (NLA) Stack: Allow layering of clips blending by weight (simple mixer first: additive & override modes).
- Event Markers: Timeline events (e.g., trigger particle burst, play sound) stored as `{ time, type, payload }`.
- Preview & Scrubbing: Timeline bar with draggable playhead, ghosting of previous/next poses.

Phase 4 – Export & Interoperability
- GLTF Animation Export: Convert internal tracks to GLTF compatible channels (position/rotation/scale) for shareability.
- Clip Bundling: Allow exporting selected clip subset with thumbnail & metadata.
- Optimization: Optional resampling + keyframe reduction pass before export (threshold-based).

Notes & Principles
- Keep all animation data detached from Three.js objects until playback time (no mutation during editing other than pose previews).
- Favor simple JSON arrays for persistence; perform compression only during network save (not local editing) for responsiveness.
- Provide undo/redo integration for keyframe insert/delete using existing HistoryManager (wrap actions in commands).
- Accessibility: Keyboard navigation for timeline (Left/Right to seek, Enter to add keyframe, Delete to remove).

Initial Implementation Order Suggestion
1. Track schema + playback controller (camera animation demo)
2. Basic timeline UI (scrub + play/pause)
3. Keyframe CRUD + undo/redo
4. Skeleton detection + pose editor
5. Rig mapping stub
6. Export camera animation as GLTF extension
7. Add curve editing + clip layering
8. Event markers / FX triggers

This staged plan lets us deliver visible progress early (camera fly‑through) while deferring complex rig retargeting until foundation is stable.
