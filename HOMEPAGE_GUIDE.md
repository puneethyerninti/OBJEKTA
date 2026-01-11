# OBJEKTA Homepage - Implementation Guide

## 📦 NPM Dependencies

```bash
npm install three @react-three/fiber @react-three/drei framer-motion react-icons gsap
```

**Optional but recommended:**
```bash
npm install @react-three/postprocessing leva
```

## 🎨 Design System Summary

### Color Palettes

**Default TRON Palette:**
- Primary: `#00F0FF` (Cyan neon)
- Secondary: `#FF00D5` (Magenta neon)
- Accent: `#7F5AF0` (Electric violet)
- Background: `#0A0A0F` (Deep space black)
- Surface: `#151520` (Dark gray-blue)

**Alternative Palettes:** See `src/styles/tokens.json` for Alt1 and Alt2 variants.

### Typography

- **UI Font:** Inter (400, 500, 600, 700, 900)
- **Display Font:** Orbitron (400, 700, 900) with Audiowide fallback
- **Mono Font:** JetBrains Mono / Fira Code

### Animation Timing

- **Fast:** 150ms (micro-interactions)
- **Normal:** 300ms (buttons, hovers)
- **Slow:** 600ms (page transitions)
- **Easing:** `cubic-bezier(0.22, 0.9, 0.37, 1)` (smooth) or `cubic-bezier(0.34, 1.56, 0.64, 1)` (spring)

---

## 🏗️ Component Architecture

### Component Tree (Homepage)

```
HomePage
├── Hero3D (react-three-fiber canvas)
│   ├── NeonGrid (animated mesh with shader)
│   └── Particles (floating ambient particles)
├── HeroControls (Framer Motion CTAs)
│   ├── NeonButton (primary actions)
│   └── FeaturePill (feature badges)
├── NavBar (sticky glassmorphic header)
├── QuickSearch (modal with fuzzy search)
├── ProjectGrid (scroll-reveal cards)
└── Footer
```

### File Structure

```
src/
├── components/
│   ├── Hero3D.jsx                 ✅ Created
│   ├── HeroControls.jsx           ✅ Created
│   ├── QuickSearch.jsx            ✅ Created
│   ├── Navbar.jsx                 (existing, compatible)
│   ├── ProjectGrid.jsx            (existing, needs styling)
│   └── Footer.jsx                 (existing, needs styling)
├── styles/
│   ├── tokens.json                ✅ Created
│   ├── theme.css                  ✅ Created (global styles)
│   ├── HeroControls.css           ✅ Created
│   ├── NavBar.css                 ✅ Created
│   └── QuickSearch.css            ✅ Created
└── pages/
    └── Home.jsx                   ⚠️ Needs implementation
```

---

## 🚀 Implementation Steps

### 1. Update Home.jsx

```jsx
// src/pages/Home.jsx
import React, { useState, Suspense, lazy } from 'react';
import { motion } from 'framer-motion';
import HeroControls from '../components/HeroControls';
import QuickSearch from '../components/QuickSearch';
import Loader from '../components/Loader';

// Lazy-load 3D component (desktop only)
const Hero3D = lazy(() => import('../components/Hero3D'));

// Detect mobile
const isMobile = typeof window !== 'undefined' && window.innerWidth <= 1024;

export default function Home() {
  const [searchOpen, setSearchOpen] = useState(false);
  const [projects, setProjects] = useState([]);

  const handleNewProject = () => {
    // Navigate to studio or open dialog
    console.log('New project');
  };

  const handleUpload = () => {
    // Open file picker
    console.log('Upload GLB');
  };

  const handleSearchOpen = () => {
    setSearchOpen(true);
  };

  const handleSelectProject = (project) => {
    // Navigate to project
    console.log('Selected:', project);
  };

  return (
    <div className="home-page">
      {/* Hero Section with 3D Background */}
      <section className="hero-section">
        {!isMobile ? (
          <Suspense fallback={<Loader />}>
            <div className="hero-3d-wrapper">
              <Hero3D enableInteraction />
            </div>
          </Suspense>
        ) : (
          <div className="hero-3d-fallback" />
        )}

        {/* Overlay Controls */}
        <div className="hero-overlay">
          <HeroControls
            onNewProject={handleNewProject}
            onUpload={handleUpload}
            onOpenSearch={handleSearchOpen}
          />
        </div>
      </section>

      {/* Quick Search Modal */}
      <QuickSearch
        isOpen={searchOpen}
        onClose={() => setSearchOpen(false)}
        projects={projects}
        onSelectProject={handleSelectProject}
      />

      {/* Additional sections: ProjectGrid, Gallery, Footer, etc. */}
    </div>
  );
}
```

