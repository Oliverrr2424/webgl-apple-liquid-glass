// Screenshot helper: node tools/shot.mjs <out.png> [--scene N] [--version v1|v2]
//                    [--focus i,zoom] [--set key=val,key=val] [--size WxH] [--no-panel]
import { chromium } from 'playwright';
import { assertSafePath, writeSafeFile } from './safepath.mjs';

const args = process.argv.slice(2);
const out = args[0] || 'shots/out.png';
assertSafePath(out);
const flag = (name, def = null) => {
  const i = args.indexOf('--' + name);
  return i === -1 ? def : (args[i + 1] ?? true);
};

const [W, H] = String(flag('size', '1000x640')).split('x').map(Number);
const scene = Number(flag('scene', 0));
const version = String(flag('version', 'v1')) === 'v2' ? 'v2' : 'v1';
const focus = flag('focus');
const set = flag('set');
const noPanel = args.includes('--no-panel');
const clean = args.includes('--clean');

// ANGLE backend differs per platform; fall back to the system Chrome when the
// bundled chromium was never downloaded (npm install without `playwright install`).
const launchArgs = process.platform === 'darwin'
  ? ['--use-gl=angle', '--use-angle=metal', '--enable-unsafe-swiftshader']
  : ['--use-angle=default', '--enable-unsafe-swiftshader'];
const browser = await chromium.launch({ args: launchArgs })
  .catch(() => chromium.launch({ args: launchArgs, channel: 'chrome' }));
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 2 });
page.on('console', (m) => { if (m.type() === 'error') console.error('PAGE:', m.text()); });
page.on('pageerror', (e) => console.error('PAGEERROR:', e.message));
await page.goto('http://localhost:8765/index.html', { waitUntil: 'load' });
await page.waitForFunction('window.__lg !== undefined');

if (noPanel) { await page.click('#togglePanel'); await page.waitForTimeout(100); }
if (clean) await page.addStyleTag({ content: '#stageHud, #loadState, #showPanel { display: none !important; }' });
await page.evaluate((v) => window.__lg.setVersion(v), version);
await page.evaluate((s) => window.__lg.setScene(s), scene);
// Wallpapers are loaded on demand now, so wait for the scene to be ready.
await page.waitForFunction('window.__lg.ready()');
if (set) {
  const patch = {};
  for (const kv of String(set).split(',')) {
    const [k, v] = kv.split('=');
    patch[k] = parseFloat(v);
  }
  await page.evaluate((p) => window.__lg.set(p), patch);
}
if (focus) {
  const [i, z] = String(focus).split(',').map(Number);
  await page.evaluate(([i, z]) => window.__lg.focus(i, z || 2), [i, z]);
}
await page.waitForTimeout(180);
const jpeg = /\.jpe?g$/i.test(out);
const image = await page.locator('#stage').screenshot(jpeg
  ? { type: 'jpeg', quality: 90 }
  : { type: 'png' });
writeSafeFile(out, image);
await browser.close();
console.log('wrote', out);
