// V2 is the clear optical material from the transparent renderer. These
// values deliberately live outside material.js: similarly named V1 controls
// (notably dispersion and edgeWidth) use different units and shader maths.
export const DEFAULT_MATERIAL_V2 = Object.freeze({
  refraction: 90,
  edgeReach: 0,
  edgeWidth: 0,
  dispersion: 0.7,
  frost: 0.18,
  body: 0.72,
  absorption: 0.58,
  tint: 0,
  rim: 0.72,
  reflection: 0.68,
  highlight: 0.38,
  lightAngle: 136,
  echo: 0.28,
  hairline: 0.92,
  hairWidth: 0.52,
  roundness: 0.47,
});

export const REDUCED_TRANSPARENCY_MATERIAL_V2 = Object.freeze({
  refraction: 0,
  edgeReach: 0,
  dispersion: 0,
  frost: 0,
  body: 1.5,
  tint: 1.35,
  reflection: 0.18,
  highlight: 0.12,
  echo: 0,
});

export const SLIDERS_V2 = Object.freeze([
  ['refraction', 0, 110, 1],
  ['edgeReach', 0, 160, 1],
  ['edgeWidth', 0, 0.55, 0.01],
  ['dispersion', 0, 7, 0.1],
  ['frost', 0, 3.5, 0.05],
  ['body', 0, 1.5, 0.01],
  ['absorption', 0, 2, 0.01],
  ['tint', 0, 1.5, 0.01],
  ['rim', 0, 1, 0.01],
  ['reflection', 0, 1.5, 0.01],
  ['highlight', 0, 1.5, 0.01],
  ['lightAngle', -180, 180, 1],
  ['echo', 0, 1.5, 0.01],
  ['hairline', 0, 1.5, 0.01],
  ['hairWidth', 0, 1, 0.01],
  ['roundness', 0.05, 0.6, 0.01],
]);

/** Return a fresh V2 material. No V1 preset or parameter conversion is used. */
export function getDefaultMaterialV2() {
  return { ...DEFAULT_MATERIAL_V2 };
}

export function makeMaterialV2(overrides = {}) {
  if (typeof overrides === 'string') {
    throw new TypeError('Liquid Glass V2 does not use V1 preset names.');
  }
  const unknown = Object.keys(overrides || {}).filter((key) => !(key in DEFAULT_MATERIAL_V2));
  if (unknown.length) {
    throw new TypeError(`Unknown Liquid Glass V2 material parameter${unknown.length === 1 ? '' : 's'}: ${unknown.join(', ')}`);
  }
  return { ...getDefaultMaterialV2(), ...(overrides || {}) };
}
