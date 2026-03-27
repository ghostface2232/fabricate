import { useState, useRef, useEffect } from 'react';
import { usePatternStore } from '@/stores/patternStore';
import { useHistoryStore } from '@/stores/historyStore';
import { ColorField } from '@/components/ui/color-field';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ChevronDown, ChevronRight } from 'lucide-react';

function InlineValue({
  value,
  step,
  min,
  max,
  onCommit,
}: {
  value: number;
  step: number;
  min: number;
  max: number;
  onCommit: (v: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  const decimals = step < 1 ? 2 : 0;
  const display = value.toFixed(decimals);

  const commit = () => {
    setEditing(false);
    const n = parseFloat(text);
    if (!isNaN(n)) onCommit(Math.min(max, Math.max(min, n)));
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit();
          if (e.key === 'Escape') setEditing(false);
        }}
        className="w-12 text-xs text-right text-zinc-300 bg-zinc-800 border border-zinc-600 rounded px-1 py-0 font-mono tabular-nums outline-none"
      />
    );
  }

  return (
    <span
      onClick={() => {
        setText(display);
        setEditing(true);
      }}
      className="text-xs text-zinc-500 font-mono tabular-nums cursor-text hover:text-zinc-300 select-none"
    >
      {display}
    </span>
  );
}

