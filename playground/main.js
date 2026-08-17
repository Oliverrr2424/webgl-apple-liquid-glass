// Playground wiring.
//
// This page drives the published component through its public API - the same
// `LiquidGlassWebGL` an app would import - instead of reaching into the
// renderer. Anything awkward here is awkward for everyone, which is the point.

import {
  LiquidGlassWebGL, LiquidGlassWebGLV2, connectedElementGroups,
  getDefaultMaterialV2, makeMaterial,
} from '../src/index.js';
import {
  SCENES, PHONE_WALLPAPER_PRESETS, ICON_SOURCES,
  attachIconImages, isAnimated, sceneById,
} from './scenes.js?phone-scenes=7';
import { drawSceneBackdrop } from './content.js?phone-scenes=7';
import {
  drawGlassContents, drawLabel, drawBadge, drawSelection,
  drawPhoneSceneOverlay, drawPhonePanelOverlay,
} from './overlay.js?phone-scenes=7';
import { createInspector } from './inspector.js';
import { createComponentEditor } from './components.js?phone-scenes=7';
import { attachStageInteractions } from './interactions.js?phone-scenes=7';
import { createStats } from './stats.js';
import { decodeState, toCode, writeHash } from './permalink.js';
import { PHONE_ICON_SOURCES, attachPhoneIconImages, phoneFrame } from './phone.js?phone-scenes=7';

const $ = (id) => document.getElementById(id);
const stage = $('stage');
const contentCanvas = $('content');
const scrimCanvas = $('scrim');
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
const scrimContext = scrimCanvas.getContext('2d');
const uiContext = uiCanvas.getContext('2d');

const shared = decodeState();
const initialVersion = shared ? (shared.version === 'v2' ? 'v2' : 'v1') : 'v2';
const materials = {
  v1: makeMaterial('regular'),
  v2: getDefaultMaterialV2(),
};

