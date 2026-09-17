import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Answer engines and search crawlers read these files, and a version or URL that
// has drifted from package.json is worse than no metadata at all. The suite is
// cheap enough to keep the whole set honest on every push.
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(join(ROOT, path), 'utf8');

const SITE = 'https://oliverrr2424.github.io/webgl-apple-liquid-glass';
const PAGES = ['index.html', 'docs/index.html', 'docs/zh/index.html'];
const { version, name, description, keywords } = JSON.parse(read('package.json'));

const jsonLdBlocks = (html) => [
  ...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g),
].map(([, body]) => JSON.parse(body));

test('every page carries structured data that parses', () => {
  for (const page of PAGES) {
    const blocks = jsonLdBlocks(read(page));
    assert.ok(blocks.length > 0, `${page} has no JSON-LD`);
    for (const block of blocks) {
      assert.equal(block['@context'], 'https://schema.org', `${page} JSON-LD context`);
      const nodes = block['@graph'] ?? [block];
      for (const node of nodes) assert.ok(node['@type'], `${page} JSON-LD node without a type`);
    }
  }
});

test('the documented version matches package.json', () => {
  for (const page of [...PAGES, 'llms.txt']) {
    assert.ok(
      read(page).includes(version),
      `${page} does not mention the current version ${version}`,
    );
  }
});

test('the docs pages describe the package the same way package.json does', () => {
  for (const page of PAGES) {
    const html = read(page);
    assert.ok(html.includes(name), `${page} never names the package`);
    assert.match(html, /<meta name="description" content="[^"]{80,}">/, `${page} meta description`);
  }
  // The npm blurb is the first thing an assistant sees; keep it a full sentence
  // that names what the package does, within npm's comfortable display length.
  assert.ok(description.length > 80 && description.length < 220, 'npm description length');
  assert.ok(keywords.includes('liquid-glass') && keywords.includes('glassmorphism'));
});

test('canonical links point at the page they are on', () => {
  const canonical = (page) => read(page).match(/<link rel="canonical" href="([^"]+)"/)?.[1];
  assert.equal(canonical('index.html'), `${SITE}/`);
  assert.equal(canonical('docs/index.html'), `${SITE}/docs/`);
  assert.equal(canonical('docs/zh/index.html'), `${SITE}/docs/zh/`);
});

test('the sitemap lists exactly the pages that exist, and robots.txt points at it', () => {
  const sitemap = read('sitemap.xml');
  const listed = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(([, url]) => url);
  const expected = [`${SITE}/`, `${SITE}/docs/`, `${SITE}/docs/zh/`];
  assert.deepEqual(listed.sort(), expected.sort());

  const robots = read('robots.txt');
  assert.ok(robots.includes(`Sitemap: ${SITE}/sitemap.xml`), 'robots.txt sitemap line');
  for (const crawler of ['GPTBot', 'ClaudeBot', 'PerplexityBot', 'Googlebot', 'Google-Extended']) {
    assert.match(robots, new RegExp(`User-agent: ${crawler}\\nAllow: /`), `${crawler} allowed`);
  }
});

test('the deploy stages everything the crawlers are pointed at', () => {
  const workflow = read('.github/workflows/pages.yml');
  for (const staged of ['cp -r docs site/', 'robots.txt sitemap.xml llms.txt site/']) {
    assert.ok(workflow.includes(staged), `pages.yml does not stage: ${staged}`);
  }
  // llms-full.txt is generated from the README at deploy time, so the two cannot
  // drift apart; llms.txt links to it.
  assert.ok(workflow.includes('> site/llms-full.txt'), 'pages.yml builds llms-full.txt');
  assert.ok(read('llms.txt').includes(`${SITE}/llms-full.txt`), 'llms.txt links llms-full.txt');
});
