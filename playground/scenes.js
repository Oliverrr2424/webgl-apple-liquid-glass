// Scene catalogue for the playground.
//
// A scene is a backdrop plus a component layout. The four wallpaper scenes
// exist to judge the material against photographic content; the UI scenes put
// fixed surfaces into real iPhone contexts, while the scrolling feed stresses
// the material in ways a still folder never will.

import { PHONE_SCREEN_WIDTH, phoneFrame, phoneRect } from './phone.js?phone-scenes=3';

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
};

const thumbOf = (key) => `./assets/wallpapers/thumbs/${key}.webp`;
const phoneThumbOf = (key) => `./assets/wallpapers/thumbs/${key}.jpg`;

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
    { id: 'clock', shape: 'rect', label: '时钟', x: 25, y: 88, w: 161, h: 160 },
    { id: 'fitness', shape: 'rect', label: '健身', x: 207, y: 88, w: 160, h: 160 },
    { id: 'travel', shape: 'folder', label: '旅行', x: 119, y: 284, w: 63, h: 63, icons: iconSet('photos', 'whatsapp', 'spotify') },
    { id: 'photos-video', shape: 'folder', label: '照片与视频', x: 210, y: 284, w: 63, h: 63, icons: iconSet('github', 'spotify') },
    { id: 'mail', shape: 'folder', label: '📧', x: 29, y: 381, w: 63, h: 63, icons: iconSet('photos', 'whatsapp', 'spotify', 'notion') },
    { id: 'games', shape: 'folder', label: '🎮', x: 119, y: 381, w: 63, h: 63, icons: iconSet('github', 'youtube', 'figma', 'spotify') },
    { id: 'shopping', shape: 'folder', label: '💰', x: 210, y: 381, w: 63, h: 63, icons: iconSet('whatsapp', 'youtube', 'figma', 'photos') },
    { id: 'music', shape: 'folder', label: '🎵', x: 301, y: 381, w: 63, h: 63, icons: iconSet('youtube', 'spotify', 'photos') },
    { id: 'social', shape: 'folder', label: '社交', x: 119, y: 479, w: 63, h: 63, icons: iconSet('youtube', 'figma', 'whatsapp') },
    { id: 'productivity', shape: 'folder', label: 'Productivity', x: 210, y: 479, w: 63, h: 63, icons: iconSet('notion', 'photos', 'figma', 'spotify') },
    { id: 'social-2', shape: 'folder', label: '社交', x: 210, y: 577, w: 63, h: 63, icons: iconSet('youtube', 'whatsapp', 'github') },
];

const HOME_PAGE_TWO = [
    { id: 'weather-widget', shape: 'rect', label: '天气', x: 26, y: 90, w: 341, h: 160 },
    { id: 'education', shape: 'folder', label: '教育', x: 302, y: 286, w: 63, h: 63, icons: iconSet('spotify', 'photos') },
    { id: 'utilities', shape: 'folder', label: '🈚', x: 121, y: 383, w: 63, h: 63, icons: iconSet('github', 'photos', 'figma', 'notion') },
    { id: 'tools', shape: 'folder', label: '工具🛠️', x: 211, y: 383, w: 63, h: 63, icons: iconSet('notion', 'github', 'figma', 'spotify') },
    { id: 'battery-widget', shape: 'rect', label: '电池', x: 26, y: 482, w: 341, h: 160 },
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
  { id: 'tab-bar', name: 'Home Page', kind: 'Swipeable iPhone home screen', phoneView: 'home', phonePages: 2, lockedComponents: true, backdrop: { type: 'phone', wallpaper: 'image', src: WALLPAPERS['home-page-sunset'], tint: '#334d69', thumb: phoneThumbOf('home-page-sunset') }, layout: homePage },
  { id: 'notification', name: 'Notification', kind: 'Fixed iPhone lock screen', phoneView: 'notification', lockedComponents: true, backdrop: { type: 'phone', wallpaper: 'type', tint: '#b7aa93', thumb: phoneThumbOf('notification') }, layout: notification },
  { id: 'control-centre', name: 'Control Centre', kind: 'Fixed iPhone controls', phoneView: 'control-centre', lockedComponents: true, backdrop: { type: 'phone', wallpaper: 'neon', tint: '#9b0f71', thumb: phoneThumbOf('control-centre') }, layout: controlCentre },
  { id: 'scrolling-feed', name: 'Scrolling feed', kind: 'Live backdrop', backdrop: { type: 'feed', tint: '#1d2430', animated: true, thumb: phoneThumbOf('scrolling-feed') }, layout: scrollingFeed },
];

export function sceneById(id) {
  if (id === 'home-page-2') return SCENES.find((scene) => scene.id === 'tab-bar');
  return SCENES.find((scene) => scene.id === id) ?? SCENES[0];
}

/** Whether a scene's backdrop changes on its own and needs a live upload. */
export function isAnimated(scene) {
  return Boolean(scene.backdrop.animated) || scene.backdrop.type === 'video';
}
