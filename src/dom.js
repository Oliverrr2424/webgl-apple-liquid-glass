// LiquidGlass: turn a page element into V2 liquid glass.
//
// The element keeps its content, layout and events. A canvas is placed behind
// its content, slightly larger than the element so the rim can sample the
// page around the silhouette, and redrawn from the backdrop *registered to
// where the element is on screen* whenever it moves, resizes or scrolls.

import { LiquidGlassWebGLV2 } from './v2.js';
import { makeMaterialV2 } from './v2-material.js';
import { addClient, removeClient, wake, eachClient, layoutEpoch } from './frame-loop.js';
import { invalidatePageContent } from './dom-content.js';
import {
  LAYER_ATTRIBUTE, isElement, normalizeBackdrop, resolveLayers, paintElementBackdrop,
  layersAreLive, layerElements, missingLayers, onBackdropAsset, transparentColor,
} from './dom-backdrop.js';

const instances = new WeakMap();
const VOID_TAGS = new Set(['IMG', 'INPUT', 'TEXTAREA', 'SELECT', 'VIDEO', 'CANVAS', 'IFRAME', 'BR', 'HR']);
const MEDIA_EVENTS = ['load', 'loadeddata', 'play', 'playing', 'pause', 'seeked', 'resize'];
let supportCache = null;

export function webgl2Supported() {
  if (supportCache === null) supportCache = LiquidGlassWebGLV2.isSupported();
  return supportCache;
}

/** Destroys a V2 instance that owns its canvas, releasing the GL context now
 * rather than at garbage collection (browsers cap live contexts at ~16). */
export function releaseGlass(glass) {
  if (!glass) return;
  const gl = glass.renderer?.gl;
  glass.destroy();
  gl?.getExtension?.('WEBGL_lose_context')?.loseContext();
}

/**
 * Calls `onChange` when inline style or class changes on any of `elements` or
 * their ancestors: what JS animation libraries and class toggles do, and
 * what the frame loop would otherwise never hear about.
 */
export function watchStyles(elements, onChange) {
  if (typeof MutationObserver !== 'function') return null;
  const observer = new MutationObserver(onChange);
  const seen = new Set();
  for (const start of elements) {
    for (let node = start; node?.nodeType === 1 && !seen.has(node); node = node.parentElement) {
      seen.add(node);
      observer.observe(node, { attributes: true, attributeFilter: ['style', 'class'] });
    }
  }
  return observer;
}

export function resolveTarget(target, name) {
  const element = typeof target === 'string' && typeof document !== 'undefined'
    ? document.querySelector(target)
    : target;
  if (!isElement(element)) throw new TypeError(`${name}: no element matches ${String(target)}.`);
  return element;
}

function cssRadius(style, width, height) {
  const token = (style.borderTopLeftRadius || '0').split(/\s+/)[0];
  const value = parseFloat(token) || 0;
  return token.endsWith('%') ? Math.min(width, height) * value / 100 : value;
}

/** Shape and corner radius that match the element's CSS box. */
function shapeOf(style, width, height, spec) {
  if (spec.shape && spec.shape !== 'auto') {
    return { shape: spec.shape, ...(Number.isFinite(spec.radius) ? { radius: spec.radius } : {}) };
  }
  const radius = Number.isFinite(spec.radius) ? spec.radius : cssRadius(style, width, height);
  const short = Math.min(width, height);
  if (radius >= short / 2 - 0.5) {
    return { shape: Math.abs(width - height) < 1 ? 'circle' : 'pill' };
  }
  return { shape: 'rect', radius: Math.max(0, radius) };
}

const SURFACE_KEYS = ['tint', 'tintTone', 'frost', 'opacity'];

function surfaceProps(...sources) {
  const props = {};
  for (const source of sources) {
    for (const key of SURFACE_KEYS) if (source?.[key] != null) props[key] = source[key];
  }
  return props;
}

export class LiquidGlass {
  /** Whether WebGL2 is available. Without it every instance uses its fallback. */
  static isSupported() {
    return webgl2Supported();
  }

  /** The instance mounted on an element, if any. */
  static from(target) {
    const element = typeof target === 'string' ? document.querySelector(target) : target;
    return (element && instances.get(element)) ?? null;
  }

