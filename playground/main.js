// Playground wiring.
//
// This page drives the published component through its public API - the same
// `LiquidGlassWebGL` an app would import - instead of reaching into the
// renderer. Anything awkward here is awkward for everyone, which is the point.

import {
  LiquidGlassWebGL, LiquidGlassWebGLV2, connectedElementGroups,
  makeMaterial,
} from '../src/index.js?frost-ratio=1';
import { getDefaultMaterialV2 } from '../src/v2-material.js?dispersion-default=2';
import {
  SCENES, PHONE_WALLPAPER_PRESETS, SCENE_WALLPAPER_PRESETS, ICON_SOURCES,
  attachIconImages, isAnimated, sceneById, panelLayout,
} from './scenes.js?phone-scenes=10';
import { drawSceneBackdrop } from './content.js?phone-scenes=8';
import {
  drawGlassContents, drawLabel, drawBadge, drawPressEffectsFrame,
  drawPressEffectsOverlay,
  drawPhoneSceneOverlay, drawPhonePanelOverlay,
} from './overlay.js?phone-scenes=8';
import { createInspector } from './inspector.js?dispersion-default=2';
import { createComponentEditor } from './components.js?phone-scenes=8';
import { attachStageInteractions } from './interactions.js?phone-scenes=8';
import { attachPressEffects } from './press-effects.js?phone-scenes=8';
import { createStats } from './stats.js';
import { decodeState, toCode, writeHash } from './permalink.js';
import { PHONE_ICON_SOURCES, attachPhoneIconImages, phoneFrame } from './phone.js?phone-scenes=8';
import { t, applyI18n, initPreferences, onLanguageChange } from './i18n.js';

const $ = (id) => document.getElementById(id);
const stage = $('stage');
const contentCanvas = $('content');
const scrimCanvas = $('scrim');
const baseGlCanvas = $('baseGl');
const glCanvas = $('gl');
const uiCanvas = $('ui');
const liveRegion = $('announcer');
const announce = (message) => { liveRegion.textContent = message; };

// Theme and language are applied before anything renders so the panel never
// flashes in the wrong preference.
initPreferences();

// ------------------------------------------------------------------ support
if (!LiquidGlassWebGL.isSupported()) {
  document.body.classList.add('unsupported');
  $('unsupported').hidden = false;
  announce(t('announce.webglUnavailable'));
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
  sceneId: sceneById(shared?.sceneId ?? 'home').id,
  material: materials[initialVersion],
  fusion: shared?.fusion ?? true,
  showIcons: shared?.showIcons ?? false,
  showLabels: shared?.showLabels ?? false,
  elements: [],
  selectedId: null,
  // Ephemeral interaction state is deliberately kept out of share links: it
  // changes every animation frame and never changes a component's authored
  // geometry. Slider resting positions are kept separately per control.
  press: null,
  sliderPositions: new Map([
    ['selection-track', 0],
    ['green-toggle-track', 0],
  ]),
  wallZoom: 1,
  movedElements: false,
  customPhoneWallpapers: new Map(),
  sceneWallpaperUploads: new Map(),
  phoneWallpaperSelections: new Map([['home', 'warm-fold']]),
  sceneWallpaperSelection: 'natural-lake',
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

function createGlass(targetCanvas = glCanvas) {
  const GlassClass = store.version === 'v2' ? LiquidGlassWebGLV2 : LiquidGlassWebGL;
  const options = {
    compositeMode: 'overlay',
    material: store.material,
    // The playground owns the frame loop and the layout, and the screenshot tools
    // read the drawing buffer back.
    autoResize: false,
    preserveDrawingBuffer: true,
    onContextLost: () => announce(t('announce.contextLost')),
    onContextRestored: () => announce(t('announce.contextRestored')),
  };
  if (store.version === 'v1') options.fusion = effectiveFusion();
  const instance = new GlassClass(targetCanvas, options);
  instance.setBackdrop(contentCanvas, { update: 'static', autoStart: false, shouldRender: false });
  return instance;
}

let glass = createGlass();
let baseGlass = createGlass(baseGlCanvas);

function applyMaterial() {
  glass.setMaterial(store.material, false);
  baseGlass.setMaterial(store.material, false);
}

const stats = createStats($('stats'));

// -------------------------------------------------------------------- scenes
const images = new Map();
const pending = new Set();

function currentScene() {
  return sceneById(store.sceneId);
}

function allScenes() {
  return SCENES;
}

const PHONE_WALLPAPER_SCENES = new Set(['home']);
const ORIGINAL_PHONE_BACKDROPS = new Map(
  SCENES.filter((scene) => PHONE_WALLPAPER_SCENES.has(scene.id))
    .map((scene) => [scene.id, { ...scene.backdrop }]),
);

function phoneWallpaperOptions(scene) {
  const original = ORIGINAL_PHONE_BACKDROPS.get(scene.id);
  const originalName = scene.id === 'home' ? 'Warm fold (scene default)' : 'Scene default';
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
    return scene.id === 'home' ? 'warm-fold' : 'scene-default';
  }
  const preset = PHONE_WALLPAPER_PRESETS.find((entry) => entry.src === scene.backdrop.src);
  if (preset) return preset.id;
  const custom = [...store.customPhoneWallpapers.values()].find((entry) => entry.src === scene.backdrop.src);
  return custom?.id ?? 'scene-default';
}

