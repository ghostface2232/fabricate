import { useEffect, useRef } from 'react';
import type { PatternEngine } from '@/engine/PatternEngine';
import type { PBRMapType } from '@/types/pattern';

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

  useEffect(() => {
    if (!engine || displaySize === 0) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const renderSize = engine.getRenderSize();

    if (tiling) {
      canvas.width = displaySize;
      canvas.height = displaySize;
    } else {
      canvas.width = renderSize;
      canvas.height = renderSize;
    }
    canvas.style.width = `${displaySize}px`;
    canvas.style.height = `${displaySize}px`;

    const pixels = engine.getMapPixels(selectedMap);
    const imageData = pixelsToImageData(pixels, renderSize, renderSize);

    if (tiling) {
      // srcCanvas를 renderSize에 맞춰 생성/재활용
      let src = srcCanvasRef.current;
      if (!src || src.width !== renderSize) {
        src = document.createElement('canvas');
        src.width = renderSize;
        src.height = renderSize;
        srcCanvasRef.current = src;
      }
      src.getContext('2d')!.putImageData(imageData, 0, 0);
      const ctx = canvas.getContext('2d')!;
      const pattern = ctx.createPattern(src, 'repeat');
      if (pattern) {
        const s = displaySize / (renderSize * 3);
        ctx.save();
        ctx.scale(s, s);
        ctx.fillStyle = pattern;
        ctx.fillRect(0, 0, renderSize * 3, renderSize * 3);
        ctx.restore();
      }
    } else {
      canvas.getContext('2d')!.putImageData(imageData, 0, 0);
    }
  }, [engine, renderVersion, selectedMap, tiling, displaySize]);

  return (
    <canvas
      ref={canvasRef}
      className="border border-zinc-800 rounded"
    />
  );
}
