# OBJEKTA Contributor Checklist

## 1. Environment Setup
```bash
# Node version (recommend >=20)
node -v
npm -v

# Clone
git clone <repo-url>
cd objekta

# Clean install (if previous artifacts)
rm -rf node_modules .vite package-lock.json
npm install
```

## 2. Run Development Server
```bash
npm run dev
```
Expected: Vite starts on `http://localhost:5173` without 504 optimize errors. If 504 appears:
- Verify `vite.config.mjs` optimizeDeps exclude is `['three/examples/jsm']` (no wildcards)
- Run full clean: `rm -rf node_modules .vite package-lock.json && npm install`

## 3. Build & Preview
```bash
npm run build
npm run preview
```
Expected: Static build succeeds; preview serves compiled assets.

## 4. Add Tooling (if not present)
```bash
npm install -D eslint prettier vitest @testing-library/react @testing-library/jest-dom
```
Create `.eslintrc.cjs`, `.prettierrc`, `vitest.config.js` (see STATUS_REPORT.md suggestions).

## 5. Testing (after setup)
```bash
npm run test
```
Add first test under `src/__tests__/workspace.spec.jsx`:
```jsx
import { describe, it, expect } from 'vitest';

describe('workspace placeholder', () => {
  it('runs baseline test', () => {
    expect(true).toBe(true);
  });
});
```

## 6. Reproducing IndexedDB Fallback Bug
1. Disconnect backend or force upload failure (stop server or throttle network).
2. Trigger scene save in `Workspace` (calls `saveSceneToProject`).
3. Observe console: save error + IndexedDB backup ID.
4. Inspect backup:
   - Open DevTools > Application > IndexedDB > `OBJEKTA_DB_v1` > `backups`.
   - Confirm record with blob and metadata stored.
5. To test recovery (after implementing BackupsPanel): open UI component and re-upload.

## 7. Verifying Ephemeral Thumbnail Capture
- Trigger capture (e.g., project create or manual). Console should log:
  `[OBJEKTA] captureThumbnail ephemeral renderer OK (size=...)`
- Ensure no WebGL context loss errors after repeated captures.

## 8. Upload Strategy Verification (after implementing multipart/tus)
1. Small file (<20MB): should use presigned PUT.
2. Large file (>50MB): should attempt multipart (`start` -> `sign-urls` -> part PUTs -> `complete`).
3. Simulate multipart failure: disable S3 creds → fallback should attempt tus upload.
4. Confirm uploaded asset appears in project assets list.

## 9. Common Debug Commands
```bash
npm ls three @react-three/fiber @react-three/drei
curl -I http://localhost:5173
lsof -i :5173
node -v
```

## 10. Adding BackupsPanel (after creation)
Insert in `Studio.jsx` or global layout:
```jsx
import BackupsPanel from '../components/BackupsPanel';
// ... inside render
<BackupsPanel projectId={activeProjectId} />
```

## 11. Performance Checklist
- Verify BVH generation conditional (triangle threshold) present in `Workspace.jsx`.
- Confirm raycasting throttled (look for RAF-based handler).
- Ensure renderer main config uses `preserveDrawingBuffer: false`.

## 12. Pre-PR Validation
Before opening a PR:
```bash
npm run lint       # (after ESLint setup)
npm run test       # ensure tests pass
npm run build      # production build clean
```

## 13. Release Preparation
- Tag version bump in `package.json`.
- Generate build artifacts.
- Provide CHANGELOG summary.

## 14. Needed Info If Issues Persist
Supply logs:
- Terminal output of `npm run dev`
- Browser console errors
- Output of `npm ls three @react-three/fiber @react-three/drei`

---
This checklist evolves; update as new tooling and features land.
