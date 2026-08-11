// Scene catalogue for the playground.
//
// A scene is a backdrop plus a component layout. The four wallpaper scenes
// exist to judge the material against photographic content; the UI scenes exist
// because that is what people actually build with it, and a tab bar over a
// scrolling feed stresses the material in ways a still folder never will.

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

function tabBar(w, h) {
  const barWidth = Math.min(430, w * 0.56);
  const barHeight = Math.max(64, Math.min(78, w * 0.082));
  const button = barHeight;
  return [
    {
      id: 'tabbar', shape: 'pill', label: 'Tab bar',
      x: (w - barWidth) / 2 - button * 0.62, y: h - barHeight - 34,
      w: barWidth, h: barHeight,
      icons: iconSet('photos', 'spotify', 'github', 'notion'),
    },
    {
      id: 'compose', shape: 'circle', label: 'Compose', content: '+',
      x: (w + barWidth) / 2 - button * 0.44, y: h - barHeight - 34,
      w: button, h: button,
    },
  ];
}

function notification(w, h) {
  const cardWidth = Math.min(520, w * 0.62);
  return [
    {
      id: 'alert', shape: 'rect', label: 'Notification',
      x: (w - cardWidth) / 2, y: h * 0.16, w: cardWidth, h: 118,
      icons: iconSet('whatsapp'),
    },
    {
      id: 'reply', shape: 'pill', label: 'Reply', content: 'Reply',
      x: (w - cardWidth) / 2 + cardWidth - 210, y: h * 0.16 + 150, w: 210, h: 60,
    },
    {
      id: 'dismiss', shape: 'circle', label: 'Dismiss', content: '×',
      x: (w - cardWidth) / 2, y: h * 0.16 + 150, w: 60, h: 60,
    },
  ];
}

function controlCentre(w, h) {
  const unit = Math.min(130, w * 0.145);
  const gap = unit * 0.16;
  const left = w / 2 - (unit * 2 + gap) / 2 - unit * 0.7;
  const top = h * 0.2;
  return [
    { id: 'connectivity', shape: 'rect', label: 'Connectivity', x: left, y: top, w: unit * 2 + gap, h: unit * 2 + gap, icons: iconSet('spotify', 'notion', 'github', 'figma') },
    { id: 'brightness', shape: 'rect', label: 'Brightness', x: left + unit * 2 + gap * 2, y: top, w: unit * 0.82, h: unit * 2 + gap },
    { id: 'volume', shape: 'rect', label: 'Volume', x: left + unit * 2 + gap * 3 + unit * 0.82, y: top, w: unit * 0.82, h: unit * 2 + gap },
    { id: 'torch', shape: 'circle', label: 'Torch', content: '☀', x: left, y: top + unit * 2 + gap * 2, w: unit * 0.86, h: unit * 0.86 },
    { id: 'timer', shape: 'circle', label: 'Timer', content: '◔', x: left + unit * 1.02, y: top + unit * 2 + gap * 2, w: unit * 0.86, h: unit * 0.86 },
    { id: 'now-playing', shape: 'pill', label: 'Now playing', content: 'Now playing', x: left + unit * 2.04, y: top + unit * 2 + gap * 2, w: unit * 1.7, h: unit * 0.86 },
  ];
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
  { id: 'tab-bar', name: 'Tab bar', kind: 'Over app content', backdrop: { type: 'app', tint: '#2b3a5c' }, layout: tabBar },
  { id: 'notification', name: 'Notification', kind: 'Over a photo', backdrop: { type: 'image', src: WALLPAPERS['night-city'], thumb: thumbOf('night-city') }, layout: notification },
  { id: 'control-centre', name: 'Control centre', kind: 'Dense component grid', backdrop: { type: 'image', src: WALLPAPERS['color-blocks'], thumb: thumbOf('color-blocks') }, layout: controlCentre },
  { id: 'scrolling-feed', name: 'Scrolling feed', kind: 'Live backdrop', backdrop: { type: 'feed', tint: '#1d2430', animated: true }, layout: scrollingFeed },
];

export function sceneById(id) {
  return SCENES.find((scene) => scene.id === id) ?? SCENES[0];
}

/** Whether a scene's backdrop changes on its own and needs a live upload. */
export function isAnimated(scene) {
  return Boolean(scene.backdrop.animated) || scene.backdrop.type === 'video';
}
