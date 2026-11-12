/** Shared WebGL1 helpers for the dithered backgrounds (clouds and footer landscape). */

export const VERT = `
attribute vec2 a_pos;
void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }
`;

/** Noise, fbm and a 4x4 Bayer matrix, plus the five palette colors. */
export const COMMON = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform vec2 u_res;
uniform float u_time;
uniform vec4 u_p; // per-effect parameters

const vec3 BG   = vec3(11.0, 11.0, 12.0) / 255.0;   // --bg
const vec3 RULE = vec3(31.0, 31.0, 34.0) / 255.0;   // --rule
const vec3 INK3 = vec3(74.0, 74.0, 79.0) / 255.0;   // --ink-3
const vec3 INK2 = vec3(154.0, 151.0, 143.0) / 255.0; // --ink-2
const vec3 INK  = vec3(242.0, 239.0, 233.0) / 255.0; // --ink

float hash3(vec3 p) {
  p = fract(p * 0.3183099 + vec3(0.1, 0.2, 0.3));
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float vnoise(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(hash3(i), hash3(i + vec3(1.0, 0.0, 0.0)), f.x), mix(hash3(i + vec3(0.0, 1.0, 0.0)), hash3(i + vec3(1.0, 1.0, 0.0)), f.x), f.y),
    mix(mix(hash3(i + vec3(0.0, 0.0, 1.0)), hash3(i + vec3(1.0, 0.0, 1.0)), f.x), mix(hash3(i + vec3(0.0, 1.0, 1.0)), hash3(i + vec3(1.0, 1.0, 1.0)), f.x), f.y),
    f.z);
}
float fbm(vec3 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) {
    v += a * vnoise(p);
    p = p * 2.02 + vec3(11.7, 3.1, 5.3);
    a *= 0.5;
  }
  return v / 0.9375;
}
float bayer2(vec2 p) { p = mod(p, 2.0); return mod(2.0 * p.x + 3.0 * p.y, 4.0); }
float bayer4(vec2 p) { return (4.0 * bayer2(p) + bayer2(floor(p / 2.0))) / 16.0 + 0.5 / 16.0; }

