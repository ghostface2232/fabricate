"use client"

import { useEffect, useMemo, useState } from "react"

import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Slider } from "@/components/ui/slider"
import { cn } from "@/lib/utils"
import { hexToRgb01, rgb01ToHex } from "@/utils/colorConvert"

type RGB01 = [number, number, number]
type HSB = [number, number, number]

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value))
}

function rgb01ToHsb(rgb: RGB01): HSB {
  const [r, g, b] = rgb
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const delta = max - min

  let hue = 0

  if (delta !== 0) {
    if (max === r) hue = ((g - b) / delta) % 6
    else if (max === g) hue = (b - r) / delta + 2
    else hue = (r - g) / delta + 4
  }

  hue = Math.round(((hue * 60) + 360) % 360)
  const saturation = max === 0 ? 0 : Math.round((delta / max) * 100)
  const brightness = Math.round(max * 100)

  return [hue, saturation, brightness]
}

function hsbToRgb01([h, s, b]: HSB): RGB01 {
  const hue = ((h % 360) + 360) % 360
  const saturation = clamp01(s / 100)
  const brightness = clamp01(b / 100)
  const chroma = brightness * saturation
  const x = chroma * (1 - Math.abs(((hue / 60) % 2) - 1))
  const m = brightness - chroma

  let rgbPrime: [number, number, number] = [0, 0, 0]

  if (hue < 60) rgbPrime = [chroma, x, 0]
  else if (hue < 120) rgbPrime = [x, chroma, 0]
  else if (hue < 180) rgbPrime = [0, chroma, x]
  else if (hue < 240) rgbPrime = [0, x, chroma]
  else if (hue < 300) rgbPrime = [x, 0, chroma]
  else rgbPrime = [chroma, 0, x]

  return [
    clamp01(rgbPrime[0] + m),
    clamp01(rgbPrime[1] + m),
    clamp01(rgbPrime[2] + m),
  ]
}

function sanitizeHexInput(value: string) {
  const hex = value.replace(/[^0-9a-f]/gi, "").slice(0, 6)
  return `#${hex}`
}

function ChannelRow({
  label,
  max,
  suffix,
  value,
  onChange,
}: {
  label: string
  max: number
  suffix?: string
  value: number
  onChange: (value: number) => void
}) {
  return (
    <div className="grid grid-cols-[18px_1fr_42px] items-center gap-3">
      <span className="text-[11px] font-mono uppercase tracking-[0.18em] text-zinc-500">
        {label}
      </span>
      <Slider
        min={0}
        max={max}
        step={1}
        value={[value]}
        onValueChange={([next]) => onChange(next)}
      />
      <span className="text-right font-mono text-xs tabular-nums text-zinc-400">
        {value}{suffix}
      </span>
    </div>
  )
}

function ColorPreview({ value }: { value: RGB01 }) {
  const hex = rgb01ToHex(value)
  const swatchStyle = useMemo(
    () => ({
      background: `linear-gradient(135deg, ${hex} 0%, color-mix(in srgb, ${hex} 64%, black) 100%)`,
    }),
    [hex]
  )

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950/80 p-3">
      <div
        className="h-[4.5rem] rounded-lg border border-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
        style={swatchStyle}
      />
    </div>
  )
}

function HexField({
  value,
  onChange,
  onCommit,
}: {
  value: string
  onChange: (value: string) => void
  onCommit: (value: string) => void
}) {
  return (
    <div className="space-y-1.5">
      <span className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">
        Hex
      </span>
      <Input
        value={value}
        onChange={(event) => onChange(sanitizeHexInput(event.target.value))}
        onBlur={(event) => {
          const normalized = sanitizeHexInput(event.target.value)
          if (normalized.length === 7) {
            onCommit(normalized)
            return
          }
          onCommit(normalized.padEnd(7, "0"))
        }}
        className="h-9 border-zinc-800 bg-zinc-950/70 font-mono text-sm tracking-[0.14em] text-zinc-200 uppercase"
      />
    </div>
  )
}

export function ColorField({
  label,
  value,
  onChange,
  className,
}: {
  label: string
  value: RGB01
  onChange: (value: RGB01) => void
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const [hexDraft, setHexDraft] = useState(rgb01ToHex(value))
  const hsb = rgb01ToHsb(value)
  const hex = rgb01ToHex(value)

  useEffect(() => {
    setHexDraft(hex)
  }, [hex])

  const applyHex = (nextHex: string) => {
    if (/^#[0-9a-f]{6}$/i.test(nextHex)) {
      onChange(hexToRgb01(nextHex))
    }
  }

  return (
    <div className={cn("space-y-2.5", className)}>
      <div className="flex items-center justify-between gap-3">
        <span className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">
          {label}
        </span>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="group flex min-w-[184px] items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900/80 px-3.5 py-2.5 text-left transition-colors hover:border-zinc-700 hover:bg-zinc-900 focus-visible:border-zinc-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-700"
            >
              <span
                className="size-6 shrink-0 rounded-md border border-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
                style={{ backgroundColor: hex }}
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-mono text-xs tracking-[0.16em] text-zinc-200 uppercase">
                  {hex}
                </span>
                <span className="block truncate text-[11px] text-zinc-500 group-hover:text-zinc-400">
                  H {hsb[0]} / S {hsb[1]} / B {hsb[2]}
                </span>
              </span>
            </button>
          </PopoverTrigger>
          <PopoverContent
            align="end"
            sideOffset={8}
            className="w-[280px] gap-4 rounded-2xl border border-zinc-800 bg-zinc-900/96 p-4 text-zinc-200 shadow-2xl shadow-black/40 backdrop-blur"
          >
            <PopoverTitle className="text-sm font-medium text-zinc-100">
              {label}
            </PopoverTitle>
            <ColorPreview value={value} />
            <HexField
              value={hexDraft}
              onChange={setHexDraft}
              onCommit={applyHex}
            />
            <div className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-950/70 p-3">
              <ChannelRow
                label="H"
                max={360}
                value={hsb[0]}
                onChange={(next) => onChange(hsbToRgb01([next, hsb[1], hsb[2]]))}
              />
              <ChannelRow
                label="S"
                max={100}
                suffix="%"
                value={hsb[1]}
                onChange={(next) => onChange(hsbToRgb01([hsb[0], next, hsb[2]]))}
              />
              <ChannelRow
                label="B"
                max={100}
                suffix="%"
                value={hsb[2]}
                onChange={(next) => onChange(hsbToRgb01([hsb[0], hsb[1], next]))}
              />
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  )
}
