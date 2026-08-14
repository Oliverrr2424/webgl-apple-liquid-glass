import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  cornerRadiusV2, hitTestElementsV2, sdElementV2, shapeTypeOfV2,
} from '../src/v2-geometry.js';

const material = { roundness: 0.47 };

test('V2 uses the same public shape silhouettes as V1', () => {
  assert.deepEqual(
    ['rect', 'folder', 'pill', 'circle'].map(shapeTypeOfV2),
    [0, 0, 1, 2],
  );
});

test('V2 roundness is a short-half ratio, not the V1 pixel radius', () => {
  assert.equal(cornerRadiusV2({ w: 200, h: 100 }, 0.5), 25);
  assert.equal(cornerRadiusV2({ w: 200, h: 100 }, 0.2), 10);
});

test('V2 folder is the same rounded square as V1 instead of a tabbed silhouette', () => {
  const rect = { shape: 'rect', x: 0, y: 0, w: 200, h: 160 };
  const folder = { ...rect, shape: 'folder' };
  for (const [x, y] of [[8, 8], [40, 8], [100, 80], [196, 156]]) {
    assert.equal(sdElementV2(x, y, folder, material), sdElementV2(x, y, rect, material));
  }
  assert.equal(cornerRadiusV2({ w: 100, h: 100 }), 23.5);
});

test('V2 hit testing follows shape geometry and topmost overlap', () => {
  const elements = [
    { id: 'card', shape: 'rect', x: 0, y: 0, w: 160, h: 120 },
    { id: 'dot', shape: 'circle', x: 55, y: 35, w: 50, h: 50 },
  ];
  assert.equal(hitTestElementsV2(80, 60, elements, material)?.id, 'dot');
  assert.equal(hitTestElementsV2(56, 36, [elements[1]], material), null);
});
