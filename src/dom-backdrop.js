// What is behind a glass surface.
//
// Browsers never expose composited page pixels to WebGL, so a DOM-bound
// surface is handed a *description* of its backdrop instead: page elements
// (<img>, <video>, <canvas>, or any element's CSS background), detached
// images and canvases, and painter callbacks. This module paints that
// description for any viewport rectangle, registered to where the browser
// actually laid everything out, so the glass refracts what is really under it.

// dom-content.js imports helpers from this module and this module paints its
// display list; the cycle is safe because neither side calls the other while
// the modules are still evaluating.
import { paintPageContent, pageContentIsLive } from './dom-content.js';

export const LAYER_ATTRIBUTE = 'data-liquid-glass-layer';

const IMAGE_URL = /(^(data|blob|https?):)|\/|\.(avif|webp|png|apng|jpe?g|gif|svg|bmp|ico)([?#]|$)/i;
const MEDIA_TAGS = new Set(['IMG', 'VIDEO', 'CANVAS']);

export const isElement = (value) => typeof Element !== 'undefined' && value instanceof Element;

// ---------------------------------------------------------------------------
// Image loading. One cache for every surface; a finished load invalidates the
// surfaces that were waiting for it.

const images = new Map();
const assetListeners = new Set();

export function onBackdropAsset(listener) {
  assetListeners.add(listener);
  return () => assetListeners.delete(listener);
}

function imageEntry(url) {
  let entry = images.get(url);
  if (entry) return entry;
  const image = new Image();
  // Same-origin and data/blob URLs are unaffected; a cross-origin image must
  // be served with CORS or it would taint the backdrop texture.
  image.crossOrigin = 'anonymous';
  image.decoding = 'async';
  entry = { url, image, state: 'loading' };
  entry.promise = new Promise((resolve) => {
    image.onload = () => {
      entry.state = 'ready';
      resolve(entry);
      assetListeners.forEach((listener) => listener(entry));
    };
    image.onerror = () => {
      entry.state = 'error';
      console.warn(`LiquidGlass: could not load backdrop image ${url} (a cross-origin image needs CORS headers).`);
      resolve(entry);
      assetListeners.forEach((listener) => listener(entry));
    };
  });
  image.src = url;
  images.set(url, entry);
  return entry;
}

export function mediaSize(source) {
  if (!source) return [0, 0];
  const tag = source.tagName?.toUpperCase();
  if (tag === 'IMG') return source.complete ? [source.naturalWidth, source.naturalHeight] : [0, 0];
  if (tag === 'VIDEO') return source.readyState >= 2 ? [source.videoWidth, source.videoHeight] : [0, 0];
  return [
    Number(source.displayWidth ?? source.width ?? 0),
    Number(source.displayHeight ?? source.height ?? 0),
  ];
}

// ---------------------------------------------------------------------------
// Small CSS value parsers. Only computed values reach them, which browsers
// have already normalised (colours to rgb(), keywords to percentages).

export function splitTop(value, separator) {
  const parts = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < value.length; i++) {
    const character = value[i];
    if (character === '(') depth++;
    else if (character === ')') depth--;
    else if (depth === 0 && (separator === ' ' ? /\s/.test(character) : character === separator)) {
      parts.push(value.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(value.slice(start));
  return parts.map((part) => part.trim()).filter(Boolean);
}

/** `50%`, `12px`, `calc(100% - 10px)` -> { ratio, px }. */
function lengthPercent(token = '0%') {
  if (token === 'left' || token === 'top') return { ratio: 0, px: 0 };
  if (token === 'center') return { ratio: 0.5, px: 0 };
  if (token === 'right' || token === 'bottom') return { ratio: 1, px: 0 };
  const result = { ratio: 0, px: 0 };
  const pattern = /([-+])?\s*(\d*\.?\d+(?:e[-+]?\d+)?)(%|px)?/gi;
  for (let match = pattern.exec(token); match; match = pattern.exec(token)) {
    const value = Number(match[2]) * (match[1] === '-' ? -1 : 1);
    if (match[3] === '%') result.ratio += value / 100;
    else result.px += value;
  }
  return result;
}

const resolveLength = ({ ratio, px }, extent) => ratio * extent + px;

function parsePosition(value = '50% 50%') {
  const tokens = splitTop(value, ' ');
  if (tokens.length === 1) tokens.push('50%');
  return [lengthPercent(tokens[0]), lengthPercent(tokens[1])];
}

function normalizePosition(position) {
  if (Array.isArray(position)) {
    return position.map((part) => typeof part === 'number'
      ? { ratio: part, px: 0 }
      : lengthPercent(String(part)));
  }
  return parsePosition(position ?? '50% 50%');
}

/** Where an `object-fit`-style image lands inside a box. */
function fitRect(sourceWidth, sourceHeight, box, fit = 'cover', position = parsePosition()) {
  let width = box.width;
  let height = box.height;
  if (fit === 'cover' || fit === 'contain') {
    const scale = (fit === 'cover' ? Math.max : Math.min)(box.width / sourceWidth, box.height / sourceHeight);
    width = sourceWidth * scale;
    height = sourceHeight * scale;
  } else if (fit === 'none' || fit === 'scale-down') {
    const scale = fit === 'none' ? 1 : Math.min(1, box.width / sourceWidth, box.height / sourceHeight);
    width = sourceWidth * scale;
    height = sourceHeight * scale;
  }
  return {
    x: box.x + resolveLength(position[0], box.width - width),
    y: box.y + resolveLength(position[1], box.height - height),
    width,
    height,
  };
}

const BLEND_MODES = new Set([
  'multiply', 'screen', 'overlay', 'darken', 'lighten', 'color-dodge', 'color-burn', 'hard-light',
  'soft-light', 'difference', 'exclusion', 'hue', 'saturation', 'color', 'luminosity',
]);

function applyBlendMode(ctx, style) {
  if (BLEND_MODES.has(style.mixBlendMode)) ctx.globalCompositeOperation = style.mixBlendMode;
}

// Only an explicit zero alpha: `rgb(0, 0, 0)` is black, not transparent.
export const transparentColor = (color) => !color || color === 'transparent'
  || /^rgba\([^)]*,\s*0(\.0*)?\s*\)$/.test(color)
  || /\/\s*0(\.0*)?%?\s*\)$/.test(color);

function borderRadii(style, box) {
  const read = (value, extent) => {
    const first = splitTop(value || '0', ' ')[0];
    return Math.max(0, resolveLength(lengthPercent(first), extent));
  };
  return [
    read(style.borderTopLeftRadius, box.width),
    read(style.borderTopRightRadius, box.width),
    read(style.borderBottomRightRadius, box.width),
    read(style.borderBottomLeftRadius, box.width),
  ];
}

function clipBox(ctx, box, radii) {
  ctx.beginPath();
  if (radii?.some((radius) => radius > 0) && typeof ctx.roundRect === 'function') {
    ctx.roundRect(box.x, box.y, box.width, box.height, radii);
  } else {
    ctx.rect(box.x, box.y, box.width, box.height);
  }
  ctx.clip();
}

const rectOf = (element) => {
  const rect = element.getBoundingClientRect();
  return { x: rect.left, y: rect.top, width: rect.width, height: rect.height };
};

const viewportBox = () => ({
  x: 0, y: 0,
  width: globalThis.innerWidth || document.documentElement.clientWidth,
  height: globalThis.innerHeight || document.documentElement.clientHeight,
});

function contentBox(element, style) {
  const rect = rectOf(element);
  const scaleX = element.offsetWidth ? rect.width / element.offsetWidth : 1;
  const scaleY = element.offsetHeight ? rect.height / element.offsetHeight : 1;
  const left = (parseFloat(style.borderLeftWidth) || 0) + (parseFloat(style.paddingLeft) || 0);
  const top = (parseFloat(style.borderTopWidth) || 0) + (parseFloat(style.paddingTop) || 0);
  const right = (parseFloat(style.borderRightWidth) || 0) + (parseFloat(style.paddingRight) || 0);
  const bottom = (parseFloat(style.borderBottomWidth) || 0) + (parseFloat(style.paddingBottom) || 0);
  return {
    x: rect.x + left * scaleX,
    y: rect.y + top * scaleY,
    width: Math.max(0, rect.width - (left + right) * scaleX),
    height: Math.max(0, rect.height - (top + bottom) * scaleY),
  };
}

// ---------------------------------------------------------------------------
// CSS gradients.

function gradientStops(parts, lineLength) {
  const stops = [];
  for (const part of parts) {
    const tokens = splitTop(part, ' ');
    const positions = [];
    while (tokens.length > 1 && /(%|px)$|^calc\(/.test(tokens[tokens.length - 1])) {
      positions.unshift(tokens.pop());
    }
    const color = tokens.join(' ');
    if (!positions.length) stops.push({ color, offset: null });
    for (const position of positions) {
      stops.push({ color, offset: resolveLength(lengthPercent(position), lineLength) / Math.max(lineLength, 1e-6) });
    }
  }
  if (!stops.length) return stops;
  if (stops[0].offset === null) stops[0].offset = 0;
  if (stops.at(-1).offset === null) stops.at(-1).offset = 1;
  // Unpositioned stops are spread evenly between their positioned neighbours.
  for (let i = 1; i < stops.length; i++) {
    if (stops[i].offset !== null) {
      stops[i].offset = Math.max(stops[i].offset, stops[i - 1].offset);
      continue;
    }
    let next = i;
    while (stops[next].offset === null) next++;
    const from = stops[i - 1].offset;
    const to = Math.max(stops[next].offset, from);
    for (let j = i; j < next; j++) stops[j].offset = from + (to - from) * (j - i + 1) / (next - i + 1);
  }
  return stops;
}

/** Repeats a gradient's stops across the whole line, for `repeating-*`. */
function tileStops(stops) {
  if (stops.length < 2) return stops;
  const first = stops[0].offset;
  const period = stops.at(-1).offset - first;
  if (!(period > 0.0005)) return stops;
  const repeated = [];
  for (let i = Math.floor(-first / period); i <= Math.ceil((1 - first) / period); i++) {
    for (const stop of stops) {
      const offset = stop.offset + i * period;
      if (offset < -period || offset > 1 + period) continue;
      repeated.push({ color: stop.color, offset: Math.min(1, Math.max(0, offset)) });
    }
  }
  return repeated.length >= 2 ? repeated : stops;
}

function applyStops(gradient, stops) {
  for (const stop of stops) {
    try {
      gradient.addColorStop(Math.min(1, Math.max(0, stop.offset)), stop.color);
    } catch {
      // A colour syntax the 2D canvas does not understand; skip that stop.
    }
  }
  return gradient;
}

function angleOf(token) {
  const match = /^(-?\d*\.?\d+)(deg|turn|rad|grad)$/.exec(token);
  if (!match) return null;
  const value = Number(match[1]);
  return { deg: value, turn: value * 360, rad: value * 180 / Math.PI, grad: value * 0.9 }[match[2]];
}

function paintLinearGradient(ctx, args, tile, repeating = false) {
  const parts = splitTop(args, ',');
  let angle = 180;
  const head = parts[0] ?? '';
  const explicit = angleOf(head);
  if (explicit !== null) {
    angle = explicit;
    parts.shift();
  } else if (/^to\s/.test(head)) {
    const words = head.slice(3).trim().split(/\s+/);
    const dx = words.includes('right') ? 1 : words.includes('left') ? -1 : 0;
    const dy = words.includes('bottom') ? 1 : words.includes('top') ? -1 : 0;
    // Corner keywords point perpendicular to the opposite diagonal.
    const vx = dx && dy ? dx * tile.height : dx;
    const vy = dx && dy ? dy * tile.width : dy;
    angle = Math.atan2(vx, -vy) * 180 / Math.PI;
    parts.shift();
  } else if (/^in\s/.test(head)) {
    parts.shift();
  }
  const radians = angle * Math.PI / 180;
  const length = Math.abs(tile.width * Math.sin(radians)) + Math.abs(tile.height * Math.cos(radians));
  const cx = tile.x + tile.width / 2;
  const cy = tile.y + tile.height / 2;
  const dx = Math.sin(radians) * length / 2;
  const dy = -Math.cos(radians) * length / 2;
  const stops = gradientStops(parts, length);
  ctx.fillStyle = applyStops(
    ctx.createLinearGradient(cx - dx, cy - dy, cx + dx, cy + dy),
    repeating ? tileStops(stops) : stops,
  );
  ctx.fillRect(tile.x, tile.y, tile.width, tile.height);
}

function paintRadialGradient(ctx, args, tile, repeating = false) {
  const parts = splitTop(args, ',');
  const head = parts[0] ?? '';
  let circle = false;
  let size = 'farthest-corner';
  let explicitSize = null;
  let position = parsePosition('50% 50%');
  const isStop = /^(rgb|hsl|hwb|lab|lch|oklab|oklch|color|#|transparent|currentcolor)/i.test(head)
    || !/(circle|ellipse|closest|farthest|at\s|\d(px|%))/.test(head);
  if (!isStop) {
    parts.shift();
    const [shapePart, positionPart] = head.split(/\s*\bat\b\s*/);
    if (positionPart) position = parsePosition(positionPart);
    for (const token of splitTop(shapePart ?? '', ' ')) {
      if (token === 'circle') circle = true;
      else if (token === 'ellipse') circle = false;
      else if (/^(closest|farthest)-(side|corner)$/.test(token)) size = token;
      else if (/(px|%)$/.test(token)) (explicitSize ??= []).push(lengthPercent(token));
    }
    if (explicitSize?.length === 1) circle = true;
  }
  const cx = tile.x + resolveLength(position[0], tile.width);
  const cy = tile.y + resolveLength(position[1], tile.height);
  const left = cx - tile.x;
  const right = tile.x + tile.width - cx;
  const top = cy - tile.y;
  const bottom = tile.y + tile.height - cy;
  let rx;
  let ry;
  if (explicitSize) {
    rx = resolveLength(explicitSize[0], tile.width);
    ry = explicitSize[1] ? resolveLength(explicitSize[1], tile.height) : rx;
  } else {
    const pick = size.startsWith('closest') ? Math.min : Math.max;
    const sideX = pick(Math.abs(left), Math.abs(right));
    const sideY = pick(Math.abs(top), Math.abs(bottom));
    if (circle) {
      rx = size.endsWith('side') ? pick(sideX, sideY) : Math.hypot(sideX, sideY);
      ry = rx;
    } else {
      const scale = size.endsWith('corner') ? Math.SQRT2 : 1;
      rx = sideX * scale;
      ry = sideY * scale;
    }
  }
  rx = Math.max(rx, 1e-3);
  ry = Math.max(ry, 1e-3);
  ctx.save();
  ctx.beginPath();
  ctx.rect(tile.x, tile.y, tile.width, tile.height);
  ctx.clip();
  ctx.translate(cx, cy);
  ctx.scale(1, ry / rx);
  const stops = gradientStops(parts, rx);
  ctx.fillStyle = applyStops(
    ctx.createRadialGradient(0, 0, 0, 0, 0, rx),
    repeating ? tileStops(stops) : stops,
  );
  const reach = Math.max(tile.width, tile.height) * 2 + Math.abs(cx) + Math.abs(cy);
  ctx.fillRect(-reach, -reach * rx / ry, reach * 2, reach * 2 * rx / ry);
  ctx.restore();
}

// ---------------------------------------------------------------------------
// CSS backgrounds.

function backgroundTileSize(sizeValue, box, intrinsic) {
  const [iw, ih] = intrinsic ?? [0, 0];
  const hasIntrinsic = iw > 0 && ih > 0;
  if (sizeValue === 'cover' || sizeValue === 'contain') {
    if (!hasIntrinsic) return [box.width, box.height];
    const scale = (sizeValue === 'cover' ? Math.max : Math.min)(box.width / iw, box.height / ih);
    return [iw * scale, ih * scale];
  }
  const [wToken = 'auto', hToken = 'auto'] = splitTop(sizeValue || 'auto', ' ');
  let width = wToken === 'auto' ? null : resolveLength(lengthPercent(wToken), box.width);
  let height = hToken === 'auto' ? null : resolveLength(lengthPercent(hToken), box.height);
  if (width === null && height === null) {
    return hasIntrinsic ? [iw, ih] : [box.width, box.height];
  }
  if (width === null) width = hasIntrinsic ? height * iw / ih : box.width;
  if (height === null) height = hasIntrinsic ? width * ih / iw : box.height;
  return [width, height];
}

function paintBackgroundLayer(ctx, layer, options, box, region) {
  const url = /^url\((['"]?)(.*)\1\)$/.exec(layer);
  const gradient = /^(repeating-)?(linear|radial)-gradient\((.*)\)$/s.exec(layer);
  if (!url && !gradient) return true;
  let entry = null;
  if (url) {
    entry = imageEntry(url[2]);
    if (entry.state !== 'ready') return entry.state !== 'loading';
  }
  const intrinsic = entry ? [entry.image.naturalWidth, entry.image.naturalHeight] : null;
  if (entry && !(intrinsic[0] > 0 && intrinsic[1] > 0)) return true;
  const positioning = options.attachment === 'fixed' ? viewportBox() : box;
  const [tileWidth, tileHeight] = backgroundTileSize(options.size, positioning, intrinsic);
  if (!(tileWidth > 0.5 && tileHeight > 0.5)) return true;
  const position = parsePosition(options.position);
  const originX = positioning.x + resolveLength(position[0], positioning.width - tileWidth);
  const originY = positioning.y + resolveLength(position[1], positioning.height - tileHeight);
  const [repeatX, repeatY] = (() => {
    const tokens = splitTop(options.repeat || 'repeat', ' ');
    if (tokens[0] === 'repeat-x') return [true, false];
    if (tokens[0] === 'repeat-y') return [false, true];
    const x = tokens[0] !== 'no-repeat';
    const y = (tokens[1] ?? tokens[0]) !== 'no-repeat';
    return [x, y];
  })();
  // Only tiles that intersect both the painting box and the requested region.
  const minX = Math.max(box.x, region.x);
  const maxX = Math.min(box.x + box.width, region.x + region.width);
  const minY = Math.max(box.y, region.y);
  const maxY = Math.min(box.y + box.height, region.y + region.height);
  if (minX >= maxX || minY >= maxY) return true;
  const firstX = repeatX ? originX + Math.floor((minX - originX) / tileWidth) * tileWidth : originX;
  const firstY = repeatY ? originY + Math.floor((minY - originY) / tileHeight) * tileHeight : originY;
  const lastX = repeatX ? maxX : originX + 1;
  const lastY = repeatY ? maxY : originY + 1;
  let tiles = 0;
  for (let y = firstY; y < lastY && tiles < 1024; y += tileHeight) {
    for (let x = firstX; x < lastX && tiles < 1024; x += tileWidth) {
      tiles++;
      const tile = { x, y, width: tileWidth, height: tileHeight };
      if (entry) ctx.drawImage(entry.image, x, y, tileWidth, tileHeight);
      else if (gradient[2] === 'linear') paintLinearGradient(ctx, gradient[3], tile, Boolean(gradient[1]));
      else paintRadialGradient(ctx, gradient[3], tile, Boolean(gradient[1]));
    }
  }
  return true;
}

export function paintCssBackground(ctx, element, region, { canvas = false } = {}) {
  const style = getComputedStyle(element);
  if (style.display === 'none') return true;
  const box = rectOf(element);
  const opacity = canvas ? 1 : Number(style.opacity);
  if (!(opacity > 0.004)) return true;
  const images = style.backgroundImage && style.backgroundImage !== 'none'
    ? splitTop(style.backgroundImage, ',')
    : [];
  const color = style.backgroundColor;
  if (!images.length && transparentColor(color)) return true;

  ctx.save();
  ctx.globalAlpha *= Number.isFinite(opacity) ? opacity : 1;
  if (!canvas) applyBlendMode(ctx, style);
  if (canvas) {
    // The root background paints the whole canvas, not only the root box.
    ctx.beginPath();
    ctx.rect(region.x, region.y, region.width, region.height);
    ctx.clip();
  } else {
    clipBox(ctx, box, borderRadii(style, box));
  }
  if (!transparentColor(color)) {
    ctx.fillStyle = color;
    ctx.fillRect(region.x, region.y, region.width, region.height);
  }
  const list = (value) => splitTop(value || '', ',');
  const sizes = list(style.backgroundSize);
  const positions = list(style.backgroundPosition);
  const repeats = list(style.backgroundRepeat);
  const attachments = list(style.backgroundAttachment);
  const pick = (values, index, fallback) => values.length ? values[index % values.length] : fallback;
  let settled = true;
  // CSS paints the first listed layer on top.
  for (let i = images.length - 1; i >= 0; i--) {
    settled = paintBackgroundLayer(ctx, images[i], {
      size: pick(sizes, i, 'auto'),
      position: pick(positions, i, '0% 0%'),
      repeat: pick(repeats, i, 'repeat'),
      attachment: pick(attachments, i, 'scroll'),
    }, canvas ? rectOf(document.documentElement) : box, region) && settled;
  }
  ctx.restore();
  return settled;
}

// ---------------------------------------------------------------------------
// Media.

function drawSource(ctx, source, box, fit, position, region) {
  const [sourceWidth, sourceHeight] = mediaSize(source);
  if (!(sourceWidth > 0 && sourceHeight > 0) || !(box.width > 0 && box.height > 0)) return;
  if (box.x >= region.x + region.width || box.x + box.width <= region.x
    || box.y >= region.y + region.height || box.y + box.height <= region.y) return;
  const target = fitRect(sourceWidth, sourceHeight, box, fit, position);
  ctx.save();
  ctx.beginPath();
  ctx.rect(box.x, box.y, box.width, box.height);
  ctx.clip();
  try {
    ctx.drawImage(source, target.x, target.y, target.width, target.height);
  } catch {
    // A source that is not decodable yet (e.g. a video between frames).
  }
  ctx.restore();
}

export function paintMedia(ctx, layer, region) {
  const { element } = layer;
  const style = getComputedStyle(element);
  if (style.display === 'none' || style.visibility === 'hidden') return;
  const opacity = Number(style.opacity);
  if (!(opacity > 0.004)) return;
  ctx.save();
  ctx.globalAlpha *= Number.isFinite(opacity) ? opacity : 1;
  applyBlendMode(ctx, style);
  const box = layer.anchor ? anchorBox(layer.anchor) : contentBox(element, style);
  drawSource(
    ctx, element, box,
    layer.fit ?? style.objectFit ?? 'fill',
    layer.position ?? parsePosition(style.objectPosition),
    region,
  );
  ctx.restore();
}

function anchorBox(anchor) {
  if (anchor === 'viewport' || anchor == null) return viewportBox();
  if (anchor === 'document') return rectOf(document.documentElement);
  if (isElement(anchor)) return rectOf(anchor);
  return viewportBox();
}

// ---------------------------------------------------------------------------
// Backdrop specs -> layers.

function resolveString(value, { allowUrl = true } = {}) {
  let element = null;
  try {
    element = document.querySelector(value);
  } catch {
    element = null;
  }
  if (element) return element;
  if (allowUrl && IMAGE_URL.test(value)) return { url: value };
  return { missing: value };
}

function layerFromElement(element, extra = {}) {
  if (MEDIA_TAGS.has(element.tagName.toUpperCase())) return { kind: 'media', element, ...extra };
  return { kind: 'css', element };
}

function isDrawableSource(value) {
  return value && typeof value === 'object' && !isElement(value)
    && ('width' in value || 'displayWidth' in value) && !('source' in value);
}

/** Normalises a user backdrop spec into layers (selectors stay unresolved). */
export function normalizeBackdrop(input) {
  if (input == null || input === 'auto') return [{ kind: 'auto' }];
  if (Array.isArray(input)) return input.flatMap((part) => normalizeBackdrop(part));
  if (typeof input === 'function') return [{ kind: 'paint', paint: input }];
  if (typeof input === 'string') return [{ kind: 'ref', ref: input }];
  if (isElement(input)) return [{ kind: 'ref', ref: input }];
  if (isDrawableSource(input)) {
    return [{ kind: 'source', source: input, fit: 'cover', position: parsePosition(), anchor: 'viewport' }];
  }
  if (typeof input === 'object') {
    if (input.color && !input.source) return [{ kind: 'color', color: input.color }];
    if (input.source != null) {
      return [{
        kind: 'ref',
        ref: input.source,
        fit: input.fit,
        position: input.position == null ? undefined : normalizePosition(input.position),
        anchor: input.anchor,
        opacity: input.opacity,
      }];
    }
  }
  throw new TypeError('LiquidGlass: unsupported backdrop. Use an element, selector, image URL, canvas/video/image, painter function, or { source, fit, anchor }.');
}

/**
 * What the browser paints under `target`: the root background, then the rest
 * of the page below it in paint order (see dom-content.js).
 */
function autoLayers(target) {
  const root = document.documentElement;
  const rootStyle = getComputedStyle(root);
  const rootPainted = rootStyle.backgroundImage !== 'none' || !transparentColor(rootStyle.backgroundColor);
  return [
    { kind: 'css', element: rootPainted || !document.body ? root : document.body, canvas: true },
    { kind: 'page', host: target },
  ];
}

/** Resolves selectors and `auto` against the live document. */
export function resolveLayers(layers, target) {
  const resolved = [];
  for (const layer of layers) {
    if (layer.kind === 'auto') {
      resolved.push(...autoLayers(target));
      continue;
    }
    if (layer.kind !== 'ref') {
      resolved.push(layer);
      continue;
    }
    let ref = layer.ref;
    if (typeof ref === 'string') {
      const found = resolveString(ref);
      if (found.missing) {
        resolved.push({ kind: 'missing', ref });
        continue;
      }
      ref = found;
    }
    const extra = {
      ...(layer.fit ? { fit: layer.fit } : {}),
      ...(layer.position ? { position: layer.position } : {}),
      ...(layer.anchor != null ? { anchor: resolveAnchor(layer.anchor) } : {}),
      ...(layer.opacity != null ? { opacity: layer.opacity } : {}),
    };
    if (ref?.url) {
      resolved.push({
        kind: 'source', entry: imageEntry(ref.url), fit: 'cover', position: parsePosition(),
        anchor: 'viewport', ...extra,
      });
    } else if (isElement(ref) && ref.isConnected) {
      resolved.push(layerFromElement(ref, extra));
    } else if (isDrawableSource(ref) || (isElement(ref) && MEDIA_TAGS.has(ref.tagName.toUpperCase()))) {
      // A detached image, canvas or video has no page box of its own.
      resolved.push({ kind: 'source', source: ref, fit: 'cover', position: parsePosition(), anchor: 'viewport', ...extra });
    }
  }
  return resolved;
}

function resolveAnchor(anchor) {
  if (typeof anchor !== 'string' || anchor === 'viewport' || anchor === 'document') return anchor;
  const found = resolveString(anchor, { allowUrl: false });
  return isElement(found) ? found : 'viewport';
}

/** The colour the browser paints under everything. */
function canvasColor() {
  const scheme = getComputedStyle(document.documentElement).colorScheme || '';
  const dark = /dark/.test(scheme) && !/light/.test(scheme)
    || (/dark/.test(scheme) && globalThis.matchMedia?.('(prefers-color-scheme: dark)').matches);
  return dark ? '#121212' : '#ffffff';
}

/**
 * Paints resolved layers. `ctx` must already map viewport CSS pixels to its
 * buffer; `region` is the viewport rectangle being painted. Returns false
 * while an image the backdrop depends on is still loading.
 */
export function paintLayers(ctx, layers, region) {
  let settled = true;
  ctx.save();
  ctx.fillStyle = canvasColor();
  ctx.fillRect(region.x, region.y, region.width, region.height);
  for (const layer of layers) {
    ctx.save();
    try {
      if (layer.opacity != null) ctx.globalAlpha *= layer.opacity;
      switch (layer.kind) {
        case 'css':
          settled = paintCssBackground(ctx, layer.element, region, { canvas: layer.canvas }) && settled;
          break;
        case 'media':
          paintMedia(ctx, layer, region);
          break;
        case 'source': {
          const source = layer.entry ? layer.entry.image : layer.source;
          if (layer.entry && layer.entry.state !== 'ready') {
            settled = settled && layer.entry.state !== 'loading';
            break;
          }
          drawSource(ctx, source, anchorBox(layer.anchor), layer.fit, layer.position, region);
          break;
        }
        case 'color':
          ctx.fillStyle = layer.color;
          ctx.fillRect(region.x, region.y, region.width, region.height);
          break;
        case 'paint':
          layer.paint(ctx, { ...region });
          break;
        case 'page':
          settled = paintPageContent(ctx, region, layer.host) && settled;
          break;
        default:
          break;
      }
    } finally {
      ctx.restore();
    }
  }
  ctx.restore();
  return settled;
}

/**
 * Paints the backdrop behind an element into `context`, whose buffer covers
 * the element's layout box plus `bleed` CSS px on every side at `dpr`.
 * `frame` is `{ x, y, screenWidth, screenHeight, width, height }`: the
 * viewport box and the untransformed layout size, so a scale transform on the
 * element (or an ancestor) still registers.
 */
export function paintElementBackdrop(context, layers, frame, bleed, dpr) {
  const scaleX = frame.width > 0 ? frame.screenWidth / frame.width : 1;
  const scaleY = frame.height > 0 ? frame.screenHeight / frame.height : 1;
  context.setTransform(
    dpr / scaleX, 0, 0, dpr / scaleY,
    dpr * (bleed - frame.x / scaleX), dpr * (bleed - frame.y / scaleY),
  );
  return paintLayers(context, layers, {
    x: frame.x - bleed * scaleX,
    y: frame.y - bleed * scaleY,
    width: (frame.width + bleed * 2) * scaleX,
    height: (frame.height + bleed * 2) * scaleY,
  });
}

/** Whether any layer can change without the page telling us. */
export function layersAreLive(layers) {
  return layers.some((layer) => {
    if (layer.kind === 'page') return pageContentIsLive(layer.host);
    const source = layer.kind === 'media' ? layer.element : layer.kind === 'source' ? layer.source : null;
    if (!source) return false;
    const tag = source.tagName?.toUpperCase();
    if (tag === 'VIDEO') return !source.paused && !source.ended;
    if (tag === 'CANVAS') return true;
    const name = source.constructor?.name;
    return name === 'OffscreenCanvas' || name === 'VideoFrame';
  });
}

/** Elements whose own changes should re-evaluate the backdrop. */
export function layerElements(layers) {
  return layers.flatMap((layer) => {
    if (layer.kind === 'media' || (layer.kind === 'css' && !layer.canvas)) return [layer.element];
    return [];
  });
}

export function missingLayers(layers) {
  return layers.filter((layer) => layer.kind === 'missing').map((layer) => layer.ref);
}