function SliderRow({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  const [localVal, setLocalVal] = useState(value);
  const dragging = useRef(false);

  useEffect(() => {
    if (!dragging.current) setLocalVal(value);
  }, [value]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-zinc-400">{label}</Label>
        <InlineValue value={localVal} step={step} min={min} max={max} onCommit={onChange} />
      </div>
      <Slider
        min={min}
        max={max}
        step={step}
        value={[localVal]}
        onValueChange={([v]) => {
          dragging.current = true;
          setLocalVal(v);
        }}
        onValueCommit={([v]) => {
          dragging.current = false;
          onChange(v);
        }}
      />
    </div>
  );
}

export default function ParamControlPanel() {
  const params = usePatternStore((s) => s.params);
  const pbrSettings = usePatternStore((s) => s.pbrSettings);
  const commit = useHistoryStore((s) => s.commit);
  const _up = usePatternStore((s) => s.updateParams);
  const _upbr = usePatternStore((s) => s.updatePBRSettings);
  const updateParams: typeof _up = (p) => commit(() => _up(p));
  const updatePBRSettings: typeof _upbr = (p) => commit(() => _upbr(p));
  const [pbrOpen, setPbrOpen] = useState(false);

  const isWeave =
    params.type === 'plainWeave' ||
    params.type === 'twillWeave' ||
    params.type === 'satinWeave';

  return (
    <div className="space-y-6">
      {/* ── 색상 ── */}
      {isWeave ? (
        <div className="space-y-4">
          <ColorField
            label="Warp Color"
            value={params.warpColor}
            onChange={(v) => updateParams({ warpColor: v })}
          />
          <ColorField
            label="Weft Color"
            value={params.weftColor}
            onChange={(v) => updateParams({ weftColor: v })}
          />
        </div>
      ) : (
        <div className="space-y-4">
          <ColorField
            label="Fiber Color"
            value={params.fiberColor}
            onChange={(v) => updateParams({ fiberColor: v })}
          />
          <ColorField
            label="Resin Color"
            value={params.resinColor}
            onChange={(v) => updateParams({ resinColor: v })}
          />
        </div>
      )}

      <Separator className="bg-zinc-800" />

      {/* ── 공통 파라미터 ── */}
      <div className="space-y-5">
        <SliderRow
          label="Density"
          value={(params.density - 15) / 45}
          min={0}
          max={1}
          step={0.01}
          onChange={(v) => updateParams({ density: Math.round(v * 45 + 15) })}
        />
        <SliderRow
          label="Yarn Thickness"
          value={params.yarnThickness}
          min={0.1}
          max={1.0}
          step={0.01}
          onChange={(v) => updateParams({ yarnThickness: v })}
        />
        <SliderRow
          label="Flattening"
          value={params.flattening}
          min={0}
          max={1}
          step={0.01}
          onChange={(v) => updateParams({ flattening: v })}
        />
      </div>

      {/* ── Weave 전용 ── */}
      {isWeave && (
        <>
          <Separator className="bg-zinc-800" />
          <div className="space-y-5">
            <SliderRow
              label="Twist"
              value={params.twistAngle}
              min={0}
              max={40}
              step={1}
              onChange={(v) => updateParams({ twistAngle: v })}
            />
          </div>
        </>
      )}

      {/* ── 능직 전용 ── */}
      {params.type === 'twillWeave' && (
        <>
          <Separator className="bg-zinc-800" />
          <div className="space-y-2.5">
            <Label className="text-zinc-400">Direction</Label>
            <ToggleGroup
              type="single"
              value={String(params.twillDirection)}
              onValueChange={(v) => {
                if (v) updateParams({ twillDirection: Number(v) as 1 | -1 });
              }}
              className="flex"
            >
              <ToggleGroupItem value="1" size="sm" variant="outline" className="text-xs h-7 px-3 rounded-r-none">
                Z
              </ToggleGroupItem>
              <ToggleGroupItem value="-1" size="sm" variant="outline" className="text-xs h-7 px-3 rounded-l-none border-l-0">
                S
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
        </>
      )}

      {/* ── 수자직 전용 ── */}
      {params.type === 'satinWeave' && (
        <>
          <Separator className="bg-zinc-800" />
          <div className="space-y-5">
            <SliderRow
              label="Repeat Size"
              value={params.repeatSize}
              min={5}
              max={8}
              step={1}
              onChange={(v) => updateParams({ repeatSize: v })}
            />
            <SliderRow
              label="Satin Shift"
              value={params.satinShift}
              min={2}
              max={params.repeatSize - 1}
              step={1}
              onChange={(v) => updateParams({ satinShift: v })}
            />
          </div>
        </>
      )}

      {/* ── Carbon 전용 ── */}
      {!isWeave && (
        <>
          <Separator className="bg-zinc-800" />
          <div className="space-y-5">
            <div className="space-y-2.5">
              <Label className="text-zinc-400">Tow Size</Label>
              <Select
                value={String(params.towK)}
                onValueChange={(v) => updateParams({ towK: Number(v) as 1 | 3 | 6 })}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1K</SelectItem>
                  <SelectItem value="3">3K</SelectItem>
                  <SelectItem value="6">6K</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <SliderRow
              label="Glossiness"
              value={params.glossiness}
              min={0}
              max={1}
              step={0.01}
              onChange={(v) => updateParams({ glossiness: v })}
            />
            <SliderRow
              label="Gap Width"
              value={params.gapWidth}
              min={0}
              max={0.3}
              step={0.01}
              onChange={(v) => updateParams({ gapWidth: v })}
            />
          </div>
        </>
      )}

      {/* ── PBR Settings (접기/펴기) ── */}
      <Separator className="bg-zinc-800" />
      <button
        onClick={() => setPbrOpen(!pbrOpen)}
        className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-300 w-full"
      >
        {pbrOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        PBR Settings
      </button>

      {pbrOpen && (
        <div className="space-y-5">
          <SliderRow
            label="Normal Strength"
            value={pbrSettings.normalStrength}
            min={0.1}
            max={5.0}
            step={0.1}
            onChange={(v) => updatePBRSettings({ normalStrength: v })}
          />
          <div className="space-y-2.5">
            <Label className="text-zinc-400">Normal Filter</Label>
            <ToggleGroup
              type="single"
              value={pbrSettings.normalFilter}
              onValueChange={(v) => {
                if (v) updatePBRSettings({ normalFilter: v as 'sobel' | 'scharr' });
              }}
              className="flex"
            >
              <ToggleGroupItem value="sobel" size="sm" variant="outline" className="text-xs h-7 px-3 rounded-r-none">
                Sobel
              </ToggleGroupItem>
              <ToggleGroupItem value="scharr" size="sm" variant="outline" className="text-xs h-7 px-3 rounded-l-none border-l-0">
                Scharr
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
          <SliderRow
            label="AO Radius"
            value={pbrSettings.aoRadius}
            min={1.0}
            max={10.0}
            step={0.1}
            onChange={(v) => updatePBRSettings({ aoRadius: v })}
          />
          <SliderRow
            label="AO Intensity"
            value={pbrSettings.aoIntensity}
            min={0.0}
            max={2.0}
            step={0.01}
            onChange={(v) => updatePBRSettings({ aoIntensity: v })}
          />
          <SliderRow
            label="Roughness Base"
            value={pbrSettings.roughnessBase}
            min={0.0}
            max={1.0}
            step={0.01}
            onChange={(v) => updatePBRSettings({ roughnessBase: v })}
          />
          <SliderRow
            label="Roughness Variation"
            value={pbrSettings.roughnessVariation}
            min={0.0}
            max={0.5}
            step={0.01}
            onChange={(v) => updatePBRSettings({ roughnessVariation: v })}
          />
          <SliderRow
            label="Cavity Influence"
            value={pbrSettings.roughnessCavityInfluence}
            min={0.0}
            max={1.0}
            step={0.01}
            onChange={(v) => updatePBRSettings({ roughnessCavityInfluence: v })}
          />
        </div>
      )}
    </div>
  );
}
