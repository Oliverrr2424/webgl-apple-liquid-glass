import { LiquidGlassWebGLV2 } from './v2.js?controls=1';
import { getDefaultMaterialV2 } from './v2-material.js?controls=1';

const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));

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

function setStyles(element, styles) {
  Object.assign(element.style, styles);
  return element;
}

function makeCanvas(host, { hidden = false, zIndex = 0 } = {}) {
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  setStyles(canvas, {
    position: hidden ? 'absolute' : 'absolute',
    inset: '0',
    width: '100%',
    height: '100%',
    display: hidden ? 'none' : 'block',
    pointerEvents: 'none',
    zIndex: String(zIndex),
  });
  host.appendChild(canvas);
  return canvas;
}

function sizeCanvas(canvas, width, height, dpr) {
  const pixelWidth = Math.max(1, Math.round(width * dpr));
  const pixelHeight = Math.max(1, Math.round(height * dpr));
  if (canvas.width !== pixelWidth) canvas.width = pixelWidth;
  if (canvas.height !== pixelHeight) canvas.height = pixelHeight;
}

function roundRect(context, x, y, width, height, radius = height / 2) {
  context.beginPath();
  context.roundRect(x, y, width, height, Math.min(radius, width / 2, height / 2));
}

function drawCover(context, source, width, height) {
  const sourceWidth = Number(source?.videoWidth || source?.naturalWidth || source?.width || 0);
  const sourceHeight = Number(source?.videoHeight || source?.naturalHeight || source?.height || 0);
  if (!(sourceWidth > 0) || !(sourceHeight > 0)) return false;
  const scale = Math.max(width / sourceWidth, height / sourceHeight);
  const drawWidth = sourceWidth * scale;
  const drawHeight = sourceHeight * scale;
  context.drawImage(source, (width - drawWidth) / 2, (height - drawHeight) / 2, drawWidth, drawHeight);
  return true;
}

