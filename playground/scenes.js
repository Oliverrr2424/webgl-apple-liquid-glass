// Scene catalogue for the playground.
//
// The picker intentionally stays small: four destinations cover the press
// interaction lab, the Home screen, the scrolling backdrop, and one reusable
// shape scene whose wallpaper can be swapped in-place.

import { PHONE_SCREEN_WIDTH, phoneFrame, phoneRect } from './phone.js?phone-scenes=10';

const ICONS = {
  youtube: { name: 'YouTube', src: './assets/icons/youtube.svg', c0: '#f7f8fb', c1: '#d9dde7' },
  spotify: { name: 'Spotify', src: './assets/icons/spotify.svg', c0: '#e8f8ed', c1: '#b9e8c8' },
  whatsapp: { name: 'WhatsApp', src: './assets/icons/whatsapp.svg', c0: '#e3f8ec', c1: '#b9ebce' },
  notion: { name: 'Notion', src: './assets/icons/notion.svg', c0: '#2c3039', c1: '#15171d' },
  figma: { name: 'Figma', src: './assets/icons/figma.svg', c0: '#fff1ea', c1: '#ffd9c9' },
  github: { name: 'GitHub', src: './assets/icons/github.svg', c0: '#3a404c', c1: '#181b22' },
  photos: { name: 'Google Photos', src: './assets/icons/google-photos.svg', c0: '#edf5ff', c1: '#d2e6ff' },
};

export const ICON_SOURCES = [...new Set(Object.values(ICONS).map((icon) => icon.src))];

/** Attaches decoded images to the shared icon registry. */
export function attachIconImages(images) {
  for (const icon of Object.values(ICONS)) {
    icon.image = images.get(icon.src) ?? null;
  }
}

const iconSet = (...names) => names.map((name) => ICONS[name]);

const WALLPAPERS = {
  'natural-lake': './assets/wallpapers/natural-lake.webp',
  'abstract-lines': './assets/wallpapers/abstract-lines.webp',
  'color-blocks': './assets/wallpapers/color-blocks.webp',
  'night-city': './assets/wallpapers/night-city.webp',
  'home-page-warm': './assets/wallpapers/home-page-warm.png',
  'home-page-sunset': './assets/wallpapers/home-page-sunset.png',
  'earth-black': './assets/wallpapers/earth-black.png',
};

const thumbOf = (key) => `./assets/wallpapers/thumbs/${key}.webp`;
const phoneThumbOf = (key) => `./assets/wallpapers/thumbs/${key}.jpg`;

export const PHONE_WALLPAPER_PRESETS = Object.freeze([
  {
    id: 'warm-fold',
    name: 'Warm fold',
    src: WALLPAPERS['home-page-warm'],
    thumb: phoneThumbOf('home-page-warm'),
  },
  {
    id: 'sunset-lake',
    name: 'Sunset lake',
    src: WALLPAPERS['home-page-sunset'],
    thumb: phoneThumbOf('home-page-sunset'),
  },
]);

export const SCENE_WALLPAPER_PRESETS = Object.freeze([
  {
    id: 'natural-lake',
    name: 'Alpine Lake',
    src: WALLPAPERS['natural-lake'],
    thumb: thumbOf('natural-lake'),
  },
  {
    id: 'abstract-lines',
    name: 'Flow Lines',
    src: WALLPAPERS['abstract-lines'],
    thumb: thumbOf('abstract-lines'),
  },
  {
    id: 'color-blocks',
    name: 'Color Blocks',
    src: WALLPAPERS['color-blocks'],
    thumb: thumbOf('color-blocks'),
  },
  {
    id: 'night-city',
    name: 'Rainy City',
    src: WALLPAPERS['night-city'],
    thumb: thumbOf('night-city'),
  },
]);

// The original comparison set: one of every shape, identical on every
// wallpaper, so geometry and material stay the only variables.
function shapeSet(w, h) {
  const leftX = w * 0.24;
  const rightX = w * 0.72;
  const topY = h * 0.27;
  const bottomY = h * 0.70;
  const square = Math.min(w * 0.30, h * 0.35);
  const pillWidth = Math.min(w * 0.39, h * 0.55);
  const pillHeight = Math.min(w * 0.19, h * 0.21);
  const rectWidth = Math.min(w * 0.40, h * 0.57);
  const rectHeight = Math.min(w * 0.27, h * 0.30);
  return [
    {
      id: 'folder', shape: 'folder', label: 'Folder',
      x: leftX - square / 2, y: bottomY - square / 2, w: square, h: square,
      icons: iconSet('youtube', 'spotify', 'whatsapp', 'notion'),
    },
    {
      id: 'rect', shape: 'rect', label: 'Rect',
      x: rightX - rectWidth / 2, y: bottomY - rectHeight / 2,
      w: rectWidth, h: rectHeight,
      icons: iconSet('figma', 'github', 'photos', 'spotify'),
    },
    {
      id: 'pill', shape: 'pill', label: 'Pill', content: 'Continue',
      x: rightX - pillWidth / 2, y: topY - pillHeight / 2,
      w: pillWidth, h: pillHeight,
    },
    {
      id: 'circle', shape: 'circle', label: 'Circle', content: '+',
      x: leftX - square / 2, y: topY - square / 2, w: square, h: square,
    },
  ];
}

