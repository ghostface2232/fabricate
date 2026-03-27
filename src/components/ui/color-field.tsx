"use client"

import { useEffect, useMemo, useRef, useState } from "react"

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

/** 8-bit 정밀도 이내 색상 동일 여부 */
function colorEqual(a: RGB01, b: RGB01): boolean {
  const eps = 0.5 / 255
  return (
    Math.abs(a[0] - b[0]) < eps &&
    Math.abs(a[1] - b[1]) < eps &&
    Math.abs(a[2] - b[2]) < eps
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

  // 팝오버 열림 중 로컬 draft 색상 (스토어에 반영하지 않음)
  const [draft, setDraft] = useState<RGB01>(value)
  const [hexDraft, setHexDraft] = useState(rgb01ToHex(value))

  // 팝오버 닫힘 중 외부 value 변경 시 draft 동기화
  const prevValueRef = useRef(value)
  if (!open && prevValueRef.current !== value) {
    prevValueRef.current = value
    setDraft(value)
    setHexDraft(rgb01ToHex(value))
  }

  // draft 파생 값
  const draftHsb = rgb01ToHsb(draft)
  const draftHex = rgb01ToHex(draft)

  // 커밋 값 (트리거 버튼에 표시)
  const committedHex = rgb01ToHex(value)
  const committedHsb = rgb01ToHsb(value)

  // draft HSB 슬라이더 변경 → draft만 갱신
  const updateDraftHsb = (newHsb: HSB) => {
    const rgb = hsbToRgb01(newHsb)
    setDraft(rgb)
    setHexDraft(rgb01ToHex(rgb))
  }

  // draft hex 입력 커밋 → draft만 갱신
  const applyHexToDraft = (nextHex: string) => {
    if (/^#[0-9a-f]{6}$/i.test(nextHex)) {
      const rgb = hexToRgb01(nextHex)
      setDraft(rgb)
      setHexDraft(nextHex)
    }
  }

  // 팝오버 열기/닫기
  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      // 열기: draft를 현재 committed 값으로 초기화
      setDraft(value)
      setHexDraft(rgb01ToHex(value))
    } else {
      // 닫기: draft가 바뀌었으면 커밋
      if (!colorEqual(draft, value)) {
        onChange(draft)
      }
    }
    setOpen(nextOpen)
  }

  // hexDraft는 draft가 슬라이더로 바뀔 때 자동 동기화 (updateDraftHsb에서 처리)
  // 사용자가 hex 입력 중일 때는 직접 제어하므로 추가 동기화 불필요

  return (
    <div className={cn("space-y-2.5", className)}>
      <div className="flex items-center justify-between gap-3">
        <span className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">
          {label}
        </span>
        <Popover open={open} onOpenChange={handleOpenChange}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="group flex min-w-[184px] items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900/80 px-3.5 py-2.5 text-left transition-colors hover:border-zinc-700 hover:bg-zinc-900 focus-visible:border-zinc-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-700"
            >
              <span
                className="size-6 shrink-0 rounded-md border border-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
                style={{ backgroundColor: committedHex }}
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-mono text-xs tracking-[0.16em] text-zinc-200 uppercase">
                  {committedHex}
                </span>
                <span className="block truncate text-[11px] text-zinc-500 group-hover:text-zinc-400">
                  H {committedHsb[0]} / S {committedHsb[1]} / B {committedHsb[2]}
                </span>
              </span>
            </button>
          </PopoverTrigger>
          <PopoverContent
            align="end"
            sideOffset={8}
            onOpenAutoFocus={(e) => e.preventDefault()}
            className="w-[280px] gap-4 rounded-2xl border border-zinc-800 bg-zinc-900/96 p-4 text-zinc-200 shadow-2xl shadow-black/40 backdrop-blur"
          >
            <PopoverTitle className="text-sm font-medium text-zinc-100">
              {label}
            </PopoverTitle>
            <ColorPreview value={draft} />
            <HexField
              value={hexDraft}
              onChange={setHexDraft}
              onCommit={applyHexToDraft}
            />
            <div className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-950/70 p-3">
              <ChannelRow
                label="H"
                max={360}
                value={draftHsb[0]}
                onChange={(next) => updateDraftHsb([next, draftHsb[1], draftHsb[2]])}
              />
              <ChannelRow
                label="S"
                max={100}
                suffix="%"
                value={draftHsb[1]}
                onChange={(next) => updateDraftHsb([draftHsb[0], next, draftHsb[2]])}
              />
              <ChannelRow
                label="B"
                max={100}
                suffix="%"
                value={draftHsb[2]}
                onChange={(next) => updateDraftHsb([draftHsb[0], draftHsb[1], next])}
              />
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  )
}
