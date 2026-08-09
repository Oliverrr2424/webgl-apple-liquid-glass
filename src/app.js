import { GlassRenderer } from './renderer.js';
import { makeMaterial, PRESETS, SLIDERS } from './material.js';
import { drawFolderContents, drawLabel, drawBadge } from './overlay.js';

const glCanvas = document.getElementById('gl');
const uiCanvas = document.getElementById('ui');
const stage = document.getElementById('stage');
const ctx = uiCanvas.getContext('2d');
const renderer = new GlassRenderer(glCanvas);

const I = {
  red: (t) => ({ t, c0: '#ff4b3e', c1: '#e01b0c' }),
  blue: (t) => ({ t, c0: '#3f8bff', c1: '#1155e0' }),
  green: (t) => ({ t, c0: '#4bd964', c1: '#12a83a' }),
  dark: (t) => ({ t, c0: '#3a3f47', c1: '#15181c' }),
  white: (t) => ({ t, c0: '#ffffff', c1: '#e6e6ea', fg: '#22242a' }),
  orange: (t) => ({ t, c0: '#ffb648', c1: '#f27a12' }),
  purple: (t) => ({ t, c0: '#a06bff', c1: '#6a2bd8' }),
  teal: (t) => ({ t, c0: '#3ad2c8', c1: '#128f9c' }),
  pink: (t) => ({ t, c0: '#ff6fa8', c1: '#e02a72' }),
};

// Layout in fractions of the stage. size = folder width / stage width.
const SCENES = [
  {
    name: '黄昏树枝 (ref 1/2/5)', wallpaper: 0,
    folders: [
      { fx: 0.46, fy: 0.45, size: 0.20, label: '社交网络',
        icons: [I.red('剧'), I.red('红')] },
      { fx: 0.80, fy: 0.63, size: 0.20, label: 'UofT',
        icons: [I.green('微'), I.blue('U'), I.blue('T'), I.red('◎')] },
    ],
  },
  {
    name: '深蓝夜景 (ref 3)', wallpaper: 1,
    folders: [
      { fx: 0.40, fy: 0.13, size: 0.24, label: '照片与视频', badge: '505',
        icons: [I.dark('●'), I.dark('✂')] },
      { fx: 0.44, fy: 0.42, size: 0.24, label: '生活', badge: '408',
        icons: [I.red('淘'), I.orange('美'), I.blue('支'), I.dark('U'), I.blue('鲸'),
                I.red('京'), I.green('TD'), I.orange('人'), I.dark('得')] },
      { fx: 0.36, fy: 0.70, size: 0.24, label: 'Productivity', badge: '2',
        icons: [I.white('◉'), I.teal('◈'), I.purple('≋'), I.pink('☺'),
                I.white('✦'), I.blue('≈'), I.white('♥'), I.dark('◎'), I.green('▲')] },
    ],
  },
  {
    name: '海岛 (ref 4)', wallpaper: 2,
    folders: [
      { fx: 0.11, fy: 0.36, size: 0.16, label: '邮箱', badge: '1,126',
        icons: [I.blue('✉'), I.white('M'), I.purple('◑')] },
      { fx: 0.34, fy: 0.36, size: 0.16, label: '游戏', badge: '4',
        icons: [I.dark('S'), I.dark('▚'), I.red('忍'), I.pink('◆'), I.orange('S'),
                I.green('◇'), I.green('Z'), I.red('▤'), I.orange('★')] },
      { fx: 0.58, fy: 0.36, size: 0.16, label: '生活', badge: '408',
        icons: [I.red('淘'), I.orange('美'), I.blue('支'), I.dark('U'), I.blue('鲸'),
                I.red('京'), I.green('TD'), I.orange('人'), I.dark('得')] },
      { fx: 0.82, fy: 0.36, size: 0.16, label: 'App Store',
        icons: [I.dark('B'), I.green('♪'), I.red('网')] },
    ],
  },
];

const state = {
  scene: 0,
  material: makeMaterial('regular'),
  showIcons: true,
  showLabels: true,
  wallZoom: 1,
  folders: [],
  dragging: null,
};

function layout() {
  const w = stage.clientWidth;
  const h = stage.clientHeight;
  const sc = SCENES[state.scene];
  state.folders = sc.folders.map((f) => {
    const size = f.size * w;
    return {
      ...f,
      w: size, h: size,
      x: f.fx * w - size / 2,
      y: f.fy * h - size / 2,
    };
  });
}

function radiusFor(f) {
  // iOS folder corner radius is ~23.5% of the side
  return Math.min(state.material.radius, f.w * 0.235);
}

