import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  DEFAULT_MATERIAL, PRESETS, REDUCED_TRANSPARENCY_MATERIAL, SLIDERS,
  getDefaultMaterial, makeMaterial,
} from '../src/material.js';

test('getDefaultMaterial hands out an independent copy every time', () => {
  const a = getDefaultMaterial();
  const b = getDefaultMaterial();
  assert.notEqual(a, b);
  assert.deepEqual(a, b);

  a.blurRim = 999;
  a.tintColor[0] = 0;
  assert.equal(DEFAULT_MATERIAL.blurRim, b.blurRim);
  assert.equal(DEFAULT_MATERIAL.tintColor[0], 1);
  assert.equal(b.tintColor[0], 1);
});

test('makeMaterial layers a preset over the defaults', () => {
  assert.deepEqual(makeMaterial(), getDefaultMaterial());
  assert.deepEqual(makeMaterial('regular'), getDefaultMaterial());
  assert.equal(makeMaterial('clear').blurPlateau, PRESETS.clear.blurPlateau);
  assert.equal(makeMaterial('clear').radius, DEFAULT_MATERIAL.radius);
  // An unknown name degrades to the defaults rather than throwing.
  assert.deepEqual(makeMaterial('nope'), getDefaultMaterial());
});

test('presets only override parameters that exist', () => {
  for (const [name, preset] of Object.entries(PRESETS)) {
    for (const key of Object.keys(preset)) {
      assert.ok(key in DEFAULT_MATERIAL, `preset "${name}" sets unknown parameter "${key}"`);
    }
  }
});

test('the reduced-transparency fallback only overrides real parameters', () => {
  for (const key of Object.keys(REDUCED_TRANSPARENCY_MATERIAL)) {
    assert.ok(key in DEFAULT_MATERIAL, `reduced transparency sets unknown parameter "${key}"`);
  }
  // It has to actually reduce transparency, or the option is decoration.
  const reduced = { ...getDefaultMaterial(), ...REDUCED_TRANSPARENCY_MATERIAL };
  assert.ok(reduced.tintAmount > DEFAULT_MATERIAL.tintAmount * 4);
  assert.equal(reduced.refractScale, 0);
  assert.equal(reduced.blurPlateau, 0);
});

test('every slider maps to a parameter, and every default is in range', () => {
  const sliderKeys = new Set(SLIDERS.map(([key]) => key));
  for (const [key, min, max, step] of SLIDERS) {
    assert.ok(key in DEFAULT_MATERIAL, `slider "${key}" is not a material parameter`);
    assert.ok(min < max, `slider "${key}" has an empty range`);
    assert.ok(step > 0, `slider "${key}" has a non-positive step`);
    const value = DEFAULT_MATERIAL[key];
    assert.ok(value >= min && value <= max,
      `default ${key}=${value} falls outside its slider range [${min}, ${max}]`);
  }

  // tintColor is a colour, debug is a mode: both are driven by other controls.
  const unexposed = Object.keys(DEFAULT_MATERIAL)
    .filter((key) => !sliderKeys.has(key) && !['tintColor', 'debug'].includes(key));
  assert.deepEqual(unexposed, [], `parameters with no control: ${unexposed.join(', ')}`);
});
