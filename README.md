# apple-liquid-glass-webgl

Reusable WebGL2 liquid glass surfaces for folders, rectangles, pills, and circles, with the
original frosted V1 renderer and the clear optical V2 renderer available side by side.

This package is framework-free and renders Apple-inspired translucent surfaces with screen-space refraction, variable blur, Fresnel reflection, chromatic dispersion, edge highlights, and contact shadows.

## V2 demos

### Alpine Lake

![Liquid Glass V2 on Alpine Lake](https://unpkg.com/apple-liquid-glass-webgl@2.0.2/assets/readme/v2-alpine-lake.jpg)

### iPhone Home Page

<p align="center">
  <img src="https://unpkg.com/apple-liquid-glass-webgl@2.0.2/assets/readme/v2-home-page.jpg" alt="Liquid Glass V2 iPhone Home Page" width="720">
</p>

### iPhone Control Centre

<p align="center">
  <img src="https://unpkg.com/apple-liquid-glass-webgl@2.0.2/assets/readme/v2-control-centre.jpg" alt="Liquid Glass V2 iPhone Control Centre" width="720">
</p>

## Install

```bash
npm install apple-liquid-glass-webgl
```

WebGL2 is required. Give the canvas a CSS width and height before rendering.

Check support before constructing, so a browser without WebGL2 can fall back instead of catching a constructor throw:

```js
if (LiquidGlassWebGL.isSupported()) {
  const glass = new LiquidGlassWebGL(canvas);
} else {
  panel.classList.add('css-fallback');
}
```

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

The component accepts CSS-pixel coordinates. Content such as app icons, labels, or buttons can be drawn in a separate canvas layer above the WebGL canvas. Optical lengths automatically scale down when a component's short side is too small for the configured bevel: the refracting rim is capped at 30% of that side, and glass height, blur, highlights, and their backdrop probes follow the same scale. Large components and materials that already use a narrow bevel are unchanged.

## V1 and V2 can be used together

`LiquidGlassWebGL` remains the original V1 API. `LiquidGlassWebGLV2` is the transparent/clear
optical model. They are separate classes with separate material objects, so an application can
render both versions at once without a global mode or an implicit parameter conversion.

```js
import {
  LiquidGlassWebGL,
  LiquidGlassWebGLV2,
  getDefaultMaterial,
  getDefaultMaterialV2,
} from 'apple-liquid-glass-webgl';

const v1 = new LiquidGlassWebGL(document.querySelector('#frosted'), {
  material: getDefaultMaterial(),
  fusion: true,
});
const v2 = new LiquidGlassWebGLV2(document.querySelector('#transparent'), {
  material: getDefaultMaterialV2(),
});

for (const glass of [v1, v2]) {
  glass.setElements([
    { id: 'panel', shape: 'rect', x: 40, y: 40, width: 320, height: 180 },
  ], false);
  await glass.loadBackdrop('/images/wallpaper.jpg', { shouldRender: false });
  glass.render();
}
```

V2 can also be imported from the explicit subpath:

```js
import { LiquidGlassWebGLV2, getDefaultMaterialV2 } from 'apple-liquid-glass-webgl/v2';
```

The two material contracts are intentionally not interchangeable. V2 rejects V1 preset names
and unknown V2 material keys instead of silently applying a value with the wrong unit. Element
position, size and shape can be shared between renderers, but every material value is stored and
evaluated independently.

| Similar concept | V1 calculation | V2 calculation |
| --- | --- | --- |
| `dispersion` | Spread around the refractive index, used in three Snell-law evaluations | Direct display-space RGB sample split in pixels |
| `edgeWidth` | CSS-pixel contour/highlight line width | Fraction of the short half-side used by the edge capture field |
| Corner control | `radius` is a CSS-pixel radius capped by the shape size | `roundness` is a ratio of the short half-side; its default matches V1's 23.5% cap |
| Refraction | `ior × height × refractScale` through a bevel height field | `refraction` for body bending plus one independent `edgeReach` capture distance |
| Tint | Fixed/adaptive `tintColor` mixed by `tintAmount` | Component-level light/dark material selected by `tint` opacity |

V2 surfaces remain separate and resolve overlap in element order; V1's `fusion` and
`mergeRadius` smooth-union controls do not apply to V2.

V2 also accepts optional `tint` and `tintTone` values on each element. `tint` overrides the global
material value only for that surface, so a legibility-first notification can use a coherent milky
tint while folders and the dock remain clear in the same renderer. `tintTone` can force a stable
`light` or `dark` treatment; its default `auto` tone is selected from the average backdrop below
the whole component rather than from each pixel:

```js
glass.setElements([
  { id: 'folder', shape: 'folder', x: 24, y: 180, size: 104 },
  {
    id: 'notification', shape: 'rect', x: 18, y: 70,
    width: 357, height: 78, tint: 0.86, tintTone: 'light',
  },
]);
```

Both versions use the same visible shape contract: `folder` and `rect` are rounded boxes,
`pill` is a capsule, and `circle` uses the short half-side. In particular, V2 `folder` has no
special tab or cut-out. This keeps shared layouts pixel-aligned while the two optical models
remain independent.

### V2 default material parameters

The Playground exposes `refraction` from `0` to `110`. Edge capture is opt-in:
both `edgeReach` and `edgeWidth` default to zero.

| Group | Parameter | Default |
| --- | --- | ---: |
| Transmission | `refraction` | `90.00` |
| Transmission | `edgeReach` | `0.00` |
| Transmission | `edgeWidth` | `0.00` |
| Transmission | `dispersion` | `0.70` |
| Transmission | `frost` | `0.18` |
| Transmission | `body` | `0.72` |
| Transmission | `absorption` | `0.58` |
| Transmission | `tint` | `0.00` |
| Reflection | `rim` | `0.72` |
| Reflection | `reflection` | `0.68` |
| Reflection | `highlight` | `0.38` |
| Reflection | `lightAngle` | `136.00` |
| Reflection | `echo` | `0.28` |
| Interface | `hairline` | `0.92` |
| Interface | `hairWidth` | `0.52` |
| Shape | `roundness` | `0.47` |

For live backdrops, V2 updates its optical transmission every frame but rate-limits the
low-resolution light probe and eases the detected highlight direction over roughly 280 ms.
Reflection also samples a softened backdrop. These safeguards reduce highlight flashing on
moving high-contrast content without freezing refraction or changing the parameter contract.

## V1 default material parameters

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
| Shape | `sizeAdaptation` | `1.00` |
| Optics | `ior` | `2.00` |
| Optics | `dispersion` | `0.06` |
| Optics | `refractScale` | `3.00` |
| Optics | `meniscus` | `1.00` |
| Optics | `blurPlateau` | `4.50` |
| Optics | `blurRim` | `11.00` |
| Optics | `opticalDensity` | `0.40` |
| Lighting | `specular` | `0.89` |
| Lighting | `specPower` | `29.50` |
| Lighting | `highlightAdapt` | `0.91` |
| Lighting | `highlightWidth` | `0.87` |
| Lighting | `highlightSharpness` | `0.55` |
| Lighting | `highlightBase` | `0.30` |
| Lighting | `fresnel` | `0.65` |
| Lighting | `saturation` | `1.35` |
| Lighting | `brightness` | `0.00` |
| Lighting | `tintAmount` | `0.02` |
| Lighting | `tintAdapt` | `0.14` |
| Edge | `shadow` | `0.09` |
| Edge | `shadowSize` | `4.00` |
| Edge | `shadowOffset` | `0.00` |
| Edge | `lightX` | `-0.18` |
| Edge | `lightY` | `0.08` |
| Edge | `edgeLine` | `0.30` |
| Edge | `edgeWidth` | `0.50` |
| Edge | `edgeDark` | `0.02` |

The returned object also includes `tintColor: [1, 1, 1]` and `debug: 0`. Parameter names use the JavaScript API names; for example, `highlightAdapt` is the “Light adaptation” control and `edgeLine` is the “Edge highlight” control. Set `sizeAdaptation` to `0` when material lengths must remain absolute; intermediate values blend between absolute and fitted optics.

Backdrop RGB is stored in `SRGB8_ALPHA8`: image uploads decode to linear light, every downsample and tent-upsample pass filters linear radiance, and writes encode back to sRGB. Alpha remains linear for the optical-density channel. Wide blur blends in the reconstructed chain to avoid coarse-mip breathing; final glass output receives a sub-LSB triangular dither to suppress dark-gradient banding. `tintAdapt` controls the component-level light/dark material switch (`0` keeps `tintColor` fixed, `1` fully follows the backdrop below the component).

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

## Hit testing

`hitTest()` evaluates the same signed distance field as the shader, so a pointer lands on the shape rather than on its bounding box: the corners of a circle are not clickable, and inside a fused group the bridge between two components is.

```js
canvas.addEventListener('pointerdown', (event) => {
  const element = glass.hitTestEvent(event); // null outside the surface
  if (element) startDragging(element.id);
});

const { x, y } = glass.pointerPosition(event); // canvas-relative CSS pixels
glass.hitTest(x, y, { tolerance: 8 });         // slack for coarse pointers
glass.distanceAt(x, y);                        // signed distance, negative inside
```

A gap between two components only closes into a bridge while it is narrower than about half the fusion distance; past that, `mergeRadius` only softens the approach.

## Rendering behaviour

`render()` returns without touching the GPU when nothing changed since the last frame, so an animation loop over a static scene is free. Every mutator marks the component dirty; a live backdrop always redraws. The sampled backdrop and its mip chain have a separate dirty flag, so moving a shape or changing its material only redraws the visible glass passes.

```js
glass.render();                  // no-op when clean
glass.render({ force: true });   // always draws, for pixel read-back
glass.markDirty();               // after mutating glass.material in place
glass.markBackdropDirty();       // after changing a backdrop source in place
```

Pass `preserveDrawingBuffer: true` if you read the canvas back with `readPixels` or `toDataURL` after the frame has been composited.

## Context loss and accessibility

A GPU context can be lost at any time. The component takes over recovery: the canvas holds its last frame, every call is a safe no-op while the context is gone, and programs, render targets and backdrop textures are rebuilt when the browser restores it.

```js
const glass = new LiquidGlassWebGL(canvas, {
  onContextLost: () => showPlaceholder(),
  onContextRestored: () => hidePlaceholder(),
});

glass.contextLost; // true while the surface is frozen
```

Under `prefers-reduced-transparency: reduce` the material falls back to a near-opaque surface: refraction, dispersion and scattering are removed while the shape, edge and shadow stay. Opt out with `respectReducedTransparency: false`, and read `glass.effectiveMaterial` for the parameters actually in use.

`autoResize` (on by default) redraws when the canvas element is resized, which dirty tracking would otherwise miss in an app that renders on demand.

## API

```js
LiquidGlassWebGL.isSupported();

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
glass.hitTest(x, y);
glass.resize();
glass.destroy();
```

Available presets are `regular`, `clear`, and `lens`. Available shapes are `folder`, `rect`, `pill`, and `circle`. With `fusion` enabled, nearby elements are evaluated as one smooth-union distance field, so their silhouette, normals, refraction, highlights, and shadow merge continuously.

The shader carries 16 shapes per pass. Elements too far apart to influence each other are split into separate passes automatically, so the 16 shape limit applies per fused cluster rather than per scene; a cluster larger than that is still split, and logs a warning explaining that the silhouette will not bridge across every one of them.

The geometry helpers behind all of this are exported for use without a canvas — `sdGroup`, `hitTestElements`, `connectedElementGroups` and `groupElements`.

V2 mirrors the backdrop, element, lifecycle, resize and hit-test methods used above through
`LiquidGlassWebGLV2`. It additionally exports `getDefaultMaterialV2()`, `makeMaterialV2()`,
`distanceToElementsV2()` and `hitTestElementsV2()`. It deliberately has no `setFusion()` method.

## Playground

The interactive demo used to develop the material is deployed at
[oliverrr2424.github.io/webgl-apple-liquid-glass](https://oliverrr2424.github.io/webgl-apple-liquid-glass/), or run it locally:

```bash
npm install
npm run serve
```

Open [http://localhost:8765](http://localhost:8765). It drives the published component through its public API, and the inspector covers:

- Eight scenes: four wallpapers, plus fixed iPhone Home Page, Notification, and Control Centre references, and a scrolling feed that exercises the live backdrop path.
- Component editing: add, retype, resize and delete surfaces; drag them, or select one and use the arrow keys (`Shift` for ten pixels, `Alt` to resize, `[` and `]` to cycle, `Delete` to remove).
- Every material parameter as both a slider and a typed value. Double click a parameter name to reset just that one; modified parameters are marked.
- A V1 Original / V2 Transparent switch. Each version retains its own tuned material while you compare them, and shared links record which renderer and parameter contract they use.
- **Copy link** puts the whole session in the URL, **Copy code** emits the snippet that reproduces it.
- A frame-rate, CPU-per-frame, drawing-buffer and pass-count readout. A static scene reports `idle`, because dirty tracking skips the GPU entirely.
- Local image or looping-video uploads, and the thickness, normals and dispersion debug outputs.

## Development

```bash
npm test                     # unit tests, then the browser test pages
npm run test:visual          # golden image comparison
npm run test:visual:update   # record a baseline for this renderer
npm run shot shots/liquid-glass.png -- --scene 0 --size 1200x720 --no-panel
npm run pack:check
```

`tests/*.test.mjs` are Node unit tests over the geometry and material rules. `tests/*.html` are browser pages, each exporting `window.runTest()`; they cover live and static backdrops, context loss and recovery, and the dirty-tracking contract by counting draw calls.

Visual regression forces ANGLE's deterministic SwiftShader backend. Baselines live in `shots/baseline/<renderer>/`; Linux's Subzero JIT and macOS's LLVM JIT have separate golden sets because a small number of edge pixels round differently. A missing baseline fails the run, and rejected frames are written to `shots/tmp-*.png`.

## Automated npm publishing

Every push to `main` runs [`.github/workflows/ci.yml`](.github/workflows/ci.yml) and then [`.github/workflows/publish-npm.yml`](.github/workflows/publish-npm.yml), which publishes with provenance when the version in `package.json` is newer than the version already on npm. Publishing depends on the test job, so a failing test blocks the release.

To enable publishing, add a repository secret named `NPM_TOKEN` containing an npm token with permission to publish `apple-liquid-glass-webgl`. Bump the package version before pushing a release to `main`.

## License

MIT
