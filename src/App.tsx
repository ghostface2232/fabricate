import { useState } from 'react';
import { usePatternEngine } from '@/hooks/usePatternEngine';
import AppLayout from '@/components/AppLayout';
import type { PBRMapType } from '@/types/pattern';

export default function App() {
  const [selectedMap, setSelectedMap] = useState<PBRMapType>('height');
  const { engine, renderVersion, isRendering } = usePatternEngine();

  return (
    <AppLayout
      selectedMap={selectedMap}
      onSelectMap={setSelectedMap}
      engine={engine}
      renderVersion={renderVersion}
      isRendering={isRendering}
    />
  );
}
