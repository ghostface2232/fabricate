import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { usePatternStore } from '@/stores/patternStore';
import { exportAllMaps, exportAsZip, makeFilename } from '@/engine/TextureExporter';
import { saveBlob, saveBlobsToDirectory } from '@/utils/fileAccess';
import type { PatternEngine } from '@/engine/PatternEngine';
import type { PBRMapType } from '@/types/pattern';
import { FolderOpen, FileArchive, Loader2, Check } from 'lucide-react';

const ALL_MAPS: PBRMapType[] = ['diffuse', 'height', 'normal', 'roughness', 'ao'];

const MAP_LABELS: Record<PBRMapType, string> = {
  height: 'Height',
  normal: 'Normal',
  ao: 'AO',
  roughness: 'Roughness',
  diffuse: 'Diffuse',
};

const RESOLUTIONS = [512, 1024, 2048, 4096] as const;

interface ExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  engine: PatternEngine | null;
}

export default function ExportDialog({
  open,
  onOpenChange,
  engine,
}: ExportDialogProps) {
  const params = usePatternStore((s) => s.params);
  const pbrSettings = usePatternStore((s) => s.pbrSettings);
  const exportSettings = usePatternStore((s) => s.exportSettings);
  const updateExportSettings = usePatternStore((s) => s.updateExportSettings);

  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, mapName: '' });

  const toggleMap = useCallback(
    (map: PBRMapType) => {
      const current = exportSettings.selectedMaps;
      const next = current.includes(map)
        ? current.filter((m) => m !== map)
        : [...current, map];
      if (next.length > 0) {
        updateExportSettings({ selectedMaps: next });
      }
    },
    [exportSettings.selectedMaps, updateExportSettings],
  );

  const handleExportToFolder = useCallback(async () => {
    if (!engine || exporting) return;
    setExporting(true);
    try {
      const blobs = await exportAllMaps(
        engine, exportSettings, params, pbrSettings,
        (current, total, mapName) => setProgress({ current, total, mapName }),
      );

      const files: Record<string, Blob> = {};
      for (const [mapType, blob] of Object.entries(blobs)) {
        const filename = makeFilename(
          exportSettings.filenamePrefix,
          mapType as PBRMapType,
          exportSettings.resolution,
          exportSettings.normalDirection,
        );
        files[filename] = blob;
      }

      await saveBlobsToDirectory(files);
      toast.success('Export complete');
      onOpenChange(false);
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') {
        setExporting(false);
        return;
      }
      toast.error('Export failed');
    } finally {
      setExporting(false);
    }
  }, [engine, exporting, exportSettings, params, pbrSettings, onOpenChange]);

  const handleExportAsZip = useCallback(async () => {
    if (!engine || exporting) return;
    setExporting(true);
    try {
      const zipBlob = await exportAsZip(
        engine, exportSettings, params, pbrSettings,
        (current, total, mapName) => setProgress({ current, total, mapName }),
      );

      const zipName = `${exportSettings.filenamePrefix}_${exportSettings.resolution}.zip`;
      await saveBlob(zipBlob, zipName);
      toast.success('Export complete');
      onOpenChange(false);
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') {
        setExporting(false);
        return;
      }
      toast.error('Export failed');
    } finally {
      setExporting(false);
    }
  }, [engine, exporting, exportSettings, params, pbrSettings, onOpenChange]);

  const noMapsSelected = exportSettings.selectedMaps.length === 0;

  return (
    <Dialog open={open} onOpenChange={exporting ? undefined : onOpenChange}>
      <DialogContent className="sm:max-w-lg p-6">
        <DialogHeader>
          <DialogTitle>Export Textures</DialogTitle>
          <DialogDescription>
            Export PBR texture maps as PNG files.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 pt-1">
          {/* Resolution */}
          <div className="space-y-2">
            <Label className="text-xs text-zinc-400">Resolution</Label>
            <div className="inline-flex w-full items-center rounded-lg bg-zinc-800/50 p-0.5">
              {RESOLUTIONS.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() =>
                    updateExportSettings({
                      resolution: r,
                    })
                  }
                  disabled={exporting}
                  className={cn(
                    'flex-1 h-7 text-xs font-medium rounded-md transition-colors disabled:opacity-50',
                    exportSettings.resolution === r
                      ? 'bg-zinc-700 text-zinc-100 shadow-sm'
                      : 'text-zinc-500 hover:text-zinc-300',
                  )}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          {/* Normal Direction */}
          <div className="space-y-2">
            <Label className="text-xs text-zinc-400">Normal Direction</Label>
            <div className="inline-flex w-full items-center rounded-lg bg-zinc-800/50 p-0.5">
              {([
                { value: 'opengl' as const, label: 'OpenGL', tools: 'Blender, Maya, KeyShot, C4D' },
                { value: 'directx' as const, label: 'DirectX', tools: 'Unreal, 3ds Max, Substance' },
              ]).map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => updateExportSettings({ normalDirection: opt.value })}
                  disabled={exporting}
                  className={cn(
                    'flex-1 flex flex-col items-center gap-0.5 py-2 rounded-md transition-colors disabled:opacity-50',
                    exportSettings.normalDirection === opt.value
                      ? 'bg-zinc-700 shadow-sm'
                      : 'hover:text-zinc-300',
                  )}
                >
                  <span className={cn(
                    'text-xs font-medium',
                    exportSettings.normalDirection === opt.value
                      ? 'text-zinc-100'
                      : 'text-zinc-500',
                  )}>
                    {opt.label}
                  </span>
                  <span className={cn(
                    'text-[10px]',
                    exportSettings.normalDirection === opt.value
                      ? 'text-zinc-400'
                      : 'text-zinc-600',
                  )}>
                    {opt.tools}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Filename Prefix */}
          <div className="space-y-2">
            <Label className="text-xs text-zinc-400">Filename Prefix</Label>
            <Input
              value={exportSettings.filenamePrefix}
              onChange={(e) =>
                updateExportSettings({ filenamePrefix: e.target.value })
              }
              placeholder={params.type}
              disabled={exporting}
              className="h-8 text-sm"
            />
          </div>

          {/* Map Selection */}
          <div className="space-y-2">
            <Label className="text-xs text-zinc-400">Maps</Label>
            <div className="flex flex-wrap gap-1.5">
              {ALL_MAPS.map((map) => {
                const selected = exportSettings.selectedMaps.includes(map);
                return (
                  <button
                    key={map}
                    type="button"
                    onClick={() => toggleMap(map)}
                    disabled={exporting}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs border transition-colors ${
                      selected
                        ? 'bg-zinc-800 border-zinc-600 text-zinc-200'
                        : 'bg-zinc-900/50 border-zinc-800 text-zinc-500 hover:border-zinc-700'
                    } disabled:opacity-50 disabled:pointer-events-none`}
                  >
                    <div
                      className={`w-3.5 h-3.5 rounded-[3px] border flex items-center justify-center ${
                        selected
                          ? 'bg-violet-500 border-violet-400'
                          : 'border-zinc-600 bg-zinc-800/50'
                      }`}
                    >
                      {selected && <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />}
                    </div>
                    {MAP_LABELS[map]}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Progress */}
          {exporting && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs text-zinc-400">
                <Loader2 className="w-3 h-3 animate-spin" />
                <span>
                  Exporting {MAP_LABELS[progress.mapName as PBRMapType] ?? '...'}{' '}
                  ({progress.current}/{progress.total})
                </span>
              </div>
              <div className="h-1 rounded-full bg-zinc-800 overflow-hidden">
                <div
                  className="h-full bg-violet-500 rounded-full transition-all duration-200"
                  style={{
                    width: progress.total
                      ? `${(progress.current / progress.total) * 100}%`
                      : '0%',
                  }}
                />
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={handleExportToFolder}
            disabled={!engine || exporting || noMapsSelected}
          >
            <FolderOpen className="w-3.5 h-3.5" />
            Save to Folder
          </Button>
          <Button
            size="sm"
            className="gap-1.5"
            onClick={handleExportAsZip}
            disabled={!engine || exporting || noMapsSelected}
          >
            <FileArchive className="w-3.5 h-3.5" />
            ZIP Download
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
