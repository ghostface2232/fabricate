import { useEffect, useRef, useState, useCallback } from 'react';
import { usePatternStore } from '@/stores/patternStore';
import { PatternEngine } from '@/engine/PatternEngine';
import type { PBRMapType } from '@/types/pattern';

export function usePatternEngine() {
  const engineRef = useRef<PatternEngine | null>(null);
  const [heightPixels, setHeightPixels] = useState<Uint8Array | null>(null);
  const [allMapPixels, setAllMapPixels] = useState<Record<PBRMapType, Uint8Array> | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isRendering, setIsRendering] = useState(false);

  const params = usePatternStore((s) => s.params);
  const pbrSettings = usePatternStore((s) => s.pbrSettings);

  // 엔진 생성/소멸
  useEffect(() => {
    const engine = new PatternEngine();
    engineRef.current = engine;
    setIsReady(true);

    return () => {
      engine.dispose();
      engineRef.current = null;
      setIsReady(false);
    };
  }, []);

  // params/pbrSettings 변경 시 setTimeout으로 렌더링 (로딩 UI 표시 시간 확보)
  const renderRef = useRef<(() => void) | null>(null);
  renderRef.current = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.generate(params, pbrSettings);
    setHeightPixels(engine.getHeightPixels());
    setAllMapPixels(engine.getAllMapPixels());
    setIsRendering(false);
  }, [params, pbrSettings]);

  useEffect(() => {
    if (!isReady) return;
    setIsRendering(true);

    const id = setTimeout(() => {
      renderRef.current?.();
    }, 16);

    return () => clearTimeout(id);
  }, [params, pbrSettings, isReady]);

  return { engine: engineRef.current, heightPixels, allMapPixels, isReady, isRendering };
}
