import { LiquidGlass, LiquidGlassNavbar, LiquidGlassSwitch } from 'apple-liquid-glass-webgl';

// An animated canvas behind the whole page. Nothing tells the glass about it:
// the default `backdrop: 'auto'` finds it and redraws while it animates.
const aurora = document.querySelector('#aurora');
const context = aurora.getContext('2d');
let speed = 1;

function paintAurora(time) {
  const dpr = Math.min(devicePixelRatio || 1, 2);
  const width = innerWidth;
  const height = innerHeight;
  if (aurora.width !== Math.round(width * dpr) || aurora.height !== Math.round(height * dpr)) {
    aurora.width = Math.round(width * dpr);
    aurora.height = Math.round(height * dpr);
  }
  context.setTransform(dpr, 0, 0, dpr, 0, 0);
  context.fillStyle = '#060a10';
  context.fillRect(0, 0, width, height);
  const t = time * 0.00018 * speed;
  const blobs = [
    [0.18 + Math.sin(t * 1.1) * 0.08, 0.30 + Math.cos(t) * 0.06, 0.42, '70,197,157'],
    [0.80 + Math.cos(t * 0.8) * 0.08, 0.22 + Math.sin(t * 1.2) * 0.06, 0.34, '234,169,88'],
    [0.66 + Math.sin(t * 0.7) * 0.07, 0.78 + Math.cos(t * 1.4) * 0.08, 0.48, '97,91,220'],
    [0.28 + Math.cos(t * 1.3) * 0.07, 0.86 + Math.sin(t * 0.7) * 0.06, 0.30, '208,83,131'],
  ];
  for (const [x, y, radius, rgb] of blobs) {
    const gradient = context.createRadialGradient(x * width, y * height, 0, x * width, y * height, radius * width);
    gradient.addColorStop(0, `rgba(${rgb},.75)`);
    gradient.addColorStop(1, `rgba(${rgb},0)`);
    context.fillStyle = gradient;
    context.fillRect(0, 0, width, height);
  }
  requestAnimationFrame(paintAurora);
}
requestAnimationFrame(paintAurora);

// Glass on ordinary elements. Shape and corner radius come from their CSS.
new LiquidGlass('.cta', { tint: 0.08 });
// White text on a bright photo: a dark tint keeps it legible.
new LiquidGlass('.grid', { targets: '.card', frost: 0.3, tint: 0.7, tintTone: 'dark' });
new LiquidGlass('.panel', { frost: 0.45, tint: 0.5, tintTone: 'light' });

// Ready-made controls, sized by their containers' CSS.
const nav = new LiquidGlassNavbar('#nav', {
  items: [
    { value: 'home', label: 'Home' },
    { value: 'work', label: 'Work' },
    { value: 'read', label: 'Read' },
  ],
  onChange: (id) => document.getElementById(id).scrollIntoView({ behavior: 'smooth' }),
});
new LiquidGlassSwitch('#calm', {
  ariaLabel: 'Calm motion',
  onChange: (calm) => { speed = calm ? 0.2 : 1; },
});

const sections = document.querySelectorAll('main > section');
new IntersectionObserver((entries) => {
  for (const entry of entries) if (entry.isIntersecting) nav.setValue(entry.target.id);
}, { threshold: 0.55 }).observe(...sections);
