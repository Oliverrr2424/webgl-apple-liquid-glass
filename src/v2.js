import { GlassRenderer } from './renderer.js';
import { MAX_GLASS_SHAPES } from './geometry.js';
import {
  DEFAULT_MATERIAL_V2, REDUCED_TRANSPARENCY_MATERIAL_V2, SLIDERS_V2,
  getDefaultMaterialV2, makeMaterialV2,
} from './v2-material.js';
import { distanceToElementsV2, hitTestElementsV2 } from './v2-geometry.js';

const SHAPES = new Set(['folder', 'rect', 'pill', 'circle']);
const COMPOSITE_MODES = new Set(['replace', 'overlay']);
const BACKDROP_UPDATES = new Set(['auto', 'static', 'live']);
const REDUCED_TRANSPARENCY_QUERY = '(prefers-reduced-transparency: reduce)';

function normalizeCompositeMode(mode) {
  if (!COMPOSITE_MODES.has(mode)) throw new TypeError(`Unknown liquid glass V2 composite mode: ${mode}`);
  return mode;
}

function normalizeShape(shape) {
  const normalized = shape === 'folderRect' ? 'rect' : shape;
  if (!SHAPES.has(normalized)) throw new TypeError(`Unknown liquid glass V2 shape: ${shape}`);
  return normalized;
}

function normalizeElement(input, index) {
  const width = Number(input.w ?? input.width ?? input.size ?? 0);
  const height = Number(input.h ?? input.height ?? input.size ?? width);
  if (!(width > 0) || !(height > 0)) {
    throw new TypeError('Liquid glass V2 elements need a positive width and height.');
  }
  return {
    ...input,
    id: input.id ?? `glass-v2-${index + 1}`,
    shape: normalizeShape(input.shape ?? 'rect'),
    x: Number(input.x ?? 0),
    y: Number(input.y ?? 0),
    w: width,
    h: height,
  };
}

