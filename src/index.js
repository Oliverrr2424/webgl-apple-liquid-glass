import { GlassRenderer } from './renderer.js';
import { DEFAULT_MATERIAL, PRESETS, getDefaultMaterial, makeMaterial } from './material.js';

export const SHAPES = Object.freeze({
  FOLDER: 'folder',
  RECT: 'rect',
  PILL: 'pill',
  CIRCLE: 'circle',
});

export const COMPOSITE_MODES = Object.freeze({
  REPLACE: 'replace',
  OVERLAY: 'overlay',
});

export const BACKDROP_UPDATES = Object.freeze({
  AUTO: 'auto',
  STATIC: 'static',
  LIVE: 'live',
});

function normalizeCompositeMode(mode) {
  if (!Object.values(COMPOSITE_MODES).includes(mode)) {
    throw new TypeError(`Unknown liquid glass composite mode: ${mode}`);
  }
  return mode;
}

function isLiveBackdropSource(source) {
  const tagName = source?.tagName?.toUpperCase();
  return tagName === 'CANVAS'
    || tagName === 'VIDEO'
    || source?.constructor?.name === 'OffscreenCanvas'
    || source?.constructor?.name === 'VideoFrame';
}

function resolveBackdropUpdate(source, update = BACKDROP_UPDATES.AUTO) {
  if (!Object.values(BACKDROP_UPDATES).includes(update)) {
    throw new TypeError(`Unknown liquid glass backdrop update mode: ${update}`);
  }
  return update === BACKDROP_UPDATES.AUTO
    ? (isLiveBackdropSource(source) ? BACKDROP_UPDATES.LIVE : BACKDROP_UPDATES.STATIC)
    : update;
}

function normalizeShape(shape) {
  const normalized = shape === 'folderRect' ? SHAPES.RECT : shape;
  if (!Object.values(SHAPES).includes(normalized)) {
    throw new TypeError(`Unknown liquid glass shape: ${shape}`);
  }
  return normalized;
}

