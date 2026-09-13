// Frame-by-frame recorder for the reel stage.
//
//   node tools/reel/record.mjs --out F:/tmp/reel.mp4            full 60 fps take
//   node tools/reel/record.mjs --stills 0,2500,9000 --dir shots  a few frames only
//
// The page is stepped by a virtual clock (`__reel.seek`), so capture speed has
// no effect on the result: every run produces the same frames.

import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const args = process.argv.slice(2);
const flag = (name, fallback = null) => {
  const index = args.indexOf(`--${name}`);
  return index === -1 ? fallback : (args[index + 1] ?? true);
};

const url = String(flag('url', 'http://localhost:8765/tools/reel/index.html'));
const fps = Number(flag('fps', 60));
const quality = Number(flag('quality', 96));
const stills = flag('stills');
const dir = String(flag('dir', 'F:/tmp/claude/reel'));
const out = flag('out');
const from = Number(flag('from', 0));
const to = flag('to');
const headed = !args.includes('--headless');

const launchArgs = [
  '--use-angle=default',
  '--enable-unsafe-swiftshader',
  '--hide-scrollbars',
  '--force-device-scale-factor=1',
  '--window-position=0,0',
];

const browser = await chromium.launch({ headless: !headed, args: launchArgs })
  .catch(() => chromium.launch({ headless: !headed, args: launchArgs, channel: 'chrome' }));
const page = await browser.newPage({
  viewport: { width: 1920, height: 1080 },
  deviceScaleFactor: 1,
});
page.on('pageerror', (error) => console.error('PAGEERROR:', error.message));
page.on('console', (message) => {
  if (message.type() === 'error') console.error('PAGE:', message.text());
});

await page.goto(url, { waitUntil: 'load' });
await page.waitForFunction('window.__reel !== undefined');
const duration = await page.evaluate(async () => {
  await window.__reel.ready;
  return window.__reel.duration;
});
const renderer = await page.evaluate(() => {
  const gl = document.createElement('canvas').getContext('webgl2');
  const ext = gl?.getExtension('WEBGL_debug_renderer_info');
  return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : 'unknown';
});
console.log(`reel: ${duration.toFixed(2)}s via ${renderer}`);

const shot = async (ms) => {
  await page.evaluate((t) => window.__reel.seek(t), ms);
  return page.locator('#stage').screenshot({ type: 'jpeg', quality });
};

if (stills) {
  mkdirSync(dir, { recursive: true });
  for (const value of String(stills).split(',')) {
    const ms = Number(value);
    const buffer = await shot(ms);
    const file = path.join(dir, `still-${String(Math.round(ms)).padStart(6, '0')}.jpg`);
    writeFileSync(file, buffer);
    console.log('wrote', file);
  }
  await browser.close();
  process.exit(0);
}

const end = to === null ? duration : Number(to);
const total = Math.round((end - from) * fps);
const target = String(out ?? path.join(dir, 'reel.mp4'));
mkdirSync(path.dirname(target), { recursive: true });

const ffmpeg = spawn('ffmpeg', [
  '-y',
  '-f', 'image2pipe',
  '-framerate', String(fps),
  '-i', '-',
  '-vf', 'format=yuv420p',
  '-c:v', 'libx264',
  '-preset', 'slow',
  '-crf', '16',
  '-movflags', '+faststart',
  '-r', String(fps),
  target,
], { stdio: ['pipe', 'inherit', 'inherit'] });

const write = (buffer) => new Promise((resolve, reject) => {
  if (ffmpeg.stdin.write(buffer)) resolve();
  else ffmpeg.stdin.once('drain', resolve);
  ffmpeg.stdin.once('error', reject);
});

const started = Date.now();
for (let frame = 0; frame < total; frame++) {
  const ms = (from + frame / fps) * 1000;
  await write(await shot(ms));
  if (frame % 60 === 0 || frame === total - 1) {
    const done = frame + 1;
    const rate = done / ((Date.now() - started) / 1000);
    const left = (total - done) / rate;
    console.log(`frame ${done}/${total} · ${rate.toFixed(1)} fps · ~${Math.round(left)}s left`);
  }
}
ffmpeg.stdin.end();
await new Promise((resolve) => ffmpeg.on('close', resolve));
await browser.close();
console.log('wrote', target);
