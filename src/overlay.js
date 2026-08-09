// Everything that sits ON TOP of the glass: app icons, folder label, badge.

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
