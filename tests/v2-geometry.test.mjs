import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  cornerRadiusV2, fieldNormalV2, hitTestElementsV2, sdElementV2, sdFieldV2, shapeTypeOfV2,
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

test('V2 normals cross a rounded corner diagonal without a crease', () => {
  const card = { shape: 'rect', x: 0, y: 0, w: 420, h: 280, radius: 28 };
  // Across the top-left corner's diagonal (x === y) at a fixed depth.
  const angles = (normalAt) => {
    const list = [];
    for (let x = 20; x <= 60; x += 1) {
      const [nx, ny] = normalAt(x, 40);
      list.push(Math.atan2(ny, nx) * 180 / Math.PI);
    }
    return list;
  };
  const worstStep = (list) => Math.max(...list.slice(1).map((angle, index) => {
    const step = Math.abs(angle - list[index]) % 360;
    return step > 180 ? 360 - step : step;
  }));

  // The exact distance switches its nearest edge across the diagonal, which
  // is what used to fold a crease into the corner.
  const exactNormal = (x, y) => {
    const e = 1.35;
    const dx = sdElementV2(x + e, y, card, material) - sdElementV2(x - e, y, card, material);
    const dy = sdElementV2(x, y + e, card, material) - sdElementV2(x, y - e, card, material);
    const length = Math.hypot(dx, dy) || 1;
    return [dx / length, dy / length];
  };
  assert.ok(worstStep(angles(exactNormal)) > 30, 'the exact field is expected to turn abruptly');
  assert.ok(
    worstStep(angles((x, y) => fieldNormalV2(x, y, card, material))) < 12,
    'the normal field must turn smoothly across the diagonal',
  );
});

test('V2 normal field keeps the exact silhouette', () => {
  const card = { shape: 'rect', x: 0, y: 0, w: 420, h: 280, radius: 28 };
  // On and outside the contour the soft ridge contributes nothing.
  for (const [x, y] of [[0, 40], [40, 0], [-6, 40], [210, -8], [28 - 28 / Math.SQRT2, 28 - 28 / Math.SQRT2]]) {
    assert.ok(
      Math.abs(sdFieldV2(x, y, card, material) - sdElementV2(x, y, card, material)) < 1e-9,
      `field differs from the silhouette at ${x},${y}`,
    );
  }
});

test('V2 hit testing follows shape geometry and topmost overlap', () => {
  const elements = [
    { id: 'card', shape: 'rect', x: 0, y: 0, w: 160, h: 120 },
    { id: 'dot', shape: 'circle', x: 55, y: 35, w: 50, h: 50 },
  ];
  assert.equal(hitTestElementsV2(80, 60, elements, material)?.id, 'dot');
  assert.equal(hitTestElementsV2(56, 36, [elements[1]], material), null);
});
