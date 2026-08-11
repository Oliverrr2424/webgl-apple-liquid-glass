import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  MAX_GLASS_SHAPES, connectedElementGroups, cornerRadiusOf, groupElements,
  hitTestElements, sdGroup, sdPrimitive, sdRenderedGroups, shapeTypeOf,
} from '../src/geometry.js';

const rect = (x, y, w, h, id = 'rect') => ({ id, shape: 'rect', x, y, w, h });

test('shape types match the ids the shader expects', () => {
  assert.equal(shapeTypeOf('rect'), 0);
  assert.equal(shapeTypeOf('folder'), 0);
  assert.equal(shapeTypeOf('pill'), 1);
  assert.equal(shapeTypeOf('circle'), 2);
  assert.equal(shapeTypeOf('unknown'), 0);
});

test('a circle stays a circle regardless of its box', () => {
  // shapeType 2 uses the short half side, so a stretched box cannot make an
  // ellipse - the same rule the shader documents.
  assert.equal(sdPrimitive(0, 0, 60, 20, 2, 0), -20);
  assert.ok(Math.abs(sdPrimitive(20, 0, 60, 20, 2, 0)) < 1e-6);
  assert.ok(sdPrimitive(40, 0, 60, 20, 2, 0) > 0);
});

test('a capsule end cap is half the short side', () => {
  const half = [80, 25];
  // Along the centre line the distance to the surface is the short half side.
  assert.ok(Math.abs(sdPrimitive(0, 0, ...half, 1, 0) + 25) < 1e-4);
  // The far tip sits exactly on the surface.
  assert.ok(Math.abs(sdPrimitive(80, 0, ...half, 1, 0)) < 1e-3);
});

test('a rounded corner is outside its own bounding box corner', () => {
  // This is precisely what an axis-aligned hit test gets wrong.
  const outside = sdPrimitive(99, 99, 100, 100, 0, 40, 2);
  assert.ok(outside > 0, `expected the box corner to be outside the squircle, got ${outside}`);
  assert.ok(sdPrimitive(0, 0, 100, 100, 0, 40, 2) < 0);
});

test('the corner radius is capped at 23.5% of the short side', () => {
  assert.equal(cornerRadiusOf({ w: 100, h: 100 }, 64), 23.5);
  assert.equal(cornerRadiusOf({ w: 400, h: 400 }, 64), 64);
  assert.equal(cornerRadiusOf({ w: 100, h: 100, radius: 10 }, 64), 10);
});

test('sdGroup equals the primitive for a single shape', () => {
  const elements = [rect(0, 0, 200, 200)];
  const material = { radius: 40, squircle: 2, mergeRadius: 52 };
  const direct = sdPrimitive(-100, -100, 100, 100, 0, 40, 2);
  assert.ok(Math.abs(sdGroup(0, 0, elements, material) - direct) < 1e-9);
});

test('the smooth union bridges a gap that neither shape covers', () => {
  // A 20px gap is inside the reach of a 60px fusion distance; a 60px gap is not.
  const near = [rect(0, 0, 100, 100, 'a'), rect(120, 0, 100, 100, 'b')];
  const wide = [rect(0, 0, 100, 100, 'a'), rect(160, 0, 100, 100, 'b')];
  const material = { radius: 20, squircle: 2 };

  assert.ok(sdGroup(110, 50, near, material, 0) > 0, 'the gap is open without fusion');
  assert.ok(sdGroup(110, 50, near, material, 60) < 0, 'fusion should close a narrow gap');
  assert.ok(sdGroup(130, 50, wide, material, 60) > 0, 'fusion should not close a wide gap');
});

test('hit testing follows the shape, not the bounding box', () => {
  const elements = [{ id: 'dot', shape: 'circle', x: 0, y: 0, w: 100, h: 100 }];
  const material = { radius: 0, squircle: 2, mergeRadius: 0 };
  assert.equal(hitTestElements(50, 50, elements, material)?.id, 'dot');
  assert.equal(hitTestElements(2, 2, elements, material), null, 'the box corner is not on the circle');
  assert.equal(hitTestElements(2, 2, elements, material, { tolerance: 40 })?.id, 'dot');
});

test('hit testing returns the nearest element and the topmost on a tie', () => {
  const elements = [rect(0, 0, 100, 100, 'under'), rect(20, 20, 100, 100, 'over')];
  const material = { radius: 0, squircle: 2, mergeRadius: 0 };
  assert.equal(hitTestElements(10, 10, elements, material)?.id, 'under');
  assert.equal(hitTestElements(110, 110, elements, material)?.id, 'over');
  // Deep inside the overlap both distances are equal, so the later element wins.
  assert.equal(hitTestElements(60, 60, elements, material)?.id, 'over');
});

