// Playground wiring.
//
// This page drives the published component through its public API - the same
// `LiquidGlassWebGL` an app would import - instead of reaching into the
// renderer. Anything awkward here is awkward for everyone, which is the point.

import {
  LiquidGlassWebGL, LiquidGlassWebGLV2, connectedElementGroups,
  getDefaultMaterialV2, makeMaterial,
} from '../src/index.js';
import { SCENES, ICON_SOURCES, attachIconImages, isAnimated, sceneById } from './scenes.js?phone-scenes=3';
import { drawSceneBackdrop } from './content.js?phone-scenes=2';
import { drawGlassContents, drawLabel, drawBadge, drawSelection, drawPhoneSceneOverlay } from './overlay.js?phone-scenes=2';
import { createInspector } from './inspector.js';
import { createComponentEditor } from './components.js?phone-scenes=2';
import { attachStageInteractions } from './interactions.js?phone-scenes=2';
import { createStats } from './stats.js';
import { decodeState, toCode, writeHash } from './permalink.js';
import { PHONE_ICON_SOURCES, attachPhoneIconImages } from './phone.js?phone-scenes=2';

const $ = (id) => document.getElementById(id);
const stage = $('stage');
const contentCanvas = $('content');
const glCanvas = $('gl');
const uiCanvas = $('ui');
const liveRegion = $('announcer');
const announce = (message) => { liveRegion.textContent = message; };

// ------------------------------------------------------------------ support
if (!LiquidGlassWebGL.isSupported()) {
  document.body.classList.add('unsupported');
  $('unsupported').hidden = false;
  announce('This browser cannot run WebGL2.');
  throw new Error('WebGL2 is unavailable; the playground cannot start.');
}

const contentContext = contentCanvas.getContext('2d');
const uiContext = uiCanvas.getContext('2d');

const shared = decodeState();
const initialVersion = shared?.version === 'v2' ? 'v2' : 'v1';
const materials = {
  v1: makeMaterial('regular'),
  v2: getDefaultMaterialV2(),
};

const store = {
  version: initialVersion,
  materials,
  sceneId: sceneById(shared?.sceneId ?? SCENES[0].id).id,
  material: materials[initialVersion],
  fusion: shared?.fusion ?? true,
  showIcons: shared?.showIcons ?? false,
  showLabels: shared?.showLabels ?? false,
  elements: [],
  selectedId: null,
  wallZoom: 1,
  movedElements: false,
  customScene: null,
  customObjectUrl: null,
  stageSize: () => ({ width: stage.clientWidth, height: stage.clientHeight }),
};
Object.assign(store.material, shared?.material ?? {});

function effectiveFusion() {
  return store.fusion && !currentScene().lockedComponents;
}

function createGlass() {
  const GlassClass = store.version === 'v2' ? LiquidGlassWebGLV2 : LiquidGlassWebGL;
  const options = {
    compositeMode: 'overlay',
    material: store.material,
    // The playground owns the frame loop and the layout, and the screenshot tools
    // read the drawing buffer back.
    autoResize: false,
    preserveDrawingBuffer: true,
    onContextLost: () => announce('The GPU context was lost. Waiting for the browser to restore it.'),
    onContextRestored: () => announce('The GPU context was restored.'),
  };
  if (store.version === 'v1') options.fusion = effectiveFusion();
  const instance = new GlassClass(glCanvas, options);
  instance.setBackdrop(contentCanvas, { update: 'static', autoStart: false, shouldRender: false });
  return instance;
}

let glass = createGlass();

const stats = createStats($('stats'));

// -------------------------------------------------------------------- scenes
const images = new Map();
const pending = new Set();

function currentScene() {
  return store.customScene && store.sceneId === store.customScene.id
    ? store.customScene
    : sceneById(store.sceneId);
}

function allScenes() {
  return store.customScene ? [...SCENES, store.customScene] : SCENES;
}

