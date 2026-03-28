import { usePatternStore } from '@/stores/patternStore';
import { useHistoryStore } from '@/stores/historyStore';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { PATTERN_CATEGORIES } from '@/patterns/patternCatalog';
import type { PatternType } from '@/types/pattern';

export default function PatternTypeSelector() {
  const patternType = usePatternStore((s) => s.params.type);
  const commit = useHistoryStore((s) => s.commit);
  const _setType = usePatternStore((s) => s.setPatternType);
  const setPatternType: typeof _setType = (t) => commit(() => _setType(t));

  return (
    <div className="space-y-4">
      {PATTERN_CATEGORIES.map((category) => (
        <div key={category.label} className="space-y-2.5">
          <div className="flex items-center justify-between">
            <Label className="text-zinc-400">{category.label}</Label>
            <span className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">
              {category.items.length}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {category.items.map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => setPatternType(item.value as PatternType)}
                className={cn(
                  'rounded-lg border px-3 py-2 text-left transition-colors',
                  patternType === item.value
                    ? 'border-zinc-500 bg-zinc-800 text-zinc-50'
                    : 'border-zinc-800 bg-zinc-900/60 text-zinc-300 hover:border-zinc-700 hover:bg-zinc-900',
                )}
              >
                <div className="pt-1 text-sm font-medium leading-4">{item.label}</div>
                <div className="mt-1 text-[9px] font-mono uppercase tracking-[0.06em] text-zinc-500">
                  {item.structure}
                </div>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
