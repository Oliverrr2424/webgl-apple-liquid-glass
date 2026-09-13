// The reel stage: four liquid-glass components — folder, rect, pill, circle —
// held on screen while nine backdrops cut past behind them, under a standing
// watermark and over a closing card.
//
// Three stretches double as material demos, and are the only captioned moments.
// The first two are spread over several scenes so a held value is always seen
// against a changing backdrop: `backdropBlur` rises to 4px over the city lights,
// holds across two cuts and releases over the kaleidoscope, and the appearance
// switch runs dark / light / dark across the sunset, the tunnel and the marble.
// The last brings the blur back at 5px over the closing shot and holds it.
//
// The whole frame is a pure function of one virtual clock, so `__reel.seek(ms)`
// followed by a screenshot gives a deterministic 60 fps capture.

import { LiquidGlassWebGLV2 } from '../../src/v2.js';
import { createBackground, TRANSITIONS } from './backgrounds.js';

const W = 1920;
const H = 1080;
const TRANSITION = 0.42;   // seconds of overlap between two backdrops
const FADE_IN = 0.45;
const FADE_OUT = 0.6;
const END_CARD = 3.0;      // black card with the package and repository

const PACKAGE = 'apple-liquid-glass-webgl';
const REPOSITORY = 'github.com/Oliverrr2424/webgl-apple-liquid-glass';

// ---------------------------------------------------------------- timeline --

const PHOTOS = {
  'natural-lake': '../../assets/wallpapers/natural-lake.webp',
  'night-city': '../../assets/wallpapers/night-city.webp',
  'home-page-sunset': '../../assets/wallpapers/home-page-sunset.png',
  'earth-black': '../../assets/wallpapers/earth-black.png',
};

// `hold` is how long the scene owns the frame, transition included.
// `out` names the transition that carries it into the next scene.
const TIMELINE = [
  { shader: 'flowlines', t0: 12, hold: 2.4, out: 'fade' },
  { photo: 'natural-lake', kenBurns: [1.04, 1.20, 0.07, 0.03], hold: 3.6, out: 'wipe' },
  { photo: 'night-city', kenBurns: [1.16, 1.04, -0.05, 0.0], hold: 2.6, out: 'push' },
  { shader: 'waves', t0: 14, hold: 2.6, out: 'iris' },
  { shader: 'kaleido', t0: 11, hold: 2.6, out: 'fade' },
  { photo: 'home-page-sunset', kenBurns: [1.06, 1.18, -0.04, -0.02], hold: 2.5, out: 'fade' },
  { shader: 'tunnel', t0: 20, hold: 2.5, out: 'slats' },
  { shader: 'mercury', t0: 9, hold: 2.5, out: 'zoom' },
  { photo: 'earth-black', kenBurns: [1.18, 1.04, 0.04, 0.0], hold: 3.6, out: null },
];

let clock = 0;
for (const scene of TIMELINE) {
  scene.start = clock;
  clock += scene.hold;
}
const SCENES_END = clock;
const DURATION = SCENES_END + END_CARD;

// ------------------------------------------------------------------- demos --

const easeInOut = (x) => (x < 0.5 ? 4 * x * x * x : 1 - ((-2 * x + 2) ** 3) / 2);
const clamp01 = (x) => Math.max(0, Math.min(1, x));
const smoothstep = (a, b, x) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

/** Eased piecewise track: [[timeInWindow, value], …]. Nothing ever steps. */
function trackValue(track, local) {
  if (local <= track[0][0]) return track[0][1];
  for (let i = 1; i < track.length; i++) {
    const [t1, v1] = track[i];
    if (local > t1) continue;
    const [t0, v0] = track[i - 1];
    return v0 + (v1 - v0) * easeInOut(clamp01((local - t0) / (t1 - t0)));
  }
  return track.at(-1)[1];
}

// The appearance track is signed: negative is the dark tone, positive the
// light one, and it passes through clear on the way between them so the switch
// never snaps. Dark glass wants the full tint; light glass reads as white long
// before that.
const DARK_TINT = 1.0;
const LIGHT_TINT = 0.42;
const tintFor = (value) => Math.abs(value) * (value < 0 ? DARK_TINT : LIGHT_TINT);

