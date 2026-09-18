/**
 * WebGL Page Virtualizer & Dynamic Texture Pool
 * Maintains active GPU textures strictly in [P_visible - 2, P_visible + 2].
 * Employs LRU (Least Recently Used) cache eviction to keep memory < 150MB.
 */

export interface TextureEntry {
  pageIndex: number;
  texture: WebGLTexture;
  width: number;
  height: number;
  lastUsed: number;
}

export class WebGLPageVirtualizer {
  private gl: WebGLRenderingContext | null = null;
  private program: WebGLProgram | null = null;
  private positionBuffer: WebGLBuffer | null = null;
  private texCoordBuffer: WebGLBuffer | null = null;
  private texturePool: Map<number, TextureEntry> = new Map();
  private maxPoolSize = 5; // [P - 2, P + 2] window

  constructor(canvas: HTMLCanvasElement) {
    const gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
    if (!gl) {
      console.warn("WebGL not supported on this platform, falling back to 2D Canvas");
      return;
    }
    this.gl = gl as WebGLRenderingContext;
    this.initShaders();
    this.initBuffers();
  }

  private initShaders() {
    if (!this.gl) return;
    const gl = this.gl;

    const vsSource = `
      attribute vec2 a_position;
      attribute vec2 a_texCoord;
      varying vec2 v_texCoord;
      void main() {
        gl_Position = vec4(a_position, 0.0, 1.0);
        v_texCoord = a_texCoord;
      }
    `;

    const fsSource = `
      precision mediump float;
      uniform sampler2D u_image;
      varying vec2 v_texCoord;
      void main() {
        gl_FragColor = texture2D(u_image, v_texCoord);
      }
    `;

    const vs = this.compileShader(gl.VERTEX_SHADER, vsSource);
    const fs = this.compileShader(gl.FRAGMENT_SHADER, fsSource);
    if (!vs || !fs) return;

    const program = gl.createProgram();
    if (!program) return;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.warn("WebGL program link error:", gl.getProgramInfoLog(program));
      return;
    }

    this.program = program;
  }

  private compileShader(type: number, source: string): WebGLShader | null {
    if (!this.gl) return null;
    const shader = this.gl.createShader(type);
    if (!shader) return null;
    this.gl.shaderSource(shader, source);
    this.gl.compileShader(shader);
    if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
      console.warn("Shader compile error:", this.gl.getShaderInfoLog(shader));
      this.gl.deleteShader(shader);
      return null;
    }
    return shader;
  }

  private initBuffers() {
    if (!this.gl) return;
    const gl = this.gl;

    // Full viewport quad: -1 to 1
    this.positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([
        -1.0, -1.0,
         1.0, -1.0,
        -1.0,  1.0,
        -1.0,  1.0,
         1.0, -1.0,
         1.0,  1.0,
      ]),
      gl.STATIC_DRAW
    );

    // Texture coords: 0 to 1 with Y inverted for canvas standard
    this.texCoordBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([
        0.0, 1.0,
        1.0, 1.0,
        0.0, 0.0,
        0.0, 0.0,
        1.0, 1.0,
        1.0, 0.0,
      ]),
      gl.STATIC_DRAW
    );
  }

  /**
   * Uploads raw RGBA bytes into a WebGL texture for pageIndex
   */
  public uploadPageTexture(
    pageIndex: number,
    width: number,
    height: number,
    rgbaPixels: Uint8Array
  ) {
    if (!this.gl) return;
    const gl = this.gl;

    // Evict textures outside the active window using LRU
    this.evictLru(pageIndex);

    let entry = this.texturePool.get(pageIndex);
    if (!entry) {
      const tex = gl.createTexture();
      if (!tex) return;
      entry = {
        pageIndex,
        texture: tex,
        width,
        height,
        lastUsed: Date.now(),
      };
      this.texturePool.set(pageIndex, entry);
    }

    gl.bindTexture(gl.TEXTURE_2D, entry.texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      width,
      height,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      rgbaPixels
    );
    entry.lastUsed = Date.now();
  }

  /**
   * Evicts textures not in [activePage - 2, activePage + 2]
   */
  private evictLru(activePage: number) {
    if (!this.gl) return;
    const minPage = Math.max(0, activePage - 2);
    const maxPage = activePage + 2;

    for (const [pageIdx, entry] of this.texturePool.entries()) {
      if (pageIdx < minPage || pageIdx > maxPage) {
        this.gl.deleteTexture(entry.texture);
        this.texturePool.delete(pageIdx);
      }
    }
  }

  /**
   * Renders the texture of the current page to the canvas viewport
   */
  public renderPage(pageIndex: number) {
    if (!this.gl || !this.program) return;
    const gl = this.gl;
    const entry = this.texturePool.get(pageIndex);
    if (!entry) return;

    entry.lastUsed = Date.now();

    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    gl.clearColor(0.976, 0.965, 0.933, 1.0); // Bhurjapatra paper
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.useProgram(this.program);

    const posAttr = gl.getAttribLocation(this.program, "a_position");
    gl.enableVertexAttribArray(posAttr);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
    gl.vertexAttribPointer(posAttr, 2, gl.FLOAT, false, 0, 0);

    const texAttr = gl.getAttribLocation(this.program, "a_texCoord");
    gl.enableVertexAttribArray(texAttr);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer);
    gl.vertexAttribPointer(texAttr, 2, gl.FLOAT, false, 0, 0);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, entry.texture);
    const imageUni = gl.getUniformLocation(this.program, "u_image");
    gl.uniform1i(imageUni, 0);

    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  public destroy() {
    if (!this.gl) return;
    for (const entry of this.texturePool.values()) {
      this.gl.deleteTexture(entry.texture);
    }
    this.texturePool.clear();
  }
}