const store = {
  version: initialVersion,
  materials,
  sceneId: sceneById(shared?.sceneId ?? 'tab-bar').id,
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
  customPhoneWallpapers: new Map(),
  phoneWallpaperSelections: new Map([['tab-bar', 'warm-fold']]),
  gestureTipVisibility: new Map([
    ['page', true],
    ['notification', true],
    ['control', true],
  ]),
  homePageIndex: 0,
  homePageOffset: 0,
  // Pulling down beside Dynamic Island slides a live liquid-glass sheet over
  // the Home Screen: 'notification', 'control-centre', or null when closed.
  islandPanel: { type: null, progress: 0 },
  // Home artwork is revealed underneath the sheet during its closing glide.
  homeReveal: 1,
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

const PHONE_WALLPAPER_SCENES = new Set(['tab-bar', 'notification', 'control-centre']);
const ORIGINAL_PHONE_BACKDROPS = new Map(
  SCENES.filter((scene) => PHONE_WALLPAPER_SCENES.has(scene.id))
    .map((scene) => [scene.id, { ...scene.backdrop }]),
);

function phoneWallpaperOptions(scene) {
  const original = ORIGINAL_PHONE_BACKDROPS.get(scene.id);
  const originalName = scene.id === 'tab-bar' ? 'Warm fold (scene default)' : 'Scene default';
  return [
    { id: 'scene-default', name: originalName, ...original },
    ...PHONE_WALLPAPER_PRESETS,
    ...store.customPhoneWallpapers.values(),
  ];
}

function selectedPhoneWallpaperId(scene) {
  if (!scene.phoneView) return null;
  const explicit = store.phoneWallpaperSelections.get(scene.id);
  if (explicit) return explicit;
  const original = ORIGINAL_PHONE_BACKDROPS.get(scene.id);
  if (scene.backdrop.src && scene.backdrop.src === original?.src) {
    return scene.id === 'tab-bar' ? 'warm-fold' : 'scene-default';
  }
  const preset = PHONE_WALLPAPER_PRESETS.find((entry) => entry.src === scene.backdrop.src);
  if (preset) return preset.id;
  const custom = [...store.customPhoneWallpapers.values()].find((entry) => entry.src === scene.backdrop.src);
  return custom?.id ?? 'scene-default';
}

const GESTURE_TIP_IDS = [
  ['page', 'pageGestureTip'],
  ['notification', 'notificationGestureTip'],
  ['control', 'controlGestureTip'],
];

function syncGestureTips() {
  const home = currentScene().phoneView === 'home' && !panelActive();
  for (const [id, elementId] of GESTURE_TIP_IDS) {
    $(elementId).hidden = !home || !store.gestureTipVisibility.get(id);
  }
  $('phoneGestureTips').hidden = !home
    || !GESTURE_TIP_IDS.some(([id]) => store.gestureTipVisibility.get(id));
  if (home) positionGestureTips();
}

/** Anchors the floating gesture tips to the Dynamic Island and the screen,
 * so they read as call-outs for the phone mock rather than sidebar copy. */
function positionGestureTips() {
  const { width, height } = store.stageSize();
  if (!width || !height) return;
  const frame = phoneFrame(width, height);
  const s = frame.scale;
  const islandCenterY = frame.screen.y + (11 + 36 / 2) * s;
  // The left/right tips sit just outside the bezel so they never cover the
  // status bar or Dynamic Island itself, only point at their half of it.
  const notification = $('notificationGestureTip');
  notification.style.left = `${Math.max(150, frame.outer.x - 16)}px`;
  notification.style.top = `${islandCenterY}px`;
  const control = $('controlGestureTip');
  control.style.left = `${Math.min(width - 150, frame.outer.x + frame.outer.w + 16)}px`;
  control.style.top = `${islandCenterY}px`;
  const page = $('pageGestureTip');
  page.style.left = `${frame.screen.x + frame.screen.w / 2}px`;
  page.style.top = `${frame.screen.y + 696 * s}px`;
}

function applyHomePageTransform() {
  if (currentScene().phoneView !== 'home') return;
  const { width, height } = store.stageSize();
  const pageWidth = phoneFrame(width, height).screen.w;
  const shift = -store.homePageIndex * pageWidth + store.homePageOffset;
  for (const element of store.elements) {
    if (Number.isInteger(element.phonePage) && Number.isFinite(element.phoneBaseX)) {
      element.x = element.phoneBaseX + shift;
    }
  }
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
  applyHomePageTransform();
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

let cancelHomePageAnimation = () => {};

function selectScene(id, { fromShare = false } = {}) {
  const changed = store.sceneId !== id;
  cancelHomePageAnimation();
  cancelHomeRevealAnimation();
  store.islandPanel = { type: null, progress: 0 };
  store.homeReveal = 1;
  store.sceneId = allScenes().some((scene) => scene.id === id) ? id : SCENES[0].id;
  const scene = currentScene();
  if (scene.phoneView === 'home' && changed) store.homePageIndex = 0;
  store.homePageOffset = 0;
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

function syncPhoneWallpaperUI() {
  const scene = currentScene();
  const enabled = PHONE_WALLPAPER_SCENES.has(scene.id);
  $('phoneWallpaperUpload').hidden = !enabled;
  if (!enabled) return;

  const select = $('phoneWallpaperPreset');
  select.replaceChildren();
  for (const optionData of phoneWallpaperOptions(scene)) {
    const option = document.createElement('option');
    option.value = optionData.id;
    option.textContent = optionData.name;
    select.appendChild(option);
  }
  select.value = selectedPhoneWallpaperId(scene);
  if (!select.value) select.value = 'scene-default';
  const selected = phoneWallpaperOptions(scene).find((option) => option.id === select.value);
  $('phoneWallpaperStatus').textContent = selected?.id === 'scene-default'
    ? 'Scene wallpaper'
    : `${selected?.name ?? 'Wallpaper'} selected`;
}

function setPhoneWallpaper(scene, wallpaperId, { announceChange = true } = {}) {
  if (!PHONE_WALLPAPER_SCENES.has(scene.id)) return;
  const original = ORIGINAL_PHONE_BACKDROPS.get(scene.id);
  const option = phoneWallpaperOptions(scene).find((entry) => entry.id === wallpaperId);
  if (!option) return;

  if (wallpaperId === 'scene-default') {
    store.phoneWallpaperSelections.delete(scene.id);
    scene.backdrop = { ...original };
  } else {
    store.phoneWallpaperSelections.set(scene.id, wallpaperId);
    scene.backdrop = {
      ...scene.backdrop,
      type: 'phone',
      wallpaper: 'image',
      src: option.src,
      thumb: option.thumb ?? option.src,
    };
  }

  ensureBackdropImage(scene);
  renderScenePicker();
  syncPhoneWallpaperUI();
  syncBackdropMode();
  sceneStart = performance.now();
  invalidate({ content: true });
  queueHash();
  if (announceChange) announce(`${option.name} wallpaper applied to ${scene.name}.`);
}

// --------------------------------------------------------- island pull-down
//
// Notification Centre and Control Centre are not separate destinations any
// more: they are live sheets that slide over the Home Screen. While a sheet is
// on screen the home icons, widgets and dock are hidden, so the wallpaper (dim
// in proportion to the pull) is the only thing left behind the glass.

const PANEL_LAYOUTS = { notification: 'notification', 'control-centre': 'control-centre' };

function panelActive() {
  return Boolean(store.islandPanel.type) && store.islandPanel.progress > 0;
}

/** How far the sheet still has to travel, in stage pixels, at this progress. */
function panelOffsetY(progress, frame) {
  return -(1 - progress) * frame.screen.h;
}

/** The sheet's own glass components, slid down by the current progress. */
function panelElements() {
  const { type, progress } = store.islandPanel;
  if (!type) return [];
  const { width, height } = store.stageSize();
  const frame = phoneFrame(width, height);
  const offsetY = panelOffsetY(progress, frame);
  return sceneById(PANEL_LAYOUTS[type]).layout(width, height)
    .map((element) => ({ ...element, y: element.y + offsetY }));
}

function applyPanelElements() {
  glass.setElements(panelElements(), false);
}

function setPanelProgress(progress) {
  const next = Math.max(0, Math.min(1.08, progress));
  if (Math.abs(next - store.islandPanel.progress) < 0.0005) return;
  store.islandPanel.progress = next;
  applyPanelElements();
  // The sheet and its scrim are separate lightweight layers. Keep the static
  // wallpaper upload untouched while the finger is moving.
  invalidate();
}

function setHomeReveal(reveal) {
  const next = Math.max(0, Math.min(1, reveal));
  if (Math.abs(next - store.homeReveal) < 0.0005) return;
  store.homeReveal = next;
  invalidate();
}

function openPanel(type) {
  // A tiny positive progress hides Home on the very first frame of the pull.
  // The sheet is still visually off-screen, so the gesture starts with a clean
  // wallpaper before the first meaningful panel pixels arrive.
  cancelHomeRevealAnimation();
  store.islandPanel = { type, progress: 0.001 };
  store.homeReveal = 0;
  syncGestureTips();
  applyPanelElements();
  invalidate();
}

function closePanel() {
  store.islandPanel = { type: null, progress: 0 };
  syncGestureTips();
  applyElements();
  animateHomeReveal(1, 220);
  invalidate();
}

// -------------------------------------------------------------------- render
let queued = false;
let contentDirty = true;
let sceneStart = performance.now();
let lastSize = { width: 0, height: 0, dpr: 0 };
let homeRevealAnimationFrame = 0;
let homeRevealAnimationToken = 0;

function cancelHomeRevealAnimation() {
  homeRevealAnimationToken += 1;
  if (homeRevealAnimationFrame) cancelAnimationFrame(homeRevealAnimationFrame);
  homeRevealAnimationFrame = 0;
}

function animateHomeReveal(target = 1, duration = 220) {
  cancelHomeRevealAnimation();
  const start = store.homeReveal;
  const reduceMotion = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)');
  if (reduceMotion?.matches || Math.abs(target - start) < 0.01) {
    setHomeReveal(target);
    return;
  }
  const animationToken = homeRevealAnimationToken;
  const startedAt = performance.now();
  const tick = (now) => {
    if (animationToken !== homeRevealAnimationToken) return;
    const progress = Math.min(1, (now - startedAt) / duration);
    const eased = 1 - Math.pow(1 - progress, 3);
    setHomeReveal(start + (target - start) * eased);
    if (progress < 1) homeRevealAnimationFrame = requestAnimationFrame(tick);
    else homeRevealAnimationFrame = 0;
  };
  homeRevealAnimationFrame = requestAnimationFrame(tick);
}

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
    for (const canvas of [contentCanvas, scrimCanvas, uiCanvas]) {
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
    }
    glCanvas.style.width = `${width}px`;
    glCanvas.style.height = `${height}px`;
    lastSize = { width, height, dpr };
  }
  const scene = currentScene();
  if (scene.phoneView) {
    const frame = phoneFrame(width, height);
    const right = Math.max(0, width - frame.screen.x - frame.screen.w);
    const bottom = Math.max(0, height - frame.screen.y - frame.screen.h);
    glCanvas.style.clipPath = `inset(${frame.screen.y}px ${right}px ${bottom}px ${frame.screen.x}px round ${frame.screen.r}px)`;
  } else {
    glCanvas.style.clipPath = 'none';
  }
  if (resized && scene.phoneView === 'home') positionGestureTips();
  return { width, height, dpr, resized };
}