### 2. Add Global CSS Imports

In `src/main.jsx` or `src/index.jsx`:

```jsx
import './styles/theme.css';
import './index.css';
```

### 3. Update Home Page CSS

```css
/* src/styles/Home.css or inline in Home.jsx */
.home-page {
  position: relative;
  min-height: 100vh;
}

.hero-section {
  position: relative;
  width: 100%;
  height: 100vh;
  overflow: hidden;
}

.hero-3d-wrapper {
  position: absolute;
  inset: 0;
  z-index: 1;
}

.hero-3d-fallback {
  position: absolute;
  inset: 0;
  z-index: 1;
  background: radial-gradient(
    ellipse at 30% 40%,
    rgba(0, 240, 255, 0.15) 0%,
    transparent 50%
  ),
  radial-gradient(
    ellipse at 70% 60%,
    rgba(255, 0, 213, 0.12) 0%,
    transparent 50%
  ),
  linear-gradient(180deg, transparent 0%, rgba(10, 10, 15, 0.8) 100%);
}

.hero-overlay {
  position: relative;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
}
```

---

## 🎬 Animation Examples

### Framer Motion Variants (Reusable)

```jsx
// src/utils/animations.js
export const fadeInUp = {
  hidden: { opacity: 0, y: 40 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.8, ease: [0.22, 0.9, 0.37, 1] },
  },
};

export const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.15, delayChildren: 0.2 },
  },
};

export const scaleIn = {
  hidden: { scale: 0.8, opacity: 0 },
  visible: {
    scale: 1,
    opacity: 1,
    transition: { duration: 0.6, ease: [0.34, 1.56, 0.64, 1] },
  },
};
```

### GSAP Timeline Example (Complex Sequences)

```jsx
import { useEffect, useRef } from 'react';
import gsap from 'gsap';

function AnimatedSection() {
  const sectionRef = useRef(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });

      tl.from('.card', {
        opacity: 0,
        y: 60,
        stagger: 0.1,
        duration: 0.8,
      })
        .from('.title', { scale: 0.8, opacity: 0, duration: 0.6 }, '-=0.4')
        .from('.badge', { scale: 0, stagger: 0.05, duration: 0.5 }, '-=0.3');
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return <section ref={sectionRef}>{/* content */}</section>;
}
```

---

## 🔧 Performance Optimizations

### 1. Lazy Load 3D on Desktop Only

```jsx
const Hero3D = lazy(() => import('../components/Hero3D'));
const isMobile = window.innerWidth <= 1024;

{!isMobile && (
  <Suspense fallback={<Loader />}>
    <Hero3D />
  </Suspense>
)}
```

### 2. Prefetch Assets with Idle Callback

```jsx
useEffect(() => {
  const preloadAssets = () => {
    // Preload fonts, images, etc.
    const link = document.createElement('link');
    link.rel = 'preload';
    link.href = '/hero-background.webp';
    link.as = 'image';
    document.head.appendChild(link);
  };

  if ('requestIdleCallback' in window) {
    requestIdleCallback(preloadAssets, { timeout: 1000 });
  } else {
    setTimeout(preloadAssets, 100);
  }
}, []);
```

### 3. DRACO Compression for GLB Models

```jsx
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';

const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath('/draco/'); // Download from three.js examples
const gltfLoader = new GLTFLoader();
gltfLoader.setDRACOLoader(dracoLoader);
```

### 4. LRU Cache for Assets (Pseudocode)

