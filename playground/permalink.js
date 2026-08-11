// Share links and code export.
//
// Thirty sliders are worthless if the result cannot leave the page, so the whole
// tuning session lives in the URL hash and can be copied out as the exact code
// that reproduces it.

import { DEFAULT_MATERIAL, getDefaultMaterial } from '../src/index.js';

const round = (value) => Math.round(value * 1000) / 1000;

function encodeMaterial(material) {
  return Object.keys(DEFAULT_MATERIAL)
    .filter((key) => typeof material[key] === 'number' && material[key] !== DEFAULT_MATERIAL[key])
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
  const params = new URLSearchParams();
  params.set('scene', state.sceneId);
  params.set('fusion', state.fusion ? '1' : '0');
  if (state.showIcons) params.set('icons', '1');
  if (state.showLabels) params.set('labels', '1');
  if (state.material.debug) params.set('debug', String(state.material.debug));
  const material = encodeMaterial(state.material);
  if (material) params.set('m', material);
  if (state.movedElements) params.set('e', encodeElements(state.elements));
  return params.toString();
}

/** Reads whatever a shared link contains. Unknown keys are ignored. */
export function decodeState(hash = globalThis.location?.hash ?? '') {
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  if (![...params.keys()].length) return null;

  const material = {};
  for (const pair of (params.get('m') ?? '').split('|').filter(Boolean)) {
    const [key, value] = pair.split(':');
    if (key in DEFAULT_MATERIAL && Number.isFinite(Number(value))) material[key] = Number(value);
  }
  const debug = Number(params.get('debug'));
  if (debug >= 1 && debug <= 3) material.debug = debug;

  const elements = (params.get('e') ?? '').split('|').filter(Boolean).map((entry) => {
    const [id, shape, x, y, w, h] = entry.split(':');
    return { id, shape, x: Number(x), y: Number(y), w: Number(w), h: Number(h) };
  }).filter((element) => element.w > 0 && element.h > 0);

  return {
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
  const defaults = getDefaultMaterial();
  const overrides = Object.keys(DEFAULT_MATERIAL)
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

  return [
    "import { LiquidGlassWebGL, getDefaultMaterial } from 'apple-liquid-glass-webgl';",
    '',
    'const material = getDefaultMaterial();',
    ...(overrides.length ? overrides : ['// every parameter is at its default']),
    '',
    'const canvas = document.querySelector(\'canvas\');',
    'const glass = new LiquidGlassWebGL(canvas, {',
    '  material,',
    `  fusion: ${state.fusion},`,
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
