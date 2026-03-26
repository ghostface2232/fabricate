/**
 * WebGL2 컨텍스트 초기화 및 관리.
 * React 의존성 없음 — 순수 TypeScript + WebGL2.
 */

const DEV = import.meta.env.DEV;

function glCheck(gl: WebGL2RenderingContext, label: string): void {
  if (!DEV) return;
  const err = gl.getError();
  if (err !== gl.NO_ERROR) {
    throw new Error(`[WebGLContext] GL error after ${label}: 0x${err.toString(16)}`);
  }
}

export type DataTextureFormat = 'R8' | 'RGBA';

export class WebGLContext {
  readonly gl: WebGL2RenderingContext;
  private readonly canvas: HTMLCanvasElement;
  private loseCtx: WEBGL_lose_context | null;

  constructor(width = 512, height = 512) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = width;
    this.canvas.height = height;

    const gl = this.canvas.getContext('webgl2', {
      alpha: false,
      antialias: false,
      preserveDrawingBuffer: true,
    });

    if (!gl) {
      throw new Error(
        '[WebGLContext] WebGL2를 사용할 수 없습니다. 브라우저가 WebGL2를 지원하는지 확인하세요.',
      );
    }

    this.gl = gl;
    this.loseCtx = gl.getExtension('WEBGL_lose_context');
  }

  /** 캔버스 및 뷰포트 해상도 변경 */
  resize(width: number, height: number): void {
    this.canvas.width = width;
    this.canvas.height = height;
    this.gl.viewport(0, 0, width, height);
  }

  /** GLSL 셰이더 컴파일. 실패 시 infoLog를 포함한 Error throw. */
  compileShader(type: GLenum, source: string): WebGLShader {
    const { gl } = this;
    const shader = gl.createShader(type);
    if (!shader) {
      throw new Error('[WebGLContext] gl.createShader 실패');
    }

    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const info = gl.getShaderInfoLog(shader) ?? 'unknown error';
      gl.deleteShader(shader);
      throw new Error(`[WebGLContext] 셰이더 컴파일 실패:\n${info}`);
    }

    glCheck(gl, 'compileShader');
    return shader;
  }

  /** 셰이더 프로그램 링크. 실패 시 infoLog를 포함한 Error throw. */
  linkProgram(vs: WebGLShader, fs: WebGLShader): WebGLProgram {
    const { gl } = this;
    const program = gl.createProgram();
    if (!program) {
      throw new Error('[WebGLContext] gl.createProgram 실패');
    }

    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const info = gl.getProgramInfoLog(program) ?? 'unknown error';
      gl.deleteProgram(program);
      throw new Error(`[WebGLContext] 프로그램 링크 실패:\n${info}`);
    }

    glCheck(gl, 'linkProgram');
    return program;
  }

  /**
   * 데이터 텍스처 생성.
   * R8 포맷 사용 시 UNPACK_ALIGNMENT=1 설정.
   * CLAMP_TO_EDGE + LINEAR 필터.
   */
  createDataTexture(
    data: Uint8Array,
    width: number,
    height: number,
    format: DataTextureFormat = 'R8',
  ): WebGLTexture {
    const { gl } = this;
    const texture = gl.createTexture();
    if (!texture) {
      throw new Error('[WebGLContext] gl.createTexture 실패');
    }

    gl.bindTexture(gl.TEXTURE_2D, texture);

    if (format === 'R8') {
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.R8,
        width,
        height,
        0,
        gl.RED,
        gl.UNSIGNED_BYTE,
        data,
      );
    } else {
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA8,
        width,
        height,
        0,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        data,
      );
    }

    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

    gl.bindTexture(gl.TEXTURE_2D, null);
    glCheck(gl, 'createDataTexture');
    return texture;
  }

  /** 컨텍스트 해제 */
  dispose(): void {
    this.loseCtx?.loseContext();
  }
}