/** Loads a scene's wallpaper the first time it is needed, never before. */
function ensureBackdropImage(scene) {
  const { src } = scene.backdrop;
  if (!src || images.has(src) || pending.has(src)) return;
  pending.add(src);
  const image = new Image();
  image.decoding = 'async';
  image.onload = () => {
    images.set(src, image);
    pending.delete(src);
    document.body.classList.add('wallpapers-ready');
    invalidate({ content: true });
  };
  image.onerror = () => {
    pending.delete(src);
    console.warn(`Wallpaper failed to load: ${src}`);
    document.body.classList.add('wallpapers-ready');
  };
  image.src = src;
}

function backdropSourceFor(scene) {
  if (scene.backdrop.type === 'video') return scene.backdrop.source;
  return images.get(scene.backdrop.src) ?? null;
}

let animating = false;
let backdropMode = 'static';

function syncBackdropMode() {
  const scene = currentScene();
  animating = isAnimated(scene);
  const mode = animating ? 'live' : 'static';
  if (mode !== backdropMode) {
    backdropMode = mode;
    glass.setBackdrop(contentCanvas, { update: mode, autoStart: false, shouldRender: false });
  }
  const video = scene.backdrop.type === 'video' ? scene.backdrop.source : null;
  for (const other of allScenes()) {
    const source = other.backdrop.type === 'video' ? other.backdrop.source : null;
    if (source && source !== video) source.pause();
  }
  if (video && video.paused) {
    video.play().catch(() => announce('The browser blocked video playback. Interact with the page and pick the scene again.'));
  }
}

function layoutScene({ keepEdits = false } = {}) {
  const scene = currentScene();
  if (scene.lockedComponents) keepEdits = false;
  const { width, height } = store.stageSize();
  const previous = new Map(store.elements.map((element) => [element.id, element]));
  const fresh = scene.layout(width, height);
  store.elements = fresh.map((element) => {
    const kept = keepEdits ? previous.get(element.id) : null;
    return kept ? { ...element, x: kept.x, y: kept.y, w: kept.w, h: kept.h, shape: kept.shape } : element;
  });
  if (!keepEdits) store.movedElements = false;
  if (!store.elements.some((element) => element.id === store.selectedId)) store.selectedId = null;
}

function applySharedElements() {
  if (!shared?.elements?.length || currentScene().lockedComponents) return;
  const byId = new Map(store.elements.map((element) => [element.id, element]));
  for (const element of shared.elements) {
    const existing = byId.get(element.id);
    if (existing) Object.assign(existing, element);
    else store.elements.push({ ...element, label: element.id, content: '' });
  }
  store.movedElements = true;
}

function selectScene(id, { fromShare = false } = {}) {
  store.sceneId = allScenes().some((scene) => scene.id === id) ? id : SCENES[0].id;
  const scene = currentScene();
  ensureBackdropImage(scene);
  // Scenes that paint their own backdrop have nothing to wait for.
  if (!scene.backdrop.src) document.body.classList.add('wallpapers-ready');
  syncBackdropMode();
  layoutScene();
  if (fromShare) applySharedElements();
  if (store.version === 'v1') glass.setFusion(effectiveFusion(), undefined, false);
  applyElements();
  syncSceneUI();
  componentEditor.render();
  invalidate({ content: true });
}

// -------------------------------------------------------------------- render
let queued = false;
let contentDirty = true;
let sceneStart = performance.now();
let lastSize = { width: 0, height: 0, dpr: 0 };

function invalidate({ content = false } = {}) {
  if (content) contentDirty = true;
  if (queued) return;
  queued = true;
  requestAnimationFrame(frame);
}

