# apple-liquid-glass-webgl

Reusable WebGL2 liquid glass surfaces for folders, rectangles, pills, and circles.

This package is framework-free and renders Apple-inspired translucent surfaces with screen-space refraction, variable blur, Fresnel reflection, chromatic dispersion, edge highlights, and contact shadows.

## Install

```bash
npm install apple-liquid-glass-webgl
```

WebGL2 is required. Give the canvas a CSS width and height before rendering.

## Usage

```js
import { LiquidGlassWebGL } from 'apple-liquid-glass-webgl';

const canvas = document.querySelector('canvas');
const glass = new LiquidGlassWebGL(canvas, { material: 'regular' });

await glass.setWallpaper('/images/wallpaper.jpg');
glass.setElements([
  { id: 'folder', shape: 'folder', x: 80, y: 80, width: 220, height: 220 },
  { id: 'rect', shape: 'rect', x: 360, y: 100, width: 280, height: 190 },
  { id: 'pill', shape: 'pill', x: 700, y: 130, width: 250, height: 110 },
  { id: 'circle', shape: 'circle', x: 1000, y: 130, size: 110 },
]);
glass.render();
```

The component accepts CSS-pixel coordinates. Content such as app icons, labels, or buttons can be drawn in a separate canvas layer above the WebGL canvas.

## Visual preview

These screenshots are captured from the playground with the inspector hidden. Each scene uses the same folder, rect, pill, and circle surfaces:

| Natural landscape | Abstract lines |
| --- | --- |
| ![Natural landscape](https://cdn.jsdelivr.net/gh/Oliverrr2424/webgl-apple-liquid-glass@main/assets/readme/natural-lake.jpg) | ![Abstract lines](https://cdn.jsdelivr.net/gh/Oliverrr2424/webgl-apple-liquid-glass@main/assets/readme/abstract-lines.jpg) |

| Color blocks | Night city |
| --- | --- |
| ![Color blocks](https://cdn.jsdelivr.net/gh/Oliverrr2424/webgl-apple-liquid-glass@main/assets/readme/color-blocks.jpg) | ![Night city](https://cdn.jsdelivr.net/gh/Oliverrr2424/webgl-apple-liquid-glass@main/assets/readme/night-city.jpg) |

## API

```js
glass.setMaterial('clear');
glass.setMaterial({ blurPlateau: 4, edgeLine: 0.2 });
glass.setWallpaperIndex(0);
glass.addElement({ id: 'new-folder', shape: 'folder', x: 20, y: 20, size: 180 });
glass.updateElement('new-folder', { x: 40 });
glass.removeElement('new-folder');
glass.resize();
glass.destroy();
```

Available presets are `regular`, `clear`, and `lens`. Available shapes are `folder`, `rect`, `pill`, and `circle`.

## Playground

The repository also contains the interactive demo used to develop the material:

```bash
npm install
npm run serve
```

Open [http://localhost:8765](http://localhost:8765). The inspector includes scene previews, icon visibility, labels, debug shader outputs, and grouped material controls.

## Development

```bash
npm run shot /tmp/liquid-glass.png -- --scene 0 --size 1200x720 --no-panel
npm run pack:check
```

## License

MIT
