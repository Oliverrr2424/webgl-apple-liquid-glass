// Builds the README GIFs: the Home screen, Control Centre, the press-effects
// lab and a slice of the reel — one file each, so none of them has to give up
// resolution to fit beside the others.
//
//   node tools/reel/readme-gif.mjs
//   node tools/reel/readme-gif.mjs --only press --max-bytes 4000000
//
// The playground clips are captured live, because what is being shown is the
// interaction: the page is driven with real pointer events while frames are
// grabbed as fast as the browser will give them, each stamped with the moment it
// was taken. ffmpeg resamples those uneven stamps onto a constant rate, so the
// motion stays true even though the capture rate wobbles.
//
// Every GIF is then encoded down a ladder until it fits: GitHub and npm both
// proxy README images and drop the ones that are too large, so a beautiful GIF
// nobody can see is a failed GIF.

import { spawnSync } from 'node:child_process';
import { mkdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const args = process.argv.slice(2);
const flag = (name, fallback = null) => {
  const index = args.indexOf(`--${name}`);
  return index === -1 ? fallback : (args[index + 1] ?? true);
};

const reel = String(flag('reel', 'shots/tmp-reel/liquid-glass-reel-v5-1080p60.mp4'));
const reelFrom = Number(flag('reel-from', 14.5));
const reelLength = Number(flag('reel-length', 4.6));
const outDir = String(flag('out-dir', 'assets/readme'));
const work = String(flag('work', 'shots/tmp-gif'));
const fps = Number(flag('fps', 12));
// GitHub's image proxy refuses anything over CAMO_LENGTH_LIMIT, 5242880
// bytes. Stay under it with room to spare rather than on the line.
const maxBytes = Number(flag('max-bytes', 5_000_000));
const only = flag('only');
const origin = String(flag('origin', 'http://localhost:8765'));

const wanted = (name) => !only || String(only).split(',').includes(name);

const ffmpeg = (...argv) => {
  const result = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...argv],
    { stdio: 'inherit' });
  if (result.status !== 0) throw new Error(`ffmpeg failed: ${argv.join(' ')}`);
};

mkdirSync(work, { recursive: true });
mkdirSync(outDir, { recursive: true });

/** Encodes one video to a GIF, shrinking only as far as the budget demands. */
function toGif(video, name, width) {
  const out = path.join(outDir, `${name}.gif`);
  const palette = path.join(work, `${name}-palette.png`);
  const ladder = [
    { width, colors: 224 },
    { width: Math.round(width * 0.9 / 2) * 2, colors: 200 },
    { width: Math.round(width * 0.8 / 2) * 2, colors: 176 },
    { width: Math.round(width * 0.7 / 2) * 2, colors: 144 },
    { width: Math.round(width * 0.6 / 2) * 2, colors: 128 },
  ];
  let chosen = null;
  for (const step of ladder) {
    const scale = `scale=${step.width}:-2:flags=lanczos`;
    ffmpeg('-i', video, '-vf', `${scale},palettegen=max_colors=${step.colors}:stats_mode=diff`, palette);
    // Bayer holds the gradients without the frame-to-frame crawl error
    // diffusion gives a GIF, and costs a fraction of the bytes.
    ffmpeg('-i', video, '-i', palette, '-lavfi',
      `${scale}[s];[s][1:v]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle:new=0`,
      '-loop', '0', out);
    chosen = { ...step, bytes: statSync(out).size };
    if (chosen.bytes <= maxBytes) break;
    console.log(`  ${step.width}px / ${step.colors} colours -> ${(chosen.bytes / 1048576).toFixed(2)} MiB, too big`);
  }
  console.log(`${name}.gif: ${chosen.width}px, ${chosen.colors} colours, ${(chosen.bytes / 1048576).toFixed(2)} MiB`);
  return out;
}

// ------------------------------------------------------------------- reel --

if (wanted('reel')) {
  const video = path.join(work, 'reel-slice.mp4');
  ffmpeg('-ss', String(reelFrom), '-t', String(reelLength), '-i', reel,
    '-vf', `fps=${fps},scale=960:-2:flags=lanczos,format=yuv420p`,
    '-c:v', 'libx264', '-crf', '12', video);
  toGif(video, 'v2-reel', 860);
}

if (!wanted('home') && !wanted('control-centre') && !wanted('press')) process.exit(0);

// -------------------------------------------------------------- playground --

const browser = await chromium.launch({
  headless: false,
  args: ['--use-angle=default', '--enable-unsafe-swiftshader', '--hide-scrollbars',
    '--force-device-scale-factor=1'],
}).catch(() => chromium.launch({ headless: false, channel: 'chrome' }));

