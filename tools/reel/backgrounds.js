// Background engine for the reel: a stack of full-screen fragment shaders plus
// photographic (Ken Burns) scenes, rendered into two offscreen targets so one
// scene can cross-fade, wipe or slide into the next.
//
// Everything is a pure function of a virtual clock, so the recorder can step
// the reel frame by frame and get identical output on every run.

const VERT = `#version 300 es
in vec2 a_pos;
void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }
`;

const PRELUDE = `#version 300 es
precision highp float;
uniform vec2 u_res;
uniform float u_time;
uniform sampler2D u_tex;
uniform vec4 u_kb;
out vec4 outColor;

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
vec2 hash22(vec2 p) {
  return vec2(hash21(p), hash21(p + 19.19));
}
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash21(i), hash21(i + vec2(1, 0)), u.x),
             mix(hash21(i + vec2(0, 1)), hash21(i + vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
  for (int i = 0; i < 6; i++) { v += a * vnoise(p); p = m * p; a *= 0.5; }
  return v;
}
mat2 rot(float a) { float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }
vec3 pal(float t, vec3 a, vec3 b, vec3 c, vec3 d) {
  return a + b * cos(6.28318 * (c * t + d));
}
vec3 tonemap(vec3 c) { return c / (1.0 + c * 0.35); }
`;

const MAIN = `
void main() {
  vec2 uv = gl_FragCoord.xy / u_res;
  vec2 p = (gl_FragCoord.xy - 0.5 * u_res) / u_res.y;
  outColor = vec4(clamp(render(p, uv, u_time), 0.0, 1.0), 1.0);
}
`;

// ---------------------------------------------------------------- shaders --

