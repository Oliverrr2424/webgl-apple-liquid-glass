// Everything that sits ON TOP of the glass: app icons, folder label, badge.

import { drawPhoneChrome, drawPhoneIcon, phoneFrame } from './phone.js?phone-scenes=7';

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

function drawClockWidget(ctx, element) {
  const radius = Math.min(element.w, element.h) * 0.405;
  const cx = element.x + element.w / 2;
  const cy = element.y + element.h * 0.50;
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fillStyle = '#fbfbfc';
  ctx.shadowColor = 'rgba(0,0,0,.22)';
  ctx.shadowBlur = radius * 0.08;
  ctx.shadowOffsetY = radius * 0.03;
  ctx.fill();
  ctx.shadowColor = 'transparent';
  for (let index = 0; index < 60; index++) {
    const angle = index * Math.PI / 30 - Math.PI / 2;
    const major = index % 5 === 0;
    const outer = radius * 0.92;
    const inner = radius * (major ? 0.82 : 0.87);
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(angle) * inner, cy + Math.sin(angle) * inner);
    ctx.lineTo(cx + Math.cos(angle) * outer, cy + Math.sin(angle) * outer);
    ctx.strokeStyle = major ? '#202124' : '#afb1b5';
    ctx.lineWidth = major ? radius * 0.018 : radius * 0.013;
    ctx.lineCap = 'round';
    ctx.stroke();
  }
  ctx.fillStyle = '#161719';
  ctx.font = `600 ${radius * 0.19}px -apple-system, "SF Pro Display", system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let hour = 1; hour <= 12; hour++) {
    const angle = hour * Math.PI / 6 - Math.PI / 2;
    ctx.fillText(String(hour), cx + Math.cos(angle) * radius * 0.66,
      cy + Math.sin(angle) * radius * 0.66);
  }
  const hand = (angle, length, width, color) => {
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(angle) * length, cy + Math.sin(angle) * length);
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.stroke();
  };
  hand(-0.82, radius * 0.52, radius * 0.07, '#17181a');
  hand(1.26, radius * 0.67, radius * 0.055, '#17181a');
  hand(-1.04, radius * 0.78, radius * 0.012, '#ed931e');
  ctx.beginPath();
  ctx.arc(cx, cy, radius * 0.045, 0, Math.PI * 2);
  ctx.fillStyle = '#ed931e';
  ctx.fill();
  ctx.restore();
}

function drawFitnessWidget(ctx, element) {
  const inset = Math.min(element.w, element.h) * 0.035;
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(element.x + inset, element.y + inset,
    element.w - inset * 2, element.h - inset * 2, element.w * 0.16);
  ctx.fillStyle = 'rgba(25,26,29,.94)';
  ctx.fill();
  const cx = element.x + element.w * 0.28;
  const cy = element.y + element.h * 0.29;
  const colors = ['#ff365f', '#9aff38', '#55e4df'];
  colors.forEach((color, index) => {
    ctx.beginPath();
    ctx.arc(cx, cy, element.w * (0.18 - index * 0.045), -Math.PI / 2, Math.PI * (1.25 - index * 0.08));
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.34 + index * 0.08;
    ctx.lineWidth = element.w * 0.025;
    ctx.stroke();
  });
  ctx.globalAlpha = 1;
  colors.forEach((color, index) => {
    phoneText(ctx, '––/––', element.x + element.w * 0.18,
      element.y + element.h * (0.58 + index * 0.15), element.w * 0.115,
      { color, weight: 650 });
  });
  ctx.restore();
}

function drawWeatherGlyph(ctx, kind, x, y, size, color = '#fff') {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(1, size * 0.08);
  if (kind === 'sun') {
    ctx.beginPath();
    ctx.arc(0, 0, size * 0.24, 0, Math.PI * 2);
    ctx.fill();
    for (let index = 0; index < 8; index++) {
      const angle = index * Math.PI / 4;
      ctx.beginPath();
      ctx.moveTo(Math.cos(angle) * size * 0.39, Math.sin(angle) * size * 0.39);
      ctx.lineTo(Math.cos(angle) * size * 0.54, Math.sin(angle) * size * 0.54);
      ctx.stroke();
    }
  } else if (kind === 'cloud') {
    ctx.beginPath();
    ctx.arc(-size * 0.18, size * 0.08, size * 0.22, Math.PI, 0);
    ctx.arc(size * 0.06, -size * 0.02, size * 0.29, Math.PI, 0);
    ctx.arc(size * 0.31, size * 0.10, size * 0.19, Math.PI, 0);
    ctx.lineTo(-size * 0.39, size * 0.27);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.arc(size * 0.31, -size * 0.17, size * 0.22, 0.05, Math.PI * 0.98);
    ctx.lineWidth = size * 0.12;
    ctx.stroke();
  } else if (kind === 'sunrise') {
    ctx.beginPath();
    ctx.arc(0, size * 0.13, size * 0.25, Math.PI, 0);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-size * 0.5, size * 0.29); ctx.lineTo(size * 0.5, size * 0.29);
    ctx.moveTo(-size * 0.36, size * 0.42); ctx.lineTo(size * 0.36, size * 0.42);
    ctx.stroke();
    for (let index = 0; index < 5; index++) {
      const angle = Math.PI + index * Math.PI / 4;
      ctx.beginPath();
      ctx.moveTo(Math.cos(angle) * size * 0.38, Math.sin(angle) * size * 0.38 + size * 0.13);
      ctx.lineTo(Math.cos(angle) * size * 0.51, Math.sin(angle) * size * 0.51 + size * 0.13);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(0, -size * 0.52); ctx.lineTo(0, -size * 0.28);
    ctx.moveTo(-size * 0.11, -size * 0.4); ctx.lineTo(0, -size * 0.52); ctx.lineTo(size * 0.11, -size * 0.4);
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.arc(-size * 0.06, -size * 0.05, size * 0.39, Math.PI * 0.18, Math.PI * 1.73);
    ctx.arc(size * 0.16, -size * 0.18, size * 0.32, Math.PI * 1.66, Math.PI * 0.25, true);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(size * 0.40, -size * 0.42); ctx.lineTo(size * 0.40, -size * 0.20);
    ctx.moveTo(size * 0.29, -size * 0.31); ctx.lineTo(size * 0.51, -size * 0.31);
    ctx.stroke();
  }
  ctx.restore();
}

function drawWeatherWidget(ctx, element) {
  const u = element.w / 341;
  ctx.save();
  roundRect(ctx, element.x + u, element.y + u, element.w - 2 * u, element.h - 2 * u, 18 * u);
  const panel = ctx.createLinearGradient(element.x, element.y, element.x, element.y + element.h);
  panel.addColorStop(0, 'rgba(27,30,52,.97)');
  panel.addColorStop(1, 'rgba(41,47,76,.96)');
  ctx.fillStyle = panel;
  ctx.fill();

  phoneText(ctx, 'Minhang', element.x + 18 * u, element.y + 28 * u, 13 * u, { weight: 600 });
  ctx.save();
  ctx.translate(element.x + 64 * u, element.y + 24 * u);
  ctx.rotate(-0.62);
  ctx.beginPath();
  ctx.moveTo(0, -4.5 * u); ctx.lineTo(3.6 * u, 4.4 * u);
  ctx.lineTo(0, 2.1 * u); ctx.lineTo(-3.6 * u, 4.4 * u); ctx.closePath();
  ctx.fillStyle = '#fff'; ctx.fill();
  ctx.restore();
  phoneText(ctx, '26°', element.x + 18 * u, element.y + 70 * u, 35 * u, { weight: 320 });

  drawWeatherGlyph(ctx, 'moon', element.x + 315 * u, element.y + 26 * u, 18 * u);
  phoneText(ctx, 'Clear', element.x + 323 * u, element.y + 48 * u, 12 * u,
    { align: 'right', weight: 550 });
  phoneText(ctx, 'High', element.x + 228 * u, element.y + 69 * u, 7.5 * u,
    { align: 'right', weight: 600 });
  phoneText(ctx, '32°', element.x + 232 * u, element.y + 71 * u, 18 * u, { weight: 350 });
  phoneText(ctx, 'Low', element.x + 302 * u, element.y + 69 * u, 7.5 * u,
    { align: 'right', weight: 600 });
  phoneText(ctx, '25°', element.x + 306 * u, element.y + 71 * u, 18 * u, { weight: 350 });

  const hours = [
    ['2 AM', 'moon', '26°', '#fff'], ['3 AM', 'moon', '26°', '#fff'],
    ['4 AM', 'moon', '25°', '#fff'], ['5 AM', 'cloud', '25°', '#fff'],
    ['05:21', 'sunrise', '26°', '#ffdc3d'], ['6 AM', 'sun', '26°', '#ffdc3d'],
  ];
  hours.forEach(([time, kind, temp, iconColor], index) => {
    const x = element.x + (29 + index * 56.5) * u;
    phoneText(ctx, time, x, element.y + 95 * u, (time.length > 3 ? 9.3 : 9.5) * u,
      { align: 'center', weight: 600, color: 'rgba(255,255,255,.68)' });
    drawWeatherGlyph(ctx, kind, x, element.y + 116 * u, 17 * u, iconColor);
    phoneText(ctx, temp, x, element.y + 144 * u, 11 * u,
      { align: 'center', weight: 550 });
  });
  ctx.restore();
}

function drawBatteryDevice(ctx, kind, x, y, size) {
  ctx.save();
  ctx.strokeStyle = '#fff';
  ctx.fillStyle = '#fff';
  ctx.lineWidth = Math.max(1.2, size * 0.08);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  if (kind === 'phone') {
    roundRect(ctx, x - size * 0.22, y - size * 0.36, size * 0.44, size * 0.72, size * 0.07);
    ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x - size * 0.09, y - size * 0.29); ctx.lineTo(x + size * 0.09, y - size * 0.29); ctx.stroke();
  } else if (kind === 'watch') {
    roundRect(ctx, x - size * 0.26, y - size * 0.27, size * 0.52, size * 0.54, size * 0.12);
    ctx.fill();
    ctx.fillRect(x - size * 0.14, y - size * 0.47, size * 0.28, size * 0.2);
    ctx.fillRect(x - size * 0.14, y + size * 0.27, size * 0.28, size * 0.2);
  } else if (kind === 'airpods') {
    [-1, 1].forEach((side) => {
      ctx.beginPath(); ctx.arc(x + side * size * 0.18, y - size * 0.15, size * 0.13, 0, Math.PI * 2); ctx.fill();
      roundRect(ctx, x + side * size * 0.14 - size * 0.055, y - size * 0.09, size * 0.11, size * 0.43, size * 0.05);
      ctx.fill();
    });
  } else {
    roundRect(ctx, x - size * 0.32, y - size * 0.20, size * 0.64, size * 0.40, size * 0.13);
    ctx.fill();
    ctx.fillStyle = 'rgba(40,40,44,.62)';
    roundRect(ctx, x - size * 0.17, y - size * 0.10, size * 0.34, size * 0.05, size * 0.025);
    ctx.fill();
  }
  ctx.restore();
}

function drawBatteryWidget(ctx, element) {
  const u = element.w / 341;
  const devices = [
    { x: 49, value: 99, kind: 'phone', color: '#5bd564', charge: true },
    { x: 130, value: 82, kind: 'watch', color: '#ffdc3d' },
    { x: 211, value: 100, kind: 'airpods', color: '#5bd564', charge: true },
    { x: 292, value: 83, kind: 'case', color: '#5bd564' },
  ];
  devices.forEach((device) => {
    const cx = element.x + device.x * u;
    const cy = element.y + 61 * u;
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, 30 * u, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,255,255,.18)'; ctx.lineWidth = 6 * u; ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, cy, 30 * u, -Math.PI / 2,
      -Math.PI / 2 + Math.PI * 2 * device.value / 100);
    ctx.strokeStyle = device.color; ctx.lineWidth = 6 * u; ctx.lineCap = 'round'; ctx.stroke();
    drawBatteryDevice(ctx, device.kind, cx, cy, 25 * u);
    if (device.charge) {
      phoneText(ctx, 'ϟ', cx, cy - 27 * u, 13 * u,
        { align: 'center', weight: 750, color: device.color });
    }
    phoneText(ctx, `${device.value}%`, cx, element.y + 129 * u, 19 * u,
      { align: 'center', weight: 400 });
    ctx.restore();
  });
}

function drawHomeApp(ctx, frame, { x, y, kind, label, size: logicalSize = 63 }, offsetX = 0) {
  const s = frame.scale;
  const size = logicalSize * s;
  const left = frame.screen.x + x * s + offsetX;
  const top = frame.screen.y + y * s;
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,.24)';
  ctx.shadowBlur = 8 * s;
  ctx.shadowOffsetY = 3 * s;
  roundRect(ctx, left, top, size, size, 14 * s);
  const solid = {
    calendar: '#fff', appstore: '#1688f7', tiger: '#ee3427', camera: '#eef0f3',
    settings: '#8b8f96', wechat: '#2fd066', photos: '#fff', phone: '#38d260',
    messages: '#42d863', safari: '#f8fafc', chrome: '#f8fafc', baidu: '#fff',
    flight: '#3e91ef', lijing: '#bc75c7', weather: '#4898ef', shadowrocket: '#fff',
  }[kind] ?? '#e9ecf2';
  ctx.fillStyle = solid;
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if (kind === 'calendar') {
    ctx.fillStyle = '#e83b46';
    ctx.font = `650 ${10 * s}px -apple-system, "PingFang SC", system-ui, sans-serif`;
    ctx.fillText('周一', left + size / 2, top + 15 * s);
    ctx.fillStyle = '#111';
    ctx.font = `500 ${31 * s}px -apple-system, system-ui, sans-serif`;
    ctx.fillText('17', left + size / 2, top + 40 * s);
  } else if (kind === 'appstore') {
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 5.2 * s;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(left + 19 * s, top + 46 * s); ctx.lineTo(left + 34 * s, top + 17 * s);
    ctx.moveTo(left + 29 * s, top + 17 * s); ctx.lineTo(left + 46 * s, top + 46 * s);
    ctx.moveTo(left + 14 * s, top + 39 * s); ctx.lineTo(left + 49 * s, top + 39 * s);
    ctx.stroke();
  } else if (kind === 'camera') {
    const gradient = ctx.createRadialGradient(left + 32 * s, top + 31 * s, 2 * s, left + 32 * s, top + 31 * s, 23 * s);
    gradient.addColorStop(0, '#6eeaff'); gradient.addColorStop(0.34, '#123b80'); gradient.addColorStop(0.7, '#070b16'); gradient.addColorStop(1, '#17191f');
    ctx.beginPath(); ctx.arc(left + size / 2, top + size / 2, 23 * s, 0, Math.PI * 2);
    ctx.fillStyle = gradient; ctx.fill();
  } else if (kind === 'wechat' || kind === 'messages') {
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.ellipse(left + 27 * s, top + 29 * s, 18 * s, 14 * s, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.moveTo(left + 15 * s, top + 39 * s); ctx.lineTo(left + 13 * s, top + 48 * s); ctx.lineTo(left + 23 * s, top + 41 * s); ctx.fill();
    if (kind === 'wechat') {
      ctx.globalAlpha = 0.9;
      ctx.beginPath(); ctx.ellipse(left + 40 * s, top + 39 * s, 14 * s, 11 * s, 0, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    }
  } else if (kind === 'photos') {
    const petalColors = ['#f34f54', '#ff9e2c', '#f4d235', '#63bf45', '#36b6cf', '#4c71d9', '#9a60d1', '#e85eae'];
    petalColors.forEach((color, index) => {
      const angle = index * Math.PI / 4;
      ctx.beginPath();
      ctx.ellipse(left + 31.5 * s + Math.cos(angle) * 10 * s,
        top + 31.5 * s + Math.sin(angle) * 10 * s, 7.5 * s, 12 * s,
        angle, 0, Math.PI * 2);
      ctx.fillStyle = color; ctx.globalAlpha = 0.92; ctx.fill();
    });
    ctx.globalAlpha = 1;
  } else if (kind === 'safari') {
    ctx.beginPath(); ctx.arc(left + 31.5 * s, top + 31.5 * s, 22 * s, 0, Math.PI * 2);
    ctx.fillStyle = '#22a8ef'; ctx.fill();
    ctx.save(); ctx.translate(left + 31.5 * s, top + 31.5 * s); ctx.rotate(0.72);
    ctx.beginPath(); ctx.moveTo(0, -19 * s); ctx.lineTo(4 * s, 3 * s); ctx.lineTo(-4 * s, 3 * s); ctx.closePath(); ctx.fillStyle = '#f13f38'; ctx.fill();
    ctx.beginPath(); ctx.moveTo(0, 19 * s); ctx.lineTo(4 * s, -3 * s); ctx.lineTo(-4 * s, -3 * s); ctx.closePath(); ctx.fillStyle = '#fff'; ctx.fill(); ctx.restore();
  } else if (kind === 'chrome') {
    const cx = left + 31.5 * s; const cy = top + 31.5 * s; const radius = 22 * s;
    ['#e83c34', '#f6c441', '#35a853'].forEach((color, index) => {
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, radius,
        -Math.PI / 2 + index * Math.PI * 2 / 3, -Math.PI / 2 + (index + 1) * Math.PI * 2 / 3); ctx.closePath(); ctx.fillStyle = color; ctx.fill();
    });
    ctx.beginPath(); ctx.arc(cx, cy, 10 * s, 0, Math.PI * 2); ctx.fillStyle = '#2f7de1'; ctx.fill();
  } else if (kind === 'baidu') {
    const colors = ['#58d9ed', '#6bdbef', '#ee426d'];
    [[22, 26, 10], [42, 26, 10], [31.5, 38, 11]].forEach(([cx, cy, radius], index) => {
      ctx.beginPath(); ctx.arc(left + cx * s, top + cy * s, radius * s, 0, Math.PI * 2);
      ctx.fillStyle = colors[index]; ctx.fill();
    });
    ctx.fillStyle = '#458be5';
    ctx.font = `700 ${10 * s}px -apple-system, system-ui, sans-serif`;
    ctx.fillText('GenFlow', left + size / 2, top + 54 * s);
  } else if (kind === 'flight') {
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.moveTo(left + 31 * s, top + 9 * s); ctx.lineTo(left + 35 * s, top + 31 * s);
    ctx.lineTo(left + 54 * s, top + 38 * s); ctx.lineTo(left + 53 * s, top + 43 * s);
    ctx.lineTo(left + 34 * s, top + 39 * s); ctx.lineTo(left + 27 * s, top + 52 * s);
    ctx.lineTo(left + 23 * s, top + 51 * s); ctx.lineTo(left + 26 * s, top + 38 * s);
    ctx.lineTo(left + 10 * s, top + 34 * s); ctx.lineTo(left + 10 * s, top + 30 * s);
    ctx.lineTo(left + 27 * s, top + 30 * s); ctx.closePath(); ctx.fill();
  } else if (kind === 'lijing') {
    ctx.fillStyle = '#fff';
    for (let index = 0; index < 5; index++) {
      const angle = index * Math.PI * 2 / 5 - Math.PI / 2;
      ctx.beginPath();
      ctx.ellipse(left + 31.5 * s + Math.cos(angle) * 12 * s,
        top + 27 * s + Math.sin(angle) * 12 * s, 8 * s, 14 * s,
        angle + Math.PI / 2, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = '#e25263';
    ctx.beginPath(); ctx.arc(left + 31.5 * s, top + 28 * s, 4 * s, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.globalAlpha = 0.82;
    ctx.font = `600 ${8 * s}px -apple-system, "PingFang SC", system-ui, sans-serif`;
    ctx.fillText('Beauty', left + size / 2, top + 54 * s); ctx.globalAlpha = 1;
  } else if (kind === 'weather') {
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(left + 36 * s, top + 27 * s, 15 * s, 0, Math.PI * 2); ctx.fillStyle = '#ffdc3d'; ctx.fill();
    ctx.beginPath();
    ctx.arc(left + 24 * s, top + 39 * s, 11 * s, Math.PI, 0);
    ctx.arc(left + 36 * s, top + 35 * s, 14 * s, Math.PI, 0);
    ctx.arc(left + 47 * s, top + 41 * s, 9 * s, Math.PI, 0);
    ctx.lineTo(left + 14 * s, top + 48 * s); ctx.closePath(); ctx.fillStyle = '#fff'; ctx.fill();
  } else if (kind === 'shadowrocket') {
    ctx.strokeStyle = '#6c84ef'; ctx.lineWidth = 2.8 * s; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(left + 32 * s, top + 12 * s);
    ctx.bezierCurveTo(left + 42 * s, top + 22 * s, left + 42 * s, top + 34 * s, left + 32 * s, top + 45 * s);
    ctx.bezierCurveTo(left + 22 * s, top + 34 * s, left + 22 * s, top + 22 * s, left + 32 * s, top + 12 * s);
    ctx.stroke();
    ctx.beginPath(); ctx.arc(left + 32 * s, top + 28 * s, 4 * s, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(left + 27 * s, top + 46 * s); ctx.lineTo(left + 32 * s, top + 55 * s); ctx.lineTo(left + 37 * s, top + 46 * s); ctx.stroke();
  } else {
    ctx.fillStyle = '#fff';
    ctx.font = `600 ${(kind === 'tiger' ? 31 : 34) * s}px -apple-system, "PingFang SC", system-ui, sans-serif`;
    ctx.fillText(kind === 'tiger' ? '虎' : kind === 'settings' ? '⚙' : '☎', left + size / 2, top + size / 2 + 2 * s);
  }
  ctx.restore();
  if (label) drawFittedLabel(ctx, label, left + size / 2, top + size + 8 * s,
    HOME_LABEL_SIZE * s, size * 1.3, { align: 'center', weight: 550, color: '#fff' });
}

function drawHomeDock(ctx, frame) {
  const dockX = 17;
  const dockY = 731;
  const dockW = 359;
  const dockH = 91;
  const size = 60;
  const gap = 20;
  const startX = dockX + (dockW - size * 4 - gap * 3) / 2;
  const topY = dockY + (dockH - size) / 2;
  const apps = [
    { kind: 'phone' }, { kind: 'messages' },
    { kind: 'safari' }, { kind: 'chrome' },
  ];
  apps.forEach((app, index) => drawHomeApp(ctx, frame, {
    ...app, x: startX + index * (size + gap), y: topY, size, label: '',
  }));
}

/**
 * Home Screen labels share one type size at any stage scale. A name that does
 * not fit is squeezed by a few percent and then truncated, the way iOS does
 * it - scaling every long name down instead would make the grid look like a
 * dozen different fonts.
 */
function drawFittedLabel(ctx, text, x, y, baseSize, maxWidth, options = {}) {
  if (!text) return;
  ctx.save();
  const family = options.family ?? '-apple-system, "SF Pro Display", "PingFang SC", system-ui, sans-serif';
  const weight = options.weight ?? 550;
  const fontFor = (fontSize) => `${weight} ${fontSize}px ${family}`;
  const minScale = options.minScale ?? 0.86;
  ctx.font = fontFor(baseSize);
  let measured = ctx.measureText(text).width;
  let size = baseSize;
  if (measured > maxWidth) {
    size = Math.max(baseSize * minScale, baseSize * maxWidth / measured);
    ctx.font = fontFor(size);
    measured = ctx.measureText(text).width;
  }
  let label = text;
  if (measured > maxWidth) {
    while (label.length > 1 && ctx.measureText(`${label}…`).width > maxWidth) label = label.slice(0, -1);
    label = `${label}…`;
  }
  ctx.fillStyle = options.color ?? '#fff';
  ctx.globalAlpha = options.alpha ?? 1;
  ctx.textAlign = options.align ?? 'center';
  ctx.textBaseline = options.baseline ?? 'top';
  ctx.shadowColor = options.shadowColor ?? 'rgba(0,0,0,.45)';
  ctx.shadowBlur = options.shadowBlur ?? Math.max(2, size * 0.32);
  ctx.fillText(label, x, y);
  ctx.restore();
}

// One label size for widgets, folders and apps alike; it only tracks the
// stage scale, never the size of the thing it sits under.
const HOME_LABEL_SIZE = 11.5;

function drawHomeLabel(ctx, frame, element) {
  const s = frame.scale;
  const large = element.w > 100;
  drawFittedLabel(ctx, element.label, element.x + element.w / 2,
    element.y + element.h + (large ? 15 : 8) * s,
    HOME_LABEL_SIZE * s, element.w * (large ? 0.95 : 1.3),
    { align: 'center', weight: 550, color: '#fff' });
}

function drawHomePage1(ctx, frame, elements, offsetX) {
  for (const element of elements) {
    if (element.homeId === 'clock') drawClockWidget(ctx, element);
    else if (element.homeId === 'fitness') drawFitnessWidget(ctx, element);
    else drawGlassContents(ctx, element);
    drawHomeLabel(ctx, frame, element);
  }
  [
    { x: 29, y: 284, kind: 'calendar', label: 'Calendar' },
    { x: 301, y: 284, kind: 'appstore', label: 'App Store' },
    { x: 29, y: 479, kind: 'tiger', label: 'Hupu' },
    { x: 301, y: 479, kind: 'camera', label: 'Camera' },
    { x: 29, y: 577, kind: 'settings', label: 'Settings' },
    { x: 119, y: 577, kind: 'wechat', label: 'WeChat' },
    { x: 301, y: 577, kind: 'photos', label: 'Photos' },
  ].forEach((app) => drawHomeApp(ctx, frame, app, offsetX));
}

function drawPageDots(ctx, frame, progress) {
  const dotsY = frame.screen.y + 699 * frame.scale;
  for (let index = 0; index < 4; index++) {
    const activity = Math.max(0, 1 - Math.abs(index - progress));
    ctx.beginPath();
    ctx.arc(frame.screen.x + (172 + index * 16) * frame.scale, dotsY,
      (2.8 + activity * 0.6) * frame.scale, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255,255,255,${0.45 + activity * 0.55})`;
    ctx.fill();
  }
}