```js
class LRUCache {
  constructor(maxSize = 50) {
    this.cache = new Map();
    this.maxSize = maxSize;
  }

  get(key) {
    if (!this.cache.has(key)) return null;
    const value = this.cache.get(key);
    this.cache.delete(key);
    this.cache.set(key, value); // Move to end
    return value;
  }

  set(key, value) {
    if (this.cache.has(key)) this.cache.delete(key);
    this.cache.set(key, value);
    if (this.cache.size > this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
  }
}

const assetCache = new LRUCache(50);
```

### 5. Throttle Animation Updates

```jsx
import { useFrame } from '@react-three/fiber';

useFrame((state, delta) => {
  // Throttle to 30fps for heavy operations
  if (state.clock.elapsedTime % (1 / 30) < delta) {
    // Update heavy shader uniforms
  }
});
```

---

## ♿ Accessibility Checklist

### Keyboard Navigation

- ✅ All interactive elements focusable with Tab
- ✅ Focus visible with `outline: 2px solid var(--color-primary)`
- ✅ Escape key closes modals
- ✅ Arrow keys navigate search results
- ✅ Cmd/Ctrl+K opens search, Cmd/Ctrl+N new project

### ARIA Labels

```jsx
<button aria-label="Start new project (Cmd+N)">
  <FiPlay aria-hidden="true" />
  Start Creating
</button>

<nav aria-label="Main navigation">
  {/* nav links */}
</nav>

<div role="dialog" aria-modal="true" aria-labelledby="search-title">
  {/* modal content */}
</div>
```

### Reduced Motion

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

### Color Contrast

- Primary cyan `#00F0FF` on dark `#0A0A0F`: **WCAG AAA** (>7:1)
- Text `#E8E8F0` on dark `#0A0A0F`: **WCAG AAA** (>14:1)
- Muted text `#9CA3AF` on dark: **WCAG AA** (>4.5:1)

### Accessible Theme Toggle

```jsx
const [neonEnabled, setNeonEnabled] = useState(true);

// Apply data-theme attribute
useEffect(() => {
  document.documentElement.setAttribute(
    'data-theme',
    neonEnabled ? 'default' : 'accessible'
  );
}, [neonEnabled]);
```

---

## 🧪 Testing Checklist

### Cross-Browser Testing

- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest, including iOS Safari)
- [ ] Edge (latest)

### Device Testing

- [ ] Desktop 1920×1080
- [ ] Laptop 1366×768
- [ ] Tablet 768×1024 (iPad)
- [ ] Mobile 375×667 (iPhone SE)
- [ ] Mobile 414×896 (iPhone 11)

### Lighthouse Targets

| Metric | Target | Notes |
|--------|--------|-------|
| Performance | 90+ | Desktop; 70+ mobile (3D loading) |
| Accessibility | 100 | Full WCAG 2.1 AA compliance |
| Best Practices | 95+ | HTTPS, console errors clean |
| SEO | 100 | Meta tags, semantic HTML |

### Manual Tests

- [ ] Keyboard navigation works (Tab, Enter, Escape, Arrows)
- [ ] Screen reader announces elements correctly
- [ ] 3D scene loads without errors
- [ ] Search fuzzy matching works
- [ ] Buttons show ripple effect on click
- [ ] Hover states trigger correctly
- [ ] Mobile menu opens/closes
- [ ] Page doesn't reflow/jank on scroll
- [ ] No console errors or warnings
- [ ] Works with JavaScript disabled (graceful degradation)

---

## 📋 Performance TODO Checklist

### Critical Path

- [x] Design tokens defined
- [x] Hero3D component created with LOD
- [x] Framer Motion variants for reveals
- [ ] Implement lazy loading for all non-critical components
- [ ] Add `<link rel="preload">` for hero fonts
- [ ] Set up service worker for offline caching

### 3D Optimization

- [ ] Download DRACO decoder and configure GLTFLoader
- [ ] Implement LOD (Level of Detail) switching based on device
- [ ] Use `gl.setPixelRatio(Math.min(window.devicePixelRatio, 2))`
- [ ] Add `performance={{ min: 0.5 }}` to Canvas
- [ ] Use `<AdaptiveDpr />` from drei for auto-quality adjustment
- [ ] Compress textures to WebP/Basis format