function sceneWallpaperOptions(scene) {
  if (scene.id !== 'scene') return [];
  return [...SCENE_WALLPAPER_PRESETS, ...store.sceneWallpaperUploads.values()];
}

function selectedSceneWallpaperId(scene) {
  if (scene.id !== 'scene') return null;
  const explicit = store.sceneWallpaperSelection;
  if (sceneWallpaperOptions(scene).some((entry) => entry.id === explicit)) return explicit;
  const current = sceneWallpaperOptions(scene).find((entry) => entry.src === scene.backdrop.src);
  return current?.id ?? SCENE_WALLPAPER_PRESETS[0].id;
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
    baseGlass.setBackdrop(contentCanvas, { update: mode, autoStart: false, shouldRender: false });
  }
  const video = scene.backdrop.type === 'video' ? scene.backdrop.source : null;
  for (const other of allScenes()) {
    const source = other.backdrop.type === 'video' ? other.backdrop.source : null;
    if (source && source !== video) source.pause();
  }
  if (video && video.paused) {
    video.play().catch(() => announce(t('announce.videoBlocked')));
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
  if (scene.interactionLab) {
    store.sliderPositions.set('selection-track', 0);
    store.sliderPositions.set('green-toggle-track', 0);
  }
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
  const resolvedScene = sceneById(id);
  const nextId = resolvedScene?.id ?? SCENES[0].id;
  const changed = store.sceneId !== nextId;
  cancelHomePageAnimation();
  cancelHomeRevealAnimation();
  store.press = null;
  store.islandPanel = { type: null, progress: 0 };
  store.homeReveal = 1;
  store.sceneId = nextId;
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
    ? t('status.sceneWallpaper')
    : t('status.wallpaperSelected', { name: selected?.name ?? 'Wallpaper' });
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
  if (announceChange) announce(t('announce.wallpaperApplied', { name: option.name, scene: scene.name }));
}

function syncSceneWallpaperUI() {
  const scene = currentScene();
  const enabled = scene.id === 'scene';
  $('sceneWallpaperUpload').hidden = !enabled;
  if (!enabled) return;

  const select = $('sceneWallpaperPreset');
  select.replaceChildren();
  for (const optionData of sceneWallpaperOptions(scene)) {
    const option = document.createElement('option');
    option.value = optionData.id;
    option.textContent = optionData.name;
    select.appendChild(option);
  }
  select.value = selectedSceneWallpaperId(scene);
  if (!select.value) select.value = SCENE_WALLPAPER_PRESETS[0].id;
  const selected = sceneWallpaperOptions(scene).find((option) => option.id === select.value);
  $('sceneWallpaperStatus').textContent = selected?.name ?? t('status.chooseWallpaper');
}

