// Everything that sits ON TOP of the glass: app icons, folder label, badge.

import { drawPhoneChrome, drawPhoneIcon, phoneFrame } from './phone.js?phone-scenes=2';

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawIcon(ctx, icon, x, y, size) {
  const r = size * 0.235;
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.28)';
  ctx.shadowBlur = size * 0.16;
  ctx.shadowOffsetY = size * 0.05;
  roundRect(ctx, x, y, size, size, r);
  const g = ctx.createLinearGradient(x, y, x, y + size);
  g.addColorStop(0, icon.c0);
  g.addColorStop(1, icon.c1 || icon.c0);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.restore();

  ctx.save();
  roundRect(ctx, x, y, size, size, r);
  ctx.clip();
  if (icon.image && icon.image.complete) {
    const logoSize = size * 0.56;
    ctx.drawImage(icon.image, x + (size - logoSize) / 2, y + (size - logoSize) / 2, logoSize, logoSize);
  } else if (icon.t) {
    ctx.fillStyle = icon.fg || '#fff';
    ctx.font = `700 ${Math.round(size * (icon.small ? 0.34 : 0.46))}px -apple-system, "Helvetica Neue", system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(icon.t, x + size / 2, y + size * 0.52);
  }
  // top gloss
  const gl = ctx.createLinearGradient(x, y, x, y + size * 0.5);
  gl.addColorStop(0, 'rgba(255,255,255,0.20)');
  gl.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gl;
  ctx.fillRect(x, y, size, size * 0.5);
  ctx.restore();
}

export function drawGlassContents(ctx, f) {
  if (f.shape === 'pill' && f.icons?.length) {
    const size = Math.min(f.h * 0.64, f.w / (f.icons.length + 1));
    const gap = (f.w - size * f.icons.length) / (f.icons.length + 1);
    f.icons.forEach((icon, index) => drawIcon(ctx, icon,
      f.x + gap + index * (size + gap), f.y + (f.h - size) / 2, size));
    return;
  }
  if (f.shape === 'pill' || f.shape === 'circle') {
    ctx.save();
    const short = Math.min(f.w, f.h);
    ctx.fillStyle = 'rgba(255,255,255,0.96)';
    ctx.shadowColor = 'rgba(0,0,0,0.32)';
    ctx.shadowBlur = short * 0.06;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `600 ${Math.round(short * (f.shape === 'circle' ? 0.42 : 0.25))}px -apple-system, "SF Pro Display", "Helvetica Neue", system-ui, sans-serif`;
    ctx.fillText(f.content || '', f.x + f.w / 2, f.y + f.h * 0.50);
    ctx.restore();
    return;
  }

  if (!f.icons) return;
  const cols = f.shape === 'rect' || f.shape === 'folderRect' ? 4 : 3;
  const rows = Math.ceil(f.icons.length / cols);
  const short = Math.min(f.w, f.h);
  const padX = f.w * 0.145;
  const padY = f.h * 0.155;
  const gap = short * 0.055;
  const size = Math.min(
    (f.w - padX * 2 - gap * (cols - 1)) / cols,
    (f.h - padY * 2 - gap * (rows - 1)) / rows,
  );
  f.icons.forEach((icon, i) => {
    const cx = i % cols;
    const cy = Math.floor(i / cols);
    drawIcon(ctx, icon,
      f.x + padX + cx * (size + gap),
      f.y + padY + cy * (size + gap), size);
  });
}

export function drawLabel(ctx, f) {
  ctx.save();
  const unit = Math.min(f.w, f.h);
  ctx.font = `600 ${Math.round(unit * 0.125)}px -apple-system, "PingFang SC", "Helvetica Neue", system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.shadowColor = 'rgba(0,0,0,0.45)';
  ctx.shadowBlur = 4;
  ctx.fillStyle = 'rgba(255,255,255,0.96)';
  ctx.fillText(f.label, f.x + f.w / 2, f.y + f.h + unit * 0.08);
  ctx.restore();
}

export const HANDLE_SIZE = 11;

/** The four corner handles of an element, in stage coordinates. */
export function handlesOf(f) {
  return [
    { id: 'nw', x: f.x, y: f.y },
    { id: 'ne', x: f.x + f.w, y: f.y },
    { id: 'sw', x: f.x, y: f.y + f.h },
    { id: 'se', x: f.x + f.w, y: f.y + f.h },
  ];
}

