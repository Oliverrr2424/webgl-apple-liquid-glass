// Physical + artistic parameters of the material. Lengths are CSS pixels.
export const DEFAULT_MATERIAL = {
  radius: 64,          // corner radius (clamped to 23.5% of the side)
  squircle: 2.0,       // Folder corner exponent selected from the references
  mergeRadius: 52,     // smooth-union reach between nearby components
  bevel: 34,           // width of the refracting rim
  height: 21,          // optical thickness of the slab
  ior: 2.0,            // effective IOR after screen-space calibration
  dispersion: 0.06,    // IOR spread between R and B -> chromatic fringe
  refractScale: 3.0,   // artistic gain on the displacement
  meniscus: 1.0,       // 1 = concave (liquid) rim -> surroundings squeeze into
                       // the rim (Apple);  0 = convex lens rim (magnifier)
  blurPlateau: 8,      // blur radius in the middle, CSS px (frosted)
  blurRim: 48,         // wide rim scattering, CSS px
  opticalDensity: 0.65,// artistic dark-detail weight; linear-light blur needs less compensation
  specular: 0.89,
  specPower: 11.5,
  fresnel: 0.65,       // multiplier on the Schlick term (1 = physical)
  saturation: 1.35,    // boost on the transmitted backdrop, like iOS materials
  brightness: 0.0,
  tintAmount: 0.02,    // strength of the material tint layer
  tintColor: [1.0, 1.0, 1.0],
  tintAdapt: 0.14,     // choose a light/dark tint from backdrop luminance
  shadow: 0.09,
  shadowSize: 4.0,
  shadowOffset: 0,
  lightX: -0.18,
  lightY: 0.08,
  highlightAdapt: 0.83,// how strongly backdrop gradient steers the highlight
  highlightWidth: 0.76,// specular band width as a fraction of the bevel
  highlightSharpness: 0.55, // multiplier on specPower
  highlightBase: 0.30, // fallback intensity on a flat backdrop
  edgeLine: 0.30,
  edgeWidth: 0.5,      // px width of the contour / highlight lines
  edgeDark: 0.02,      // grazing-angle darkening at the silhouette
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

/**
 * Overrides applied on top of the active material while the user asks for
 * reduced transparency. Refraction, dispersion and scattering are what make a
 * translucent surface hard to read, so they are removed rather than softened;
 * the shape, edge and shadow survive so the component keeps its identity.
 */
export const REDUCED_TRANSPARENCY_MATERIAL = {
  tintAmount: 0.86,
  blurPlateau: 0,
  blurRim: 0,
  refractScale: 0,
  dispersion: 0,
  meniscus: 0,
  specular: 0.12,
  fresnel: 0.15,
  saturation: 1.0,
  highlightBase: 0.06,
  edgeLine: 0.22,
};

function cloneMaterial(material) {
  return {
    ...material,
    tintColor: [...material.tintColor],
  };
}

/**
 * Return a fresh copy of the package's default material parameters.
 *
 * A fresh object (and tintColor array) is returned on every call so callers
 * can safely adjust the result without changing the package defaults.
 */
export function getDefaultMaterial() {
  return cloneMaterial(DEFAULT_MATERIAL);
}

export function makeMaterial(preset = 'regular') {
  return { ...getDefaultMaterial(), ...(PRESETS[preset] || {}) };
}

export const SLIDERS = [
  ['radius', 0, 128, 0.5],
  ['squircle', 2, 8, 0.1],
  ['mergeRadius', 0, 96, 1],
  ['bevel', 2, 40, 0.5],
  ['height', 0, 48, 0.5],
  ['ior', 1.0, 3.0, 0.01],
  ['dispersion', 0, 0.15, 0.005],
  ['refractScale', 0, 6, 0.05],
  ['meniscus', 0, 2, 0.05],
  ['blurPlateau', 0, 48, 0.5],
  ['blurRim', 0, 96, 0.5],
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
  ['tintAdapt', 0, 1, 0.01],
  ['shadow', 0, 1, 0.01],
  ['shadowSize', 1, 30, 0.5],
  ['shadowOffset', 0, 20, 0.5],
  ['lightX', -1, 1, 0.02],
  ['lightY', -1, 1, 0.02],
  ['edgeLine', 0, 0.5, 0.01],
  ['edgeWidth', 0.5, 6, 0.1],
  ['edgeDark', 0, 0.5, 0.01],
];