function drawHomePage2(ctx, frame, elements, offsetX) {
  for (const element of elements) {
    if (element.homeId === 'weather-widget') drawWeatherWidget(ctx, element);
    else if (element.homeId === 'battery-widget') drawBatteryWidget(ctx, element);
    else drawGlassContents(ctx, element);
    drawHomeLabel(ctx, frame, element);
  }
  [
    { x: 30, y: 286, kind: 'baidu', label: 'Baidu Drive' },
    { x: 121, y: 286, kind: 'flight', label: 'Flight Tracker' },
    { x: 211, y: 286, kind: 'lijing', label: 'Lijing Weather' },
    { x: 30, y: 383, kind: 'weather', label: 'Weather' },
    { x: 302, y: 383, kind: 'shadowrocket', label: 'Shadowrocket' },
  ].forEach((app) => drawHomeApp(ctx, frame, app, offsetX));
}

function drawHomeOverlay(ctx, frame, elements, viewState) {
  const pageIndex = viewState?.pageIndex ?? 0;
  const pageOffset = viewState?.pageOffset ?? 0;
  const pageWidth = frame.screen.w;
  drawHomePage1(ctx, frame, elements.filter((element) => element.phonePage === 0),
    -pageIndex * pageWidth + pageOffset);
  drawHomePage2(ctx, frame, elements.filter((element) => element.phonePage === 1),
    (1 - pageIndex) * pageWidth + pageOffset);
  drawPageDots(ctx, frame, Math.max(0, Math.min(1, pageIndex - pageOffset / pageWidth)));
  drawHomeDock(ctx, frame);
}

