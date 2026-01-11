# OBJEKTA Status Report

## Project Summary
OBJEKTA is a React + Vite powered 3D collaborative workspace integrating Three.js directly (manual renderer / controls) alongside selective usage of react-three-fiber/drei in separate components (e.g. `Scene.jsx`, hologram/grid utilities). It provides project CRUD, asset uploads, scene editing (transform controls, history snapshots, raycasting), GLTF import/export, thumbnail capture, and a backend (Node/Express + MongoDB) with S3 presign support for object uploads. Several resilience features (IndexedDB backups, fallbacks) are partially implemented. Tooling (tests, linting, formatting) and CI are currently missing; some dependency mismatches and optimization instability in Vite dev server remain.

---
## 1. Scripts & Execution Health

| Script | Defined | Likely Outcome | Issues / Fixes | Command |
|--------|---------|---------------|----------------|---------|
| dev (`vite`) | Yes | Fails (504 optimize dep) | Duplicate Three/R3F imports & outdated optimizeDeps exclusions pattern | `npm run dev` |
| build (`vite build`) | Yes | Potential failure if optimizeDeps unresolved | Ensure clean install & consistent versions | `npm run build` |
| preview (`vite preview`) | Yes | Works only after successful build | Fix dev build first | `npm run preview` |
| test | Placeholder | Fails (no test framework) | Add Jest / Vitest | `npm test` |
| reset | Yes | Clears Vite cache only | Might not remove node_modules; add script enhancement | `npm run reset` |
| lint | Not present | Missing | Add ESLint config & script | `npm run lint` |
| format | Not present | Missing | Add Prettier config & script | `npm run format` |

Recommended additions to `package.json` scripts:
```json
"scripts": {
  "dev": "vite",
  "build": "vite build",
  "preview": "vite preview",
  "test": "vitest",
  "lint": "eslint src --ext .jsx,.js",
  "format": "prettier --write .",
  "reset": "rm -rf node_modules .vite && npm install"
}
```

---
## 2. Vite Config Review
File: `vite.config.mjs`
- optimizeDeps.include: three, @react-three/fiber, @react-three/drei (OK)
- optimizeDeps.exclude uses `'three/examples/jsm'` now (OK; previously invalid `**` wildcard) 
- Proxy configuration for `/api` and `/socket.io` correct.
- Missing potential optimization: pre-bundle `three-mesh-bvh`, `three-stdlib`, and `postprocessing` given frequent use.
- Suggest adding `define: { 'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV) }` for some libs expecting it.

Patch suggestion snippet:
```js
optimizeDeps: {
  include: ['three', '@react-three/fiber', '@react-three/drei', 'three-mesh-bvh', 'postprocessing'],
  exclude: ['three/examples/jsm']
}
```

---
## 3. CI / Deployment / Infra
- No `.github/workflows/` found → Missing CI (tests, lint, build).
- No Dockerfile / container config present.
- No deployment config (vercel.json/netlify.toml) present.

Add minimal GitHub Action pipeline suggestion:
```yaml
name: CI
on: [push, pull_request]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npm run lint || echo "lint skipped"
      - run: npm run build
```