function drawOverlayLayer({ width, height, dpr }) {
  uiContext.setTransform(dpr, 0, 0, dpr, 0, 0);
  uiContext.clearRect(0, 0, width, height);
  const scene = currentScene();
  const drawHomeScene = () => {
    if (scene.phoneView !== 'home' || store.homeReveal >= 0.999) {
      drawPhoneSceneOverlay(uiContext, scene, store.elements, width, height, store.version, {
        pageIndex: store.homePageIndex,
        pageOffset: store.homePageOffset,
      });
      return;
    }
    const frame = phoneFrame(width, height);
    uiContext.save();
    uiContext.globalAlpha = store.homeReveal;
    uiContext.translate(0, (1 - store.homeReveal) * 10 * frame.scale);
    drawPhoneSceneOverlay(uiContext, scene, store.elements, width, height, store.version, {
      pageIndex: store.homePageIndex,
      pageOffset: store.homePageOffset,
    });
    uiContext.restore();
  };
  if (panelActive()) {
    const frame = phoneFrame(width, height);
    // During the closing glide, restore Home underneath the sheet. The panel
    // remains above it, so only the newly exposed area receives the fade and
    // small upward settle instead of popping in after the panel is gone.
    if (scene.phoneView === 'home' && store.homeReveal > 0) {
      drawHomeScene();
    }
    drawPhonePanelOverlay(uiContext, store.islandPanel.type,
      sceneById(PANEL_LAYOUTS[store.islandPanel.type]).layout(width, height),
      width, height, store.version, panelOffsetY(store.islandPanel.progress, frame));
  } else if (scene.phoneView) {
    drawHomeScene();
  } else {
    for (const element of glass.elements) {
      if (store.showIcons) drawGlassContents(uiContext, element);
      if (store.showLabels) { drawLabel(uiContext, element); drawBadge(uiContext, element); }
    }
    const selected = glass.elements.find((element) => element.id === store.selectedId);
    if (selected) drawSelection(uiContext, selected);
  }
}

