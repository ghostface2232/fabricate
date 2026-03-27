/**
 * Full PBR 렌더링 파이프라인.
 * Height → Normal → AO → Roughness → Diffuse 5-pass 체인.
 * React 의존성 없음.
 */

import { WebGLContext } from './WebGLContext';
import { ShaderProgram } from './ShaderProgram';
import { RenderTarget } from './RenderTarget';
import { FullscreenQuad } from './FullscreenQuad';
import { generateWeaveMatrix } from './WeaveMatrix';
import type { PatternParams, PBRSettings, PBRMapType } from '@/types/pattern';

import fullscreenQuadVert from '@/shaders/fullscreen-quad.vert?raw';
import heightFrag from '@/shaders/height.frag?raw';
import normalFrag from '@/shaders/normal.frag?raw';
import aoFrag from '@/shaders/ao.frag?raw';
import roughnessFrag from '@/shaders/roughness.frag?raw';
import diffuseFrag from '@/shaders/diffuse.frag?raw';

const RENDER_SIZE = 512;

/** 패턴 타입 → 정수 인코딩 (셰이더 u_patternType) */
function patternTypeToInt(type: PatternParams['type']): number {
  switch (type) {
    case 'plainWeave':  return 0;
    case 'twillWeave':  return 1;
    case 'satinWeave':  return 2;
    case 'carbonPlain': return 3;
    case 'carbonTwill': return 4;
  }
}

export class PatternEngine {
  private readonly ctx: WebGLContext;
  private readonly quad: FullscreenQuad;

  // 셰이더 (맵별)
  private readonly heightShader: ShaderProgram;
  private readonly normalShader: ShaderProgram;
  private readonly aoShader: ShaderProgram;
  private readonly roughnessShader: ShaderProgram;
  private readonly diffuseShader: ShaderProgram;

  // 렌더 타겟 (맵별 — 각각 독립 FBO)
  private readonly heightTarget: RenderTarget;
  private readonly normalTarget: RenderTarget;
  private readonly aoTarget: RenderTarget;
  private readonly roughnessTarget: RenderTarget;
  private readonly diffuseTarget: RenderTarget;

  private matrixTexture: WebGLTexture | null = null;
  private currentSize = RENDER_SIZE;

  // 증분 렌더링용 이전 상태
  private prevParams: PatternParams | null = null;
  private prevPbrSettings: PBRSettings | null = null;
  private lastMatrixWidth = 0;
  private lastMatrixHeight = 0;

  constructor() {
    this.ctx = new WebGLContext(RENDER_SIZE, RENDER_SIZE);
    this.quad = new FullscreenQuad(this.ctx);

    // 셰이더 프로그램 생성
    this.heightShader = new ShaderProgram(this.ctx, fullscreenQuadVert, heightFrag);
    this.normalShader = new ShaderProgram(this.ctx, fullscreenQuadVert, normalFrag);
    this.aoShader = new ShaderProgram(this.ctx, fullscreenQuadVert, aoFrag);
    this.roughnessShader = new ShaderProgram(this.ctx, fullscreenQuadVert, roughnessFrag);
    this.diffuseShader = new ShaderProgram(this.ctx, fullscreenQuadVert, diffuseFrag);

    // 렌더 타겟 생성
    this.heightTarget = new RenderTarget(this.ctx, RENDER_SIZE, RENDER_SIZE);
    this.normalTarget = new RenderTarget(this.ctx, RENDER_SIZE, RENDER_SIZE);
    this.aoTarget = new RenderTarget(this.ctx, RENDER_SIZE, RENDER_SIZE);
    this.roughnessTarget = new RenderTarget(this.ctx, RENDER_SIZE, RENDER_SIZE);
    this.diffuseTarget = new RenderTarget(this.ctx, RENDER_SIZE, RENDER_SIZE);
  }

  /** 마지막 generate()가 컬러 전용(Diffuse-only)이었는지 */
  lastColorOnly = false;

  /** 변경 사항에 따라 필요한 패스만 재렌더링 */
  generate(params: PatternParams, pbrSettings: PBRSettings): void {
    const colorOnly = this.prevParams !== null
      && this.matrixTexture !== null
      && PatternEngine.isColorOnlyChange(this.prevParams, params)
      && PatternEngine.pbrSettingsEqual(this.prevPbrSettings!, pbrSettings);

    if (colorOnly) {
      this.renderDiffusePass(params);
    } else {
      this.renderFullPipeline(params, pbrSettings);
    }

    this.lastColorOnly = colorOnly;
    this.prevParams = params;
    this.prevPbrSettings = pbrSettings;
  }

