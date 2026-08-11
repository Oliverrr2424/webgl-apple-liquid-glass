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
const glass = new LiquidGlassWebGL(canvas, {
  material: 'regular',
  fusion: true,
});

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

## Default material parameters

`getDefaultMaterial()` returns a fresh copy of the package's default material parameters on every call. This makes it safe to customize the result without mutating the package defaults.

```js
import { getDefaultMaterial, LiquidGlassWebGL } from 'apple-liquid-glass-webgl';

const material = getDefaultMaterial();
material.blurRim = 32;

const glass = new LiquidGlassWebGL(canvas, { material });
```

`makeMaterial()` with no argument is also equivalent to `getDefaultMaterial()`. The exported `DEFAULT_MATERIAL` constant contains the same values for read-only inspection.

| Group | Parameter | Default |
| --- | --- | ---: |
| Shape | `radius` | `64.00` |
| Shape | `squircle` | `2.00` |
| Shape | `mergeRadius` | `52.00` |
| Shape | `bevel` | `34.00` |
| Shape | `height` | `21.00` |
| Optics | `ior` | `2.00` |
| Optics | `dispersion` | `0.06` |
| Optics | `refractScale` | `3.00` |
| Optics | `meniscus` | `1.00` |
| Optics | `blurPlateau` | `8.00` |
| Optics | `blurRim` | `48.00` |
| Optics | `opticalDensity` | `1.80` |
| Lighting | `specular` | `0.89` |
| Lighting | `specPower` | `11.50` |
| Lighting | `highlightAdapt` | `0.83` |
| Lighting | `highlightWidth` | `0.76` |
| Lighting | `highlightSharpness` | `0.55` |
| Lighting | `highlightBase` | `0.30` |
| Lighting | `fresnel` | `0.65` |
| Lighting | `saturation` | `1.35` |
| Lighting | `brightness` | `0.00` |
| Lighting | `tintAmount` | `0.08` |
| Edge | `shadow` | `0.09` |
| Edge | `shadowSize` | `4.00` |
| Edge | `shadowOffset` | `0.00` |
| Edge | `lightX` | `-0.18` |
| Edge | `lightY` | `0.08` |
| Edge | `edgeLine` | `0.30` |
| Edge | `edgeWidth` | `1.10` |
| Edge | `edgeDark` | `0.11` |

The returned object also includes `tintColor: [1, 1, 1]` and `debug: 0`. Parameter names use the JavaScript API names; for example, `highlightAdapt` is the “Light adaptation” control and `edgeLine` is the “Edge highlight” control.

## Live backdrops and overlay mode

Use `compositeMode: 'overlay'` when the original backdrop remains visible underneath the WebGL canvas. Pixels outside the glass stay transparent, while the supplied backdrop source is sampled for refraction and blur.

```js
const glass = new LiquidGlassWebGL(canvas, {
  compositeMode: 'overlay',
  elements: [
    { id: 'panel', shape: 'rect', x: 80, y: 80, width: 520, height: 360 },
  ],
});

// Canvas, OffscreenCanvas, and video sources are detected as live. The
// renderer starts automatically and uploads their latest frame before drawing.
glass.setBackdrop(animatedCanvas);

// Stop the render loop when the view is hidden or unmounted.
glass.stop();
```

Static image sources upload once:

```js
await glass.loadBackdrop('/images/wallpaper.jpg');
```

The update behavior can be selected explicitly:

```js
glass.setBackdrop(source, { update: 'live' });
glass.setBackdrop(source, { update: 'static', autoStart: false });
glass.updateBackdrop(); // manually upload the latest static-source pixels
glass.start();
glass.stop();
```

The default `compositeMode: 'replace'` preserves the original behavior and draws the supplied backdrop across the full WebGL canvas. Browsers do not expose arbitrary composited DOM/CSS pixels to WebGL, so the backdrop must be supplied explicitly as an image, canvas, video, ImageBitmap, or OffscreenCanvas. Cross-origin sources must permit CORS access.

## Visual preview

These screenshots are captured from the playground with the inspector hidden. Each scene uses the same folder, rect, pill, and circle surfaces:

### Smooth-union fusion

Nearby components can share one continuous distance field, so the silhouette, refraction, highlights, and shadow flow through the merged surface.

![Smooth-union liquid glass fusion](https://cdn.jsdelivr.net/npm/apple-liquid-glass-webgl@0.1.7/assets/readme/smooth-union.jpg)

### Individual scene previews

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
glass.setBackdrop(animatedCanvas, { update: 'live' });
glass.updateBackdrop();
glass.start();
glass.stop();
glass.setFusion(true, 52); // smooth-union distance in CSS pixels
glass.setWallpaperIndex(0);
glass.addElement({ id: 'new-folder', shape: 'folder', x: 20, y: 20, size: 180 });
glass.updateElement('new-folder', { x: 40 });
glass.removeElement('new-folder');
glass.resize();
glass.destroy();
```

Available presets are `regular`, `clear`, and `lens`. Available shapes are `folder`, `rect`, `pill`, and `circle`. With `fusion` enabled, up to 16 nearby elements are evaluated as one smooth-union distance field, so their silhouette, normals, refraction, highlights, and shadow merge continuously.

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

## Automated npm publishing

Every push to `main` runs [`.github/workflows/publish-npm.yml`](.github/workflows/publish-npm.yml). The workflow publishes the package when the version in `package.json` is newer than the version already on npm.

To enable publishing, add a repository secret named `NPM_TOKEN` containing an npm token with permission to publish `apple-liquid-glass-webgl`. Bump the package version before pushing a release to `main`.

## License

MIT
