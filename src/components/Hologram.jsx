import React, { useMemo, useRef, useCallback, useEffect, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import * as THREE from 'three';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';

// --- GLSL SHADERS ---

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

/**
 * Renders a GLTF model as an animated, color-customizable hologram.
 */
export default function Hologram({
    modelPath,
    gltf: prefetchedGltf,
    color = new THREE.Color('#1e90ff'),
    fitSize = 2.8,
    fitAxis = 'max',
    showPlaceholder = true,
    onBoundsComputed = null,
    // control overall animation strength
    animationIntensity = 1.6,
    ...groupProps
}) {
    const { gl } = useThree();

    const ktx2Loader = useMemo(() => {
        if (!gl) return null;
        const loader = new KTX2Loader().setTranscoderPath('https://unpkg.com/three@0.161.0/examples/jsm/libs/basis/');
        loader.detectSupport(gl);
        return loader;
    }, [gl]);

    useEffect(() => () => { ktx2Loader?.dispose(); }, [ktx2Loader]);

    const extendLoader = useCallback((loader) => {
        loader.setCrossOrigin('anonymous');
        if (MeshoptDecoder) loader.setMeshoptDecoder(MeshoptDecoder);
        if (ktx2Loader) loader.setKTX2Loader(ktx2Loader);
    }, [ktx2Loader]);

    // Load GLTF manually so we can show an immediate placeholder
    const [gltf, setGltf] = useState(null);
    const [isLoaded, setIsLoaded] = useState(false);
    const [hasError, setHasError] = useState(false);

    useEffect(() => {
        let cancelled = false;

        // If prefetched GLTF is provided, use it directly
        if (prefetchedGltf) {
            if (prefetchedGltf instanceof ArrayBuffer) {
                // Parse the ArrayBuffer
                const loader = new GLTFLoader();
                extendLoader(loader);
                try {
                    loader.parse(prefetchedGltf, '', (data) => {
                        if (cancelled) return;
                        setGltf(data);
                        setIsLoaded(true);
                        console.log('[Hologram] Loaded from prefetched data', modelPath);
                    }, (err) => {
                        console.error('[Hologram] Prefetched GLTF parse error', err);
                        if (!cancelled) setHasError(true);
                    });
                } catch (e) {
                    console.error('[Hologram] Prefetched GLTF parse exception', e);
                    if (!cancelled) setHasError(true);
                }
            } else if (prefetchedGltf.scene) {
                // Already parsed GLTF object
                setGltf(prefetchedGltf);
                setIsLoaded(true);
                console.log('[Hologram] Using prefetched GLTF object', modelPath);
            }
            return () => { cancelled = true; };
        }

        // Create a LoadingManager that returns a safe placeholder for blob: texture URLs
        const manager = new THREE.LoadingManager();

        class NullTextureLoader extends THREE.TextureLoader {
            constructor(mgr) { super(mgr); }
            load(url, onLoad, onProgress, onError) {
                try {
                    const canvas = document.createElement('canvas');
                    canvas.width = 1;
                    canvas.height = 1;
                    const ctx = canvas.getContext('2d');
                    ctx.fillStyle = 'rgba(0,0,0,0)';
                    ctx.fillRect(0, 0, 1, 1);
                    const tex = new THREE.Texture(canvas);
                    tex.encoding = THREE.sRGBEncoding;
                    tex.needsUpdate = true;
                    if (onLoad) setTimeout(() => onLoad(tex), 0);
                    return tex;
                } catch (e) {
                    if (onError) setTimeout(() => onError(e), 0);
                    return null;
                }
            }
        }

        // Attach handler for blob: and common image extensions to avoid revoked blob errors
        manager.addHandler(/blob:/, new NullTextureLoader(manager));
        manager.addHandler(/\.(jpg|jpeg|png|gif|bmp|tga|dds|ktx|ktx2|webp)$/i, new NullTextureLoader(manager));

        const loader = new GLTFLoader(manager);
        extendLoader(loader);

        loader.load(
            modelPath,
            (data) => {
                if (cancelled) return;
                // sanitize textures if present
                try {
                    if (data && data.scene) {
                        data.scene.traverse((c) => {
                            if (c.isMesh && c.material) {
                                const mats = Array.isArray(c.material) ? c.material : [c.material];
                                mats.forEach((m) => {
                                    const texs = ['map','emissiveMap','roughnessMap','metalnessMap','normalMap','aoMap','alphaMap','displacementMap'];
                                    texs.forEach((k) => {
                                        const t = m[k];
                                        if (t) {
                                            try { t.encoding = THREE.sRGBEncoding; t.needsUpdate = true; } catch(e){}
                                        }
                                    });
                                });
                            }
                        });
                    }
                } catch (e) { /* non-fatal */ }

                setGltf(data);
                setIsLoaded(true);
                console.log('[Hologram] Loaded successfully', modelPath);
            },
            undefined,
            (err) => {
                console.error('[Hologram] GLTF load error', err);
                if (!cancelled) setHasError(true);
            }
        );

        return () => {
            cancelled = true;
            try { loader.dispose && loader.dispose(); } catch (e) {}
        };
    }, [modelPath, prefetchedGltf, extendLoader]);

    // CRITICAL: Clone the scene to avoid mutating cached GLTF data
    const scene = useMemo(() => {
        if (!gltf || !gltf.scene) return null;
        return SkeletonUtils.clone(gltf.scene);
    }, [gltf]);

    useMemo(() => {
        if (!scene) return;
        if (typeof fitSize !== 'number' || fitSize <= 0) return;
        const box = new THREE.Box3().setFromObject(scene);
        const center = new THREE.Vector3();
        const size = new THREE.Vector3();
        box.getCenter(center);
        box.getSize(size);
        const axis = fitAxis === 'x' ? size.x : fitAxis === 'y' ? size.y : fitAxis === 'z' ? size.z : Math.max(size.x, size.y, size.z);
        const targetAxis = axis || 1;
        const scaleFactor = fitSize / targetAxis;
        scene.position.set(-center.x, -center.y, -center.z);
        scene.scale.setScalar(scaleFactor);
        // After scaling, recompute bounds and shift only in Y so the model's
        // minimum Y sits on world ground (y=0). This prevents the model
        // from intersecting the grid plane in the background scene.
        const boxAfter = new THREE.Box3().setFromObject(scene);
        if (boxAfter && typeof boxAfter.min?.y === 'number') {
            // shift scene up by the negative of the minY so minY === 0
            scene.position.y += -boxAfter.min.y;
        }

        // Notify parent about computed bounds so the Scene can align the grid
        try {
            if (typeof onBoundsComputed === 'function') {
                const centerAfter = new THREE.Vector3();
                const sizeAfter = new THREE.Vector3();
                boxAfter.getCenter(centerAfter);
                boxAfter.getSize(sizeAfter);
                onBoundsComputed({ box: boxAfter, center: centerAfter, size: sizeAfter, scale: scene.scale.x });
            }
        } catch (e) {
            // Do not block rendering on callback errors
            console.debug('[Hologram] onBoundsComputed callback error', e);
        }
    }, [scene, fitSize, fitAxis]);

    const groupRef = useRef();
    const initialPosition = useMemo(() => {
        if (!Array.isArray(groupProps?.position)) return [0, 0, 0];
        const [x = 0, y = 0, z = 0] = groupProps.position;
        return [x, y, z];
    }, [groupProps?.position]);
    const initialRotation = useMemo(() => {
        if (!Array.isArray(groupProps?.rotation)) return [0, 0, 0];
        const [x = 0, y = 0, z = 0] = groupProps.rotation;
        return [x, y, z];
    }, [groupProps?.rotation]);

    const createMaterial = useCallback((skinning = false) => {
        const material = new THREE.ShaderMaterial({
            uniforms: {
                uTime: { value: 0 },
                uColor: { value: color.clone().multiplyScalar(5.0) },
            },
            vertexShader: hologramVertexShader,
            fragmentShader: hologramFragmentShader,
            transparent: true,
            side: THREE.DoubleSide,
        });
        material.skinning = skinning;
        return material;
    }, [color]);

    const hologramMaterial = useMemo(() => createMaterial(false), [createMaterial]);
    const hologramSkinnedMaterial = useMemo(() => createMaterial(true), [createMaterial]);

    useMemo(() => {
        if (!scene) return;

        // After fit, compute a heuristic threshold for what counts as a "small" part
        // Small parts will receive subtle motion; large structural meshes remain static
        const sceneBox = new THREE.Box3().setFromObject(scene);
        const sceneSize = new THREE.Vector3();
        sceneBox.getSize(sceneSize);
        const sceneMax = Math.max(sceneSize.x, sceneSize.y, sceneSize.z) || fitSize || 1;
        const smallThreshold = Math.max(0.12 * sceneMax, fitSize * 0.18);

        scene.traverse((child) => {
            if (child.isMesh) {
                child.material = child.isSkinnedMesh ? hologramSkinnedMaterial : hologramMaterial;
                child.frustumCulled = false;
                // store base rotation for subtle per-part motion
                child.userData._baseRotation = child.rotation.clone();
                child.userData._animOffset = Math.random() * 6.2831;

                // Compute bounding box for the child to decide if it should animate
                try {
                    const cb = new THREE.Box3().setFromObject(child);
                    const csize = new THREE.Vector3();
                    cb.getSize(csize);
                    const cmax = Math.max(csize.x, csize.y, csize.z);

                    // Name-based allowlist for parts we definitely want animated
                    const name = (child.name || '').toLowerCase();
                    const animateName = /prop|antenna|light|lamp|panel|detail|decal/.test(name);

                    // Animate only if small OR name matches detail patterns
                    child.userData._shouldAnimate = animateName || (cmax > 0 && cmax <= smallThreshold);
                    child.userData._sizeMetric = cmax;
                } catch (e) {
                    child.userData._shouldAnimate = false;
                }
            }
        });
    }, [scene, hologramMaterial, hologramSkinnedMaterial, fitSize]);

    useFrame((state) => {
        const elapsed = state.clock.elapsedTime;
        if (hologramMaterial && hologramMaterial.uniforms && hologramMaterial.uniforms.uTime) {
            hologramMaterial.uniforms.uTime.value = elapsed;
        }
        if (hologramSkinnedMaterial && hologramSkinnedMaterial.uniforms && hologramSkinnedMaterial.uniforms.uTime) {
            hologramSkinnedMaterial.uniforms.uTime.value = elapsed;
        }

        // Enhanced bobbing motion and subtle rotation for the whole group
        if (groupRef.current) {
            const bobY = Math.sin(elapsed * 0.9) * (0.06 * animationIntensity);
            const swayX = Math.sin(elapsed * 0.2) * (0.02 * animationIntensity);
            const swayZ = Math.cos(elapsed * 0.15) * (0.02 * animationIntensity);
            const yaw = Math.sin(elapsed * 0.12) * (0.04 * animationIntensity);

            groupRef.current.position.set(
                initialPosition[0] + swayX,
                initialPosition[1] + bobY,
                initialPosition[2] + swayZ,
            );
            groupRef.current.rotation.set(
                initialRotation[0],
                initialRotation[1] + yaw,
                initialRotation[2],
            );
        }

        // Per-part micro animations (slightly stronger) to give life — only on selected small/detail parts
        if (scene) {
            scene.traverse((child) => {
                if (child.isMesh && child.userData && child.userData._baseRotation && child.userData._shouldAnimate) {
                    const o = child.userData._animOffset || 0;
                    // stronger motion for small parts, keep large parts static
                    child.rotation.x = child.userData._baseRotation.x + Math.sin(elapsed * 0.6 + o) * (0.025 * animationIntensity);
                    child.rotation.y = child.userData._baseRotation.y + Math.cos(elapsed * 0.5 + o) * (0.018 * animationIntensity);
                }
            });
        }
    }, [scene, hologramMaterial, hologramSkinnedMaterial, animationIntensity, initialPosition, initialRotation]);
    // Render placeholder while loading so model appears instantly (optional)
    const isBackgroundCity = typeof modelPath === 'string' && modelPath.toLowerCase().includes('cyberpunk_city');
    const placeholder = showPlaceholder ? (
        isBackgroundCity ? (
            <mesh rotation={[0, 0, 0]} position={[0, fitSize * 0.1, 0]}>
                <boxGeometry args={[fitSize * 3.2, fitSize * 1.2, fitSize * 2.4]} />
                <meshStandardMaterial color={color.clone().multiplyScalar(0.85)} opacity={0.85} transparent />
            </mesh>
        ) : (
            <mesh rotation={[0, 0, 0]} position={[0, fitSize * 0.15, 0]}>
                <boxGeometry args={[fitSize, fitSize * 0.4, fitSize]} />
                <meshStandardMaterial color={color.clone().multiplyScalar(0.6)} opacity={0.55} transparent />
            </mesh>
        )
    ) : null;

    if (hasError) {
        console.warn('[Hologram] Rendering nothing due to error', modelPath);
        return null;
    }

    return (
        <group ref={groupRef} {...groupProps}>
            {scene ? <primitive object={scene} dispose={null} /> : placeholder}
        </group>
    );
}