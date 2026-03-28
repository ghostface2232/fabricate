/**
 * Framebuffer + Texture 조합.
 * 오프스크린 렌더링 대상. 결과 텍스처를 다른 셰이더 입력으로 사용 가능.
 */

import { WebGLContext } from './WebGLContext';

const DEV = import.meta.env.DEV;

function glCheck(gl: WebGL2RenderingContext, label: string): void {
  if (!DEV) return;
  if (gl.isContextLost()) return;
  const err = gl.getError();
  if (err === gl.CONTEXT_LOST_WEBGL) return;
  if (err !== gl.NO_ERROR) {
    throw new Error(`[RenderTarget] GL error after ${label}: 0x${err.toString(16)}`);
  }
}

export class RenderTarget {
  private readonly gl: WebGL2RenderingContext;
  private fbo: WebGLFramebuffer;
  private texture: WebGLTexture;
  private _width: number;
  private _height: number;

  get width(): number {
    return this._width;
  }
  get height(): number {
    return this._height;
  }

  constructor(ctx: WebGLContext, width: number, height: number) {
    this.gl = ctx.gl;
    this._width = width;
    this._height = height;

    const { fbo, texture } = this.createResources(width, height);
    this.fbo = fbo;
    this.texture = texture;
  }

  /** FBO + 텍스처 생성 및 검증 */
  private createResources(
    width: number,
    height: number,
  ): { fbo: WebGLFramebuffer; texture: WebGLTexture } {
    const { gl } = this;

    const texture = gl.createTexture();
    if (!texture) throw new Error('[RenderTarget] gl.createTexture 실패');

    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA8,
      width,
      height,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      null,
    );
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.bindTexture(gl.TEXTURE_2D, null);

    const fbo = gl.createFramebuffer();
    if (!fbo) throw new Error('[RenderTarget] gl.createFramebuffer 실패');

    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      texture,
      0,
    );

    const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    if (status !== gl.FRAMEBUFFER_COMPLETE) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.deleteFramebuffer(fbo);
      gl.deleteTexture(texture);
      throw new Error(
        `[RenderTarget] Framebuffer 불완전: 0x${status.toString(16)}`,
      );
    }

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    glCheck(gl, 'createResources');
    return { fbo, texture };
  }

  /** 이 FBO를 렌더링 대상으로 전환 */
  bind(): void {
    const { gl } = this;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
    gl.viewport(0, 0, this._width, this._height);
  }

  /** 기본 프레임버퍼로 복귀 */
  unbind(): void {
    const { gl } = this;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  /** 픽셀 데이터 읽기 (RGBA, Uint8Array) */
  readPixels(): Uint8Array {
    const { gl } = this;
    const data = new Uint8Array(this._width * this._height * 4);
    if (gl.isContextLost()) {
      return data;
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
    gl.readPixels(0, 0, this._width, this._height, gl.RGBA, gl.UNSIGNED_BYTE, data);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    if (gl.isContextLost()) {
      return data;
    }
    glCheck(gl, 'readPixels');
    return data;
  }

  /** 텍스처 반환 (다른 셰이더의 입력용) */
  getTexture(): WebGLTexture {
    return this.texture;
  }

  /** 해상도 변경 — 텍스처와 FBO를 재생성 */
  resize(width: number, height: number): void {
    if (width === this._width && height === this._height) return;
    this.deleteResources();
    this._width = width;
    this._height = height;
    const { fbo, texture } = this.createResources(width, height);
    this.fbo = fbo;
    this.texture = texture;
  }

  /** 내부 리소스 삭제 */
  private deleteResources(): void {
    const { gl } = this;
    if (gl.isContextLost()) return;
    gl.deleteFramebuffer(this.fbo);
    gl.deleteTexture(this.texture);
  }

  /** 리소스 해제 */
  dispose(): void {
    this.deleteResources();
  }
}