function syncSizes() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const width = stage.clientWidth;
  const height = stage.clientHeight;
  const resized = width !== lastSize.width || height !== lastSize.height || dpr !== lastSize.dpr;
  if (resized) {
    for (const canvas of [contentCanvas, uiCanvas]) {
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
    }
    glCanvas.style.width = `${width}px`;
    glCanvas.style.height = `${height}px`;
    lastSize = { width, height, dpr };
  }
  return { width, height, dpr, resized };
}

function drawOverlayLayer({ width, height, dpr }) {
  uiContext.setTransform(dpr, 0, 0, dpr, 0, 0);
  uiContext.clearRect(0, 0, width, height);
  const scene = currentScene();
  if (scene.phoneView) {
    drawPhoneSceneOverlay(uiContext, scene, glass.elements, width, height);
  } else {
    for (const element of glass.elements) {
      if (store.showIcons) drawGlassContents(uiContext, element);
      if (store.showLabels) { drawLabel(uiContext, element); drawBadge(uiContext, element); }
    }
    const selected = glass.elements.find((element) => element.id === store.selectedId);
    if (selected) drawSelection(uiContext, selected);
  }
}

function frame(now) {
  queued = false;
  const started = performance.now();
  const size = syncSizes();
  const scene = currentScene();

  if (contentDirty || size.resized || animating) {
    drawSceneBackdrop(contentContext, scene, {
      width: size.width,
      height: size.height,
      dpr: size.dpr,
      zoom: store.wallZoom,
      scroll: (now - sceneStart) * 0.055,
      image: backdropSourceFor(scene),
    });
    if (!animating) glass.updateBackdrop(false);
    contentDirty = false;
  }

  const willDraw = animating || size.resized || glass.dirty;
  glass.render();
  drawOverlayLayer(size);
  if (willDraw) stats.frame(performance.now() - started);

  const groups = store.version === 'v2'
    ? Math.ceil(glass.elements.length / 16)
    : effectiveFusion()
      ? connectedElementGroups(glass.elements, glass.material.mergeRadius).length
      : glass.elements.length;
  stats.info({
    size: `${Math.round(size.width * size.dpr)}×${Math.round(size.height * size.dpr)}`,
    dpr: `${size.dpr}×`,
    shapes: `${glass.elements.length} in ${groups} pass${groups === 1 ? '' : 'es'}`,
    backdrop: animating ? 'live upload' : 'static upload',
  });

  if (animating) invalidate();
}

// Elements are edited as plain objects here and pushed into the component,
// which normalises and copies them.
function applyElements() {
  glass.setElements(store.elements, false);
}

function onSceneChange(reason) {
  if (['drag', 'nudge', 'add', 'remove', 'retype', 'dragend'].includes(reason)) {
    store.movedElements = true;
  }
  applyElements();
  if (['add', 'remove', 'retype', 'select', 'deselect'].includes(reason)) componentEditor.render();
  queueHash();
  invalidate();
}

// ------------------------------------------------------------------ controls
let inspector;
function rebuildInspector() {
  inspector = createInspector({
    container: $('sliders'),
    material: store.material,
    version: store.version,
    onChange: () => {
      glass.setMaterial(store.material, false);
      syncPresetButtons(null);
      queueHash();
      invalidate();
    },
  });
}
rebuildInspector();

const componentEditor = createComponentEditor({
  container: $('componentList'),
  addButton: $('addComponent'),
  addShape: $('addComponentShape'),
  store,
  onChange: onSceneChange,
  announce,
  isLocked: () => Boolean(currentScene().lockedComponents),
});

attachStageInteractions({
  canvas: uiCanvas,
  getGlass: () => glass,
  store,
  onChange: onSceneChange,
  announce,
  isLocked: () => Boolean(currentScene().lockedComponents),
});

function syncPresetButtons(active) {
  for (const button of document.querySelectorAll('[data-preset]')) {
    button.classList.toggle('active', button.dataset.preset === active);
  }
}

