// Shared iPhone geometry and rendering for the three fixed mobile scenes.
// Coordinates inside a phone use the iPhone 15 Pro's 393 × 852 point canvas;
// keeping that coordinate system in one place prevents the glass, wallpaper,
// status bar and overlay artwork from drifting apart as the stage resizes.

export const PHONE_SCREEN_WIDTH = 393;
export const PHONE_SCREEN_HEIGHT = 852;

const PHONE_ICONS = {
  wifi: './assets/icons/system/wifi.svg',
  plane: './assets/icons/system/plane.svg',
  bluetooth: './assets/icons/system/bluetooth.svg',
  antenna: './assets/icons/system/antenna.svg',
  rotation: './assets/icons/system/rotate-ccw-key.svg',
  mirroring: './assets/icons/system/screen-share.svg',
  flashlight: './assets/icons/system/flashlight.svg',
  camera: './assets/icons/system/camera.svg',
  calculator: './assets/icons/system/calculator.svg',
  voice: './assets/icons/system/audio-lines.svg',
  record: './assets/icons/system/circle-power.svg',
  battery: './assets/icons/system/battery-low.svg',
  moon: './assets/icons/system/moon.svg',
  sun: './assets/icons/system/sun.svg',
  volume: './assets/icons/system/volume-2.svg',
};

const phoneIconImages = new Map();
let tintCanvas = null;

export const PHONE_ICON_SOURCES = Object.freeze(Object.values(PHONE_ICONS));

export function attachPhoneIconImages(images) {
  for (const [name, src] of Object.entries(PHONE_ICONS)) phoneIconImages.set(name, images.get(src) ?? null);
}

/** Draw a vendored SVG symbol; optional tinting is isolated in a tiny buffer. */
export function drawPhoneIcon(ctx, name, x, y, width, height = width, color = '#fff') {
  const icon = phoneIconImages.get(name);
  if (!icon?.complete) return;
  if (color === '#fff' || color === 'white') {
    ctx.drawImage(icon, x, y, width, height);
    return;
  }
  if (typeof document === 'undefined') return;
  if (!tintCanvas) tintCanvas = document.createElement('canvas');
  const pixelWidth = Math.max(1, Math.ceil(width * 2));
  const pixelHeight = Math.max(1, Math.ceil(height * 2));
  tintCanvas.width = pixelWidth;
  tintCanvas.height = pixelHeight;
  const tintContext = tintCanvas.getContext('2d');
  tintContext.clearRect(0, 0, pixelWidth, pixelHeight);
  tintContext.drawImage(icon, 0, 0, pixelWidth, pixelHeight);
  tintContext.globalCompositeOperation = 'source-in';
  tintContext.fillStyle = color;
  tintContext.fillRect(0, 0, pixelWidth, pixelHeight);
  tintContext.globalCompositeOperation = 'source-over';
  ctx.drawImage(tintCanvas, x, y, width, height);
}

export function phoneFrame(width, height) {
  const outerAspect = 413 / 880;
  const availableWidth = Math.max(180, width - 56);
  const availableHeight = Math.max(320, height - 40);
  const outerHeight = Math.min(880, availableHeight, availableWidth / outerAspect);
  const scale = outerHeight / 880;
  const outerWidth = 413 * scale;
  const outer = {
    x: (width - outerWidth) / 2,
    y: (height - outerHeight) / 2,
    w: outerWidth,
    h: outerHeight,
    r: 59 * scale,
  };
  const screen = {
    x: outer.x + 10 * scale,
    y: outer.y + 14 * scale,
    w: PHONE_SCREEN_WIDTH * scale,
    h: PHONE_SCREEN_HEIGHT * scale,
    r: 49 * scale,
  };
  return { outer, screen, scale };
}

export function phoneRect(frame, x, y, w, h) {
  return {
    x: frame.screen.x + x * frame.scale,
    y: frame.screen.y + y * frame.scale,
    w: w * frame.scale,
    h: h * frame.scale,
  };
}

function rounded(ctx, rect, radius) {
  ctx.beginPath();
  ctx.roundRect(rect.x, rect.y, rect.w, rect.h, radius);
}

