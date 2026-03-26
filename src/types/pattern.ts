// ─── Pattern Type ────────────────────────────────────────────

/** 지원하는 패턴 종류 */
export type PatternType =
  | 'plainWeave'
  | 'twillWeave'
  | 'satinWeave'
  | 'carbonPlain'
  | 'carbonTwill';

// ─── Weave Params ────────────────────────────────────────────

/** 직조 패브릭(평직·능직·수자직) 공통 파라미터 */
export interface WeaveParams {
  /** 경사(날실) RGB 색상, 각 채널 0-1 */
  warpColor: [number, number, number];
  /** 위사(씨실) RGB 색상, 각 채널 0-1 */
  weftColor: [number, number, number];
  /** 실 밀도 — 타일 내 원사 수 (1-80) */
  density: number;
  /** 실 두께 — 셀 대비 원사 직경 비율 (0.1-1.0) */
  yarnThickness: number;
  /** 꼬임 각도 (0-90도) */
  twistAngle: number;
  /** 꼬임 강도 (0-1) */
  twistIntensity: number;
  /** 교차점에서 원사가 납작해지는 정도 (0-1) */
  flattening: number;
  /** 능직 방향: 1 = Z능직, -1 = S능직 (능직 전용) */
  twillDirection: 1 | -1;
  /** 수자직 이동수 (수자직 전용, 기본 2) */
  satinShift: number;
  /** 반복 단위 크기 (2-8) */
  repeatSize: number;
}

// ─── Carbon Params ───────────────────────────────────────────

/** 카본 파이버 패턴 파라미터 */
export interface CarbonParams {
  /** 섬유 색상 RGB 0-1 (거의 검정) */
  fiberColor: [number, number, number];
  /** 레진 색상 RGB 0-1 (어두운 회색-검정) */
  resinColor: [number, number, number];
  /** 실 밀도 — 타일 내 원사 수 (1-80) */
  density: number;
  /** 실 두께 — 셀 대비 원사 직경 비율 (0.1-1.0) */
  yarnThickness: number;
  /** 교차점에서 원사가 납작해지는 정도 (0-1) */
  flattening: number;
  /** 토우 크기 K수: 1K, 3K, 6K */
  towK: 1 | 3 | 6;
  /** 레진 광택 (0-1, clearcoat roughness의 역수) */
  glossiness: number;
  /** 토우 간 간격 (0-0.3) */
  gapWidth: number;
  /** 내부 직조 구조 */
  weavePattern: 'plain' | 'twill';
}

// ─── Pattern Params (Discriminated Union) ────────────────────

/** 판별 유니온 — type 필드로 WeaveParams / CarbonParams 구분 */
export type PatternParams =
  | ({ type: 'plainWeave' } & WeaveParams)
  | ({ type: 'twillWeave' } & WeaveParams)
  | ({ type: 'satinWeave' } & WeaveParams)
  | ({ type: 'carbonPlain' } & CarbonParams)
  | ({ type: 'carbonTwill' } & CarbonParams);

// ─── PBR Settings ────────────────────────────────────────────

/** PBR 맵 생성 파라미터 */
export interface PBRSettings {
  /** Normal Map 강도 (0.1-5.0, 기본 1.5) */
  normalStrength: number;
  /** Normal 필터 알고리즘 (기본 'sobel') */
  normalFilter: 'sobel' | 'scharr';
  /** AO 샘플링 반경 (1.0-10.0, 기본 3.0) */
  aoRadius: number;
  /** AO 강도 (0.0-2.0, 기본 0.8, 패브릭은 과하면 더러워 보이므로 보수적) */
  aoIntensity: number;
  /** Roughness 기본값 (0.0-1.0, 기본 0.7) */
  roughnessBase: number;
  /** Roughness 편차 (0.0-0.5, 기본 0.15) */
  roughnessVariation: number;
  /** Roughness에 대한 cavity 영향 (0.0-1.0, 기본 0.3) */
  roughnessCavityInfluence: number;
}

// ─── Normal Direction ────────────────────────────────────────

/** Normal Map Y채널 방향 */
export type NormalDirection = 'opengl' | 'directx';

// ─── Export Settings ─────────────────────────────────────────

/** 텍스처 내보내기 설정 */
export interface ExportSettings {
  /** 출력 해상도 (px) */
  resolution: 512 | 1024 | 2048 | 4096;
  /** 출력 포맷 (1차 목표: PNG만) */
  format: 'png';
  /** Normal Map 방향 */
  normalDirection: NormalDirection;
  /** 내보낼 PBR 맵 종류 */
  selectedMaps: PBRMapType[];
  /** 파일명 접두어 */
  filenamePrefix: string;
}

// ─── PBR Map Type ────────────────────────────────────────────

/** 지원하는 PBR 맵 종류 */
export type PBRMapType = 'height' | 'normal' | 'ao' | 'roughness' | 'diffuse';

// ─── Preset ──────────────────────────────────────────────────

/** 저장 가능한 프리셋 */
export interface Preset {
  id: string;
  name: string;
  params: PatternParams;
  pbrSettings: PBRSettings;
  /** 생성 시각 (epoch ms) */
  createdAt: number;
  /** 수정 시각 (epoch ms) */
  updatedAt: number;
}

// ─── Weave Matrix Result ─────────────────────────────────────

/** 직조 매트릭스 생성 결과 */
export interface WeaveMatrixResult {
  /** 2D 매트릭스를 row-major 1D로 펼친 데이터 (0 또는 1) */
  matrix: Uint8Array;
  /** 매트릭스 가로 크기 */
  width: number;
  /** 매트릭스 세로 크기 */
  height: number;
}
