import { usePatternStore } from '@/stores/patternStore';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import type { PatternType } from '@/types/pattern';

const CATEGORIES = [
  {
    label: 'Woven',
    items: [
      { value: 'plainWeave' as PatternType, label: 'Plain Weave' },
      { value: 'twillWeave' as PatternType, label: 'Twill 2/2' },
      { value: 'satinWeave' as PatternType, label: 'Satin 5H' },
    ],
  },
  {
    label: 'Carbon',
    items: [
      { value: 'carbonPlain' as PatternType, label: 'Carbon Plain' },
      { value: 'carbonTwill' as PatternType, label: 'Carbon Twill' },
    ],
  },
];

export default function PatternTypeSelector() {
  const patternType = usePatternStore((s) => s.params.type);
  const setPatternType = usePatternStore((s) => s.setPatternType);

  return (
    <div className="space-y-4">
      {CATEGORIES.map((cat) => (
        <div key={cat.label} className="space-y-2.5">
          <span className="text-xs text-zinc-400">
            {cat.label}
          </span>
          <ToggleGroup
            type="single"
            value={patternType}
            onValueChange={(v) => {
              if (v) setPatternType(v as PatternType);
            }}
            className="flex"
          >
            {cat.items.map((item, i) => (
              <ToggleGroupItem
                key={item.value}
                value={item.value}
                size="sm"
                variant="outline"
                className={`text-xs h-7 px-3 ${
                  i === 0
                    ? 'rounded-r-none'
                    : i === cat.items.length - 1
                      ? 'rounded-l-none border-l-0'
                      : 'rounded-none border-l-0'
                }`}
              >
                {item.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
      ))}
    </div>
  );
}