  /**
   * Re-measure and repaint every mounted surface on the next frame. Call it
   * after moving things with JavaScript the page does not announce (a WebGL
   * backdrop that just rendered, a canvas you drew into, a JS animation).
   */
  static refreshAll() {
    invalidatePageContent();
    eachClient((client) => client.refresh?.());
  }

  constructor(target, options = {}) {
    const element = resolveTarget(target, 'LiquidGlass');
    if (VOID_TAGS.has(element.tagName.toUpperCase())) {
      throw new TypeError(`LiquidGlass: <${element.tagName.toLowerCase()}> cannot hold the glass layer. Wrap it in an element and pass that.`);
    }
    // Validate early so a typo throws here, not on the first frame.
    makeMaterialV2(options.material ?? {});
    instances.get(element)?.destroy();
    instances.set(element, this);

    this.element = element;
    this.options = { ...options };
    this.destroyed = false;
    this.visible = true;
    this.mode = 'pending';
    this.glass = null;
    this.canvas = null;
    this.targets = [];
    this.layers = [];
    this.mediaListeners = [];
    this.restore = [];
    this.frame = null;
    this.sizeKey = '';
    this.positionKey = '';
    this.geometryKey = '';
    this.styleDirty = true;
    this.backdropDirty = true;
    this.elementsDirty = true;
    this.warnedMissing = '';
    this.ready = new Promise((resolve) => { this.resolveReady = resolve; });

    if (!webgl2Supported()) {
      this.enterFallback();
      return;
    }

    this.buffer = document.createElement('canvas');
    this.bufferContext = this.buffer.getContext('2d', { alpha: false });
    this.mountCanvas();
    this.backdropSpec = normalizeBackdrop(options.backdrop);
    this.resolveTargets();
    this.resolveBackdrop();

    this.resizeObserver = typeof ResizeObserver === 'function'
      ? new ResizeObserver(() => this.refresh({ backdrop: false }))
      : null;
    this.observeSizes();
    this.unsubscribeAssets = onBackdropAsset(() => {
      this.backdropDirty = true;
      wake(34);
    });
    this.watchStyles();
    addClient(this);
  }

  /** False when this instance is showing its fallback instead of WebGL glass. */
  get supported() {
    return this.mode !== 'fallback';
  }

  trackedElements() {
    return [this.element, ...this.targets.map((target) => target.element)];
  }

  setStyle(node, property, value) {
    this.restore.push([node, property, node.style[property]]);
    node.style[property] = value;
  }

  mountCanvas() {
    const { element } = this;
    const style = getComputedStyle(element);
    const setStyle = (property, value) => this.setStyle(element, property, value);
    if (style.position === 'static') setStyle('position', 'relative');
    // The canvas sits at z-index -1 inside the element's own stacking
    // context: above the element's background, below its content.
    if (style.isolation !== 'isolate') setStyle('isolation', 'isolate');

    const canvas = document.createElement('canvas');
    canvas.setAttribute(LAYER_ATTRIBUTE, '');
    canvas.setAttribute('aria-hidden', 'true');
    Object.assign(canvas.style, {
      position: 'absolute',
      left: '0px',
      top: '0px',
      width: '0px',
      height: '0px',
      margin: '0',
      padding: '0',
      border: '0',
      maxWidth: 'none',
      maxHeight: 'none',
      display: 'block',
      pointerEvents: 'none',
      zIndex: String(this.options.zIndex ?? -1),
      visibility: 'hidden',
    });
    element.appendChild(canvas);
    this.canvas = canvas;
    element.setAttribute('data-liquid-glass', 'pending');
  }

  resolveTargets() {
    const spec = this.options.targets;
    let list = [];
    if (typeof spec === 'string') {
      list = [...this.element.querySelectorAll(spec)].map((element) => ({ element }));
    } else if (spec && typeof spec[Symbol.iterator] === 'function') {
      list = [...spec].map((entry) => (isElement(entry) ? { element: entry } : entry))
        .filter((entry) => isElement(entry?.element));
    }
    this.targets = list;
    this.mutationObserver?.disconnect();
    this.mutationObserver = null;
    if (typeof spec === 'string' && typeof MutationObserver === 'function') {
      this.mutationObserver = new MutationObserver(() => {
        this.resolveTargets();
        this.observeSizes();
        this.refresh({ backdrop: false });
      });
      this.mutationObserver.observe(this.element, { childList: true, subtree: true });
    }
  }

