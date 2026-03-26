import { useEffect, useRef, useState, useCallback } from 'react';
import { usePatternStore } from '@/stores/patternStore';
import { PatternEngine } from '@/engine/PatternEngine';

export function usePatternEngine() {
  const engineRef = useRef<PatternEngine | null>(null);
  const rafRef = useRef<number>(0);
  const [heightPixels, setHeightPixels] = useState<Uint8Array | null>(null);
  const [isReady, setIsReady] = useState(false);

  const params = usePatternStore((s) => s.params);
  const pbrSettings = usePatternStore((s) => s.pbrSettings);

  // 엔진 생성/소멸
  useEffect(() => {
    const engine = new PatternEngine();
    engineRef.current = engine;
    setIsReady(true);

    return () => {
      cancelAnimationFrame(rafRef.current);
      engine.dispose();
      engineRef.current = null;
      setIsReady(false);
    };
  }, []);

  // params/pbrSettings 변경 시 rAF 디바운싱으로 렌더링
  const renderRef = useRef<() => void>();
  renderRef.current = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.generate(params, pbrSettings);
    setHeightPixels(engine.getHeightPixels());
  }, [params, pbrSettings]);

  useEffect(() => {
    if (!isReady) return;

    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      renderRef.current?.();
    });
  }, [params, pbrSettings, isReady]);

  return { engine: engineRef.current, heightPixels, isReady };
}