/** Selection outline plus resize handles for the element being edited. */
export function drawSelection(ctx, f) {
  ctx.save();
  ctx.strokeStyle = 'rgba(154,186,255,0.95)';
  ctx.lineWidth = 1;
  ctx.setLineDash([5, 4]);
  ctx.strokeRect(f.x - 0.5, f.y - 0.5, f.w + 1, f.h + 1);
  ctx.setLineDash([]);
  for (const handle of handlesOf(f)) {
    ctx.beginPath();
    ctx.rect(handle.x - HANDLE_SIZE / 2, handle.y - HANDLE_SIZE / 2, HANDLE_SIZE, HANDLE_SIZE);
    ctx.fillStyle = '#0d1017';
    ctx.fill();
    ctx.strokeStyle = 'rgba(154,186,255,0.95)';
    ctx.stroke();
  }
  ctx.restore();
}

export function drawBadge(ctx, f) {
  if (!f.badge) return;
  const text = f.badge;
  ctx.save();
  const fs = Math.round(f.w * 0.26);
  ctx.font = `600 ${fs}px -apple-system, "Helvetica Neue", system-ui, sans-serif`;
  const tw = ctx.measureText(text).width;
  const h = fs * 1.45;
  const w = Math.max(h, tw + h * 0.55);
  const x = f.x + f.w - w * 0.55;
  const y = f.y - h * 0.45;
  ctx.shadowColor = 'rgba(0,0,0,0.3)';
  ctx.shadowBlur = 8;
  ctx.shadowOffsetY = 2;
  roundRect(ctx, x, y, w, h, h / 2);
  ctx.fillStyle = '#ff3b30';
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x + w / 2, y + h / 2 + fs * 0.04);
  ctx.restore();
}

function elementMap(elements) {
  return new Map(elements.map((element) => [element.id, element]));
}

function phoneText(ctx, text, x, y, size, options = {}) {
  ctx.save();
  ctx.fillStyle = options.color ?? '#fff';
  ctx.globalAlpha = options.alpha ?? 1;
  ctx.font = `${options.weight ?? 500} ${size}px -apple-system, "SF Pro Display", "PingFang SC", system-ui, sans-serif`;
  ctx.textAlign = options.align ?? 'left';
  ctx.textBaseline = options.baseline ?? 'alphabetic';
  ctx.fillText(text, x, y, options.maxWidth);
  ctx.restore();
}

function drawSystemIcon(ctx, element, kind, scale = 0.46, color = '#fff') {
  const unit = Math.min(element.w, element.h);
  const size = unit * scale;
  drawPhoneIcon(ctx, kind === 'torch' ? 'flashlight' : kind,
    element.x + (element.w - size) / 2,
    element.y + (element.h - size) / 2,
    size, size, color);
}

function drawHomeOverlay(ctx, frame, elements) {
  for (const element of elements) {
    drawGlassContents(ctx, element);
    if (element.id !== 'dock') drawLabel(ctx, element);
  }
  const dotsY = frame.screen.y + 695 * frame.scale;
  for (let index = 0; index < 3; index++) {
    ctx.beginPath();
    ctx.arc(frame.screen.x + (184 + index * 13) * frame.scale, dotsY, (index === 0 ? 3.4 : 2.8) * frame.scale, 0, Math.PI * 2);
    ctx.fillStyle = index === 0 ? '#fff' : 'rgba(255,255,255,.45)';
    ctx.fill();
  }
}

function notificationCard(ctx, element, title, body, time, accent) {
  const unit = element.w / 357;
  const icon = { x: element.x + 13 * unit, y: element.y + 16 * unit, w: 45 * unit, h: 45 * unit };
  roundRect(ctx, icon.x, icon.y, icon.w, icon.h, 11 * unit);
  const gradient = ctx.createLinearGradient(icon.x, icon.y, icon.x + icon.w, icon.y + icon.h);
  gradient.addColorStop(0, accent);
  gradient.addColorStop(1, '#e9efff');
  ctx.fillStyle = gradient;
  ctx.fill();
  phoneText(ctx, title, element.x + 70 * unit, element.y + 27 * unit, 15 * unit, { weight: 650 });
  phoneText(ctx, time, element.x + element.w - 14 * unit, element.y + 26 * unit, 11 * unit, { align: 'right', alpha: 0.68 });
  phoneText(ctx, body, element.x + 70 * unit, element.y + 50 * unit, 12.5 * unit, { alpha: 0.92, maxWidth: element.w - 86 * unit });
  if (element.h > 90 * unit) phoneText(ctx, 'Please note that the service is now fully operational.', element.x + 70 * unit, element.y + 70 * unit, 11 * unit, { alpha: 0.7, maxWidth: element.w - 86 * unit });
}