const DEMOS = [
  {
    // Rises over the city lights, holds across two cuts, releases over the
    // kaleidoscope: the held value is never parked on one backdrop.
    scenes: [2, 4],
    kicker: () => 'BACKGROUND PRE-BLUR',
    track: [[0, 0], [0.5, 0], [1.4, 4], [5.6, 4], [6.6, 0], [7.8, 0]],
    caption: (value) => `backdropBlur: ${value.toFixed(1)}px`,
    apply: (value, elements, glass) => {
      glass.setMaterial({ backdropBlur: value }, false);
      return elements;
    },
  },
  {
    // The closing shot goes soft: the pre-blur comes back at 5px, ramped on
    // and held under the end card.
    scenes: [8, 8],
    kicker: () => 'BACKGROUND PRE-BLUR',
    track: [[0, 0], [0.55, 0], [1.5, 5], [3.6, 5]],
    caption: (value) => `backdropBlur: ${value.toFixed(1)}px`,
    apply: (value, elements, glass) => {
      glass.setMaterial({ backdropBlur: value }, false);
      return elements;
    },
  },
  {
    // Three scenes, three states: dark over the bright sunset, light over the
    // dark tunnel, dark again over the bright marble. Each tone lands on the
    // brightness it is actually for, and each swap happens on a cut.
    scenes: [5, 7],
    kicker: (value) => (value < 0 ? 'DARK MODE' : 'LIGHT MODE'),
    track: [
      [0, 0], [0.35, 0], [0.9, -1], [2.2, -1], [2.55, 0],
      [3.1, 1], [4.4, 1], [4.95, 0], [5.5, -1], [6.8, -1], [7.2, 0], [7.5, 0],
    ],
    caption: (value) => (
      `tint: ${tintFor(value).toFixed(2)} · tintTone: '${value < 0 ? 'dark' : 'light'}'`
    ),
    // The caption belongs to a tone, so it fades out while the glass is clear.
    alpha: (value) => smoothstep(0.04, 0.3, Math.abs(value)),
    apply: (value, elements) => elements.map((element) => ({
      ...element, tint: tintFor(value), tintTone: value < 0 ? 'dark' : 'light',
    })),
  },
];

for (const demo of DEMOS) {
  demo.start = TIMELINE[demo.scenes[0]].start;
  demo.end = TIMELINE[demo.scenes[1]].start + TIMELINE[demo.scenes[1]].hold;
}

function demoAt(time) {
  for (const demo of DEMOS) {
    // Half-open windows: two demos that share a cut never both claim it.
    if (time < demo.start || time >= demo.end) continue;
    const local = time - demo.start;
    const value = trackValue(demo.track, local);
    const window = Math.min(
      clamp01((local - 0.45) / 0.3),
      clamp01((demo.end - demo.start - 0.35 - local) / 0.3),
    );
    const alpha = easeInOut(window) * (demo.alpha ? demo.alpha(value) : 1);
    return { demo, value, alpha };
  }
  return null;
}

// ----------------------------------------------------------------- layouts --

// Each layout places the same four surfaces as centre x, centre y, width,
// height, on one balanced 2x2: the two square surfaces sit on one diagonal and
// the two wide ones on the other, so neither side of the frame carries all the
// weight. Column centres are mirrored about x = 960 and row centres about
// y = 540, which keeps the group itself centred whatever the sizes are.
//
// Size is a held state rather than a fidget: one layout runs for three scenes
// before the next takes over.
const LAYOUTS = {
  compact: {
    circle: [560, 300, 300, 300],
    pill: [1360, 300, 560, 190],
    folder: [1360, 780, 310, 310],
    rect: [560, 780, 580, 310],
  },
  wide: {
    circle: [560, 305, 400, 400],
    pill: [1360, 305, 700, 240],
    folder: [1360, 775, 370, 370],
    rect: [560, 775, 720, 370],
  },
  tall: {
    circle: [560, 300, 340, 340],
    pill: [1360, 300, 600, 290],
    folder: [1360, 780, 370, 370],
    rect: [560, 780, 640, 330],
  },
};

const CHOREOGRAPHY = [
  { scene: 0, layout: 'compact' },
  { scene: 3, layout: 'wide' },
  { scene: 6, layout: 'tall' },
];
const MORPH = 0.9;
const MIN_GAP = 36;

