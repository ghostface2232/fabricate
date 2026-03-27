import { useEffect, useRef, useState } from 'react';
import { usePatternStore } from '@/stores/patternStore';
import { PatternEngine } from '@/engine/PatternEngine';

export function usePatternEngine() {
  const engineRef = useRef<PatternEngine | null>(null);
  const [renderVersion, setRenderVersion] = useState(0);
  const [isReady, setIsReady] = useState(false);
  const [isRendering, setIsRendering] = useState(false);

  const params = usePatternStore((s) => s.params);
  const pbrSettings = usePatternStore((s) => s.pbrSettings);

  // rAF 콜백에서 최신 값을 참조하기 위한 ref
  const paramsRef = useRef(params);
  const pbrRef = useRef(pbrSettings);
  paramsRef.current = params;
  pbrRef.current = pbrSettings;

  // rAF 중복 방지
  const pendingRef = useRef(false);
  const rafRef = useRef(0);

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
      setRenderVersion((v) => v + 1);
      setIsRendering(false);
    });
  }, [params, pbrSettings, isReady]);

  return {
    engine: engineRef.current,
    renderVersion,
    isReady,
    isRendering,
  };
}
