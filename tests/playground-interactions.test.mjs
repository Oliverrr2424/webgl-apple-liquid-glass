import test from 'node:test';
import assert from 'node:assert/strict';
import { resizeElementFromEditor, resizeElementFromHandle } from '../playground/interactions.js';
import { sliderProgressForPointer } from '../playground/press-effects.js';

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

test('component editor resizes around the centre', () => {
  const rectangle = { shape: 'rect', x: 10, y: 20, w: 100, h: 80 };
  resizeElementFromEditor(rectangle, 'width', 140);
  assert.deepEqual(rectangle, { shape: 'rect', x: -10, y: 20, w: 140, h: 80 });
});

test('component editor keeps circles square from either size field', () => {
  const circle = { shape: 'circle', x: 10, y: 20, w: 100, h: 100 };
  resizeElementFromEditor(circle, 'height', 60);
  assert.deepEqual(circle, { shape: 'circle', x: 30, y: 40, w: 60, h: 60 });
});

test('selection slider follows a held pointer but stays inside its glass track', () => {
  const track = { x: 100, w: 240 };
  const thumb = { w: 108 };
  assert.equal(sliderProgressForPointer(track, thumb, 0), 0);
  assert.equal(sliderProgressForPointer(track, thumb, 100 + 54), 0);
  assert.equal(sliderProgressForPointer(track, thumb, 100 + 54 + 66), 0.5);
  assert.equal(sliderProgressForPointer(track, thumb, 1000), 1);
});
