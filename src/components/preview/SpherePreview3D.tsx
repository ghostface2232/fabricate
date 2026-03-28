import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { usePatternStore } from '@/stores/patternStore';
import { isCarbonPatternType } from '@/types/pattern';
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
  const paramsRef = useRef(params);
  paramsRef.current = params;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setClearColor(0x09090b);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    camera.position.set(0, 0, 2.8);

    const scene = new THREE.Scene();

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.5);
    dirLight.position.set(5, 5, 5);
    scene.add(dirLight);
    scene.add(new THREE.AmbientLight(0xffffff, 0.3));
    scene.add(new THREE.HemisphereLight(0x606080, 0x404040, 0.5));

    // uv2 for aoMap
    const geometry = new THREE.SphereGeometry(1, PREVIEW_SPHERE_SEGMENTS, PREVIEW_SPHERE_SEGMENTS);
    geometry.setAttribute('uv2', geometry.getAttribute('uv'));

    const material = new THREE.MeshStandardMaterial();
    materialRef.current = material;

    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);
    meshRef.current = mesh;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.8;
    controls.minDistance = 1.8;
    controls.maxDistance = 5;

    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width === 0 || height === 0) return;
      renderer.setSize(width, height);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    });
    ro.observe(container);

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

  // params를 ref로 참조하여 renderVersion 변경(= 엔진 렌더링 완료) 시에만 실행.
  // params가 dep에 있으면 엔진 재렌더 전에 stale 텍스처를 읽게 되는 문제 방지.
  useEffect(() => {
    if (!engine || renderVersion === 0) return;
    const mesh = meshRef.current;
    if (!mesh) return;

    const params = paramsRef.current;
    const isCarbon = isCarbonPatternType(params.type);
    const typeKey = isCarbon ? 'carbon' : 'fabric';

    if (typeKey !== prevTypeRef.current) {
      prevTypeRef.current = typeKey;
      materialRef.current?.dispose();
      for (const tex of Object.values(texturesRef.current)) tex.dispose();
      texturesRef.current = {};
      prevRenderSizeRef.current = 0;

      let mat: THREE.MeshStandardMaterial | THREE.MeshPhysicalMaterial;
      if (isCarbon) {
        const glossiness = params.glossiness;
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

    if (isCarbon && mat instanceof THREE.MeshPhysicalMaterial) {
      const glossiness = params.glossiness;
      mat.roughness = THREE.MathUtils.lerp(0.38, 0.12, glossiness);
      mat.clearcoat = THREE.MathUtils.lerp(0.75, 1.0, glossiness);
      mat.clearcoatRoughness = THREE.MathUtils.lerp(0.24, 0.03, glossiness);
      mat.anisotropy = THREE.MathUtils.lerp(0.45, 0.85, glossiness);
    }

    mat.needsUpdate = true;
  // eslint-disable-next-line react-hooks/exhaustive-deps -- params는 ref로 참조; renderVersion이 바뀔 때만 실행해야 엔진 렌더 완료 보장
  }, [engine, renderVersion]);

  return (
    <div ref={containerRef} className="w-full h-full" />
  );
}
