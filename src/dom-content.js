// Page content under glass.
//
// `backdrop: 'auto'` paints what the browser paints below a glass element:
// the backgrounds, borders, images, video, canvas and text of the rest of the
// page, in CSS paint order and registered to where each one is on screen.
//
// The document is walked into a display list sorted by stacking order when
// layout changes (DOM mutations, resize, fonts, the end of a transition, or
// scrolling a viewport away from the text that was measured). Each surface
// then paints only the prefix of that list below itself, clipped to its
// region, so a live surface costs a filtered loop rather than a DOM walk.
//
// Not reproduced: ::before/::after, box-shadow, filters and blend modes on
// content, SVG, form controls, and rotated or scaled text.

import {
  LAYER_ATTRIBUTE, paintCssBackground, paintMedia, splitTop, transparentColor,
} from './dom-backdrop.js';
import { invalidateLayout } from './frame-loop.js';

const HOST_SELECTOR = '[data-liquid-glass], [data-liquid-glass-control]';
const SKIP_TAGS = new Set([
  'SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'HEAD', 'META', 'LINK', 'TITLE', 'BR', 'WBR',
  'IFRAME', 'OBJECT', 'EMBED', 'INPUT', 'TEXTAREA', 'SELECT', 'OPTION', 'BUTTON',
]);
const MEDIA_TAGS = new Set(['IMG', 'VIDEO', 'CANVAS']);
const XHTML = 'http://www.w3.org/1999/xhtml';
// Paint levels inside one stacking context, between negative and zero
// z-index: block backgrounds first, then inline content.
const BLOCK = -0.6;
const INLINE = -0.4;

let list = null;
let dirty = true;
let listening = false;
let measureContext = null;
const fontMetricsCache = new Map();

/** Stacking keys: [[level, order], …] from the root context down. */
function compareKeys(a, b) {
  const depth = Math.min(a.length, b.length);
  for (let i = 0; i < depth; i++) {
    if (a[i][0] !== b[i][0]) return a[i][0] - b[i][0];
    if (a[i][1] !== b[i][1]) return a[i][1] - b[i][1];
  }
  return a.length - b.length;
}

const hasBackground = (style) => style.backgroundImage !== 'none' || !transparentColor(style.backgroundColor);

const hasBorder = (style) => ['Top', 'Right', 'Bottom', 'Left'].some((side) => (
  parseFloat(style[`border${side}Width`]) > 0
  && style[`border${side}Style`] !== 'none'
  && !transparentColor(style[`border${side}Color`])
));

function createsStackingContext(style, positioned) {
  return (positioned && style.zIndex !== 'auto')
    || style.position === 'fixed' || style.position === 'sticky'
    || Number(style.opacity) < 1
    || style.transform !== 'none'
    || style.filter !== 'none'
    || style.isolation === 'isolate'
    || style.mixBlendMode !== 'normal'
    || (style.backdropFilter && style.backdropFilter !== 'none')
    || /paint|strict|content/.test(style.contain || '');
}