function inPhone(width, height, specs) {
  const frame = phoneFrame(width, height);
  return specs.map((spec) => ({ ...spec, ...phoneRect(frame, spec.x, spec.y, spec.w, spec.h) }));
}

const HOME_PAGE_ONE = [
    // Measured from the supplied 1206 × 2622 home-screen capture and mapped
    // into the shared 393 × 852 point coordinate system.
    { id: 'clock', shape: 'rect', label: 'Clock', x: 25, y: 88, w: 161, h: 160 },
    { id: 'fitness', shape: 'rect', label: 'Fitness', x: 207, y: 88, w: 160, h: 160 },
    { id: 'travel', shape: 'folder', label: 'Travel', x: 119, y: 284, w: 63, h: 63, icons: iconSet('photos', 'whatsapp', 'spotify') },
    { id: 'photos-video', shape: 'folder', label: 'Photos & Videos', x: 210, y: 284, w: 63, h: 63, icons: iconSet('github', 'spotify') },
    { id: 'mail', shape: 'folder', label: 'Mail', x: 29, y: 381, w: 63, h: 63, icons: iconSet('photos', 'whatsapp', 'spotify', 'notion') },
    { id: 'games', shape: 'folder', label: 'Games', x: 119, y: 381, w: 63, h: 63, icons: iconSet('github', 'youtube', 'figma', 'spotify') },
    { id: 'shopping', shape: 'folder', label: 'Shopping', x: 210, y: 381, w: 63, h: 63, icons: iconSet('whatsapp', 'youtube', 'figma', 'photos') },
    { id: 'music', shape: 'folder', label: 'Music', x: 301, y: 381, w: 63, h: 63, icons: iconSet('youtube', 'spotify', 'photos') },
    { id: 'social', shape: 'folder', label: 'Social', x: 119, y: 479, w: 63, h: 63, icons: iconSet('youtube', 'figma', 'whatsapp') },
    { id: 'productivity', shape: 'folder', label: 'Productivity', x: 210, y: 479, w: 63, h: 63, icons: iconSet('notion', 'photos', 'figma', 'spotify') },
    { id: 'social-2', shape: 'folder', label: 'Social', x: 210, y: 577, w: 63, h: 63, icons: iconSet('youtube', 'whatsapp', 'github') },
];

const HOME_PAGE_TWO = [
    { id: 'weather-widget', shape: 'rect', label: 'Weather', x: 26, y: 90, w: 341, h: 160 },
    { id: 'education', shape: 'folder', label: 'Education', x: 302, y: 286, w: 63, h: 63, icons: iconSet('spotify', 'photos') },
    { id: 'utilities', shape: 'folder', label: 'Utilities', x: 121, y: 383, w: 63, h: 63, icons: iconSet('github', 'photos', 'figma', 'notion') },
    { id: 'tools', shape: 'folder', label: 'Tools', x: 211, y: 383, w: 63, h: 63, icons: iconSet('notion', 'github', 'figma', 'spotify') },
    { id: 'battery-widget', shape: 'rect', label: 'Battery', x: 26, y: 482, w: 341, h: 160 },
];

function homePage(w, h) {
  const frame = phoneFrame(w, h);
  const pageElements = [HOME_PAGE_ONE, HOME_PAGE_TWO].flatMap((specs, phonePage) => specs.map((spec) => {
    const rect = phoneRect(frame, spec.x + phonePage * PHONE_SCREEN_WIDTH, spec.y, spec.w, spec.h);
    return {
      ...spec,
      ...rect,
      id: `home-${phonePage + 1}-${spec.id}`,
      homeId: spec.id,
      phonePage,
      phoneBaseX: rect.x,
    };
  }));
  const dockSpec = { id: 'dock', shape: 'pill', label: 'Dock', x: 17, y: 731, w: 359, h: 91 };
  return [...pageElements, { ...dockSpec, ...phoneRect(frame, dockSpec.x, dockSpec.y, dockSpec.w, dockSpec.h) }];
}

