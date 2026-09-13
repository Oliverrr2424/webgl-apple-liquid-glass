// Ready-made liquid glass controls: a segmented navbar and a switch.
//
// Each control is transparent over the page. Its layers bleed past the
// container so the pressed lens can grow beyond the track, and the glass
// samples the page backdrop registered to where the control sits on screen,
// exactly like `LiquidGlass`.

import { LiquidGlassWebGLV2 } from './v2.js';
import { getDefaultMaterialV2, makeMaterialV2 } from './v2-material.js';
import { addClient, removeClient, wake, layoutEpoch } from './frame-loop.js';
import {
  LAYER_ATTRIBUTE, normalizeBackdrop, resolveLayers, paintElementBackdrop,
  layersAreLive, layerElements, onBackdropAsset,
} from './dom-backdrop.js';
import { resolveTarget, releaseGlass, webgl2Supported, watchStyles } from './dom.js';

const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
const registry = new WeakMap();

/** Stable V2 transmission used by the navbar and switch while held. */
export const PRESSED_CONTROL_MATERIAL_V2 = Object.freeze({
  refraction: 17,
  edgeReach: 0.14,
  edgeWidth: 0.22,
  dispersion: 0,
  frost: 0,
  backdropBlur: 0,
  body: 0.72,
  absorption: 0.58,
  tint: 0,
});

/** Geometry of the pressed navigation lens. */
export const DEFAULT_NAVIGATION_LENS = Object.freeze({
  outerWidth: 0.13,
  outerHeight: 1.24,
  innerLength: 0,
  innerHeight: 0.24,
});

/** Merge the fixed pressed transmission with user-controlled reflection/interface values. */
export function getPressedControlMaterialV2(material = {}) {
  return { ...getDefaultMaterialV2(), ...material, ...PRESSED_CONTROL_MATERIAL_V2 };
}

// Used only when the container has no size of its own.
const DEFAULT_SIZE = { navbar: [312, 72], switch: [84, 28] };
const SWITCH_TRACK_ASPECT = 3;

// Release restores the resting material in a short linear fade while the
// geometry is still completing its spring (the playground's Press scene).
const RELEASE_MATERIAL_MS = 140;

// The thumbs' glass at rest, so the first liquid frame matches the 2D thumb
// it replaces before tint and frost clear under the finger.
const RESTING_THUMB = Object.freeze({
  switch: { tint: 1.5, frost: 0.24, tintTone: 'light' },
  navbar: { tint: 0.34, frost: 0.32, tintTone: 'dark' },
});

function layer(tag, host, zIndex) {
  const node = document.createElement(tag);
  node.setAttribute(LAYER_ATTRIBUTE, '');
  node.setAttribute('aria-hidden', 'true');
  Object.assign(node.style, {
    position: 'absolute',
    left: '0px',
    top: '0px',
    margin: '0',
    padding: '0',
    border: '0',
    maxWidth: 'none',
    maxHeight: 'none',
    display: 'block',
    pointerEvents: 'none',
    zIndex: String(zIndex),
  });
  host?.appendChild(node);
  return node;
}

function roundRect(context, x, y, width, height, radius = height / 2) {
  context.beginPath();
  context.roundRect(x, y, width, height, Math.max(0, Math.min(radius, width / 2, height / 2)));
}

function pressureSpring(state, target, seconds, stiffness, damping) {
  state.velocity += (target - state.value) * stiffness * seconds;
  state.velocity *= Math.exp(-damping * seconds);
  state.value += state.velocity * seconds;
}

function normalizeItems(items) {
  const list = items ?? [
    { value: 'first', label: 'First' },
    { value: 'second', label: 'Second' },
  ];
  if (!Array.isArray(list) || list.length < 2) {
    throw new TypeError('LiquidGlassNavbar needs at least two items.');
  }
  return list.map((item, index) => typeof item === 'string'
    ? { value: item, label: item }
    : { value: item.value ?? String(index), label: item.label ?? String(item.value ?? index), icon: item.icon });
}

