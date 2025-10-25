// src/lib/effects/pipeline.gl.ts
// بايبلاين WebGL بسيط (اختياري). إن لم يتوفر WebGL يُرجع null.
// يطبّق contrast/saturation/brightness شبيهة بفلاتر 2D.

type GL = WebGLRenderingContext;

export interface GLPipeline {
  stream: MediaStream;
  start(): void;
  stop(): void;
  updateBeauty(level01: number): void; // 0..1
  setMask(_img: HTMLImageElement | null): void; // reserved
}

export async function tryStartGLPipeline(
  input: MediaStream,
  opts: { fps?: number } = {}
): Promise<GLPipeline | null> {
  if (typeof document === "undefined") return null;

  const video = document.createElement("video");
  video.playsInline = true;
  video.muted = true;
  (video as any).srcObject = input;
  try { await video.play(); } catch {}

  const canvas = document.createElement("canvas");
  const gl = (canvas.getContext("webgl") || canvas.getContext("experimental-webgl")) as GL | null;
  if (!gl) return null;

  // أبعاد أولية من الفيديو
  const w = video.videoWidth || 640;
  const h = video.videoHeight || 480;
  canvas.width = w;
  canvas.height = h;

  // Shader
  const vsSrc = `
    attribute vec2 aPos;
    attribute vec2 aUV;
    varying vec2 vUV;
    void main() {
      vUV = aUV;
      gl_Position = vec4(aPos, 0.0, 1.0);
    }
  `;
  const fsSrc = `
    precision mediump float;
    varying vec2 vUV;
    uniform sampler2D uTex;
    uniform float uContrast;   // 1..1.08
    uniform float uSaturate;   // 1..1.12
    uniform float uBrightness; // 1..1.06

    vec3 rgb2hsv(vec3 c){
      vec4 K = vec4(0., -1./3., 2./3., -1.);
      vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
      vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
      float d = q.x - min(q.w, q.y);
      float e = 1.0e-10;
      return vec3(abs(q.z + (q.w - q.y) / (6.*d + e)), d / (q.x + e), q.x);
    }
    vec3 hsv2rgb(vec3 c){
      vec3 p = abs(fract(c.xxx + vec3(0.,1./3.,2./3.))*6. - 3.);
      return c.z * mix(vec3(1.), clamp(p - 1., 0., 1.), c.y);
    }

    void main(){
      vec4 col = texture2D(uTex, vUV);

      // contrast
      col.rgb = ((col.rgb - 0.5) * uContrast) + 0.5;

      // brightness
      col.rgb *= uBrightness;

      // saturation
      vec3 hsv = rgb2hsv(col.rgb);
      hsv.y *= uSaturate;
      col.rgb = hsv2rgb(hsv);

      gl_FragColor = col;
    }
  `;

  const prog = link(gl, vsSrc, fsSrc);
  const aPos = gl.getAttribLocation(prog, "aPos");
  const aUV = gl.getAttribLocation(prog, "aUV");
  const uTex = gl.getUniformLocation(prog, "uTex");
  const uContrast = gl.getUniformLocation(prog, "uContrast");
  const uSaturate = gl.getUniformLocation(prog, "uSaturate");
  const uBrightness = gl.getUniformLocation(prog, "uBrightness");

  const quad = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, quad);
  //   pos.xy   uv.xy
  const data = new Float32Array([
    -1, -1, 0, 0,
     1, -1, 1, 0,
    -1,  1, 0, 1,
     1,  1, 1, 1,
  ]);
  gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);

  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  let raf = 0;
  let running = true;

  // beauty params map 0..1 -> نفس خريطة 2D
  let level = 0.4; // 40%
  function uniformsFromLevel(l01: number) {
    const t = Math.max(0, Math.min(1, l01));
    const contrast = 1.0 + 0.08 * t;
    const saturate = 1.0 + 0.12 * t;
    const brightness = 1.0 + 0.06 * t;
    return { contrast, saturate, brightness };
  }

  function draw() {
    if (!running) return;
    // قد تتغير أبعاد الفيديو
    const vw = video.videoWidth || w;
    const vh = video.videoHeight || h;
    if (vw !== canvas.width || vh !== canvas.height) {
      canvas.width = vw;
      canvas.height = vh;
      gl.viewport(0, 0, vw, vh);
    }

    gl.useProgram(prog);
    gl.viewport(0, 0, canvas.width, canvas.height);

    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.enableVertexAttribArray(aPos);
    gl.enableVertexAttribArray(aUV);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 16, 0);
    gl.vertexAttribPointer(aUV, 2, gl.FLOAT, false, 16, 8);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    try {
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        video
      );
    } catch {}

    const u = uniformsFromLevel(level);
    gl.uniform1i(uTex, 0);
    gl.uniform1f(uContrast, u.contrast);
    gl.uniform1f(uSaturate, u.saturate);
    gl.uniform1f(uBrightness, u.brightness);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    raf = requestAnimationFrame(draw);
  }

  gl.useProgram(prog);
  gl.viewport(0, 0, canvas.width, canvas.height);

  const fps = Math.min(60, Math.max(10, Math.round(opts.fps ?? 30)));
  const out = (canvas as any).captureStream ? (canvas as any).captureStream(fps) : null;
  const stream: MediaStream = (out || input) as MediaStream;
  try {
    const a = input.getAudioTracks?.()[0];
    if (out && a && stream.getAudioTracks().length === 0) stream.addTrack(a);
  } catch {}

  function start() {
    if (!running) {
      running = true;
      raf = requestAnimationFrame(draw);
    } else {
      raf = requestAnimationFrame(draw);
    }
  }
  function stop() {
    running = false;
    if (raf) cancelAnimationFrame(raf);
    try { (video as any).srcObject = null; video.pause?.(); } catch {}
    gl.deleteTexture(tex);
    gl.deleteBuffer(quad);
    gl.useProgram(null);
  }

  start();

  return {
    stream,
    start,
    stop,
    updateBeauty(l01: number) { level = Math.max(0, Math.min(1, l01)); },
    setMask(_img: HTMLImageElement | null) { /* reserved */ },
  };
}

// ------- utils -------
function link(gl: GL, vsSrc: string, fsSrc: string): WebGLProgram {
  const vs = compile(gl, gl.VERTEX_SHADER, vsSrc);
  const fs = compile(gl, gl.FRAGMENT_SHADER, fsSrc);
  const p = gl.createProgram()!;
  gl.attachShader(p, vs);
  gl.attachShader(p, fs);
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(p) || "link error";
    gl.deleteProgram(p);
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    throw new Error(log);
  }
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  return p;
}

function compile(gl: GL, type: number, src: string): WebGLShader {
  const s = gl.createShader(type)!;
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(s) || "compile error";
    gl.deleteShader(s);
    throw new Error(log);
  }
  return s;
}
