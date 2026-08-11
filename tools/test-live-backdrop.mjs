import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = resolve(fileURLToPath(new URL('../', import.meta.url)));
const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
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
const address = server.address();
const launchArgs = process.platform === 'darwin'
  ? ['--use-gl=angle', '--use-angle=metal', '--enable-unsafe-swiftshader']
  : ['--use-angle=default', '--enable-unsafe-swiftshader'];

let browser;
try {
  browser = await chromium.launch({ args: launchArgs })
    .catch(() => chromium.launch({ args: launchArgs, channel: 'chrome' }));
  const page = await browser.newPage({ viewport: { width: 400, height: 280 }, deviceScaleFactor: 2 });
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.goto(`http://127.0.0.1:${address.port}/tests/live-backdrop.html`, { waitUntil: 'load' });
  await page.waitForFunction('typeof window.runLiveBackdropTest === "function"');
  const result = await page.evaluate(() => window.runLiveBackdropTest());

  if (pageErrors.length) throw new Error(`Browser errors: ${pageErrors.join('; ')}`);
  if (result.transparentOutside[3] !== 0) {
    throw new Error(`Overlay framebuffer is not transparent outside the glass: ${result.transparentOutside}`);
  }
  if (result.liveDistance < 80) {
    throw new Error(`Live canvas changes did not reach the glass texture: ${JSON.stringify(result)}`);
  }
  if (result.staticDistance > 8) {
    throw new Error(`Static backdrop changed without an explicit refresh: ${JSON.stringify(result)}`);
  }
  if (result.manualDistance < 80) {
    throw new Error(`Manual backdrop refresh did not update the texture: ${JSON.stringify(result)}`);
  }

  console.log('live backdrop browser checks: ok');
  console.log(JSON.stringify(result));
} finally {
  await browser?.close();
  await new Promise((resolveClose) => server.close(resolveClose));
}