class LiquidGlassControl {
  constructor(target, options, kind) {
    const name = kind === 'navbar' ? 'LiquidGlassNavbar' : 'LiquidGlassSwitch';
    const container = resolveTarget(target, name);
    makeMaterialV2(options?.material ?? {});
    registry.get(container)?.destroy();
    registry.set(container, this);

    this.container = container;
    this.element = container;
    this.options = { ...(options ?? {}) };
    this.kind = kind;
    this.destroyed = false;
    this.visible = true;
    this.items = kind === 'navbar' ? normalizeItems(this.options.items) : null;
    const index = kind === 'switch' ? (this.options.checked ? 1 : 0) : this.indexOf(this.options.value);
    this.position = { value: index, velocity: 0 };
    this.positionTarget = index;
    this.amount = { value: 0, velocity: 0 };
    this.value = kind === 'switch' ? Boolean(index) : this.items[index].value;
    this.material = { ...getDefaultMaterialV2(), ...(this.options.material ?? {}) };
    this.lens = { ...DEFAULT_NAVIGATION_LENS, ...(this.options.lens ?? {}) };
    this.dragging = false;
    this.animating = false;
    this.releasing = false;
    this.releaseMix = 1;
    this.releaseStartedAt = 0;
    this.activePointerId = null;
    this.lastTime = 0;
    this.frame = null;
    this.size = null;
    this.sizeKey = '';
    this.geometryKey = '';
    this.staticDirty = true;
    this.dirty = true;
    this.pressedShown = false;
    this.settled = false;
    this.settledWaiters = [];
    this.restore = [];
    this.ready = new Promise((resolve) => { this.settledWaiters.push(() => resolve(this)); });

    this.setupContainer();
    this.supported = webgl2Supported();
    this.backdropCanvas = layer('canvas', null, 0);
    this.compositeCanvas = layer('canvas', null, 0);
    this.baseCanvas = kind === 'navbar' ? layer('canvas', container, 0) : null;
    this.trackCanvas = layer('canvas', container, 1);
    this.pressCanvas = layer('canvas', container, 2);
    this.restCanvas = layer('canvas', container, 3);
    this.labelLayer = layer('div', container, 4);
    Object.assign(this.labelLayer.style, { inset: '0', width: '100%', height: '100%' });
    this.labelLayer.removeAttribute('aria-hidden');

    if (this.supported) {
      try {
        this.baseGlass = this.baseCanvas ? new LiquidGlassWebGLV2(this.baseCanvas, {
          material: this.material, compositeMode: 'overlay', autoResize: false, preserveDrawingBuffer: true,
        }) : null;
        this.pressGlass = new LiquidGlassWebGLV2(this.pressCanvas, {
          material: getPressedControlMaterialV2(this.material), compositeMode: 'overlay', autoResize: false,
          preserveDrawingBuffer: true,
        });
      } catch (error) {
        console.warn(`${name}: WebGL2 unavailable, drawing the flat fallback.`, error);
        releaseGlass(this.baseGlass);
        this.baseGlass = null;
        this.pressGlass = null;
        this.supported = false;
      }
    }

    // Same marker as LiquidGlass, so one CSS rule can style both fallbacks.
    container.setAttribute('data-liquid-glass', this.supported ? 'webgl' : 'fallback');

    this.onPointerDown = (event) => this.pointerDown(event);
    this.onPointerMove = (event) => this.pointerMove(event);
    this.onPointerEnd = (event) => this.pointerEnd(event);
    this.onKeyDown = (event) => this.keyDown(event);
    container.addEventListener('pointerdown', this.onPointerDown);
    container.addEventListener('pointermove', this.onPointerMove);
    container.addEventListener('pointerup', this.onPointerEnd);
    container.addEventListener('pointercancel', this.onPointerEnd);
    container.addEventListener('lostpointercapture', this.onPointerEnd);
    container.addEventListener('keydown', this.onKeyDown);
    this.onFocusChange = (event) => {
      if (event.type === 'blur') this.pointerFocus = false;
      this.dirty = true;
      wake(34);
    };
    container.addEventListener('focus', this.onFocusChange);
    container.addEventListener('blur', this.onFocusChange);

    this.layers = resolveLayers(normalizeBackdrop(this.options.backdrop), container);
    this.unsubscribeAssets = onBackdropAsset(() => {
      this.staticDirty = true;
      wake(34);
    });
    this.resizeObserver = typeof ResizeObserver === 'function'
      ? new ResizeObserver(() => wake(64))
      : null;
    this.resizeObserver?.observe(container);
    this.watchStyles();
    this.buildLabels();
    this.updateAccessibility();
    addClient(this);
  }

  static from(target) {
    const element = typeof target === 'string' ? document.querySelector(target) : target;
    return (element && registry.get(element)) ?? null;
  }

