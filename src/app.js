import { GlassRenderer } from './renderer.js';
import { makeMaterial, PRESETS, SLIDERS } from './material.js';
import { drawGlassContents, drawLabel, drawBadge } from './overlay.js';

const glCanvas = document.getElementById('gl');
const uiCanvas = document.getElementById('ui');
const stage = document.getElementById('stage');
const ctx = uiCanvas.getContext('2d');
const renderer = new GlassRenderer(glCanvas);

const I = {
  youtube: () => ({ name: 'YouTube', src: './assets/icons/youtube.svg', c0: '#f7f8fb', c1: '#d9dde7' }),
  spotify: () => ({ name: 'Spotify', src: './assets/icons/spotify.svg', c0: '#e8f8ed', c1: '#b9e8c8' }),
  whatsapp: () => ({ name: 'WhatsApp', src: './assets/icons/whatsapp.svg', c0: '#e3f8ec', c1: '#b9ebce' }),
  notion: () => ({ name: 'Notion', src: './assets/icons/notion.svg', c0: '#2c3039', c1: '#15171d' }),
  figma: () => ({ name: 'Figma', src: './assets/icons/figma.svg', c0: '#fff1ea', c1: '#ffd9c9' }),
  github: () => ({ name: 'GitHub', src: './assets/icons/github.svg', c0: '#3a404c', c1: '#181b22' }),
  photos: () => ({ name: 'Google Photos', src: './assets/icons/google-photos.svg', c0: '#edf5ff', c1: '#d2e6ff' }),
};

// The same shape set is used on every wallpaper so geometry and material can
// be compared without scene-specific layout becoming a variable.
const SHAPE_SET = [
  { shape: 'folder', fx: 0.19, fy: 0.49, size: 0.20, label: 'Folder',
    icons: [I.youtube(), I.spotify(), I.whatsapp(), I.notion()] },
  { shape: 'rect', fx: 0.47, fy: 0.52, width: 0.24, height: 0.18,
    label: 'Rect',
    icons: [I.figma(), I.github(), I.photos(), I.spotify()] },
  { shape: 'pill', fx: 0.68, fy: 0.48, width: 0.22, height: 0.12,
    label: 'Pill', content: 'Continue' },
  { shape: 'circle', fx: 0.37, fy: 0.37, size: 0.13,
    label: 'Circle', content: '+' },
];

// Layout in fractions of the stage. `size` is square; width/height define a
// rectangular folder or pill while their SDF rules remain shape-specific.
const WALLPAPER_FILES = [
  './assets/wallpapers/natural-lake.png',
  './assets/wallpapers/abstract-lines.png',
  './assets/wallpapers/color-blocks.png',
  './assets/wallpapers/night-city.png',
];

const SCENES = [
  {
    name: 'Alpine Lake', kind: 'Natural landscape', wallpaper: 0,
    folders: SHAPE_SET,
  },
  {
    name: 'Flow Lines', kind: 'Abstract lines', wallpaper: 1,
    folders: SHAPE_SET,
  },
  {
    name: 'Color Blocks', kind: 'Color blocks', wallpaper: 2,
    folders: SHAPE_SET,
  },
  {
    name: 'Rainy City', kind: 'Night city', wallpaper: 3,
    folders: SHAPE_SET,
  },
];

const state = {
  scene: 0,
  material: makeMaterial('regular'),
  showIcons: false,
  showLabels: false,
  fusion: true,
  wallZoom: 1,
  folders: [],
  dragging: null,
  wallpaperImages: [],
  customScene: null,
  customObjectUrl: null,
};

function scenes() {
  return state.customScene ? [...SCENES, state.customScene] : SCENES;
}

function currentScene() {
  return scenes()[state.scene] || SCENES[0];
}

function layout() {
  const w = stage.clientWidth;
  const h = stage.clientHeight;
  const sc = currentScene();
  state.folders = sc.folders.map((f) => {
    const fw = (f.width ?? f.size) * w;
    const fh = (f.height ?? f.size) * w;
    return {
      shape: 'folder', ...f,
      w: fw, h: fh,
      x: f.fx * w - fw / 2,
      y: f.fy * h - fh / 2,
    };
  });
}

function radiusFor(f) {
  const short = Math.min(f.w, f.h);
  if (f.shape === 'pill' || f.shape === 'circle') return short / 2;
  // Both folder variants use the same fixed corner at ~23.5% of the short side.
  return Math.min(state.material.radius, short * 0.235);
}

