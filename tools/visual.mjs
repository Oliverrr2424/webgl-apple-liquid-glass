// Golden image checks for the playground.
//
//   node tools/visual.mjs            compare against the committed baseline
//   node tools/visual.mjs --update   record a new baseline for this renderer
//   node tools/visual.mjs --list     print the cases and the baseline directory
//
// The material is the product, so a shader edit that quietly changes the picture
// is the regression that matters most - and the one that eyeballing misses.
//
// Visual CI deliberately uses SwiftShader. A software renderer is slower, but
// it gives macOS development and Linux Actions the same repeatable target. A
// missing baseline is an error: silently accepting one would turn this gate
// into a no-op on every machine except the one that recorded the images.
import { createServer } from 'node:http';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = resolve(fileURLToPath(new URL('../', import.meta.url)));
const baselineRoot = join(root, 'shots', 'baseline');
const args = process.argv.slice(2);
const update = args.includes('--update');
const list = args.includes('--list');

// Fraction of pixels allowed to differ by more than CHANNEL_TOLERANCE. The same
// renderer reproduces a frame exactly, so this budget only absorbs a driver
// update under the same reported renderer string. It is deliberately tight: at
// 0.002 and 6, changing the default rim blur by four pixels went unnoticed in
// seven of the nine cases.
const CHANNEL_TOLERANCE = 3;
const PIXEL_ALLOWANCE = 0.0004;

// The stage is captured at 2000x1280 and stored at a quarter of that. An exact
// integer ratio keeps the downscale free of resampling noise, and 500x320 is
// still far more than enough to catch a shifted highlight or a broken bevel
// while keeping the committed baselines around 150 kB each instead of 3 MB.
const BASELINE_WIDTH = 500;
const BASELINE_HEIGHT = 320;

const CASES = [
  { name: 'shape-set-lake', scene: 'alpine-lake' },
  { name: 'shape-set-lines', scene: 'flow-lines' },
  { name: 'fusion-colour-blocks', scene: 'color-blocks', set: { mergeRadius: 90 } },
  { name: 'adaptive-tint-night', scene: 'night-city' },
  { name: 'clear-preset-night', scene: 'night-city', preset: 'clear' },
  { name: 'tab-bar', scene: 'tab-bar' },
  { name: 'control-centre', scene: 'control-centre' },
  { name: 'notification', scene: 'notification' },
  { name: 'debug-normals', scene: 'flow-lines', set: { debug: 2 } },
  { name: 'focus-folder', scene: 'alpine-lake', focus: [0, 2] },
];

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

const slug = (value) => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 48);