  setupContainer() {
    const { container, kind } = this;
    const style = getComputedStyle(container);
    const setStyle = (property, value) => {
      this.restore.push([property, container.style[property]]);
      container.style[property] = value;
    };
    if (style.position === 'static') setStyle('position', 'relative');
    if (style.isolation !== 'isolate') setStyle('isolation', 'isolate');
    if (style.display === 'inline') setStyle('display', 'inline-block');
    const [defaultWidth, defaultHeight] = DEFAULT_SIZE[kind];
    // An empty container with no height has not been sized by the page.
    const unsized = container.clientHeight === 0 && !container.style.height;
    if (this.options.width != null || (unsized && !container.style.width)) {
      setStyle('width', `${this.options.width ?? defaultWidth}px`);
    }
    if (this.options.height != null || unsized) {
      setStyle('height', `${this.options.height ?? defaultHeight}px`);
    }
    setStyle('touchAction', 'none');
    setStyle('userSelect', 'none');
    setStyle('webkitUserSelect', 'none');
    setStyle('cursor', this.options.disabled ? 'default' : 'pointer');
    // The focus ring is drawn around the track, not the container's box.
    setStyle('outline', 'none');
    this.originalAttributes = ['tabindex', 'role', 'aria-checked', 'aria-label', 'aria-disabled', 'data-liquid-glass']
      .map((attribute) => [attribute, container.getAttribute(attribute)]);
    container.tabIndex = this.options.disabled ? -1 : (container.tabIndex >= 0 ? container.tabIndex : 0);
    container.dataset.liquidGlassControl = kind;
  }

  trackedElements() {
    return [this.container];
  }

  watchStyles() {
    this.styleObserver?.disconnect();
    this.styleObserver = watchStyles([this.container, ...layerElements(this.layers)], () => {
      this.staticDirty = true;
      wake(120);
    });
  }

  onViewportResize() {
    this.refresh();
  }

  count() {
    return this.kind === 'navbar' ? this.items.length : 2;
  }

  indexOf(value) {
    const index = this.items.findIndex((item) => item.value === value);
    return index < 0 ? 0 : index;
  }

  // ---- frame loop -------------------------------------------------------

  measure() {
    const rect = this.container.getBoundingClientRect();
    this.frame = {
      x: rect.left,
      y: rect.top,
      screenWidth: rect.width,
      screenHeight: rect.height,
      width: this.container.offsetWidth,
      height: this.container.offsetHeight,
    };
  }

  draw(now) {
    const { frame } = this;
    if (!frame || this.destroyed || !(frame.width > 0 && frame.height > 0)) return false;
    const dpr = Math.min(globalThis.devicePixelRatio || 1, 2);
    const sizeKey = `${frame.width}x${frame.height}@${dpr}`;
    if (sizeKey !== this.sizeKey) {
      this.sizeKey = sizeKey;
      this.layout(frame.width, frame.height, dpr);
    }
    const geometryKey = [frame.x, frame.y, frame.screenWidth, frame.screenHeight]
      .map((value) => Math.round(value * 64)).join(',');
    if (geometryKey !== this.geometryKey || layoutEpoch() !== this.epoch) {
      this.geometryKey = geometryKey;
      this.epoch = layoutEpoch();
      this.staticDirty = true;
    }
    const live = this.options.live === true
      || (this.options.live !== false && this.supported && layersAreLive(this.layers));
    if (live) this.staticDirty = true;
    const animating = this.animating && this.step(now);
    if (this.staticDirty || this.dirty) this.render();
    return animating || live;
  }

  layout(width, height, dpr) {
    const bleed = Math.ceil(36 + height * 0.5);
    this.size = { width, height, dpr, bleed };
    const cssWidth = width + bleed * 2;
    const cssHeight = height + bleed * 2;
    const pixelWidth = Math.max(1, Math.round(cssWidth * dpr));
    const pixelHeight = Math.max(1, Math.round(cssHeight * dpr));
    for (const canvas of [this.baseCanvas, this.trackCanvas, this.pressCanvas, this.restCanvas]) {
      if (!canvas) continue;
      Object.assign(canvas.style, {
        left: `${-bleed}px`, top: `${-bleed}px`, width: `${cssWidth}px`, height: `${cssHeight}px`,
      });
    }
    for (const canvas of [this.backdropCanvas, this.compositeCanvas, this.trackCanvas, this.restCanvas]) {
      canvas.width = pixelWidth;
      canvas.height = pixelHeight;
    }
    let trackWidth = width;
    let trackHeight = height;
    if (this.kind === 'switch') {
      // The host is also the generous hit target. Keep the visible track at
      // the flatter proportions of the playground even when app CSS supplies
      // a taller box (for example 64×30).
      if (width / height < SWITCH_TRACK_ASPECT) trackHeight = width / SWITCH_TRACK_ASPECT;
      else trackWidth = height * SWITCH_TRACK_ASPECT;
    }
    this.track = {
      x: bleed + (width - trackWidth) / 2,
      y: bleed + (height - trackHeight) / 2,
      w: trackWidth,
      h: trackHeight,
    };
    this.baseGlass?.setBackdrop(this.backdropCanvas, { update: 'static', autoStart: false, shouldRender: false });
    this.pressGlass?.setBackdrop(this.compositeCanvas, { update: 'static', autoStart: false, shouldRender: false });
    this.staticDirty = true;
    this.dirty = true;
    this.buildLabels();
  }