  observeSizes() {
    if (!this.resizeObserver) return;
    this.resizeObserver.disconnect();
    for (const element of this.trackedElements()) this.resizeObserver.observe(element);
  }

  watchStyles() {
    this.styleObserver?.disconnect();
    this.styleObserver = watchStyles([...this.trackedElements(), ...layerElements(this.layers)], () => {
      this.styleDirty = true;
      this.backdropDirty = true;
      wake(120);
    });
  }

  /** Large page backgrounds are re-detected when the viewport changes. */
  onViewportResize() {
    this.refresh();
  }

  resolveBackdrop() {
    for (const [element, listener] of this.mediaListeners) {
      MEDIA_EVENTS.forEach((type) => element.removeEventListener(type, listener));
    }
    this.mediaListeners = [];
    this.layers = resolveLayers(this.backdropSpec, this.element);
    const missing = missingLayers(this.layers).join(', ');
    if (missing && missing !== this.warnedMissing) {
      console.warn(`LiquidGlass: backdrop ${missing} matched no element and is not an image URL. Call refresh() once it exists.`);
    }
    this.warnedMissing = missing;
    const listener = () => {
      this.backdropDirty = true;
      wake(34);
    };
    for (const element of layerElements(this.layers)) {
      const tag = element.tagName.toUpperCase();
      if (tag !== 'IMG' && tag !== 'VIDEO') continue;
      MEDIA_EVENTS.forEach((type) => element.addEventListener(type, listener));
      this.mediaListeners.push([element, listener]);
    }
  }

  measure() {
    if (this.destroyed || this.mode === 'fallback') return;
    const { element } = this;
    const rect = element.getBoundingClientRect();
    const frame = {
      x: rect.left,
      y: rect.top,
      screenWidth: rect.width,
      screenHeight: rect.height,
      width: element.offsetWidth ?? rect.width,
      height: element.offsetHeight ?? rect.height,
      borderLeft: element.clientLeft,
      borderTop: element.clientTop,
      scrollLeft: element.scrollLeft,
      scrollTop: element.scrollTop,
      targets: this.targets.map(({ element: target }) => {
        const box = target.getBoundingClientRect();
        return {
          x: box.left,
          y: box.top,
          width: target.offsetWidth ?? box.width,
          height: target.offsetHeight ?? box.height,
          screenWidth: box.width,
          screenHeight: box.height,
        };
      }),
    };
    if (this.styleDirty) {
      this.styles = [element, ...this.targets.map((target) => target.element)]
        .map((node) => getComputedStyle(node))
        .map((style) => ({ borderTopLeftRadius: style.borderTopLeftRadius }));
      this.styleDirty = false;
      this.elementsDirty = true;
    }
    this.frame = frame;
  }

  bleed() {
    if (Number.isFinite(this.options.bleed)) return Math.max(0, this.options.bleed);
    const material = this.glass?.material ?? makeMaterialV2(this.options.material ?? {});
    return Math.ceil(Math.min(96, 24 + material.refraction * 0.17 + material.backdropBlur * 2));
  }

  createGlass() {
    try {
      this.glass = new LiquidGlassWebGLV2(this.canvas, {
        compositeMode: 'overlay',
        autoResize: false,
        autoStart: false,
        // Glass above this element draws this canvas into its backdrop,
        // possibly on a later frame than the one that rendered it.
        preserveDrawingBuffer: true,
        material: this.options.material,
        respectReducedTransparency: this.options.respectReducedTransparency ?? true,
        onContextLost: (event) => this.options.onContextLost?.(event),
        onContextRestored: (event) => {
          this.sizeKey = '';
          this.backdropDirty = true;
          this.elementsDirty = true;
          wake(64);
          this.options.onContextRestored?.(event);
        },
      });
    } catch (error) {
      console.warn('LiquidGlass: WebGL2 surface could not be created; using the fallback.', error);
      this.enterFallback();
      return false;
    }
    this.mode = 'webgl';
    this.element.setAttribute('data-liquid-glass', 'webgl');
    return true;
  }

