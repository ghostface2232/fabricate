"use client"

import { useRef, useState } from "react"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Popover,
  PopoverContent,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover"
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

function SBPicker({
  hue,
  saturation,
  brightness,
  onChange,
}: {
  hue: number
  saturation: number
  brightness: number
  onChange: (s: number, b: number) => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)

  const calc = (e: React.PointerEvent | PointerEvent) => {
    const r = ref.current!.getBoundingClientRect()
    const s = Math.round(Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * 100)
    const b = Math.round((1 - Math.max(0, Math.min(1, (e.clientY - r.top) / r.height))) * 100)
    onChange(s, b)
  }

  const onPointerDown = (e: React.PointerEvent) => {
    e.preventDefault()
    dragging.current = true
    ref.current!.setPointerCapture(e.pointerId)
    calc(e)
  }
  const onPointerMove = (e: React.PointerEvent) => { if (dragging.current) calc(e) }
  const onPointerUp = () => { dragging.current = false }

  return (
    <div
      ref={ref}
      className="relative h-[140px] rounded-lg cursor-crosshair overflow-hidden border border-zinc-700/60 select-none"
      style={{ backgroundColor: `hsl(${hue}, 100%, 50%)` }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      <div className="absolute inset-0" style={{ background: 'linear-gradient(to right, #fff, transparent)' }} />
      <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, transparent, #000)' }} />
      <div
        className="absolute size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.3),0_2px_4px_rgba(0,0,0,0.4)] pointer-events-none"
        style={{ left: `${saturation}%`, top: `${100 - brightness}%` }}
      />
    </div>
  )
}

function HueBar({
  hue,
  onChange,
}: {
  hue: number
  onChange: (h: number) => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)

  const calc = (e: React.PointerEvent | PointerEvent) => {
    const r = ref.current!.getBoundingClientRect()
    onChange(Math.round(Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * 360))
  }

  const onPointerDown = (e: React.PointerEvent) => {
    e.preventDefault()
    dragging.current = true
    ref.current!.setPointerCapture(e.pointerId)
    calc(e)
  }
  const onPointerMove = (e: React.PointerEvent) => { if (dragging.current) calc(e) }
  const onPointerUp = () => { dragging.current = false }

  return (
    <div
      ref={ref}
      className="relative h-3 rounded-full cursor-pointer select-none"
      style={{ background: 'linear-gradient(to right, #f00 0%, #ff0 17%, #0f0 33%, #0ff 50%, #00f 67%, #f0f 83%, #f00 100%)' }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      <div
        className="absolute size-4 -translate-x-1/2 -translate-y-1/2 top-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.3),0_2px_4px_rgba(0,0,0,0.4)] pointer-events-none"
        style={{ left: `${(hue / 360) * 100}%` }}
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

  // 커밋 값 (트리거 버튼에 표시)
  const committedHex = rgb01ToHex(value)

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
        <Label className="text-zinc-400">{label}</Label>
        <Popover open={open} onOpenChange={handleOpenChange}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="group flex items-center gap-2.5 rounded-lg border border-zinc-800 bg-zinc-900/80 px-3 py-1.5 text-left transition-colors hover:border-zinc-700 hover:bg-zinc-900 focus-visible:border-zinc-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-700"
            >
              <span
                className="size-5 shrink-0 rounded border border-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
                style={{ backgroundColor: committedHex }}
              />
              <span className="font-mono text-xs tracking-[0.14em] text-zinc-200 uppercase">
                {committedHex}
              </span>
            </button>
          </PopoverTrigger>
          <PopoverContent
            side="right"
            align="start"
            sideOffset={12}
            onOpenAutoFocus={(e) => e.preventDefault()}
            className="w-[280px] gap-4 rounded-2xl border border-zinc-800 bg-zinc-900/96 p-4 text-zinc-200 shadow-2xl shadow-black/40 backdrop-blur"
          >
            <PopoverTitle className="text-sm font-medium text-zinc-100">
              {label}
            </PopoverTitle>
            <SBPicker
              hue={draftHsb[0]}
              saturation={draftHsb[1]}
              brightness={draftHsb[2]}
              onChange={(s, b) => updateDraftHsb([draftHsb[0], s, b])}
            />
            <HueBar
              hue={draftHsb[0]}
              onChange={(h) => updateDraftHsb([h, draftHsb[1], draftHsb[2]])}
            />
            <HexField
              value={hexDraft}
              onChange={setHexDraft}
              onCommit={applyHexToDraft}
            />
          </PopoverContent>
        </Popover>
      </div>
    </div>
  )
}
