import { GlassRenderer, MIPS } from './renderer.js';
import {
  DEFAULT_MATERIAL, PRESETS, REDUCED_TRANSPARENCY_MATERIAL,
  getDefaultMaterial, makeMaterial,
} from './material.js';
import {
  MAX_GLASS_SHAPES, connectedElementGroups, groupElements, hitTestElements, sdGroup,
  sdRenderedGroups,
} from './geometry.js';

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

const REDUCED_TRANSPARENCY_QUERY = '(prefers-reduced-transparency: reduce)';

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

function matchMediaSafe(query) {
  return typeof globalThis.matchMedia === 'function' ? globalThis.matchMedia(query) : null;
}

/**
 * A small, framework-free WebGL2 component for Apple-inspired liquid glass.
 * Coordinates and dimensions are CSS pixels relative to the supplied canvas.
 */
export class LiquidGlassWebGL {
  /**
   * Whether this environment can run the component, so callers can fall back to
   * a CSS surface without catching a constructor throw. The probe canvas is
   * discarded immediately.
   */
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
      throw new TypeError('LiquidGlassWebGL needs an HTMLCanvasElement.');
    }
    this.canvas = canvas;
    this.compositeMode = normalizeCompositeMode(options.compositeMode ?? COMPOSITE_MODES.REPLACE);
    this.renderer = new GlassRenderer(canvas, {
      alpha: this.compositeMode === COMPOSITE_MODES.OVERLAY,
      preserveDrawingBuffer: Boolean(options.preserveDrawingBuffer),
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
    this.onContextLost = options.onContextLost ?? null;
    this.onContextRestored = options.onContextRestored ?? null;

    // Nothing has been drawn yet, and every mutator sets this again. render()
    // is free to return early whenever the frame would be identical.
    this.dirty = true;
    this.backdropDirty = true;
    this.lastFrame = { width: 0, height: 0, dpr: 0 };
    this.warnedShapeLimit = false;

    this.respectReducedTransparency = options.respectReducedTransparency ?? true;
    this.reducedTransparencyQuery = this.respectReducedTransparency
      ? matchMediaSafe(REDUCED_TRANSPARENCY_QUERY)
      : null;
    this.handleReducedTransparencyChange = () => {
      this.markDirty();
      this.render();
    };
    this.reducedTransparencyQuery?.addEventListener?.('change', this.handleReducedTransparencyChange);

    // A lost context leaves the canvas frozen unless the default is prevented,
    // and the browser only fires `restored` for handlers that opted in.
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

    // Dirty tracking means a CSS-driven resize would otherwise go unnoticed by
    // apps that render on demand instead of in a loop.
    this.resizeObserver = null;
    if ((options.autoResize ?? true) && typeof globalThis.ResizeObserver === 'function') {
      this.resizeObserver = new globalThis.ResizeObserver(() => {
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

  /** True while the GPU context is gone; the surface holds its last frame. */
  get contextLost() {
    return this.renderer.lost;
  }

  /** True while the user has asked the platform to reduce transparency. */
  get reducedTransparency() {
    return Boolean(this.reducedTransparencyQuery?.matches);
  }

  /**
   * The material actually handed to the shader. Identical to `material` unless
   * reduced transparency is active.
   */
  get effectiveMaterial() {
    return this.reducedTransparency
      ? { ...this.material, ...REDUCED_TRANSPARENCY_MATERIAL }
      : this.material;
  }

  /** Marks the next `render()` as necessary. Every mutator calls this. */
  markDirty() {
    this.dirty = true;
    return this;
  }

  /** Marks both the sampled backdrop mip chain and the visible frame dirty. */
  markBackdropDirty() {
    this.backdropDirty = true;
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

  setMaterial(materialOrPreset, shouldRender = true) {
    this.material = typeof materialOrPreset === 'string'
      ? makeMaterial(materialOrPreset)
      : { ...this.material, ...(materialOrPreset || {}) };
    this.markDirty();
    if (shouldRender) this.render();
    return this;
  }

  setFusion(enabled, mergeRadius = this.material.mergeRadius, shouldRender = true) {
    this.fusion = Boolean(enabled);
    if (Number.isFinite(mergeRadius)) this.material.mergeRadius = Math.max(0, mergeRadius);
    this.markDirty();
    if (shouldRender) this.render();
    return this;
  }

  setWallpapers(images, shouldRender = true) {
    this.renderer.setWallpapers(images, { update: BACKDROP_UPDATES.STATIC });
    this.markBackdropDirty();
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
    this.markBackdropDirty();
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

  setWallpaperIndex(index, shouldRender = true) {
    this.wallpaperIndex = Math.max(0, Math.floor(index));
    this.markBackdropDirty();
    if (shouldRender) this.render();
    return this;
  }

  /**
   * Signed distance from a point to the fused glass surface, in CSS pixels
   * relative to the canvas. Negative inside, positive outside.
   */
  distanceAt(x, y, options = {}) {
    const mergeRadius = (options.fusion ?? this.fusion)
      ? (options.mergeRadius ?? this.material.mergeRadius)
      : 0;
    return sdRenderedGroups(x, y, this.elements, this.material, mergeRadius);
  }

  /**
   * The element under a point, or `null` outside the surface. This evaluates
   * the same signed distance field as the shader, so circles, capsules and
   * squircle corners are respected instead of their bounding boxes, and in
   * fusion mode the bridges between components are hittable too.
   */
  hitTest(x, y, options = {}) {
    return hitTestElements(x, y, this.elements, this.material, {
      fusion: options.fusion ?? this.fusion,
      mergeRadius: options.mergeRadius,
      tolerance: options.tolerance ?? 0,
    });
  }

  /** Canvas-relative CSS pixel position of a pointer/mouse/touch event. */
  pointerPosition(event) {
    const rect = this.canvas.getBoundingClientRect();
    const source = event.touches?.[0] ?? event.changedTouches?.[0] ?? event;
    return { x: source.clientX - rect.left, y: source.clientY - rect.top };
  }

  /** `hitTest` for a pointer event, with a larger tolerance for coarse input. */
  hitTestEvent(event, options = {}) {
    const { x, y } = this.pointerPosition(event);
    const tolerance = options.tolerance
      ?? (event.pointerType && event.pointerType !== 'mouse' ? 8 : 0);
    return this.hitTest(x, y, { ...options, tolerance });
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

  /**
   * Draws a frame. Returns without touching the GPU when nothing changed since
   * the last frame, so an animation loop over a static scene costs nothing.
   * Pass `{ force: true }` to redraw regardless, which is what a read-back of
   * the drawing buffer needs.
   */
  render(options = {}) {
    if (this.renderer.lost) return this;
    const width = this.canvas.clientWidth || this.canvas.width || 1;
    const height = this.canvas.clientHeight || this.canvas.height || 1;
    const dpr = Math.min(globalThis.devicePixelRatio || 1, 2);
    const resized = width !== this.lastFrame.width
      || height !== this.lastFrame.height
      || dpr !== this.lastFrame.dpr;

    if (!options.force && !this.dirty && !resized && !this.renderer.hasLiveBackdrop()) {
      return this;
    }

    const liveBackdrop = this.renderer.hasLiveBackdrop();
    this.resize(width, height, dpr);
    if (this.backdropDirty || resized || liveBackdrop) {
      this.renderer.buildBackdrop(this.wallpaperIndex, this.wallpaperZoom);
      this.backdropDirty = false;
    }
    if (this.compositeMode === COMPOSITE_MODES.OVERLAY) {
      this.renderer.clearOutput();
    } else {
      this.renderer.drawBackdrop();
    }

    const material = this.effectiveMaterial;
    if (this.fusion) {
      const { groups, truncated } = groupElements(
        this.elements, material.mergeRadius, MAX_GLASS_SHAPES,
      );
      if (truncated && !this.warnedShapeLimit) {
        this.warnedShapeLimit = true;
        console.warn(
          `LiquidGlassWebGL: more than ${MAX_GLASS_SHAPES} fused shapes are within `
          + 'merging distance of each other. They are drawn in separate passes, so the '
          + 'silhouette will not bridge across every one of them.',
        );
      }
      for (const group of groups) {
        this.renderer.drawGlassGroup(group, material, dpr, material.mergeRadius);
      }
    } else {
      for (const element of this.elements) {
        this.renderer.drawGlass(element, material, dpr);
      }
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
  }
}

export {
  DEFAULT_MATERIAL, PRESETS, REDUCED_TRANSPARENCY_MATERIAL, getDefaultMaterial, makeMaterial,
  MAX_GLASS_SHAPES, MIPS, connectedElementGroups, groupElements, hitTestElements, sdGroup,
};
