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
  allMapPixels,
}: {
  currentMap: PBRMapType;
  allMapPixels: Record<PBRMapType, Uint8Array> | null;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !allMapPixels) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const pixels = allMapPixels[currentMap];
    if (!pixels) return;

    const imageData = pixelsToImageData(pixels, CANVAS_SIZE, CANVAS_SIZE);
    ctx.putImageData(imageData, 0, 0);
  }, [currentMap, allMapPixels]);

  return (
    <div className="flex flex-col items-center gap-3">
      <span className="text-xs text-zinc-500 uppercase tracking-wider">
        {currentMap}
      </span>
      <canvas
        ref={canvasRef}
        width={CANVAS_SIZE}
        height={CANVAS_SIZE}
        className="border border-zinc-800 rounded"
      />
    </div>
  );
}

export default function App() {
  const [selectedMap, setSelectedMap] = useState<PBRMapType>('height');
  const { allMapPixels, isRendering } = usePatternEngine();

  return (
    <AppLayout
      selectedMap={selectedMap}
      onSelectMap={setSelectedMap}
      allMapPixels={allMapPixels}
      isRendering={isRendering}
      center={
        <CenterPreview
          currentMap={selectedMap}
          allMapPixels={allMapPixels}
        />
      }
    />
  );
}
