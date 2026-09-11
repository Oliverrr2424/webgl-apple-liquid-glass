# apple-liquid-glass-webgl

Apple-style liquid glass for the web, rendered with WebGL2. Point it at an element and it refracts what is actually behind that element on the page, while it scrolls, resizes and animates.

<table align="center" width="100%">
  <tr>
    <td align="center" width="50%">
      <img src="https://raw.githubusercontent.com/Oliverrr2424/webgl-apple-liquid-glass/main/assets/readme/v2-home-warm-interaction.gif" alt="Liquid Glass V2 Home screen interaction on the warm wallpaper" width="100%">
    </td>
    <td align="center" width="50%">
      <img src="https://raw.githubusercontent.com/Oliverrr2424/webgl-apple-liquid-glass/main/assets/readme/v2-home-sunset-interaction.gif" alt="Liquid Glass V2 Home screen interaction on the sunset wallpaper" width="100%">
    </td>
  </tr>
</table>

<p align="center">
  <img src="https://raw.githubusercontent.com/Oliverrr2424/webgl-apple-liquid-glass/main/assets/readme/v2-press-effects-interaction.gif" alt="Liquid Glass V2 press effects interaction" width="100%">
</p>

[Playground](https://oliverrr2424.github.io/webgl-apple-liquid-glass/) · [Landing page example](examples/landing)

## Install

```bash
npm install apple-liquid-glass-webgl
```

## Quick start

```js
import { LiquidGlass } from 'apple-liquid-glass-webgl';

new LiquidGlass('.navbar');
```

That is the whole integration:

- The element keeps its content, layout and events. The glass is drawn behind its children.
- Shape and corner radius come from its CSS `border-radius`.
- It follows the element through scrolling, resizing, CSS transitions and JS animation.
- Without WebGL2 it falls back to `backdrop-filter`. The element gets `data-liquid-glass="webgl"` or `"fallback"` for styling.

## What is behind the glass

Browsers do not let WebGL read page pixels, so the glass has to be told what is behind it. The default, `backdrop: 'auto'`, reads the page. It picks up CSS backgrounds (colors, images, gradients) of the page and the element's ancestors, plus large backgrounds painted before it, such as a full-screen `<video>`, `<canvas>` or fixed gradient `<div>`. When that is not enough, say what is behind:

| `backdrop` | Use it for |
| --- | --- |
| `'auto'` | CSS backgrounds and full-screen media (default) |
| `'#hero-video'` or an element | a specific `<img>`, `<video>`, `<canvas>`, or an element's CSS background, where it sits on the page |
| `'/wallpaper.jpg'` | an image covering the viewport, like a fixed wallpaper |
| `{ source, fit, position, anchor }` | an image/canvas/video fitted like `object-fit` into `'viewport'`, `'document'` or an element |
| `(ctx, region) => { … }` | anything else: draw it yourself in page coordinates |
| `[ … ]` | several of the above, bottom to top |

Everything is registered in page coordinates, so the part of the photo under a card is the part of the photo under that card. `auto` captures **backgrounds only**. Text and images in the page flow are not captured; paint them yourself if they pass under the glass (see [Content under the glass](#content-under-the-glass)).

## Options

```js
new LiquidGlass(element, {
  tint: 0.2,            // milky layer, 0–1.5 (default 0: clear)
  tintTone: 'dark',     // 'light' (default), 'dark', or 'auto' from the backdrop
  frost: 0.3,           // blur behind the lens, as a ratio of the short side (default 0)
  backdrop: 'auto',
  material: { refraction: 70 },   // partial V2 material, see below
});
```

| Option | Default | |
| --- | --- | --- |
| `tint`, `tintTone`, `frost`, `opacity` | `0`, `'light'`, `0`, `1` | The look. Use `tintTone: 'dark'` behind white text. |
| `backdrop` | `'auto'` | See above. |
| `material` | V2 default | Partial [material](#material). Unknown keys throw. |
| `targets` | — | Selector or elements: draw several descendants as glass on one canvas. |
| `shape`, `radius` | from CSS | `'rect' \| 'pill' \| 'circle'`, CSS px. |
| `live` | `'auto'` | Redraw every frame. `auto` is on while a video plays or a canvas is in the backdrop. |
| `fallback` | `'css'` | `'css'`, `'none'`, or `(element) => {}`. |
| `maxDpr` | `2` | Resolution cap. |
| `zIndex` | `-1` | Glass layer inside the element: behind its content. |
| `respectReducedTransparency` | `true` | Near-opaque glass under `prefers-reduced-transparency`. |

```js
const glass = new LiquidGlass('.card', options);
await glass.ready;                 // first frame drawn, images loaded
glass.update({ tint: 0.4 });       // merge options
glass.refresh();                   // re-read selectors and repaint
glass.destroy();                   // restores the element, frees the WebGL context

LiquidGlass.isSupported();         // WebGL2 available
LiquidGlass.from('.card');         // the instance on an element
LiquidGlass.refreshAll();          // repaint everything next frame
```

## Recipes

### Readable text

Clear glass over a busy photo is beautiful and unreadable. Give text a body. `tint` ramps in gently, so readable values sit around 0.5–0.8:

```js
new LiquidGlass('.panel', { frost: 0.45, tint: 0.5, tintTone: 'light' }); // dark text
new LiquidGlass('.toast', { frost: 0.3, tint: 0.7, tintTone: 'dark' });   // white text
```

### A grid of cards

Each `LiquidGlass` uses one WebGL context, and browsers allow about 16. Put a group on one canvas:

```js
new LiquidGlass('.card-grid', { targets: '.card', frost: 0.3, tint: 0.2 });
```

Cards added or removed later are picked up. For per-card looks, pass `targets: [{ element, tint, frost }]`.

### Video, canvas and WebGL backgrounds

A full-screen `<video>` or `<canvas>` behind the page is found by `auto` and redrawn while it changes. Point at it explicitly if it is smaller or not behind everything: `backdrop: '#bg-video'`.

A WebGL canvas (three.js, Pixi, …) is cleared after each frame. Create it with `preserveDrawingBuffer: true`, or call `LiquidGlass.refreshAll()` right after you render.

### React, Vue, Svelte

Mount after the element exists and destroy on unmount. This is safe under React StrictMode's double mount.

```jsx
function Glass({ options, ...props }) {
  const ref = useRef(null);
  useEffect(() => {
    const glass = new LiquidGlass(ref.current, options);
    return () => glass.destroy();
  }, []);
  return <div ref={ref} {...props} />;
}
```

```js
// Vue
onMounted(() => { glass = new LiquidGlass(el.value, { tint: 0.2 }); });
onBeforeUnmount(() => glass.destroy());

// Svelte action: <nav use:liquidGlass={{ tint: 0.2 }}>
export const liquidGlass = (node, options) => {
  const glass = new LiquidGlass(node, options);
  return { update: (next) => glass.update(next), destroy: () => glass.destroy() };
};
```

Importing is safe during server rendering. Construct only in the browser (effects, `onMounted`).

### Content under the glass

Draw extra layers with a painter. The context is already in page coordinates, so `getBoundingClientRect()` values land where they are on screen:

```js
const title = document.querySelector('h1');
new LiquidGlass('.sticky-bar', {
  backdrop: ['auto', (ctx) => {
    const box = title.getBoundingClientRect();
    const style = getComputedStyle(title);
    ctx.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
    ctx.fillStyle = style.color;
    ctx.textBaseline = 'top';
    ctx.fillText(title.textContent, box.left, box.top);
  }],
});
```

### Changes the page does not announce

Scroll, resize, CSS transitions and inline-style or class changes on the element, its ancestors or its backdrop elements are all picked up. Drawing into a canvas, or moving something unrelated that sits behind the glass, is not: call `LiquidGlass.refreshAll()`, or set `live: true` while it happens.

## Navbar and switch

Ready-made controls with the pressed liquid lens, drag, springs, keyboard and ARIA. Size them with CSS; like `LiquidGlass`, they read the page behind them.

```js
import { LiquidGlassNavbar, LiquidGlassSwitch } from 'apple-liquid-glass-webgl';

const nav = new LiquidGlassNavbar('#nav', {        // #nav { width: 330px; height: 56px }
  items: [
    { value: 'home', label: 'Home' },
    { value: 'work', label: 'Work', icon: '▣' },
    { value: 'read', label: 'Read' },
  ],
  value: 'home',
  onChange: (value, index) => router.push(value),
});

const toggle = new LiquidGlassSwitch('#dark-mode', { // #dark-mode { width: 64px; height: 30px }
  checked: false,
  onChange: (checked) => document.documentElement.classList.toggle('dark', checked),
});

nav.setValue('work');                  // controlled update, no onChange
toggle.setChecked(true, { notify: true });
```

Options shared with `LiquidGlass`: `backdrop`, `material`, `live`. The navbar also takes `tint` (track, default `0.86`), `labelColor`, `fontSize`, `lens`. Both take `disabled` and `ariaLabel`, and dispatch a bubbling `change` event. An unsized container gets 312×72 (navbar) or 92×40 (switch). Leave `overflow` visible: the pressed lens grows past the track.

## Material

`getDefaultMaterialV2()` returns a fresh copy. Ratios are relative to each surface's short side, so one material works from a 40 px toggle to a 400 px card.

| Group | Key | Default | Meaning |
| --- | --- | ---: | --- |
| Transmission | `refraction` | `84` | Body bending strength (0–110) |
| | `edgeReach` | `0.17` | Edge capture distance / short side. `0` disables capture |
| | `edgeWidth` | `0.11` | Capture band width / short half-side |
| | `dispersion` | `2.0` | RGB split, display px |
| | `frost` | `0` | Pre-blur radius / short side (per-element `frost` overrides) |
| | `backdropBlur` | `0` | Pre-blur radius in CSS px; combines with `frost` |
| | `body` | `0.72` | Glass body density |
| | `absorption` | `0.58` | Path absorption |
| | `tint` | `0` | Tint opacity (per-element `tint` overrides) |
| Reflection | `rim` | `0.24` | Edge light |
| | `reflection` | `0.31` | Backdrop reflection in the rim |
| | `highlight` | `0.34` | Specular highlight; `0` removes it |
| | `lightAngle` | `136` | Fallback light direction, degrees |
| | `echo` | `0.28` | Inner echo |
| Interface | `hairline` | `0.92` | Contour line strength |
| | `hairWidth` | `0.52` | Contour line width |
| | `roundness` | `0.47` | Corner radius / short half-side, when there is no CSS radius |

The playground edits every value live; **Copy code** gives you the material.

## Canvas renderer

`LiquidGlassWebGLV2` is the renderer underneath. Use it when you own the canvas and compose the frame yourself: canvas apps, games, WebGL scenes. Coordinates are canvas CSS pixels, and the backdrop is whatever you hand it.

```js
import { LiquidGlassWebGLV2 } from 'apple-liquid-glass-webgl';

const glass = new LiquidGlassWebGLV2(canvas, { compositeMode: 'overlay' });
glass.setBackdrop(sceneCanvas);         // canvas/video: live, image: static
glass.setElements([
  { id: 'bar', shape: 'pill', x: 100, y: 28, width: 560, height: 66, tint: 0.2 },
  { id: 'lens', shape: 'circle', x: 300, y: 200, size: 120, pressure: 0.6 },
]);
glass.render();
```

- **Elements:** `{ id, shape: 'rect' | 'pill' | 'circle', x, y, width, height | size, radius, tint, tintTone, frost, opacity, pressure, pressureAxes }`. `pressure` (0–1) squashes what is seen through a held control; `pressureAxes` weights it per axis.
- **Backdrop:** `setBackdrop(source, { update: 'auto' | 'static' | 'live' })`, `loadBackdrop(url)`, `updateBackdrop()` after you draw into a static source. `compositeMode: 'replace'` (default) paints the backdrop too; `'overlay'` leaves the rest of the canvas transparent.
- **Frames:** `render()` is a no-op when nothing changed, and `render({ force: true })` always draws. `start()` / `stop()` run a loop for live sources.
- **Hit testing:** `hitTestEvent(event)`, `hitTest(x, y)` and `distanceAt(x, y)` use the shader's own geometry.
- Also: `setMaterial(partial)`, `updateElement(id, patch)`, `resize()`, `destroy()`, `onContextLost` / `onContextRestored` (context loss is handled), `effectiveMaterial` (after reduced transparency).

<details>
<summary>V1 renderer</summary>

`LiquidGlassWebGL` is the original frosted model: bevel height field, variable blur, and smooth-union fusion of nearby shapes. Same element and backdrop API; its material is separate and not interchangeable with V2.

```js
import { LiquidGlassWebGL, makeMaterial } from 'apple-liquid-glass-webgl';
const v1 = new LiquidGlassWebGL(canvas, { material: 'regular', fusion: true }); // 'regular' | 'clear' | 'lens'
```

Lengths are CSS pixels, and `sizeAdaptation` fits them to small controls. `setFusion(enabled, mergeRadius)` controls merging. See `src/index.d.ts` for every material key.
</details>

## Limits

- About 16 WebGL contexts per page. A `LiquidGlass` element or switch uses one and a navbar uses two. Group with `targets`.
- `auto` captures backgrounds, not text, borders or shadows. Use a painter for those.
- Scale and translate transforms are followed; rotation is not.
- Cross-origin images need CORS headers.

## Development

```bash
npm install
npm run serve             # playground at http://localhost:8765, example at /examples/landing/
npm test                  # unit tests + browser pages in headless Chromium
npm run test:visual       # golden screenshots; --update to re-record
```

Pushes to `main` run [CI](.github/workflows/ci.yml); [publish-npm.yml](.github/workflows/publish-npm.yml) publishes when `package.json` is ahead of npm.

## License

MIT