/** The scrim follows the sheet without forcing a full wallpaper redraw. */
function drawPanelScrim({ width, height, dpr }) {
  scrimContext.setTransform(dpr, 0, 0, dpr, 0, 0);
  scrimContext.clearRect(0, 0, width, height);
  if (!panelActive()) return;

  const { progress } = store.islandPanel;
  const frame = phoneFrame(width, height);
  scrimContext.save();
  scrimContext.beginPath();
  scrimContext.roundRect(frame.screen.x, frame.screen.y, frame.screen.w, frame.screen.h, frame.screen.r);
  scrimContext.clip();
  scrimContext.fillStyle = `rgba(6,8,13,${0.46 * progress})`;
  scrimContext.fillRect(frame.screen.x, frame.screen.y, frame.screen.w, frame.screen.h);
  scrimContext.restore();
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

  drawPanelScrim(size);
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

function attachHomePager() {
  const reduceMotion = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)');
  let drag = null;
  let animationFrame = 0;

  const isActive = () => currentScene().phoneView === 'home';
  const currentFrame = () => {
    const { width, height } = store.stageSize();
    return phoneFrame(width, height);
  };
  const updateOffset = (offset) => {
    store.homePageOffset = offset;
    applyHomePageTransform();
    applyElements();
    invalidate();
  };
  const commitPage = (pageIndex) => {
    store.homePageIndex = Math.max(0, Math.min(1, pageIndex));
    updateOffset(0);
    announce(`Home screen page ${store.homePageIndex + 1} of 2.`);
  };

  cancelHomePageAnimation = () => {
    if (animationFrame) cancelAnimationFrame(animationFrame);
    animationFrame = 0;
  };

  let panelAnimationFrame = 0;
  let panelAnimationToken = 0;
  const cancelPanelAnimation = () => {
    panelAnimationToken += 1;
    if (panelAnimationFrame) cancelAnimationFrame(panelAnimationFrame);
    panelAnimationFrame = 0;
  };
  const animateIslandPanel = (targetProgress, onDone) => {
    cancelPanelAnimation();
    const animationToken = panelAnimationToken;
    const startProgress = store.islandPanel.progress;
    const opening = targetProgress > startProgress;
    // Never reveal Home while opening or while the user's finger is still
    // dragging. It starts only once a close has been committed.
    setHomeReveal(0);
    if (reduceMotion?.matches || Math.abs(targetProgress - startProgress) < 0.01) {
      setHomeReveal(opening ? 0 : 1);
      setPanelProgress(targetProgress);
      onDone?.();
      return;
    }
    const startTime = performance.now();
    const duration = opening ? 360 : 280;
    const tick = (now) => {
      if (animationToken !== panelAnimationToken) return;
      const elapsed = Math.min(1, (now - startTime) / duration);
      // A slightly softer opening and a quicker close feel closer to the
      // springy sheet behavior of iOS than one generic ease for both ways.
      const eased = opening
        ? 1 - Math.pow(1 - elapsed, 4)
        : 1 - Math.pow(1 - elapsed, 3);
      // Leave the last part of the reveal for a short post-dismiss fade. This
      // makes the handoff to the restored Home glass visibly continuous.
      const reveal = opening ? 0 : eased * eased * (3 - 2 * eased) * 0.78;
      setHomeReveal(reveal);
      setPanelProgress(startProgress + (targetProgress - startProgress) * eased);
      if (elapsed < 1) panelAnimationFrame = requestAnimationFrame(tick);
      else {
        panelAnimationFrame = 0;
        onDone?.();
      }
    };
    panelAnimationFrame = requestAnimationFrame(tick);
  };
  // Both directions of the sheet animation, so a release always lands on one
  // of the two resting states instead of stopping wherever the finger did.
  const settlePanel = (open) => animateIslandPanel(open ? 1 : 0, () => {
    if (!open) closePanel();
  });

  const animateTo = (pageIndex) => {
    cancelHomePageAnimation();
    const targetPage = Math.max(0, Math.min(1, pageIndex));
    const pageWidth = currentFrame().screen.w;
    const startOffset = store.homePageOffset;
    const targetOffset = (store.homePageIndex - targetPage) * pageWidth;
    if (reduceMotion?.matches || Math.abs(targetOffset - startOffset) < 0.5) {
      commitPage(targetPage);
      return;
    }
    const startTime = performance.now();
    const duration = 280;
    const tick = (now) => {
      const elapsed = Math.min(1, (now - startTime) / duration);
      const eased = 1 - Math.pow(1 - elapsed, 3);
      updateOffset(startOffset + (targetOffset - startOffset) * eased);
      if (elapsed < 1) animationFrame = requestAnimationFrame(tick);
      else {
        animationFrame = 0;
        commitPage(targetPage);
      }
    };
    animationFrame = requestAnimationFrame(tick);
  };

  uiCanvas.addEventListener('pointerdown', (event) => {
    if (!isActive() || drag) return;
    const point = glass.pointerPosition(event);
    const frame = currentFrame();
    const onScreen = point.x >= frame.screen.x && point.x <= frame.screen.x + frame.screen.w
      && point.y >= frame.screen.y && point.y <= frame.screen.y + frame.screen.h;

    // A sheet that is already out: anywhere on the screen drags it back up.
    if (panelActive()) {
      if (!onScreen) return;
      event.preventDefault();
      cancelPanelAnimation();
      cancelHomeRevealAnimation();
      // Re-grabbing a sheet cancels the post-dismiss Home fade. While the
      // finger owns the panel, the two layers must never be shown together.
      setHomeReveal(0);
      drag = {
        mode: 'panel',
        pointerId: event.pointerId,
        startY: point.y,
        startProgress: store.islandPanel.progress,
        lastY: point.y,
        lastTime: performance.now(),
        velocityY: 0,
      };
      uiCanvas.setPointerCapture(event.pointerId);
      uiCanvas.style.cursor = 'grabbing';
      return;
    }

    // The whole status bar row is the handle, split at the middle of Dynamic
    // Island: pull down on the left for Notifications, on the right for
    // Control Centre, exactly like iOS.
    const inPullZone = onScreen && point.y <= frame.screen.y + 58 * frame.scale;
    if (inPullZone) {
      event.preventDefault();
      cancelHomePageAnimation();
      cancelPanelAnimation();
      const zone = point.x < frame.screen.x + frame.screen.w / 2 ? 'notification' : 'control-centre';
      drag = {
        mode: 'island',
        pointerId: event.pointerId,
        startX: point.x,
        startY: point.y,
        startProgress: store.islandPanel.progress,
        lastY: point.y,
        lastTime: performance.now(),
        velocityY: 0,
        zone,
      };
      openPanel(zone);
      uiCanvas.setPointerCapture(event.pointerId);
      uiCanvas.focus({ preventScroll: true });
      uiCanvas.style.cursor = 'grabbing';
      return;
    }
    const withinScreen = onScreen && point.y >= frame.screen.y + 58 * frame.scale
      && point.y <= frame.screen.y + 720 * frame.scale;
    if (!withinScreen) return;
    event.preventDefault();
    cancelHomePageAnimation();
    drag = {
      pointerId: event.pointerId,
      startX: point.x,
      startOffset: store.homePageOffset,
      lastX: point.x,
      lastTime: performance.now(),
      velocity: 0,
    };
    uiCanvas.setPointerCapture(event.pointerId);
    uiCanvas.focus({ preventScroll: true });
    uiCanvas.style.cursor = 'grabbing';
  });

  uiCanvas.addEventListener('pointermove', (event) => {
    if (!drag || event.pointerId !== drag.pointerId) return;
    event.preventDefault();
    const point = glass.pointerPosition(event);
    if (drag.mode === 'island' || drag.mode === 'panel') {
      uiCanvas.style.cursor = 'grabbing';
      if (drag.mode === 'panel' && store.homeReveal > 0) setHomeReveal(0);
      const now = performance.now();
      const elapsed = Math.max(1, now - drag.lastTime);
      const instantVelocity = (point.y - drag.lastY) / elapsed;
      drag.velocityY = drag.velocityY * 0.65 + instantVelocity * 0.35;
      drag.lastY = point.y;
      drag.lastTime = now;
      // The sheet translates in stage pixels, so using the screen height makes
      // the visible panel follow the finger at roughly 1:1 instead of racing
      // ahead by the old 852 / 260 ratio.
      const travel = Math.max(currentFrame().screen.h, 1);
      const dy = point.y - drag.startY;
      const rawProgress = (drag.startProgress ?? 0) + dy / travel;
      const dampedProgress = rawProgress > 1
        ? 1 + (rawProgress - 1) * 0.18
        : rawProgress;
      setPanelProgress(dampedProgress);
      return;
    }
    const now = performance.now();
    const elapsed = Math.max(1, now - drag.lastTime);
    drag.velocity = (point.x - drag.lastX) / elapsed;
    drag.lastX = point.x;
    drag.lastTime = now;
    const pageWidth = currentFrame().screen.w;
    let offset = drag.startOffset + point.x - drag.startX;
    if ((store.homePageIndex === 0 && offset > 0) || (store.homePageIndex === 1 && offset < 0)) {
      offset *= 0.28;
    }
    updateOffset(Math.max(-pageWidth * 1.12, Math.min(pageWidth * 1.12, offset)));
  });

  const endDrag = (event, cancelled = false) => {
    if (!drag || event.pointerId !== drag.pointerId) return;
    if (drag.mode === 'island' || drag.mode === 'panel') {
      const opening = drag.mode === 'island';
      const { type } = store.islandPanel;
      const { progress } = store.islandPanel;
      const flickedOpen = drag.velocityY > 0.45;
      const flickedShut = drag.velocityY < -0.45;
      const projectedProgress = progress + Math.max(-0.14, Math.min(0.14, drag.velocityY * 0.18));
      const open = cancelled ? !opening
        : flickedOpen ? true
          : flickedShut ? false
            : projectedProgress > (opening ? 0.34 : 0.58);
      drag = null;
      uiCanvas.style.cursor = 'grab';
      settlePanel(open);
      announce(open
        ? (type === 'notification' ? 'Notification Centre open.' : 'Control Centre open.')
        : 'Back to the Home Screen.');
      return;
    }
    const { velocity } = drag;
    drag = null;
    uiCanvas.style.cursor = 'grab';
    if (cancelled) {
      animateTo(store.homePageIndex);
      return;
    }
    const pageWidth = currentFrame().screen.w;
    const progress = store.homePageIndex - store.homePageOffset / pageWidth;
    const target = velocity < -0.45 ? Math.ceil(progress)
      : velocity > 0.45 ? Math.floor(progress)
        : Math.round(progress);
    animateTo(target);
  };
  uiCanvas.addEventListener('pointerup', (event) => endDrag(event, false));
  uiCanvas.addEventListener('pointercancel', (event) => endDrag(event, true));
  uiCanvas.addEventListener('keydown', (event) => {
    if (!isActive()) return;
    // The keyboard mirrors the gesture: down opens a sheet, up or Escape
    // dismisses it, and paging only works while nothing is covering Home.
    if (panelActive()) {
      if (!['ArrowUp', 'Escape'].includes(event.key)) return;
      event.preventDefault();
      settlePanel(false);
      announce('Back to the Home Screen.');
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      openPanel('notification');
      settlePanel(true);
      announce('Notification Centre open.');
      return;
    }
    if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    event.preventDefault();
    animateTo(store.homePageIndex + (event.key === 'ArrowRight' ? 1 : -1));
  });
}