// The four quadrant centres, clockwise from the top left. Elements travel this
// loop when they trade places, which is why no two of them ever cross: they all
// move the same way round, keeping their spacing, and shrink while they go.
const LOOP = ['circle', 'pill', 'folder', 'rect'];
const SWAP = { scene: 1, at: 0.85, duration: 1.9, steps: 2, shrink: 0.55 };
const PHASE = { folder: 0.0, rect: 1.9, pill: 3.6, circle: 5.2 };

function layoutAt(time) {
  let current = CHOREOGRAPHY[0];
  let previous = CHOREOGRAPHY[0];
  for (const step of CHOREOGRAPHY) {
    if (TIMELINE[step.scene].start <= time + 1e-6) { previous = current; current = step; }
  }
  const at = TIMELINE[current.scene].start;
  const mix = current === previous ? 1 : easeInOut(clamp01((time - at) / MORPH));
  const from = LAYOUTS[previous.layout];
  const to = LAYOUTS[current.layout];
  const boxes = {};
  for (const id of LOOP) {
    boxes[id] = from[id].map((value, index) => value + (to[id][index] - value) * mix);
  }
  return boxes;
}

/** How far round the quadrant loop every surface has travelled, 0 to steps. */
function swapAt(time) {
  const start = TIMELINE[SWAP.scene].start + SWAP.at;
  if (time <= start) return 0;
  if (time >= start + SWAP.duration) return SWAP.steps;
  return easeInOut((time - start) / SWAP.duration) * SWAP.steps;
}

function loopPoint(centres, u) {
  const n = centres.length;
  const base = Math.floor(u);
  const fraction = u - base;
  const a = centres[((base % n) + n) % n];
  const b = centres[(((base + 1) % n) + n) % n];
  return [a[0] + (b[0] - a[0]) * fraction, a[1] + (b[1] - a[1]) * fraction];
}

// Slow, continuous drift, one held size at a time, and one trade of places.
// Nothing snaps: the material's own reaction to the moving backdrop is the
// thing being shown.
function elementsAt(time) {
  const boxes = layoutAt(time);
  const centres = LOOP.map((id) => [boxes[id][0], boxes[id][1]]);
  const travelled = swapAt(time);
  // Flat-bottomed dip: the surfaces stay small for the whole journey, not just
  // at its midpoint, which is what keeps them clear of each other.
  const scale = 1 - SWAP.shrink * (Math.sin(Math.PI * travelled / SWAP.steps) ** 0.6);
  return LOOP.map((id, index) => {
    const [, , w, h] = boxes[id];
    const [cx, cy] = loopPoint(centres, index + travelled);
    const phase = PHASE[id];
    const driftX = Math.sin(time * 0.32 + phase) * 9 + Math.sin(time * 0.13 + phase * 2) * 5;
    const driftY = Math.cos(time * 0.27 + phase) * 7 + Math.sin(time * 0.11 + phase) * 4;
    const breathe = scale * (1 + Math.sin(time * 0.38 + phase) * 0.010);
    const width = w * breathe;
    const height = h * breathe;
    return {
      id,
      shape: id,
      x: cx + driftX - width / 2,
      y: cy + driftY - height / 2,
      w: width,
      h: height,
    };
  });
}

// ------------------------------------------------------- type and captions --

const SANS = '"Inter", system-ui, -apple-system, "Segoe UI", sans-serif';
const MONO = '"JetBrains Mono", "Cascadia Mono", ui-monospace, Consolas, monospace';
const FONT_FACES = [
  `300 20px ${SANS}`, `500 18px ${SANS}`, `300 24px ${SANS}`,
  `300 20px ${MONO}`, `400 26px ${MONO}`, `300 46px ${MONO}`,
];
const CAPTION_BASELINE = 1044;
const WATERMARK_X = 76;

