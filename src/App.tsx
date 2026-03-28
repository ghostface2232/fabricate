import { usePatternEngine } from '@/hooks/usePatternEngine';
import { Toaster } from 'sonner';
import AppLayout from '@/components/AppLayout';

export default function App() {
  const { engine, renderVersion, lastColorOnly, isRendering } = usePatternEngine();

  return (
    <>
      <AppLayout
        engine={engine}
        renderVersion={renderVersion}
        lastColorOnly={lastColorOnly}
        isRendering={isRendering}
      />
      <Toaster
        theme="dark"
        position="bottom-center"
        toastOptions={{
          style: {
            background: 'rgb(39 39 42)',
            border: '1px solid rgb(63 63 70)',
            color: 'rgb(212 212 216)',
          },
        }}
      />
    </>
  );
}