function notificationCard(ctx, element, title, body, time, accent, tinted = false) {
  const unit = element.w / 357;
  const icon = { x: element.x + 13 * unit, y: element.y + 16 * unit, w: 45 * unit, h: 45 * unit };
  roundRect(ctx, icon.x, icon.y, icon.w, icon.h, 11 * unit);
  const gradient = ctx.createLinearGradient(icon.x, icon.y, icon.x + icon.w, icon.y + icon.h);
  gradient.addColorStop(0, accent);
  gradient.addColorStop(1, '#e9efff');
  ctx.fillStyle = gradient;
  ctx.fill();
  const color = tinted ? '#16171b' : '#fff';
  phoneText(ctx, title, element.x + 70 * unit, element.y + 27 * unit, 15 * unit, { weight: 650, color });
  phoneText(ctx, time, element.x + element.w - 14 * unit, element.y + 26 * unit, 11 * unit, { align: 'right', alpha: 0.58, color });
  phoneText(ctx, body, element.x + 70 * unit, element.y + 50 * unit, 12.5 * unit, { alpha: 0.86, color, maxWidth: element.w - 86 * unit });
  if (element.h > 90 * unit) phoneText(ctx, 'Please note that the service is now fully operational.', element.x + 70 * unit, element.y + 70 * unit, 11 * unit, { alpha: 0.62, color, maxWidth: element.w - 86 * unit });
}