  step(now) {
    const seconds = clamp((now - this.lastTime) / 1000, 0.001, 0.034);
    this.lastTime = now;
    const reduceMotion = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
    const amountTarget = this.dragging ? 1 : 0;
    const last = this.count() - 1;
    if (reduceMotion) {
      this.amount.value = amountTarget;
      this.amount.velocity = 0;
      this.position.value = this.positionTarget;
      this.position.velocity = 0;
    } else {
      pressureSpring(this.amount, amountTarget, seconds, this.dragging ? 520 : 540, this.dragging ? 28 : 31);
      pressureSpring(this.position, this.positionTarget, seconds, this.dragging ? 420 : 360, this.dragging ? 31 : 27);
    }
    this.amount.value = clamp(this.amount.value, 0, 1.12);
    this.position.value = clamp(this.position.value, 0, last);
    if (this.releasing) {
      this.releaseMix = reduceMotion ? 1 : clamp((now - this.releaseStartedAt) / RELEASE_MATERIAL_MS);
    }
    const settled = Math.abs(this.amount.value - amountTarget) < 0.004
      && Math.abs(this.amount.velocity) < 0.018
      && Math.abs(this.position.value - this.positionTarget) < 0.003
      && Math.abs(this.position.velocity) < 0.018
      && (!this.releasing || this.releaseMix >= 1);
    if (settled) {
      this.amount.value = amountTarget;
      this.position.value = this.positionTarget;
      this.animating = this.dragging;
      if (!this.dragging) this.releasing = false;
    }
    this.dirty = true;
    return !settled || this.dragging;
  }

  startAnimation() {
    if (this.destroyed) return;
    if (!this.animating) {
      this.animating = true;
      this.lastTime = globalThis.performance?.now?.() ?? Date.now();
    }
    this.dirty = true;
    wake(34);
  }

  // ---- drawing ----------------------------------------------------------

  thumbGeometry(amount = this.amount.value) {
    const { track } = this;
    const inset = track.h * 0.08;
    const count = this.count();
    const progress = clamp(this.position.value / (count - 1));
    const restingWidth = this.kind === 'navbar'
      ? (track.w - inset * 2) / count
      : track.w * 0.65;
    const restingHeight = track.h * 0.84;
    const travel = Math.max(0, track.w - restingWidth - inset * 2);
    const restingX = track.x + inset + travel * progress;
    const restingY = track.y + inset;
    let scaleX;
    let scaleY;
    if (this.kind === 'navbar') {
      scaleX = 1 + amount * this.lens.outerWidth;
      scaleY = 1 + amount * Math.max(0, track.h * this.lens.outerHeight / restingHeight - 1);
    } else {
      scaleX = 1 + amount * 0.33;
      scaleY = 1 + amount;
    }
    const w = restingWidth * scaleX;
    const h = restingHeight * scaleY;
    const centeredX = restingX - (w - restingWidth) / 2;
    // Proportional overtravel keeps the pressed switch the same shape at any
    // size; a fixed pixel floor made small switches overshoot their track.
    const overtravel = this.kind === 'navbar'
      ? Math.max(0, (h - track.h) / 2)
      : track.h * 0.42;
    const anchoredX = track.x - overtravel + (track.w + overtravel * 2 - w) * progress;
    return {
      x: centeredX + (anchoredX - centeredX) * clamp(amount),
      y: restingY - (h - restingHeight) / 2,
      w,
      h,
    };
  }

  context(canvas) {
    const context = canvas.getContext('2d');
    context.setTransform(this.size.dpr, 0, 0, this.size.dpr, 0, 0);
    return context;
  }

  drawBackdrop() {
    const context = this.backdropCanvas.getContext('2d');
    return paintElementBackdrop(context, this.layers, this.frame, this.size.bleed, this.size.dpr);
  }

  drawTrack() {
    const context = this.context(this.trackCanvas);
    context.clearRect(0, 0, this.trackCanvas.width, this.trackCanvas.height);
    if (this.kind === 'navbar' && this.baseGlass) return;
    const { x, y, w, h } = this.track;
    context.save();
    roundRect(context, x, y, w, h);
    if (this.kind === 'switch') {
      const gray = context.createLinearGradient(x, y, x + w, y + h);
      gray.addColorStop(0, '#c2c3c7');
      gray.addColorStop(1, '#a9abb0');
      context.fillStyle = gray;
      context.fill();
      roundRect(context, x, y, w, h);
      const progress = clamp(this.position.value);
      context.globalAlpha = progress * progress * (3 - 2 * progress);
      if (this.options.color) {
        context.fillStyle = this.options.color;
      } else {
        const green = context.createLinearGradient(x, y, x + w, y + h);
        green.addColorStop(0, '#34d86a');
        green.addColorStop(1, '#25c653');
        context.fillStyle = green;
      }
      context.fill();
    } else {
      const dark = this.darkTrack();
      context.fillStyle = dark ? 'rgba(30,32,38,.72)' : 'rgba(225,230,238,.72)';
      context.fill();
      context.strokeStyle = dark ? 'rgba(255,255,255,.18)' : 'rgba(255,255,255,.5)';
      context.stroke();
    }
    context.restore();
  }