function setSceneWallpaper(scene, wallpaperId, { announceChange = true } = {}) {
  if (scene.id !== 'scene') return;
  const option = sceneWallpaperOptions(scene).find((entry) => entry.id === wallpaperId);
  if (!option) return;
  store.sceneWallpaperSelection = wallpaperId;
  scene.backdrop = {
    type: 'image',
    src: option.src,
    thumb: option.thumb ?? option.src,
  };
  ensureBackdropImage(scene);
  renderScenePicker();
  syncSceneWallpaperUI();
  syncBackdropMode();
  sceneStart = performance.now();
  invalidate({ content: true });
  queueHash();
  if (announceChange) announce(t('announce.wallpaperApplied', { name: option.name, scene: 'Scene' }));
}

// --------------------------------------------------------- island pull-down
//
// Notification Centre and Control Centre are not separate destinations any
// more: they are live sheets that slide over the Home Screen. While a sheet is
// on screen the home icons, widgets and dock are hidden, so the wallpaper (dim
// in proportion to the pull) is the only thing left behind the glass.

function panelActive() {
  return Boolean(store.islandPanel.type) && store.islandPanel.progress > 0;
}

/** How far the sheet still has to travel, in stage pixels, at this progress. */
function panelOffsetY(progress, frame) {
  return -(1 - progress) * frame.screen.h;
}

/** The full-screen liquid surface that carries the sheet's backdrop. */
function panelBaseElement() {
  const { type, progress } = store.islandPanel;
  if (!type) return null;
  const { width, height } = store.stageSize();
  const frame = phoneFrame(width, height);
  const offsetY = panelOffsetY(progress, frame);
  // Match the physical screen, including its radius, instead of relying on
  // the material's generic roundness ratio. This keeps the lower edge and the
  // outer corners flush with the phone mask at the fully-open resting state.
  return {
    id: `${type}-surface`, shape: 'rect', radius: frame.screen.r,
    x: frame.screen.x, y: frame.screen.y + offsetY,
    w: frame.screen.w, h: frame.screen.h,
    tint: 0.08, tintTone: 'auto', frost: 0.22,
  };
}

/**
 * Independent glass controls painted above the full-screen sheet. They sample
 * the already-rendered base surface, so cards and sliders retain their own
 * optical edge instead of flattening into the backdrop.
 */
function panelGlassElements() {
  const { type, progress } = store.islandPanel;
  if (!type) return [];
  const { width, height } = store.stageSize();
  const frame = phoneFrame(width, height);
  const offsetY = panelOffsetY(progress, frame);
  return panelLayout(type, width, height).map((element) => ({
    ...element,
    id: `${type}-${element.id}`,
    y: element.y + offsetY,
    // Panel controls use the neutral transparent material. The authored
    // notification tint is for the text treatment; keeping it off the glass
    // avoids a second opaque white veil over the full-screen surface.
    tint: 0.02,
    tintTone: 'auto',
    frost: 0.16,
  }));
}