  /** 전체 5-pass 파이프라인 */
  private renderFullPipeline(params: PatternParams, pbrSettings: PBRSettings): void {
    const { ctx, quad } = this;
    const gl = ctx.gl;

    // ── 매트릭스 생성 및 업로드 ──
    const weaveResult = generateWeaveMatrix(params);

    const scaledMatrix = new Uint8Array(weaveResult.matrix.length);
    for (let i = 0; i < weaveResult.matrix.length; i++) {
      scaledMatrix[i] = weaveResult.matrix[i] * 255;
    }

    if (this.matrixTexture) {
      gl.deleteTexture(this.matrixTexture);
    }
    this.matrixTexture = ctx.createDataTexture(
      scaledMatrix,
      weaveResult.width,
      weaveResult.height,
      'R8',
    );
    this.lastMatrixWidth = weaveResult.width;
    this.lastMatrixHeight = weaveResult.height;

    const density = params.density;
    const yarnThickness = params.yarnThickness;
    const flattening = params.flattening;
    const typeInt = patternTypeToInt(params.type);
    const texelSize: [number, number] = [1.0 / this.currentSize, 1.0 / this.currentSize];

    // ── Pass 1: Height ──
    this.heightTarget.bind();
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);

    this.heightShader.use();
    this.heightShader.setUniform('u_weaveMatrix', this.matrixTexture);
    this.heightShader.setUniform('u_matrixSize', [weaveResult.width, weaveResult.height]);
    this.heightShader.setUniform('u_density', density);
    this.heightShader.setUniform('u_yarnThickness', yarnThickness);
    this.heightShader.setUniform('u_flattening', flattening);

    if (params.type === 'plainWeave' || params.type === 'twillWeave' || params.type === 'satinWeave') {
      this.heightShader.setUniform('u_twistAngle', params.twistAngle * (Math.PI / 180));
    } else {
      this.heightShader.setUniform('u_twistAngle', 0);
    }

    quad.draw();
    this.heightShader.unuse();
    this.heightTarget.unbind();

    // Height 텍스처를 이후 패스에서 사용
    const heightTex = this.heightTarget.getTexture();

    // ── Pass 2: Normal ──
    this.normalTarget.bind();
    gl.clearColor(0.5, 0.5, 1.0, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    this.normalShader.use();
    this.normalShader.setUniform('u_heightMap', heightTex);
    this.normalShader.setUniform('u_texelSize', texelSize);
    this.normalShader.setUniform('u_strength', pbrSettings.normalStrength);
    this.normalShader.setUniformInt('u_filter', pbrSettings.normalFilter === 'scharr' ? 1 : 0);

    quad.draw();
    this.normalShader.unuse();
    this.normalTarget.unbind();

    // ── Pass 3: AO ──
    this.aoTarget.bind();
    gl.clearColor(1, 1, 1, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);

    this.aoShader.use();
    this.aoShader.setUniform('u_heightMap', heightTex);
    this.aoShader.setUniform('u_texelSize', texelSize);
    this.aoShader.setUniform('u_radius', pbrSettings.aoRadius);
    this.aoShader.setUniform('u_intensity', pbrSettings.aoIntensity);

    quad.draw();
    this.aoShader.unuse();
    this.aoTarget.unbind();

    // ── Pass 4: Roughness ──
    this.roughnessTarget.bind();
    gl.clearColor(0.5, 0.5, 0.5, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);

    this.roughnessShader.use();
    this.roughnessShader.setUniform('u_heightMap', heightTex);
    this.roughnessShader.setUniform('u_weaveMatrix', this.matrixTexture);
    this.roughnessShader.setUniform('u_texelSize', texelSize);
    this.roughnessShader.setUniform('u_matrixSize', [weaveResult.width, weaveResult.height]);
    this.roughnessShader.setUniform('u_density', density);
    this.roughnessShader.setUniform('u_yarnThickness', yarnThickness);
    this.roughnessShader.setUniform('u_roughnessBase', pbrSettings.roughnessBase);
    this.roughnessShader.setUniform('u_roughnessVariation', pbrSettings.roughnessVariation);
    this.roughnessShader.setUniform('u_cavityInfluence', pbrSettings.roughnessCavityInfluence);
    this.roughnessShader.setUniformInt('u_patternType', typeInt);

    if (params.type === 'plainWeave' || params.type === 'twillWeave' || params.type === 'satinWeave') {
      this.roughnessShader.setUniform('u_twistAngle', params.twistAngle * (Math.PI / 180));
    } else {
      this.roughnessShader.setUniform('u_twistAngle', 0);
    }

    quad.draw();
    this.roughnessShader.unuse();
    this.roughnessTarget.unbind();

    // ── Pass 5: Diffuse ──
    this.diffuseTarget.bind();
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);