  renderBase() {
    if (!this.baseGlass) return;
    this.baseGlass.updateBackdrop(false);
    this.baseGlass.setElements([{
      id: 'navbar-track',
      shape: 'pill',
      ...this.track,
      tint: this.options.tint ?? 0.86,
      tintTone: this.options.tintTone ?? 'light',
    }], false);
    this.baseGlass.render({ force: true, dpr: this.size.dpr });
  }

  composePressedBackdrop() {
    const context = this.compositeCanvas.getContext('2d');
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.drawImage(this.backdropCanvas, 0, 0);
    if (this.baseCanvas) context.drawImage(this.baseCanvas, 0, 0, this.compositeCanvas.width, this.compositeCanvas.height);
    context.drawImage(this.trackCanvas, 0, 0);
  }

  renderPressed(liquid) {
    if (!this.pressGlass) return;
    if (!liquid) {
      this.pressGlass.setElements([], false);
      this.pressGlass.render({ force: true, dpr: this.size.dpr });
      this.pressedShown = false;
      return;
    }
    const amount = clamp(this.amount.value);
    // Pressing clears the resting tint and frost with the elastic scale;
    // releasing brings them back in a short linear fade, then hands over to
    // the 2D thumb.
    const materialAmount = this.releasing ? 1 - this.releaseMix : amount;
    const resting = RESTING_THUMB[this.kind];
    this.pressGlass.updateBackdrop(false);
    this.pressGlass.setElements([{
      id: `${this.kind}-pressed-thumb`,
      shape: 'pill',
      ...this.thumbGeometry(),
      tint: resting.tint * (1 - materialAmount),
      frost: resting.frost * (1 - materialAmount),
      opacity: this.releasing ? 1 - this.releaseMix : 1,
      pressure: this.kind === 'navbar' ? amount : 0,
      pressureAxes: this.kind === 'navbar'
        ? [1 - this.lens.innerLength, 1 - this.lens.innerHeight]
        : [1, 1],
      tintTone: resting.tintTone,
    }], false);
    this.pressGlass.render({ force: true, dpr: this.size.dpr });
    this.pressedShown = true;
  }

  drawRestingThumb(composed) {
    const context = this.context(this.restCanvas);
    context.clearRect(0, 0, this.restCanvas.width, this.restCanvas.height);
    // While held only the liquid thumb shows. On release the resting thumb
    // fades back in over the still-shrinking glass. Without WebGL the 2D
    // thumb does the whole animation itself.
    const held = this.dragging;
    const active = this.supported && (held || this.releasing);
    const opacity = active ? (held ? 0 : this.releaseMix) : 1;
    if (opacity <= 0.001) return;
    const thumb = this.thumbGeometry(active || !this.supported ? this.amount.value : 0);
    const radius = thumb.h / 2;
    context.save();
    context.globalAlpha = opacity;
    if (this.kind === 'switch') {
      context.shadowColor = 'rgba(0,0,0,.18)';
      context.shadowBlur = thumb.h * 0.16;
      context.shadowOffsetY = thumb.h * 0.045;
      roundRect(context, thumb.x, thumb.y, thumb.w, thumb.h, radius);
      const fill = context.createLinearGradient(thumb.x, thumb.y, thumb.x, thumb.y + thumb.h);
      fill.addColorStop(0, 'rgba(255,255,255,.97)');
      fill.addColorStop(1, 'rgba(238,239,242,.94)');
      context.fillStyle = fill;
      context.fill();
      context.shadowColor = 'transparent';
      roundRect(context, thumb.x + 0.75, thumb.y + 0.75, thumb.w - 1.5, thumb.h - 1.5, radius - 0.75);
      context.strokeStyle = 'rgba(83,85,91,.34)';
      context.lineWidth = 1.5;
      context.stroke();
    } else {
      const dark = this.darkTrack();
      context.shadowColor = 'rgba(0,0,0,.055)';
      context.shadowBlur = thumb.h * 0.09;
      context.shadowOffsetY = thumb.h * 0.045;
      roundRect(context, thumb.x, thumb.y, thumb.w, thumb.h, radius);
      context.clip();
      // The playground's resting selection: blur the already-composited
      // track under the thumb, neutralise most of its hue, one gray veil.
      if (composed && 'filter' in context) {
        const { dpr } = this.size;
        const blur = Math.max(5, thumb.h * 0.105);
        const pad = blur * 2.5;
        const x = Math.max(0, thumb.x - pad);
        const y = Math.max(0, thumb.y - pad);
        const w = thumb.w + pad * 2;
        const h = thumb.h + pad * 2;
        context.filter = `blur(${blur}px)`;
        context.drawImage(this.compositeCanvas, x * dpr, y * dpr, w * dpr, h * dpr, x, y, w, h);
        context.filter = 'none';
        context.globalCompositeOperation = 'color';
        context.fillStyle = dark ? 'rgba(46,48,54,.72)' : 'rgba(148,150,155,.72)';
        context.fillRect(thumb.x, thumb.y, thumb.w, thumb.h);
        context.globalCompositeOperation = 'source-over';
        // A dark track keeps a dark selection, so light labels stay legible
        // over bright content.
        context.fillStyle = dark ? 'rgba(12,13,17,.42)' : 'rgba(142,145,152,.24)';
      } else {
        const fill = context.createLinearGradient(thumb.x, thumb.y, thumb.x, thumb.y + thumb.h);
        fill.addColorStop(0, dark ? 'rgba(62,64,72,.9)' : 'rgba(174,178,186,.88)');
        fill.addColorStop(1, dark ? 'rgba(42,44,50,.86)' : 'rgba(145,149,158,.82)');
        context.fillStyle = fill;
      }
      context.fillRect(thumb.x, thumb.y, thumb.w, thumb.h);
    }
    context.restore();
  }