function drawNotificationOverlay(ctx, frame, elements, version) {
  const s = frame.scale;
  const sx = frame.screen.x;
  const sy = frame.screen.y;
  phoneText(ctx, 'Friday, August 14', sx + frame.screen.w / 2, sy + 112 * s, 17 * s, { align: 'center', weight: 550 });
  phoneText(ctx, '9:41', sx + frame.screen.w / 2, sy + 232 * s, 102 * s, { align: 'center', weight: 280 });
  const byId = elementMap(elements);
  const tinted = version === 'v2';
  notificationCard(ctx, byId.get('headline'), 'CS2', 'LVG win 2–0 · next round confirmed', '3m ago', '#172034', tinted);
  notificationCard(ctx, byId.get('building'), 'Five Condos', 'Elevator #4 is back in service', '24m ago', '#32b6ff', tinted);
  notificationCard(ctx, byId.get('message'), 'Oliverrr', 'I just saved so much time using one AI.', '27m ago', '#ff4b8b', tinted);
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
  for (const [element, level] of [[brightness, 0.5], [volume, 0.4]]) {
    const inset = 8 * frame.scale;
    const minPillHeight = (element.w - inset * 2) * 1.5;
    const fillHeight = Math.max(minPillHeight, (element.h - inset * 2) * level);
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

/**
 * Draw a Notification / Control Centre sheet that is sliding over the Home
 * Screen. `offsetY` is how far the sheet still is from its resting place, so
 * the artwork travels with the glass instead of being revealed by a mask.
 */
export function drawPhonePanelOverlay(ctx, kind, elements, width, height, version, offsetY) {
  const frame = phoneFrame(width, height);
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(frame.screen.x, frame.screen.y, frame.screen.w, frame.screen.h, frame.screen.r);
  ctx.clip();
  ctx.translate(0, offsetY);
  if (kind === 'notification') drawNotificationOverlay(ctx, frame, elements, version);
  else drawControlOverlay(ctx, frame, elements);
  drawPhoneChrome(ctx, frame, {});
  ctx.restore();
}

/** Draw fixed iOS UI above the glass, including status glyphs and hardware. */
export function drawPhoneSceneOverlay(ctx, scene, elements, width, height, version = 'v1', viewState = null) {
  const frame = phoneFrame(width, height);
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(frame.screen.x, frame.screen.y, frame.screen.w, frame.screen.h, frame.screen.r);
  ctx.clip();
  if (scene.phoneView === 'home') drawHomeOverlay(ctx, frame, elements, viewState);
  else if (scene.phoneView === 'notification') drawNotificationOverlay(ctx, frame, elements, version);
  else drawControlOverlay(ctx, frame, elements);
  const chrome = scene.phoneView === 'home'
    ? { time: '01:27', recording: true, statusIcon: 'location' }
    : {};
  drawPhoneChrome(ctx, frame, chrome);
  ctx.restore();
}