test('separate overlapping elements hit the last drawn element', () => {
  const elements = [
    rect(0, 0, 200, 200, 'card'),
    { id: 'button', shape: 'circle', x: 80, y: 80, w: 40, h: 40 },
  ];
  const material = { radius: 20, squircle: 2, mergeRadius: 52 };
  assert.equal(
    hitTestElements(100, 100, elements, material, { fusion: false })?.id,
    'button',
  );
});

test('a fused bridge is hittable, and attributed to the nearer component', () => {
  const elements = [rect(0, 0, 100, 100, 'a'), rect(120, 0, 100, 100, 'b')];
  const material = { radius: 20, squircle: 2, mergeRadius: 60 };
  assert.equal(hitTestElements(110, 50, elements, material, { fusion: false }), null);
  assert.equal(hitTestElements(105, 50, elements, material)?.id, 'a');
  assert.equal(hitTestElements(115, 50, elements, material)?.id, 'b');
});

test('far apart elements are grouped separately, near ones together', () => {
  const near = [rect(0, 0, 100, 100, 'a'), rect(130, 0, 100, 100, 'b')];
  const far = [rect(0, 0, 100, 100, 'a'), rect(900, 0, 100, 100, 'b')];
  assert.equal(connectedElementGroups(near, 60).length, 1);
  assert.equal(connectedElementGroups(far, 60).length, 2);
  // Without fusion every element is on its own unless the boxes touch.
  assert.equal(connectedElementGroups(near, 0).length, 2);
  assert.equal(connectedElementGroups([rect(0, 0, 100, 100, 'a'), rect(50, 0, 100, 100, 'b')], 0).length, 1);
});

test('grouping accepts the public width and height element format', () => {
  const elements = [
    { id: 'a', shape: 'rect', x: 0, y: 0, width: 100, height: 100 },
    { id: 'b', shape: 'rect', x: 120, y: 0, width: 100, height: 100 },
  ];
  assert.equal(connectedElementGroups(elements, 60).length, 1);
});

test('grouping is transitive through a chain of neighbours', () => {
  const chain = Array.from({ length: 5 }, (_, i) => rect(i * 130, 0, 100, 100, `c${i}`));
  assert.equal(connectedElementGroups(chain, 60).length, 1);
  assert.equal(connectedElementGroups(chain, 0).length, 5);
});

test('groupElements reports when a connected set exceeds the shader limit', () => {
  const wide = Array.from({ length: MAX_GLASS_SHAPES + 4 }, (_, i) => rect(i * 20, 0, 100, 100, `w${i}`));
  const overflowing = groupElements(wide, 60);
  assert.equal(overflowing.truncated, true);
  assert.ok(overflowing.groups.every((group) => group.length <= MAX_GLASS_SHAPES));
  assert.equal(overflowing.groups.flat().length, wide.length);

  const spread = Array.from({ length: MAX_GLASS_SHAPES + 4 }, (_, i) => rect(i * 900, 0, 100, 100, `s${i}`));
  const spreadGroups = groupElements(spread, 60);
  assert.equal(spreadGroups.truncated, false);
  assert.equal(spreadGroups.groups.length, spread.length);
});

test('hit testing and rendered distance respect a 16-shape chunk boundary', () => {
  const elements = Array.from(
    { length: MAX_GLASS_SHAPES + 1 },
    (_, i) => rect(i * 30, 0, 10, 40, String(i)),
  );
  const material = { radius: 0, squircle: 2, mergeRadius: 60 };
  const x = 470;
  const y = 20;

  assert.ok(sdGroup(x, y, elements, material, 60) < 0, 'the unsplit SDF invents a bridge');
  assert.ok(sdRenderedGroups(x, y, elements, material, 60) > 0, 'the rendered chunks leave a gap');
  assert.equal(hitTestElements(x, y, elements, material), null);
});

test('grouping handles the empty and single cases', () => {
  assert.deepEqual(connectedElementGroups([], 60), []);
  assert.equal(connectedElementGroups([rect(0, 0, 10, 10)], 60).length, 1);
  assert.equal(sdGroup(0, 0, [], {}), Infinity);
  assert.equal(hitTestElements(0, 0, [], {}), null);
});