  /** Whether the navbar track reads as dark glass (`tintTone`, or measured for `auto`). */
  darkTrack() {
    const tone = this.options.tintTone ?? 'light';
    if (tone !== 'auto') return tone === 'dark';
    const track = this.baseGlass?.elements[0];
    if (!track || !this.size) return false;
    const { width, height, bleed } = this.size;
    return this.baseGlass.tintLightForElement(track, width + bleed * 2, height + bleed * 2) < 0.5;
  }

  labelColor() {
    return this.options.labelColor ?? (this.darkTrack() ? 'rgba(245,246,250,.95)' : 'rgba(22,25,31,.9)');
  }

  drawFocusRing() {
    let visible;
    try {
      visible = this.container.matches(':focus-visible');
    } catch {
      visible = document.activeElement === this.container;
    }
    // Like native controls: a ring for keyboard focus, none after a press.
    if (!visible || this.pointerFocus) return;
    const context = this.context(this.restCanvas);
    const { x, y, w, h } = this.track;
    context.save();
    roundRect(context, x - 3, y - 3, w + 6, h + 6);
    context.lineWidth = 2;
    context.strokeStyle = 'rgba(10,132,255,.95)';
    context.stroke();
    context.restore();
  }

  render() {
    if (this.destroyed || !this.size || !this.frame) return this;
    if (this.staticDirty) {
      this.settled = this.supported ? this.drawBackdrop() : true;
      this.renderBase();
      if (this.kind === 'navbar' && this.options.tintTone === 'auto') {
        const color = this.labelColor();
        if (color !== this.appliedLabelColor) {
          this.appliedLabelColor = color;
          for (const label of this.labelLayer.children) label.style.color = color;
        }
      }
      this.staticDirty = false;
    }
    this.drawTrack();
    const liquid = this.dragging || (this.releasing && this.releaseMix < 1);
    const composed = this.supported && (liquid || this.kind === 'navbar');
    if (composed) this.composePressedBackdrop();
    if (liquid || this.pressedShown) this.renderPressed(liquid);
    this.drawRestingThumb(composed);
    this.drawFocusRing();
    this.updateAccessibility();
    this.dirty = false;
    if (this.settled && this.settledWaiters.length) {
      this.settledWaiters.splice(0).forEach((resolve) => resolve());
    }
    return this;
  }

  buildLabels() {
    this.labelLayer.replaceChildren();
    if (this.kind !== 'navbar') return;
    const width = this.size?.width ?? this.container.offsetWidth;
    const height = this.size?.height ?? this.container.offsetHeight;
    const inset = height * 0.08;
    const slot = (width - inset * 2) / this.items.length;
    this.items.forEach((item, index) => {
      const label = document.createElement('span');
      label.dataset.index = String(index);
      label.setAttribute('role', 'tab');
      label.textContent = `${item.icon ? `${item.icon}  ` : ''}${item.label}`;
      Object.assign(label.style, {
        position: 'absolute',
        left: `${inset + slot * index}px`,
        top: '0px',
        width: `${slot}px`,
        height: `${height}px`,
        display: 'grid',
        placeItems: 'center',
        color: this.labelColor(),
        font: 'inherit',
        fontSize: `${this.options.fontSize ?? Math.max(13, Math.min(17, height * 0.22))}px`,
        fontWeight: '600',
        lineHeight: '1',
        whiteSpace: 'nowrap',
        pointerEvents: 'none',
      });
      this.labelLayer.appendChild(label);
    });
  }

