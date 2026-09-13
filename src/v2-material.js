// V2 is the clear optical material from the transparent renderer. These
// values deliberately live outside material.js: similarly named V1 controls
// (notably dispersion and edgeWidth) use different units and shader maths.
export const DEFAULT_MATERIAL_V2 = Object.freeze({
  refraction: 84,
  // Capture distance as a fraction of the component's short side.
  edgeReach: 0.14,
  edgeWidth: 0.21,
  dispersion: 2.0,
  // Softness ratio. Like backdropBlur it blurs the backdrop before refraction,
  // but its radius is resolved against each component's short side, so the
  // same value stays delicate on small icons and becomes denser on large cards.
  frost: 0,
  // Absolute pre-blur radius in CSS pixels; combines with frost.
  backdropBlur: 0,
  body: 0.72,
  absorption: 0.58,
  tint: 0,
  rim: 0.24,
  reflection: 0.31,
  highlight: 0.34,
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
  backdropBlur: 0,
  body: 1.5,
  tint: 1.35,
  reflection: 0.18,
  highlight: 0.12,
  echo: 0,
});

export const SLIDERS_V2 = Object.freeze([
  ['refraction', 0, 110, 1],
  ['edgeReach', 0, 1.6, 0.01],
  ['edgeWidth', 0, 0.55, 0.01],
  ['dispersion', 0, 7, 0.1],
  ['frost', 0, 1, 0.01],
  ['backdropBlur', 0, 64, 1],
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
