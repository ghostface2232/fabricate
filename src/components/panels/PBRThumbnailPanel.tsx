import { useEffect, useRef } from 'react';
import type { PBRMapType } from '@/types/pattern';

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
  pixels,
  label,
  selected,
  onClick,
}: {
  pixels: Uint8Array | null;
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !pixels) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const imageData = pixelsToImageData(pixels, 512, 512);
    ctx.clearRect(0, 0, THUMB_SIZE, THUMB_SIZE);
    const tmp = new OffscreenCanvas(512, 512);
    const tmpCtx = tmp.getContext('2d')!;
    tmpCtx.putImageData(imageData, 0, 0);
    ctx.drawImage(tmp, 0, 0, THUMB_SIZE, THUMB_SIZE);
  }, [pixels]);

  return (
    <button onClick={onClick} className="w-full flex flex-col min-h-0">
      <span className="text-xs text-zinc-500 mb-1 shrink-0">{label}</span>
      <canvas
        ref={canvasRef}
        width={THUMB_SIZE}
        height={THUMB_SIZE}
        className={`w-full flex-1 min-h-0 object-contain rounded border ${
          selected ? 'border-zinc-400' : 'border-zinc-800'
        } bg-zinc-900`}
      />
    </button>
  );
}

interface PBRThumbnailPanelProps {
  selectedMap: PBRMapType;
  onSelectMap: (map: PBRMapType) => void;
  allMapPixels: Record<PBRMapType, Uint8Array> | null;
}

export default function PBRThumbnailPanel({
  selectedMap,
  onSelectMap,
  allMapPixels,
}: PBRThumbnailPanelProps) {
  return (
    <div className="h-full flex flex-col gap-2">
      {MAPS.map(({ type, label }) => (
        <Thumbnail
          key={type}
          label={label}
          pixels={allMapPixels?.[type] ?? null}
          selected={selectedMap === type}
          onClick={() => onSelectMap(type)}
        />
      ))}
    </div>
  );
}
