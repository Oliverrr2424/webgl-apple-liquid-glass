import {
  VS_FULLSCREEN, VS_GLASS, FS_BLIT, FS_DOWN, FS_WALLPAPER, FS_GLASS,
} from './shaders.js';

function compile(gl, type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    throw new Error(gl.getShaderInfoLog(s) + '\n' + src);
  }
  return s;
}

function program(gl, vs, fs) {
  const p = gl.createProgram();
  gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, vs));
  gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    throw new Error(gl.getProgramInfoLog(p));
  }
  const loc = {};
  const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < n; i++) {
    const name = gl.getActiveUniform(p, i).name.replace('[0]', '');
    loc[name] = gl.getUniformLocation(p, name);
  }
  return { p, loc };
}

export const MIPS = 7;

export class GlassRenderer {
  constructor(canvas) {
    const gl = canvas.getContext('webgl2', {
      alpha: false, antialias: false, premultipliedAlpha: true,
      preserveDrawingBuffer: true,
    });
    if (!gl) throw new Error('WebGL2 unavailable');
    this.gl = gl;
    this.canvas = canvas;

    this.quad = gl.createVertexArray();
    gl.bindVertexArray(this.quad);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER,
      new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);

    this.progWall = program(gl, VS_FULLSCREEN, FS_WALLPAPER);
    this.progDown = program(gl, VS_FULLSCREEN, FS_DOWN);
    this.progBlit = program(gl, VS_FULLSCREEN, FS_BLIT);
    this.progGlass = program(gl, VS_GLASS, FS_GLASS);

    this.tex = null;
    this.fbos = [];
    this.w = 0;
    this.h = 0;
  }

  resize(w, h) {
    if (w === this.w && h === this.h) return;
    const gl = this.gl;
    this.w = w; this.h = h;
    this.canvas.width = w; this.canvas.height = h;

    if (this.tex) gl.deleteTexture(this.tex);
    this.fbos.forEach((f) => gl.deleteFramebuffer(f));

    this.tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.texStorage2D(gl.TEXTURE_2D, MIPS, gl.RGBA8, w, h);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    this.fbos = [];
    for (let i = 0; i < MIPS; i++) {
      const f = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, f);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.tex, i);
      this.fbos.push(f);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  mipSize(level) {
    return [Math.max(1, this.w >> level), Math.max(1, this.h >> level)];
  }

  // Renders the backdrop into mip 0 and builds the progressively blurred chain.
  buildBackdrop(scene, zoom = 1) {
    const gl = this.gl;
    gl.bindVertexArray(this.quad);
    gl.disable(gl.BLEND);

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbos[0]);
    gl.viewport(0, 0, this.w, this.h);
    gl.useProgram(this.progWall.p);
    gl.uniform2f(this.progWall.loc.uRes, this.w, this.h);
    gl.uniform1i(this.progWall.loc.uScene, scene);
    gl.uniform1f(this.progWall.loc.uZoom, zoom);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    gl.useProgram(this.progDown.p);
    gl.uniform1i(this.progDown.loc.uTex, 0);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    for (let i = 1; i < MIPS; i++) {
      const [sw, sh] = this.mipSize(i - 1);
      const [dw, dh] = this.mipSize(i);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_BASE_LEVEL, i - 1);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAX_LEVEL, i - 1);
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbos[i]);
      gl.viewport(0, 0, dw, dh);
      gl.uniform2f(this.progDown.loc.uTexel, 1 / sw, 1 / sh);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_BASE_LEVEL, 0);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAX_LEVEL, MIPS - 1);
  }

  // Draws the sharp backdrop to the screen.
  drawBackdrop() {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.w, this.h);
    gl.disable(gl.BLEND);
    gl.bindVertexArray(this.quad);
    gl.useProgram(this.progBlit.p);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.uniform1i(this.progBlit.loc.uTex, 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  // element: {x, y, w, h} in CSS pixels, y measured from the TOP.
  drawGlass(element, m, dpr) {
    const gl = this.gl;
    const { loc, p } = this.progGlass;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.w, this.h);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.bindVertexArray(this.quad);
    gl.useProgram(p);

    const cx = (element.x + element.w / 2) * dpr;
    const cy = this.h - (element.y + element.h / 2) * dpr;
    const hw = (element.w / 2) * dpr;
    const hh = (element.h / 2) * dpr;

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.uniform1i(loc.uSrc, 0);
    gl.uniform2f(loc.uRes, this.w, this.h);
    gl.uniform2f(loc.uCenter, cx, cy);
    gl.uniform2f(loc.uHalf, hw, hh);
    gl.uniform1f(loc.uPad, (m.shadowSize * 4 + 8) * dpr);
    gl.uniform1f(loc.uRadius, m.radius * dpr);
    gl.uniform1f(loc.uSquircle, m.squircle);
    gl.uniform1f(loc.uBevel, m.bevel * dpr);
    gl.uniform1f(loc.uHeight, m.height * dpr);
    gl.uniform1f(loc.uIOR, m.ior);
    gl.uniform1f(loc.uDispersion, m.dispersion);
    gl.uniform1f(loc.uBlurPlateau, m.blurPlateau + Math.log2(dpr));
    gl.uniform1f(loc.uBlurRim, m.blurRim + Math.log2(dpr));
    gl.uniform1f(loc.uSpecular, m.specular);
    gl.uniform1f(loc.uSpecPower, m.specPower);
    gl.uniform1f(loc.uFresnel, m.fresnel);
    gl.uniform1f(loc.uSat, m.saturation);
    gl.uniform1f(loc.uBright, m.brightness);
    gl.uniform1f(loc.uTintAmount, m.tintAmount);
    gl.uniform1f(loc.uAdaptive, m.adaptive);
    gl.uniform3f(loc.uTintColor, ...m.tintColor);
    gl.uniform1f(loc.uShadow, m.shadow);
    gl.uniform1f(loc.uShadowSize, m.shadowSize * dpr);
    gl.uniform1f(loc.uShadowOffset, m.shadowOffset * dpr);
    gl.uniform2f(loc.uLightDir, m.lightX, m.lightY);
    gl.uniform1f(loc.uEdgeLine, m.edgeLine);
    gl.uniform1f(loc.uEdgeWidth, m.edgeWidth * dpr);
    gl.uniform1f(loc.uEdgeDark, m.edgeDark);
    gl.uniform1f(loc.uRefractScale, m.refractScale);
    gl.uniform1f(loc.uMeniscus, m.meniscus);
    gl.uniform1i(loc.uDebug, m.debug | 0);
    gl.uniform1f(loc.uAvgLod,
      Math.min(MIPS - 1, Math.max(0, Math.log2(Math.max(hw, hh) * 2))));

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.disable(gl.BLEND);
  }
}
