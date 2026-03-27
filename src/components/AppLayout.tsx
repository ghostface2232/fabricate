import { useState, useEffect } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { usePatternStore } from '@/stores/patternStore';
import { useHistoryStore } from '@/stores/historyStore';
import { defaultPresets } from '@/presets/defaultPresets';
import { Download, ChevronDown, Undo2, Redo2 } from 'lucide-react';
import PatternTypeSelector from '@/components/panels/PatternTypeSelector';
import ParamControlPanel from '@/components/panels/ParamControlPanel';
import PreviewContainer from '@/components/preview/PreviewContainer';
import type { PatternEngine } from '@/engine/PatternEngine';

interface AppLayoutProps {
  engine: PatternEngine | null;
  renderVersion: number;
  lastColorOnly: boolean;
  isRendering: boolean;
}

export default function AppLayout({
  engine,
  renderVersion,
  lastColorOnly,
  isRendering,
}: AppLayoutProps) {
  const commit = useHistoryStore((s) => s.commit);
  const undo = useHistoryStore((s) => s.undo);
  const redo = useHistoryStore((s) => s.redo);
  const canUndo = useHistoryStore((s) => s.undoStack.length > 0);
  const canRedo = useHistoryStore((s) => s.redoStack.length > 0);

  const _loadPreset = usePatternStore((s) => s.loadPreset);
  const loadPreset: typeof _loadPreset = (p) => commit(() => _loadPreset(p));
  const [presetName, setPresetName] = useState('');

  // ── Keyboard shortcuts: Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y ──
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      const ctrl = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();

      if (ctrl && key === 'z' && !e.shiftKey) {
        e.preventDefault();
        useHistoryStore.getState().undo();
      } else if (ctrl && key === 'z' && e.shiftKey) {
        e.preventDefault();
        useHistoryStore.getState().redo();
      } else if (ctrl && key === 'y') {
        e.preventDefault();
        useHistoryStore.getState().redo();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return (
    <div className="h-screen flex flex-col bg-zinc-950 text-zinc-300 overflow-hidden">
      {/* ── Header ── */}
      <header className="h-12 shrink-0 flex items-center justify-between px-4 border-b border-zinc-800 bg-zinc-900">
        <span className="font-mono text-sm text-zinc-400 select-none">
          Fabricate
        </span>
        <div className="flex items-center gap-2">
          <div className="flex items-center">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              disabled={!canUndo}
              onClick={undo}
              title="Undo (Ctrl+Z)"
            >
              <Undo2 className="w-3.5 h-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              disabled={!canRedo}
              onClick={redo}
              title="Redo (Ctrl+Shift+Z)"
            >
              <Redo2 className="w-3.5 h-3.5" />
            </Button>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-7 text-xs gap-1">
                {presetName || 'Presets'}
                <ChevronDown className="w-3 h-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {defaultPresets.map((p) => (
                <DropdownMenuItem
                  key={p.id}
                  onClick={() => {
                    loadPreset(p);
                    setPresetName(p.name);
                  }}
                  className="text-xs"
                >
                  {p.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button size="sm" className="h-7 text-xs gap-1.5">
            <Download className="w-3.5 h-3.5" />
            Export
          </Button>
        </div>
      </header>

      {/* ── Body: 2-column ── */}
      <div className="flex flex-1 min-h-0">
        {/* Left Panel */}
        <div className="w-[300px] shrink-0 border-r border-zinc-800 bg-zinc-900/60">
          <ScrollArea className="h-full">
            <div className="p-5 space-y-7">
              <PatternTypeSelector />
              <div className="border-t border-zinc-800" />
              <ParamControlPanel />
            </div>
          </ScrollArea>
        </div>

        {/* Center Preview */}
        <div className="flex-1 flex items-center justify-center bg-zinc-950 min-w-0 overflow-hidden relative">
          <PreviewContainer
            engine={engine}
            renderVersion={renderVersion}
            lastColorOnly={lastColorOnly}
          />
          {isRendering && (
            <div className="absolute inset-0 flex items-center justify-center bg-zinc-950/70 pointer-events-none">
              <div className="flex items-center gap-2 text-sm text-zinc-400">
                <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" className="opacity-25" />
                  <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="opacity-75" />
                </svg>
                Rendering...
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