function resolveImage(source) {
  if (typeof source !== 'string') return Promise.resolve(source);
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Unable to load liquid glass V2 wallpaper: ${source}`));
    image.src = source;
  });
}

function isLiveBackdropSource(source) {
  const tagName = source?.tagName?.toUpperCase();
  return tagName === 'CANVAS' || tagName === 'VIDEO'
    || source?.constructor?.name === 'OffscreenCanvas'
    || source?.constructor?.name === 'VideoFrame';
}

function resolveBackdropUpdate(source, update = 'auto') {
  if (!BACKDROP_UPDATES.has(update)) {
    throw new TypeError(`Unknown liquid glass V2 backdrop update mode: ${update}`);
  }
  return update === 'auto' ? (isLiveBackdropSource(source) ? 'live' : 'static') : update;
}

function matchMediaSafe(query) {
  return typeof globalThis.matchMedia === 'function' ? globalThis.matchMedia(query) : null;
}

/**
 * Clear optical Liquid Glass V2.
 *
 * This is a separate public class, not a mode on LiquidGlassWebGL. Its material
 * values are never converted from V1. It intentionally shares V1's public
 * shape silhouettes while refraction, chromatic split, tint and interface
 * lighting continue to follow the independent V2 equations.
 */
export class LiquidGlassWebGLV2 {
  static isSupported() {
    if (typeof document === 'undefined') return false;
    try {
      const probe = document.createElement('canvas');
      const gl = probe.getContext('webgl2');
      if (!gl) return false;
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return true;
    } catch {
      return false;
    }
  }

  constructor(canvas, options = {}) {
    if (!canvas || typeof canvas.getContext !== 'function') {
      throw new TypeError('LiquidGlassWebGLV2 needs an HTMLCanvasElement.');
    }
    this.canvas = canvas;
    this.version = 'v2';
    this.compositeMode = normalizeCompositeMode(options.compositeMode ?? 'replace');
    this.renderer = new GlassRenderer(canvas, {
      alpha: this.compositeMode === 'overlay',
      preserveDrawingBuffer: Boolean(options.preserveDrawingBuffer),
      materialVersion: 2,
    });
    this.material = makeMaterialV2(options.material);
    this.elements = [];
    this.backdrops = [];
    this.wallpaperIndex = 0;
    this.wallpaperZoom = options.wallpaperZoom ?? 1;
    this.running = false;
    this.animationFrame = 0;
    this.dirty = true;
    this.backdropDirty = true;
    this.lightFieldDirty = true;
    this.lastFrame = { width: 0, height: 0, dpr: 0 };
    this.warnedShapeLimit = false;
    this.lightCanvas = null;
    this.lightPixels = null;
    this.lightSampleSize = 64;
    this.smoothedLightDirections = new Map();
    this.lastLightFieldUpdate = 0;
    this.lastLightBlendTime = 0;
    this.onContextLost = options.onContextLost ?? null;
    this.onContextRestored = options.onContextRestored ?? null;

    this.respectReducedTransparency = options.respectReducedTransparency ?? true;
    this.reducedTransparencyQuery = this.respectReducedTransparency
      ? matchMediaSafe(REDUCED_TRANSPARENCY_QUERY) : null;
    this.handleReducedTransparencyChange = () => {
      this.markDirty();
      this.render();
    };
    this.reducedTransparencyQuery?.addEventListener?.('change', this.handleReducedTransparencyChange);

    this.handleContextLost = (event) => {
      event.preventDefault();
      this.renderer.handleContextLost();
      this.markBackdropDirty();
      this.onContextLost?.(event);
    };
    this.handleContextRestored = (event) => {
      this.renderer.restore();
      this.markBackdropDirty();
      this.lastFrame = { width: 0, height: 0, dpr: 0 };
      this.onContextRestored?.(event);
      this.render();
    };
    canvas.addEventListener('webglcontextlost', this.handleContextLost, false);
    canvas.addEventListener('webglcontextrestored', this.handleContextRestored, false);

    this.resizeObserver = null;
    if ((options.autoResize ?? true) && typeof globalThis.ResizeObserver === 'function') {
      this.resizeObserver = new globalThis.ResizeObserver(() => {
        this.lightFieldDirty = true;
        this.markDirty();
        this.render();
      });
      this.resizeObserver.observe(canvas);
    }

    if (options.elements) this.setElements(options.elements, false);
    if (options.wallpapers) this.setWallpapers(options.wallpapers, false);
    if (options.backdrop) {
      this.setBackdrop(options.backdrop, {
        update: options.backdropUpdate,
        autoStart: options.autoStart,
        shouldRender: false,
      });
    }
  }

  get contextLost() { return this.renderer.lost; }
  get reducedTransparency() { return Boolean(this.reducedTransparencyQuery?.matches); }
  get effectiveMaterial() {
    return this.reducedTransparency
      ? { ...this.material, ...REDUCED_TRANSPARENCY_MATERIAL_V2 }
      : this.material;
  }

  markDirty() {
    this.dirty = true;
    return this;
  }

  markBackdropDirty() {
    this.backdropDirty = true;
    this.lightFieldDirty = true;
    this.lastLightFieldUpdate = 0;
    this.smoothedLightDirections.clear();
    return this.markDirty();
  }

  setElements(elements, shouldRender = true) {
    this.elements = elements.map((element, index) => normalizeElement(element, index));
    this.markDirty();
    if (shouldRender) this.render();
    return this;
  }

  addElement(element, shouldRender = true) {
    const normalized = normalizeElement(element, this.elements.length);
    this.elements.push(normalized);
    this.markDirty();
    if (shouldRender) this.render();
    return normalized.id;
  }

  updateElement(id, patch, shouldRender = true) {
    const index = this.elements.findIndex((element) => element.id === id);
    if (index === -1) return this;
    this.elements[index] = normalizeElement({ ...this.elements[index], ...patch }, index);
    this.markDirty();
    if (shouldRender) this.render();
    return this;
  }

  removeElement(id, shouldRender = true) {
    this.elements = this.elements.filter((element) => element.id !== id);
    this.markDirty();
    if (shouldRender) this.render();
    return this;
  }

  setMaterial(material, shouldRender = true) {
    if (typeof material === 'string') {
      throw new TypeError('Liquid Glass V2 does not convert V1 preset names. Pass a V2 material object.');
    }
    this.material = makeMaterialV2({ ...this.material, ...(material || {}) });
    this.markDirty();
    if (shouldRender) this.render();
    return this;
  }

  setWallpapers(images, shouldRender = true) {
    this.backdrops = images.slice();
    this.renderer.setWallpapers(images, { update: 'static' });
    this.markBackdropDirty();
    if (shouldRender) this.render();
    return this;
  }

  async loadWallpapers(sources, shouldRender = true) {
    const images = await Promise.all(sources.map(resolveImage));
    return this.setWallpapers(images, shouldRender);
  }

  async setWallpaper(source, shouldRender = true) {
    return this.loadWallpapers([source], shouldRender);
  }

  setBackdrop(source, options = {}) {
    if (!source || typeof source === 'string') {
      throw new TypeError('setBackdrop needs a CanvasImageSource. Use loadBackdrop for a URL.');
    }
    const update = resolveBackdropUpdate(source, options.update);
    this.backdrops = [source];
    this.renderer.setWallpapers([source], { update });
    this.wallpaperIndex = 0;
    this.markBackdropDirty();
    if (options.autoStart ?? update === 'live') this.start();
    if (options.shouldRender ?? true) this.render();
    return this;
  }

  async loadBackdrop(source, options = {}) {
    const image = await resolveImage(source);
    return this.setBackdrop(image, { ...options, update: options.update ?? 'static' });
  }

  updateBackdrop(shouldRender = true) {
    this.renderer.refreshWallpapers(true);
    this.markBackdropDirty();
    if (shouldRender) this.render();
    return this;
  }

  setWallpaperIndex(index, shouldRender = true) {
    this.wallpaperIndex = Math.max(0, Math.floor(index));
    this.markBackdropDirty();
    if (shouldRender) this.render();
    return this;
  }

  distanceAt(x, y) {
    return distanceToElementsV2(x, y, this.elements, this.material);
  }

  hitTest(x, y, options = {}) {
    return hitTestElementsV2(x, y, this.elements, this.material, options);
  }

  pointerPosition(event) {
    const rect = this.canvas.getBoundingClientRect();
    const source = event.touches?.[0] ?? event.changedTouches?.[0] ?? event;
    return { x: source.clientX - rect.left, y: source.clientY - rect.top };
  }

  hitTestEvent(event, options = {}) {
    const { x, y } = this.pointerPosition(event);
    const tolerance = options.tolerance
      ?? (event.pointerType && event.pointerType !== 'mouse' ? 8 : 0);
    return this.hitTest(x, y, { ...options, tolerance });
  }

  start() {
    if (this.running) return this;
    if (typeof globalThis.requestAnimationFrame !== 'function') {
      throw new Error('LiquidGlassWebGLV2.start() requires requestAnimationFrame.');
    }
    this.running = true;
    const tick = () => {
      if (!this.running) return;
      this.render();
      this.animationFrame = globalThis.requestAnimationFrame(tick);
    };
    this.animationFrame = globalThis.requestAnimationFrame(tick);
    return this;
  }

  stop() {
    this.running = false;
    if (this.animationFrame && typeof globalThis.cancelAnimationFrame === 'function') {
      globalThis.cancelAnimationFrame(this.animationFrame);
    }
    this.animationFrame = 0;
    return this;
  }

  resize(width = this.canvas.clientWidth || this.canvas.width || 1,
         height = this.canvas.clientHeight || this.canvas.height || 1,
         dpr = Math.min(globalThis.devicePixelRatio || 1, 2)) {
    this.renderer.resize(Math.round(width * dpr), Math.round(height * dpr));
    return { width, height, dpr };
  }

  updateLightField() {
    this.lightFieldDirty = false;
    const source = this.backdrops[this.wallpaperIndex];
    const sourceWidth = Number(source?.videoWidth || source?.naturalWidth || source?.width || 0);
    const sourceHeight = Number(source?.videoHeight || source?.naturalHeight || source?.height || 0);
    if (!(sourceWidth > 0) || !(sourceHeight > 0) || typeof document === 'undefined') {
      this.lightPixels = null;
      return;
    }
    if (!this.lightCanvas) this.lightCanvas = document.createElement('canvas');
    const size = this.lightSampleSize;
    this.lightCanvas.width = size;
    this.lightCanvas.height = size;
    const context = this.lightCanvas.getContext('2d', { willReadFrequently: true });
    if (!context) { this.lightPixels = null; return; }
    context.clearRect(0, 0, size, size);
    const scale = Math.max(size / sourceWidth, size / sourceHeight) * this.wallpaperZoom;
    const drawWidth = sourceWidth * scale;
    const drawHeight = sourceHeight * scale;
    try {
      context.drawImage(source, (size - drawWidth) / 2, (size - drawHeight) / 2,
        drawWidth, drawHeight);
      this.lightPixels = context.getImageData(0, 0, size, size).data;
    } catch {
      // A cross-origin source can still be WebGL-sampleable with CORS while a
      // browser refuses Canvas2D readback. The deterministic angle remains a
      // complete fallback in that case.
      this.lightPixels = null;
    }
  }

  sampleLuminance(x, y) {
    if (!this.lightPixels) return 0.5;
    const size = this.lightSampleSize;
    const px = Math.max(0, Math.min(size - 1, Math.round(x * (size - 1))));
    const py = Math.max(0, Math.min(size - 1, Math.round(y * (size - 1))));
    const index = (py * size + px) * 4;
    return (this.lightPixels[index] * 0.2126
      + this.lightPixels[index + 1] * 0.7152
      + this.lightPixels[index + 2] * 0.0722) / 255;
  }

  lightDirection(element, width, height, fallbackAngle) {
    const positions = [-0.34, 0, 0.34];
    let gradientX = 0;
    let gradientY = 0;
    for (const sampleY of positions) {
      for (const sampleX of positions) {
        const x = (element.x + element.w * (0.5 + sampleX)) / Math.max(width, 1);
        const y = (element.y + element.h * (0.5 + sampleY)) / Math.max(height, 1);
        const light = this.sampleLuminance(x, y);
        gradientX += sampleX * light;
        gradientY += sampleY * light;
      }
    }
    const radians = fallbackAngle * Math.PI / 180;
    const fallbackX = Math.cos(radians);
    const fallbackY = Math.sin(radians);
    const contrast = Math.hypot(gradientX, gradientY) / positions.length;
    if (contrast < 0.008) return [fallbackX, fallbackY];

    const length = Math.hypot(gradientX, gradientY) || 1;
    const autoX = -gradientX / length;
    const autoY = gradientY / length;
    const rawStrength = Math.max(0, Math.min(1, (contrast - 0.015) / 0.13));
    // Keep the environment influential without allowing a moving high-contrast
    // edge to rotate the key light almost 180 degrees from one sample to the next.
    const strength = rawStrength * rawStrength * (3 - 2 * rawStrength) * 0.58;
    const mixedX = fallbackX * (1 - strength) + autoX * strength;
    const mixedY = fallbackY * (1 - strength) + autoY * strength;
    const mixedLength = Math.hypot(mixedX, mixedY) || 1;
    return [mixedX / mixedLength, mixedY / mixedLength];
  }

  render(options = {}) {
    if (this.renderer.lost) return this;
    const width = this.canvas.clientWidth || this.canvas.width || 1;
    const height = this.canvas.clientHeight || this.canvas.height || 1;
    const dpr = Math.min(globalThis.devicePixelRatio || 1, 2);
    const resized = width !== this.lastFrame.width || height !== this.lastFrame.height
      || dpr !== this.lastFrame.dpr;
    const liveBackdrop = this.renderer.hasLiveBackdrop();
    if (!options.force && !this.dirty && !resized && !liveBackdrop) return this;

    this.resize(width, height, dpr);
    const now = globalThis.performance?.now?.() ?? Date.now();
    if (this.backdropDirty || resized || liveBackdrop) {
      this.renderer.buildBackdrop(this.wallpaperIndex, this.wallpaperZoom);
      // The optical backdrop remains fully live, but the low-resolution light
      // probe runs at a steadier cadence. This decouples moving content from the
      // white key highlight and removes single-frame direction spikes.
      const refreshLiveLight = liveBackdrop && now - this.lastLightFieldUpdate >= 84;
      if (this.lightFieldDirty || resized || refreshLiveLight) {
        this.updateLightField();
        this.lastLightFieldUpdate = now;
      }
      this.backdropDirty = false;
    }
    if (this.compositeMode === 'overlay') this.renderer.clearOutput();
    else this.renderer.drawBackdrop();

    const material = this.effectiveMaterial;
    const elapsed = this.lastLightBlendTime ? Math.min(100, now - this.lastLightBlendTime) : 100;
    const blend = liveBackdrop ? 1 - Math.exp(-elapsed / 280) : 1;
    const activeLightIds = new Set(this.elements.map((element) => element.id));
    for (const id of this.smoothedLightDirections.keys()) {
      if (!activeLightIds.has(id)) this.smoothedLightDirections.delete(id);
    }
    const lightDirections = this.elements.map((element) => {
      const target = this.lightDirection(element, width, height, material.lightAngle);
      const previous = this.smoothedLightDirections.get(element.id);
      if (!previous || blend >= 1) {
        this.smoothedLightDirections.set(element.id, target);
        return target;
      }
      const mixedX = previous[0] * (1 - blend) + target[0] * blend;
      const mixedY = previous[1] * (1 - blend) + target[1] * blend;
      const length = Math.hypot(mixedX, mixedY) || 1;
      const direction = [mixedX / length, mixedY / length];
      this.smoothedLightDirections.set(element.id, direction);
      return direction;
    });
    this.lastLightBlendTime = now;
    if (this.elements.length > MAX_GLASS_SHAPES && !this.warnedShapeLimit) {
      this.warnedShapeLimit = true;
      console.warn(`LiquidGlassWebGLV2: more than ${MAX_GLASS_SHAPES} shapes require multiple passes; overlapping shapes across a pass boundary may composite differently.`);
    }
    for (let i = 0; i < this.elements.length; i += MAX_GLASS_SHAPES) {
      this.renderer.drawGlassV2Group(
        this.elements.slice(i, i + MAX_GLASS_SHAPES),
        material,
        dpr,
        lightDirections.slice(i, i + MAX_GLASS_SHAPES),
      );
    }

    this.dirty = false;
    this.lastFrame = { width, height, dpr };
    return this;
  }

  destroy() {
    this.stop();
    this.canvas.removeEventListener('webglcontextlost', this.handleContextLost, false);
    this.canvas.removeEventListener('webglcontextrestored', this.handleContextRestored, false);
    this.reducedTransparencyQuery?.removeEventListener?.('change', this.handleReducedTransparencyChange);
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    this.renderer.destroy();
    this.elements = [];
    this.backdrops = [];
    this.lightPixels = null;
    this.lightCanvas = null;
    this.smoothedLightDirections.clear();
  }
}

export {
  DEFAULT_MATERIAL_V2, REDUCED_TRANSPARENCY_MATERIAL_V2, SLIDERS_V2,
  getDefaultMaterialV2, makeMaterialV2,
  distanceToElementsV2, hitTestElementsV2,
};