function render() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = stage.clientWidth;
  const h = stage.clientHeight;
  renderer.resize(Math.round(w * dpr), Math.round(h * dpr));
  glCanvas.style.width = w + 'px';
  glCanvas.style.height = h + 'px';
  uiCanvas.width = Math.round(w * dpr);
  uiCanvas.height = Math.round(h * dpr);
  uiCanvas.style.width = w + 'px';
  uiCanvas.style.height = h + 'px';

  renderer.buildBackdrop(SCENES[state.scene].wallpaper, state.wallZoom);
  renderer.drawBackdrop();
  for (const f of state.folders) {
    renderer.drawGlass(f, { ...state.material, radius: radiusFor(f) }, dpr);
  }

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  for (const f of state.folders) {
    if (state.showIcons) drawFolderContents(ctx, f);
    if (state.showLabels) { drawLabel(ctx, f); drawBadge(ctx, f); }
  }
}

let queued = false;
function invalidate() {
  if (queued) return;
  queued = true;
  requestAnimationFrame(() => { queued = false; render(); });
}

// ---------------------------------------------------------------- controls
const panel = document.getElementById('sliders');
const inputs = {};
for (const [key, min, max, step] of SLIDERS) {
  const row = document.createElement('label');
  row.className = 'row';
  row.innerHTML = `<span>${key}</span><input type="range" min="${min}" max="${max}" step="${step}"><b></b>`;
  const input = row.querySelector('input');
  const out = row.querySelector('b');
  input.value = state.material[key];
  out.textContent = (+state.material[key]).toFixed(2);
  input.addEventListener('input', () => {
    state.material[key] = parseFloat(input.value);
    out.textContent = parseFloat(input.value).toFixed(2);
    invalidate();
  });
  inputs[key] = { input, out };
  panel.appendChild(row);
}

function syncSliders() {
  for (const [key] of SLIDERS) {
    inputs[key].input.value = state.material[key];
    inputs[key].out.textContent = (+state.material[key]).toFixed(2);
  }
}

document.querySelectorAll('[data-preset]').forEach((b) => {
  b.addEventListener('click', () => {
    state.material = makeMaterial(b.dataset.preset);
    syncSliders();
    invalidate();
  });
});

document.querySelectorAll('[data-debug]').forEach((b) => {
  b.addEventListener('click', () => {
    state.material.debug = +b.dataset.debug;
    invalidate();
  });
});

const sceneSel = document.getElementById('scene');
SCENES.forEach((s, i) => {
  const o = document.createElement('option');
  o.value = i; o.textContent = s.name;
  sceneSel.appendChild(o);
});
sceneSel.addEventListener('change', () => {
  state.scene = +sceneSel.value;
  layout(); invalidate();
});

document.getElementById('toggleIcons').addEventListener('change', (e) => {
  state.showIcons = e.target.checked; invalidate();
});
document.getElementById('toggleLabels').addEventListener('change', (e) => {
  state.showLabels = e.target.checked; invalidate();
});
document.getElementById('togglePanel').addEventListener('click', () => {
  document.body.classList.toggle('hide-panel');
  requestAnimationFrame(() => { layout(); invalidate(); });
});

// ---------------------------------------------------------------- dragging
uiCanvas.addEventListener('pointerdown', (e) => {
  const r = uiCanvas.getBoundingClientRect();
  const mx = e.clientX - r.left;
  const my = e.clientY - r.top;
  for (let i = state.folders.length - 1; i >= 0; i--) {
    const f = state.folders[i];
    if (mx >= f.x && mx <= f.x + f.w && my >= f.y && my <= f.y + f.h) {
      state.dragging = { f, dx: mx - f.x, dy: my - f.y };
      uiCanvas.setPointerCapture(e.pointerId);
      break;
    }
  }
});
uiCanvas.addEventListener('pointermove', (e) => {
  if (!state.dragging) return;
  const r = uiCanvas.getBoundingClientRect();
  const { f, dx, dy } = state.dragging;
  f.x = e.clientX - r.left - dx;
  f.y = e.clientY - r.top - dy;
  invalidate();
});
uiCanvas.addEventListener('pointerup', () => { state.dragging = null; });

window.addEventListener('resize', () => { layout(); invalidate(); });

// hook for automated screenshot / tuning
window.__lg = {
  state, render, invalidate, layout, PRESETS, syncSliders,
  set(patch) { Object.assign(state.material, patch); syncSliders(); render(); },
  setScene(i) { state.scene = i; sceneSel.value = i; state.wallZoom = 1; layout(); render(); },
  focus(index, zoom = 2) {
    // isolate one folder, centred and enlarged, for close-up comparisons.
    // Every length of the material scales with the zoom, so this is a true
    // magnification of the same physical glass, not a different material.
    layout();
    const f = state.folders[index];
    const w = stage.clientWidth, h = stage.clientHeight;
    const s = f.w * zoom;
    f.w = f.h = s;
    f.x = w / 2 - s / 2;
    f.y = h / 2 - s / 2;
    state.folders = [f];
    state.wallZoom = zoom;
    const m = state.material;
    for (const k of ['radius', 'bevel', 'height', 'shadowSize', 'shadowOffset', 'edgeWidth']) {
      m[k] *= zoom;
    }
    m.blurPlateau += Math.log2(zoom);
    m.blurRim += Math.log2(zoom);
    syncSliders();
    render();
  },
};

layout();
render();
