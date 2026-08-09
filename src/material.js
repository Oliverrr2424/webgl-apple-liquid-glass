// Physical + artistic parameters of the material. Lengths are CSS pixels.
export const DEFAULT_MATERIAL = {
  radius: 64,          // corner radius (clamped to 23.5% of the side)
  squircle: 2.0,       // superellipse exponent -> Apple's continuous corners
  bevel: 31.5,         // width of the refracting rim
  height: 26.5,        // optical thickness of the slab
  ior: 1.62,           // index of refraction (glass ~1.5)
  dispersion: 0.09,    // IOR spread between R and B -> chromatic fringe
  refractScale: 3.0,   // artistic gain on the displacement
  meniscus: 1.0,       // 1 = concave (liquid) rim -> surroundings squeeze into
                       // the rim (Apple);  0 = convex lens rim (magnifier)
  blurPlateau: 2.25,   // mip lod in the middle (frosted)
  blurRim: 5.4,        // mip lod on the rim
  specular: 0.89,
  specPower: 11.5,
  fresnel: 0.35,
  saturation: 1.0,
  brightness: 0.0,
  tintAmount: 0.0,
  adaptive: 0.28,      // white veil added over dark backdrops (legibility)
  tintColor: [1.0, 1.0, 1.0],
  shadow: 0.38,
  shadowSize: 9,
  shadowOffset: 5,
  lightX: -0.52,
  lightY: 0.58,
  edgeLine: 0.17,
  edgeWidth: 0.5,      // px width of the contour / highlight lines
  edgeDark: 0.11,      // grazing-angle darkening at the silhouette
  debug: 0,            // 0 final, 1 thickness, 2 normals, 3 displacement
};

export const PRESETS = {
  // iOS 26 folder on a home screen: heavily frosted plateau, strong edge lens
  regular: {},
  // "Clear" variant: almost no frost, refraction and specular do all the work
  clear: {
    blurPlateau: 1.1, blurRim: 0.4, height: 20, bevel: 15, refractScale: 1.5,
    specular: 0.36, fresnel: 0.40, tintAmount: 0.02, brightness: 0.02,
    saturation: 1.18,
  },
  // exaggerated, for teaching the physics
  lens: {
    bevel: 26, height: 34, ior: 1.62, dispersion: 0.09, refractScale: 1.8,
    blurPlateau: 0.6, blurRim: 0.0, specular: 0.42, fresnel: 0.5,
  },
};

export function makeMaterial(preset = 'regular') {
  return { ...DEFAULT_MATERIAL, ...(PRESETS[preset] || {}) };
}

export const SLIDERS = [
  ['radius', 0, 64, 0.5],
  ['squircle', 2, 8, 0.1],
  ['bevel', 2, 40, 0.5],
  ['height', 0, 48, 0.5],
  ['ior', 1.0, 2.0, 0.01],
  ['dispersion', 0, 0.15, 0.005],
  ['refractScale', 0, 3, 0.05],
  ['meniscus', 0, 1, 0.05],
  ['blurPlateau', 0, 6, 0.05],
  ['blurRim', 0, 6, 0.05],
  ['specular', 0, 1, 0.01],
  ['specPower', 1, 40, 0.5],
  ['fresnel', 0, 1, 0.01],
  ['saturation', 0, 2, 0.02],
  ['brightness', -0.2, 0.3, 0.01],
  ['tintAmount', 0, 0.4, 0.01],
  ['adaptive', 0, 0.5, 0.01],
  ['shadow', 0, 1, 0.01],
  ['shadowSize', 1, 30, 0.5],
  ['shadowOffset', 0, 20, 0.5],
  ['lightX', -1, 1, 0.02],
  ['lightY', -1, 1, 0.02],
  ['edgeLine', 0, 0.5, 0.01],
  ['edgeWidth', 0.5, 6, 0.1],
  ['edgeDark', 0, 0.5, 0.01],
];
