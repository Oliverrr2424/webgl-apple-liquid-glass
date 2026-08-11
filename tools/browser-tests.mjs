// Runs every browser test page in tests/ inside headless Chromium.
//
// Each page exposes `window.runTest()`, which throws on failure. Keeping the
// assertions inside the page means they run next to the WebGL context they are
// checking, and this runner only has to report.
import { createServer } from 'node:http';
import { readFile, readdir } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = resolve(fileURLToPath(new URL('../', import.meta.url)));
const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
};

const server = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    const filePath = resolve(root, `.${pathname}`);
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

await new Promise((resolveListen) => server.listen(0, '127.0.0.1', resolveListen));
const { port } = server.address();

// The ANGLE backend differs per platform; fall back to the system Chrome when
// the bundled chromium was never downloaded (npm install without
// `playwright install`).
const launchArgs = process.platform === 'darwin'
  ? ['--use-gl=angle', '--use-angle=metal', '--enable-unsafe-swiftshader']
  : ['--use-angle=default', '--enable-unsafe-swiftshader'];

const pages = (await readdir(resolve(root, 'tests')))
  .filter((name) => name.endsWith('.html'))
  .sort();

let browser;
let failures = 0;
try {
  browser = await chromium.launch({ args: launchArgs })
    .catch(() => chromium.launch({ args: launchArgs, channel: 'chrome' }));

  for (const name of pages) {
    const page = await browser.newPage({
      viewport: { width: 400, height: 280 },
      deviceScaleFactor: 2,
    });
    const pageErrors = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));
    try {
      await page.goto(`http://127.0.0.1:${port}/tests/${name}`, { waitUntil: 'load' });
      await page.waitForFunction('typeof window.runTest === "function"');
      const result = await page.evaluate(() => window.runTest());
      if (pageErrors.length) throw new Error(`browser errors: ${pageErrors.join('; ')}`);
      const checks = result?.checks ?? [];
      console.log(`  ok ${name}${checks.length ? ` (${checks.join(', ')})` : ''}`);
    } catch (error) {
      failures++;
      console.error(`  fail ${name}: ${error.message}`);
    } finally {
      await page.close();
    }
  }
} finally {
  await browser?.close();
  server.close();
}

if (failures) {
  console.error(`${failures} browser test page(s) failed`);
  process.exit(1);
}
console.log(`browser tests: ${pages.length} page(s) ok`);