const SHADERS = {

  // Thin silver contour lines pushed around by a slow noise field.
  flowlines: `
vec3 render(vec2 p, vec2 uv, float t) {
  vec2 q = p * 1.15;
  float warp = fbm(q * 1.35 + vec2(t * 0.055, -t * 0.04));
  float warp2 = fbm(q * 2.6 - vec2(t * 0.03, t * 0.05));
  float field = q.y * 8.0 + warp * 7.0 + warp2 * 2.4 + sin(q.x * 1.8 + t * 0.28) * 1.1;
  float g = fract(field) - 0.5;
  float aa = fwidth(field) * 1.2 + 0.0015;
  float line = 1.0 - smoothstep(0.0, aa, abs(g) - 0.035);
  float glow = exp(-abs(g) * 9.0) * 0.22;
  vec3 base = mix(vec3(0.015, 0.02, 0.045), vec3(0.03, 0.05, 0.10), uv.y);
  vec3 tintA = vec3(0.70, 0.86, 1.00);
  vec3 tintB = vec3(1.00, 0.74, 0.88);
  vec3 tint = mix(tintA, tintB, clamp(warp * 0.9 + uv.x * 0.35, 0.0, 1.0));
  return tonemap(base + tint * (line * 0.95 + glow));
}`,

  // Glowing ribbons, one per hue step.
  waves: `
vec3 render(vec2 p, vec2 uv, float t) {
  vec3 col = mix(vec3(0.02, 0.015, 0.05), vec3(0.05, 0.03, 0.10), uv.y);
  for (int i = 0; i < 8; i++) {
    float fi = float(i);
    float ph = fi * 0.68;
    float y = sin(p.x * 1.7 + t * 0.85 + ph) * 0.17
            + sin(p.x * 3.3 - t * 0.55 + ph * 1.7) * 0.07
            + (fi - 3.5) * 0.105;
    float d = abs(p.y - y);
    float thick = 0.016 + 0.010 * sin(t * 1.1 + ph);
    float core = smoothstep(thick, 0.0, d);
    float glow = exp(-d * 22.0) * 0.30;
    vec3 c = pal(fi / 8.0 + t * 0.035, vec3(0.5), vec3(0.5),
                 vec3(1.0), vec3(0.0, 0.33, 0.67));
    col += c * (core * 0.85 + glow);
  }
  return tonemap(col);
}`,

  // Neon grid tunnel rushing at the camera.
  tunnel: `
vec3 render(vec2 p, vec2 uv, float t) {
  float r = max(length(p), 0.02);
  float a = atan(p.y, p.x);
  // 1/r packs the rings towards the vanishing point; t pulls them at us.
  vec2 q = vec2(a / 6.28318 * 10.0, 2.6 / r + t * 1.3);
  vec2 gr = abs(fract(q) - 0.5);
  float aaX = fwidth(q.x) * 1.4 + 0.002;
  float aaY = fwidth(q.y) * 1.4 + 0.002;
  // Spokes fade out near the vanishing point, or they knot into a spider web.
  float lx = (1.0 - smoothstep(0.0, aaX, gr.x - 0.012)) * smoothstep(0.06, 0.42, r);
  float ly = 1.0 - smoothstep(0.0, aaY, gr.y - 0.010);
  float grid = clamp(lx * 0.7 + ly, 0.0, 1.0);
  vec3 neon = mix(vec3(1.0, 0.20, 0.62), vec3(0.22, 0.82, 1.0),
                  0.5 + 0.5 * sin(q.y * 0.35 + t * 0.5));
  float depth = smoothstep(0.03, 0.55, r);
  vec3 col = mix(vec3(0.02, 0.01, 0.05), vec3(0.06, 0.02, 0.12), smoothstep(1.2, 0.0, r));
  col += neon * grid * depth * 1.35;
  col += neon * 0.08 * depth;
  col += vec3(0.95, 0.55, 1.0) * exp(-r * 9.0) * 0.70;
  return tonemap(col);
}`,

  // Liquid chrome: domain-warped noise banded into polished metal ripples.
  mercury: `
vec3 render(vec2 p, vec2 uv, float t) {
  vec2 q = p * 1.5;
  float w1 = fbm(q * 1.25 + vec2(t * 0.075, 0.0));
  float w2 = fbm(q * 1.8 + w1 * 2.4 - vec2(0.0, t * 0.10));
  float v = fbm(q * 2.3 + w2 * 2.8 + vec2(t * 0.05, -t * 0.04));
  float bands = fract(v * 5.5 + t * 0.16);
  float sheen = smoothstep(0.0, 0.42, bands) * smoothstep(1.0, 0.58, bands);
  float grad = length(vec2(dFdx(v), dFdy(v)));
  vec3 metal = mix(vec3(0.05, 0.06, 0.09), vec3(0.90, 0.93, 0.98), pow(sheen, 1.2));
  metal += pal(v * 1.6 + t * 0.05, vec3(0.16), vec3(0.16),
               vec3(0.9, 0.8, 0.7), vec3(0.0, 0.22, 0.48)) * sheen;
  metal += vec3(0.55, 0.72, 1.0) * smoothstep(0.004, 0.02, grad) * 0.22;
  metal *= 0.85 + 0.3 * smoothstep(0.0, 1.0, uv.y);
  return tonemap(metal);
}`,

  // Six-fold kaleidoscope over warped noise.
  kaleido: `
vec3 render(vec2 p, vec2 uv, float t) {
  float r = length(p);
  float a = atan(p.y, p.x) + t * 0.10;
  float k = 6.0;
  a = abs(mod(a, 6.28318 / k) - 3.14159 / k);
  vec2 q = vec2(cos(a), sin(a)) * (r * 2.6 + 0.12 * sin(t * 0.5));
  q *= rot(t * 0.08);
  float n1 = fbm(q * 1.6 + vec2(t * 0.10, 0.0));
  float n2 = fbm(q * 3.0 - vec2(0.0, t * 0.14) + n1 * 1.3);
  float v = n1 * 0.75 + n2 * 0.45;
  // A narrow hue window turns the mandala into stained glass, not a heat map.
  vec3 col = pal(v * 1.1 + t * 0.05, vec3(0.56, 0.46, 0.50), vec3(0.44, 0.42, 0.40),
                 vec3(0.50, 0.42, 0.34), vec3(0.05, 0.22, 0.46));
  float rings = abs(fract(v * 5.0 + t * 0.22) - 0.5);
  col += vec3(1.0, 0.93, 0.82) * smoothstep(0.40, 0.5, rings) * 0.60;
  col *= smoothstep(2.0, 0.15, r) * 1.12;
  return tonemap(col);
}`,

  // Photographic scene: cover fit with a slow Ken Burns push and a light grade.
  photo: `
vec3 render(vec2 p, vec2 uv, float t) {
  float zoom = mix(u_kb.x, u_kb.y, clamp(t, 0.0, 1.0));
  vec2 pan = u_kb.zw * (t - 0.5);
  vec2 texRes = vec2(textureSize(u_tex, 0));
  float sa = u_res.x / u_res.y;
  float ta = texRes.x / texRes.y;
  vec2 scale = sa > ta ? vec2(1.0, ta / sa) : vec2(sa / ta, 1.0);
  vec2 st = (uv - 0.5) * scale / zoom + 0.5 + pan;
  st = clamp(st, vec2(0.0005), vec2(0.9995));
  vec3 col = texture(u_tex, st).rgb;
  float lum = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col = mix(vec3(lum), col, 1.12);
  col = clamp((col - 0.5) * 1.06 + 0.5, 0.0, 1.0);
  return col;
}`,
};