function drawNotificationOverlay(ctx, frame, elements) {
  const s = frame.scale;
  const sx = frame.screen.x;
  const sy = frame.screen.y;
  phoneText(ctx, 'Friday, August 14', sx + frame.screen.w / 2, sy + 112 * s, 17 * s, { align: 'center', weight: 550 });
  phoneText(ctx, '9:41', sx + frame.screen.w / 2, sy + 232 * s, 102 * s, { align: 'center', weight: 280 });
  const byId = elementMap(elements);
  notificationCard(ctx, byId.get('headline'), 'CS2', 'LVG win 2–0 · next round confirmed', '3m ago', '#172034');
  notificationCard(ctx, byId.get('building'), 'Five Condos', 'Elevator #4 is back in service', '24m ago', '#32b6ff');
  notificationCard(ctx, byId.get('message'), 'Oliverrr', 'I just saved so much time using one AI.', '27m ago', '#ff4b8b');
  drawSystemIcon(ctx, byId.get('flashlight'), 'flashlight');
  drawSystemIcon(ctx, byId.get('camera'), 'camera');
}

function drawConnectivity(ctx, element) {
  const buttons = [
    [0.29, 0.29, 0.165, '#8d939d', 'plane'],
    [0.71, 0.29, 0.165, '#0a9fff', 'wifi'],
    [0.29, 0.71, 0.165, '#0a9fff', 'antenna'],
    [0.63, 0.64, 0.09, '#32d06b', 'antenna'],
    [0.82, 0.64, 0.09, '#168cff', 'bluetooth'],
    [0.63, 0.82, 0.09, '#6d737f', 'antenna'],
    [0.82, 0.82, 0.09, '#168cff', 'wifi'],
  ];
  for (const [px, py, radiusRatio, color, icon] of buttons) {
    const radius = element.w * radiusRatio;
    const cx = element.x + element.w * px;
    const cy = element.y + element.h * py;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    const iconSize = radius * 1.12;
    drawPhoneIcon(ctx, icon, cx - iconSize / 2, cy - iconSize / 2, iconSize);
  }
}

function drawControlOverlay(ctx, frame, elements) {
  const byId = elementMap(elements);
  drawConnectivity(ctx, byId.get('connectivity'));
  for (const id of ['bluetooth', 'hotspot', 'focus', 'torch', 'low-power']) {
    const element = byId.get(id);
    const title = { bluetooth: 'Bluetooth', hotspot: 'Personal Hotspot', focus: 'Focus', torch: 'Flashlight', 'low-power': 'Low Power Mode' }[id];
    const iconName = { bluetooth: 'bluetooth', hotspot: 'antenna', focus: 'moon', torch: 'flashlight', 'low-power': 'battery' }[id];
    const iconSize = 24 * frame.scale;
    drawPhoneIcon(ctx, iconName, element.x + 14 * frame.scale,
      element.y + (element.h - iconSize) / 2, iconSize);
    phoneText(ctx, title, element.x + 48 * frame.scale, element.y + element.h * 0.46, Math.min(element.h * 0.21, 14 * frame.scale), { weight: 600 });
    if (id !== 'focus') phoneText(ctx, id === 'bluetooth' ? 'On' : 'Off', element.x + 48 * frame.scale, element.y + element.h * 0.7, Math.min(element.h * 0.16, 11 * frame.scale), { alpha: 0.62 });
  }
  for (const id of ['rotation', 'mirroring', 'camera', 'calculator', 'voice', 'record']) drawSystemIcon(ctx, byId.get(id), id);

  const brightness = byId.get('brightness');
  const volume = byId.get('volume');
  for (const [element, level] of [[brightness, 0.42], [volume, 0.3]]) {
    const inset = 8 * frame.scale;
    const fillHeight = Math.max(element.w - inset * 2, (element.h - inset * 2) * level);
    const fillY = element.y + element.h - inset - fillHeight;
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(element.x + inset, fillY, element.w - inset * 2, fillHeight,
      Math.min(element.w - inset * 2, fillHeight) / 2);
    ctx.fillStyle = 'rgba(255,255,255,.9)';
    ctx.fill();
    ctx.restore();
  }
  drawPhoneIcon(ctx, 'sun', brightness.x + brightness.w * 0.33,
    brightness.y + brightness.h * 0.74, brightness.w * 0.34, brightness.w * 0.34, '#f4c11b');
  drawPhoneIcon(ctx, 'volume', volume.x + volume.w * 0.31,
    volume.y + volume.h * 0.75, volume.w * 0.38, volume.w * 0.38, '#12a4d8');
}

/** Draw fixed iOS UI above the glass, including status glyphs and hardware. */
export function drawPhoneSceneOverlay(ctx, scene, elements, width, height) {
  const frame = phoneFrame(width, height);
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(frame.screen.x, frame.screen.y, frame.screen.w, frame.screen.h, frame.screen.r);
  ctx.clip();
  if (scene.phoneView === 'home') drawHomeOverlay(ctx, frame, elements);
  else if (scene.phoneView === 'notification') drawNotificationOverlay(ctx, frame, elements);
  else drawControlOverlay(ctx, frame, elements);
  drawPhoneChrome(ctx, frame);
  ctx.restore();
}