attachHomePager();

for (const tip of document.querySelectorAll('[data-gesture-tip]')) {
  const id = tip.dataset.gestureTip;
  const dismiss = (event) => {
    event?.preventDefault();
    event?.stopPropagation();
    store.gestureTipVisibility.set(id, false);
    syncGestureTips();
  };
  const closeButton = tip.querySelector('.gestureTipClose');
  closeButton?.addEventListener('pointerdown', (event) => event.stopPropagation());
  closeButton?.addEventListener('click', dismiss);
  let hoverTimer = 0;
  tip.addEventListener('pointerenter', () => {
    hoverTimer = window.setTimeout(dismiss, 500);
  });
  tip.addEventListener('pointerleave', () => {
    window.clearTimeout(hoverTimer);
  });
}

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
  const phoneWallpaperEnabled = PHONE_WALLPAPER_SCENES.has(scene.id);
  $('sceneUpload').classList.toggle('phoneMode', phoneWallpaperEnabled);
  $('phoneWallpaperUpload').hidden = !phoneWallpaperEnabled;
  if (!phoneWallpaperEnabled) {
    phoneWallpaperStatus.textContent = 'Only for phone scenes';
  }
  syncPhoneWallpaperUI();
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
    ? (scene.phoneView === 'home'
      ? `${scene.name}. Swipe horizontally, or use the left and right arrow keys, to change home screen pages.`
      : `${scene.name}. Components are fixed; use the inspector to adjust material parameters.`)
    : 'Liquid glass stage. Drag a component, or select one and move it with the arrow keys.');
  uiCanvas.style.cursor = scene.phoneView === 'home' ? 'grab' : 'default';
  if (locked) store.selectedId = null;
  $('sceneCount').textContent = `${String(index + 1).padStart(2, '0')} / ${String(list.length).padStart(2, '0')}`;
  for (const card of scenePicker.querySelectorAll('[data-scene]')) {
    card.classList.toggle('active', card.dataset.scene === scene.id);
  }
  sceneStart = performance.now();
  syncToggleButtons();
  syncGestureTips();
}

