// The backdrop layer. Everything the glass refracts is drawn here first, into a
// plain 2D canvas that sits underneath the transparent WebGL canvas. That is
// also how the component is meant to be used in an app: `compositeMode:
// 'overlay'` samples whatever you put behind it.

import { drawPhoneBackdrop } from './phone.js?phone-scenes=8';

const CARD_HUES = [206, 24, 152, 268, 46, 340, 190];

function hash(n) {
  const x = Math.sin(n * 127.1) * 43758.5453;
  return x - Math.floor(x);
}

export function drawImageCover(ctx, image, width, height, zoom = 1) {
  const source = Math.max(image.naturalWidth || image.videoWidth || image.width, 1);
  const sourceHeight = Math.max(image.naturalHeight || image.videoHeight || image.height, 1);
  const scale = Math.max(width / source, height / sourceHeight) * zoom;
  const drawWidth = source * scale;
  const drawHeight = sourceHeight * scale;
  ctx.drawImage(image, (width - drawWidth) / 2, (height - drawHeight) / 2, drawWidth, drawHeight);
}

function fallbackGradient(ctx, width, height, tint = '#1d2430') {
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, tint);
  gradient.addColorStop(1, '#090c11');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
}

function textLine(ctx, x, y, width, height, alpha) {
  ctx.fillStyle = `rgba(255,255,255,${alpha})`;
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, height / 2);
  ctx.fill();
}

function card(ctx, x, y, width, height, seed) {
  const hue = CARD_HUES[Math.floor(hash(seed) * CARD_HUES.length)];
  const gradient = ctx.createLinearGradient(x, y, x + width, y + height);
  gradient.addColorStop(0, `hsl(${hue} 72% 62%)`);
  gradient.addColorStop(1, `hsl(${(hue + 42) % 360} 66% 34%)`);
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, 22);
  ctx.fill();

  // High contrast detail inside the card: this is what the refracting rim
  // smears, and the reason a flat gradient is a useless test backdrop.
  const inset = Math.min(width, height) * 0.12;
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, 22);
  ctx.clip();
  ctx.fillStyle = 'rgba(9,12,17,0.72)';
  ctx.beginPath();
  ctx.roundRect(x + inset, y + height - inset - 34, Math.min(width * 0.52, 220), 16, 8);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.86)';
  ctx.beginPath();
  ctx.arc(x + width - inset - 18, y + inset + 18, 16, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function appHeader(ctx, width, tint) {
  ctx.fillStyle = tint;
  ctx.fillRect(0, 0, width, 132);
  ctx.fillStyle = 'rgba(255,255,255,0.94)';
  ctx.font = '700 30px -apple-system, "SF Pro Display", system-ui, sans-serif';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('Library', 34, 88);
  textLine(ctx, width - 178, 68, 144, 26, 0.24);
}

/** A still app screen: header, hero card, and a two column grid. */
export function drawAppContent(ctx, width, height, tint = '#2b3a5c') {
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, '#111722');
  gradient.addColorStop(1, '#05070b');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
  appHeader(ctx, width, tint);

  const margin = 34;
  const columns = width > 760 ? 3 : 2;
  const gap = 20;
  const cardWidth = (width - margin * 2 - gap * (columns - 1)) / columns;
  card(ctx, margin, 160, width - margin * 2, 190, 3);
  for (let i = 0; i < columns * 2; i++) {
    const column = i % columns;
    const row = Math.floor(i / columns);
    card(ctx, margin + column * (cardWidth + gap), 378 + row * (cardWidth * 0.72 + gap),
      cardWidth, cardWidth * 0.72, i + 11);
  }
}

/**
 * A feed that scrolls forever. The glass toolbar stays put while high contrast
 * edges travel underneath it, which is the hardest case for a static blur
 * approximation and the reason the backdrop is uploaded live here.
 */
export function drawFeed(ctx, width, height, scroll, tint = '#1d2430') {
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, tint);
  gradient.addColorStop(1, '#05070b');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  const margin = 40;
  const cardHeight = 168;
  const pitch = cardHeight + 26;
  const offset = ((scroll % pitch) + pitch) % pitch;
  const first = Math.floor(scroll / pitch);
  const rows = Math.ceil(height / pitch) + 2;

  for (let i = -1; i < rows; i++) {
    const y = i * pitch - offset;
    const seed = first + i;
    card(ctx, margin, y, width - margin * 2 - 150, cardHeight, seed);
    ctx.save();
    textLine(ctx, width - margin - 138, y + 20, 138, 20, 0.5);
    textLine(ctx, width - margin - 138, y + 54, 96, 14, 0.26);
    textLine(ctx, width - margin - 138, y + 80, 118, 14, 0.26);
    ctx.restore();
  }
}

/**
 * Paints the backdrop for a scene. `image` is the decoded wallpaper (or video
 * element) when the scene has one and it has finished loading.
 */
export function drawSceneBackdrop(ctx, scene, options) {
  const { width, height, zoom = 1, scroll = 0, image = null } = options;
  ctx.setTransform(options.dpr, 0, 0, options.dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);

  if (scene.backdrop.type === 'app') {
    drawAppContent(ctx, width, height, scene.backdrop.tint);
    return;
  }
  if (scene.backdrop.type === 'feed') {
    drawFeed(ctx, width, height, scroll, scene.backdrop.tint);
    return;
  }
  if (scene.backdrop.type === 'phone') {
    drawPhoneBackdrop(ctx, scene, width, height, image);
    return;
  }
  if (image) {
    drawImageCover(ctx, image, width, height, zoom);
    return;
  }
  fallbackGradient(ctx, width, height, scene.backdrop.tint);
}
