import { create } from 'zustand';
import type {
  PatternType,
  PatternParams,
  PBRSettings,
  ExportSettings,
} from '@/types/pattern';

// ─── 기본값 상수 ─────────────────────────────────────────────

const DEFAULT_PBR_SETTINGS: PBRSettings = {
  normalStrength: 1.5,
  aoRadius: 2.8,
  aoIntensity: 0.58,
  roughnessBase: 0.72,
  roughnessVariation: 0.18,
  roughnessCavityInfluence: 0.24,
};

const DEFAULT_EXPORT_SETTINGS: ExportSettings = {
  resolution: 1024,
  format: 'png',
  normalDirection: 'opengl',
  selectedMaps: ['height', 'normal', 'ao', 'roughness', 'diffuse'],
  filenamePrefix: 'fabric',
};

/** 패턴 타입별 기본 파라미터 */
function getDefaultParams(type: PatternType): PatternParams {
  switch (type) {
    case 'plainWeave':
      return {
        type: 'plainWeave',
        warpColor: [0.95, 0.93, 0.9],
        weftColor: [0.92, 0.88, 0.82],
        density: 24,
        yarnThickness: 0.7,
        twistAngle: 0,
        flattening: 0.3,
        edgeDefinition: 0.52,
        yarnLoft: 0.56,
        twillDirection: 1,
        satinShift: 2,
        repeatSize: 2,
      };
    case 'basketWeave':
      return {
        type: 'basketWeave',
        warpColor: [0.9, 0.88, 0.84],
        weftColor: [0.82, 0.79, 0.74],
        density: 20,
        yarnThickness: 0.84,
        twistAngle: 3,
        flattening: 0.42,
        edgeDefinition: 0.44,
        yarnLoft: 0.64,
        twillDirection: 1,
        satinShift: 2,
        repeatSize: 4,
      };
    case 'oxfordWeave':
      return {
        type: 'oxfordWeave',
        warpColor: [0.62, 0.72, 0.88],
        weftColor: [0.93, 0.95, 0.98],
        density: 28,
        yarnThickness: 0.74,
        twistAngle: 4,
        flattening: 0.34,
        edgeDefinition: 0.5,
        yarnLoft: 0.58,
        twillDirection: 1,
        satinShift: 2,
        repeatSize: 4,
      };
    case 'twillWeave21':
      return {
        type: 'twillWeave21',
        warpColor: [0.8, 0.78, 0.74],
        weftColor: [0.62, 0.59, 0.54],
        density: 28,
        yarnThickness: 0.72,
        twistAngle: 8,
        flattening: 0.38,
        edgeDefinition: 0.62,
        yarnLoft: 0.66,
        twillDirection: 1,
        satinShift: 2,
        repeatSize: 3,
      };
    case 'twillWeave':
      return {
        type: 'twillWeave',
        warpColor: [0.95, 0.92, 0.87],
        weftColor: [0.75, 0.72, 0.67],
        density: 24,
        yarnThickness: 0.7,
        twistAngle: 9,
        flattening: 0.4,
        edgeDefinition: 0.64,
        yarnLoft: 0.68,
        twillDirection: 1,
        satinShift: 2,
        repeatSize: 4,
      };
    case 'twillWeave31':
      return {
        type: 'twillWeave31',
        warpColor: [0.07, 0.1, 0.24],
        weftColor: [0.92, 0.9, 0.86],
        density: 32,
        yarnThickness: 0.76,
        twistAngle: 12,
        flattening: 0.46,
        edgeDefinition: 0.7,
        yarnLoft: 0.72,
        twillDirection: 1,
        satinShift: 2,
        repeatSize: 4,
      };
    case 'brokenTwillWeave22':
      return {
        type: 'brokenTwillWeave22',
        warpColor: [0.42, 0.45, 0.49],
        weftColor: [0.26, 0.28, 0.31],
        density: 28,
        yarnThickness: 0.72,
        twistAngle: 8,
        flattening: 0.4,
        edgeDefinition: 0.62,
        yarnLoft: 0.68,
        twillDirection: 1,
        satinShift: 2,
        repeatSize: 4,
      };
    case 'brokenTwillWeave31':
      return {
        type: 'brokenTwillWeave31',
        warpColor: [0.09, 0.11, 0.22],
        weftColor: [0.88, 0.86, 0.82],
        density: 32,
        yarnThickness: 0.74,
        twistAngle: 12,
        flattening: 0.45,
        edgeDefinition: 0.68,
        yarnLoft: 0.72,
        twillDirection: 1,
        satinShift: 2,
        repeatSize: 4,
      };
    case 'herringboneWeave':
      return {
        type: 'herringboneWeave',
        warpColor: [0.76, 0.74, 0.7],
        weftColor: [0.42, 0.42, 0.4],
        density: 26,
        yarnThickness: 0.72,
        twistAngle: 7,
        flattening: 0.38,
        edgeDefinition: 0.66,
        yarnLoft: 0.69,
        twillDirection: 1,
        satinShift: 2,
        repeatSize: 8,
      };
    case 'chevronWeave':
      return {
        type: 'chevronWeave',
        warpColor: [0.78, 0.74, 0.66],
        weftColor: [0.56, 0.51, 0.45],
        density: 26,
        yarnThickness: 0.72,
        twistAngle: 7,
        flattening: 0.38,
        edgeDefinition: 0.66,
        yarnLoft: 0.69,
        twillDirection: 1,
        satinShift: 2,
        repeatSize: 6,
      };
    case 'satinWeave':
      return {
        type: 'satinWeave',
        warpColor: [0.95, 0.92, 0.85],
        weftColor: [0.88, 0.85, 0.78],
        density: 34,
        yarnThickness: 0.65,
        twistAngle: 0,
        flattening: 0.5,
        edgeDefinition: 0.44,
        yarnLoft: 0.62,
        twillDirection: 1,
        satinShift: 2,
        repeatSize: 5,
      };
    case 'satinWeave8':
      return {
        type: 'satinWeave8',
        warpColor: [0.92, 0.86, 0.72],
        weftColor: [0.77, 0.69, 0.55],
        density: 38,
        yarnThickness: 0.58,
        twistAngle: 0,
        flattening: 0.48,
        edgeDefinition: 0.36,
        yarnLoft: 0.56,
        twillDirection: 1,
        satinShift: 3,
        repeatSize: 8,
      };
    case 'sateenWeave':
      return {
        type: 'sateenWeave',
        warpColor: [0.94, 0.93, 0.88],
        weftColor: [0.83, 0.8, 0.7],
        density: 36,
        yarnThickness: 0.62,
        twistAngle: 0,
        flattening: 0.5,
        edgeDefinition: 0.4,
        yarnLoft: 0.58,
        twillDirection: 1,
        satinShift: 2,
        repeatSize: 5,
      };
    case 'carbonPlain':
      return {
        type: 'carbonPlain',
        fiberColor: [0.05, 0.05, 0.05],
        resinColor: [0.08, 0.08, 0.08],
        density: 24,
        yarnThickness: 0.8,
        flattening: 0.6,
        edgeDefinition: 0.78,
        yarnLoft: 0.72,
        towK: 1,
        glossiness: 0.85,
        gapWidth: 0.05,
        weavePattern: 'plain',
      };
    case 'carbonTwill':
      return {
        type: 'carbonTwill',
        fiberColor: [0.05, 0.05, 0.05],
        resinColor: [0.08, 0.08, 0.08],
        density: 24,
        yarnThickness: 0.8,
        flattening: 0.6,
        edgeDefinition: 0.82,
        yarnLoft: 0.76,
        towK: 1,
        glossiness: 0.85,
        gapWidth: 0.05,
        weavePattern: 'twill',
      };
  }
}

