import { useCallback, useEffect, useRef, useState } from 'react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Grid2x2 } from 'lucide-react';
import type { PatternEngine } from '@/engine/PatternEngine';
import type { PBRMapType } from '@/types/pattern';

const RENDER_SIZE = 512;
const MAP_TABS: { value: PBRMapType; label: string }[] = [
  { value: 'diffuse', label: 'Diffuse' },
  { value: 'height', label: 'Height' },
  { value: 'normal', label: 'Normal' },
  { value: 'roughness', label: 'Rough' },
  { value: 'ao', label: 'AO' },
];

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
}

export default function TilePreview2D({ engine, renderVersion }: TilePreview2DProps) {
  const [selectedMap, setSelectedMap] = useState<PBRMapType>('diffuse');
  const [tiling, setTiling] = useState(true);

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // 1:1 소스 캔버스 (512x512) — tiling 패턴 소스용
  const srcCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // 소스 캔버스 lazy init
  const getSrcCanvas = useCallback(() => {
    if (!srcCanvasRef.current) {
      const c = document.createElement('canvas');
      c.width = RENDER_SIZE;
      c.height = RENDER_SIZE;
      srcCanvasRef.current = c;
    }
    return srcCanvasRef.current;
  }, []);

  // 리사이즈: 캔버스 display 크기를 부모에 맞춤
  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      const size = Math.floor(Math.min(width, height));
      if (tiling) {
        canvas.width = size;
        canvas.height = size;
      } else {
        canvas.width = RENDER_SIZE;
        canvas.height = RENDER_SIZE;
      }
      canvas.style.width = `${size}px`;
      canvas.style.height = `${size}px`;
    });
    ro.observe(container);
    return () => ro.disconnect();
  }, [tiling]);

  // 픽셀 렌더링
  useEffect(() => {
    if (!engine) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const pixels = engine.getMapPixels(selectedMap);
    const imageData = pixelsToImageData(pixels, RENDER_SIZE, RENDER_SIZE);

    if (tiling) {
      const src = getSrcCanvas();
      const srcCtx = src.getContext('2d')!;
      srcCtx.putImageData(imageData, 0, 0);

      const ctx = canvas.getContext('2d')!;
      const pattern = ctx.createPattern(src, 'repeat');
      if (pattern) {
        const tileScale = canvas.width / (RENDER_SIZE * 3);
        ctx.save();
        ctx.scale(tileScale, tileScale);
        ctx.fillStyle = pattern;
        ctx.fillRect(0, 0, RENDER_SIZE * 3, RENDER_SIZE * 3);
        ctx.restore();
      }
    } else {
      const ctx = canvas.getContext('2d')!;
      ctx.putImageData(imageData, 0, 0);
    }
  }, [engine, renderVersion, selectedMap, tiling, getSrcCanvas]);

  return (
    <div className="flex flex-col h-full w-full">
      {/* 상단 컨트롤: 맵 탭 + 타일링 토글 */}
      <div className="shrink-0 flex items-center justify-between px-4 py-2">
        <Tabs value={selectedMap} onValueChange={(v) => setSelectedMap(v as PBRMapType)}>
          <TabsList className="h-7">
            {MAP_TABS.map((t) => (
              <TabsTrigger key={t.value} value={t.value} className="text-xs px-2 py-0.5">
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <ToggleGroup
          type="single"
          value={tiling ? 'on' : ''}
          onValueChange={(v) => setTiling(v === 'on')}
        >
          <ToggleGroupItem
            value="on"
            size="sm"
            variant="outline"
            className="h-7 w-7 p-0"
            title="Tile 3x3"
          >
            <Grid2x2 className="w-3.5 h-3.5" />
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      {/* 캔버스 영역 */}
      <div ref={containerRef} className="flex-1 flex items-center justify-center min-h-0 px-4 pb-4">
        <canvas
          ref={canvasRef}
          className="border border-zinc-800 rounded"
        />
      </div>
    </div>
  );
}