function notification(w, h) {
  return inPhone(w, h, [
    { id: 'headline', shape: 'rect', label: 'Match result', x: 18, y: 291, w: 357, h: 78, tint: 0.86, tintTone: 'light' },
    { id: 'building', shape: 'rect', label: 'Five Condos', x: 18, y: 382, w: 357, h: 112, tint: 0.86, tintTone: 'light' },
    { id: 'message', shape: 'rect', label: 'Oliverrr', x: 18, y: 508, w: 357, h: 92, tint: 0.86, tintTone: 'light' },
    { id: 'flashlight', shape: 'circle', label: 'Flashlight', x: 42, y: 748, w: 62, h: 62 },
    { id: 'camera', shape: 'circle', label: 'Camera', x: 289, y: 748, w: 62, h: 62 },
  ]);
}

function controlCentre(w, h) {
  return inPhone(w, h, [
    { id: 'connectivity', shape: 'folder', label: 'Connectivity', x: 20, y: 138, w: 166, h: 166 },
    { id: 'bluetooth', shape: 'pill', label: 'Bluetooth', x: 203, y: 138, w: 170, h: 75 },
    { id: 'hotspot', shape: 'pill', label: 'Hotspot', x: 203, y: 227, w: 170, h: 75 },
    { id: 'rotation', shape: 'circle', label: 'Rotation lock', x: 20, y: 322, w: 72, h: 72 },
    { id: 'mirroring', shape: 'circle', label: 'Screen mirroring', x: 106, y: 322, w: 72, h: 72 },
    { id: 'brightness', shape: 'pill', label: 'Brightness', x: 203, y: 322, w: 75, h: 172 },
    { id: 'volume', shape: 'pill', label: 'Volume', x: 298, y: 322, w: 75, h: 172 },
    { id: 'focus', shape: 'pill', label: 'Focus', x: 20, y: 412, w: 158, h: 82 },
    { id: 'torch', shape: 'pill', label: 'Torch', x: 20, y: 526, w: 171, h: 76 },
    { id: 'low-power', shape: 'pill', label: 'Low power', x: 202, y: 526, w: 171, h: 76 },
    { id: 'camera', shape: 'circle', label: 'Camera', x: 20, y: 628, w: 72, h: 72 },
    { id: 'calculator', shape: 'circle', label: 'Calculator', x: 106, y: 628, w: 72, h: 72 },
    { id: 'voice', shape: 'circle', label: 'Voice memo', x: 203, y: 628, w: 72, h: 72 },
    { id: 'record', shape: 'circle', label: 'Record', x: 299, y: 628, w: 72, h: 72 },
  ]);
}

function scrollingFeed(w) {
  const barWidth = Math.min(560, w * 0.66);
  return [
    {
      id: 'toolbar', shape: 'pill', label: 'Toolbar', content: 'Library',
      x: (w - barWidth) / 2, y: 28, w: barWidth, h: 66,
    },
    {
      id: 'search', shape: 'circle', label: 'Search', content: '⌕',
      x: (w - barWidth) / 2 + barWidth + 14, y: 28, w: 66, h: 66,
    },
  ];
}

