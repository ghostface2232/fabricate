import { useEffect, useRef } from 'react';
import type { PBRMapType } from '@/types/pattern';
import type { PatternEngine } from '@/engine/PatternEngine';

const THUMB_SIZE = 200;
const MAPS: { type: PBRMapType; label: string }[] = [
  { type: 'height', label: 'Height' },
  { type: 'normal', label: 'Normal' },
  { type: 'roughness', label: 'Roughness' },
  { type: 'ao', label: 'AO' },
  { type: 'diffuse', label: 'Diffuse' },
];

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

function Thumbnail({
  engine,
  mapType,
  renderVersion,
  label,
  selected,
  onClick,
}: {
  engine: PatternEngine | null;
  mapType: PBRMapType;
  renderVersion: number;
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const offscreenRef = useRef<OffscreenCanvas | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !engine || renderVersion === 0) return;
    const pixels = engine.getMapPixels(mapType);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const imageData = pixelsToImageData(pixels, 512, 512);
    if (!offscreenRef.current) {
      offscreenRef.current = new OffscreenCanvas(512, 512);
    }
    const tmpCtx = offscreenRef.current.getContext('2d')!;
    tmpCtx.putImageData(imageData, 0, 0);
    ctx.clearRect(0, 0, THUMB_SIZE, THUMB_SIZE);
    ctx.drawImage(offscreenRef.current, 0, 0, THUMB_SIZE, THUMB_SIZE);
  }, [engine, mapType, renderVersion]);

  return (
    <button onClick={onClick} className="w-full flex flex-col gap-1.5 min-h-0 rounded-xl p-1 transition-colors hover:bg-zinc-900/60 text-left">
      <span className="self-start shrink-0 text-[11px] uppercase tracking-[0.18em] text-zinc-500">{label}</span>
      <canvas
        ref={canvasRef}
        width={THUMB_SIZE}
        height={THUMB_SIZE}
        className={`w-full flex-1 min-h-0 object-contain rounded border ${
          selected ? 'border-zinc-500 ring-1 ring-zinc-700' : 'border-zinc-800'
        } bg-zinc-900`}
      />
    </button>
  );
}

interface PBRThumbnailPanelProps {
  selectedMap: PBRMapType;
  onSelectMap: (map: PBRMapType) => void;
  engine: PatternEngine | null;
  renderVersion: number;
}

export default function PBRThumbnailPanel({
  selectedMap,
  onSelectMap,
  engine,
  renderVersion,
}: PBRThumbnailPanelProps) {
  return (
    <div className="h-full flex flex-col gap-3">
      {MAPS.map(({ type, label }) => (
        <Thumbnail
          key={type}
          engine={engine}
          mapType={type}
          renderVersion={renderVersion}
          label={label}
          selected={selectedMap === type}
          onClick={() => onSelectMap(type)}
        />
      ))}
    </div>
  );
}