/**
 * Grabs frames for `duration` ms while `gestures` drives the page. Both run on
 * the same connection at once: the capture never blocks the interaction.
 */
async function record(page, duration, gestures, clip) {
  const frames = [];
  const started = Date.now();
  const capture = (async () => {
    while (Date.now() - started < duration) {
      const at = Date.now() - started;
      frames.push({ at, buffer: await page.screenshot({ type: 'jpeg', quality: 95, clip }) });
    }
  })();
  await Promise.all([capture, gestures()]);
  return frames;
}

/** Writes a clip's frames plus the concat list that carries their real timing. */
function writeClip(name, frames, width) {
  const dir = path.join(work, name);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const lines = [];
  frames.forEach((frame, index) => {
    const file = `f${String(index).padStart(4, '0')}.jpg`;
    writeFileSync(path.join(dir, file), frame.buffer);
    const next = frames[index + 1];
    const seconds = ((next ? next.at : frame.at + 60) - frame.at) / 1000;
    lines.push(`file '${file}'`, `duration ${Math.max(0.008, seconds).toFixed(4)}`);
  });
  lines.push(`file 'f${String(frames.length - 1).padStart(4, '0')}.jpg'`);
  writeFileSync(path.join(dir, 'list.txt'), `${lines.join('\n')}\n`);
  const video = path.join(work, `${name}.mp4`);
  ffmpeg('-f', 'concat', '-safe', '0', '-i', path.join(dir, 'list.txt'),
    '-vf', `fps=${fps},scale=${width}:-2:flags=lanczos,format=yuv420p`,
    '-c:v', 'libx264', '-crf', '12', video);
  console.log(`${name}: ${frames.length} frames over ${(frames.at(-1).at / 1000).toFixed(1)}s`);
  return video;
}

async function openPlayground(size) {
  const page = await browser.newPage({ viewport: size, deviceScaleFactor: 2 });
  page.on('pageerror', (error) => console.error('PAGEERROR:', error.message));
  await page.goto(`${origin}/index.html`, { waitUntil: 'load' });
  await page.waitForFunction('window.__lg !== undefined');
  // English copy, no panel, no coach marks: the film should be all stage.
  await page.evaluate(() => {
    const english = [...document.querySelectorAll('#langToggle button')]
      .find((button) => /en/i.test(button.dataset.lang ?? button.textContent ?? ''));
    english?.click();
  });
  const panel = await page.$('#togglePanel');
  if (panel) await panel.click();
  await page.addStyleTag({
    content: '#stageHud, #loadState, #showPanel, #phoneGestureTips, #panel { display: none !important; }',
  });
  return page;
}

/** Stage-space geometry: the phone frame and every component, in page pixels. */
async function stageGeometry(page) {
  return page.evaluate(async () => {
    const { phoneFrame } = await import('./playground/phone.js?gif=1');
    const rect = document.querySelector('#stage').getBoundingClientRect();
    const { width, height } = window.__lg.store.stageSize();
    return {
      origin: { x: rect.left, y: rect.top },
      frame: phoneFrame(width, height),
      elements: window.__lg.store.elements.map(({ id, x, y, w, h }) => ({ id, x, y, w, h })),
    };
  });
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** A pointer drag with enough intermediate moves to look like a finger. */
async function swipe(page, from, to, ms, { hold = 0 } = {}) {
  const steps = Math.max(8, Math.round(ms / 16));
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const eased = t < 0.5 ? 2 * t * t : 1 - ((-2 * t + 2) ** 2) / 2;
    await page.mouse.move(from.x + (to.x - from.x) * eased, from.y + (to.y - from.y) * eased);
    await wait(ms / steps);
  }
  if (hold) await wait(hold);
  await page.mouse.up();
}

// ------------------------------------------------------------------- home --

