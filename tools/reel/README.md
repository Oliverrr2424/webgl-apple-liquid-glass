# Reel

A 1080p60 demo film of the four `Scene` components — folder, rect, pill, circle —
held on screen while nine backdrops cut past behind them. Nothing else is drawn:
no icons, no chrome — just the glass, a standing watermark with the package
name and repository, and a closing card with the same two lines.

Two stretches double as material demos, and are the only moments with text on
screen. Both are spread across several scenes, so a held value is always seen
against a changing backdrop rather than parked on one:

- `backdropBlur` rises 0 → 4px over the city lights, holds across two cuts and
  releases back to 0 over the kaleidoscope.
- The appearance switch runs dark → light → dark across the sunset, the tunnel
  and the marble: dark glass (`tint: 1`) lands on the bright scenes, light glass
  (`tint: 0.42`) on the dark one, and every swap happens on a cut.
- The closing shot over the Earth brings `backdropBlur` back at 5px and holds it
  there under the end card.

`tools/reel/readme-gif.mjs` cuts the README GIFs from the same sources: the Home
screen and the press-effects lab are captured live from the playground with real
pointer events, the third is a slice of this film. Each one is encoded down a
ladder of width and palette size until it fits. The budget is GitHub's: its image
proxy refuses anything over `CAMO_LENGTH_LIMIT`, 5242880 bytes, and a README
image it refuses simply does not render.

## Run it

```bash
npm run serve                                   # static server on :8765
node tools/reel/record.mjs --out shots/tmp-reel/reel.mp4
```

Stills instead of a film, for checking a scene:

```bash
node tools/reel/record.mjs --stills 0,9000,25800 --dir shots/tmp-reel
```

To watch it live in a browser, open
`http://localhost:8765/tools/reel/index.html` and run `__reel.play()` in the
console.

## How it works

- `backgrounds.js` — the backdrops. Five are fragment shaders (flow lines,
  ribbons, neon tunnel, liquid chrome, kaleidoscope); the rest are the
  repository's own wallpapers with a Ken Burns push. Two scenes render into offscreen targets so a composite pass can
  fade, wipe, iris, push, zoom or slat one into the next.
- `reel.js` — the timeline. It drives `LiquidGlassWebGLV2` in `overlay` mode with
  the background canvas as a live backdrop, morphs the four surfaces between
  four layouts and drifts them. All four share one centred 2x2: the square
  surfaces on one diagonal, the wide ones on the other, column and row centres
  mirrored about the middle of the frame. Every surface keeps its own quadrant
  in every layout, so a morph can never pass one through another;
  `__reel.minGap()` and `__reel.textClearance()` check that over the whole
  timeline.
- `record.mjs` — the recorder. It steps the page with `__reel.seek(ms)` and pipes
  each screenshot into ffmpeg, so capture speed cannot affect the result: the
  same command always produces the same frames.

The recorder runs headed on purpose — headless Chromium falls back to
SwiftShader, and the reel wants a real GPU.
