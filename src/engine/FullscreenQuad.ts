/**
 * 풀스크린 쿼드 렌더링 유틸리티.
 * TRIANGLE_STRIP 4정점, VAO 기반.
 */

import { WebGLContext } from './WebGLContext';

const DEV = import.meta.env.DEV;

function glCheck(gl: WebGL2RenderingContext, label: string): void {
  if (!DEV) return;
  const err = gl.getError();
  if (err !== gl.NO_ERROR) {
    throw new Error(`[FullscreenQuad] GL error after ${label}: 0x${err.toString(16)}`);
  }
}

// 위치(-1,-1 ~ 1,1) + UV(0,0 ~ 1,1), TRIANGLE_STRIP 순서
// prettier-ignore
const QUAD_VERTICES = new Float32Array([
  // x,    y,    u,   v
  -1.0, -1.0,  0.0, 0.0,
   1.0, -1.0,  1.0, 0.0,
  -1.0,  1.0,  0.0, 1.0,
   1.0,  1.0,  1.0, 1.0,
]);

export class FullscreenQuad {
  private readonly gl: WebGL2RenderingContext;
  private readonly vao: WebGLVertexArrayObject;
  private readonly vbo: WebGLBuffer;

  constructor(ctx: WebGLContext) {
    const gl = ctx.gl;
    this.gl = gl;

    const vao = gl.createVertexArray();
    if (!vao) throw new Error('[FullscreenQuad] gl.createVertexArray 실패');
    this.vao = vao;

    const vbo = gl.createBuffer();
    if (!vbo) throw new Error('[FullscreenQuad] gl.createBuffer 실패');
    this.vbo = vbo;

    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, QUAD_VERTICES, gl.STATIC_DRAW);

    const stride = 4 * Float32Array.BYTES_PER_ELEMENT;

    // a_position (location = 0): vec2
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, stride, 0);

    // a_uv (location = 1): vec2
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(
      1,
      2,
      gl.FLOAT,
      false,
      stride,
      2 * Float32Array.BYTES_PER_ELEMENT,
    );

    gl.bindVertexArray(null);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    glCheck(gl, 'constructor');
  }

  /** VAO 바인딩 후 쿼드 드로우 */
  draw(): void {
    const { gl } = this;
    gl.bindVertexArray(this.vao);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.bindVertexArray(null);
    glCheck(gl, 'draw');
  }

  /** VAO, VBO 해제 */
  dispose(): void {
    const { gl } = this;
    gl.deleteVertexArray(this.vao);
    gl.deleteBuffer(this.vbo);
  }
}