/** Quantize brightness b (0..1) to levels with an ordered dither: 0 bg, 1 rule, 2 ink-3, 3 ink-2, 4 ink (sparse). */
vec3 dither(float b, vec2 fragCoord) {
  float thr = bayer4(fragCoord);
  float lvl = floor(b * 3.0 + thr);
  if (b > 0.82 && thr > 0.6) lvl = 4.0;
  if (lvl < 0.5) return BG;
  if (lvl < 1.5) return RULE;
  if (lvl < 2.5) return INK3;
  if (lvl < 3.5) return INK2;
  return INK;
}
`;

export interface DitherOptions {
  frag: string;
  /** Called every frame before drawing, to set u_p. Returns the 4 floats. */
  params: (t: number) => [number, number, number, number];
  /** Canvas pixels per CSS pixel (0.5 = 2px cells). */
  scale?: number;
  fps: number;
  /** Time (s) to render for the static frame under reduced motion. */
  staticTime?: number;
}

export interface DitherHandle {
  destroy(): void;
  /** False when WebGL is unavailable (the canvas is then hidden). */
  ok: boolean;
  readAverageLuminance(): number | null;
  /** Mean luminance of a region, as fractions of the canvas (origin bottom-left). */
  readRegionLuminance(x0: number, y0: number, x1: number, y1: number): number | null;
}

function compile(gl: WebGLRenderingContext, type: number, src: string): WebGLShader | null {
  const sh = gl.createShader(type);
  if (!sh) return null;
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    console.warn("dither shader failed:", gl.getShaderInfoLog(sh));
    gl.deleteShader(sh);
    return null;
  }
  return sh;
}

/**
 * Renders a fragment shader to a canvas at a low resolution (so each pixel is one dither cell), with a frame cap,
 * and pauses off-screen and when the tab is hidden. Static under reduced motion.
 */
export function startDither(canvas: HTMLCanvasElement, opts: DitherOptions): DitherHandle {
  const scale = opts.scale ?? 0.5;
  const dead: DitherHandle = { destroy: () => undefined, ok: false, readAverageLuminance: () => null, readRegionLuminance: () => null };
  const gl = canvas.getContext("webgl", { antialias: false, alpha: false, powerPreference: "low-power", preserveDrawingBuffer: true });
  if (!gl) {
    canvas.style.display = "none";
    return dead;
  }
  const vs = compile(gl, gl.VERTEX_SHADER, VERT);
  const fs = compile(gl, gl.FRAGMENT_SHADER, opts.frag);
  const prog = gl.createProgram();
  if (!vs || !fs || !prog) {
    canvas.style.display = "none";
    return dead;
  }
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    canvas.style.display = "none";
    return dead;
  }
  gl.useProgram(prog);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, "a_pos");
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const uRes = gl.getUniformLocation(prog, "u_res");
  const uTime = gl.getUniformLocation(prog, "u_time");
  const uP = gl.getUniformLocation(prog, "u_p");

  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const frameMs = 1000 / opts.fps;
  const t0 = performance.now();
  let raf = 0;
  let last = 0;
  let running = false;
  let onScreen = true;

  const draw = (t: number): void => {
    const [a, b, c, d] = opts.params(t);
    gl.uniform2f(uRes, canvas.width, canvas.height);
    gl.uniform1f(uTime, t);
    gl.uniform4f(uP, a, b, c, d);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };
  const resize = (): void => {
    const w = Math.max(1, Math.ceil(canvas.clientWidth * scale));
    const h = Math.max(1, Math.ceil(canvas.clientHeight * scale));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
      gl.viewport(0, 0, w, h);
    }
    draw(reduce ? (opts.staticTime ?? 20) : (performance.now() - t0) / 1000);
  };
  const tick = (now: number): void => {
    if (!running) return;
    raf = requestAnimationFrame(tick);
    if (now - last < frameMs) return;
    last = now;
    draw((now - t0) / 1000);
  };
  const sync = (): void => {
    const go = !reduce && onScreen && !document.hidden;
    if (go && !running) {
      running = true;
      raf = requestAnimationFrame(tick);
    } else if (!go && running) {
      running = false;
      cancelAnimationFrame(raf);
    }
  };

  resize();
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  let io: IntersectionObserver | undefined;
  if (!reduce) {
    io = new IntersectionObserver((entries) => {
      onScreen = entries.some((e) => e.isIntersecting);
      sync();
    });
    io.observe(canvas);
    document.addEventListener("visibilitychange", sync);
    sync();
  }

  return {
    ok: true,
    destroy: () => {
      running = false;
      cancelAnimationFrame(raf);
      ro.disconnect();
      io?.disconnect();
      document.removeEventListener("visibilitychange", sync);
    },
    readRegionLuminance: (x0, y0, x1, y1) => {
      const w = canvas.width;
      const h = canvas.height;
      const rx = Math.floor(x0 * w);
      const ry = Math.floor(y0 * h);
      const rw = Math.max(1, Math.floor((x1 - x0) * w));
      const rh = Math.max(1, Math.floor((y1 - y0) * h));
      const px = new Uint8Array(rw * rh * 4);
      gl.readPixels(rx, ry, rw, rh, gl.RGBA, gl.UNSIGNED_BYTE, px);
      let sum = 0;
      for (let i = 0; i < px.length; i += 4) sum += (0.2126 * (px[i] as number) + 0.7152 * (px[i + 1] as number) + 0.0722 * (px[i + 2] as number)) / 255;
      return sum / (rw * rh);
    },
    readAverageLuminance: () => {
      const w = canvas.width;
      const h = canvas.height;
      const px = new Uint8Array(w * h * 4);
      gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
      let sum = 0;
      for (let i = 0; i < px.length; i += 4) sum += (0.2126 * (px[i] as number) + 0.7152 * (px[i + 1] as number) + 0.0722 * (px[i + 2] as number)) / 255;
      return sum / (w * h);
    },
  };
}

/** Fraction of pixels that are not the page background (cloud coverage), for tuning. */
export function coverageOf(canvas: HTMLCanvasElement): number | null {
  const gl = canvas.getContext("webgl");
  if (!gl) return null;
  const w = canvas.width;
  const h = canvas.height;
  const px = new Uint8Array(w * h * 4);
  gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
  let on = 0;
  for (let i = 0; i < px.length; i += 4) if ((px[i] as number) > 14 || (px[i + 1] as number) > 14) on++;
  return on / (w * h);
}