function fontOf(style) {
  const fontStyle = style.fontStyle.startsWith('oblique') ? 'italic' : style.fontStyle;
  const caps = style.fontVariantCaps === 'small-caps' ? 'small-caps ' : '';
  return `${fontStyle} ${caps}${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
}

function fontMetrics(font, size) {
  let metrics = fontMetricsCache.get(font);
  if (metrics) return metrics;
  measureContext ??= document.createElement('canvas').getContext('2d');
  measureContext.font = font;
  const measured = measureContext.measureText('Hg');
  metrics = {
    ascent: measured.fontBoundingBoxAscent ?? size * 0.8,
    descent: measured.fontBoundingBoxDescent ?? size * 0.2,
  };
  fontMetricsCache.set(font, metrics);
  return metrics;
}

function firstTextShadow(value) {
  if (!value || value === 'none') return null;
  const tokens = splitTop(splitTop(value, ',')[0], ' ');
  const color = tokens.find((token) => !/^-?[\d.]+(px)?$/.test(token));
  const lengths = tokens.filter((token) => /^-?[\d.]+(px)?$/.test(token)).map(parseFloat);
  if (!color || lengths.length < 2) return null;
  return { color, x: lengths[0], y: lengths[1], blur: lengths[2] ?? 0 };
}

function transformText(text, transform) {
  if (transform === 'uppercase') return text.toUpperCase();
  if (transform === 'lowercase') return text.toLowerCase();
  if (transform === 'capitalize') return text.replace(/^\p{L}/u, (letter) => letter.toUpperCase());
  return text;
}

const intersects = (box, area) => box.x < area.x + area.width && box.x + box.width > area.x
  && box.y < area.y + area.height && box.y + box.height > area.y;

function build() {
  const scrollX = globalThis.scrollX || 0;
  const scrollY = globalThis.scrollY || 0;
  const width = globalThis.innerWidth || document.documentElement.clientWidth;
  const height = globalThis.innerHeight || document.documentElement.clientHeight;
  // Text is measured for the viewport and one viewport around it; boxes and
  // media are cheap to keep for the whole document.
  const band = { x: -width * 0.5, y: -height, width: width * 2, height: height * 3 };
  const items = [];
  const hosts = new Map();
  const range = document.createRange();
  let order = 0;

  const rootStyle = getComputedStyle(document.documentElement);
  const rootPainted = hasBackground(rootStyle);

  function textItem(node, style, key, alpha, fixed) {
    const data = node.data;
    if (!/\S/.test(data)) return;
    const fill = style.webkitTextFillColor || style.color;
    const strokeWidth = parseFloat(style.webkitTextStrokeWidth) || 0;
    if (transparentColor(fill) && !(strokeWidth > 0)) return;
    range.selectNodeContents(node);
    const whole = range.getBoundingClientRect();
    if (!whole.width || !intersects({ x: whole.left, y: whole.top, width: whole.width, height: whole.height }, band)) return;
    const offsetX = fixed ? 0 : scrollX;
    const offsetY = fixed ? 0 : scrollY;
    const words = [];
    const pushRect = (text, rect) => {
      if (rect.width > 0) {
        words.push({
          text: transformText(text, style.textTransform),
          x: rect.left + offsetX, y: rect.top + offsetY, width: rect.width, height: rect.height,
        });
      }
    };
    const pattern = /\S+/g;
    for (let match = pattern.exec(data); match; match = pattern.exec(data)) {
      range.setStart(node, match.index);
      range.setEnd(node, match.index + match[0].length);
      const rects = range.getClientRects();
      if (rects.length <= 1) {
        if (rects.length) pushRect(match[0], rects[0]);
        continue;
      }
      // A word broken across lines: one run per line fragment.
      let run = '';
      let runRect = null;
      for (let i = 0; i < match[0].length; i++) {
        range.setStart(node, match.index + i);
        range.setEnd(node, match.index + i + 1);
        const rect = range.getBoundingClientRect();
        if (runRect && Math.abs(rect.top - runRect.top) > 1) {
          pushRect(run, runRect);
          run = '';
          runRect = null;
        }
        run += match[0][i];
        runRect = runRect
          ? { left: runRect.left, top: runRect.top, width: rect.right - runRect.left, height: runRect.height }
          : { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
      }
      if (runRect) pushRect(run, runRect);
    }
    if (!words.length) return;
    items.push({
      type: 'text', key, fixed, alpha, words,
      box: { x: whole.left + offsetX, y: whole.top + offsetY, width: whole.width, height: whole.height },
      font: fontOf(style),
      size: parseFloat(style.fontSize) || 16,
      fill: transparentColor(fill) ? null : fill,
      stroke: strokeWidth > 0 ? { width: strokeWidth, color: style.webkitTextStrokeColor } : null,
      letterSpacing: style.letterSpacing !== 'normal' ? style.letterSpacing : '',
      shadow: firstTextShadow(style.textShadow),
    });
  }

  function visit(element, path, alpha, fixed, paintSelf = true) {
    if (element.namespaceURI !== XHTML) return;
    const tag = element.tagName.toUpperCase();
    // Glass layer canvases are not skipped: a surface above another glass
    // element refracts that element's rendered glass like any other canvas.
    if (SKIP_TAGS.has(tag)) return;
    const style = getComputedStyle(element);
    if (style.display === 'none' || style.display === 'contents' && !element.childNodes.length) return;
    const positioned = style.position !== 'static';
    const context = createsStackingContext(style, positioned);
    const zIndex = Number.parseInt(style.zIndex, 10);
    const level = positioned && Number.isFinite(zIndex)
      ? zIndex
      : positioned || context ? 0 : style.display.startsWith('inline') ? INLINE : BLOCK;
    const key = [...path, [level, order++]];
    const isFixed = fixed || style.position === 'fixed';
    // A glass element is recorded and then walked like anything else, so a
    // control nested in a glass card sees the card's glass and its text.
    // Its own CSS background is under that glass, so it is not painted.
    if (element.matches(HOST_SELECTOR)) {
      hosts.set(element, key);
      if (element.getAttribute('data-liquid-glass') !== 'fallback') paintSelf = false;
    }
    const opacity = Number(style.opacity);
    const childAlpha = alpha * (Number.isFinite(opacity) ? opacity : 1);
    const visible = style.visibility === 'visible' && childAlpha > 0.004;
    const media = MEDIA_TAGS.has(tag);
    if (paintSelf && visible && (media || hasBackground(style) || hasBorder(style))) {
      const rect = element.getBoundingClientRect();
      if (rect.width && rect.height) {
        items.push({
          type: media ? 'media' : 'box', element, key, fixed: isFixed, alpha,
          box: {
            x: rect.left + (isFixed ? 0 : scrollX), y: rect.top + (isFixed ? 0 : scrollY),
            width: rect.width, height: rect.height,
          },
        });
      }
    }
    if (media) return;
    // A positioned element paints its content as one unit at its own level,
    // as if it were a stacking context (CSS 2.1 Appendix E), so its text and
    // children stay above its background.
    const childPath = context || positioned ? key : path;
    for (const child of element.childNodes) {
      if (child.nodeType === 1) {
        visit(child, childPath, childAlpha, isFixed);
      } else if (child.nodeType === 3 && visible) {
        textItem(child, style, [...childPath, [INLINE, order++]], childAlpha, isFixed);
      }
    }
  }

  // The root background is its own layer; body only paints when the root
  // has a background of its own (otherwise body's propagates to the root).
  if (document.body) visit(document.body, [], 1, false, rootPainted);
  items.sort((a, b) => compareKeys(a.key, b.key));
  return { items, hosts, scrollX, scrollY, width, height };
}

function current() {
  const width = globalThis.innerWidth || 0;
  const height = globalThis.innerHeight || 0;
  const drifted = list && (
    Math.abs((globalThis.scrollY || 0) - list.scrollY) > height * 0.5
    || Math.abs((globalThis.scrollX || 0) - list.scrollX) > width * 0.25
    || width !== list.width || height !== list.height
  );
  if (!list || dirty || drifted) {
    list = build();
    dirty = false;
  }
  return list;
}

function invalidate() {
  if (dirty) return;
  dirty = true;
  invalidateLayout();
}

function listen() {
  if (listening || typeof document === 'undefined') return;
  listening = true;
  if (typeof MutationObserver === 'function') {
    new MutationObserver((records) => {
      for (const record of records) {
        const node = record.target.nodeType === 1 ? record.target : record.target.parentElement;
        // The library restyles its own layers while drawing; that is not a
        // layout change.
        if (!node || (record.type === 'attributes' && node.closest(`[${LAYER_ATTRIBUTE}]`))) continue;
        invalidate();
        return;
      }
    }).observe(document.documentElement, {
      subtree: true, childList: true, characterData: true,
      attributes: true, attributeFilter: ['style', 'class', 'hidden', 'src', 'open'],
    });
  }
  // Scrolling an element (not the window) moves the content inside it.
  globalThis.addEventListener('scroll', (event) => {
    if (event.target !== document && event.target !== document.documentElement) invalidate();
  }, { capture: true, passive: true });
  globalThis.addEventListener('resize', invalidate, { passive: true });
  for (const type of ['transitionend', 'transitioncancel', 'animationend', 'load']) {
    document.addEventListener(type, invalidate, true);
  }
  const fontsChanged = () => {
    fontMetricsCache.clear();
    invalidate();
  };
  document.fonts?.addEventListener?.('loadingdone', fontsChanged);
  document.fonts?.ready?.then(fontsChanged);
}

function paintText(context, item, offsetX, offsetY, region) {
  const { ascent, descent } = fontMetrics(item.font, item.size);
  context.font = item.font;
  context.textBaseline = 'alphabetic';
  context.textAlign = 'left';
  if (item.letterSpacing && 'letterSpacing' in context) context.letterSpacing = item.letterSpacing;
  if (item.shadow) {
    context.shadowColor = item.shadow.color;
    context.shadowOffsetX = item.shadow.x;
    context.shadowOffsetY = item.shadow.y;
    context.shadowBlur = item.shadow.blur;
  }
  if (item.fill) context.fillStyle = item.fill;
  if (item.stroke) {
    context.strokeStyle = item.stroke.color;
    context.lineWidth = item.stroke.width;
  }
  const right = region.x + region.width;
  const bottom = region.y + region.height;
  for (const word of item.words) {
    const x = word.x + offsetX;
    const top = word.y + offsetY;
    if (x > right || x + word.width < region.x || top > bottom || top + word.height < region.y) continue;
    // A text range's box is the font's content area, so its baseline sits
    // one ascent below the top however tall the line box is.
    const y = top + (word.height - (ascent + descent)) / 2 + ascent;
    if (item.fill) context.fillText(word.text, x, y);
    if (item.stroke) context.strokeText(word.text, x, y);
  }
}

function itemsBelow(host) {
  let state = current();
  let hostKey = state.hosts.get(host);
  if (!hostKey) {
    // Mounted after the list was built.
    dirty = true;
    state = current();
    hostKey = state.hosts.get(host);
  }
  if (!hostKey) return { state, end: 0 };
  let low = 0;
  let high = state.items.length;
  while (low < high) {
    const middle = (low + high) >> 1;
    if (compareKeys(state.items[middle].key, hostKey) < 0) low = middle + 1;
    else high = middle;
  }
  return { state, end: low };
}

/**
 * Paints the page content below `host` into `context` (already in viewport
 * CSS pixels) for `region`. Returns false while an image is still loading.
 */
export function paintPageContent(context, region, host) {
  listen();
  const { state, end } = itemsBelow(host);
  const scrollX = globalThis.scrollX || 0;
  const scrollY = globalThis.scrollY || 0;
  let settled = true;
  for (let i = 0; i < end; i++) {
    const item = state.items[i];
    const offsetX = item.fixed ? 0 : -scrollX;
    const offsetY = item.fixed ? 0 : -scrollY;
    if (!intersects({ ...item.box, x: item.box.x + offsetX, y: item.box.y + offsetY }, region)) continue;
    context.save();
    context.globalAlpha *= item.alpha;
    try {
      if (item.type === 'text') {
        paintText(context, item, offsetX, offsetY, region);
      } else if (item.type === 'media') {
        paintMedia(context, { element: item.element }, region);
      } else {
        settled = paintCssBackground(context, item.element, region) && settled;
        paintBorder(context, item.element);
      }
    } finally {
      context.restore();
    }
  }
  return settled;
}

function paintBorder(context, element) {
  const style = getComputedStyle(element);
  const width = parseFloat(style.borderTopWidth) || 0;
  if (!(width > 0) || style.borderTopStyle === 'none' || transparentColor(style.borderTopColor)) return;
  const rect = element.getBoundingClientRect();
  const radius = Math.max(0, (parseFloat(style.borderTopLeftRadius) || 0) - width / 2);
  context.save();
  context.globalAlpha *= Number(style.opacity) || 1;
  context.strokeStyle = style.borderTopColor;
  context.lineWidth = width;
  context.beginPath();
  const x = rect.left + width / 2;
  const y = rect.top + width / 2;
  const w = Math.max(0, rect.width - width);
  const h = Math.max(0, rect.height - width);
  if (radius > 0 && typeof context.roundRect === 'function') context.roundRect(x, y, w, h, Math.min(radius, w / 2, h / 2));
  else context.rect(x, y, w, h);
  context.stroke();
  context.restore();
}

/** Whether a canvas or playing video is painted below `host`. */
export function pageContentIsLive(host) {
  if (!list) return false;
  const { state, end } = itemsBelow(host);
  const rect = host.getBoundingClientRect();
  const near = { x: rect.left - 96, y: rect.top - 96, width: rect.width + 192, height: rect.height + 192 };
  const scrollX = globalThis.scrollX || 0;
  const scrollY = globalThis.scrollY || 0;
  for (let i = 0; i < end; i++) {
    const { type, element, box, fixed } = state.items[i];
    if (type !== 'media') continue;
    if (!intersects({ ...box, x: box.x - (fixed ? 0 : scrollX), y: box.y - (fixed ? 0 : scrollY) }, near)) continue;
    if (element.tagName === 'CANVAS') return true;
    if (element.tagName === 'VIDEO' && !element.paused && !element.ended) return true;
  }
  return false;
}

/** Forget the display list; the next paint walks the page again. */
export function invalidatePageContent() {
  invalidate();
}