for (const button of document.querySelectorAll('[data-preset]')) {
  button.addEventListener('click', () => {
    if (store.version !== 'v1') return;
    Object.assign(store.material, makeMaterial(button.dataset.preset));
    glass.setMaterial(store.material, false);
    inspector.sync();
    syncPresetButtons(button.dataset.preset);
    queueHash();
    invalidate();
  });
}

$('resetMaterial').addEventListener('click', () => {
  const defaults = store.version === 'v2' ? getDefaultMaterialV2() : makeMaterial('regular');
  Object.assign(store.material, defaults);
  glass.setMaterial(store.material, false);
  inspector.sync();
  syncPresetButtons(store.version === 'v1' ? 'regular' : null);
  announce(`${store.version.toUpperCase()} material reset to its own package defaults.`);
  queueHash();
  invalidate();
});

function syncVersionUI() {
  const isV2 = store.version === 'v2';
  const locked = Boolean(currentScene().lockedComponents);
  for (const button of document.querySelectorAll('[data-renderer-version]')) {
    button.classList.toggle('active', button.dataset.rendererVersion === store.version);
  }
  $('rendererVersion').textContent = isV2 ? 'V2 transparent' : 'V1 original';
  $('materialVersion').textContent = isV2 ? 'V2 parameters' : 'V1 parameters';
  $('versionNote').textContent = isV2
    ? 'Clear edge-capture optics. Its values are independent from V1, including same-named controls.'
    : 'The original frosted material with smooth-union fusion.';
  $('hudVersion').textContent = isV2 ? 'LIQUID GLASS / V2 TRANSPARENT' : 'LIQUID GLASS / V1 ORIGINAL';
  $('materialTip').textContent = locked
    ? 'This reference scene has a fixed iPhone layout. Switch between V1 and V2, then adjust only that renderer’s material parameters.'
    : (isV2
      ? 'V2 keeps the centre nearly straight-through and captures nearby backdrop transitions only in the edge field. Roundness is a ratio; optical lengths are scaled independently.'
      : 'Drag components together: inside the fusion distance they form one surface, so the silhouette, refraction and highlight flow through a shared bridge. A gap only closes while it is narrower than about half the fusion distance.');
  $('presetToolbar').hidden = isV2;
  $('fusionControl').hidden = isV2;
  $('debugSection').hidden = isV2 || locked;
}

function setRendererVersion(version, { announceChange = true } = {}) {
  if (!['v1', 'v2'].includes(version)) return;
  if (version === store.version) {
    syncVersionUI();
    return;
  }

  glass.destroy();
  store.version = version;
  store.material = store.materials[version];
  glass = createGlass();
  applyElements();
  // The new renderer starts with a static upload; force the current scene's
  // actual live/static policy back onto it.
  backdropMode = '';
  syncBackdropMode();
  rebuildInspector();
  syncPresetButtons(version === 'v1' ? 'regular' : null);
  syncVersionUI();
  syncToggleButtons();
  queueHash();
  invalidate({ content: true });
  if (announceChange) announce(`Switched to ${version === 'v2' ? 'V2 transparent' : 'V1 original'} renderer.`);
}

for (const button of document.querySelectorAll('[data-renderer-version]')) {
  button.addEventListener('click', () => setRendererVersion(button.dataset.rendererVersion));
}

function syncToggleButtons() {
  const flags = {
    'fusion-mode': store.fusion,
    'icon-mode': store.showIcons,
    'label-mode': store.showLabels,
  };
  for (const [attribute, value] of Object.entries(flags)) {
    for (const button of document.querySelectorAll(`[data-${attribute}]`)) {
      button.classList.toggle('active', (button.dataset[toCamel(attribute)] === 'on') === value);
    }
  }
  for (const button of document.querySelectorAll('[data-debug]')) {
    button.classList.toggle('active', Number(button.dataset.debug) === store.material.debug);
  }
}
const toCamel = (value) => value.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());