---
## 4. Feature Audit
| Feature | Status | References | Notes |
|---------|--------|------------|-------|
| Vite Dev Server Stability | Partial | `vite.config.mjs` | 504 optimize errors persist; dependency duplication fixed but verify reinstall needed. |
| Three.js integration manual | Completed | `Workspace.jsx` (renderer init ~line 794) | Manual control of renderer and loop; r3f used separately. |
| r3f/drei usage | Partial | `Scene.jsx`, `Hologram.jsx`, `TronGrid.jsx` | Mixed strategy; consistency lacking between manual and declarative scenes. |
| Workspace canvas init & controls | Completed | `Workspace.jsx` (imports, Orbit/Transform controls lines 6–13) | Proper creation; ephemeral capture used. |
| GLB Import | Completed | `Workspace.jsx` (GLTFLoader usage lines 8–9) | DRACO & KTX2 loaders imported; ensure decoder paths configured. |
| GLTF Export | Completed | `Workspace.jsx` (exportGLTF lines 1939–1945) | Binary export with optional download toggle. |
| Thumbnail Capture | Completed | `Workspace.jsx` (captureThumbnail lines 109–217) | Ephemeral renderer pattern implemented with retries and fallback. |
| Save Flow (prepareSavePayload) | Completed | `Workspace.jsx` lines 2034–2040 | Constructs FormData with blob and meta. |
| Save Flow (saveSceneToProject) | Partial | `Workspace.jsx` lines 2055–2120 | Uploads assets; lacks multipart / tus fallback integration currently (only server POST). |
| Save Fallback (saveSceneWithFallback) | Completed | `Workspace.jsx` lines after 2120 | IndexedDB backup logic present; improvement: unify with localforage or backup panel UI. |
| IndexedDB/localForage backups | Missing | (localforage present in deps, no UI currently) | Provide a `BackupsPanel` component (missing after revert). |
| Resumable/multipart uploads | Missing | Backend `uploads.js` only presign; no multipart/tus endpoints now (reverted). | Need multipart start/sign/complete + tus server mount. |
| Scene Graph Store | Completed | `SceneGraphStore.js` | Basic object tracking exists. |
| Material Editor | Partial | `MaterialEditor.jsx` | Appears present; audit for applying edits to selected mesh. |
| Post-processing | Partial | `PostProcessing.jsx` lines 2–5 | Uses examples postprocessing directly; not integrated with r3f composer context. |
| Sculpting Tools & History | Partial | `SculptToolbar.jsx`, history in `Workspace.jsx` | History snapshots exist; sculpt event detachment reliability review. |
| Mini Preview / Palette Camera | Partial | `Palette.jsx` (if camera previews) | Needs explicit docs/usage; unclear completeness. |
| Outliner / Properties UI | Completed | `Outliner.jsx`, `ObjectProperties.jsx` | Lists + selection + editing implemented. |
| Dashboard (projects list) | Completed | `Dashboard.jsx` | CRUD implemented with thumbnails and assets. |
| Backend Integration | Completed | API calls via `apiUrl` usage lines (grep results) | Auth context handles login/register. |
| Error Handling & Logging | Partial | Console-based; sparse try/catch | Suggest centralized logger + boundary reuse. |
| Tests & Coverage | Missing | No test framework present. | Add Vitest/Jest + React Testing Library. |
| Linting / Formatting | Missing | No ESLint/Prettier config present. | Add config + CI gating. |
| Perf / Memory Cleanup | Partial | Renderer disposal of objects attempted; risk in large arrays & event listeners | Need systematic disposal of geometries/materials; track raycaster throttling. |

---
## 5. Static Analysis Findings
- Duplicate dependency key for `three` was previously present (now resolved).
- Import corrections: removed `.js` suffix from `three/examples` imports (good).
- Missing imports consistency: Some components use manual Three, others r3f; unify approach or isolate manual workspace.
- Potential memory leaks: Object disposal inside history operations; ensure materials/geometries explicitly disposed (search for `disposeObject` usage – verify thoroughness).
- Heavy synchronous operations: BVH building (if present) should gate on triangle count; check logic (search not included in this snapshot; recommend threshold ~200k). 
- Ephemeral renderer usage for thumbnail is correct; main renderer sets `preserveDrawingBuffer: false` (optimal).

---
## 6. API Endpoint Mapping (Frontend Usage)
| Endpoint | Method | Frontend Caller (file + line approx) | Payload Construction |
|----------|--------|---------------------------------------|---------------------|
| /api/auth/login | POST | `AuthContext.jsx` ~89 | JSON body: email/password |
| /api/auth/register | POST | `AuthContext.jsx` ~112 | JSON body: user fields |
| /api/projects | GET | `Studio.jsx` ~1283 / `Dashboard.jsx` ~209 | Fetch list |
| /api/projects | POST | `Studio.jsx` ~1470 / `Dashboard.jsx` ~415 | FormData or JSON including thumbnail blob & meta |
| /api/projects/:id | GET | `Studio.jsx` ~1321 | Fetch project detail |
| /api/projects/:id | PUT | `Studio.jsx` ~1477 / `Dashboard.jsx` ~459 | Update fields + optional thumbnail |
| /api/projects/:id | DELETE | `Dashboard.jsx` ~488 | Delete project |
| /api/projects/:id/assets | POST | `Workspace.jsx` ~2061–2100 | FormData with GLB blob and asset files |
| /api/scenes | GET | `Dashboard.jsx` ~284 | List scenes |
| /api/scenes/:id | GET | `Studio.jsx` ~1962 | Load scene data |
| /api/uploads/presign | POST | (Not referenced in current UI) | Intended for S3 single-part upload |

Missing: Multipart S3 (`start`, `sign-urls`, `complete`), tus resumable endpoints integration.

---
## 7. Backend Review
- `uploads.js`: only presigned single PUT, no multipart logic.
- `projects.js`: multer usage; no file-size limit tuning beyond default disk storage (should add explicit limits).
- No tus server mount; absence of resumable upload fallback.
- Suggest adding: multipart endpoints & tus mounting in `server.js`; enforce size validation and logging.

---
## 8. Risk / Failing Items
1. Dev server instability (504 optimize deps) – root cause: stale cache & inconsistent dependency versions earlier.
2. Missing multipart/tus upload resilience – large file upload can fail beyond current server limits.
3. Absent backups UI – IndexedDB logic exists but not surfaced.
4. No CI, linting, tests – higher risk for regressions.
5. Partial post-processing integration – direct use of postprocessing without unified effect lifecycle may cause resource leaks.