// ─── Store 타입 ──────────────────────────────────────────────

interface PatternState {
  params: PatternParams;
  pbrSettings: PBRSettings;
  exportSettings: ExportSettings;
  previewResolution: number;
}

interface PatternActions {
  /** 패턴 타입 변경 — 해당 타입의 기본 파라미터로 초기화 */
  setPatternType: (type: PatternType) => void;
  /** 패턴 파라미터 부분 업데이트 */
  updateParams: (partial: Partial<PatternParams>) => void;
  /** PBR 설정 부분 업데이트 */
  updatePBRSettings: (partial: Partial<PBRSettings>) => void;
  /** Export 설정 부분 업데이트 */
  updateExportSettings: (partial: Partial<ExportSettings>) => void;
  /** 프리뷰 렌더 해상도 변경 */
  setPreviewResolution: (resolution: number) => void;
}

export type PatternStore = PatternState & PatternActions;

/** partial의 값이 현재 상태와 다른지 확인 (배열은 요소 비교) */
function hasChanges(
  current: Record<string, unknown>,
  partial: Record<string, unknown>,
): boolean {
  for (const key of Object.keys(partial)) {
    const n = partial[key];
    const c = current[key];
    if (Array.isArray(n) && Array.isArray(c)) {
      if (n.length !== c.length || n.some((v: number, i: number) => v !== c[i]))
        return true;
    } else if (n !== c) {
      return true;
    }
  }
  return false;
}

// ─── Store 생성 ──────────────────────────────────────────────

export const usePatternStore = create<PatternStore>((set, get) => ({
  // 초기 상태: 3/1 능직(데님/드릴 계열)
  params: getDefaultParams('twillWeave31'),
  pbrSettings: { ...DEFAULT_PBR_SETTINGS },
  exportSettings: { ...DEFAULT_EXPORT_SETTINGS },
  previewResolution: 512,

  setPatternType: (type) => {
    set({ params: getDefaultParams(type) });
  },

  updateParams: (partial) => {
    const current = get().params;
    if (!hasChanges(current as unknown as Record<string, unknown>, partial as Record<string, unknown>))
      return;
    set({ params: { ...current, ...partial } as PatternParams });
  },

  updatePBRSettings: (partial) => {
    const current = get().pbrSettings;
    if (!hasChanges(current as unknown as Record<string, unknown>, partial as Record<string, unknown>))
      return;
    set({ pbrSettings: { ...current, ...partial } });
  },

  updateExportSettings: (partial) => {
    set((state) => ({
      exportSettings: { ...state.exportSettings, ...partial },
    }));
  },

  setPreviewResolution: (resolution) => {
    if (get().previewResolution === resolution) return;
    set({ previewResolution: resolution });
  },
}));
