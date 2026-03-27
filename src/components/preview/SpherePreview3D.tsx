import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { usePatternStore } from '@/stores/patternStore';
import type { PatternEngine } from '@/engine/PatternEngine';

const RENDER_SIZE = 512;
const MAP_NAMES = ['height', 'normal', 'ao', 'roughness', 'diffuse'] as const;

interface SpherePreview3DProps {
  engine: PatternEngine | null;
  renderVersion: number;
}

export default function SpherePreview3D({ engine, renderVersion }: SpherePreview3DProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const materialRef = useRef<THREE.MeshStandardMaterial | THREE.MeshPhysicalMaterial | null>(null);
  const meshRef = useRef<THREE.Mesh | null>(null);
  const texturesRef = useRef<Record<string, THREE.DataTexture>>({});
  const rafRef = useRef(0);
  const prevTypeRef = useRef<string>('');

  const params = usePatternStore((s) => s.params);

  // Three.js 씬 초기화
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setClearColor(0x09090b);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Camera
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    camera.position.set(0, 0, 2.8);
    cameraRef.current = camera;

    // Scene
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // Lighting
    const dirLight = new THREE.DirectionalLight(0xffffff, 1.5);
    dirLight.position.set(5, 5, 5);
    scene.add(dirLight);
    scene.add(new THREE.AmbientLight(0xffffff, 0.3));
    scene.add(new THREE.HemisphereLight(0x606080, 0x404040, 0.5));

    // Geometry — uv2 for aoMap
    const geometry = new THREE.SphereGeometry(1, 64, 64);
    geometry.setAttribute('uv2', geometry.getAttribute('uv'));

    // Material (placeholder, recreated on type change)
    const material = new THREE.MeshStandardMaterial();
    materialRef.current = material;

    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);
    meshRef.current = mesh;

    // Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.8;
    controls.minDistance = 1.8;
    controls.maxDistance = 5;
    controlsRef.current = controls;

    // Resize
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width === 0 || height === 0) return;
      renderer.setSize(width, height);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    });
    ro.observe(container);

    // Animation loop
    const animate = () => {
      rafRef.current = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(rafRef.current);
      ro.disconnect();
      controls.dispose();
      renderer.dispose();
      geometry.dispose();
      material.dispose();
      for (const tex of Object.values(texturesRef.current)) tex.dispose();
      texturesRef.current = {};
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      rendererRef.current = null;
    };
  }, []);

  // Material type switch (fabric vs carbon)
  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;

    const isCarbon = params.type === 'carbonPlain' || params.type === 'carbonTwill';
    const typeKey = isCarbon ? 'carbon' : 'fabric';
    if (typeKey === prevTypeRef.current) return;
    prevTypeRef.current = typeKey;

    // Dispose old material
    materialRef.current?.dispose();

    let mat: THREE.MeshStandardMaterial | THREE.MeshPhysicalMaterial;
    if (isCarbon) {
      const glossiness = 'glossiness' in params ? params.glossiness : 0.85;
      mat = new THREE.MeshPhysicalMaterial({
        clearcoat: 1.0,
        clearcoatRoughness: 1.0 - glossiness,
        anisotropy: 0.5,
        anisotropyRotation: Math.PI / 4,
      });
    } else {
      mat = new THREE.MeshStandardMaterial();
    }

    materialRef.current = mat;
    mesh.material = mat;
  }, [params]);

  // Texture update on render
  useEffect(() => {
    if (!engine || renderVersion === 0) return;
    const mat = materialRef.current;
    if (!mat) return;

    for (const mapName of MAP_NAMES) {
      const pixels = engine.getMapPixels(mapName);

      let tex = texturesRef.current[mapName];
      if (tex) {
        // Reuse existing texture, update data
        (tex.image as { data: Uint8Array }).data = pixels;
        tex.needsUpdate = true;
      } else {
        // Create new DataTexture
        tex = new THREE.DataTexture(
          pixels,
          RENDER_SIZE,
          RENDER_SIZE,
          THREE.RGBAFormat,
          THREE.UnsignedByteType,
        );
        tex.wrapS = THREE.RepeatWrapping;
        tex.wrapT = THREE.RepeatWrapping;
        tex.repeat.set(3, 2);
        tex.flipY = false;
        tex.needsUpdate = true;
        texturesRef.current[mapName] = tex;
      }
    }

    // Assign to material
    const texs = texturesRef.current;
    mat.map = texs['diffuse'];
    mat.normalMap = texs['normal'];
    mat.normalScale = new THREE.Vector2(1, 1);
    mat.roughnessMap = texs['roughness'];
    mat.aoMap = texs['ao'];
    mat.displacementMap = texs['height'];
    mat.displacementScale = 0.02;
    mat.needsUpdate = true;
  }, [engine, renderVersion]);

  return (
    <div ref={containerRef} className="w-full h-full" />
  );
}
