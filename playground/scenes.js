// Scene catalogue for the playground.
//
// A scene is a backdrop plus a component layout. The four wallpaper scenes
// exist to judge the material against photographic content; the UI scenes put
// fixed surfaces into real iPhone contexts, while the scrolling feed stresses
// the material in ways a still folder never will.

import { phoneFrame, phoneRect } from './phone.js?phone-scenes=2';

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
};

const thumbOf = (key) => `./assets/wallpapers/thumbs/${key}.webp`;

// The original comparison set: one of every shape, identical on every
// wallpaper, so geometry and material stay the only variables.
function shapeSet(w, h) {
  return [
    {
      id: 'folder', shape: 'folder', label: 'Folder',
      x: 0.19 * w - 0.10 * w, y: 0.49 * h - 0.10 * w, w: 0.20 * w, h: 0.20 * w,
      icons: iconSet('youtube', 'spotify', 'whatsapp', 'notion'),
    },
    {
      id: 'rect', shape: 'rect', label: 'Rect',
      x: 0.47 * w - 0.12 * w, y: 0.52 * h - 0.09 * w, w: 0.24 * w, h: 0.18 * w,
      icons: iconSet('figma', 'github', 'photos', 'spotify'),
    },
    {
      id: 'pill', shape: 'pill', label: 'Pill', content: 'Continue',
      x: 0.68 * w - 0.11 * w, y: 0.48 * h - 0.06 * w, w: 0.22 * w, h: 0.12 * w,
    },
    {
      id: 'circle', shape: 'circle', label: 'Circle', content: '+',
      x: 0.37 * w - 0.065 * w, y: 0.37 * h - 0.065 * w, w: 0.13 * w, h: 0.13 * w,
    },
  ];
}

function inPhone(width, height, specs) {
  const frame = phoneFrame(width, height);
  return specs.map((spec) => ({ ...spec, ...phoneRect(frame, spec.x, spec.y, spec.w, spec.h) }));
}

function homePage(w, h) {
  return inPhone(w, h, [
    { id: 'clock', shape: 'folder', label: 'Clock', x: 22, y: 145, w: 166, h: 166, icons: iconSet('notion', 'github', 'photos', 'spotify') },
    { id: 'fitness', shape: 'folder', label: 'Fitness', x: 205, y: 145, w: 166, h: 166, icons: iconSet('spotify', 'photos', 'whatsapp', 'figma') },
    { id: 'travel', shape: 'folder', label: 'Travel', x: 22, y: 352, w: 104, h: 104, icons: iconSet('photos', 'whatsapp', 'spotify', 'notion') },
    { id: 'games', shape: 'folder', label: 'Games', x: 145, y: 352, w: 104, h: 104, icons: iconSet('github', 'youtube', 'figma', 'spotify') },
    { id: 'social', shape: 'folder', label: 'Social', x: 267, y: 352, w: 104, h: 104, icons: iconSet('whatsapp', 'youtube', 'figma', 'photos') },
    { id: 'studio', shape: 'folder', label: 'Studio', x: 22, y: 510, w: 104, h: 104, icons: iconSet('figma', 'photos', 'github', 'youtube') },
    { id: 'work', shape: 'folder', label: 'Work', x: 145, y: 510, w: 104, h: 104, icons: iconSet('notion', 'github', 'figma', 'photos') },
    { id: 'media', shape: 'folder', label: 'Media', x: 267, y: 510, w: 104, h: 104, icons: iconSet('youtube', 'spotify', 'photos', 'whatsapp') },
    { id: 'dock', shape: 'pill', label: 'Dock', x: 18, y: 744, w: 357, h: 76, icons: iconSet('whatsapp', 'spotify', 'photos', 'github') },
  ]);
}

function notification(w, h) {
  return inPhone(w, h, [
    { id: 'headline', shape: 'rect', label: 'Match result', x: 18, y: 291, w: 357, h: 78 },
    { id: 'building', shape: 'rect', label: 'Five Condos', x: 18, y: 382, w: 357, h: 112 },
    { id: 'message', shape: 'rect', label: 'Oliverrr', x: 18, y: 508, w: 357, h: 92 },
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
    { id: 'brightness', shape: 'pill', label: 'Brightness', x: 203, y: 322, w: 75, h: 188 },
    { id: 'volume', shape: 'pill', label: 'Volume', x: 298, y: 322, w: 75, h: 188 },
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

export const SCENES = [
  { id: 'alpine-lake', name: 'Alpine Lake', kind: 'Natural landscape', backdrop: { type: 'image', src: WALLPAPERS['natural-lake'], thumb: thumbOf('natural-lake') }, layout: shapeSet },
  { id: 'flow-lines', name: 'Flow Lines', kind: 'Abstract lines', backdrop: { type: 'image', src: WALLPAPERS['abstract-lines'], thumb: thumbOf('abstract-lines') }, layout: shapeSet },
  { id: 'color-blocks', name: 'Color Blocks', kind: 'Hard colour edges', backdrop: { type: 'image', src: WALLPAPERS['color-blocks'], thumb: thumbOf('color-blocks') }, layout: shapeSet },
  { id: 'night-city', name: 'Rainy City', kind: 'Dark, high contrast', backdrop: { type: 'image', src: WALLPAPERS['night-city'], thumb: thumbOf('night-city') }, layout: shapeSet },
  { id: 'tab-bar', name: 'Home Page', kind: 'Fixed iPhone home screen', phoneView: 'home', lockedComponents: true, backdrop: { type: 'phone', wallpaper: 'spectrum', tint: '#445dff' }, layout: homePage },
  { id: 'notification', name: 'Notification', kind: 'Fixed iPhone lock screen', phoneView: 'notification', lockedComponents: true, backdrop: { type: 'phone', wallpaper: 'type', tint: '#b7aa93' }, layout: notification },
  { id: 'control-centre', name: 'Control Centre', kind: 'Fixed iPhone controls', phoneView: 'control-centre', lockedComponents: true, backdrop: { type: 'phone', wallpaper: 'neon', tint: '#9b0f71' }, layout: controlCentre },
  { id: 'scrolling-feed', name: 'Scrolling feed', kind: 'Live backdrop', backdrop: { type: 'feed', tint: '#1d2430', animated: true }, layout: scrollingFeed },
];

export function sceneById(id) {
  return SCENES.find((scene) => scene.id === id) ?? SCENES[0];
}

/** Whether a scene's backdrop changes on its own and needs a live upload. */
export function isAnimated(scene) {
  return Boolean(scene.backdrop.animated) || scene.backdrop.type === 'video';
}
