import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DEFAULT_MATERIAL, getDefaultMaterial } from '../src/material.js';
import { decodeState, encodeState, toCode } from '../playground/permalink.js';

const session = (overrides = {}) => ({
  sceneId: 'tab-bar',
  material: getDefaultMaterial(),
  fusion: true,
  showIcons: false,
  showLabels: false,
  movedElements: false,
  elements: [{ id: 'toolbar', shape: 'pill', x: 100, y: 28, w: 560, h: 66 }],
  ...overrides,
});

test('a share link only carries what differs from the defaults', () => {
  const encoded = encodeState(session());
  assert.match(encoded, /scene=tab-bar/);
  assert.doesNotMatch(encoded, /(^|&)m=/, 'an untouched material should not be serialised');
  assert.doesNotMatch(encoded, /(^|&)e=/, 'an untouched layout should not be serialised');

  const state = session();
  state.material.blurRim = 32;
  assert.match(encodeState(state), /m=blurRim%3A32/);
});

test('a share link round trips the material and the layout', () => {
  const state = session({ movedElements: true, showLabels: true });
  state.material.blurRim = 32;
  state.material.ior = 1.75;
  state.material.debug = 2;

  const decoded = decodeState(`#${encodeState(state)}`);
  assert.equal(decoded.sceneId, 'tab-bar');
  assert.equal(decoded.fusion, true);
  assert.equal(decoded.showLabels, true);
  assert.equal(decoded.showIcons, false);
  assert.deepEqual(decoded.material, { blurRim: 32, ior: 1.75, debug: 2 });
  assert.deepEqual(decoded.elements, state.elements);
});

test('decoding ignores junk instead of corrupting the material', () => {
  const decoded = decodeState('#scene=nope&m=notAParameter:3|ior:abc|blurRim:12&debug=99&e=broken');
  assert.deepEqual(decoded.material, { blurRim: 12 });
  assert.deepEqual(decoded.elements, []);
  assert.equal(decoded.sceneId, 'nope');
  // An unknown scene is the caller's problem to resolve, but fusion must not be
  // silently turned off by a link that never mentioned it.
  assert.equal(decoded.fusion, null);
});

test('an empty hash means "no shared state"', () => {
  assert.equal(decodeState(''), null);
  assert.equal(decodeState('#'), null);
});

test('the exported code only sets parameters that were changed', () => {
  const state = session();
  state.material.blurRim = 32;
  const code = toCode({ ...state, backdropSrc: './wallpaper.webp' });

  assert.match(code, /import \{ LiquidGlassWebGL, getDefaultMaterial \}/);
  assert.match(code, /material\.blurRim = 32;/);
  assert.match(code, /fusion: true,/);
  assert.match(code, /await glass\.loadBackdrop\('\.\/wallpaper\.webp'\);/);
  assert.match(code, /\{ id: 'toolbar', shape: 'pill', x: 100, y: 28, width: 560, height: 66 \},/);
  assert.doesNotMatch(code, /material\.ior/, 'an untouched parameter should not be emitted');
  assert.doesNotMatch(code, /material\.debug/, 'the debug view is not part of a material');

  const untouched = toCode({ ...session(), backdropSrc: null });
  assert.match(untouched, /every parameter is at its default/);
  assert.match(untouched, /Draw your own content into a canvas/);
});

test('every serialised parameter name is a real material parameter', () => {
  const state = session();
  for (const key of Object.keys(DEFAULT_MATERIAL)) {
    if (typeof DEFAULT_MATERIAL[key] === 'number') state.material[key] = DEFAULT_MATERIAL[key] + 0.5;
  }
  const decoded = decodeState(`#${encodeState(state)}`);
  for (const key of Object.keys(decoded.material)) {
    assert.ok(key in DEFAULT_MATERIAL, `${key} is not a material parameter`);
  }
});
