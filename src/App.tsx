import { usePatternEngine } from '@/hooks/usePatternEngine';
import AppLayout from '@/components/AppLayout';

export default function App() {
  const { engine, renderVersion, lastColorOnly, isRendering } = usePatternEngine();

  return (
    <AppLayout
      engine={engine}
      renderVersion={renderVersion}
      lastColorOnly={lastColorOnly}
      isRendering={isRendering}
    />
  );
}