    this.diffuseShader.use();
    this.diffuseShader.setUniform('u_weaveMatrix', this.matrixTexture);
    this.diffuseShader.setUniform('u_matrixSize', [weaveResult.width, weaveResult.height]);
    this.diffuseShader.setUniform('u_density', density);
    this.diffuseShader.setUniform('u_heightMap', heightTex);
    this.diffuseShader.setUniform('u_yarnThickness', yarnThickness);
    this.diffuseShader.setUniformInt('u_patternType', typeInt);

    if (params.type === 'plainWeave' || params.type === 'twillWeave' || params.type === 'satinWeave') {
      this.diffuseShader.setUniform('u_twistAngle', params.twistAngle * (Math.PI / 180));
    } else {
      this.diffuseShader.setUniform('u_twistAngle', 0);
    }

    // 컬러 설정: fabric → warpColor/weftColor, carbon → fiberColor/resinColor
    if (params.type === 'plainWeave' || params.type === 'twillWeave' || params.type === 'satinWeave') {
      this.diffuseShader.setUniform('u_color1', params.warpColor);
      this.diffuseShader.setUniform('u_color2', params.weftColor);
    } else {
      this.diffuseShader.setUniform('u_color1', params.fiberColor);
      this.diffuseShader.setUniform('u_color2', params.resinColor);
    }

