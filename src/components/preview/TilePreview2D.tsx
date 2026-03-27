import { useCallback, useEffect, useRef } from 'react';
import type { PatternEngine } from '@/engine/PatternEngine';
import type { PBRMapType } from '@/types/pattern';

const RENDER_SIZE = 512;

/** readPixels 결과(Y축 뒤집힘)를 ImageData로 변환 */
function pixelsToImageData(pixels: Uint8Array, w: number, h: number): ImageData {
  const img = new ImageData(w, h);
  const rowBytes = w * 4;
  for (let y = 0; y < h; y++) {
    const src = (h - 1 - y) * rowBytes;
    const dst = y * rowBytes;
    for (let x = 0; x < rowBytes; x++) img.data[dst + x] = pixels[src + x];
  }
  return img;
}

interface TilePreview2DProps {
  engine: PatternEngine | null;
  renderVersion: number;
  selectedMap: PBRMapType;
  tiling: boolean;
  displaySize: number;
}

export default function TilePreview2D({ engine, renderVersion, selectedMap, tiling, displaySize }: TilePreview2DProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const srcCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const getSrcCanvas = useCallback(() => {
    if (!srcCanvasRef.current) {
      const c = document.createElement('canvas');
      c.width = RENDER_SIZE;
      c.height = RENDER_SIZE;
      srcCanvasRef.current = c;
    }
    return srcCanvasRef.current;
  }, []);

  useEffect(() => {
    if (!engine || displaySize === 0) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (tiling) {
      canvas.width = displaySize;
      canvas.height = displaySize;
    } else {
      canvas.width = RENDER_SIZE;
      canvas.height = RENDER_SIZE;
    }
    canvas.style.width = `${displaySize}px`;
    canvas.style.height = `${displaySize}px`;

    const pixels = engine.getMapPixels(selectedMap);
    const imageData = pixelsToImageData(pixels, RENDER_SIZE, RENDER_SIZE);

    if (tiling) {
      const src = getSrcCanvas();
      src.getContext('2d')!.putImageData(imageData, 0, 0);
      const ctx = canvas.getContext('2d')!;
      const pattern = ctx.createPattern(src, 'repeat');
      if (pattern) {
        const s = displaySize / (RENDER_SIZE * 3);
        ctx.save();
        ctx.scale(s, s);
        ctx.fillStyle = pattern;
        ctx.fillRect(0, 0, RENDER_SIZE * 3, RENDER_SIZE * 3);
        ctx.restore();
      }
    } else {
      canvas.getContext('2d')!.putImageData(imageData, 0, 0);
    }
  }, [engine, renderVersion, selectedMap, tiling, displaySize, getSrcCanvas]);

  return (
    <canvas
      ref={canvasRef}
      className="border border-zinc-800 rounded"
    />
  );
}
