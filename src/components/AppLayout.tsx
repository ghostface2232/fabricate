import { useEffect } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { useHistoryStore } from '@/stores/historyStore';
import { Download, Undo2, Redo2 } from 'lucide-react';
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
  const undo = useHistoryStore((s) => s.undo);
  const redo = useHistoryStore((s) => s.redo);
  const canUndo = useHistoryStore((s) => s.undoStack.length > 0);
  const canRedo = useHistoryStore((s) => s.redoStack.length > 0);

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
          <Button size="sm" className="h-7 text-xs gap-1.5">
            <Download className="w-3.5 h-3.5" />
            Export
          </Button>
        </div>
      </header>

      {/* ── Body: 3-column ── */}
      <div className="flex flex-1 min-h-0">
        {/* Left Panel: Pattern */}
        <div className="w-[320px] shrink-0 border-r border-zinc-800 bg-zinc-900/60">
          <ScrollArea className="h-full">
            <div className="p-5 space-y-4">
              <div className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">
                Pattern
              </div>
              <PatternTypeSelector />
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

        {/* Right Panel: Settings */}
        <div className="w-[320px] shrink-0 border-l border-zinc-800 bg-zinc-900/60">
          <ScrollArea className="h-full">
            <div className="p-5 space-y-4">
              <div className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">
                Parameters
              </div>
              <div className="border-t border-zinc-800" />
              <ParamControlPanel />
            </div>
          </ScrollArea>
        </div>
      </div>
    </div>
  );
}