function resolveImage(source) {
  if (typeof source !== 'string') return Promise.resolve(source);
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Unable to load liquid glass wallpaper: ${source}`));
    image.src = source;
  });
}

function normalizeElement(input, index) {
  const width = Number(input.w ?? input.width ?? input.size ?? 0);
  const height = Number(input.h ?? input.height ?? input.size ?? width);
  if (!(width > 0) || !(height > 0)) {
    throw new TypeError('Liquid glass elements need a positive width and height.');
  }
  return {
    ...input,
    id: input.id ?? `glass-${index + 1}`,
    shape: normalizeShape(input.shape ?? SHAPES.FOLDER),
    x: Number(input.x ?? 0),
    y: Number(input.y ?? 0),
    w: width,
    h: height,
  };
}

/**
 * A small, framework-free WebGL2 component for Apple-inspired liquid glass.
 * Coordinates and dimensions are CSS pixels relative to the supplied canvas.
 */
export class LiquidGlassWebGL {
  constructor(canvas, options = {}) {
    if (!canvas || typeof canvas.getContext !== 'function') {
      throw new TypeError('LiquidGlassWebGL needs an HTMLCanvasElement.');
    }
    this.canvas = canvas;
    this.compositeMode = normalizeCompositeMode(options.compositeMode ?? COMPOSITE_MODES.REPLACE);
    this.renderer = new GlassRenderer(canvas, {
      alpha: this.compositeMode === COMPOSITE_MODES.OVERLAY,
    });
    this.material = typeof options.material === 'string'
      ? makeMaterial(options.material)
      : { ...makeMaterial('regular'), ...(options.material || {}) };
    this.elements = [];
    this.fusion = Boolean(options.fusion ?? false);
    this.wallpaperIndex = 0;
    this.wallpaperZoom = options.wallpaperZoom ?? 1;
    this.running = false;
    this.animationFrame = 0;
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

  setElements(elements, shouldRender = true) {
    this.elements = elements.map((element, index) => normalizeElement(element, index));
    if (shouldRender) this.render();
    return this;
  }

  addElement(element, shouldRender = true) {
    const normalized = normalizeElement(element, this.elements.length);
    this.elements.push(normalized);
    if (shouldRender) this.render();
    return normalized.id;
  }

  updateElement(id, patch, shouldRender = true) {
    const index = this.elements.findIndex((element) => element.id === id);
    if (index === -1) return this;
    this.elements[index] = normalizeElement({ ...this.elements[index], ...patch }, index);
    if (shouldRender) this.render();
    return this;
  }

  removeElement(id, shouldRender = true) {
    this.elements = this.elements.filter((element) => element.id !== id);
    if (shouldRender) this.render();
    return this;
  }

  setMaterial(materialOrPreset, shouldRender = true) {
    this.material = typeof materialOrPreset === 'string'
      ? makeMaterial(materialOrPreset)
      : { ...this.material, ...(materialOrPreset || {}) };
    if (shouldRender) this.render();
    return this;
  }

  setFusion(enabled, mergeRadius = this.material.mergeRadius, shouldRender = true) {
    this.fusion = Boolean(enabled);
    if (Number.isFinite(mergeRadius)) this.material.mergeRadius = Math.max(0, mergeRadius);
    if (shouldRender) this.render();
    return this;
  }

  setWallpapers(images, shouldRender = true) {
    this.renderer.setWallpapers(images, { update: BACKDROP_UPDATES.STATIC });
    if (shouldRender) this.render();
    return this;
  }

  /**
   * Use an image, canvas, video, ImageBitmap, or OffscreenCanvas as the
   * backdrop sampled by the glass. Canvas/video sources default to live mode.
   */
  setBackdrop(source, options = {}) {
    if (!source || typeof source === 'string') {
      throw new TypeError('setBackdrop needs a CanvasImageSource. Use loadBackdrop for a URL.');
    }
    const update = resolveBackdropUpdate(source, options.update);
    this.renderer.setWallpapers([source], { update });
    this.wallpaperIndex = 0;
    if (options.autoStart ?? update === BACKDROP_UPDATES.LIVE) this.start();
    if (options.shouldRender ?? true) this.render();
    return this;
  }

  async loadBackdrop(source, options = {}) {
    const image = await resolveImage(source);
    return this.setBackdrop(image, {
      ...options,
      update: options.update ?? BACKDROP_UPDATES.STATIC,
    });
  }

  updateBackdrop(shouldRender = true) {
    this.renderer.refreshWallpapers(true);
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

  setWallpaperIndex(index, shouldRender = true) {
    this.wallpaperIndex = Math.max(0, Math.floor(index));
    if (shouldRender) this.render();
    return this;
  }

  start() {
    if (this.running) return this;
    if (typeof globalThis.requestAnimationFrame !== 'function') {
      throw new Error('LiquidGlassWebGL.start() requires requestAnimationFrame.');
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

  render() {
    const width = this.canvas.clientWidth || this.canvas.width || 1;
    const height = this.canvas.clientHeight || this.canvas.height || 1;
    const { dpr } = this.resize(width, height);
    this.renderer.buildBackdrop(this.wallpaperIndex, this.wallpaperZoom);
    if (this.compositeMode === COMPOSITE_MODES.OVERLAY) {
      this.renderer.clearOutput();
    } else {
      this.renderer.drawBackdrop();
    }
    if (this.fusion) {
      this.renderer.drawGlassGroup(this.elements, this.material, dpr);
    } else {
      for (const element of this.elements) {
        this.renderer.drawGlass(element, this.material, dpr);
      }
    }
    return this;
  }

  destroy() {
    this.stop();
    this.renderer.destroy();
    this.elements = [];
  }
}

export { DEFAULT_MATERIAL, PRESETS, getDefaultMaterial, makeMaterial };