function drawCaption(ctx, kicker, state, alpha) {
  if (alpha <= 0.002) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.shadowColor = 'rgba(0,0,0,0.65)';
  ctx.shadowBlur = 16;
  ctx.shadowOffsetY = 1;

  const kickerFont = `500 18px ${SANS}`;
  const stateFont = `400 26px ${MONO}`;
  ctx.font = kickerFont;
  ctx.letterSpacing = '3.5px';
  const kickerWidth = ctx.measureText(kicker).width;
  ctx.letterSpacing = '0px';
  ctx.font = stateFont;
  const stateWidth = ctx.measureText(state).width;

  const gap = 22;
  let x = (W - (kickerWidth + gap * 2 + 6 + stateWidth)) / 2;
  ctx.font = kickerFont;
  ctx.letterSpacing = '3.5px';
  ctx.fillStyle = 'rgba(255,255,255,0.58)';
  ctx.fillText(kicker, x, CAPTION_BASELINE - 1);
  ctx.letterSpacing = '0px';

  x += kickerWidth + gap;
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.beginPath();
  ctx.arc(x + 3, CAPTION_BASELINE - 9, 3, 0, Math.PI * 2);
  ctx.fill();

  x += 6 + gap;
  ctx.font = stateFont;
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  ctx.fillText(state, x, CAPTION_BASELINE);
  ctx.restore();
}

/** Package and repository, top left, for the length of the film. */
function drawWatermark(ctx, alpha) {
  if (alpha <= 0.002) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.shadowColor = 'rgba(0,0,0,0.55)';
  ctx.shadowBlur = 14;
  ctx.shadowOffsetY = 1;

  ctx.font = `300 20px ${MONO}`;
  ctx.letterSpacing = '0.6px';
  ctx.fillStyle = 'rgba(255,255,255,0.82)';
  ctx.fillText(PACKAGE, WATERMARK_X, 46);

  ctx.font = `300 15px ${SANS}`;
  ctx.letterSpacing = '1.1px';
  ctx.fillStyle = 'rgba(255,255,255,0.62)';
  ctx.fillText(REPOSITORY, WATERMARK_X, 71);
  ctx.letterSpacing = '0px';
  ctx.restore();
}

/** The closing card: the same two lines, centred on black. */
function drawEndCard(ctx, alpha) {
  if (alpha <= 0.002) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';

  ctx.font = `300 46px ${MONO}`;
  ctx.letterSpacing = '1.5px';
  ctx.fillStyle = 'rgba(255,255,255,0.96)';
  ctx.fillText(PACKAGE, W / 2, 506);
  ctx.letterSpacing = '0px';

  ctx.fillStyle = 'rgba(255,255,255,0.22)';
  ctx.fillRect(W / 2 - 70, 556, 140, 1);

  ctx.font = `300 24px ${SANS}`;
  ctx.letterSpacing = '2.4px';
  ctx.fillStyle = 'rgba(255,255,255,0.62)';
  ctx.fillText(REPOSITORY, W / 2, 613);
  ctx.letterSpacing = '0px';
  ctx.restore();
}