sceneSelect.addEventListener('change', () => selectScene(sceneSelect.value));

// ------------------------------------------------------------- custom uploads
const customInput = $('customMedia');
const customStatus = $('customSceneStatus');
const phoneWallpaperInput = $('phoneWallpaper');
const phoneWallpaperStatus = $('phoneWallpaperStatus');
const phoneWallpaperPreset = $('phoneWallpaperPreset');

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
      layout: sceneById('alpine-lake').layout,
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

phoneWallpaperPreset.addEventListener('change', () => {
  const scene = currentScene();
  setPhoneWallpaper(scene, phoneWallpaperPreset.value);
});

phoneWallpaperInput.addEventListener('change', async () => {
  const [file] = phoneWallpaperInput.files || [];
  if (!file) return;
  if (!file.type.startsWith('image/')) {
    phoneWallpaperStatus.textContent = 'Choose an image file';
    phoneWallpaperInput.value = '';
    return;
  }

  phoneWallpaperStatus.textContent = 'Loading wallpaper…';
  let url;
  try {
    url = URL.createObjectURL(file);
    const source = await loadMedia(url, 'image');
    const targetScene = currentScene();
    if (!PHONE_WALLPAPER_SCENES.has(targetScene.id)) {
      URL.revokeObjectURL(url);
      phoneWallpaperStatus.textContent = 'Select a phone scene first';
      return;
    }
    const wallpaperId = `upload-${Date.now()}`;
    store.customPhoneWallpapers.set(wallpaperId, {
      id: wallpaperId,
      name: file.name,
      src: url,
      thumb: url,
    });
    images.set(url, source);
    setPhoneWallpaper(targetScene, wallpaperId, { announceChange: false });
    phoneWallpaperPreset.value = wallpaperId;
    phoneWallpaperStatus.textContent = `${file.name} · selected`;
    announce(`Custom wallpaper applied to ${targetScene.name}. It is now available in the wallpaper menu.`);
  } catch (error) {
    if (url) URL.revokeObjectURL(url);
    phoneWallpaperStatus.textContent = 'Could not load that image';
    console.warn('Phone wallpaper loading failed.', error);
  } finally {
    phoneWallpaperInput.value = '';
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
  for (const wallpaper of store.customPhoneWallpapers.values()) URL.revokeObjectURL(wallpaper.src);
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
