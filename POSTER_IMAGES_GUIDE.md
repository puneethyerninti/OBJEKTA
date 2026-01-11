# Poster Image Guide

## Required Assets

Place these images in `/public/assets/`:

1. **desk-preview.jpg** (360×280px)
   - Screenshot of cyberpunk_desk.glb
   - Dark background with purple glow
   - Center the desk in frame

2. **laptop-preview.jpg** (360×280px)
   - Screenshot of laptop_free.glb
   - Dark background with cyan glow
   - Center the laptop in frame

3. **porsche-preview.jpg** (360×280px)
   - Screenshot of porsche.glb
   - Dark background with amber/yellow glow
   - Center the car in frame

## How to Generate

### Option 1: Manual Screenshots
1. Open fullscreen modal for each model
2. Take screenshot when model is centered
3. Crop to 360×280px
4. Add slight Gaussian blur (optional, for cyberpunk effect)
5. Save as JPEG (quality 85)

### Option 2: Automated (Three.js renderer)
```javascript
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';

async function generatePoster(modelPath, outputPath) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 360/280, 0.1, 1000);
  camera.position.set(0, 0.4, 5);
  
  const renderer = new THREE.WebGLRenderer({ 
    antialias: true,
    alpha: true,
    preserveDrawingBuffer: true 
  });
  renderer.setSize(360, 280);
  
  const loader = new GLTFLoader();
  const gltf = await loader.loadAsync(modelPath);
  scene.add(gltf.scene);
  
  // Add lights
  const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
  scene.add(ambientLight);
  
  const spotLight = new THREE.SpotLight(0x7f5af0, 15);
  spotLight.position.set(10, 10, 10);
  scene.add(spotLight);
  
  renderer.render(scene, camera);
  
  // Convert canvas to blob and save
  renderer.domElement.toBlob((blob) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = outputPath;
    a.click();
  }, 'image/jpeg', 0.85);
}
```

### Option 3: Fallback (No Images)
If you don't create posters, the code will show a placeholder SVG shield icon. This is acceptable for development but not recommended for production.

## Image Optimization

After generating posters:

```bash
# Using ImageMagick
convert desk-preview.jpg -quality 85 -sampling-factor 4:2:0 desk-preview-optimized.jpg

# Using modern tools
npx @squoosh/cli --resize '{width:360,height:280}' --mozjpeg '{quality:85}' desk-preview.jpg
```

## Expected File Sizes
- **Uncompressed**: ~150-200KB per image
- **Optimized**: ~40-60KB per image
- **Total**: ~120-180KB for all 3

---

**Note**: These posters are only for the homepage cards. The actual 3D models load in the fullscreen modal when clicked.
