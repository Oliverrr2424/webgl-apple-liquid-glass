// Share links and code export.
//
// Thirty sliders are worthless if the result cannot leave the page, so the whole
// tuning session lives in the URL hash and can be copied out as the exact code
// that reproduces it.

import { DEFAULT_MATERIAL, getDefaultMaterial } from '../src/index.js';
import { DEFAULT_MATERIAL_V2, getDefaultMaterialV2 } from '../src/v2.js';

const round = (value) => Math.round(value * 1000) / 1000;

const versionOf = (value) => value === 'v2' ? 'v2' : 'v1';
const defaultsFor = (version) => versionOf(version) === 'v2' ? DEFAULT_MATERIAL_V2 : DEFAULT_MATERIAL;

function encodeMaterial(material, defaults) {
  return Object.keys(defaults)
    .filter((key) => typeof material[key] === 'number' && material[key] !== defaults[key])
    .map((key) => `${key}:${round(material[key])}`)
    .join('|');
}

function encodeElements(elements) {
  return elements
    .map((e) => [e.id, e.shape, round(e.x), round(e.y), round(e.w), round(e.h)].join(':'))
    .join('|');
}

/** Serialises the tuning session into a URL hash. */
export function encodeState(state) {
  const version = versionOf(state.version);
  const defaults = defaultsFor(version);
  const params = new URLSearchParams();
  params.set('scene', state.sceneId);
  if (version === 'v2') params.set('version', 'v2');
  else params.set('fusion', state.fusion ? '1' : '0');
  if (state.showIcons) params.set('icons', '1');
  if (state.showLabels) params.set('labels', '1');
  if (version === 'v1' && state.material.debug) params.set('debug', String(state.material.debug));
  const material = encodeMaterial(state.material, defaults);
  if (material) params.set('m', material);
  if (state.movedElements) params.set('e', encodeElements(state.elements));
  return params.toString();
}

/** Reads whatever a shared link contains. Unknown keys are ignored. */
export function decodeState(hash = globalThis.location?.hash ?? '') {
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  if (![...params.keys()].length) return null;

  const version = versionOf(params.get('version'));
  const defaults = defaultsFor(version);
  const material = {};
  let legacyEdgePull = null;
  for (const pair of (params.get('m') ?? '').split('|').filter(Boolean)) {
    const [key, value] = pair.split(':');
    const number = Number(value);
    if (key in defaults && Number.isFinite(number)) material[key] = number;
    else if (version === 'v2' && key === 'edgePull' && Number.isFinite(number)) {
      legacyEdgePull = number;
    }
  }
  // Old V2 links encoded capture as edgeReach * edgePull. Collapse that pair
  // into the retained reach control, whose shader uses the old 1.24 default as
  // an internal calibration. This keeps existing Playground links visually
  // equivalent after Edge pull is removed from the public material.
  if (version === 'v2' && legacyEdgePull !== null) {
    // Legacy links that omitted reach inherited the old 62px default, not the
    // current zero-capture default.
    const legacyReach = material.edgeReach ?? 62;
    material.edgeReach = round(legacyReach * legacyEdgePull / 1.24);
  }
  const debug = Number(params.get('debug'));
  if (version === 'v1' && debug >= 1 && debug <= 3) material.debug = debug;

  const elements = (params.get('e') ?? '').split('|').filter(Boolean).map((entry) => {
    const [id, shape, x, y, w, h] = entry.split(':');
    return { id, shape, x: Number(x), y: Number(y), w: Number(w), h: Number(h) };
  }).filter((element) => element.w > 0 && element.h > 0);

  return {
    version,
    sceneId: params.get('scene') ?? null,
    fusion: params.get('fusion') === null ? null : params.get('fusion') === '1',
    showIcons: params.get('icons') === '1',
    showLabels: params.get('labels') === '1',
    material,
    elements,
  };
}

/** Replaces the hash without adding a history entry per slider move. */
export function writeHash(state) {
  const hash = `#${encodeState(state)}`;
  if (globalThis.location.hash !== hash) {
    history.replaceState(null, '', hash);
  }
  return `${location.origin}${location.pathname}${hash}`;
}

/** The code that reproduces the current session with the published package. */
export function toCode(state) {
  const version = versionOf(state.version);
  const defaults = version === 'v2' ? getDefaultMaterialV2() : getDefaultMaterial();
  const defaultDefinition = defaultsFor(version);
  const overrides = Object.keys(defaultDefinition)
    .filter((key) => typeof state.material[key] === 'number'
      && state.material[key] !== defaults[key]
      && key !== 'debug')
    .map((key) => `material.${key} = ${round(state.material[key])};`);

  const elements = state.elements.map((e) => `  { id: '${e.id}', shape: '${e.shape}', `
    + `x: ${Math.round(e.x)}, y: ${Math.round(e.y)}, `
    + `width: ${Math.round(e.w)}, height: ${Math.round(e.h)} },`);

  const backdrop = state.backdropSrc
    ? `await glass.loadBackdrop('${state.backdropSrc}');`
    : '// Draw your own content into a canvas and pass it to glass.setBackdrop().';

  const imports = version === 'v2'
    ? "import { LiquidGlassWebGLV2, getDefaultMaterialV2 } from 'apple-liquid-glass-webgl';"
    : "import { LiquidGlassWebGL, getDefaultMaterial } from 'apple-liquid-glass-webgl';";
  const getMaterial = version === 'v2' ? 'getDefaultMaterialV2' : 'getDefaultMaterial';
  const GlassClass = version === 'v2' ? 'LiquidGlassWebGLV2' : 'LiquidGlassWebGL';
  const options = version === 'v2' ? ['  material,'] : ['  material,', `  fusion: ${state.fusion},`];

  return [
    imports,
    '',
    `const material = ${getMaterial}();`,
    ...(overrides.length ? overrides : ['// every parameter is at its default']),
    '',
    'const canvas = document.querySelector(\'canvas\');',
    `const glass = new ${GlassClass}(canvas, {`,
    ...options,
    '});',
    '',
    backdrop,
    'glass.setElements([',
    ...elements,
    '], false);',
    'glass.render();',
    '',
  ].join('\n');
}