### Asset Loading

- [ ] Implement LRU cache for textures/models
- [ ] Use `requestIdleCallback` for non-critical preloads
- [ ] Add progressive image loading (blur-up placeholder)
- [ ] Bundle split: vendor, 3D libs, app code
- [ ] Tree-shake unused drei/three exports

### Runtime Performance

- [ ] Throttle scroll listeners with `requestAnimationFrame`
- [ ] Use `will-change: transform` sparingly (only during animation)
- [ ] Avoid layout thrash: batch DOM reads/writes
- [ ] Memoize expensive calculations with `useMemo`
- [ ] Debounce search input (200-300ms)

---

## 🎯 Acceptance Criteria

### Visual Quality

✅ Page reflects TRON/cyberpunk aesthetic with neon accents  
✅ Glassmorphic cards with subtle blur and glow  
✅ Typography hierarchy clear (Orbitron display, Inter UI)  
✅ Consistent 8pt spacing grid applied  
✅ Subtle noise texture and vignette present  

### Animation Quality

✅ Smooth 60fps on modern desktop (check DevTools Performance)  
✅ Hero 3D grid animates with mouse parallax  
✅ Scroll-driven reveals trigger at correct viewports  
✅ Button ripples and scale effects responsive  
✅ No jank or reflow during page transitions  

### Accessibility

✅ All interactive elements keyboard-navigable  
✅ Focus indicators visible and high-contrast  
✅ ARIA labels present on icons and controls  
✅ Color contrast meets WCAG AA minimum  
✅ Works with reduced-motion preference  

### Performance

✅ Lighthouse Performance score 90+ (desktop)  
✅ Time to Interactive < 3s on 4G connection  
✅ 3D scene loads progressively with fallback  
✅ No console errors or warnings  
✅ Responsive on mobile without layout shift  

### Functionality

✅ Cmd/Ctrl+K opens quick search  
✅ Fuzzy search matches project names  
✅ Mobile menu opens/closes correctly  
✅ 3D degrades gracefully on unsupported devices  
✅ All buttons and links navigate correctly  

---

## 📦 Final Integration Checklist

1. **Install Dependencies:**
   ```bash
   npm install three @react-three/fiber @react-three/drei framer-motion react-icons
   ```

2. **Import Global Styles:**
   Add to `src/main.jsx`:
   ```jsx
   import './styles/theme.css';
   ```

3. **Implement Home Page:**
   Copy the Home.jsx implementation from Step 1 above.

4. **Test Locally:**
   ```bash
   npm run dev
   ```
   Open http://localhost:5173 and verify:
   - Hero 3D renders
   - Animations trigger
   - Search opens with Cmd+K

5. **Build & Deploy:**
   ```bash
   npm run build
   npm run preview
   ```

6. **Run Lighthouse:**
   Open Chrome DevTools → Lighthouse → Run audit

---

## 🚨 Common Issues & Fixes

### Issue: 3D Scene Not Rendering

**Fix:** Ensure Three.js and react-three-fiber are installed:
```bash
npm install three@0.160.0 @react-three/fiber@8.15.0
```

### Issue: Framer Motion Not Animating

**Fix:** Wrap component in motion provider and check variants are passed:
```jsx
<motion.div initial="hidden" animate="visible" variants={fadeInUp}>
```

### Issue: Backdrop-filter Not Working in Firefox

**Fix:** Add vendor prefix:
```css
-webkit-backdrop-filter: blur(16px);
backdrop-filter: blur(16px);
```

### Issue: Search Modal Not Closing

**Fix:** Ensure z-index is high enough (10000+) and backdrop click handler present.

---

## 🎓 Resources

- [React Three Fiber Docs](https://docs.pmnd.rs/react-three-fiber)
- [Framer Motion API](https://www.framer.com/motion/)
- [Three.js Examples](https://threejs.org/examples/)
- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [Web Performance Optimization](https://web.dev/fast/)

---

**End of Implementation Guide**