  buildElements(frame, bleed, scaleX, scaleY) {
    const own = surfaceProps(this.options);
    if (!this.targets.length) {
      return [{
        id: 'surface',
        x: bleed,
        y: bleed,
        width: frame.width,
        height: frame.height,
        ...shapeOf(this.styles[0], frame.width, frame.height, this.options),
        ...own,
      }];
    }
    return this.targets.slice(0, frame.targets.length).map((target, index) => {
      const box = frame.targets[index];
      const width = box.width || box.screenWidth / scaleX;
      const height = box.height || box.screenHeight / scaleY;
      return {
        id: `target-${index}`,
        x: (box.x - frame.x) / scaleX + bleed,
        y: (box.y - frame.y) / scaleY + bleed,
        width,
        height,
        ...shapeOf(this.styles[index + 1] ?? this.styles[0], width, height, { ...this.options, ...target }),
        ...surfaceProps(this.options, target),
      };
    }).filter((surface) => surface.width > 0 && surface.height > 0);
  }

  draw() {
    const frame = this.frame;
    if (!frame || this.destroyed || this.mode === 'fallback') return false;
    if (!(frame.width > 0 && frame.height > 0 && frame.screenWidth > 0 && frame.screenHeight > 0)) {
      if (this.canvas.style.visibility !== 'hidden') this.canvas.style.visibility = 'hidden';
      return false;
    }
    if (!this.glass && !this.createGlass()) return false;

    const dpr = Math.max(0.5, Math.min(globalThis.devicePixelRatio || 1, this.options.maxDpr ?? 2));
    const bleed = this.bleed();
    const cssWidth = frame.width + bleed * 2;
    const cssHeight = frame.height + bleed * 2;
    const sizeKey = `${cssWidth}x${cssHeight}@${dpr}`;
    if (sizeKey !== this.sizeKey) {
      this.sizeKey = sizeKey;
      this.canvas.style.width = `${cssWidth}px`;
      this.canvas.style.height = `${cssHeight}px`;
      this.buffer.width = Math.max(1, Math.round(cssWidth * dpr));
      this.buffer.height = Math.max(1, Math.round(cssHeight * dpr));
      this.glass.setBackdrop(this.buffer, { update: 'static', autoStart: false, shouldRender: false });
      this.backdropDirty = true;
      this.elementsDirty = true;
    }
    // Absolute children of a scroll container move with its content.
    const positionKey = `${-bleed - frame.borderLeft + frame.scrollLeft},${-bleed - frame.borderTop + frame.scrollTop}`;
    if (positionKey !== this.positionKey) {
      this.positionKey = positionKey;
      const [left, top] = positionKey.split(',');
      this.canvas.style.left = `${left}px`;
      this.canvas.style.top = `${top}px`;
    }

    const scaleX = frame.screenWidth / frame.width;
    const scaleY = frame.screenHeight / frame.height;
    const geometryKey = [
      frame.x, frame.y, frame.screenWidth, frame.screenHeight,
      ...frame.targets.flatMap((box) => [box.x, box.y, box.screenWidth, box.screenHeight]),
    ].map((value) => Math.round(value * 64)).join(',');
    if (geometryKey !== this.geometryKey) {
      this.geometryKey = geometryKey;
      this.backdropDirty = true;
      this.elementsDirty = true;
    }
    if (layoutEpoch() !== this.epoch) {
      this.epoch = layoutEpoch();
      this.backdropDirty = true;
    }

    const live = this.options.live === true
      || (this.options.live !== false && layersAreLive(this.layers));
    let changed = false;
    let settled = this.settled ?? false;
    if (this.backdropDirty || live) {
      settled = paintElementBackdrop(this.bufferContext, this.layers, frame, bleed, dpr);
      this.settled = settled;
      this.glass.updateBackdrop(false);
      this.backdropDirty = false;
      changed = true;
    }
    if (this.elementsDirty) {
      this.glass.setElements(this.buildElements(frame, bleed, scaleX, scaleY), false);
      this.elementsDirty = false;
      changed = true;
    }
    if (changed || this.glass.dirty) {
      this.glass.render({ force: true, dpr });
      // Writing a style, even an unchanged one, could force the next
      // surface's measurement into a synchronous layout.
      if (this.canvas.style.visibility) this.canvas.style.visibility = '';
      this.options.onRender?.(this);
    }
    if (settled && this.resolveReady) {
      this.resolveReady(this);
      this.resolveReady = null;
    }
    return live;
  }

