import { useEffect, useRef, useState } from 'react';
import { usePatternStore } from '@/stores/patternStore';
import { PatternEngine } from '@/engine/PatternEngine';
import type { PBRMapType } from '@/types/pattern';

export function usePatternEngine(selectedMap: PBRMapType) {
  const engineRef = useRef<PatternEngine | null>(null);
  const [currentMapPixels, setCurrentMapPixels] = useState<Uint8Array | null>(null);
  const [renderVersion, setRenderVersion] = useState(0);
  const [isReady, setIsReady] = useState(false);
  const [isRendering, setIsRendering] = useState(false);

  const params = usePatternStore((s) => s.params);
  const pbrSettings = usePatternStore((s) => s.pbrSettings);

  // rAF 콜백에서 최신 값을 참조하기 위한 ref
  const paramsRef = useRef(params);
  const pbrRef = useRef(pbrSettings);
  const selectedMapRef = useRef(selectedMap);
  paramsRef.current = params;
  pbrRef.current = pbrSettings;
  selectedMapRef.current = selectedMap;

  // rAF 중복 방지
  const pendingRef = useRef(false);
  const rafRef = useRef(0);
  const hasRenderedRef = useRef(false);

  // 엔진 생성/소멸
  useEffect(() => {
    const engine = new PatternEngine();
    engineRef.current = engine;
    setIsReady(true);

    return () => {
      engine.dispose();
      engineRef.current = null;
      setIsReady(false);
      cancelAnimationFrame(rafRef.current);
    };
  }, []);

  // params/pbrSettings 변경 → rAF로 한 번만 렌더링
  useEffect(() => {
    if (!isReady) return;

    if (pendingRef.current) return;
    pendingRef.current = true;
    setIsRendering(true);

    rafRef.current = requestAnimationFrame(() => {
      pendingRef.current = false;
      const engine = engineRef.current;
      if (!engine) {
        setIsRendering(false);
        return;
      }

      engine.generate(paramsRef.current, pbrRef.current);
      hasRenderedRef.current = true;

      // 현재 활성 맵만 readPixels
      setCurrentMapPixels(engine.getMapPixels(selectedMapRef.current));
      setRenderVersion((v) => v + 1);
      setIsRendering(false);
    });
  }, [params, pbrSettings, isReady]);

  // 탭 전환 시: 해당 맵만 readPixels (재렌더링 없음)
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine || !hasRenderedRef.current) return;
    setCurrentMapPixels(engine.getMapPixels(selectedMap));
  }, [selectedMap]);

  return {
    engine: engineRef.current,
    currentMapPixels,
    renderVersion,
    isReady,
    isRendering,
  };
}
