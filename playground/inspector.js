// The material controls.
//
// Every parameter gets a slider and a number field: sliders are for exploring,
// typed values are for matching a reference. Double clicking a row label puts
// that one parameter back to the package default, and modified rows are marked
// so a long session stays readable.

import { DEFAULT_MATERIAL, SLIDERS } from '../src/material.js';

const GROUPS = {
  geometry: ['radius', 'squircle', 'mergeRadius', 'bevel', 'height'],
  optics: ['ior', 'dispersion', 'refractScale', 'meniscus', 'blurPlateau', 'blurRim', 'opticalDensity'],
  lighting: ['specular', 'specPower', 'highlightAdapt', 'highlightWidth', 'highlightSharpness',
    'highlightBase', 'fresnel', 'saturation', 'brightness', 'tintAmount', 'tintAdapt'],
  edge: ['shadow', 'shadowSize', 'shadowOffset', 'lightX', 'lightY', 'edgeLine', 'edgeWidth', 'edgeDark'],
};

const LABELS = {
  radius: 'Corner radius', squircle: 'Corner shape', mergeRadius: 'Fusion distance',
  bevel: 'Bevel width', height: 'Optical height',
  ior: 'Index of refraction', dispersion: 'Chromatic spread', refractScale: 'Refraction scale',
  meniscus: 'Meniscus curve', blurPlateau: 'Plateau blur', blurRim: 'Rim blur',
  opticalDensity: 'Optical density',
  specular: 'Specular', specPower: 'Specular power', highlightAdapt: 'Light adaptation',
  highlightWidth: 'Highlight width', highlightSharpness: 'Highlight sharpness',
  highlightBase: 'Highlight base', fresnel: 'Fresnel', saturation: 'Saturation',
  brightness: 'Brightness', tintAmount: 'Tint amount', tintAdapt: 'Light / dark tint',
  shadow: 'Shadow', shadowSize: 'Shadow size', shadowOffset: 'Shadow offset',
  lightX: 'Light X', lightY: 'Light Y',
  edgeLine: 'Edge highlight', edgeWidth: 'Edge width', edgeDark: 'Edge contrast',
};

const groupOf = (key) => Object.entries(GROUPS).find(([, keys]) => keys.includes(key))?.[0] ?? 'geometry';

export function createInspector({ container, material, onChange }) {
  const rows = new Map();
  const bodies = {};

  for (const name of Object.keys(GROUPS)) {
    const group = document.createElement('details');
    group.className = 'sliderGroup';
    group.open = name === 'geometry' || name === 'optics';
    group.innerHTML = `<summary>${name}<span></span></summary><div class="sliderRows"></div>`;
    container.appendChild(group);
    bodies[name] = group.querySelector('.sliderRows');
  }

  for (const [key, min, max, step] of SLIDERS) {
    const label = LABELS[key] ?? key;
    const row = document.createElement('div');
    row.className = 'row';
    row.innerHTML = `
      <button type="button" class="rowLabel" title="${key} - double click to reset to ${DEFAULT_MATERIAL[key]}">${label}</button>
      <input type="range" aria-label="${label}" min="${min}" max="${max}" step="${step}">
      <input type="number" aria-label="${label} value" class="num" min="${min}" max="${max}" step="${step}">`;
    const range = row.querySelector('input[type=range]');
    const number = row.querySelector('input[type=number]');
    const labelButton = row.querySelector('.rowLabel');

    const commit = (value) => {
      const clamped = Math.min(max, Math.max(min, value));
      if (!Number.isFinite(clamped)) return;
      material[key] = clamped;
      apply(clamped);
      onChange(key, clamped);
    };
    const apply = (value) => {
      range.value = String(value);
      if (document.activeElement !== number) number.value = String(Math.round(value * 1000) / 1000);
      row.classList.toggle('modified', value !== DEFAULT_MATERIAL[key]);
    };

    range.addEventListener('input', () => commit(parseFloat(range.value)));
    number.addEventListener('change', () => commit(parseFloat(number.value)));
    // A double click on the name is the fastest way back to a known state.
    labelButton.addEventListener('dblclick', () => commit(DEFAULT_MATERIAL[key]));
    labelButton.addEventListener('click', (event) => event.preventDefault());

    rows.set(key, { row, apply });
    bodies[groupOf(key)].appendChild(row);
  }

  const sync = () => {
    for (const [key, { apply }] of rows) apply(material[key]);
  };
  sync();

  return {
    sync,
    /** Opens the group that owns a parameter, for deep links into a control. */
    reveal(key) {
      bodies[groupOf(key)]?.closest('details')?.setAttribute('open', '');
    },
  };
}