function applyPanelElements() {
  const base = panelBaseElement();
  baseGlass.setElements(base ? [base] : [], false);
  glass.setElements(panelGlassElements(), false);
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
    baseGlCanvas.style.width = `${width}px`;
    baseGlCanvas.style.height = `${height}px`;
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
      drawPhoneSceneOverlay(uiContext, scene, glass.elements, width, height, store.version, {
        pageIndex: store.homePageIndex,
        pageOffset: store.homePageOffset,
      });
      return;
    }
    const frame = phoneFrame(width, height);
    uiContext.save();
    uiContext.globalAlpha = store.homeReveal;
    uiContext.translate(0, (1 - store.homeReveal) * 10 * frame.scale);
    drawPhoneSceneOverlay(uiContext, scene, glass.elements, width, height, store.version, {
      pageIndex: store.homePageIndex,
      pageOffset: store.homePageOffset,
    });
    uiContext.restore();
  };
  if (panelActive()) {
    const frame = phoneFrame(width, height);
    drawPhonePanelOverlay(uiContext, store.islandPanel.type,
      panelLayout(store.islandPanel.type, width, height),
      width, height, store.version, panelOffsetY(store.islandPanel.progress, frame));
  } else if (scene.phoneView) {
    drawHomeScene();
  } else {
    if (scene.interactionLab) {
      drawPressEffectsOverlay(
        uiContext,
        store.elements,
        glass.elements,
        store.sliderPositions,
        store.press,
        contentCanvas,
      );
      // The specimen always carries its own content; unlike the material
      // comparison scenes it should remain legible with "Glass only" active.
      for (const element of glass.elements) {
        if (element.id === 'hold-button' || element.id === 'hold-orb') drawGlassContents(uiContext, element);
      }
    } else {
      for (const element of glass.elements) {
        if (store.showIcons) drawGlassContents(uiContext, element);
        if (store.showLabels) { drawLabel(uiContext, element); drawBadge(uiContext, element); }
      }
    }
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

  // A pulling sheet is a two-pass composition: redraw the wallpaper, render
  // the full-screen base glass into the hidden buffer, composite that buffer
  // into the backdrop, then let the upper cards sample the result. Redrawing
  // the wallpaper for the active sheet avoids accumulating moved glass pixels
  // in the 2D canvas while the finger is travelling.
  if (contentDirty || size.resized || animating || panelActive()) {
    drawSceneBackdrop(contentContext, scene, {
      width: size.width,
      height: size.height,
      dpr: size.dpr,
      zoom: store.wallZoom,
      scroll: (now - sceneStart) * 0.055,
      image: backdropSourceFor(scene),
    });
    if (scene.interactionLab) {
      drawPressEffectsFrame(contentContext, store.elements, store.sliderPositions);
      // First pass: render the Home/Discover glass into the backdrop. The
      // moving selector is then a true second glass layer and samples the
      // already-rendered pixels beneath it instead of the original wallpaper.
      baseGlass.updateBackdrop(false);
      baseGlass.render({ force: true });
      contentContext.drawImage(baseGlCanvas, 0, 0, size.width, size.height);
      glass.updateBackdrop(false);
    } else if (panelActive()) {
      baseGlass.updateBackdrop(false);
      baseGlass.render({ force: true });
      // baseGl is a full-stage buffer, so apply the same physical screen mask
      // when compositing it. Without this second clip the hidden pass can
      // bleed beyond the phone bezel even though the visible gl canvas is
      // clipped correctly by CSS.
      const frame = phoneFrame(size.width, size.height);
      contentContext.save();
      contentContext.beginPath();
      contentContext.roundRect(
        frame.screen.x, frame.screen.y,
        frame.screen.w, frame.screen.h, frame.screen.r,
      );
      contentContext.clip();
      contentContext.drawImage(baseGlCanvas, 0, 0, size.width, size.height);
      contentContext.restore();
      glass.updateBackdrop(false);
    } else if (!animating) glass.updateBackdrop(false);
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

// Elements are authored as plain objects. While held, a presentation copy is
// inflated around its centre before it reaches WebGL; releasing it restores
// the untouched authored geometry through a spring in press-effects.js.
function presentationElements() {
  const byId = new Map(store.elements.map((element) => [element.id, element]));
  const press = store.press;
  return store.elements.filter((element) => !element.nonGlass).map((element) => {
    let next = { ...element };
    const track = element.sliderTrack ? byId.get(element.sliderTrack) : null;
    if (track) {
      const progress = store.sliderPositions.get(track.id) ?? 0;
      const travel = Math.max(0, track.w - element.w - track.h * 0.16);
      next.x = track.x + track.h * 0.08 + travel * progress;
      next.y = track.y + track.h * 0.08;
    }
    if (!press || press.id !== element.id) return next;
    const amount = Math.min(1, press.amount);
    // The selector is intentionally much more elastic: at full hold it grows
    // to one-and-a-third horizontally. Vertically it doubles, which makes the
    // capsule clear the track by roughly one-third of the track height above
    // and below, matching the reference interaction.
    const scaleX = press.type === 'slider' ? 1 + amount * 0.33 : 1 + amount * 0.075;
    const scaleY = press.type === 'slider' ? 1 + amount : 1 + amount * 0.075;
    const w = next.w * scaleX;
    const h = next.h * scaleY;
    const centredX = next.x - (w - next.w) / 2;
    let x = centredX;
    // The reference control lets the selected glass travel a little beyond
    // the coloured/tinted track at the active end. That outward overtravel is
    // what keeps the two edges visually separate. An inward inset did the
    // opposite and also shortened the apparent drag range.
    if (press.type === 'slider' && track) {
      const edgeOvertravel = Math.max(18, track.h * 0.42);
      const progress = store.sliderPositions.get(track.id) ?? 0;
      const leftX = track.x - edgeOvertravel;
      const rightX = track.x + track.w + edgeOvertravel - w;
      const anchoredX = leftX + (rightX - leftX) * progress;
      // Blend into the endpoint correction with the press spring so the
      // capsule never jumps sideways on pointer-down or release.
      x = centredX + (anchoredX - centredX) * amount;
    }
    // Tint is part of the actual V2 material pass, not an overlay painted on
    // top of it. Existing authored tints (for example the white message card)
    // are preserved and briefly pushed toward the light material on press.
    const authoredTint = Number(next.tint ?? store.material.tint ?? 0);
    const authoredFrost = Number(next.frost ?? store.material.frost ?? 0);
    // Slider thumbs start as gray frosted glass and shed all tint while held.
    // Standalone glass controls keep the subtler light-tint bloom.
    const pressedTint = press.type === 'slider' ? 0 : Math.max(authoredTint, 0.34);
    const pressedFrost = press.type === 'slider'
      ? Number(store.material.frost ?? 0)
      : authoredFrost;
    // Press-in follows the elastic scale. Release material is deliberately
    // independent: Apple restores tint in a short, linear fade while the
    // geometry is still completing its spring return.
    const materialAmount = press.type === 'slider' && press.target === 0
      ? 1 - Math.min(1, Math.max(0, press.releaseMix ?? 0))
      : amount;
    const releaseOpacity = press.type === 'slider' && press.target === 0
      ? 1 - Math.min(1, Math.max(0, press.releaseMix ?? 0))
      : 1;
    return {
      ...next,
      x, y: next.y - (h - next.h) / 2, w, h,
      tint: authoredTint + (pressedTint - authoredTint) * materialAmount,
      frost: authoredFrost + (pressedFrost - authoredFrost) * materialAmount,
      opacity: Number(next.opacity ?? 1) * releaseOpacity,
      tintTone: press.type === 'slider' ? next.tintTone : 'light',
    };
  });
}

function applyElements() {
  const presented = presentationElements();
  if (currentScene().interactionLab) {
    baseGlass.setElements(presented.filter((element) => element.id === 'selection-track'), false);
    // Resting slider thumbs are inexpensive 2D frosted controls. Only the
    // thumb currently being held enters the liquid-glass pass.
    const activeSliderId = store.press?.type === 'slider' ? store.press.id : null;
    glass.setElements(presented.filter((element) => (
      element.id !== 'selection-track'
      && (!element.sliderTrack || element.id === activeSliderId)
    )), false);
  } else {
    baseGlass.setElements([], false);
    glass.setElements(presented, false);
  }
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
      applyMaterial();
      syncPresetButtons(null);
      queueHash();
      invalidate();
    },
  });
  // The freshly built rows start from the English fallbacks; re-apply the
  // active language immediately.
  applyI18n($('sliders'));
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

