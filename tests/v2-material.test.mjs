import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  DEFAULT_MATERIAL_V2, REDUCED_TRANSPARENCY_MATERIAL_V2, SLIDERS_V2,
  getDefaultMaterialV2, makeMaterialV2,
} from '../src/v2-material.js';

test('V2 materials are independent copies with their own parameter ranges', () => {
  const a = getDefaultMaterialV2();
  const b = getDefaultMaterialV2();
  assert.notEqual(a, b);
  assert.deepEqual(a, b);
  a.dispersion = 99;
  assert.equal(b.dispersion, 0.7);
  assert.equal(makeMaterialV2({ edgeWidth: 0.4 }).edgeWidth, 0.4);
  assert.throws(() => makeMaterialV2('clear'), /does not use V1 preset names/);
  assert.throws(() => makeMaterialV2({ blurRim: 4 }), /Unknown Liquid Glass V2/);

  const keys = new Set(SLIDERS_V2.map(([key]) => key));
  assert.deepEqual(keys, new Set(Object.keys(DEFAULT_MATERIAL_V2)));
  for (const [key, min, max, step] of SLIDERS_V2) {
    assert.ok(DEFAULT_MATERIAL_V2[key] >= min && DEFAULT_MATERIAL_V2[key] <= max);
    assert.ok(step > 0);
  }
});

test('V2 reduced transparency only overrides V2 parameters', () => {
  for (const key of Object.keys(REDUCED_TRANSPARENCY_MATERIAL_V2)) {
    assert.ok(key in DEFAULT_MATERIAL_V2, `${key} is not a V2 material parameter`);
  }
  assert.equal(REDUCED_TRANSPARENCY_MATERIAL_V2.refraction, 0);
  assert.ok(REDUCED_TRANSPARENCY_MATERIAL_V2.tint > 1);
});
