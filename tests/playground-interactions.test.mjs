import test from 'node:test';
import assert from 'node:assert/strict';
import { resizeElementFromHandle } from '../playground/interactions.js';

test('folder corner resizing stays square for both playground renderers', () => {
  const folder = { shape: 'folder', x: 10, y: 20, w: 100, h: 100 };
  resizeElementFromHandle(folder, { id: 'se' }, 150, 180);
  assert.equal(folder.w, 140);
  assert.equal(folder.h, 140);
});

test('north folder resizing keeps the opposite edge anchored', () => {
  const folder = { shape: 'folder', x: 10, y: 20, w: 100, h: 100 };
  resizeElementFromHandle(folder, { id: 'nw' }, 0, 0);
  assert.equal(folder.w, 110);
  assert.equal(folder.h, 110);
  assert.equal(folder.y + folder.h, 120);
});

test('rectangle resizing remains freeform', () => {
  const rectangle = { shape: 'rect', x: 10, y: 20, w: 100, h: 100 };
  resizeElementFromHandle(rectangle, { id: 'se' }, 150, 180);
  assert.deepEqual({ w: rectangle.w, h: rectangle.h }, { w: 140, h: 160 });
});