const COMPOSITE = `#version 300 es
precision highp float;
uniform sampler2D u_a;
uniform sampler2D u_b;
uniform vec2 u_res;
uniform float u_mix;
uniform int u_mode;
out vec4 outColor;

float ease(float x) { return x < 0.5 ? 4.0 * x * x * x : 1.0 - pow(-2.0 * x + 2.0, 3.0) / 2.0; }

void main() {
  vec2 uv = gl_FragCoord.xy / u_res;
  float m = clamp(u_mix, 0.0, 1.0);
  vec3 col;
  if (u_mode == 1) {
    float k = uv.x * 0.82 + uv.y * 0.18;
    float edge = smoothstep(k - 0.10, k + 0.10, m * 1.22 - 0.11);
    col = mix(texture(u_a, uv).rgb, texture(u_b, uv).rgb, edge);
  } else if (u_mode == 2) {
    vec2 d = (uv - 0.5) * vec2(u_res.x / u_res.y, 1.0);
    float r = length(d) / 0.78;
    float edge = smoothstep(r - 0.14, r + 0.14, ease(m) * 1.3 - 0.15);
    col = mix(texture(u_a, uv).rgb, texture(u_b, uv).rgb, edge);
  } else if (u_mode == 3) {
    float e = ease(m);
    vec3 a = texture(u_a, clamp(uv + vec2(0.0, e), vec2(0.001), vec2(0.999))).rgb;
    vec3 b = texture(u_b, clamp(uv - vec2(0.0, 1.0 - e), vec2(0.001), vec2(0.999))).rgb;
    col = uv.y + e < 1.0 ? a : b;
  } else if (u_mode == 4) {
    float e = ease(m);
    vec2 ca = (uv - 0.5) / (1.0 + e * 0.16) + 0.5;
    vec2 cb = (uv - 0.5) / (0.86 + e * 0.14) + 0.5;
    col = mix(texture(u_a, ca).rgb, texture(u_b, cb).rgb, smoothstep(0.15, 0.85, m));
  } else if (u_mode == 5) {
    float slats = 9.0;
    float idx = floor(uv.x * slats);
    float stagger = fract(sin(idx * 12.9898) * 43758.5453) * 0.35;
    float local = clamp(m * 1.35 - stagger, 0.0, 1.0);
    float edge = step(1.0 - uv.y, ease(local));
    col = mix(texture(u_a, uv).rgb, texture(u_b, uv).rgb, edge);
  } else {
    col = mix(texture(u_a, uv).rgb, texture(u_b, uv).rgb, smoothstep(0.0, 1.0, m));
  }
  vec2 v = (uv - 0.5) * vec2(u_res.x / u_res.y, 1.0);
  col *= 1.0 - clamp(dot(v, v) * 0.13, 0.0, 0.26);
  outColor = vec4(col, 1.0);
}
`;

