// Physical + artistic parameters of the material. Lengths are CSS pixels.
export const DEFAULT_MATERIAL = {
  radius: 64,          // corner radius (clamped to 23.5% of the side)
  squircle: 2.0,       // Folder corner exponent selected from the references
  bevel: 34,           // width of the refracting rim
  height: 21,          // optical thickness of the slab
  ior: 2.0,            // effective IOR after screen-space calibration
  dispersion: 0.06,    // IOR spread between R and B -> chromatic fringe
  refractScale: 3.0,   // artistic gain on the displacement
  meniscus: 1.0,       // 1 = concave (liquid) rim -> surroundings squeeze into
                       // the rim (Apple);  0 = convex lens rim (magnifier)
  blurPlateau: 8,      // blur radius in the middle, CSS px (frosted)
  blurRim: 48,         // wide rim scattering, CSS px
  opticalDensity: 1.8, // preserve dark occluders as blur spreads (0 = linear)
  specular: 0.89,
  specPower: 11.5,
  fresnel: 0.65,       // multiplier on the Schlick term (1 = physical)
  saturation: 1.35,    // boost on the transmitted backdrop, like iOS materials
  brightness: 0.0,
  tintAmount: 0.08,    // constant milky layer -- same for every element
  tintColor: [1.0, 1.0, 1.0],
  shadow: 0.24,
  shadowSize: 8.5,
  shadowOffset: 0,
  lightX: -0.18,
  lightY: 0.08,
  highlightAdapt: 0.83,// how strongly backdrop gradient steers the highlight
  highlightWidth: 0.76,// specular band width as a fraction of the bevel
  highlightSharpness: 0.55, // multiplier on specPower
  highlightBase: 0.30, // fallback intensity on a flat backdrop
  edgeLine: 0.30,
  edgeWidth: 1.1,      // px width of the contour / highlight lines
  edgeDark: 0.11,      // grazing-angle darkening at the silhouette
  debug: 0,            // 0 final, 1 thickness, 2 normals, 3 displacement
};

export const PRESETS = {
  // iOS 26 folder on a home screen: heavily frosted plateau, strong edge lens
  regular: {},
  // "Clear" variant: almost no frost, refraction and specular do all the work
  clear: {
    blurPlateau: 3, blurRim: 1, height: 20, bevel: 15, refractScale: 1.5,
    specular: 0.36, fresnel: 1.0, tintAmount: 0.02, brightness: 0.02,
    saturation: 1.18,
  },
  // exaggerated, for teaching the physics
  lens: {
    bevel: 26, height: 34, ior: 1.62, dispersion: 0.09, refractScale: 1.8,
    blurPlateau: 2, blurRim: 0, specular: 0.42, fresnel: 1.2,
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
  ['blurPlateau', 0, 48, 0.5],
  ['blurRim', 0, 48, 0.5],
  ['opticalDensity', 0, 3, 0.05],
  ['specular', 0, 1, 0.01],
  ['specPower', 1, 40, 0.5],
  ['highlightAdapt', 0, 1, 0.01],
  ['highlightWidth', 0.16, 1, 0.01],
  ['highlightSharpness', 0.5, 3, 0.05],
  ['highlightBase', 0, 1, 0.01],
  ['fresnel', 0, 2, 0.01],
  ['saturation', 0, 2, 0.02],
  ['brightness', -0.2, 0.3, 0.01],
  ['tintAmount', 0, 0.4, 0.01],
  ['shadow', 0, 1, 0.01],
  ['shadowSize', 1, 30, 0.5],
  ['shadowOffset', 0, 20, 0.5],
  ['lightX', -1, 1, 0.02],
  ['lightY', -1, 1, 0.02],
  ['edgeLine', 0, 0.5, 0.01],
  ['edgeWidth', 0.5, 6, 0.1],
  ['edgeDark', 0, 0.5, 0.01],
];
