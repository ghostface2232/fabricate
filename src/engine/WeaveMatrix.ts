/**
 * 직조 패턴의 경위사 교차 규칙을 이진 매트릭스로 생성.
 * 셀 값 1 = 경사(warp)가 위, 0 = 위사(weft)가 위.
 * React 의존성 없음.
 */

import type { PatternParams, WeaveMatrixResult } from '@/types/pattern';

// ─── 내부 유틸 ───────────────────────────────────────────────

function gcd(a: number, b: number): number {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) {
    [a, b] = [b, a % b];
  }
  return a;
}

/** n과 서로소인 값 중 target에 가장 가까운 값을 찾는다 (1 < result < n). */
function nearestCoprime(n: number, target: number): number {
  if (gcd(n, target) === 1 && target > 1 && target < n) return target;
  // target 기준으로 ±1씩 탐색
  for (let d = 1; d < n; d++) {
    const above = target + d;
    if (above > 1 && above < n && gcd(n, above) === 1) return above;
    const below = target - d;
    if (below > 1 && below < n && gcd(n, below) === 1) return below;
  }
  return 2; // fallback (n=5일 때 2는 항상 서로소)
}

// ─── 패턴별 생성 ─────────────────────────────────────────────

/** 평직: 체커보드 2×2 */
function generatePlainWeave(): WeaveMatrixResult {
  const size = 2;
  const matrix = new Uint8Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      matrix[y * size + x] = (x + y) % 2;
    }
  }
  return { matrix, width: size, height: size };
}

/**
 * 능직: repeatSize × repeatSize, 2/2 구조.
 * 각 행에서 연속 2칸이 1, 나머지 0.
 * twillDirection 1이면 Z능직(오른쪽 시프트), -1이면 S능직(왼쪽 시프트).
 */
function generateTwillWeave(
  repeatSize: number,
  twillDirection: 1 | -1,
): WeaveMatrixResult {
  const size = repeatSize;
  const half = Math.floor(size / 2);
  const matrix = new Uint8Array(size * size);

  for (let y = 0; y < size; y++) {
    // twillDirection=1: 행마다 시작 위치가 +1(오른쪽), -1: -1(왼쪽)
    const offset = ((y * twillDirection) % size + size) % size;
    for (let i = 0; i < half; i++) {
      const x = (offset + i) % size;
      matrix[y * size + x] = 1;
    }
  }
  return { matrix, width: size, height: size };
}

/**
 * 수자직: repeatSize × repeatSize (최소 5).
 * 각 행에 1인 셀 정확히 하나, satinShift만큼 이동.
 * shift는 repeatSize와 서로소여야 한다.
 */
function generateSatinWeave(
  repeatSize: number,
  satinShift: number,
): WeaveMatrixResult {
  const size = Math.max(repeatSize, 5);
  const shift = nearestCoprime(size, satinShift);
  const matrix = new Uint8Array(size * size);

  for (let y = 0; y < size; y++) {
    const x = (y * shift) % size;
    matrix[y * size + x] = 1;
  }
  return { matrix, width: size, height: size };
}

/**
 * 카본 평직: 평직 교차 구조 + towK 스케일.
 * towK=3이면 반복 단위 6×6 (3+3).
 * 각 토우 내부 셀은 모두 같은 값.
 */
function generateCarbonPlain(towK: number): WeaveMatrixResult {
  const towSize = towK;
  const size = towSize * 2; // 평직은 2×2 반복을 토우 스케일
  const matrix = new Uint8Array(size * size);

  for (let y = 0; y < size; y++) {
    const towY = Math.floor(y / towSize);
    for (let x = 0; x < size; x++) {
      const towX = Math.floor(x / towSize);
      matrix[y * size + x] = (towX + towY) % 2;
    }
  }
  return { matrix, width: size, height: size };
}

/**
 * 카본 능직: 2/2 능직 구조 + towK 스케일.
 * towK=3이면 반복 단위 12×12 (3×4).
 * 토우 단위로 대각선 시프트.
 */
function generateCarbonTwill(towK: number): WeaveMatrixResult {
  const towSize = towK;
  const repeatCount = 4; // 2/2 능직 → 4×4 기본 반복
  const size = towSize * repeatCount;
  const half = Math.floor(repeatCount / 2); // 연속 1인 토우 수 = 2
  const matrix = new Uint8Array(size * size);

  for (let y = 0; y < size; y++) {
    const towY = Math.floor(y / towSize);
    // 토우 행에 따라 시작 토우 위치 시프트
    const offset = ((towY) % repeatCount + repeatCount) % repeatCount;
    for (let i = 0; i < half; i++) {
      const activeTowX = (offset + i) % repeatCount;
      // 해당 토우 범위의 모든 셀을 1로
      for (let dx = 0; dx < towSize; dx++) {
        const x = activeTowX * towSize + dx;
        matrix[y * size + x] = 1;
      }
    }
  }
  return { matrix, width: size, height: size };
}

// ─── 공개 API ────────────────────────────────────────────────

/** PatternParams에 따라 직조 매트릭스를 생성한다. */
export function generateWeaveMatrix(params: PatternParams): WeaveMatrixResult {
  switch (params.type) {
    case 'plainWeave':
      return generatePlainWeave();
    case 'twillWeave':
      return generateTwillWeave(params.repeatSize, params.twillDirection);
    case 'satinWeave':
      return generateSatinWeave(params.repeatSize, params.satinShift);
    case 'carbonPlain':
      return generateCarbonPlain(params.towK);
    case 'carbonTwill':
      return generateCarbonTwill(params.towK);
  }
}

/** 매트릭스를 시각적 문자열로 출력. 1='#', 0='.' */
export function debugPrintMatrix(result: WeaveMatrixResult): string {
  const { matrix, width, height } = result;
  const lines: string[] = [];
  for (let y = 0; y < height; y++) {
    let row = '';
    for (let x = 0; x < width; x++) {
      row += matrix[y * width + x] ? '#' : '.';
    }
    lines.push(row);
  }
  return lines.join('\n');
}