for (const button of document.querySelectorAll('[data-fusion-mode]')) {
  button.addEventListener('click', () => {
    if (store.version !== 'v1') return;
    store.fusion = button.dataset.fusionMode === 'on';
    glass.setFusion(store.fusion, undefined, false);
    syncToggleButtons();
    queueHash();
    invalidate();
  });
}
for (const button of document.querySelectorAll('[data-icon-mode]')) {
  button.addEventListener('click', () => {
    store.showIcons = button.dataset.iconMode === 'on';
    syncToggleButtons();
    queueHash();
    invalidate();
  });
}
for (const button of document.querySelectorAll('[data-label-mode]')) {
  button.addEventListener('click', () => {
    store.showLabels = button.dataset.labelMode === 'on';
    syncToggleButtons();
    queueHash();
    invalidate();
  });
}
for (const button of document.querySelectorAll('[data-debug]')) {
  button.addEventListener('click', () => {
    if (store.version !== 'v1') return;
    store.material.debug = Number(button.dataset.debug);
    glass.setMaterial(store.material, false);
    syncToggleButtons();
    queueHash();
    invalidate();
  });
}

// --------------------------------------------------------------- scene picker
const scenePicker = $('scenePicker');
const sceneSelect = $('scene');

function renderScenePicker() {
  scenePicker.replaceChildren();
  for (const scene of allScenes()) {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'sceneCard';
    card.dataset.scene = scene.id;
    // The cards use 480px thumbnails, not the full wallpapers.
    if (scene.backdrop.thumb) card.style.setProperty('--scene-image', `url("${scene.backdrop.thumb}")`);
    else card.style.setProperty('--scene-tint', scene.backdrop.tint ?? '#1d2430');
    card.innerHTML = `<span></span><small></small>`;
    card.querySelector('span').textContent = scene.name;
    card.querySelector('small').textContent = scene.kind;
    card.addEventListener('click', () => selectScene(scene.id));
    scenePicker.appendChild(card);
  }

  sceneSelect.replaceChildren();
  for (const scene of allScenes()) {
    const option = document.createElement('option');
    option.value = scene.id;
    option.textContent = scene.name;
    sceneSelect.appendChild(option);
  }
}

function syncSceneUI() {
  const scene = currentScene();
  const list = allScenes();
  const index = list.findIndex((entry) => entry.id === scene.id);
  sceneSelect.value = scene.id;
  $('sceneKind').textContent = scene.kind;
  $('hudScene').textContent = scene.name;
  const locked = Boolean(scene.lockedComponents);
  $('hudKind').textContent = locked ? `${scene.kind} / material parameters only`
    : `${scene.kind} / drag the components, or select one and use the arrow keys`;
  $('componentSection').hidden = locked;
  $('viewSection').hidden = locked;
  $('stageHud').hidden = locked;
  $('keyboardHelp').hidden = locked;
  $('materialTip').textContent = locked
    ? 'This reference scene has a fixed iPhone layout. Switch between V1 and V2, then adjust only that renderer’s material parameters.'
    : (store.version === 'v2'
      ? 'V2 keeps the centre nearly straight-through and captures nearby backdrop transitions only in the edge field. Roundness is a ratio; optical lengths are scaled independently.'
      : 'Drag components together: inside the fusion distance they form one surface, so the silhouette, refraction and highlight flow through a shared bridge. A gap only closes while it is narrower than about half the fusion distance.');
  $('debugSection').hidden = store.version === 'v2' || locked;
  uiCanvas.setAttribute('aria-label', locked
    ? `${scene.name}. Components are fixed; use the inspector to adjust material parameters.`
    : 'Liquid glass stage. Drag a component, or select one and move it with the arrow keys.');
  if (locked) store.selectedId = null;
  $('sceneCount').textContent = `${String(index + 1).padStart(2, '0')} / ${String(list.length).padStart(2, '0')}`;
  for (const card of scenePicker.querySelectorAll('[data-scene]')) {
    card.classList.toggle('active', card.dataset.scene === scene.id);
  }
  sceneStart = performance.now();
  syncToggleButtons();
}