function render() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = stage.clientWidth;
  const h = stage.clientHeight;
  renderer.resize(Math.round(w * dpr), Math.round(h * dpr));
  glCanvas.style.width = w + 'px';
  glCanvas.style.height = h + 'px';
  uiCanvas.width = Math.round(w * dpr);
  uiCanvas.height = Math.round(h * dpr);
  uiCanvas.style.width = w + 'px';
  uiCanvas.style.height = h + 'px';

  renderer.buildBackdrop(currentScene().wallpaper, state.wallZoom);
  renderer.drawBackdrop();
  if (state.fusion) {
    renderer.drawGlassGroup(state.folders, state.material, dpr);
  } else {
    for (const f of state.folders) {
      renderer.drawGlass(f, { ...state.material, radius: radiusFor(f) }, dpr);
    }
  }

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  for (const f of state.folders) {
    if (state.showIcons) drawGlassContents(ctx, f);
    if (state.showLabels) { drawLabel(ctx, f); drawBadge(ctx, f); }
  }
}

let queued = false;
function invalidate() {
  if (queued) return;
  queued = true;
  requestAnimationFrame(() => { queued = false; render(); });
}

// ---------------------------------------------------------------- controls
const panel = document.getElementById('sliders');
const inputs = {};
const SLIDER_GROUPS = {
  geometry: new Set(['radius', 'squircle', 'mergeRadius', 'bevel', 'height']),
  optics: new Set(['ior', 'dispersion', 'refractScale', 'meniscus', 'blurPlateau', 'blurRim', 'opticalDensity']),
  lighting: new Set(['specular', 'specPower', 'highlightAdapt', 'highlightWidth', 'highlightSharpness', 'highlightBase', 'fresnel', 'saturation', 'brightness', 'tintAmount']),
  edge: new Set(['shadow', 'shadowSize', 'shadowOffset', 'lightX', 'lightY', 'edgeLine', 'edgeWidth', 'edgeDark']),
};
const SLIDER_LABELS = {
  radius: 'Corner radius', squircle: 'Corner shape', mergeRadius: 'Fusion distance', bevel: 'Bevel width', height: 'Optical height',
  ior: 'Index of refraction', dispersion: 'Chromatic spread', refractScale: 'Refraction scale',
  meniscus: 'Meniscus curve', blurPlateau: 'Plateau blur', blurRim: 'Rim blur', opticalDensity: 'Optical density',
  specular: 'Specular', specPower: 'Specular power', highlightAdapt: 'Light adaptation',
  highlightWidth: 'Highlight width', highlightSharpness: 'Highlight sharpness', highlightBase: 'Highlight base',
  fresnel: 'Fresnel', saturation: 'Saturation', brightness: 'Brightness', tintAmount: 'Tint amount',
  shadow: 'Shadow', shadowSize: 'Shadow size', shadowOffset: 'Shadow offset', lightX: 'Light X', lightY: 'Light Y',
  edgeLine: 'Edge highlight', edgeWidth: 'Edge width', edgeDark: 'Edge contrast',
};
const sliderGroups = {};
Object.entries(SLIDER_GROUPS).forEach(([key]) => {
  const group = document.createElement('details');
  group.className = 'sliderGroup';
  group.open = key === 'geometry' || key === 'optics';
  group.innerHTML = `<summary>${key}<span></span></summary><div class="sliderRows"></div>`;
  panel.appendChild(group);
  sliderGroups[key] = group.querySelector('.sliderRows');
});
for (const [key, min, max, step] of SLIDERS) {
  const row = document.createElement('label');
  row.className = 'row';
  const groupKey = Object.entries(SLIDER_GROUPS).find(([, keys]) => keys.has(key))?.[0] || 'geometry';
  row.innerHTML = `<span title="${key}">${SLIDER_LABELS[key] || key}</span><input aria-label="${SLIDER_LABELS[key] || key}" type="range" min="${min}" max="${max}" step="${step}"><b></b>`;
  const input = row.querySelector('input');
  const out = row.querySelector('b');
  input.value = state.material[key];
  out.textContent = (+state.material[key]).toFixed(2);
  input.addEventListener('input', () => {
    state.material[key] = parseFloat(input.value);
    out.textContent = parseFloat(input.value).toFixed(2);
    invalidate();
  });
  inputs[key] = { input, out };
  sliderGroups[groupKey].appendChild(row);
}

