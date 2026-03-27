import { useEffect, useRef, useState } from 'react';
import { Grid2x2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePatternStore } from '@/stores/patternStore';
import { useHistoryStore } from '@/stores/historyStore';
import TilePreview2D from './TilePreview2D';
import SpherePreview3D from './SpherePreview3D';
import type { PatternEngine } from '@/engine/PatternEngine';
import type { PBRMapType } from '@/types/pattern';

const RESOLUTION_OPTIONS = [512, 1024, 2048] as const;

const PREVIEW_TABS = [
  { value: '2d', label: '2D' },
  { value: '3d', label: '3D' },
];

const MAP_TABS: { value: PBRMapType; label: string }[] = [
  { value: 'diffuse', label: 'Diffuse' },
  { value: 'height', label: 'Height' },
  { value: 'normal', label: 'Normal' },
  { value: 'roughness', label: 'Rough' },
  { value: 'ao', label: 'AO' },
];

interface PreviewContainerProps {
  engine: PatternEngine | null;
  renderVersion: number;
  lastColorOnly: boolean;
}

export default function PreviewContainer({ engine, renderVersion, lastColorOnly }: PreviewContainerProps) {
  const commit = useHistoryStore((s) => s.commit);
  const previewResolution = usePatternStore((s) => s.previewResolution);
  const patternType = usePatternStore((s) => s.params.type);
  const _setRes = usePatternStore((s) => s.setPreviewResolution);
  const setPreviewResolution = (r: number) => commit(() => _setRes(r));

  const [previewTab, setPreviewTab] = useState('2d');
  const [selectedMap, setSelectedMap] = useState<PBRMapType>('diffuse');
  const [tiling, setTiling] = useState(true);
  const [displaySize, setDisplaySize] = useState(0);
  const areaRef = useRef<HTMLDivElement>(null);

  // 컬러 전용 변경 시 Diffuse 탭으로 자동 전환
  useEffect(() => {
    if (lastColorOnly && selectedMap !== 'diffuse') {
      setSelectedMap('diffuse');
    }
  }, [lastColorOnly, renderVersion]);

  // 정사각형 영역 크기 추적
  useEffect(() => {
    const el = areaRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setDisplaySize(Math.floor(Math.min(width, height)));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const is2D = previewTab === '2d';

  return (
    <div className="flex flex-col items-center h-full w-full">
      {/* 컨트롤 바 */}
      <div
        className="shrink-0 flex items-center gap-1.5 pt-4 pb-3"
        style={{ width: displaySize > 0 ? `${displaySize}px` : undefined }}
      >
        {/* 2D / 3D 토글 */}
        <div className="inline-flex h-7 items-center rounded-lg bg-zinc-800/50 p-0.5">
          {PREVIEW_TABS.map((t) => (
            <button
              key={t.value}
              onClick={() => setPreviewTab(t.value)}
              className={cn(
                'px-2.5 h-6 text-xs font-medium rounded-md transition-colors',
                previewTab === t.value
                  ? 'bg-zinc-700 text-zinc-100 shadow-sm'
                  : 'text-zinc-500 hover:text-zinc-300',
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* 맵 선택 탭 (2D only) */}
        {is2D && (
          <div className="inline-flex h-7 items-center rounded-lg bg-zinc-800/50 p-0.5">
            {MAP_TABS.map((t) => (
              <button
                key={t.value}
                onClick={() => setSelectedMap(t.value)}
                className={cn(
                  'px-2 h-6 text-xs font-medium rounded-md transition-colors',
                  selectedMap === t.value
                    ? 'bg-zinc-700 text-zinc-100 shadow-sm'
                    : 'text-zinc-500 hover:text-zinc-300',
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
        )}

        <div className="flex-1" />

        {/* 타일 토글 (2D only) */}
        {is2D && (
          <button
            onClick={() => setTiling(!tiling)}
            className={cn(
              'h-7 w-7 flex items-center justify-center rounded-md border transition-colors',
              tiling
                ? 'border-zinc-600 bg-zinc-700 text-zinc-200'
                : 'border-zinc-800 text-zinc-600 hover:text-zinc-400',
            )}
            title="Tile 3x3"
          >
            <Grid2x2 className="w-3.5 h-3.5" />
          </button>
        )}

        {/* 프리뷰 해상도 */}
        <div className="inline-flex h-7 items-center rounded-lg bg-zinc-800/50 p-0.5">
          {RESOLUTION_OPTIONS.map((r) => (
            <button
              key={r}
              onClick={() => setPreviewResolution(r)}
              className={cn(
                'px-2 h-6 text-xs font-medium rounded-md transition-colors',
                previewResolution === r
                  ? 'bg-zinc-700 text-zinc-100 shadow-sm'
                  : 'text-zinc-500 hover:text-zinc-300',
              )}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* 정사각형 프리뷰 영역 */}
      <div ref={areaRef} className="flex-1 flex items-center justify-center min-h-0 w-full px-4 pb-5">
        <div style={{ width: `${displaySize}px`, height: `${displaySize}px` }}>
          {is2D ? (
            <TilePreview2D
              engine={engine}
              renderVersion={renderVersion}
              selectedMap={selectedMap}
              tiling={tiling}
              displaySize={displaySize}
            />
          ) : (
            <SpherePreview3D
              key={patternType}
              engine={engine}
              renderVersion={renderVersion}
            />
          )}
        </div>
      </div>
    </div>
  );
}
