import { GlassRenderer } from './renderer.js';
import { DEFAULT_MATERIAL, PRESETS, makeMaterial } from './material.js';

export const SHAPES = Object.freeze({
  FOLDER: 'folder',
  RECT: 'rect',
  PILL: 'pill',
  CIRCLE: 'circle',
});

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
    this.renderer = new GlassRenderer(canvas);
    this.material = typeof options.material === 'string'
      ? makeMaterial(options.material)
      : { ...makeMaterial('regular'), ...(options.material || {}) };
    this.elements = [];
    this.fusion = Boolean(options.fusion ?? false);
    this.wallpaperIndex = 0;
    this.wallpaperZoom = options.wallpaperZoom ?? 1;
    if (options.elements) this.setElements(options.elements, false);
    if (options.wallpapers) this.setWallpapers(options.wallpapers, false);
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
    this.renderer.setWallpapers(images);
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
    this.renderer.drawBackdrop();
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
    this.renderer.destroy();
    this.elements = [];
  }
}

export { DEFAULT_MATERIAL, PRESETS, makeMaterial };