// Fixed phone layouts are still selectable. Their regular editor remains
// locked, but the glass itself gets the same held-state feedback as the
// dedicated specimen. The capture listener in this controller runs before the
// pager, so a press on a glass component does not accidentally page Home.
attachPressEffects({
  canvas: uiCanvas,
  getGlass: () => glass,
  getElements: () => store.elements,
  getFallbackElement: ({ x, y }) => {
    const scene = currentScene();
    if (!scene.interactionLab) return null;
    return store.elements.find((element) => element.sliderThumb
      && x >= element.x && x <= element.x + element.w
      && y >= element.y && y <= element.y + element.h) ?? null;
  },
  getSliderProgress: (trackId) => store.sliderPositions.get(trackId) ?? 0,
  isActive: () => Boolean(currentScene().lockedComponents),
  onSelect: (id) => {
    store.selectedId = id;
    onSceneChange('select');
  },
  onVisualChange: (press) => {
    const previousTrack = store.press?.sliderTrackId;
    store.press = press;
    if (press?.type === 'slider' && press.sliderTrackId
      && Number.isFinite(press.sliderProgress)) {
      store.sliderPositions.set(press.sliderTrackId, press.sliderProgress);
    }
    applyElements();
    const changedBackdrop = (press?.sliderTrackId ?? previousTrack) === 'green-toggle-track';
    invalidate({ content: changedBackdrop });
  },
  announce,
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
    announce(t('announce.page', { page: store.homePageIndex + 1 }));
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
        ? t(type === 'notification' ? 'announce.notifOpen' : 'announce.controlOpen')
        : t('announce.backHome'));
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
      announce(t('announce.backHome'));
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      openPanel('notification');
      settlePanel(true);
      announce(t('announce.notifOpen'));
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
    applyMaterial();
    inspector.sync();
    syncPresetButtons(button.dataset.preset);
    queueHash();
    invalidate();
  });
}

