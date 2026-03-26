/**
 * 최소 PBR 렌더링 파이프라인.
 * 현재는 Height Map만 렌더링. React 의존성 없음.
 */

import { WebGLContext } from './WebGLContext';
import { ShaderProgram } from './ShaderProgram';
import { RenderTarget } from './RenderTarget';
import { FullscreenQuad } from './FullscreenQuad';
import { generateWeaveMatrix } from './WeaveMatrix';
import type { PatternParams, PBRSettings } from '@/types/pattern';

import fullscreenQuadVert from '@/shaders/fullscreen-quad.vert?raw';
import heightFrag from '@/shaders/height.frag?raw';

const RENDER_SIZE = 512;

export class PatternEngine {
  private readonly ctx: WebGLContext;
  private readonly heightShader: ShaderProgram;
  private readonly quad: FullscreenQuad;
  private readonly heightTarget: RenderTarget;
  private matrixTexture: WebGLTexture | null = null;

  constructor() {
    this.ctx = new WebGLContext(RENDER_SIZE, RENDER_SIZE);
    this.heightShader = new ShaderProgram(this.ctx, fullscreenQuadVert, heightFrag);
    this.quad = new FullscreenQuad(this.ctx);
    this.heightTarget = new RenderTarget(this.ctx, RENDER_SIZE, RENDER_SIZE);
  }

  /** 패턴 파라미터로 Height Map을 렌더링한다. */
  generate(params: PatternParams, _pbrSettings: PBRSettings): void {
    const { ctx, heightShader, quad, heightTarget } = this;
    const gl = ctx.gl;

    // (a) 직조 매트릭스 생성
    const weaveResult = generateWeaveMatrix(params);

    // (b) 매트릭스를 R8 데이터 텍스처로 업로드
    // 매트릭스 값은 0 또는 1이므로 255로 스케일
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

    // (c) Height RenderTarget에 바인딩하고 렌더링
    heightTarget.bind();
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);

    heightShader.use();

    // (d) uniform 설정
    heightShader.setUniform('u_weaveMatrix', this.matrixTexture);
    heightShader.setUniform('u_matrixSize', [weaveResult.width, weaveResult.height]);

    // 패턴 타입에 따라 density, yarnThickness 등의 소스가 다름
    const density =  params.density;
    const yarnThickness = params.yarnThickness;
    const flattening = params.flattening;

    heightShader.setUniform('u_density', density);
    heightShader.setUniform('u_yarnThickness', yarnThickness);
    heightShader.setUniform('u_flattening', flattening);

    // twist: 직조 패브릭에만 해당, 카본은 0
    if (params.type === 'plainWeave' || params.type === 'twillWeave' || params.type === 'satinWeave') {
      heightShader.setUniform('u_twistAngle', params.twistAngle * (Math.PI / 180));
      heightShader.setUniform('u_twistIntensity', params.twistIntensity);
    } else {
      heightShader.setUniform('u_twistAngle', 0);
      heightShader.setUniform('u_twistIntensity', 0);
    }

    quad.draw();

    heightShader.unuse();
    heightTarget.unbind();
  }

  /** Height RenderTarget의 픽셀 데이터를 반환한다. */
  getHeightPixels(): Uint8Array {
    return this.heightTarget.readPixels();
  }

  /** Height RenderTarget 텍스처 (향후 다른 셰이더 입력용) */
  getHeightTexture(): WebGLTexture {
    return this.heightTarget.getTexture();
  }

  /** 리소스 정리 */
  dispose(): void {
    const gl = this.ctx.gl;
    if (this.matrixTexture) {
      gl.deleteTexture(this.matrixTexture);
    }
    this.heightTarget.dispose();
    this.quad.dispose();
    this.heightShader.dispose();
    this.ctx.dispose();
  }
}