// -------------------------------------------------------------------- boot --

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Reel asset missing: ${src}`));
    image.src = src;
  });
}

const bgCanvas = document.getElementById('bg');
const glassCanvas = document.getElementById('glass');
const fg = document.getElementById('fg').getContext('2d');

// A virtual clock, so the library's own time-based smoothing advances in step
// with the frames being captured rather than with wall-clock capture time.
const realNow = globalThis.performance.now.bind(globalThis.performance);
let virtualNow = null;
globalThis.performance.now = () => (virtualNow === null ? realNow() : virtualNow);

const photoImages = new Map();
let background = null;
let glass = null;

async function boot() {
  const [photos] = await Promise.all([
    Promise.all(Object.entries(PHOTOS).map(async ([key, src]) => [key, await loadImage(src)])),
    // Without this the first frames would be captured in a fallback face.
    Promise.all(FONT_FACES.map((face) => document.fonts.load(face))).then(() => document.fonts.ready),
  ]);
  for (const [key, image] of photos) photoImages.set(key, image);

  background = createBackground(bgCanvas, photoImages);
  glass = new LiquidGlassWebGLV2(glassCanvas, {
    compositeMode: 'overlay',
    backdrop: bgCanvas,
    backdropUpdate: 'live',
    autoStart: false,
    autoResize: false,
    respectReducedTransparency: false,
    elements: elementsAt(0),
  });
  glass.stop();
  seek(0);
}

function sceneStateAt(time) {
  let index = TIMELINE.length - 1;
  for (let i = 0; i < TIMELINE.length; i++) {
    if (time >= TIMELINE[i].start) index = i;
  }
  const scene = TIMELINE[index];
  const next = TIMELINE[index + 1] ?? null;
  const localOf = (entry, at) => (entry.photo
    ? Math.max(-0.1, Math.min(1.1, (at - entry.start) / entry.hold))
    : (at - entry.start) + (entry.t0 ?? 0));
  const from = { scene, time: localOf(scene, time) };
  if (!next) return { from, to: null, mix: 0, mode: 0 };
  const transitionStart = next.start - TRANSITION;
  if (time < transitionStart) return { from, to: null, mix: 0, mode: 0 };
  return {
    from,
    to: { scene: next, time: localOf(next, time) },
    mix: clamp01((time - transitionStart) / TRANSITION),
    mode: TRANSITIONS[scene.out] ?? TRANSITIONS.fade,
  };
}

function seek(milliseconds) {
  virtualNow = milliseconds;
  const time = milliseconds / 1000;
  // The film freezes on its last frame under the closing card.
  const sceneTime = Math.min(time, SCENES_END - 1e-4);
  const state = sceneStateAt(sceneTime);
  background.render(state.from, state.to, state.mix, state.mode);

  const active = demoAt(sceneTime);
  let elements = elementsAt(sceneTime);
  glass.setMaterial({ backdropBlur: 0 }, false);
  if (active) elements = active.demo.apply(active.value, elements, glass);
  glass.setElements(elements, false);
  glass.markBackdropDirty();
  glass.lightFieldDirty = true;
  glass.markDirty();
  glass.render({ force: true, dpr: 1 });

  fg.clearRect(0, 0, W, H);
  if (active) {
    drawCaption(fg, active.demo.kicker(active.value), active.demo.caption(active.value), active.alpha);
  }
  const veil = 1 - easeInOut(Math.min(
    clamp01(time / FADE_IN),
    clamp01((SCENES_END - time) / FADE_OUT),
  ));
  drawWatermark(fg, 1 - veil);
  if (veil > 0) {
    fg.fillStyle = `rgba(0,0,0,${veil})`;
    fg.fillRect(0, 0, W, H);
  }
  drawEndCard(fg, easeInOut(Math.min(
    clamp01((time - SCENES_END - 0.15) / 0.6),
    clamp01((DURATION - time) / 0.5),
  )));
}

/** Smallest gap between any two surfaces over the whole reel, in px. */
function minGap(fps = 60) {
  let worst = { gap: Infinity, time: 0, pair: '' };
  for (let frame = 0; frame <= Math.ceil(SCENES_END * fps); frame++) {
    const time = frame / fps;
    const elements = elementsAt(time);
    for (let i = 0; i < elements.length; i++) {
      for (let j = i + 1; j < elements.length; j++) {
        const a = elements[i];
        const b = elements[j];
        // Negative on either axis means the boxes intersect on that axis; the
        // larger of the two is the true separation of the rectangles.
        const gap = Math.max(
          Math.max(b.x - (a.x + a.w), a.x - (b.x + b.w)),
          Math.max(b.y - (a.y + a.h), a.y - (b.y + b.h)),
        );
        if (gap < worst.gap) worst = { gap, time, pair: `${a.id}/${b.id}` };
      }
    }
  }
  return worst;
}

/** Lowest clearance between the caption, the watermark and any surface, in px. */
function textClearance(fps = 60) {
  let caption = Infinity;
  let watermark = Infinity;
  for (let frame = 0; frame <= Math.ceil(SCENES_END * fps); frame++) {
    const time = frame / fps;
    const captioned = Boolean(demoAt(time));
    for (const element of elementsAt(time)) {
      watermark = Math.min(watermark, element.y - 71);
      if (captioned) caption = Math.min(caption, (CAPTION_BASELINE - 26) - (element.y + element.h));
    }
  }
  return { caption, watermark };
}

globalThis.__reel = {
  ready: boot().then(() => true),
  duration: DURATION,
  scenes: TIMELINE.map((scene) => scene.photo ?? scene.shader),
  demos: DEMOS.map((demo) => ({ start: demo.start, end: demo.end })),
  minGap,
  minGapTarget: MIN_GAP,
  textClearance,
  seek,
  // Real-time preview, for eyeballing the reel in a browser.
  play() {
    const started = realNow();
    const step = () => {
      seek((realNow() - started) % (DURATION * 1000));
      requestAnimationFrame(step);
    };
    step();
  },
};