$('resetMaterial').addEventListener('click', () => {
  const defaults = store.version === 'v2' ? getDefaultMaterialV2() : makeMaterial('regular');
  Object.assign(store.material, defaults);
  applyMaterial();
  inspector.sync();
  syncPresetButtons(store.version === 'v1' ? 'regular' : null);
  announce(t('announce.reset', { version: store.version.toUpperCase() }));
  queueHash();
  invalidate();
});

function syncVersionUI() {
  const isV2 = store.version === 'v2';
  const locked = Boolean(currentScene().lockedComponents);
  for (const button of document.querySelectorAll('[data-renderer-version]')) {
    button.classList.toggle('active', button.dataset.rendererVersion === store.version);
  }
  $('rendererVersion').textContent = t(isV2 ? 'meta.v2' : 'meta.v1');
  $('materialVersion').textContent = t(isV2 ? 'meta.v2params' : 'meta.v1params');
  $('versionNote').textContent = t(isV2 ? 'note.v2' : 'note.v1');
  $('hudVersion').textContent = isV2 ? 'LIQUID GLASS / V2 TRANSPARENT' : 'LIQUID GLASS / V1 ORIGINAL';
  $('materialTip').textContent = locked
    ? t('tip.locked')
    : t(isV2 ? 'tip.v2' : 'tip.v1');
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
  baseGlass.destroy();
  store.version = version;
  store.material = store.materials[version];
  glass = createGlass();
  baseGlass = createGlass(baseGlCanvas);
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
  if (announceChange) announce(t('announce.switched', { version: t(version === 'v2' ? 'meta.v2' : 'meta.v1') }));
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
    applyMaterial();
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
  const interactionLab = Boolean(scene.interactionLab);
  $('hudKind').textContent = interactionLab ? t('hud.interaction', { kind: scene.kind })
    : locked ? t('hud.locked', { kind: scene.kind })
    : t('hud.free', { kind: scene.kind });
  $('componentSection').hidden = locked;
  const phoneWallpaperEnabled = PHONE_WALLPAPER_SCENES.has(scene.id);
  const sceneWallpaperEnabled = scene.id === 'scene';
  $('sceneUpload').classList.toggle('phoneMode', phoneWallpaperEnabled || sceneWallpaperEnabled);
  $('phoneWallpaperUpload').hidden = !phoneWallpaperEnabled;
  if (!phoneWallpaperEnabled) {
    phoneWallpaperStatus.textContent = t('status.onlyPhoneScenes');
  }
  $('sceneWallpaperUpload').hidden = !sceneWallpaperEnabled;
  if (!sceneWallpaperEnabled) {
    $('sceneWallpaperStatus').textContent = t('status.selectSceneForWallpaper');
  }
  syncPhoneWallpaperUI();
  syncSceneWallpaperUI();
  $('viewSection').hidden = locked;
  $('stageHud').hidden = locked && !interactionLab;
  $('keyboardHelp').hidden = locked;
  $('materialTip').textContent = interactionLab
    ? t('tip.interaction')
    : locked
      ? t('tip.locked')
    : t(store.version === 'v2' ? 'tip.v2' : 'tip.v1');
  $('debugSection').hidden = store.version === 'v2' || locked;
  uiCanvas.setAttribute('aria-label', interactionLab
    ? t('aria.stageInteraction')
    : locked
      ? t(scene.phoneView === 'home' ? 'aria.stageLockedHome' : 'aria.stageLocked', { name: scene.name })
    : t('aria.stage'));
  uiCanvas.style.cursor = scene.phoneView === 'home' ? 'grab' : interactionLab ? 'pointer' : 'default';
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

// ------------------------------------------------------------- wallpaper uploads
const sceneWallpaperInput = $('sceneWallpaper');
const sceneWallpaperStatus = $('sceneWallpaperStatus');
const sceneWallpaperPreset = $('sceneWallpaperPreset');
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
    reject(new Error('Only image wallpapers are supported.'));
  });
}

