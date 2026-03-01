import React, { useMemo, useEffect, useState, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

// --- HOLOGRAM GLSL SHADERS ---

const hologramVertexShader = `
uniform float uTime; 
varying vec3 vWorldNormal;
varying float vFresnel;
varying vec3 vWorldPos;

void main() {
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vec3 worldNormal = normalize(mat3(modelMatrix) * normal);
    vec3 viewDirection = normalize(cameraPosition - worldPosition.xyz);
    
    vFresnel = 1.0 - abs(dot(worldNormal, viewDirection));

    // Temporal Distortion: Subtle wave/flicker effect applied to position
    float distortion = sin(worldPosition.y * 4.0 + uTime * 2.0) * 0.008; 
    vec3 displacedPosition = position + normal * distortion;

    vWorldNormal = worldNormal;
    vWorldPos = worldPosition.xyz;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(displacedPosition, 1.0);
}
`;

const hologramFragmentShader = `
varying float vFresnel;
varying vec3 vWorldNormal;
varying vec3 vWorldPos;
uniform float uTime;
uniform vec3 uColor;

float hash(vec2 p){
  p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
  return fract(sin(p.x + p.y) * 43758.5453);
}

void main() {
    float fres = pow(vFresnel, 2.2);
    float scan = 0.85 + 0.15 * sin(vWorldPos.y * 80.0 + uTime * 1.8);
    float flicker = smoothstep(0.0, 1.0, 0.7 + 0.3 * sin(uTime * 8.0));

    // Rim light using world normal vs forward axis
    float rim = pow(1.0 - abs(dot(normalize(vWorldNormal), vec3(0.0,0.0,1.0))), 1.4);

    // Occasional artifact line (rare)
    float artifact = step(0.995, hash(vWorldPos.xy + uTime));

    vec3 col = uColor;
    col += vec3(0.08, 0.12, 0.25) * rim; // bluish rim
    col = mix(col, vec3(1.0, 0.5, 0.2), artifact * 0.6);

    float alpha = clamp(fres * scan * flicker + rim * 0.15, 0.0, 1.0);
    gl_FragColor = vec4(col * alpha * 0.9, alpha * 0.5);
}
`;

// PreviewGLTF: shows a static, non-animated preview of a GLTF model.
// Accepts either a preloaded `gltf` prop or a `src` URL to load immediately.
export default function PreviewGLTF({ src, gltf, fitSize = 3, fitAxis = 'max', position = [0,0,0], rotation = [0,0,0] }) {
  const [local, setLocal] = useState(gltf || null);
  const mixerRef = useRef(null);

  // Create hologram materials for preview (subtle version)
  const hologramMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uColor: { value: new THREE.Color('#4a90e2').multiplyScalar(3.0) }, // softer blue for previews
      },
      vertexShader: hologramVertexShader,
      fragmentShader: hologramFragmentShader,
      transparent: true,
      side: THREE.DoubleSide,
    });
  }, []);

  useEffect(() => {
    let mounted = true;
    
    // Create custom loading manager to handle blob URLs
    const manager = new THREE.LoadingManager();
    
    // Create null texture loader that returns placeholder textures for blob URLs
    class NullTextureLoader extends THREE.TextureLoader {
      constructor(manager) {
        super(manager);
      }
      
      load(url, onLoad, _onProgress, _onError) {
        // Create a 1x1 transparent placeholder texture
        const canvas = document.createElement('canvas');
        canvas.width = 1;
        canvas.height = 1;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = 'rgba(0,0,0,0)'; // transparent
        ctx.fillRect(0, 0, 1, 1);
        
        const tex = new THREE.Texture(canvas);
        tex.encoding = THREE.sRGBEncoding;
        tex.needsUpdate = true;
        
        // Signal loading completion immediately
        if (onLoad) {
          // Use setTimeout to ensure async behavior matches real loader
          setTimeout(() => onLoad(tex), 0);
        }
        return tex;
      }
    }
    
    // Add handler for blob URLs to use null loader
    manager.addHandler(/blob:/, new NullTextureLoader(manager));
    
    // Add handler for all texture files to use null loader
    manager.addHandler(/\.(jpg|jpeg|png|gif|bmp|tga|dds|ktx|ktx2|webp)$/i, new NullTextureLoader(manager));
    
    // Configure GLTF loader with custom manager
    const loader = new GLTFLoader(manager);
    loader.setCrossOrigin('anonymous');
    
    if (typeof MeshoptDecoder !== 'undefined' && MeshoptDecoder) {
      try { loader.setMeshoptDecoder(MeshoptDecoder); } catch (e) {}
    }

    const sanitizeTex = (tex) => {
      if (!tex) return;
      try {
        tex.encoding = THREE.sRGBEncoding;
        if (Object.prototype.hasOwnProperty.call(tex, 'colorSpace')) {
          try { delete tex.colorSpace; } catch (e) { tex.colorSpace = undefined; }
        }
        tex.needsUpdate = true;
      } catch (e) {}
    };

    const sanitizeScene = (data) => {
      try {
        if (data && data.scene) {
          data.scene.traverse((c) => {
            if (c.isMesh && c.material) {
              const mats = Array.isArray(c.material) ? c.material : [c.material];
              mats.forEach((m) => {
                sanitizeTex(m.map);
                sanitizeTex(m.emissiveMap);
                sanitizeTex(m.roughnessMap);
                sanitizeTex(m.metalnessMap);
                sanitizeTex(m.normalMap);
                sanitizeTex(m.aoMap);
                sanitizeTex(m.alphaMap);
                sanitizeTex(m.displacementMap);
              });
            }
          });
        }
      } catch (e) {
        console.debug('[PreviewGLTF] texture sanitize failed', e);
      }
    };

    // If caller passed an ArrayBuffer (prefetched raw .glb), parse it per-canvas
    if (gltf && gltf instanceof ArrayBuffer) {
      try {
        loader.parse(gltf, '', (data) => {
          if (!mounted) return;
          sanitizeScene(data);
          setLocal(data);
        }, (err) => {
          console.error('[PreviewGLTF] parse error', err);
        });
      } catch (e) {
        console.error('[PreviewGLTF] parse exception', e);
      }
      return () => { mounted = false; };
    }

    // If caller passed an already-parsed GLTF object, use it directly
    if (gltf && typeof gltf === 'object' && gltf.scene) {
      sanitizeScene(gltf);
      setLocal(gltf);
      return undefined;
    }

    // Fallback: attempt to fetch the URL as ArrayBuffer and parse to avoid
    // GLTFLoader creating/resolving blob: URLs which can get revoked.
    if (src) {
      (async () => {
        try {
          const resp = await fetch(src);
          if (!resp.ok) throw new Error('fetch failed: ' + resp.status);
          const ab = await resp.arrayBuffer();
          loader.parse(ab, '', (data) => {
            if (!mounted) return;
            sanitizeScene(data);
            setLocal(data);
          }, (err) => {
            console.error('[PreviewGLTF] parse error after fetch', err);
          });
        } catch (e) {
          // If fetch/parse fails (for example blob: URLs not fetchable),
          // fall back to loader.load which will try the default loading path.
          try {
            loader.load(src, (data) => {
              if (!mounted) return;
              sanitizeScene(data);
              setLocal(data);
            }, undefined, (err) => {
              console.error('[PreviewGLTF] load error fallback', err);
            });
          } catch (err) {
            console.error('[PreviewGLTF] fetch+load fallback failed', err);
          }
        }
      })();
    }

    return () => { mounted = false; };
  }, [src, gltf]);

  const scene = useMemo(() => {
    const source = local;
    if (!source || !source.scene) return null;
    const cloned = SkeletonUtils.clone(source.scene);
    try {
      const box = new THREE.Box3().setFromObject(cloned);
      const center = new THREE.Vector3();
      const size = new THREE.Vector3();
      box.getCenter(center);
      box.getSize(size);
      const axis = fitAxis === 'x' ? size.x : fitAxis === 'y' ? size.y : fitAxis === 'z' ? size.z : Math.max(size.x, size.y, size.z);
      const targetAxis = axis || 1;
      const scaleFactor = fitSize / targetAxis;
      cloned.position.set(-center.x, -center.y, -center.z);
      cloned.scale.setScalar(scaleFactor);
      const boxAfter = new THREE.Box3().setFromObject(cloned);
      if (boxAfter && typeof boxAfter.min?.y === 'number') {
        cloned.position.y += -boxAfter.min.y;
      }

      cloned.traverse((c) => {
          if (c.isMesh) {
            c.frustumCulled = false;
            // Replace original materials with hologram shader for consistent holographic look
            c.material = hologramMaterial;
            c.castShadow = false;
            c.receiveShadow = false;
          }
        });

      // No texture sanitation needed for hologram materials
    } catch (e) {
      // ignore
    }
    return cloned;
  }, [local, fitSize, fitAxis, hologramMaterial]);

  useEffect(() => {
    if (scene && local && local.animations && local.animations.length > 0) {
      const mixer = new THREE.AnimationMixer(scene);
      local.animations.forEach((clip) => {
        mixer.clipAction(clip).play();
      });
      mixerRef.current = mixer;
    } else {
      mixerRef.current = null;
    }
  }, [scene, local]);

  useFrame((state, delta) => {
    if (mixerRef.current) {
      mixerRef.current.update(delta);
    }
    // Update hologram shader time for animation effects
    const elapsed = state.clock.elapsedTime;
    if (hologramMaterial?.uniforms?.uTime) {
      hologramMaterial.uniforms.uTime.value = elapsed;
    }
  });

  // NOTE: Removed procedural PMREM/IBL generation because it triggered
  // "Unsupported texture color space" errors in some GLTFs. Using
  // simple material/texture sanitation above should avoid white models.

  if (!scene) return null;
  return (
    <>
      <group position={position} rotation={rotation}>
        <primitive object={scene} dispose={null} />
      </group>
    </>
  );
}