if (wanted('home') || wanted('control-centre')) {
  const page = await openPlayground({ width: 820, height: 900 });
  await page.evaluate(() => window.__lg.setScene('home'));
  await page.waitForFunction('window.__lg.ready()');
  await wait(700);

  const home = await stageGeometry(page);
  const screen = home.frame.screen;
  const point = (x, y) => ({ x: home.origin.x + x, y: home.origin.y + y });
  const midY = screen.y + screen.h * 0.45;

  if (wanted('home')) {
    // The whole phone: two pages swiped under the glass.
    const clip = {
      x: Math.max(0, home.origin.x + screen.x - 34),
      y: Math.max(0, home.origin.y + screen.y - 34),
      width: screen.w + 68,
      height: screen.h + 68,
    };
    const frames = await record(page, 4000, async () => {
      await wait(320);
      await swipe(page, point(screen.x + screen.w * 0.78, midY),
        point(screen.x + screen.w * 0.18, midY), 420);
      await wait(900);
      await swipe(page, point(screen.x + screen.w * 0.22, midY),
        point(screen.x + screen.w * 0.82, midY), 420);
      await wait(600);
    }, clip);
    toGif(writeClip('home', frames, 460), 'v2-home', 460);
  }

  if (wanted('control-centre')) {
    // Close in on the top of the screen, where the sheet slides over the
    // widgets: at this crop the refraction is actually legible in a README.
    const clip = {
      x: Math.max(0, home.origin.x + screen.x - 8),
      y: Math.max(0, home.origin.y + screen.y - 8),
      width: screen.w + 16,
      height: Math.round(((screen.w + 16) * 10) / 16),
    };
    const frames = await record(page, 4200, async () => {
      await wait(300);
      // Pull Control Centre down from the right of the status bar, then push it up.
      await swipe(page, point(screen.x + screen.w * 0.78, screen.y + 14),
        point(screen.x + screen.w * 0.72, screen.y + screen.h * 0.66), 620, { hold: 1100 });
      await wait(600);
      await swipe(page, point(screen.x + screen.w * 0.5, screen.y + screen.h * 0.5),
        point(screen.x + screen.w * 0.5, screen.y + 18), 480);
      await wait(400);
    }, clip);
    toGif(writeClip('control-centre', frames, 820), 'v2-control-centre', 820);
  }
  await page.close();
}

// ------------------------------------------------------------------ press --

if (wanted('press')) {
  const page = await openPlayground({ width: 1180, height: 700 });
  await page.evaluate(() => window.__lg.setScene('press'));
  await page.waitForFunction('window.__lg.ready()');
  await wait(700);

  const press = await stageGeometry(page);
  const at = (id) => {
    const element = press.elements.find((entry) => entry.id === id);
    if (!element) throw new Error(`press scene is missing ${id}`);
    return {
      ...element,
      centre: {
        x: press.origin.x + element.x + element.w / 2,
        y: press.origin.y + element.y + element.h / 2,
      },
    };
  };

  const track = at('selection-track');
  const thumb = at('selection-thumb');
  const button = at('hold-button');
  const toggleTrack = at('green-toggle-track');
  const toggle = at('green-toggle-thumb');
  const orb = at('hold-orb');
  const trackEnd = { x: press.origin.x + track.x + track.w - thumb.w / 2 - 10, y: thumb.centre.y };
  // A slider thumb follows the pointer and snaps to whichever end it is
  // nearest on release, so flipping the switch means dragging it across --
  // pressing it where it already sits just presses it.
  const toggleY = press.origin.y + toggleTrack.y + toggleTrack.h / 2;
  const toggleOff = { x: press.origin.x + toggleTrack.x + toggle.w / 2 + 4, y: toggleY };
  const toggleOn = { x: press.origin.x + toggleTrack.x + toggleTrack.w - toggle.w / 2 - 4, y: toggleY };
  // Crop to the column the controls actually occupy, so the GIF is not mostly
  // wallpaper.
  const left = Math.min(track.x, button.x, toggle.x, orb.x) - 90;
  const right = Math.max(track.x + track.w, button.x + button.w, orb.x + orb.w) + 90;
  const clip = {
    x: Math.max(0, press.origin.x + left),
    y: Math.max(0, press.origin.y + track.y - 60),
    width: right - left,
    height: (orb.y + orb.h + 60) - (track.y - 60),
  };

  const frames = await record(page, 6900, async () => {
    await wait(260);
    // Drag the selected capsule across its track and let it settle back.
    await swipe(page, thumb.centre, trackEnd, 500, { hold: 300 });
    await wait(340);
    await swipe(page, trackEnd, thumb.centre, 440);
    await wait(320);
    // Press and hold the button, flip the toggle, press and hold the orb.
    await page.mouse.move(button.centre.x, button.centre.y);
    await page.mouse.down();
    await wait(780);
    await page.mouse.up();
    await wait(340);
    await swipe(page, toggleOff, toggleOn, 380, { hold: 240 });
    await wait(620);
    await swipe(page, toggleOn, toggleOff, 380, { hold: 220 });
    await wait(560);
    await page.mouse.move(orb.centre.x, orb.centre.y);
    await page.mouse.down();
    await wait(700);
    await page.mouse.up();
    await wait(360);
  }, clip);
  toGif(writeClip('press', frames, 820), 'v2-press', 820);
  await page.close();
}

await browser.close();