function compile(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error(`Shader failed: ${gl.getShaderInfoLog(shader)}`);
  }
  return shader;
}

function program(gl, fragment, name) {
  const prog = gl.createProgram();
  gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT));
  try {
    gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, fragment));
  } catch (error) {
    throw new Error(`${name}: ${error.message}`);
  }
  gl.bindAttribLocation(prog, 0, 'a_pos');
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    throw new Error(`${name} link failed: ${gl.getProgramInfoLog(prog)}`);
  }
  return prog;
}

function target(gl, width, height) {
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  const framebuffer = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  return { texture, framebuffer };
}

export const TRANSITIONS = { fade: 0, wipe: 1, iris: 2, push: 3, zoom: 4, slats: 5 };

/**
 * @param {HTMLCanvasElement} canvas
 * @param {Map<string, HTMLImageElement>} images decoded photo sources, keyed by scene name
 */
export function createBackground(canvas, images) {
  const gl = canvas.getContext('webgl2', {
    alpha: false, antialias: false, depth: false, stencil: false,
    preserveDrawingBuffer: true, premultipliedAlpha: false,
  });
  if (!gl) throw new Error('The reel stage needs WebGL2.');

  const quad = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, quad);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

  const programs = new Map();
  for (const [name, body] of Object.entries(SHADERS)) {
    programs.set(name, program(gl, PRELUDE + body + MAIN, name));
  }
  const composite = program(gl, COMPOSITE, 'composite');

  const width = canvas.width;
  const height = canvas.height;
  const targets = [target(gl, width, height), target(gl, width, height)];

  const textures = new Map();
  for (const [key, image] of images) {
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, image);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    textures.set(key, texture);
  }

  function drawScene(scene, localTime, slot) {
    const name = scene.photo ? 'photo' : scene.shader;
    const prog = programs.get(name);
    if (!prog) throw new Error(`Unknown reel background: ${name}`);
    gl.bindFramebuffer(gl.FRAMEBUFFER, targets[slot].framebuffer);
    gl.viewport(0, 0, width, height);
    gl.useProgram(prog);
    gl.uniform2f(gl.getUniformLocation(prog, 'u_res'), width, height);
    gl.uniform1f(gl.getUniformLocation(prog, 'u_time'), localTime);
    const kb = scene.kenBurns ?? [1, 1, 0, 0];
    gl.uniform4f(gl.getUniformLocation(prog, 'u_kb'), kb[0], kb[1], kb[2], kb[3]);
    if (scene.photo) {
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, textures.get(scene.photo));
      gl.uniform1i(gl.getUniformLocation(prog, 'u_tex'), 0);
    }
    gl.bindVertexArray(vao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  return {
    /**
     * @param {{scene: object, time: number}} from
     * @param {{scene: object, time: number}|null} to
     * @param {number} mix progress from `from` to `to`, 0..1
     * @param {number} mode transition mode, see TRANSITIONS
     */
    render(from, to, mix = 0, mode = 0) {
      drawScene(from.scene, from.time, 0);
      if (to) drawScene(to.scene, to.time, 1);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, width, height);
      gl.useProgram(composite);
      gl.uniform2f(gl.getUniformLocation(composite, 'u_res'), width, height);
      gl.uniform1f(gl.getUniformLocation(composite, 'u_mix'), to ? mix : 0);
      gl.uniform1i(gl.getUniformLocation(composite, 'u_mode'), mode);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, targets[0].texture);
      gl.uniform1i(gl.getUniformLocation(composite, 'u_a'), 0);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, targets[to ? 1 : 0].texture);
      gl.uniform1i(gl.getUniformLocation(composite, 'u_b'), 1);
      gl.bindVertexArray(vao);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.finish();
    },
    shaderNames: [...programs.keys()],
  };
}