---
## 9. Reproduction & Environment Setup
### Commands
```bash
# Clean & reinstall
rm -rf node_modules .vite package-lock.json; npm install
npm run dev
```
### Env Variables (Backend)
```
MONGODB_URI=mongodb://localhost:27017/objekta
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=XXXX
AWS_SECRET_ACCESS_KEY=XXXX
S3_BUCKET=your-bucket
S3_PUBLIC_BASE=https://your-cloudfront-domain (optional)
```
### Debug Commands
```bash
npm run dev
curl -I http://localhost:5173
lsof -i :5173
node -v
npm ls three @react-three/fiber @react-three/drei
```
Paste outputs to diagnose further.

---
## 10. Roadmap (3 Sprints)
### Sprint 1 (2 weeks)
- Task: Stabilize dev server (optimizeDeps expansion, dependency audit) — 4h
- Task: Add ESLint + Prettier + basic Vitest setup — 6h
- Task: Implement multipart S3 + tus endpoints — 8h
- Acceptance: `npm run dev` no 504; `npm run lint` passes; multipart upload of >100MB file succeeds.
- PRs: "feat: multipart + tus upload integration", "chore: tooling setup"

### Sprint 2 (3 weeks)
- Task: Backup UI (BackupsPanel) + re-upload logic — 6h
- Task: Refactor post-processing into r3f or centralized composer manager — 8h
- Task: Enhanced material editor (live preview & persistence) — 10h
- Task: Add History/Undo tests (Vitest) — 6h
- Acceptance: Backups visible; ephemeral renderer stable; tests passing CI.
- PRs: "feat: backups panel", "refactor: postprocessing lifecycle"

### Sprint 3 (3 weeks)
- Task: Performance audit (BVH gating, memory disposal coverage) — 8h
- Task: Add project asset S3 registration endpoint — 6h
- Task: CI pipeline with coverage thresholds (>=70%) — 6h
- Task: Developer docs & contributor guide — 4h
- Acceptance: Coverage report ≥70%; memory snapshot stable after heavy scene load; docs published.
- PRs: "perf: disposal & BVH thresholds", "docs: contributor guide"

---
## 11. High-Priority GitHub Issue Templates
1. Title: Dev server 504 optimizeDeps failure
   Description: Vite shows 504 for `@react-three/drei` import. Need cleanup (cache purge, optimizeDeps update, dependency alignment). Steps included.
   Labels: bug, priority-high, build
2. Title: Missing multipart and resumable upload endpoints
   Description: Implement S3 multipart start/sign/complete + tus fallback to support large scene assets.
   Labels: feature, backend, priority-high
3. Title: Add ESLint + Prettier + Vitest baseline
   Description: Establish code quality and testing foundation.
   Labels: tooling, enhancement
4. Title: Implement BackupsPanel UI for IndexedDB restores
   Description: Surface stored scene blobs and enable re-upload.
   Labels: feature, ux

---
## 12. PR Suggestions & Snippets
### A. Vite optimizeDeps & stability
PR Title: chore: enhance optimizeDeps for 3D stack
Files: `vite.config.mjs`
Diff:
```diff
 optimizeDeps: {
-  include: ['three', '@react-three/fiber', '@react-three/drei'],
-  exclude: ['three/examples/jsm']
+  include: ['three', '@react-three/fiber', '@react-three/drei', 'three-mesh-bvh', 'postprocessing'],
+  exclude: ['three/examples/jsm']
 }
```

### B. Save/upload fallback upgrade
PR Title: feat: multipart + tus fallback integration
Files: `backend/routes/uploads.js`, `backend/server.js`, `src/utils/upload.js`, `src/components/BackupsPanel.jsx`, `Workspace.jsx`
Key additions: multipart endpoints, tus server mount, client strategy chooser, UI for backups.

### C. BackupsPanel addition
PR Title: feat: add backups recovery UI
Files: `src/components/BackupsPanel.jsx`, `src/utils/backups.js`

### D. Post-processing lifecycle refactor
PR Title: refactor: central effect composer manager
Files: `PostProcessing.jsx`, new `effects/ComposerManager.js`

### E. Tooling setup
PR Title: chore: add ESLint Prettier Vitest
Files: `.eslintrc.cjs`, `.prettierrc`, `vitest.config.js`, `package.json`

---
## 13. Required Additional Info From User
Please provide:
- Current `npm run dev` full terminal output after clean reinstall.
- Browser console logs on white page load.
- Output of: `npm ls three @react-three/fiber @react-three/drei`

---
## 14. Summary of Immediate Actions
1. Clean reinstall (remove cache, node_modules).
2. Apply optimizeDeps enhancement.
3. Add multipart + tus endpoints.
4. Implement backups UI.
5. Introduce lint/test tooling.

---
End of report.