function syncSliders() {
  for (const [key] of SLIDERS) {
    inputs[key].input.value = state.material[key];
    inputs[key].out.textContent = (+state.material[key]).toFixed(2);
  }
}

function syncPresetButtons(active) {
  document.querySelectorAll('[data-preset]').forEach((button) => {
    button.classList.toggle('active', button.dataset.preset === active);
  });
}

document.querySelectorAll('[data-preset]').forEach((b) => {
  b.addEventListener('click', () => {
    state.material = makeMaterial(b.dataset.preset);
    syncSliders();
    syncPresetButtons(b.dataset.preset);
    invalidate();
  });
});

function syncDebugButtons() {
  document.querySelectorAll('[data-debug]').forEach((button) => {
    button.classList.toggle('active', +button.dataset.debug === state.material.debug);
  });
}

document.querySelectorAll('[data-debug]').forEach((b) => {
  b.addEventListener('click', () => {
    state.material.debug = +b.dataset.debug;
    syncDebugButtons();
    invalidate();
  });
});

const sceneSel = document.getElementById('scene');
const sceneKind = document.getElementById('sceneKind');
const hudScene = document.getElementById('hudScene');
const hudKind = document.getElementById('hudKind');
const sceneCount = document.getElementById('sceneCount');
const scenePicker = document.getElementById('scenePicker');
const customMediaInput = document.getElementById('customMedia');
const customSceneStatus = document.getElementById('customSceneStatus');
let backdropSetKey = '';
let liveMediaSource = null;
let liveMediaFrame = 0;
let liveMediaFrameKind = '';

function stopLiveMedia() {
  if (liveMediaFrame) {
    if (liveMediaFrameKind === 'video' && liveMediaSource?.cancelVideoFrameCallback) {
      liveMediaSource.cancelVideoFrameCallback(liveMediaFrame);
    } else {
      cancelAnimationFrame(liveMediaFrame);
    }
  }
  liveMediaFrame = 0;
  liveMediaFrameKind = '';
  liveMediaSource?.pause?.();
  liveMediaSource = null;
}

function scheduleLiveMediaFrame(video) {
  if (liveMediaSource !== video || !currentScene().custom || currentScene().source !== video) return;
  const draw = () => {
    liveMediaFrame = 0;
    if (liveMediaSource !== video || document.hidden) return;
    render();
    scheduleLiveMediaFrame(video);
  };
  if (typeof video.requestVideoFrameCallback === 'function') {
    liveMediaFrameKind = 'video';
    liveMediaFrame = video.requestVideoFrameCallback(draw);
  } else {
    liveMediaFrameKind = 'animation';
    liveMediaFrame = requestAnimationFrame(draw);
  }
}

function startLiveMedia(video) {
  if (liveMediaSource === video && liveMediaFrame) return;
  stopLiveMedia();
  liveMediaSource = video;
  video.play()
    .then(() => {
      if (liveMediaSource !== video) return;
      customSceneStatus.textContent = 'Looping video · live';
      scheduleLiveMediaFrame(video);
    })
    .catch((error) => {
      customSceneStatus.textContent = 'Video ready · select scene to play';
      console.warn('Custom video autoplay was blocked.', error);
    });
}

function syncBackdropForScene() {
  const scene = currentScene();
  if (scene.custom) {
    const update = scene.mediaType === 'video' ? 'live' : 'static';
    const nextKey = `custom:${state.customObjectUrl}`;
    if (backdropSetKey !== nextKey) {
      renderer.setWallpapers([scene.source], { update });
      backdropSetKey = nextKey;
    }
    scene.wallpaper = 0;
    if (scene.mediaType === 'video') startLiveMedia(scene.source);
    else stopLiveMedia();
    return;
  }

  stopLiveMedia();
  if (state.wallpaperImages.length && backdropSetKey !== 'builtins') {
    renderer.setWallpapers(state.wallpaperImages);
    backdropSetKey = 'builtins';
  }
}

function selectScene(index) {
  state.scene = Math.max(0, Math.min(index, scenes().length - 1));
  sceneSel.value = state.scene;
  syncSceneUI();
  syncBackdropForScene();
  layout();
  invalidate();
}

