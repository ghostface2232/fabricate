import { create } from 'zustand';
import type {
  PatternType,
  PatternParams,
  PBRSettings,
  ExportSettings,
  Preset,
} from '@/types/pattern';

// ─── 기본값 상수 ─────────────────────────────────────────────

const DEFAULT_PBR_SETTINGS: PBRSettings = {
  normalStrength: 1.5,
  normalFilter: 'sobel',
  aoRadius: 3.0,
  aoIntensity: 0.8,
  roughnessBase: 0.7,
  roughnessVariation: 0.15,
  roughnessCavityInfluence: 0.3,
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
        density: 20,
        yarnThickness: 0.7,
        twistAngle: 15,
        twistIntensity: 0.2,
        flattening: 0.3,
        twillDirection: 1,
        satinShift: 2,
        repeatSize: 2,
      };
    case 'twillWeave':
      return {
        type: 'twillWeave',
        warpColor: [0.95, 0.92, 0.87],
        weftColor: [0.75, 0.72, 0.67],
        density: 20,
        yarnThickness: 0.7,
        twistAngle: 30,
        twistIntensity: 0.3,
        flattening: 0.4,
        twillDirection: 1,
        satinShift: 2,
        repeatSize: 4,
      };
    case 'satinWeave':
      return {
        type: 'satinWeave',
        warpColor: [0.95, 0.92, 0.85],
        weftColor: [0.88, 0.85, 0.78],
        density: 30,
        yarnThickness: 0.65,
        twistAngle: 10,
        twistIntensity: 0.15,
        flattening: 0.5,
        twillDirection: 1,
        satinShift: 2,
        repeatSize: 5,
      };
    case 'carbonPlain':
      return {
        type: 'carbonPlain',
        fiberColor: [0.05, 0.05, 0.05],
        resinColor: [0.08, 0.08, 0.08],
        density: 20,
        yarnThickness: 0.8,
        flattening: 0.6,
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
        density: 20,
        yarnThickness: 0.8,
        flattening: 0.6,
        towK: 3,
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
  /** 프리셋에서 params + pbrSettings 로드 */
  loadPreset: (preset: Preset) => void;
  /** 현재 상태를 Preset 객체로 직렬화 */
  exportCurrentAsPreset: (name: string) => Preset;
}

export type PatternStore = PatternState & PatternActions;

// ─── Store 생성 ──────────────────────────────────────────────

export const usePatternStore = create<PatternStore>((set, get) => ({
  // 초기 상태: twillWeave (2/2 능직)
  params: getDefaultParams('twillWeave'),
  pbrSettings: { ...DEFAULT_PBR_SETTINGS },
  exportSettings: { ...DEFAULT_EXPORT_SETTINGS },

  setPatternType: (type) => {
    set({ params: getDefaultParams(type) });
  },

  updateParams: (partial) => {
    set((state) => ({
      params: { ...state.params, ...partial } as PatternParams,
    }));
  },

  updatePBRSettings: (partial) => {
    set((state) => ({
      pbrSettings: { ...state.pbrSettings, ...partial },
    }));
  },

  updateExportSettings: (partial) => {
    set((state) => ({
      exportSettings: { ...state.exportSettings, ...partial },
    }));
  },

  loadPreset: (preset) => {
    set({
      params: { ...preset.params },
      pbrSettings: { ...preset.pbrSettings },
    });
  },

  exportCurrentAsPreset: (name) => {
    const { params, pbrSettings } = get();
    const now = Date.now();
    return {
      id: crypto.randomUUID(),
      name,
      params: { ...params },
      pbrSettings: { ...pbrSettings },
      createdAt: now,
      updatedAt: now,
    };
  },
}));