  enterFallback() {
    this.mode = 'fallback';
    releaseGlass(this.glass);
    this.glass = null;
    this.canvas?.remove();
    this.canvas = null;
    const { element } = this;
    element.setAttribute('data-liquid-glass', 'fallback');
    const fallback = this.options.fallback ?? 'css';
    if (typeof fallback === 'function') {
      fallback(element);
    } else if (fallback === 'css') {
      const spec = this.options.targets;
      const surfaces = typeof spec === 'string'
        ? [...element.querySelectorAll(spec)]
        : spec
          ? [...spec].map((entry) => (isElement(entry) ? entry : entry?.element)).filter(isElement)
          : [element];
      const blur = Math.round(14 + (this.options.frost ?? 0) * 30);
      const tint = Math.min(1, this.options.tint ?? 0);
      for (const node of surfaces) {
        const style = getComputedStyle(node);
        if (!style.backdropFilter || style.backdropFilter === 'none') {
          this.setStyle(node, 'backdropFilter', `blur(${blur}px) saturate(1.6)`);
          this.setStyle(node, 'webkitBackdropFilter', `blur(${blur}px) saturate(1.6)`);
        }
        if (transparentColor(style.backgroundColor)) {
          this.setStyle(node, 'backgroundColor', this.options.tintTone === 'dark'
            ? `rgba(20,21,26,${(0.28 + tint * 0.5).toFixed(3)})`
            : `rgba(255,255,255,${(0.14 + tint * 0.5).toFixed(3)})`);
        }
      }
    }
    this.resolveReady?.(this);
    this.resolveReady = null;
  }

  /** Re-read the element, its targets and the backdrop on the next frame. */
  refresh({ backdrop = true } = {}) {
    if (this.destroyed || this.mode === 'fallback') return this;
    if (backdrop) {
      if (typeof this.options.targets === 'string') this.resolveTargets();
      this.resolveBackdrop();
      this.observeSizes();
      this.watchStyles();
    }
    this.styleDirty = true;
    this.backdropDirty = true;
    this.elementsDirty = true;
    wake(64);
    return this;
  }

  /** Merge new options. Pass `material` as a partial V2 material. */
  update(options = {}) {
    if (this.destroyed) return this;
    if ('material' in options) makeMaterialV2({ ...(this.options.material ?? {}), ...(options.material ?? {}) });
    this.options = {
      ...this.options,
      ...options,
      ...('material' in options ? { material: { ...(this.options.material ?? {}), ...(options.material ?? {}) } } : {}),
    };
    if (this.mode === 'fallback') return this;
    if ('material' in options) this.glass?.setMaterial(options.material ?? {}, false);
    if ('zIndex' in options && this.canvas) this.canvas.style.zIndex = String(options.zIndex ?? -1);
    if ('backdrop' in options) this.backdropSpec = normalizeBackdrop(options.backdrop);
    if ('targets' in options) this.resolveTargets();
    this.sizeKey = '';
    return this.refresh();
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    removeClient(this);
    this.resizeObserver?.disconnect();
    this.mutationObserver?.disconnect();
    this.styleObserver?.disconnect();
    this.unsubscribeAssets?.();
    for (const [element, listener] of this.mediaListeners) {
      MEDIA_EVENTS.forEach((type) => element.removeEventListener(type, listener));
    }
    releaseGlass(this.glass);
    this.glass = null;
    this.canvas?.remove();
    this.canvas = null;
    for (const [node, property, value] of this.restore.reverse()) node.style[property] = value;
    this.element.removeAttribute('data-liquid-glass');
    if (instances.get(this.element) === this) instances.delete(this.element);
    this.resolveReady?.(this);
    this.resolveReady = null;
  }
}
