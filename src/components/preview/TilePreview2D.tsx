import { useEffect, useRef } from 'react';
import { usePatternEngine } from '@/hooks/usePatternEngine';

const CANVAS_SIZE = 512;

/** readPixels 결과의 Y축을 반전하여 ImageData로 변환 */
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

export default function TilePreview2D() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { heightPixels } = usePatternEngine();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !heightPixels) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const imageData = pixelsToImageData(heightPixels, CANVAS_SIZE, CANVAS_SIZE);
    ctx.putImageData(imageData, 0, 0);
  }, [heightPixels]);

  return (
    <canvas
      ref={canvasRef}
      width={CANVAS_SIZE}
      height={CANVAS_SIZE}
      className="border border-zinc-700 rounded"
    />
  );
}