// A deliberately small interaction specimen. The selected capsule is its own
// glass surface, so it can stretch independently from the bar underneath it.
function pressEffects(w, h) {
  const width = Math.min(540, w * 0.64);
  const barHeight = Math.max(62, Math.min(82, h * 0.105));
  const x = (w - width) / 2;
  const thumbWidth = width * 0.48;
  const orb = Math.max(76, Math.min(104, h * 0.12));
  const toggleWidth = Math.min(190, w * 0.30);
  const toggleHeight = Math.max(58, Math.min(70, h * 0.09));
  const buttonWidth = Math.min(282, w * 0.42);
  const buttonHeight = Math.max(58, Math.min(72, h * 0.09));
  // Four specimen centres share one regular vertical rhythm. Basing the
  // spacing on centres keeps pills and the circular control evenly balanced.
  const firstCenterY = Math.max(barHeight * 0.5 + 40, h * 0.20);
  const lastCenterY = Math.min(h - orb * 0.5 - 44, h * 0.80);
  const stepY = (lastCenterY - firstCenterY) / 3;
  const centersY = Array.from({ length: 4 }, (_, index) => firstCenterY + stepY * index);
  const y = centersY[0] - barHeight / 2;
  const buttonY = centersY[1] - buttonHeight / 2;
  const toggleY = centersY[2] - toggleHeight / 2;
  const orbY = centersY[3] - orb / 2;
  return [
    {
      id: 'selection-track', shape: 'pill', label: 'Selectable liquid-glass track',
      interaction: 'selection-slider', sliderThumb: 'selection-thumb',
      // The full-width lower layer stays the original white-tinted glass.
      tint: 0.86, tintTone: 'light', x, y, w: width, h: barHeight,
    },
    {
      id: 'selection-thumb', shape: 'pill', label: 'Draggable selection',
      interaction: 'selection-thumb', sliderTrack: 'selection-track',
      // At rest the moving upper layer is neutral gray frosted glass. Holding
      // it removes this tint and reveals the clear liquid-glass material.
      tint: 0.34, tintTone: 'dark', frost: 0.32, x: x + barHeight * 0.08,
      y: y + barHeight * 0.08, w: thumbWidth, h: barHeight * 0.84,
    },
    {
      id: 'hold-button', shape: 'pill', label: 'Press-and-hold glass button',
      interaction: 'pressable-glass', content: 'Hold to bloom',
      x: (w - buttonWidth) / 2, y: buttonY,
      w: buttonWidth, h: buttonHeight,
    },
    {
      id: 'green-toggle-track', shape: 'pill', label: 'Green toggle track',
      interaction: 'toggle-slider', sliderThumb: 'green-toggle-thumb', nonGlass: true,
      x: (w - toggleWidth) / 2, y: toggleY, w: toggleWidth, h: toggleHeight,
    },
    {
      id: 'green-toggle-thumb', shape: 'pill', label: 'Green toggle glass thumb',
      interaction: 'toggle-thumb', sliderTrack: 'green-toggle-track',
      // The 2D resting thumb is white; these authored values make the first
      // liquid frame match it before tint and frost spring down to clear.
      tint: 1.5, tintTone: 'light', frost: 0.24, x: (w - toggleWidth) / 2,
      y: toggleY + toggleHeight * 0.08, w: toggleWidth * 0.65, h: toggleHeight * 0.84,
    },
    {
      id: 'hold-orb', shape: 'circle', label: 'Press-and-hold glass orb',
      interaction: 'pressable-glass', content: '+',
      x: w * 0.5 - orb / 2, y: orbY, w: orb, h: orb,
    },
  ];
}

export const SCENES = [
  { id: 'press', name: 'Press', kind: 'Selectable & tactile glass controls', lockedComponents: true, interactionLab: true, backdrop: { type: 'image', src: WALLPAPERS['earth-black'], thumb: WALLPAPERS['earth-black'] }, layout: pressEffects },
  { id: 'home', name: 'Home', kind: 'Swipeable iPhone home screen', phoneView: 'home', phonePages: 2, lockedComponents: true, backdrop: { type: 'phone', wallpaper: 'image', src: WALLPAPERS['home-page-warm'], tint: '#b8a999', thumb: phoneThumbOf('home-page-warm') }, layout: homePage },
  { id: 'scrol', name: 'Scroll', kind: 'Live backdrop', backdrop: { type: 'feed', tint: '#1d2430', animated: true, thumb: phoneThumbOf('scrolling-feed') }, layout: scrollingFeed },
  { id: 'scene', name: 'Scene', kind: 'Four shape / wallpaper gallery', backdrop: { type: 'image', src: WALLPAPERS['natural-lake'], thumb: thumbOf('natural-lake') }, layout: shapeSet },
];

const SCENE_ALIASES = new Map([
  ['press-effects', 'press'],
  ['tab-bar', 'home'],
  ['home-page-2', 'home'],
  ['scrolling-feed', 'scrol'],
  ['alpine-lake', 'scene'],
  ['flow-lines', 'scene'],
  ['color-blocks', 'scene'],
  ['night-city', 'scene'],
  // These remain valid as internal pull-down panel names, but are no longer
  // destinations in the picker.
  ['notification', 'home'],
  ['control-centre', 'home'],
]);

// Pull-down sheets are overlays on Home, not destinations in the public scene
// picker. Keep their authored layouts available to the interaction code
// without making them part of SCENES.
const PANEL_LAYOUTS = Object.freeze({
  notification: notification,
  'control-centre': controlCentre,
});

export function panelLayout(id, width, height) {
  return PANEL_LAYOUTS[id]?.(width, height) ?? [];
}

export function sceneById(id) {
  const canonicalId = SCENE_ALIASES.get(id) ?? id;
  return SCENES.find((scene) => scene.id === canonicalId) ?? SCENES[0];
}

/** Whether a scene's backdrop changes on its own and needs a live upload. */
export function isAnimated(scene) {
  return Boolean(scene.backdrop.animated) || scene.backdrop.type === 'video';
}
