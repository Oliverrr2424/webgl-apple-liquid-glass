import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  DEFAULT_MATERIAL_V2, REDUCED_TRANSPARENCY_MATERIAL_V2, SLIDERS_V2,
  getDefaultMaterialV2, makeMaterialV2,
} from '../src/v2-material.js';
import { getDefaultMaterial } from '../src/material.js';

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
  assert.deepEqual(SLIDERS_V2.find(([key]) => key === 'refraction'),
    ['refraction', 0, 110, 1]);
  assert.equal(DEFAULT_MATERIAL_V2.refraction, 90);
  assert.equal(DEFAULT_MATERIAL_V2.edgeReach, 0);
  assert.equal(DEFAULT_MATERIAL_V2.edgeWidth, 0);
});

test('V1 and V2 material state cannot mutate each other', () => {
  const v1 = getDefaultMaterial();
  const v2 = getDefaultMaterialV2();
  const originalV1Dispersion = v1.dispersion;
  const originalV2Dispersion = v2.dispersion;

  v1.dispersion = 0.12;
  v1.edgeWidth = 4;
  assert.equal(v2.dispersion, originalV2Dispersion);
  assert.equal(v2.edgeWidth, DEFAULT_MATERIAL_V2.edgeWidth);

  v2.dispersion = 5;
  v2.edgeWidth = 0.5;
  assert.equal(getDefaultMaterial().dispersion, originalV1Dispersion);
  assert.equal(v1.edgeWidth, 4);
  assert.equal(v1.blurRim, 11);
  assert.equal(v2.blurRim, undefined);
});

test('V2 reduced transparency only overrides V2 parameters', () => {
  for (const key of Object.keys(REDUCED_TRANSPARENCY_MATERIAL_V2)) {
    assert.ok(key in DEFAULT_MATERIAL_V2, `${key} is not a V2 material parameter`);
  }
  assert.equal(REDUCED_TRANSPARENCY_MATERIAL_V2.refraction, 0);
  assert.ok(REDUCED_TRANSPARENCY_MATERIAL_V2.tint > 1);
});