function renderScenePicker() {
  scenePicker.replaceChildren();
  scenes().forEach((scene, i) => {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'sceneCard';
    card.dataset.scene = i;
    const imageSource = scene.custom ? scene.previewUrl : WALLPAPER_FILES[i];
    if (imageSource) card.style.setProperty('--scene-image', `url("${imageSource}")`);
    card.innerHTML = `<span>${scene.name}</span><small>${scene.kind}</small>`;
    card.addEventListener('click', () => selectScene(i));
    scenePicker.appendChild(card);
  });
}

function syncSceneOptions() {
  sceneSel.replaceChildren();
  scenes().forEach((scene, i) => {
    const option = document.createElement('option');
    option.value = i;
    option.textContent = scene.name;
    sceneSel.appendChild(option);
  });
  sceneSel.value = state.scene;
}

function syncScenePicker() {
  scenePicker.querySelectorAll('[data-scene]').forEach((button) => {
    button.classList.toggle('active', +button.dataset.scene === state.scene);
  });
}
function syncSceneUI() {
  const scene = currentScene();
  sceneKind.textContent = scene.kind;
  hudScene.textContent = scene.name;
  hudKind.textContent = `${scene.kind} / drag the shapes together and apart`;
  sceneCount.textContent = `${String(state.scene + 1).padStart(2, '0')} / ${String(scenes().length).padStart(2, '0')}`;
  syncScenePicker();
}
sceneSel.addEventListener('change', () => {
  selectScene(+sceneSel.value);
});

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

function loadVideo(src) {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.muted = true;
    video.loop = true;
    video.playsInline = true;
    video.preload = 'auto';
    video.onloadeddata = () => resolve(video);
    video.onerror = () => reject(new Error('The browser could not decode this video.'));
    video.src = src;
    video.load();
  });
}

function makeVideoPreview(video) {
  const canvas = document.createElement('canvas');
  const scale = Math.min(1, 360 / Math.max(video.videoWidth, 1));
  canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
  canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
  canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.82);
}

Promise.all(WALLPAPER_FILES.map(loadImage))
  .then((images) => {
    state.wallpaperImages = images;
    backdropSetKey = '';
    syncBackdropForScene();
    document.body.classList.add('wallpapers-ready');
    invalidate();
  })
  .catch((error) => console.warn('Wallpaper loading failed; using procedural fallback.', error));

customMediaInput.addEventListener('change', async () => {
  const [file] = customMediaInput.files || [];
  if (!file) return;
  const mediaType = file.type.startsWith('video/') ? 'video'
    : file.type.startsWith('image/') ? 'image' : '';
  if (!mediaType) {
    customSceneStatus.textContent = 'Choose an image or video file';
    customMediaInput.value = '';
    return;
  }
  customSceneStatus.textContent = mediaType === 'video' ? 'Loading video…' : 'Loading image…';
  let objectUrl;
  let source;
  try {
    objectUrl = URL.createObjectURL(file);
    source = mediaType === 'video' ? await loadVideo(objectUrl) : await loadImage(objectUrl);
    const previousObjectUrl = state.customObjectUrl;
    stopLiveMedia();
    state.customObjectUrl = objectUrl;
    state.customScene = {
      name: file.name.replace(/\.[^/.]+$/, '') || `Custom ${mediaType}`,
      kind: mediaType === 'video' ? 'Dynamic video' : 'Custom image',
      wallpaper: 0,
      folders: SHAPE_SET,
      custom: true,
      mediaType,
      source,
      previewUrl: mediaType === 'video' ? makeVideoPreview(source) : objectUrl,
    };
    backdropSetKey = '';
    if (previousObjectUrl) URL.revokeObjectURL(previousObjectUrl);
    renderScenePicker();
    syncSceneOptions();
    selectScene(scenes().length - 1);
    if (mediaType === 'image') customSceneStatus.textContent = 'Local image ready';
  } catch (error) {
    source?.pause?.();
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    customSceneStatus.textContent = `Could not load that ${mediaType || 'file'}`;
    console.warn('Custom scene loading failed.', error);
  } finally {
    customMediaInput.value = '';
  }
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden) stopLiveMedia();
  else syncBackdropForScene();
});

window.addEventListener('beforeunload', () => {
  stopLiveMedia();
  if (state.customObjectUrl) URL.revokeObjectURL(state.customObjectUrl);
});

renderScenePicker();
syncSceneOptions();