sceneSelect.addEventListener('change', () => selectScene(sceneSelect.value));

// ------------------------------------------------------------- custom uploads
const customInput = $('customMedia');
const customStatus = $('customSceneStatus');

function loadMedia(url, kind) {
  return new Promise((resolve, reject) => {
    if (kind === 'image') {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('The browser could not decode this image.'));
      image.src = url;
      return;
    }
    const video = document.createElement('video');
    Object.assign(video, { muted: true, loop: true, playsInline: true, preload: 'auto', src: url });
    video.onloadeddata = () => resolve(video);
    video.onerror = () => reject(new Error('The browser could not decode this video.'));
    video.load();
  });
}

function videoThumb(video) {
  const canvas = document.createElement('canvas');
  const scale = Math.min(1, 480 / Math.max(video.videoWidth, 1));
  canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
  canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
  canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.8);
}

customInput.addEventListener('change', async () => {
  const [file] = customInput.files || [];
  if (!file) return;
  const kind = file.type.startsWith('video/') ? 'video' : file.type.startsWith('image/') ? 'image' : '';
  if (!kind) {
    customStatus.textContent = 'Choose an image or video file';
    customInput.value = '';
    return;
  }
  customStatus.textContent = kind === 'video' ? 'Loading video…' : 'Loading image…';
  let url;
  try {
    url = URL.createObjectURL(file);
    const source = await loadMedia(url, kind);
    const previous = store.customObjectUrl;
    store.customObjectUrl = url;
    const id = 'custom';
    store.customScene = {
      id,
      name: file.name.replace(/\.[^/.]+$/, '') || `Custom ${kind}`,
      kind: kind === 'video' ? 'Your video, live' : 'Your image',
      backdrop: kind === 'video'
        ? { type: 'video', source, animated: true, thumb: videoThumb(source) }
        : { type: 'image', src: url, thumb: url },
      layout: sceneById(store.sceneId).layout,
    };
    if (kind === 'image') images.set(url, source);
    if (previous && previous !== url) URL.revokeObjectURL(previous);
    renderScenePicker();
    selectScene(id);
    customStatus.textContent = kind === 'video' ? 'Your video · live backdrop' : 'Your image · static backdrop';
  } catch (error) {
    if (url) URL.revokeObjectURL(url);
    customStatus.textContent = `Could not load that ${kind}`;
    console.warn('Custom scene loading failed.', error);
  } finally {
    customInput.value = '';
  }
});

// --------------------------------------------------------------------- share
let hashQueued = false;
function queueHash() {
  if (hashQueued) return;
  hashQueued = true;
  setTimeout(() => {
    hashQueued = false;
    writeHash({ ...store, sceneId: store.sceneId });
  }, 160);
}

async function copy(text, message) {
  try {
    await navigator.clipboard.writeText(text);
    announce(message);
    return true;
  } catch {
    announce('The browser blocked clipboard access.');
    return false;
  }
}

function flash(button, label) {
  const original = button.textContent;
  button.textContent = label;
  button.classList.add('active');
  setTimeout(() => { button.textContent = original; button.classList.remove('active'); }, 1200);
}

// The button has to be captured before the await: `event.currentTarget` is null
// once the handler resumes.
$('copyLink').addEventListener('click', async ({ currentTarget: button }) => {
  const url = writeHash({ ...store });
  if (await copy(url, 'Share link copied.')) flash(button, 'Link copied');
});

$('copyCode').addEventListener('click', async ({ currentTarget: button }) => {
  const scene = currentScene();
  const code = toCode({
    version: store.version,
    material: store.material,
    fusion: store.fusion,
    elements: store.elements,
    backdropSrc: scene.backdrop.type === 'image' && !scene.backdrop.src?.startsWith('blob:')
      ? scene.backdrop.src
      : null,
  });
  if (await copy(code, 'Code copied to the clipboard.')) flash(button, 'Code copied');
});