    quad.draw();
    this.diffuseShader.unuse();
    this.diffuseTarget.unbind();
  }

  /** Diffuse 패스만 재렌더링 (색상 변경 시) */
  private renderDiffusePass(params: PatternParams): void {
    const { quad } = this;
    const gl = this.ctx.gl;
    const heightTex = this.heightTarget.getTexture();

    this.diffuseTarget.bind();
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);

    this.diffuseShader.use();
    this.diffuseShader.setUniform('u_weaveMatrix', this.matrixTexture!);
    this.diffuseShader.setUniform('u_matrixSize', [this.lastMatrixWidth, this.lastMatrixHeight]);
    this.diffuseShader.setUniform('u_density', params.density);
    this.diffuseShader.setUniform('u_heightMap', heightTex);
    this.diffuseShader.setUniform('u_yarnThickness', params.yarnThickness);
    this.diffuseShader.setUniformInt('u_patternType', patternTypeToInt(params.type));

    if (params.type === 'plainWeave' || params.type === 'twillWeave' || params.type === 'satinWeave') {
      this.diffuseShader.setUniform('u_twistAngle', params.twistAngle * (Math.PI / 180));
    } else {
      this.diffuseShader.setUniform('u_twistAngle', 0);
    }

    if (params.type === 'plainWeave' || params.type === 'twillWeave' || params.type === 'satinWeave') {
      this.diffuseShader.setUniform('u_color1', params.warpColor);
      this.diffuseShader.setUniform('u_color2', params.weftColor);
    } else {
      this.diffuseShader.setUniform('u_color1', params.fiberColor);
      this.diffuseShader.setUniform('u_color2', params.resinColor);
    }

    quad.draw();
    this.diffuseShader.unuse();
    this.diffuseTarget.unbind();
  }

  /** 색상만 바뀌었는지 판별 (구조적 파라미터 동일 여부) */
  private static isColorOnlyChange(prev: PatternParams, next: PatternParams): boolean {
    if (prev.type !== next.type) return false;
    if (prev.density !== next.density) return false;
    if (prev.yarnThickness !== next.yarnThickness) return false;
    if (prev.flattening !== next.flattening) return false;

    if ('twistAngle' in prev && 'twistAngle' in next) {
      if (prev.twistAngle !== next.twistAngle) return false;
      if (prev.twillDirection !== next.twillDirection) return false;
      if (prev.satinShift !== next.satinShift) return false;
      if (prev.repeatSize !== next.repeatSize) return false;
    } else if ('towK' in prev && 'towK' in next) {
      if (prev.towK !== next.towK) return false;
      if (prev.glossiness !== next.glossiness) return false;
      if (prev.gapWidth !== next.gapWidth) return false;
      if (prev.weavePattern !== next.weavePattern) return false;
    }

    return true;
  }

  /** PBR 설정 동일 여부 */
  private static pbrSettingsEqual(a: PBRSettings, b: PBRSettings): boolean {
    return a.normalStrength === b.normalStrength
      && a.normalFilter === b.normalFilter
      && a.aoRadius === b.aoRadius
      && a.aoIntensity === b.aoIntensity
      && a.roughnessBase === b.roughnessBase
      && a.roughnessVariation === b.roughnessVariation
      && a.roughnessCavityInfluence === b.roughnessCavityInfluence;
  }

  /** 지정 맵의 렌더 타겟 반환 */
  private getTarget(mapType: PBRMapType): RenderTarget {
    switch (mapType) {
      case 'height':    return this.heightTarget;
      case 'normal':    return this.normalTarget;
      case 'ao':        return this.aoTarget;
      case 'roughness': return this.roughnessTarget;
      case 'diffuse':   return this.diffuseTarget;
    }
  }

  /** 지정 맵의 픽셀 데이터를 반환한다. */
  getMapPixels(mapType: PBRMapType): Uint8Array {
    return this.getTarget(mapType).readPixels();
  }

  /** Height RenderTarget의 픽셀 데이터를 반환한다. */
  getHeightPixels(): Uint8Array {
    return this.heightTarget.readPixels();
  }

  /** Height RenderTarget 텍스처 (다른 셰이더 입력용) */
  getHeightTexture(): WebGLTexture {
    return this.heightTarget.getTexture();
  }

  /** 5개 맵의 픽셀 데이터를 모두 반환한다. */
  getAllMapPixels(): Record<PBRMapType, Uint8Array> {
    return {
      height: this.heightTarget.readPixels(),
      normal: this.normalTarget.readPixels(),
      ao: this.aoTarget.readPixels(),
      roughness: this.roughnessTarget.readPixels(),
      diffuse: this.diffuseTarget.readPixels(),
    };
  }

  /** Export용: 지정 해상도로 모든 맵을 재렌더링한 뒤 복원 */
  renderAtResolution(resolution: number, params: PatternParams, pbrSettings: PBRSettings): void {
    // 해상도 변경
    this.ctx.resize(resolution, resolution);
    this.heightTarget.resize(resolution, resolution);
    this.normalTarget.resize(resolution, resolution);
    this.aoTarget.resize(resolution, resolution);
    this.roughnessTarget.resize(resolution, resolution);
    this.diffuseTarget.resize(resolution, resolution);
    this.currentSize = resolution;

    // 전체 파이프라인 재렌더링 (해상도 변경이므로 전체 강제)
    this.prevParams = null;
    this.generate(params, pbrSettings);

    // 기본 해상도 복원 후 프리뷰용 재렌더링
    this.ctx.resize(RENDER_SIZE, RENDER_SIZE);
    this.heightTarget.resize(RENDER_SIZE, RENDER_SIZE);
    this.normalTarget.resize(RENDER_SIZE, RENDER_SIZE);
    this.aoTarget.resize(RENDER_SIZE, RENDER_SIZE);
    this.roughnessTarget.resize(RENDER_SIZE, RENDER_SIZE);
    this.diffuseTarget.resize(RENDER_SIZE, RENDER_SIZE);
    this.currentSize = RENDER_SIZE;

    this.prevParams = null;
    this.generate(params, pbrSettings);
  }

  /** 리소스 정리 */
  dispose(): void {
    const gl = this.ctx.gl;
    if (this.matrixTexture) {
      gl.deleteTexture(this.matrixTexture);
    }

    this.heightTarget.dispose();
    this.normalTarget.dispose();
    this.aoTarget.dispose();
    this.roughnessTarget.dispose();
    this.diffuseTarget.dispose();

    this.quad.dispose();

    this.heightShader.dispose();
    this.normalShader.dispose();
    this.aoShader.dispose();
    this.roughnessShader.dispose();
    this.diffuseShader.dispose();

    this.ctx.dispose();
  }
}
