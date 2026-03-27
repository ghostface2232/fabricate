import { useEffect, useRef, useState } from 'react';
import { usePatternEngine } from '@/hooks/usePatternEngine';
import AppLayout from '@/components/AppLayout';
import type { PBRMapType } from '@/types/pattern';

const CANVAS_SIZE = 512;

function pixelsToImageData(
  pixels: Uint8Array,
  width: number,
  height: number,
): ImageData {
  const imageData = new ImageData(width, height);
  const rowBytes = width * 4;
  for (let y = 0; y < height; y++) {
    const srcRow = (height - 1 - y) * rowBytes;
    const dstRow = y * rowBytes;
    for (let x = 0; x < rowBytes; x++) {
      imageData.data[dstRow + x] = pixels[srcRow + x];
    }
  }
  return imageData;
}

function CenterPreview({
  currentMap,
  pixels,
}: {
  currentMap: PBRMapType;
  pixels: Uint8Array | null;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [transitioning, setTransitioning] = useState(false);
  const isInitialRef = useRef(true);

  // 맵 전환 시 페이드 트랜지션
  useEffect(() => {
    if (isInitialRef.current) {
      isInitialRef.current = false;
      return;
    }
    setTransitioning(true);
    const id = setTimeout(() => setTransitioning(false), 120);
    return () => clearTimeout(id);
  }, [currentMap]);

  // 캔버스에 픽셀 그리기
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !pixels) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const imageData = pixelsToImageData(pixels, CANVAS_SIZE, CANVAS_SIZE);
    ctx.putImageData(imageData, 0, 0);
  }, [pixels]);

  return (
    <div className="flex flex-col items-center gap-3 w-full h-full justify-center px-6 py-4">
      <span className="text-xs text-zinc-500 uppercase tracking-wider">
        {currentMap}
      </span>
      <canvas
        ref={canvasRef}
        width={CANVAS_SIZE}
        height={CANVAS_SIZE}
        className="border border-zinc-800 rounded max-w-full max-h-[calc(100%-2rem)] object-contain"
        style={{
          aspectRatio: '1 / 1',
          opacity: transitioning ? 0.4 : 1,
          transform: transitioning ? 'scale(0.99)' : 'scale(1)',
          transition: 'opacity 150ms ease-out, transform 150ms ease-out',
        }}
      />
    </div>
  );
}

export default function App() {
  const [selectedMap, setSelectedMap] = useState<PBRMapType>('height');
  const { engine, currentMapPixels, renderVersion, isRendering } = usePatternEngine(selectedMap);

  return (
    <AppLayout
      selectedMap={selectedMap}
      onSelectMap={setSelectedMap}
      engine={engine}
      renderVersion={renderVersion}
      isRendering={isRendering}
      center={
        <CenterPreview
          currentMap={selectedMap}
          pixels={currentMapPixels}
        />
      }
    />
  );
}