// ---------------------------------------------------------------------- panel
function setPanelHidden(hidden) {
  document.body.classList.toggle('hide-panel', hidden);
  // The stage width changes with the panel, so the layout has to follow.
  relayout();
}

function relayout() {
  layoutScene({ keepEdits: store.movedElements });
  applyElements();
  invalidate({ content: true });
}
$('togglePanel').addEventListener('click', () => setPanelHidden(true));
$('showPanel').addEventListener('click', () => setPanelHidden(false));

window.addEventListener('resize', relayout);

document.addEventListener('visibilitychange', () => {
  const scene = currentScene();
  const video = scene.backdrop.type === 'video' ? scene.backdrop.source : null;
  if (document.hidden) video?.pause();
  else if (video) syncBackdropMode();
  if (!document.hidden) invalidate({ content: true });
});

window.addEventListener('beforeunload', () => {
  if (store.customObjectUrl) URL.revokeObjectURL(store.customObjectUrl);
});

// ----------------------------------------------------------------- bootstrap
Promise.all([...ICON_SOURCES, ...PHONE_ICON_SOURCES].map((src) => new Promise((resolve) => {
  const image = new Image();
  image.onload = () => resolve([src, image]);
  image.onerror = () => resolve([src, null]);
  image.src = src;
}))).then((entries) => {
  const decodedImages = new Map(entries.filter(([, image]) => image));
  attachIconImages(decodedImages);
  attachPhoneIconImages(decodedImages);
  invalidate();
});

renderScenePicker();
selectScene(store.sceneId, { fromShare: true });
applyElements();
syncPresetButtons(store.version === 'v1' && !Object.keys(shared?.material ?? {}).length ? 'regular' : null);
syncVersionUI();
inspector.sync();
invalidate({ content: true });

// Hook for the screenshot and visual regression tooling.
window.__lg = {
  store,
  get glass() { return glass; },
  render: () => { invalidate(); },
  invalidate,
  syncSliders: () => inspector.sync(),
  scenes: () => allScenes().map((scene) => scene.id),
  ready: () => !pending.size && (currentScene().backdrop.type !== 'image' || Boolean(backdropSourceFor(currentScene()))),
  set(patch) {
    Object.assign(store.material, patch);
    glass.setMaterial(store.material, false);
    inspector.sync();
    invalidate();
  },
  setScene(idOrIndex) {
    const list = allScenes();
    const scene = typeof idOrIndex === 'number' ? list[idOrIndex] : list.find((entry) => entry.id === idOrIndex);
    store.wallZoom = 1;
    if (scene) selectScene(scene.id);
  },
  setVersion(version) {
    setRendererVersion(version, { announceChange: false });
  },
  /**
   * Isolates one component, centred and enlarged, for close-up comparisons.
   * Every length of the material scales with the zoom, so this is a true
   * magnification of the same physical glass, not a different material.
   */
  focus(index, zoom = 2) {
    const element = store.elements[index];
    if (!element) return;
    const { width, height } = store.stageSize();
    element.w *= zoom;
    element.h *= zoom;
    element.x = width / 2 - element.w / 2;
    element.y = height / 2 - element.h / 2;
    store.elements = [element];
    store.movedElements = true;
    store.wallZoom = zoom;
    const scalable = store.version === 'v2'
      ? ['refraction', 'edgeReach', 'frost']
      : ['radius', 'bevel', 'height', 'shadowSize', 'shadowOffset',
        'edgeWidth', 'blurPlateau', 'blurRim'];
    for (const key of scalable) {
      store.material[key] *= zoom;
    }
    glass.setMaterial(store.material, false);
    applyElements();
    inspector.sync();
    componentEditor.render();
    invalidate({ content: true });
  },
};