function drawNeon(ctx, w, h) {
  ctx.fillStyle = '#07070b';
  ctx.fillRect(0, 0, w, h);
  const glow = ctx.createRadialGradient(w * 0.8, h * 0.75, 0, w * 0.8, h * 0.75, w * 0.68);
  glow.addColorStop(0, '#9b0f71');
  glow.addColorStop(0.46, '#371034');
  glow.addColorStop(1, '#07070b');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, w, h);

  ctx.save();
  ctx.shadowColor = 'rgba(255,92,79,.25)';
  ctx.shadowBlur = Math.max(20, w * 0.04);
  ctx.fillStyle = '#ff6555';
  ctx.beginPath();
  ctx.moveTo(w * 0.17, -h * 0.12);
  ctx.lineTo(w * 0.45, -h * 0.12);
  ctx.bezierCurveTo(w * 0.42, h * 0.27, w * 0.37, h * 0.58, w * 0.22, h * 1.12);
  ctx.lineTo(-w * 0.08, h * 1.12);
  ctx.bezierCurveTo(w * 0.08, h * 0.65, w * 0.13, h * 0.22, w * 0.17, -h * 0.12);
  ctx.fill();
  ctx.restore();

  const pink = ctx.createLinearGradient(w * 0.55, h, w, h * 0.55);
  pink.addColorStop(0, '#ff497d');
  pink.addColorStop(0.52, '#ef1873');
  pink.addColorStop(1, '#75106f');
  ctx.fillStyle = pink;
  ctx.beginPath();
  ctx.moveTo(w * 0.45, h * 1.08);
  ctx.bezierCurveTo(w * 0.58, h * 0.7, w * 0.82, h * 0.43, w * 1.08, h * 0.38);
  ctx.lineTo(w * 1.08, h * 1.08);
  ctx.fill();

  ctx.strokeStyle = 'rgba(255,97,82,.65)';
  ctx.lineWidth = Math.max(1.5, w * 0.004);
  ctx.beginPath();
  ctx.moveTo(-w * 0.05, h * 0.79);
  ctx.bezierCurveTo(w * 0.22, h * 0.56, w * 0.39, h * 0.19, w * 0.43, -h * 0.05);
  ctx.stroke();
}

function drawType(ctx, w, h) {
  ctx.fillStyle = '#f2f0e9';
  ctx.fillRect(0, 0, w, h);
  ['#ff4b46', '#4964ff', '#42ef7d', '#ffca36'].forEach((color, index) => {
    ctx.fillStyle = color;
    ctx.fillRect(index * w / 5, index % 2 ? 0 : h * 0.58, w / 5, h * 0.42);
  });
  ctx.fillStyle = '#0b0b0c';
  ctx.font = `900 ${Math.max(54, w * 0.22)}px -apple-system, system-ui, sans-serif`;
  ctx.fillText('OPTICAL', w * 0.045, h * 0.34);
  ctx.fillText('DISTORTION', -w * 0.05, h * 0.56);
  ctx.strokeStyle = '#ff4b46';
  ctx.lineWidth = Math.max(2, w * 0.007);
  ctx.beginPath();
  ctx.arc(w * 0.82, h * 0.22, h * 0.13, 0, Math.PI * 2);
  ctx.stroke();
}