function loadImage(source) {
  if (typeof source !== 'string') return Promise.resolve(source);
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Unable to load liquid-glass control backdrop: ${source}`));
    image.src = source;
  });
}

function pressureSpring(state, target, seconds, stiffness, damping) {
  state.velocity += (target - state.value) * stiffness * seconds;
  state.velocity *= Math.exp(-damping * seconds);
  state.value += state.velocity * seconds;
}

class LiquidGlassControl {
  constructor(container, options, kind) {
    if (!(container instanceof HTMLElement)) {
      throw new TypeError('Liquid glass controls need an HTMLElement container.');
    }
    this.container = container;
    this.options = options ?? {};
    this.kind = kind;
    this.destroyed = false;
    this.backdrop = null;
    this.frameId = 0;
    this.lastTime = 0;
    this.dragging = false;
    this.staticDirty = true;
    this.amount = { value: 0, velocity: 0 };
    this.position = { value: kind === 'switch'
      ? (this.options.checked ? 1 : 0)
      : this.resolveNavbarIndex(this.options.value), velocity: 0 };
    this.positionTarget = this.position.value;
    this.value = kind === 'switch'
      ? Boolean(this.position.value)
      : this.navbarItems()[this.position.value].value;
    this.material = { ...getDefaultMaterialV2(), ...(this.options.material ?? {}) };
    this.lens = { ...DEFAULT_NAVIGATION_LENS, ...(this.options.lens ?? {}) };

    this.original = {
      style: {
        position: container.style.position,
        width: container.style.width,
        height: container.style.height,
        touchAction: container.style.touchAction,
        userSelect: container.style.userSelect,
        cursor: container.style.cursor,
      },
      tabIndex: container.getAttribute('tabindex'),
      role: container.getAttribute('role'),
      ariaChecked: container.getAttribute('aria-checked'),
      ariaLabel: container.getAttribute('aria-label'),
      ariaDisabled: container.getAttribute('aria-disabled'),
    };
    const computedPosition = getComputedStyle(container).position;
    this.changedPosition = computedPosition === 'static';
    if (this.changedPosition) container.style.position = 'relative';
    if (!container.style.width) container.style.width = kind === 'navbar' ? '360px' : '230px';
    if (!container.style.height) container.style.height = kind === 'navbar' ? '144px' : '150px';
    container.dataset.liquidGlassControl = kind;
    container.style.touchAction = 'none';
    container.style.userSelect = 'none';
    container.style.cursor = this.options.disabled ? 'default' : 'pointer';
    container.tabIndex = this.options.disabled ? -1 : (container.tabIndex >= 0 ? container.tabIndex : 0);

    this.backdropCanvas = makeCanvas(container, { zIndex: 0 });
    this.baseCanvas = makeCanvas(container, { zIndex: 1 });
    this.trackCanvas = makeCanvas(container, { zIndex: 2 });
    this.pressCanvas = makeCanvas(container, { zIndex: 3 });
    this.restCanvas = makeCanvas(container, { zIndex: 4 });
    this.compositeCanvas = makeCanvas(container, { hidden: true });
    this.labelLayer = setStyles(document.createElement('div'), {
      position: 'absolute', inset: '0', zIndex: '5', pointerEvents: 'none',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    });
    container.appendChild(this.labelLayer);

    this.supported = LiquidGlassWebGLV2.isSupported();
    this.baseGlass = this.supported ? new LiquidGlassWebGLV2(this.baseCanvas, {
      material: this.material,
      compositeMode: 'overlay',
      autoResize: false,
    }) : null;
    this.pressGlass = this.supported ? new LiquidGlassWebGLV2(this.pressCanvas, {
      material: getPressedControlMaterialV2(this.material),
      compositeMode: 'overlay',
      autoResize: false,
    }) : null;

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

    this.resizeObserver = typeof ResizeObserver === 'function'
      ? new ResizeObserver(() => this.layout())
      : null;
    this.resizeObserver?.observe(container);
    this.layout();
    this.ready = this.setBackdrop(this.options.backdrop ?? null);
  }

  navbarItems() {
    const items = this.options.items ?? [
      { value: 'first', label: 'First' },
      { value: 'second', label: 'Second' },
    ];
    if (!Array.isArray(items) || items.length !== 2) {
      throw new TypeError('LiquidGlassNavbar currently requires exactly two items.');
    }
    return items.map((item, index) => typeof item === 'string'
      ? { value: item, label: item }
      : { value: item.value ?? String(index), label: item.label ?? String(item.value ?? index), icon: item.icon });
  }

  resolveNavbarIndex(value) {
    const index = this.navbarItems().findIndex((item) => item.value === value);
    return index < 0 ? 0 : index;
  }

  layout() {
    if (this.destroyed) return;
    const width = Math.max(1, this.container.clientWidth || parseFloat(this.container.style.width) || 1);
    const height = Math.max(1, this.container.clientHeight || parseFloat(this.container.style.height) || 1);
    const dpr = Math.min(devicePixelRatio || 1, 2);
    this.size = { width, height, dpr };
    for (const canvas of [this.backdropCanvas, this.trackCanvas, this.restCanvas, this.compositeCanvas]) {
      sizeCanvas(canvas, width, height, dpr);
    }
    const requestedWidth = Number(this.options.width ?? (this.kind === 'navbar' ? 312 : 190));
    const requestedHeight = Number(this.options.height ?? (this.kind === 'navbar' ? 96 : 70));
    const controlWidth = Math.min(requestedWidth, Math.max(40, width - 16));
    const controlHeight = Math.min(requestedHeight, Math.max(30, height - 24));
    this.track = {
      x: (width - controlWidth) / 2,
      y: (height - controlHeight) / 2,
      w: controlWidth,
      h: controlHeight,
    };
    this.staticDirty = true;
    this.buildLabels();
    this.render();
  }

  async setBackdrop(source) {
    this.backdrop = await loadImage(source);
    if (!this.destroyed) {
      this.staticDirty = true;
      this.render();
    }
    return this;
  }

  setMaterial(material) {
    this.material = { ...this.material, ...(material ?? {}) };
    this.baseGlass?.setMaterial(this.material, false);
    this.pressGlass?.setMaterial(getPressedControlMaterialV2(this.material), false);
    this.staticDirty = true;
    this.render();
    return this;
  }

  updateBackdrop() {
    this.staticDirty = true;
    this.render();
    return this;
  }

  thumbGeometry(amount = this.amount.value) {
    const track = this.track;
    const inset = track.h * 0.08;
    const restingWidth = this.kind === 'navbar'
      ? track.w * 0.5 - inset
      : track.w * 0.65;
    const restingHeight = track.h * 0.84;
    const travel = Math.max(0, track.w - restingWidth - inset * 2);
    const restingX = track.x + inset + travel * clamp(this.position.value);
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
    const overtravel = this.kind === 'navbar'
      ? Math.max(0, (h - track.h) / 2)
      : Math.max(18, track.h * 0.42);
    const anchoredX = track.x - overtravel
      + (track.w + overtravel * 2 - w) * clamp(this.position.value);
    return {
      x: centeredX + (anchoredX - centeredX) * amount,
      y: restingY - (h - restingHeight) / 2,
      w,
      h,
    };
  }

  drawBackdrop() {
    const { width, height, dpr } = this.size;
    const context = this.backdropCanvas.getContext('2d');
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.clearRect(0, 0, width, height);
    if (!drawCover(context, this.backdrop, width, height)) {
      const gradient = context.createLinearGradient(0, 0, width, height);
      gradient.addColorStop(0, '#334a66');
      gradient.addColorStop(0.5, '#172437');
      gradient.addColorStop(1, '#6d4a38');
      context.fillStyle = gradient;
      context.fillRect(0, 0, width, height);
    }
  }

  drawTrack() {
    const { width, height, dpr } = this.size;
    const context = this.trackCanvas.getContext('2d');
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.clearRect(0, 0, width, height);
    if (this.kind === 'navbar' && this.supported) return;
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
      context.globalAlpha = clamp(this.position.value);
      const green = context.createLinearGradient(x, y, x + w, y + h);
      green.addColorStop(0, '#34d86a');
      green.addColorStop(1, '#25c653');
      context.fillStyle = green;
      context.fill();
    } else {
      context.fillStyle = 'rgba(225,230,238,.48)';
      context.fill();
      context.strokeStyle = 'rgba(255,255,255,.4)';
      context.stroke();
    }
    context.restore();
  }

  drawRestingThumb() {
    const { width, height, dpr } = this.size;
    const context = this.restCanvas.getContext('2d');
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.clearRect(0, 0, width, height);
    const thumb = this.thumbGeometry(0);
    const opacity = 1 - clamp(this.amount.value);
    if (opacity <= 0.001) return;
    context.save();
    context.globalAlpha = opacity;
    context.shadowColor = 'rgba(0,0,0,.16)';
    context.shadowBlur = thumb.h * 0.13;
    context.shadowOffsetY = thumb.h * 0.04;
    roundRect(context, thumb.x, thumb.y, thumb.w, thumb.h);
    const fill = context.createLinearGradient(thumb.x, thumb.y, thumb.x, thumb.y + thumb.h);
    if (this.kind === 'navbar') {
      fill.addColorStop(0, 'rgba(174,178,186,.88)');
      fill.addColorStop(1, 'rgba(145,149,158,.82)');
    } else {
      fill.addColorStop(0, 'rgba(255,255,255,.98)');
      fill.addColorStop(1, 'rgba(238,239,242,.95)');
    }
    context.fillStyle = fill;
    context.fill();
    context.restore();
  }

  renderBase() {
    if (!this.baseGlass) return;
    this.baseGlass.setBackdrop(this.backdropCanvas, { update: 'static', autoStart: false, shouldRender: false });
    this.baseGlass.setElements(this.kind === 'navbar' ? [{
      id: 'navbar-track', shape: 'pill', ...this.track, tint: 0.86, tintTone: 'light',
    }] : [], false);
    this.baseGlass.render({ force: true, dpr: this.size.dpr });
  }

  composePressedBackdrop() {
    const context = this.compositeCanvas.getContext('2d');
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, this.compositeCanvas.width, this.compositeCanvas.height);
    context.drawImage(this.backdropCanvas, 0, 0);
    context.drawImage(this.baseCanvas, 0, 0);
    context.drawImage(this.trackCanvas, 0, 0);
  }

  renderPressed() {
    if (!this.pressGlass) return;
    this.pressGlass.setBackdrop(this.compositeCanvas, { update: 'static', autoStart: false, shouldRender: false });
    if (this.amount.value <= 0.001) {
      this.pressGlass.setElements([], false);
    } else {
      const geometry = this.thumbGeometry();
      this.pressGlass.setElements([{
        id: `${this.kind}-pressed-thumb`,
        shape: 'pill',
        ...geometry,
        tint: 0,
        frost: 0,
        opacity: clamp(this.amount.value),
        pressure: this.kind === 'navbar' ? clamp(this.amount.value) : 0,
        pressureAxes: this.kind === 'navbar'
          ? [1 - this.lens.innerLength, 1 - this.lens.innerHeight]
          : [1, 1],
        tintTone: 'light',
      }], false);
    }
    this.pressGlass.render({ force: true, dpr: this.size.dpr });
  }

  render() {
    if (this.destroyed || !this.size) return this;
    if (this.staticDirty) {
      this.drawBackdrop();
      this.renderBase();
      this.staticDirty = false;
    }
    this.drawTrack();
    this.composePressedBackdrop();
    this.renderPressed();
    this.drawRestingThumb();
    this.updateAccessibility();
    return this;
  }

  buildLabels() {
    this.labelLayer.replaceChildren();
    if (this.kind !== 'navbar') return;
    const items = this.navbarItems();
    items.forEach((item, index) => {
      const label = document.createElement('span');
      label.dataset.index = String(index);
      label.setAttribute('role', 'tab');
      label.textContent = `${item.icon ? `${item.icon}  ` : ''}${item.label}`;
      setStyles(label, {
        position: 'absolute',
        left: `${this.track.x + this.track.w * index / 2}px`,
        top: `${this.track.y}px`,
        width: `${this.track.w / 2}px`,
        height: `${this.track.h}px`,
        display: 'grid',
        placeItems: 'center',
        color: this.options.labelColor ?? 'rgba(22,25,31,.9)',
        fontSize: `${this.options.fontSize ?? Math.max(13, this.track.h * 0.19)}px`,
        fontWeight: '650',
        whiteSpace: 'nowrap',
        pointerEvents: 'none',
      });
      this.labelLayer.appendChild(label);
    });
  }

  progressForPointer(event) {
    const rect = this.container.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const thumb = this.thumbGeometry(0);
    const inset = this.track.h * 0.08;
    const travel = Math.max(1, this.track.w - thumb.w - inset * 2);
    return clamp((x - this.track.x - inset - thumb.w / 2) / travel);
  }

  pointerDown(event) {
    if (this.options.disabled || event.button !== 0) return;
    const bounds = this.container.getBoundingClientRect();
    const x = event.clientX - bounds.left;
    const y = event.clientY - bounds.top;
    if (x < this.track.x || x > this.track.x + this.track.w
      || y < this.track.y || y > this.track.y + this.track.h) return;
    event.preventDefault();
    this.dragging = true;
    this.positionTarget = this.progressForPointer(event);
    this.container.setPointerCapture?.(event.pointerId);
    this.container.focus({ preventScroll: true });
    this.startAnimation();
  }

  pointerMove(event) {
    if (!this.dragging) return;
    event.preventDefault();
    this.positionTarget = this.progressForPointer(event);
    this.startAnimation();
  }

  pointerEnd(event) {
    if (!this.dragging) return;
    event.preventDefault();
    this.dragging = false;
    this.positionTarget = this.positionTarget >= 0.5 ? 1 : 0;
    this.commitValue(this.positionTarget);
    this.startAnimation();
  }

  keyDown(event) {
    if (this.options.disabled) return;
    let next = null;
    if (event.key === 'ArrowLeft' || event.key === 'Home') next = 0;
    if (event.key === 'ArrowRight' || event.key === 'End') next = 1;
    if (this.kind === 'switch' && (event.key === ' ' || event.key === 'Enter')) next = this.positionTarget ? 0 : 1;
    if (next === null) return;
    event.preventDefault();
    this.positionTarget = next;
    this.commitValue(next);
    this.startAnimation();
  }

  commitValue(index, notify = true) {
    const previous = this.value;
    this.value = this.kind === 'switch' ? Boolean(index) : this.navbarItems()[index].value;
    if (notify && previous !== this.value) {
      this.options.onChange?.(this.value, this.kind === 'switch' ? undefined : index);
      this.container.dispatchEvent(new CustomEvent('change', {
        detail: { value: this.value, index: this.kind === 'switch' ? undefined : index },
        bubbles: true,
      }));
    }
    this.updateAccessibility();
  }

  updateAccessibility() {
    if (this.kind === 'switch') {
      this.container.setAttribute('role', 'switch');
      this.container.setAttribute('aria-checked', String(Boolean(this.value)));
      this.container.setAttribute('aria-label', this.options.ariaLabel ?? 'Liquid glass switch');
    } else {
      this.container.setAttribute('role', 'tablist');
      this.container.setAttribute('aria-label', this.options.ariaLabel ?? 'Liquid glass navigation');
      for (const label of this.labelLayer.children) {
        label.setAttribute('aria-selected', String(Number(label.dataset.index) === Math.round(this.positionTarget)));
      }
    }
  }

  startAnimation() {
    if (this.frameId || this.destroyed) return;
    this.lastTime = performance.now();
    this.frameId = requestAnimationFrame((now) => this.tick(now));
  }

  tick(now) {
    this.frameId = 0;
    if (this.destroyed) return;
    const seconds = Math.min(0.034, Math.max(0.001, (now - this.lastTime) / 1000));
    this.lastTime = now;
    const reduceMotion = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
    const amountTarget = this.dragging ? 1 : 0;
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
    this.position.value = clamp(this.position.value);
    this.render();
    const settled = Math.abs(this.amount.value - amountTarget) < 0.004
      && Math.abs(this.amount.velocity) < 0.018
      && Math.abs(this.position.value - this.positionTarget) < 0.003
      && Math.abs(this.position.velocity) < 0.018;
    if (!settled) this.frameId = requestAnimationFrame((next) => this.tick(next));
    else {
      this.amount.value = amountTarget;
      this.position.value = this.positionTarget;
      this.render();
    }
  }

  setDisabled(disabled) {
    this.options.disabled = Boolean(disabled);
    this.container.tabIndex = disabled ? -1 : 0;
    this.container.style.cursor = disabled ? 'default' : 'pointer';
    this.container.setAttribute('aria-disabled', String(Boolean(disabled)));
    return this;
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    if (this.frameId) cancelAnimationFrame(this.frameId);
    this.resizeObserver?.disconnect();
    this.baseGlass?.destroy();
    this.pressGlass?.destroy();
    this.container.removeEventListener('pointerdown', this.onPointerDown);
    this.container.removeEventListener('pointermove', this.onPointerMove);
    this.container.removeEventListener('pointerup', this.onPointerEnd);
    this.container.removeEventListener('pointercancel', this.onPointerEnd);
    this.container.removeEventListener('lostpointercapture', this.onPointerEnd);
    this.container.removeEventListener('keydown', this.onKeyDown);
    for (const element of [
      this.backdropCanvas, this.baseCanvas, this.trackCanvas,
      this.pressCanvas, this.restCanvas, this.compositeCanvas, this.labelLayer,
    ]) element.remove();
    delete this.container.dataset.liquidGlassControl;
    Object.assign(this.container.style, this.original.style);
    for (const [attribute, value] of [
      ['tabindex', this.original.tabIndex],
      ['role', this.original.role],
      ['aria-checked', this.original.ariaChecked],
      ['aria-label', this.original.ariaLabel],
      ['aria-disabled', this.original.ariaDisabled],
    ]) {
      if (value === null) this.container.removeAttribute(attribute);
      else this.container.setAttribute(attribute, value);
    }
  }
}

/** Two-item, draggable liquid-glass navigation control. */
export class LiquidGlassNavbar extends LiquidGlassControl {
  constructor(container, options = {}) {
    super(container, options, 'navbar');
  }

  setValue(value, { notify = false } = {}) {
    const index = this.resolveNavbarIndex(value);
    this.positionTarget = index;
    this.position.value = index;
    this.commitValue(index, notify);
    this.render();
    return this;
  }
}

/** Draggable, keyboard-accessible liquid-glass switch. */
export class LiquidGlassSwitch extends LiquidGlassControl {
  constructor(container, options = {}) {
    super(container, options, 'switch');
  }

  get checked() { return Boolean(this.value); }

  setChecked(checked, { notify = false } = {}) {
    const index = checked ? 1 : 0;
    this.positionTarget = index;
    this.position.value = index;
    this.commitValue(index, notify);
    this.render();
    return this;
  }
}