const iconSources = [...new Set(SHAPE_SET.flatMap((folder) => folder.icons || []).map((icon) => icon.src))];
Promise.all(iconSources.map(loadImage))
  .then((images) => {
    SHAPE_SET.flatMap((folder) => folder.icons || []).forEach((icon) => {
      icon.image = images[iconSources.indexOf(icon.src)];
    });
    invalidate();
  })
  .catch((error) => console.warn('App icon loading failed; using fallback glyphs.', error));

function syncViewButtons() {
  document.querySelectorAll('[data-icon-mode]').forEach((button) => {
    button.classList.toggle('active', (button.dataset.iconMode === 'on') === state.showIcons);
  });
  document.querySelectorAll('[data-label-mode]').forEach((button) => {
    button.classList.toggle('active', (button.dataset.labelMode === 'on') === state.showLabels);
  });
  document.querySelectorAll('[data-fusion-mode]').forEach((button) => {
    button.classList.toggle('active', (button.dataset.fusionMode === 'on') === state.fusion);
  });
}
document.querySelectorAll('[data-icon-mode]').forEach((button) => {
  button.addEventListener('click', () => {
    state.showIcons = button.dataset.iconMode === 'on';
    syncViewButtons();
    invalidate();
  });
});
document.querySelectorAll('[data-label-mode]').forEach((button) => {
  button.addEventListener('click', () => {
    state.showLabels = button.dataset.labelMode === 'on';
    syncViewButtons();
    invalidate();
  });
});
document.querySelectorAll('[data-fusion-mode]').forEach((button) => {
  button.addEventListener('click', () => {
    state.fusion = button.dataset.fusionMode === 'on';
    syncViewButtons();
    invalidate();
  });
});
function setPanelHidden(hidden) {
  document.body.classList.toggle('hide-panel', hidden);
  requestAnimationFrame(() => { layout(); invalidate(); });
}
document.getElementById('togglePanel').addEventListener('click', () => setPanelHidden(true));
document.getElementById('showPanel').addEventListener('click', () => setPanelHidden(false));

// ---------------------------------------------------------------- dragging
uiCanvas.addEventListener('pointerdown', (e) => {
  const r = uiCanvas.getBoundingClientRect();
  const mx = e.clientX - r.left;
  const my = e.clientY - r.top;
  for (let i = state.folders.length - 1; i >= 0; i--) {
    const f = state.folders[i];
    if (mx >= f.x && mx <= f.x + f.w && my >= f.y && my <= f.y + f.h) {
      state.dragging = { f, dx: mx - f.x, dy: my - f.y };
      uiCanvas.setPointerCapture(e.pointerId);
      break;
    }
  }
});
uiCanvas.addEventListener('pointermove', (e) => {
  if (!state.dragging) return;
  const r = uiCanvas.getBoundingClientRect();
  const { f, dx, dy } = state.dragging;
  f.x = e.clientX - r.left - dx;
  f.y = e.clientY - r.top - dy;
  invalidate();
});
uiCanvas.addEventListener('pointerup', () => { state.dragging = null; });

window.addEventListener('resize', () => { layout(); invalidate(); });

// hook for automated screenshot / tuning
window.__lg = {
  state, render, invalidate, layout, PRESETS, syncSliders,
  set(patch) { Object.assign(state.material, patch); syncSliders(); render(); },
  setScene(i) { state.wallZoom = 1; selectScene(i); render(); },
  focus(index, zoom = 2) {
    // isolate one folder, centred and enlarged, for close-up comparisons.
    // Every length of the material scales with the zoom, so this is a true
    // magnification of the same physical glass, not a different material.
    layout();
    const f = state.folders[index];
    const w = stage.clientWidth, h = stage.clientHeight;
    f.w *= zoom;
    f.h *= zoom;
    f.x = w / 2 - f.w / 2;
    f.y = h / 2 - f.h / 2;
    state.folders = [f];
    state.wallZoom = zoom;
    const m = state.material;
    for (const k of ['radius', 'bevel', 'height', 'shadowSize', 'shadowOffset',
                     'edgeWidth', 'blurPlateau', 'blurRim']) {
      m[k] *= zoom;
    }
    syncSliders();
    render();
  },
};

layout();
syncSceneUI();
syncPresetButtons('regular');
syncViewButtons();
syncDebugButtons();
render();
