/**
 * GLSL 셰이더 프로그램 래퍼.
 * uniform 위치 캐싱, 타입별 자동 바인딩, 텍스처 유닛 관리.
 */

import { WebGLContext } from './WebGLContext';

const DEV = import.meta.env.DEV;

function glCheck(gl: WebGL2RenderingContext, label: string): void {
  if (!DEV) return;
  const err = gl.getError();
  if (err !== gl.NO_ERROR) {
    throw new Error(`[ShaderProgram] GL error after ${label}: 0x${err.toString(16)}`);
  }
}

export class ShaderProgram {
  private readonly gl: WebGL2RenderingContext;
  private readonly program: WebGLProgram;
  private readonly uniformCache = new Map<string, WebGLUniformLocation>();
  private textureUnit = 0;

  constructor(ctx: WebGLContext, vertexSource: string, fragmentSource: string) {
    this.gl = ctx.gl;
    const vs = ctx.compileShader(this.gl.VERTEX_SHADER, vertexSource);
    const fs = ctx.compileShader(this.gl.FRAGMENT_SHADER, fragmentSource);
    this.program = ctx.linkProgram(vs, fs);
    // 컴파일된 개별 셰이더는 링크 후 삭제 가능
    this.gl.deleteShader(vs);
    this.gl.deleteShader(fs);
  }

  /** 프로그램 활성화 및 텍스처 유닛 카운터 리셋 */
  use(): void {
    this.gl.useProgram(this.program);
    this.textureUnit = 0;
  }

  /** 프로그램 비활성화 */
  unuse(): void {
    this.gl.useProgram(null);
  }

  /** uniform 위치 조회 (캐싱) */
  private getLocation(name: string): WebGLUniformLocation | null {
    let loc = this.uniformCache.get(name);
    if (loc !== undefined) return loc;
    loc = this.gl.getUniformLocation(this.program, name) ?? undefined;
    if (loc !== undefined) {
      this.uniformCache.set(name, loc);
      return loc;
    }
    return null;
  }

  /**
   * 타입 기반 자동 uniform 설정.
   * - number → uniform1f
   * - number[] (2) → uniform2f
   * - number[] (3) → uniform3f
   * - number[] (4) → uniform4f
   * - boolean → uniform1i (0/1)
   * - WebGLTexture → 텍스처 유닛 바인딩 + uniform1i
   */
  setUniform(
    name: string,
    value: number | number[] | boolean | WebGLTexture,
  ): void {
    const { gl } = this;
    const loc = this.getLocation(name);
    if (!loc) return;

    if (typeof value === 'boolean') {
      gl.uniform1i(loc, value ? 1 : 0);
    } else if (typeof value === 'number') {
      gl.uniform1f(loc, value);
    } else if (Array.isArray(value)) {
      switch (value.length) {
        case 2:
          gl.uniform2f(loc, value[0], value[1]);
          break;
        case 3:
          gl.uniform3f(loc, value[0], value[1], value[2]);
          break;
        case 4:
          gl.uniform4f(loc, value[0], value[1], value[2], value[3]);
          break;
      }
    } else {
      // WebGLTexture
      const unit = this.textureUnit++;
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, value);
      gl.uniform1i(loc, unit);
    }

    glCheck(gl, `setUniform(${name})`);
  }

  /** 정수 전용 uniform (uniform1i) */
  setUniformInt(name: string, value: number): void {
    const { gl } = this;
    const loc = this.getLocation(name);
    if (!loc) return;
    gl.uniform1i(loc, value);
    glCheck(gl, `setUniformInt(${name})`);
  }

  /** 행렬 uniform */
  setUniformMatrix(
    name: string,
    data: Float32Array,
    size: 2 | 3 | 4 = 4,
  ): void {
    const { gl } = this;
    const loc = this.getLocation(name);
    if (!loc) return;

    switch (size) {
      case 2:
        gl.uniformMatrix2fv(loc, false, data);
        break;
      case 3:
        gl.uniformMatrix3fv(loc, false, data);
        break;
      case 4:
        gl.uniformMatrix4fv(loc, false, data);
        break;
    }

    glCheck(gl, `setUniformMatrix(${name})`);
  }

  /** 리소스 해제 */
  dispose(): void {
    this.gl.deleteProgram(this.program);
    this.uniformCache.clear();
  }
}
