/**
 * 텍스처를 PNG 이미지로 변환하는 유틸리티.
 * React 의존성 없음.
 */

import type { PatternEngine } from './PatternEngine';
import type {
  PatternParams,
  PBRSettings,
  PBRMapType,
  ExportSettings,
  NormalDirection,
} from '@/types/pattern';
import JSZip from 'jszip';

/**
 * readPixels 결과의 행 순서를 뒤집는다.
 * WebGL은 좌하단 원점, 이미지는 좌상단 원점이므로 반드시 필요.
 * 각 행은 width * 4 바이트(RGBA).
 */
export function flipPixelsVertically(
  pixels: Uint8Array,
  width: number,
  height: number,
): Uint8Array {
  const rowSize = width * 4;
  const result = new Uint8Array(pixels.length);
  for (let y = 0; y < height; y++) {
    const srcOffset = y * rowSize;
    const dstOffset = (height - 1 - y) * rowSize;
    result.set(pixels.subarray(srcOffset, srcOffset + rowSize), dstOffset);
  }
  return result;
}

/**
 * Uint8Array(RGBA)를 Canvas 2D에 putImageData한 뒤 toBlob('image/png')으로 변환.
 * pixels는 이미 Y축 반전된 상태여야 한다.
 */
export function pixelsToBlob(
  pixels: Uint8Array,
  width: number,
  height: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      reject(new Error('Failed to create 2D canvas context'));
      return;
    }
    const imageData = new ImageData(
      new Uint8ClampedArray(pixels),
      width,
      height,
    );
    ctx.putImageData(imageData, 0, 0);
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('canvas.toBlob returned null'));
    }, 'image/png');
  });
}

/**
 * 셰이더는 WebGL UV 공간에서 노멀을 계산한다.
 * readPixels → flipPixelsVertically 후 이미지 공간으로 전환되면서
 * R(X)과 G(Y) 채널 모두 이미지 컨벤션 보정이 필요하다.
 *
 * - OpenGL: R·G 반전 (UV→이미지 보정)
 * - DirectX: R 반전만 (G는 UV→이미지 보정 + DX Y반전이 상쇄)
 */
function applyNormalDirection(
  pixels: Uint8Array,
  normalDirection: NormalDirection,
): Uint8Array {
  const out = new Uint8Array(pixels);
  for (let i = 0; i < out.length; i += 4) {
    out[i] = 255 - out[i];                              // R(X) 항상 반전
    if (normalDirection === 'opengl') {
      out[i + 1] = 255 - out[i + 1];                    // G(Y) OpenGL만 반전
    }
  }
  return out;
}

/**
 * 단일 맵을 Export.
 * 엔진을 resolution으로 재렌더링하고 해당 맵의 Blob을 반환.
 */
export async function exportSingleMap(
  engine: PatternEngine,
  mapType: PBRMapType,
  resolution: number,
  normalDirection: NormalDirection,
  params: PatternParams,
  pbrSettings: PBRSettings,
): Promise<Blob> {
  const prevSize = engine.getRenderSize();

  // Export 해상도로 렌더링
  engine.setRenderSize(resolution);
  engine.generate(params, pbrSettings);

  // 픽셀 읽기 (동기)
  let pixels = engine.getMapPixels(mapType);

  // 프리뷰 해상도 복원
  engine.setRenderSize(prevSize);
  engine.generate(params, pbrSettings);

  // Y축 반전 → PNG Blob
  const flipped = flipPixelsVertically(pixels, resolution, resolution);

  // Normal Map: Green 채널 방향 보정
  if (mapType === 'normal') {
    return pixelsToBlob(applyNormalDirection(flipped, normalDirection), resolution, resolution);
  }
  return pixelsToBlob(flipped, resolution, resolution);
}

/**
 * selectedMaps의 각 맵을 Export. 진행률 콜백 지원.
 *
 * 렌더링과 픽셀 읽기는 동기로 한번에 수행하고,
 * 비동기 PNG 변환은 맵마다 순차 처리하여 UI 업데이트 기회를 준다.
 */
export async function exportAllMaps(
  engine: PatternEngine,
  settings: ExportSettings,
  params: PatternParams,
  pbrSettings: PBRSettings,
  onProgress?: (current: number, total: number, currentMap: string) => void,
): Promise<Record<string, Blob>> {
  const { resolution, normalDirection, selectedMaps } = settings;
  const prevSize = engine.getRenderSize();

  // ── 동기 구간: Export 해상도 렌더링 + 전체 픽셀 읽기 ──
  engine.setRenderSize(resolution);
  engine.generate(params, pbrSettings);

  const rawPixels: Partial<Record<PBRMapType, Uint8Array>> = {};
  for (const mapType of selectedMaps) {
    rawPixels[mapType] = engine.getMapPixels(mapType);
  }

  // 프리뷰 해상도 복원
  engine.setRenderSize(prevSize);
  engine.generate(params, pbrSettings);

  // ── 비동기 구간: 픽셀 → PNG Blob 변환 ──
  const result: Record<string, Blob> = {};
  const total = selectedMaps.length;

  for (let i = 0; i < total; i++) {
    const mapType = selectedMaps[i];
    onProgress?.(i + 1, total, mapType);

    let pixels = rawPixels[mapType]!;

    const flipped = flipPixelsVertically(pixels, resolution, resolution);

    const finalPixels = mapType === 'normal'
      ? applyNormalDirection(flipped, normalDirection)
      : flipped;
    result[mapType] = await pixelsToBlob(finalPixels, resolution, resolution);
  }

  return result;
}

/** 맵 타입 → 파일 이름 */
export function makeFilename(
  prefix: string,
  mapType: PBRMapType,
  resolution: number,
  normalDirection: NormalDirection,
): string {
  if (mapType === 'normal') {
    return `${prefix}_normal_${normalDirection}_${resolution}.png`;
  }
  return `${prefix}_${mapType}_${resolution}.png`;
}

/**
 * 전체 맵을 ZIP으로 묶어 반환.
 * 파일명 규칙: {filenamePrefix}_{mapType}_{resolution}.png
 * Normal Map 파일명에는 방향 표시.
 */
export async function exportAsZip(
  engine: PatternEngine,
  settings: ExportSettings,
  params: PatternParams,
  pbrSettings: PBRSettings,
  onProgress?: (current: number, total: number, currentMap: string) => void,
): Promise<Blob> {
  const blobs = await exportAllMaps(
    engine, settings, params, pbrSettings, onProgress,
  );

  const zip = new JSZip();
  for (const [mapType, blob] of Object.entries(blobs)) {
    const filename = makeFilename(
      settings.filenamePrefix,
      mapType as PBRMapType,
      settings.resolution,
      settings.normalDirection,
    );
    zip.file(filename, blob);
  }

  return zip.generateAsync({ type: 'blob' });
}