  updateAccessibility() {
    const { container } = this;
    if (this.kind === 'switch') {
      container.setAttribute('role', 'switch');
      container.setAttribute('aria-checked', String(Boolean(this.value)));
      container.setAttribute('aria-label', this.options.ariaLabel ?? container.getAttribute('aria-label') ?? 'Liquid glass switch');
    } else {
      container.setAttribute('role', 'tablist');
      container.setAttribute('aria-label', this.options.ariaLabel ?? container.getAttribute('aria-label') ?? 'Liquid glass navigation');
      const selected = Math.round(this.positionTarget);
      for (const label of this.labelLayer.children) {
        label.setAttribute('aria-selected', String(Number(label.dataset.index) === selected));
      }
    }
  }

  // ---- input ------------------------------------------------------------

  localPoint(event) {
    const rect = this.container.getBoundingClientRect();
    const width = this.size?.width || rect.width || 1;
    const height = this.size?.height || rect.height || 1;
    return {
      x: (event.clientX - rect.left) * width / (rect.width || 1),
      y: (event.clientY - rect.top) * height / (rect.height || 1),
    };
  }

  progressForPointer(event) {
    const { x } = this.localPoint(event);
    const { track, size } = this;
    const thumb = this.thumbGeometry(0);
    const inset = track.h * 0.08;
    const travel = Math.max(1, track.w - thumb.w - inset * 2);
    return clamp((x + size.bleed - track.x - inset - thumb.w / 2) / travel) * (this.count() - 1);
  }

  pointerDown(event) {
    if (this.options.disabled || event.button !== 0 || !this.size) return;
    event.preventDefault();
    this.dragging = true;
    const start = Math.round(this.positionTarget);
    this.press = { x: event.clientX, y: event.clientY, moved: false, start };
    this.activePointerId = event.pointerId;
    this.releasing = false;
    this.releaseMix = 0;
    // Like the navbar, the pressed lens snaps to the side under the finger:
    // holding the other side pulls the enlarged knob there, and release
    // commits it. Pressing the already-selected side blooms in place and is a
    // no-op on release. Dragging afterwards follows the pointer.
    const progress = this.progressForPointer(event);
    this.positionTarget = this.kind === 'switch' ? Math.round(progress) : progress;
    try {
      this.container.setPointerCapture?.(event.pointerId);
    } catch {
      // Synthetic or already released pointers cannot be captured.
    }
    this.pointerFocus = true;
    this.container.focus({ preventScroll: true });
    this.startAnimation();
  }

  pointerMove(event) {
    if (!this.dragging || event.pointerId !== this.activePointerId) return;
    event.preventDefault();
    if (!this.press.moved) {
      if (Math.hypot(event.clientX - this.press.x, event.clientY - this.press.y) < 4) return;
      this.press.moved = true;
    }
    this.positionTarget = this.progressForPointer(event);
    this.startAnimation();
  }

  pointerEnd(event) {
    if (!this.dragging || event.pointerId !== this.activePointerId) return;
    event.preventDefault();
    this.dragging = false;
    const { start } = this.press ?? { start: Math.round(this.positionTarget) };
    if (event.type === 'pointercancel') this.positionTarget = start;
    else this.positionTarget = Math.round(this.positionTarget);
    this.activePointerId = null;
    this.press = null;
    this.releasing = true;
    this.releaseMix = 0;
    this.releaseStartedAt = globalThis.performance?.now?.() ?? Date.now();
    this.commitValue(this.positionTarget);
    this.startAnimation();
  }

  keyDown(event) {
    if (this.pointerFocus) {
      this.pointerFocus = false;
      this.dirty = true;
      wake(34);
    }
    if (this.options.disabled) return;
    const last = this.count() - 1;
    const current = Math.round(this.positionTarget);
    let next = null;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = Math.max(0, current - 1);
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = Math.min(last, current + 1);
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = last;
    if (this.kind === 'switch' && (event.key === ' ' || event.key === 'Enter')) next = current ? 0 : 1;
    if (next === null) return;
    event.preventDefault();
    this.positionTarget = next;
    this.commitValue(next);
    this.startAnimation();
  }

  commitValue(index, notify = true) {
    const previous = this.value;
    this.value = this.kind === 'switch' ? Boolean(index) : this.items[index].value;
    if (notify && previous !== this.value) {
      const detailIndex = this.kind === 'switch' ? undefined : index;
      this.options.onChange?.(this.value, detailIndex);
      this.container.dispatchEvent(new CustomEvent('change', {
        detail: { value: this.value, index: detailIndex },
        bubbles: true,
      }));
    }
    this.updateAccessibility();
  }

