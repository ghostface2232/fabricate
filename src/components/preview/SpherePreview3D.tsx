import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { usePatternStore } from '@/stores/patternStore';
import type { PatternEngine } from '@/engine/PatternEngine';

const MAP_NAMES = ['height', 'normal', 'ao', 'roughness', 'diffuse'] as const;
const PREVIEW_SPHERE_SEGMENTS = 448;

interface SpherePreview3DProps {
  engine: PatternEngine | null;
  renderVersion: number;
}

export default function SpherePreview3D({ engine, renderVersion }: SpherePreview3DProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const materialRef = useRef<THREE.MeshStandardMaterial | THREE.MeshPhysicalMaterial | null>(null);
  const meshRef = useRef<THREE.Mesh | null>(null);
  const texturesRef = useRef<Record<string, THREE.DataTexture>>({});
  const rafRef = useRef(0);
  const prevTypeRef = useRef<string>('');
  const prevRenderSizeRef = useRef(0);

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

    // Camera
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    camera.position.set(0, 0, 2.8);

    // Scene
    const scene = new THREE.Scene();

    // Lighting
    const dirLight = new THREE.DirectionalLight(0xffffff, 1.5);
    dirLight.position.set(5, 5, 5);
    scene.add(dirLight);
    scene.add(new THREE.AmbientLight(0xffffff, 0.3));
    scene.add(new THREE.HemisphereLight(0x606080, 0x404040, 0.5));

    // Geometry — uv2 for aoMap
    const geometry = new THREE.SphereGeometry(1, PREVIEW_SPHERE_SEGMENTS, PREVIEW_SPHERE_SEGMENTS);
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
      renderer.forceContextLoss();
      geometry.dispose();
      materialRef.current?.dispose();
      material.dispose();
      for (const tex of Object.values(texturesRef.current)) tex.dispose();
      texturesRef.current = {};
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  // Material + Texture 통합 업데이트 (타이밍 불일치 방지)
  useEffect(() => {
    if (!engine || renderVersion === 0) return;
    const mesh = meshRef.current;
    if (!mesh) return;

    // ── Material type switch (필요 시) ──
    const isCarbon = 'glossiness' in params;
    const typeKey = isCarbon ? 'carbon' : 'fabric';
    if (typeKey !== prevTypeRef.current) {
      prevTypeRef.current = typeKey;
      materialRef.current?.dispose();
      for (const tex of Object.values(texturesRef.current)) tex.dispose();
      texturesRef.current = {};
      prevRenderSizeRef.current = 0;

      let mat: THREE.MeshStandardMaterial | THREE.MeshPhysicalMaterial;
      if (isCarbon) {
        const glossiness = 'glossiness' in params ? params.glossiness : 0.85;
        mat = new THREE.MeshPhysicalMaterial({
          roughness: THREE.MathUtils.lerp(0.38, 0.12, glossiness),
          clearcoat: THREE.MathUtils.lerp(0.75, 1.0, glossiness),
          clearcoatRoughness: THREE.MathUtils.lerp(0.24, 0.03, glossiness),
          anisotropy: THREE.MathUtils.lerp(0.45, 0.85, glossiness),
          anisotropyRotation: Math.PI / 4,
        });
      } else {
        mat = new THREE.MeshStandardMaterial();
      }

      materialRef.current = mat;
      mesh.material = mat;
    }

    const mat = materialRef.current;
    if (!mat) return;

    // ── Texture update ──
    const renderSize = engine.getRenderSize();

    if (renderSize !== prevRenderSizeRef.current) {
      for (const tex of Object.values(texturesRef.current)) tex.dispose();
      texturesRef.current = {};
      prevRenderSizeRef.current = renderSize;
    }

    for (const mapName of MAP_NAMES) {
      const pixels = engine.getMapPixels(mapName);

      let tex = texturesRef.current[mapName];
      if (tex) {
        (tex.image as { data: Uint8Array }).data = pixels;
        tex.needsUpdate = true;
      } else {
        tex = new THREE.DataTexture(
          pixels,
          renderSize,
          renderSize,
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
    mat.normalScale = isCarbon ? new THREE.Vector2(0.74, 0.74) : new THREE.Vector2(1, 1);
    mat.roughnessMap = texs['roughness'];
    mat.aoMap = texs['ao'];
    mat.aoMapIntensity = isCarbon ? 0.72 : 0.95;
    mat.displacementMap = texs['height'];
    mat.displacementScale = isCarbon ? 0.01 : 0.028;
    mesh.geometry.computeBoundingSphere();
    mesh.geometry.computeBoundingBox();

    // Carbon glossiness sync
    if (isCarbon && mat instanceof THREE.MeshPhysicalMaterial) {
      const glossiness = 'glossiness' in params ? params.glossiness : 0.85;
      mat.roughness = THREE.MathUtils.lerp(0.38, 0.12, glossiness);
      mat.clearcoat = THREE.MathUtils.lerp(0.75, 1.0, glossiness);
      mat.clearcoatRoughness = THREE.MathUtils.lerp(0.24, 0.03, glossiness);
      mat.anisotropy = THREE.MathUtils.lerp(0.45, 0.85, glossiness);
    }

    mat.needsUpdate = true;
  }, [engine, renderVersion, params]);

  return (
    <div ref={containerRef} className="w-full h-full" />
  );
}