function drawSpectrum(ctx, w, h) {
  ctx.fillStyle = '#06070c';
  ctx.fillRect(0, 0, w, h);
  const gradient = ctx.createLinearGradient(0, 0, w, h);
  gradient.addColorStop(0, '#18d9ff');
  gradient.addColorStop(0.28, '#445dff');
  gradient.addColorStop(0.55, '#d431ff');
  gradient.addColorStop(0.78, '#ff3b67');
  gradient.addColorStop(1, '#ffb02e');
  ctx.strokeStyle = gradient;
  ctx.lineWidth = Math.max(18, w * 0.1);
  ctx.lineCap = 'round';
  for (let index = -1; index < 7; index++) {
    const y = h * (index / 6);
    ctx.beginPath();
    ctx.moveTo(-w * 0.1, y + h * 0.14);
    ctx.bezierCurveTo(w * 0.24, y - h * 0.15, w * 0.66, y + h * 0.2, w * 1.08, y - h * 0.08);
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(5,6,10,.82)';
  ctx.font = `900 ${Math.max(70, w * 0.3)}px -apple-system, system-ui, sans-serif`;
  ctx.fillText('RGB', w * 0.08, h * 0.64);
}

function drawWallpaper(ctx, wallpaper, width, height) {
  if (wallpaper === 'type') drawType(ctx, width, height);
  else if (wallpaper === 'neon') drawNeon(ctx, width, height);
  else drawSpectrum(ctx, width, height);
}

/** Paint the stage, titanium bezel, and one of the three V2 prototype images. */
export function drawPhoneBackdrop(ctx, scene, width, height) {
  const frame = phoneFrame(width, height);
  const stageGlow = ctx.createRadialGradient(width * 0.5, height * 0.47, 0, width * 0.5, height * 0.47, Math.max(width, height) * 0.62);
  stageGlow.addColorStop(0, '#222936');
  stageGlow.addColorStop(0.46, '#10141b');
  stageGlow.addColorStop(1, '#06080b');
  ctx.fillStyle = stageGlow;
  ctx.fillRect(0, 0, width, height);

  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,.72)';
  ctx.shadowBlur = 38 * frame.scale;
  ctx.shadowOffsetY = 20 * frame.scale;
  rounded(ctx, frame.outer, frame.outer.r);
  const titanium = ctx.createLinearGradient(frame.outer.x, 0, frame.outer.x + frame.outer.w, 0);
  titanium.addColorStop(0, '#777d86');
  titanium.addColorStop(0.08, '#22262d');
  titanium.addColorStop(0.5, '#050608');
  titanium.addColorStop(0.92, '#242831');
  titanium.addColorStop(1, '#858b94');
  ctx.fillStyle = titanium;
  ctx.fill();
  ctx.restore();

  ctx.save();
  rounded(ctx, frame.screen, frame.screen.r);
  ctx.clip();
  ctx.translate(frame.screen.x, frame.screen.y);
  drawWallpaper(ctx, scene.backdrop.wallpaper, frame.screen.w, frame.screen.h);
  // Notification and Control Centre sit over a softened wallpaper on iOS.
  if (scene.phoneView !== 'home') {
    ctx.fillStyle = scene.phoneView === 'notification' ? 'rgba(18,14,18,.22)' : 'rgba(3,5,10,.34)';
    ctx.fillRect(0, 0, frame.screen.w, frame.screen.h);
  }
  ctx.restore();

  // Thin inner and outer rails keep the silhouette from reading as a card.
  ctx.save();
  rounded(ctx, frame.outer, frame.outer.r);
  ctx.strokeStyle = 'rgba(255,255,255,.34)';
  ctx.lineWidth = Math.max(1, frame.scale);
  ctx.stroke();
  rounded(ctx, frame.screen, frame.screen.r);
  ctx.strokeStyle = 'rgba(0,0,0,.92)';
  ctx.lineWidth = Math.max(2, 4 * frame.scale);
  ctx.stroke();
  ctx.restore();
  return frame;
}

export function drawPhoneChrome(ctx, frame, { darkStatus = false } = {}) {
  const { screen, scale } = frame;
  const fg = darkStatus ? '#090a0d' : '#fff';
  ctx.save();
  ctx.fillStyle = fg;
  ctx.font = `600 ${15 * scale}px -apple-system, "SF Pro Text", system-ui, sans-serif`;
  ctx.textBaseline = 'middle';
  ctx.fillText('9:41', screen.x + 27 * scale, screen.y + 34 * scale);

  const right = screen.x + screen.w;
  const cy = screen.y + 34 * scale;
  ctx.strokeStyle = fg;
  ctx.fillStyle = fg;
  ctx.lineWidth = Math.max(1.3, 2.1 * scale);
  // cellular bars use the same optical weight as the vendored status glyphs.
  for (let index = 0; index < 4; index++) {
    const barH = (4 + index * 3) * scale;
    ctx.beginPath();
    ctx.roundRect(right - 94 * scale + index * 6 * scale, cy + 6 * scale - barH, 3.6 * scale, barH, 2 * scale);
    ctx.fill();
  }
  drawPhoneIcon(ctx, 'wifi', right - 65 * scale, cy - 11 * scale, 23 * scale, 23 * scale, fg);
  drawPhoneIcon(ctx, 'battery', right - 36 * scale, cy - 12 * scale, 27 * scale, 24 * scale, fg);
  ctx.beginPath();
  ctx.roundRect(right - 30.5 * scale, cy - 4 * scale, 13.5 * scale, 8 * scale, 2 * scale);
  ctx.fillStyle = fg;
  ctx.fill();

  // Dynamic Island is drawn last so nothing visually crosses the hardware cutout.
  const island = phoneRect(frame, 132, 11, 129, 36);
  ctx.shadowColor = 'rgba(0,0,0,.3)';
  ctx.shadowBlur = 5 * scale;
  rounded(ctx, island, island.h / 2);
  ctx.fillStyle = '#020203';
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.fillStyle = 'rgba(16,28,44,.65)';
  ctx.beginPath();
  ctx.arc(island.x + island.w - 18 * scale, island.y + island.h / 2, 5 * scale, 0, Math.PI * 2);
  ctx.fill();

  const indicator = phoneRect(frame, 126, 832, 141, 5);
  rounded(ctx, indicator, indicator.h / 2);
  ctx.fillStyle = fg;
  ctx.fill();
  ctx.restore();
}
