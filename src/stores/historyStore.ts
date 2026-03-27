import { create } from 'zustand';
import { usePatternStore } from './patternStore';
import type { PatternParams, PBRSettings } from '@/types/pattern';

interface Snapshot {
  params: PatternParams;
  pbrSettings: PBRSettings;
  previewResolution: number;
}

const MAX_HISTORY = 50;

function takeSnapshot(): Snapshot {
  const s = usePatternStore.getState();
  return {
    params: structuredClone(s.params),
    pbrSettings: structuredClone(s.pbrSettings),
    previewResolution: s.previewResolution,
  };
}

function stateChanged(
  before: { params: unknown; pbrSettings: unknown; previewResolution: number },
  after: { params: unknown; pbrSettings: unknown; previewResolution: number },
): boolean {
  return (
    before.params !== after.params ||
    before.pbrSettings !== after.pbrSettings ||
    before.previewResolution !== after.previewResolution
  );
}

interface HistoryStore {
  undoStack: Snapshot[];
  redoStack: Snapshot[];
  _restoring: boolean;

  /** action 실행 전 스냅샷을 저장하고, 실제 변경이 있을 때만 히스토리에 push */
  commit: (action: () => void) => void;
  undo: () => void;
  redo: () => void;
}

export const useHistoryStore = create<HistoryStore>((set, get) => ({
  undoStack: [],
  redoStack: [],
  _restoring: false,

  commit: (action) => {
    if (get()._restoring) {
      action();
      return;
    }

    const before = usePatternStore.getState();
    const snapshot = takeSnapshot();

    action();

    const after = usePatternStore.getState();
    if (!stateChanged(before, after)) return;

    set((s) => ({
      undoStack: [...s.undoStack.slice(-(MAX_HISTORY - 1)), snapshot],
      redoStack: [],
    }));
  },

  undo: () => {
    const { undoStack } = get();
    if (undoStack.length === 0) return;

    const prev = undoStack[undoStack.length - 1];

    set((s) => ({
      undoStack: s.undoStack.slice(0, -1),
      redoStack: [...s.redoStack, takeSnapshot()],
      _restoring: true,
    }));

    usePatternStore.setState({
      params: structuredClone(prev.params),
      pbrSettings: structuredClone(prev.pbrSettings),
      previewResolution: prev.previewResolution,
    });

    set({ _restoring: false });
  },

  redo: () => {
    const { redoStack } = get();
    if (redoStack.length === 0) return;

    const next = redoStack[redoStack.length - 1];

    set((s) => ({
      redoStack: s.redoStack.slice(0, -1),
      undoStack: [...s.undoStack, takeSnapshot()],
      _restoring: true,
    }));

    usePatternStore.setState({
      params: structuredClone(next.params),
      pbrSettings: structuredClone(next.pbrSettings),
      previewResolution: next.previewResolution,
    });

    set({ _restoring: false });
  },
}));
