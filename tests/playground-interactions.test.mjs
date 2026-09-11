import test from 'node:test';
import assert from 'node:assert/strict';
import { resizeElementFromEditor, resizeElementFromHandle } from '../playground/interactions.js';
import { sliderProgressForPointer } from '../playground/press-effects.js';
import {
  PRESSED_CONTROL_MATERIAL_V2, getPressedControlMaterialV2,
} from '../src/controls.js';
import { DEFAULT_NAV_LENS } from '../playground/permalink.js';
import { sceneById } from '../playground/scenes.js';

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

test('V2 slider presses keep fixed transmission while inheriting other controls', () => {
  assert.deepEqual(PRESSED_CONTROL_MATERIAL_V2, {
    refraction: 17,
    edgeReach: 0.14,
    edgeWidth: 0.22,
    dispersion: 0,
    frost: 0,
    backdropBlur: 0,
    body: 0.72,
    absorption: 0.58,
    tint: 0,
  });
  const material = getPressedControlMaterialV2({
    refraction: 99,
    edgeReach: 0.8,
    rim: 0.73,
    hairline: 0.44,
  });
  assert.equal(material.refraction, 17);
  assert.equal(material.edgeReach, 0.14);
  assert.equal(material.edgeWidth, 0.22);
  assert.equal(material.rim, 0.73);
  assert.equal(material.hairline, 0.44);
  assert.equal(PRESSED_CONTROL_MATERIAL_V2.tint, 0);
});

test('pressed navigation lens defaults match the tuned geometry', () => {
  assert.deepEqual(DEFAULT_NAV_LENS, {
    outerWidth: 0.13,
    outerHeight: 1.24,
    innerLength: 0,
    innerHeight: 0.24,
  });
});

test('Press scene includes a narrower navigation stress case', () => {
  const elements = sceneById('press').layout(1200, 760);
  const regular = elements.find((element) => element.id === 'selection-track');
  const compact = elements.find((element) => element.id === 'compact-selection-track');
  const thumb = elements.find((element) => element.id === 'compact-selection-thumb');
  assert.ok(compact.w < regular.w);
  assert.ok(compact.w <= 312);
  assert.ok(compact.h > regular.h);
  assert.ok(Math.abs(thumb.x + thumb.w - (compact.x + compact.w / 2)) < 1e-9);
  assert.equal(compact.navigationLens, true);
  assert.equal(compact.sliderThumb, 'compact-selection-thumb');
});