async function startServer() {
  const server = createServer(async (request, response) => {
    try {
      const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
      const filePath = resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`);
      if (filePath !== root && !filePath.startsWith(root + sep)) {
        response.writeHead(403).end('Forbidden');
        return;
      }
      const body = await readFile(filePath);
      response.writeHead(200, { 'content-type': mimeTypes[extname(filePath)] || 'application/octet-stream' });
      response.end(body);
    } catch {
      response.writeHead(404).end('Not found');
    }
  });
  await new Promise((ready) => server.listen(0, '127.0.0.1', ready));
  return server;
}

const toBase64 = (buffer) => buffer.toString('base64');

/** Decodes a screenshot, downscales it, and re-encodes it as PNG. */
async function normalise(page, buffer) {
  const base64 = await page.evaluate(async ([data, width, height]) => {
    const bytes = Uint8Array.from(atob(data), (character) => character.charCodeAt(0));
    const bitmap = await createImageBitmap(new Blob([bytes], { type: 'image/png' }));
    const canvas = new OffscreenCanvas(width, height);
    const context = canvas.getContext('2d');
    context.imageSmoothingQuality = 'high';
    context.drawImage(bitmap, 0, 0, width, height);
    const blob = await canvas.convertToBlob({ type: 'image/png' });
    const out = new Uint8Array(await blob.arrayBuffer());
    let binary = '';
    for (const byte of out) binary += String.fromCharCode(byte);
    return btoa(binary);
  }, [toBase64(buffer), BASELINE_WIDTH, BASELINE_HEIGHT]);
  return Buffer.from(base64, 'base64');
}

// Decoding and diffing happen in the browser: it already has a PNG decoder, and
// that keeps this tool dependency free.
async function compare(page, actual, expected, tolerance = CHANNEL_TOLERANCE) {
  return page.evaluate(async ([a, b, tolerance]) => {
    const load = async (base64) => {
      const bytes = Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
      return createImageBitmap(new Blob([bytes], { type: 'image/png' }));
    };
    const [imageA, imageB] = await Promise.all([load(a), load(b)]);
    if (imageA.width !== imageB.width || imageA.height !== imageB.height) {
      return { size: `${imageA.width}x${imageA.height} vs ${imageB.width}x${imageB.height}` };
    }
    const read = (bitmap) => {
      const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
      const context = canvas.getContext('2d', { willReadFrequently: true });
      context.drawImage(bitmap, 0, 0);
      return context.getImageData(0, 0, bitmap.width, bitmap.height).data;
    };
    const dataA = read(imageA);
    const dataB = read(imageB);
    let differing = 0;
    let worst = 0;
    for (let i = 0; i < dataA.length; i += 4) {
      const delta = Math.max(
        Math.abs(dataA[i] - dataB[i]),
        Math.abs(dataA[i + 1] - dataB[i + 1]),
        Math.abs(dataA[i + 2] - dataB[i + 2]),
      );
      if (delta > worst) worst = delta;
      if (delta > tolerance) differing++;
    }
    return { fraction: differing / (dataA.length / 4), worst };
  }, [actual.toString('base64'), expected.toString('base64'), tolerance]);
}

if (list) {
  console.log(`baselines: ${baselineRoot}`);
  if (existsSync(baselineRoot)) {
    for (const entry of await readdir(baselineRoot)) console.log(`  renderer: ${entry}`);
  }
  for (const testCase of CASES) console.log(`  case: ${testCase.name} (${testCase.scene})`);
  process.exit(0);
}

const server = await startServer();
const { port } = server.address();
const launchArgs = [
  '--use-gl=angle',
  '--use-angle=swiftshader',
  '--enable-unsafe-swiftshader',
];

let browser;
let failures = 0;
let missing = 0;
try {
  browser = await chromium.launch({ args: launchArgs })
    .catch(() => chromium.launch({ args: launchArgs, channel: 'chrome' }));
  const page = await browser.newPage({ viewport: { width: 1000, height: 640 }, deviceScaleFactor: 2 });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });

  await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'load' });
  await page.waitForFunction('window.__lg !== undefined');

  const renderer = await page.evaluate(() => {
    const gl = document.createElement('canvas').getContext('webgl2');
    const info = gl.getExtension('WEBGL_debug_renderer_info');
    return info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
  });
  const fingerprint = slug(renderer);
  const baselineDirectory = join(baselineRoot, fingerprint);
  console.log(`renderer: ${renderer}`);
  console.log(`baseline: shots/baseline/${fingerprint}`);
  if (update) await mkdir(baselineDirectory, { recursive: true });

  await page.click('#togglePanel');
  await page.addStyleTag({ content: '#stageHud, #loadState, #ui { visibility: hidden !important; }' });

  for (const testCase of CASES) {
    await page.evaluate(async (spec) => {
      const lg = window.__lg;
      lg.setScene(spec.scene);
      if (spec.preset) document.querySelector(`[data-preset="${spec.preset}"]`).click();
      else document.querySelector('#resetMaterial').click();
      if (spec.set) lg.set(spec.set);
      if (spec.focus) lg.focus(...spec.focus);
      // Wait for the wallpaper to decode and one frame to land.
      const deadline = performance.now() + 5000;
      while (!lg.ready() && performance.now() < deadline) {
        await new Promise((resolve) => requestAnimationFrame(resolve));
      }
      lg.render();
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    }, testCase);
    await page.waitForTimeout(120);

    const actual = await normalise(page, await page.locator('#stage').screenshot());
    const file = join(baselineDirectory, `${testCase.name}.png`);
    if (update) {
      await writeFile(file, actual);
      console.log(`  recorded ${testCase.name}`);
      continue;
    }
    if (!existsSync(file)) {
      missing++;
      console.error(`  missing  ${testCase.name} (run with --update on this renderer)`);
      continue;
    }
    const result = await compare(page, actual, await readFile(file));
    if (result.size) {
      failures++;
      console.error(`  fail     ${testCase.name}: size changed, ${result.size}`);
    } else if (result.fraction > PIXEL_ALLOWANCE) {
      failures++;
      const percent = (result.fraction * 100).toFixed(3);
      console.error(`  fail     ${testCase.name}: ${percent}% of pixels differ (worst channel ${result.worst})`);
      await writeFile(join(root, 'shots', `tmp-${testCase.name}.png`), actual);
    } else {
      console.log(`  ok       ${testCase.name}`);
    }
  }

  if (errors.length) {
    failures++;
    console.error(`  page errors: ${errors.join('; ')}`);
  }
} finally {
  await browser?.close();
  server.close();
}

if (failures) {
  console.error(`visual regression: ${failures} case(s) failed. Rejected frames are in shots/tmp-*.png`);
  process.exit(1);
}
if (missing) {
  console.error(`visual regression: ${missing} case(s) have no baseline for this renderer.`);
  process.exit(1);
}
console.log(`visual regression: ${CASES.length} case(s) ok`);
