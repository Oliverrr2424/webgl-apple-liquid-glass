import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  cornerRadiusV2, hitTestElementsV2, sdElementV2, shapeTypeOfV2,
} from '../src/v2-geometry.js';

const material = { roundness: 0.5 };

test('V2 keeps all four shader shape ids distinct', () => {
  assert.deepEqual(
    ['rect', 'folder', 'pill', 'circle'].map(shapeTypeOfV2),
    [0, 1, 2, 3],
  );
});

test('V2 roundness is a short-half ratio, not the V1 pixel radius', () => {
  assert.equal(cornerRadiusV2({ w: 200, h: 100 }, 0.5), 25);
  assert.equal(cornerRadiusV2({ w: 200, h: 100 }, 0.2), 10);
});

test('V2 folder has a tab while V2 rect does not', () => {
  const rect = { shape: 'rect', x: 0, y: 0, w: 200, h: 160 };
  const folder = { ...rect, shape: 'folder' };
  // Near the upper-left tab the folder is inside while the more deeply
  // rounded rectangle corner is outside.
  assert.ok(sdElementV2(8, 8, rect, material) > 0);
  assert.ok(sdElementV2(40, 8, folder, material) < 0);
});

test('V2 hit testing follows shape geometry and topmost overlap', () => {
  const elements = [
    { id: 'card', shape: 'rect', x: 0, y: 0, w: 160, h: 120 },
    { id: 'dot', shape: 'circle', x: 55, y: 35, w: 50, h: 50 },
  ];
  assert.equal(hitTestElementsV2(80, 60, elements, material)?.id, 'dot');
  assert.equal(hitTestElementsV2(56, 36, [elements[1]], material), null);
});
