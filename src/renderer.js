import {
  VS_FULLSCREEN, VS_GLASS, FS_BLIT, FS_DOWN, FS_UP, FS_WALLPAPER, FS_GLASS,
} from './shaders.js';
import { MAX_GLASS_SHAPES } from './geometry.js';
import { FS_GLASS_V2 } from './v2-shaders.js';

function compile(gl, type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(s);
    gl.deleteShader(s);
    throw new Error(log + '\n' + src);
  }
  return s;
}

function program(gl, vs, fs) {
  const p = gl.createProgram();
  const vertex = compile(gl, gl.VERTEX_SHADER, vs);
  let fragment;
  try {
    fragment = compile(gl, gl.FRAGMENT_SHADER, fs);
  } catch (error) {
    gl.deleteShader(vertex);
    gl.deleteProgram(p);
    throw error;
  }
  gl.attachShader(p, vertex);
  gl.attachShader(p, fragment);
  gl.linkProgram(p);
  // The shader objects only exist to build the program; keeping them alive
  // holds on to driver memory for the lifetime of the renderer.
  gl.detachShader(p, vertex);
  gl.detachShader(p, fragment);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(p);
    gl.deleteProgram(p);
    throw new Error(log);
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
export { MAX_GLASS_SHAPES };

export class GlassRenderer {
  constructor(canvas, options = {}) {
    const gl = canvas.getContext('webgl2', {
      alpha: Boolean(options.alpha), antialias: false, premultipliedAlpha: true,
      // Reading the canvas back (screenshots, toDataURL) needs the drawing
      // buffer preserved, but it also stops the driver from discarding it
      // between frames. Off by default; the tooling turns it on explicitly.
      preserveDrawingBuffer: Boolean(options.preserveDrawingBuffer),
    });
    if (!gl) throw new Error('WebGL2 unavailable');
    this.gl = gl;
    this.canvas = canvas;
    this.materialVersion = options.materialVersion === 2 ? 2 : 1;
    // Set while the GPU context is gone. Every GL call in this class is a no-op
    // until `restore()` rebuilds the resources, so a lost context degrades to a
    // frozen surface instead of an exception storm.
    this.lost = false;

    this.tex = null;
    this.blurTex = null;
    this.wallpapers = [];
    this.fbos = [];
    this.blurFbos = [];
    this.mipLevels = 0;
    this.w = 0;
    this.h = 0;
    this.createResources();
  }

  createResources() {
    const gl = this.gl;
    this.quad = gl.createVertexArray();
    gl.bindVertexArray(this.quad);
    this.quadBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
    gl.bufferData(gl.ARRAY_BUFFER,
      new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);

    this.progWall = program(gl, VS_FULLSCREEN, FS_WALLPAPER);
    this.progDown = program(gl, VS_FULLSCREEN, FS_DOWN);
    this.progUp = program(gl, VS_FULLSCREEN, FS_UP);
    this.progBlit = program(gl, VS_FULLSCREEN, FS_BLIT);
    this.progGlass = program(gl, VS_GLASS,
      this.materialVersion === 2 ? FS_GLASS_V2 : FS_GLASS);

    // FS_WALLPAPER always has a sampler, even for its procedural path. Binding
    // the backdrop mip texture while rendering into that same texture is an
    // illegal feedback loop, so keep a complete inert texture for uUseImage=0.
    this.fallbackTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.fallbackTexture);
    gl.texImage2D(
      gl.TEXTURE_2D, 0, gl.SRGB8_ALPHA8, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE,
      new Uint8Array([0, 0, 0, 255]),
    );
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.bindTexture(gl.TEXTURE_2D, null);
  }

  releaseResources() {
    const gl = this.gl;
    for (const entry of [
      this.progWall, this.progDown, this.progUp, this.progBlit, this.progGlass,
    ]) {
      if (entry) gl.deleteProgram(entry.p);
    }
    this.progWall = null;
    this.progDown = null;
    this.progUp = null;
    this.progBlit = null;
    this.progGlass = null;
    if (this.quad) gl.deleteVertexArray(this.quad);
    if (this.quadBuffer) gl.deleteBuffer(this.quadBuffer);
    if (this.fallbackTexture) gl.deleteTexture(this.fallbackTexture);
    this.quad = null;
    this.quadBuffer = null;
    this.fallbackTexture = null;
  }

  releaseTargets() {
    const gl = this.gl;
    if (this.tex) gl.deleteTexture(this.tex);
    if (this.blurTex) gl.deleteTexture(this.blurTex);
    this.fbos.forEach((framebuffer) => gl.deleteFramebuffer(framebuffer));
    this.blurFbos.forEach((framebuffer) => gl.deleteFramebuffer(framebuffer));
    this.tex = null;
    this.blurTex = null;
    this.fbos = [];
    this.blurFbos = [];
    this.mipLevels = 0;
  }

  // Drops every handle without touching the GPU: after a context loss the ids
  // are already invalid and deleting them is meaningless.
  handleContextLost() {
    this.lost = true;
    this.progWall = null;
    this.progDown = null;
    this.progUp = null;
    this.progBlit = null;
    this.progGlass = null;
    this.quad = null;
    this.quadBuffer = null;
    this.fallbackTexture = null;
    this.tex = null;
    this.blurTex = null;
    this.fbos = [];
    this.blurFbos = [];
    for (const entry of this.wallpapers) {
      entry.texture = null;
      entry.ready = false;
      entry.width = 0;
      entry.height = 0;
    }
  }

  // Rebuilds programs, render targets and backdrop textures after the browser
  // restores the context. The WebGL2 context object itself is reused per spec,
  // so only the resources have to be recreated.
  restore() {
    if (!this.lost) return this;
    this.lost = false;
    this.createResources();
    const { w, h } = this;
    this.w = 0;
    this.h = 0;
    if (w > 0 && h > 0) this.resize(w, h);
    this.createWallpaperTextures();
    return this;
  }

  hasLiveBackdrop() {
    return this.wallpapers.some((entry) => entry.update === 'live');
  }

  sourceSize(source) {
    return [
      Number(source?.videoWidth || source?.naturalWidth || source?.width || 0),
      Number(source?.videoHeight || source?.naturalHeight || source?.height || 0),
    ];
  }

  uploadWallpaper(entry, forceAllocation = false) {
    if (this.lost || !entry.texture) return false;
    const [width, height] = this.sourceSize(entry.source);
    if (!(width > 0) || !(height > 0)) return false;

    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, entry.texture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    if (!forceAllocation && entry.ready && entry.width === width && entry.height === height) {
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, entry.source);
    } else {
      gl.texImage2D(
        gl.TEXTURE_2D, 0, gl.SRGB8_ALPHA8, gl.RGBA, gl.UNSIGNED_BYTE, entry.source,
      );
    }
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    entry.width = width;
    entry.height = height;
    entry.ready = true;
    return true;
  }

  resize(w, h) {
    w = Math.max(1, Math.round(w));
    h = Math.max(1, Math.round(h));
    if (this.lost) { this.w = w; this.h = h; return; }
    if (w === this.w && h === this.h) return;
    const gl = this.gl;
    this.w = w; this.h = h;
    this.canvas.width = w; this.canvas.height = h;

    this.releaseTargets();

    // texStorage2D rejects a level count larger than the size can represent.
    // Seven levels are useful on a full-screen surface, but a 32px icon only
    // has six (32, 16, 8, 4, 2, 1).
    this.mipLevels = Math.min(MIPS, Math.floor(Math.log2(Math.max(w, h))) + 1);

    const createMipTexture = () => {
      const texture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, texture);
      // Sampling an sRGB texture decodes RGB to linear; writing to the sRGB
      // attachment encodes it again. Alpha remains linear, preserving the
      // optical-density side channel.
      gl.texStorage2D(gl.TEXTURE_2D, this.mipLevels, gl.SRGB8_ALPHA8, w, h);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      return texture;
    };

    this.tex = createMipTexture();
    this.blurTex = createMipTexture();
    this.fbos = [];
    this.blurFbos = [];
    for (let i = 0; i < this.mipLevels; i++) {
      const f = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, f);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.tex, i);
      this.fbos.push(f);

      const blurFbo = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, blurFbo);
      gl.framebufferTexture2D(
        gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.blurTex, i,
      );
      this.blurFbos.push(blurFbo);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  // (Re)allocates a GL texture per backdrop entry and uploads its first frame.
  createWallpaperTextures() {
    if (this.lost) return;
    const gl = this.gl;
    for (const entry of this.wallpapers) {
      if (entry.texture) gl.deleteTexture(entry.texture);
      entry.texture = gl.createTexture();
      entry.ready = false;
      entry.width = 0;
      entry.height = 0;
      gl.bindTexture(gl.TEXTURE_2D, entry.texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      this.uploadWallpaper(entry, true);
    }
    gl.bindTexture(gl.TEXTURE_2D, null);
  }

  setWallpapers(images, options = {}) {
    const gl = this.gl;
    const update = options.update === 'live' ? 'live' : 'static';
    if (!this.lost) this.wallpapers.forEach((entry) => gl.deleteTexture(entry.texture));
    this.wallpapers = images.map((source) => ({
      texture: null,
      source,
      update,
      ready: false,
      width: 0,
      height: 0,
    }));
    this.createWallpaperTextures();
  }

  refreshWallpapers(force = false) {
    if (this.lost) return;
    for (const entry of this.wallpapers) {
      if (force || entry.update === 'live') this.uploadWallpaper(entry);
    }
    this.gl.bindTexture(this.gl.TEXTURE_2D, null);
  }

  mipSize(level) {
    return [Math.max(1, this.w >> level), Math.max(1, this.h >> level)];
  }

  // Renders the backdrop into mip 0 and builds the progressively blurred chain.
  buildBackdrop(scene, zoom = 1) {
    if (this.lost || !this.fbos.length) return;
    const gl = this.gl;
    this.refreshWallpapers();
    gl.bindVertexArray(this.quad);
    gl.disable(gl.BLEND);

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbos[0]);
    gl.viewport(0, 0, this.w, this.h);
    gl.useProgram(this.progWall.p);
    gl.uniform2f(this.progWall.loc.uRes, this.w, this.h);
    gl.uniform1i(this.progWall.loc.uScene, scene);
    gl.uniform1f(this.progWall.loc.uZoom, zoom);
    const wallpaper = this.wallpapers[scene];
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, wallpaper?.ready ? wallpaper.texture : this.fallbackTexture);
    gl.uniform1i(this.progWall.loc.uWallpaper, 1);
    gl.uniform1i(this.progWall.loc.uUseImage, wallpaper?.ready ? 1 : 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    gl.useProgram(this.progDown.p);
    gl.uniform1i(this.progDown.loc.uTex, 0);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    for (let i = 1; i < this.mipLevels; i++) {
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
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAX_LEVEL, this.mipLevels - 1);

    // Seed the coarsest reconstructed level, then walk back toward full
    // resolution with a tent filter. Restricting BASE/MAX_LEVEL keeps sampling
    // a different mip image from the one attached for drawing, avoiding a
    // framebuffer feedback loop while retaining one filterable texture chain.
    const last = this.mipLevels - 1;
    const [lastW, lastH] = this.mipSize(last);
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, this.fbos[last]);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, this.blurFbos[last]);
    gl.blitFramebuffer(
      0, 0, lastW, lastH, 0, 0, lastW, lastH, gl.COLOR_BUFFER_BIT, gl.NEAREST,
    );

    gl.bindVertexArray(this.quad);
    gl.useProgram(this.progUp.p);
    gl.uniform1i(this.progUp.loc.uLow, 0);
    gl.uniform1i(this.progUp.loc.uHigh, 1);
    for (let i = last - 1; i >= 0; i--) {
      const [lowW, lowH] = this.mipSize(i + 1);
      const [dw, dh] = this.mipSize(i);

      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.blurTex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_BASE_LEVEL, i + 1);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAX_LEVEL, i + 1);

      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, this.tex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_BASE_LEVEL, i);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAX_LEVEL, i);

      gl.bindFramebuffer(gl.FRAMEBUFFER, this.blurFbos[i]);
      gl.viewport(0, 0, dw, dh);
      gl.uniform2f(this.progUp.loc.uLowTexel, 1 / lowW, 1 / lowH);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.blurTex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_BASE_LEVEL, 0);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAX_LEVEL, this.mipLevels - 1);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_BASE_LEVEL, 0);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAX_LEVEL, this.mipLevels - 1);
  }

  // Draws the sharp backdrop to the screen.
  drawBackdrop() {
    if (this.lost || !this.tex) return;
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

  // Clears the visible framebuffer while preserving the offscreen backdrop
  // texture. Used when the canvas overlays an existing DOM/canvas backdrop.
  clearOutput() {
    if (this.lost) return;
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.w, this.h);
    gl.disable(gl.BLEND);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
  }

  // elements: {x, y, w, h, shape} in CSS pixels, y measured from the TOP.
  // The group is evaluated as a single smooth-union SDF. This is important:
  // compositing independent glass draws can overlap, but can never produce the
  // shared silhouette and continuous normals of one fused liquid surface.
  drawGlassGroup(elements, m, dpr, mergeRadius = m.mergeRadius ?? 0) {
    if (!elements.length || this.lost || !this.tex) return;

    const gl = this.gl;
    const { loc, p } = this.progGlass;
    const shapes = elements.slice(0, MAX_GLASS_SHAPES);

    const minX = Math.min(...shapes.map((element) => element.x));
    const minY = Math.min(...shapes.map((element) => element.y));
    const maxX = Math.max(...shapes.map((element) => element.x + element.w));
    const maxY = Math.max(...shapes.map((element) => element.y + element.h));
    const groupWidth = maxX - minX;
    const groupHeight = maxY - minY;

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.w, this.h);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.bindVertexArray(this.quad);
    gl.useProgram(p);

    const cx = (minX + groupWidth / 2) * dpr;
    const cy = this.h - (minY + groupHeight / 2) * dpr;
    const hw = (groupWidth / 2) * dpr;
    const hh = (groupHeight / 2) * dpr;
    const centers = new Float32Array(MAX_GLASS_SHAPES * 2);
    const halves = new Float32Array(MAX_GLASS_SHAPES * 2);
    const radii = new Float32Array(MAX_GLASS_SHAPES);
    const types = new Int32Array(MAX_GLASS_SHAPES);

    shapes.forEach((element, i) => {
      const short = Math.min(element.w, element.h);
      centers[i * 2] = (element.x + element.w / 2) * dpr;
      centers[i * 2 + 1] = this.h - (element.y + element.h / 2) * dpr;
      halves[i * 2] = element.w / 2 * dpr;
      halves[i * 2 + 1] = element.h / 2 * dpr;
      radii[i] = Math.min(element.radius ?? m.radius, short * 0.235) * dpr;
      types[i] = element.shape === 'pill' ? 1 : element.shape === 'circle' ? 2 : 0;
    });

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.uniform1i(loc.uSrc, 0);
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, this.blurTex);
    gl.uniform1i(loc.uBlurSrc, 2);
    gl.uniform2f(loc.uRes, this.w, this.h);
    gl.uniform2f(loc.uCenter, cx, cy);
    gl.uniform2f(loc.uHalf, hw, hh);
    gl.uniform1i(loc.uShapeCount, shapes.length);
    gl.uniform2fv(loc.uShapeCenters, centers);
    gl.uniform2fv(loc.uShapeHalves, halves);
    gl.uniform1iv(loc.uShapeTypes, types);
    gl.uniform1fv(loc.uShapeRadii, radii);
    gl.uniform1f(loc.uMergeRadius, Math.max(0, mergeRadius) * dpr);
    gl.uniform1f(loc.uPad, (m.shadowSize * 4 + Math.max(mergeRadius, 0) * 0.3 + 8) * dpr);
    gl.uniform1f(loc.uSquircle, m.squircle);
    gl.uniform1f(loc.uBevel, m.bevel * dpr);
    gl.uniform1f(loc.uHeight, m.height * dpr);
    gl.uniform1f(loc.uSizeAdaptation, m.sizeAdaptation ?? 1);
    gl.uniform1f(loc.uIOR, m.ior);
    gl.uniform1f(loc.uDispersion, m.dispersion);
    gl.uniform1f(loc.uBlurPlateau, m.blurPlateau * dpr);
    gl.uniform1f(loc.uBlurRim, m.blurRim * dpr);
    gl.uniform1f(loc.uOpticalDensity, m.opticalDensity);
    gl.uniform1f(loc.uMips, this.mipLevels);
    gl.uniform1f(loc.uSpecular, m.specular);
    gl.uniform1f(loc.uSpecPower, m.specPower);
    gl.uniform1f(loc.uHighlightAdapt, m.highlightAdapt);
    gl.uniform1f(loc.uHighlightWidth, m.highlightWidth);
    gl.uniform1f(loc.uHighlightSharpness, m.highlightSharpness);
    gl.uniform1f(loc.uHighlightBase, m.highlightBase);
    gl.uniform1f(loc.uFresnel, m.fresnel);
    gl.uniform1f(loc.uSat, m.saturation);
    gl.uniform1f(loc.uBright, m.brightness);
    gl.uniform1f(loc.uTintAmount, m.tintAmount);
    gl.uniform3f(loc.uTintColor, ...m.tintColor);
    gl.uniform1f(loc.uTintAdapt, m.tintAdapt ?? 0);
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

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.disable(gl.BLEND);
  }

  drawGlass(element, m, dpr) {
    this.drawGlassGroup([element], m, dpr, 0);
  }

  // V2 surfaces share V1's public silhouettes and backdrop/mip pipeline, but
  // nothing from the material calculation. In particular, similarly named
  // uniforms are filled using V2's own units: edgeWidth is a fraction,
  // dispersion is a pixel split, and roundness is a short-half ratio.
  drawGlassV2Group(elements, m, dpr, lightDirections = [], tintLights = []) {
    if (!elements.length || this.lost || !this.tex) return;

    const gl = this.gl;
    const { loc, p } = this.progGlass;
    const shapes = elements.slice(0, MAX_GLASS_SHAPES);
    const minX = Math.min(...shapes.map((element) => element.x));
    const minY = Math.min(...shapes.map((element) => element.y));
    const maxX = Math.max(...shapes.map((element) => element.x + element.w));
    const maxY = Math.max(...shapes.map((element) => element.y + element.h));
    const groupWidth = maxX - minX;
    const groupHeight = maxY - minY;

    const centers = new Float32Array(MAX_GLASS_SHAPES * 2);
    const halves = new Float32Array(MAX_GLASS_SHAPES * 2);
    const radii = new Float32Array(MAX_GLASS_SHAPES);
    const types = new Int32Array(MAX_GLASS_SHAPES);
    const lights = new Float32Array(MAX_GLASS_SHAPES * 2);
    const tints = new Float32Array(MAX_GLASS_SHAPES);
    const tintTones = new Float32Array(MAX_GLASS_SHAPES);
    shapes.forEach((element, i) => {
      const short = Math.min(element.w, element.h);
      centers[i * 2] = (element.x + element.w / 2) * dpr;
      centers[i * 2 + 1] = this.h - (element.y + element.h / 2) * dpr;
      halves[i * 2] = element.w / 2 * dpr;
      halves[i * 2 + 1] = element.h / 2 * dpr;
      radii[i] = short * 0.5 * m.roundness * dpr;
      types[i] = element.shape === 'pill' ? 1
        : element.shape === 'circle' ? 2 : 0;
      const direction = lightDirections[i] ?? [Math.SQRT1_2, Math.SQRT1_2];
      lights[i * 2] = direction[0];
      lights[i * 2 + 1] = direction[1];
      tints[i] = element.tint ?? m.tint;
      tintTones[i] = tintLights[i] ?? 1;
    });

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.w, this.h);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.bindVertexArray(this.quad);
    gl.useProgram(p);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.uniform1i(loc.uSrc, 0);
    gl.uniform2f(loc.uRes, this.w, this.h);
    gl.uniform1f(loc.uDpr, dpr);
    gl.uniform2f(loc.uCenter,
      (minX + groupWidth / 2) * dpr,
      this.h - (minY + groupHeight / 2) * dpr);
    gl.uniform2f(loc.uHalf, groupWidth / 2 * dpr, groupHeight / 2 * dpr);
    gl.uniform1f(loc.uPad, 4 * dpr);
    gl.uniform1f(loc.uMips, this.mipLevels);
    gl.uniform1i(loc.uShapeCount, shapes.length);
    gl.uniform2fv(loc.uShapeCenters, centers);
    gl.uniform2fv(loc.uShapeHalves, halves);
    gl.uniform1iv(loc.uShapeTypes, types);
    gl.uniform1fv(loc.uShapeRadii, radii);
    gl.uniform1fv(loc.uShapeTints, tints);
    gl.uniform1fv(loc.uShapeTintLights, tintTones);
    gl.uniform2fv(loc.uLightDirs, lights);
    gl.uniform1f(loc.uRefraction, m.refraction * dpr);
    gl.uniform1f(loc.uEdgeReach, m.edgeReach * dpr);
    gl.uniform1f(loc.uEdgeWidth, m.edgeWidth);
    gl.uniform1f(loc.uDispersion, m.dispersion);
    gl.uniform1f(loc.uFrost, m.frost * dpr);
    gl.uniform1f(loc.uBody, m.body);
    gl.uniform1f(loc.uAbsorption, m.absorption);
    gl.uniform1f(loc.uRim, m.rim);
    gl.uniform1f(loc.uReflection, m.reflection);
    gl.uniform1f(loc.uHighlight, m.highlight);
    gl.uniform1f(loc.uEcho, m.echo);
    gl.uniform1f(loc.uHairline, m.hairline);
    gl.uniform1f(loc.uHairWidth, m.hairWidth);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.disable(gl.BLEND);
  }

  destroy() {
    if (this.lost) {
      this.wallpapers = [];
      return;
    }
    const gl = this.gl;
    this.releaseTargets();
    this.releaseResources();
    this.wallpapers.forEach((entry) => gl.deleteTexture(entry.texture));
    this.wallpapers = [];
  }
}