  jumpTo(index, notify) {
    this.positionTarget = index;
    this.position.value = index;
    this.position.velocity = 0;
    this.commitValue(index, notify);
    this.dirty = true;
    wake(34);
    return this;
  }

  // ---- public -----------------------------------------------------------

  /** Replace the backdrop. Resolves once the new backdrop has been drawn. */
  setBackdrop(backdrop) {
    this.options.backdrop = backdrop;
    return this.refresh().nextSettled();
  }

  nextSettled() {
    return new Promise((resolve) => {
      this.settled = false;
      this.settledWaiters.push(() => resolve(this));
    });
  }

  setMaterial(material) {
    makeMaterialV2({ ...(this.options.material ?? {}), ...(material ?? {}) });
    this.material = { ...this.material, ...(material ?? {}) };
    this.baseGlass?.setMaterial(this.material, false);
    this.pressGlass?.setMaterial(getPressedControlMaterialV2(this.material), false);
    this.staticDirty = true;
    wake(34);
    return this;
  }

  /** Update the navbar's pressed-lens geometry without remounting it. */
  setLens(lens) {
    if (this.kind !== 'navbar') return this;
    this.lens = { ...this.lens, ...(lens ?? {}) };
    this.dirty = true;
    wake(34);
    return this;
  }

  /** Update the navbar track/label tone without remounting it. */
  setTintTone(tintTone) {
    if (this.kind !== 'navbar') return this;
    this.options.tintTone = tintTone;
    this.appliedLabelColor = null;
    this.staticDirty = true;
    this.dirty = true;
    this.buildLabels();
    wake(34);
    return this;
  }

  setDisabled(disabled) {
    this.options.disabled = Boolean(disabled);
    this.container.tabIndex = disabled ? -1 : 0;
    this.container.style.cursor = disabled ? 'default' : 'pointer';
    this.container.setAttribute('aria-disabled', String(Boolean(disabled)));
    return this;
  }

  /** Re-resolve the backdrop and redraw on the next frame. */
  refresh() {
    if (this.destroyed) return this;
    this.layers = resolveLayers(normalizeBackdrop(this.options.backdrop), this.container);
    this.watchStyles();
    this.staticDirty = true;
    this.dirty = true;
    wake(64);
    return this;
  }

  /** Alias of `refresh()`, kept from 2.2. */
  updateBackdrop() {
    return this.refresh();
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    removeClient(this);
    this.resizeObserver?.disconnect();
    this.styleObserver?.disconnect();
    this.unsubscribeAssets?.();
    releaseGlass(this.baseGlass);
    releaseGlass(this.pressGlass);
    this.baseGlass = null;
    this.pressGlass = null;
    const { container } = this;
    container.removeEventListener('pointerdown', this.onPointerDown);
    container.removeEventListener('pointermove', this.onPointerMove);
    container.removeEventListener('pointerup', this.onPointerEnd);
    container.removeEventListener('pointercancel', this.onPointerEnd);
    container.removeEventListener('lostpointercapture', this.onPointerEnd);
    container.removeEventListener('keydown', this.onKeyDown);
    container.removeEventListener('focus', this.onFocusChange);
    container.removeEventListener('blur', this.onFocusChange);
    for (const node of [this.baseCanvas, this.trackCanvas, this.pressCanvas, this.restCanvas, this.labelLayer]) {
      node?.remove();
    }
    delete container.dataset.liquidGlassControl;
    for (const [property, value] of this.restore.reverse()) container.style[property] = value;
    for (const [attribute, value] of this.originalAttributes) {
      if (value === null) container.removeAttribute(attribute);
      else container.setAttribute(attribute, value);
    }
    if (registry.get(container) === this) registry.delete(container);
    this.settledWaiters.splice(0).forEach((resolve) => resolve());
  }
}

/** Segmented liquid glass navigation with two or more items. */
export class LiquidGlassNavbar extends LiquidGlassControl {
  constructor(container, options = {}) {
    super(container, options, 'navbar');
  }

  setValue(value, { notify = false } = {}) {
    return this.jumpTo(this.indexOf(value), notify);
  }
}

/** Draggable, keyboard-accessible liquid glass switch. */
export class LiquidGlassSwitch extends LiquidGlassControl {
  constructor(container, options = {}) {
    super(container, options, 'switch');
  }

  get checked() {
    return Boolean(this.value);
  }

  setChecked(checked, { notify = false } = {}) {
    return this.jumpTo(checked ? 1 : 0, notify);
  }
}