sceneWallpaperPreset.addEventListener('change', () => {
  const scene = currentScene();
  setSceneWallpaper(scene, sceneWallpaperPreset.value);
});

sceneWallpaperInput.addEventListener('change', async () => {
  const [file] = sceneWallpaperInput.files || [];
  if (!file) return;
  if (!file.type.startsWith('image/')) {
    sceneWallpaperStatus.textContent = t('status.chooseImage');
    sceneWallpaperInput.value = '';
    return;
  }
  sceneWallpaperStatus.textContent = t('status.loading');
  let url;
  try {
    url = URL.createObjectURL(file);
    const source = await loadMedia(url, 'image');
    const targetScene = currentScene();
    if (targetScene.id !== 'scene') {
      URL.revokeObjectURL(url);
      sceneWallpaperStatus.textContent = t('status.selectSceneFirst');
      return;
    }
    const wallpaperId = `scene-upload-${Date.now()}`;
    store.sceneWallpaperUploads.set(wallpaperId, {
      id: wallpaperId,
      name: file.name,
      src: url,
      thumb: url,
    });
    images.set(url, source);
    setSceneWallpaper(targetScene, wallpaperId, { announceChange: false });
    sceneWallpaperPreset.value = wallpaperId;
    sceneWallpaperStatus.textContent = t('status.fileSelected', { name: file.name });
    announce(t('announce.customWallpaper', { scene: 'Scene' }));
  } catch (error) {
    if (url) URL.revokeObjectURL(url);
    sceneWallpaperStatus.textContent = t('status.loadFailed');
    console.warn('Scene wallpaper loading failed.', error);
  } finally {
    sceneWallpaperInput.value = '';
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
    phoneWallpaperStatus.textContent = t('status.chooseImage');
    phoneWallpaperInput.value = '';
    return;
  }

  phoneWallpaperStatus.textContent = t('status.loading');
  let url;
  try {
    url = URL.createObjectURL(file);
    const source = await loadMedia(url, 'image');
    const targetScene = currentScene();
    if (!PHONE_WALLPAPER_SCENES.has(targetScene.id)) {
      URL.revokeObjectURL(url);
      phoneWallpaperStatus.textContent = t('status.choosePhoneScene');
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
    phoneWallpaperStatus.textContent = t('status.fileSelected', { name: file.name });
    announce(t('announce.customWallpaper', { scene: targetScene.name }));
  } catch (error) {
    if (url) URL.revokeObjectURL(url);
    phoneWallpaperStatus.textContent = t('status.loadFailed');
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
    announce(t('announce.clipboardBlocked'));
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
  if (await copy(url, t('announce.shareCopied'))) flash(button, t('action.linkCopied'));
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
  if (await copy(code, t('announce.codeCopied'))) flash(button, t('action.codeCopied'));
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
  for (const wallpaper of store.customPhoneWallpapers.values()) URL.revokeObjectURL(wallpaper.src);
  for (const wallpaper of store.sceneWallpaperUploads.values()) URL.revokeObjectURL(wallpaper.src);
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

// Dynamic copy (HUD, tips, statuses) follows the language switch.
onLanguageChange(() => {
  syncVersionUI();
  syncSceneUI();
  componentEditor.render();
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
    applyMaterial();
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
    applyMaterial();
    applyElements();
    inspector.sync();
    componentEditor.render();
    invalidate({ content: true });
  },
};
