import type {
  LiquidGlassV2Material, LiquidGlassV2Shape, LiquidGlassWebGLV2,
} from './v2.js';

/** A viewport rectangle in CSS pixels. */
export interface LiquidGlassRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Paints part of the backdrop. `context` already maps viewport CSS pixels to
 * the buffer, so draw at page positions (`getBoundingClientRect()` values);
 * `region` is the viewport rectangle being painted.
 */
export type LiquidGlassBackdropPainter = (
  context: CanvasRenderingContext2D,
  region: LiquidGlassRegion,
) => void;

/** An image, canvas or video placed like CSS `object-fit` inside an anchor box. */
export interface LiquidGlassBackdropSource {
  /** Element, selector, image URL, or a detached image/canvas/video/bitmap. */
  source: string | Element | CanvasImageSource;
  /** Default: the element's `object-fit`, or `cover` for detached sources. */
  fit?: 'cover' | 'contain' | 'fill' | 'none' | 'scale-down';
  /** CSS position (`'50% 0%'`) or `[x, y]` ratios. Default centred. */
  position?: string | [number | string, number | string];
  /** Box the source is fitted into. Default: the element's own box, or the viewport. */
  anchor?: 'viewport' | 'document' | Element | string;
  opacity?: number;
}

/**
 * What is behind the glass. `'auto'` (the default) paints the page below the
 * element in CSS paint order: backgrounds, borders, `<img>`, `<video>`,
 * `<canvas>` and text. Not captured: `::before`/`::after`, shadows, filters,
 * SVG, form controls. A string is a CSS selector, or an image URL when
 * nothing matches. An array paints bottom to top.
 */
export type LiquidGlassBackdropInput =
  | 'auto'
  | string
  | Element
  | CanvasImageSource
  | LiquidGlassBackdropPainter
  | LiquidGlassBackdropSource
  | { color: string }
  | LiquidGlassBackdropInput[];

/** Per-surface look. */
export interface LiquidGlassSurfaceStyle {
  /** Milky tint opacity, 0 (clear) … 1.5. */
  tint?: number;
  /** Default `light`. `auto` picks light or dark from the backdrop. */
  tintTone?: 'light' | 'dark' | 'auto';
  /** Frosting: backdrop blur as a ratio of the short side, 0 … 1. */
  frost?: number;
  opacity?: number;
  /** Default `auto`: rect / pill / circle from the element's `border-radius`. */
  shape?: 'auto' | LiquidGlassV2Shape;
  /** Corner radius in CSS px. Default: the element's `border-radius`. */
  radius?: number;
}

export interface LiquidGlassTarget extends LiquidGlassSurfaceStyle {
  element: Element;
}

export interface LiquidGlassElementOptions extends LiquidGlassSurfaceStyle {
  backdrop?: LiquidGlassBackdropInput;
  /** Partial V2 material; unknown keys throw. */
  material?: Partial<LiquidGlassV2Material>;
  /**
   * Render several descendants as glass on one shared canvas (one WebGL
   * context) instead of the element itself. A selector is re-queried when
   * children change.
   */
  targets?: string | Iterable<Element | LiquidGlassTarget>;
  /**
   * Redraw every frame while visible. Default `auto`: on while a `<video>`
   * backdrop plays or a `<canvas>` backdrop is present.
   */
  live?: boolean | 'auto';
  /** Cap on device pixel ratio. Default 2. */
  maxDpr?: number;
  /** CSS px the canvas extends past the element for rim sampling. Default ≈ 38. */
  bleed?: number;
  /** z-index of the glass layer inside the element. Default -1 (behind content). */
  zIndex?: number;
  /**
   * Without WebGL2: `css` (default) applies `backdrop-filter`, `none` leaves
   * the element alone, or run your own. The element gets
   * `data-liquid-glass="webgl" | "fallback"` either way.
   */
  fallback?: 'css' | 'none' | ((element: HTMLElement) => void);
  /** Default true: a near-opaque material under `prefers-reduced-transparency`. */
  respectReducedTransparency?: boolean;
  onRender?: (surface: LiquidGlass) => void;
  onContextLost?: (event: Event) => void;
  onContextRestored?: (event: Event) => void;
}

export declare class LiquidGlass {
  static isSupported(): boolean;
  /** The instance mounted on an element, if any. */
  static from(target: string | Element): LiquidGlass | null;
  /** Re-measure and repaint every mounted surface and control next frame. */
  static refreshAll(): void;

  /** Mounting twice on one element replaces the first instance. */
  constructor(target: string | HTMLElement, options?: LiquidGlassElementOptions);

  readonly element: HTMLElement;
  readonly mode: 'pending' | 'webgl' | 'fallback';
  readonly supported: boolean;
  /** Resolves after the first frame with a fully loaded backdrop, or on fallback. */
  readonly ready: Promise<LiquidGlass>;
  /** The underlying renderer, created on first visible frame. */
  readonly glass: LiquidGlassWebGLV2 | null;
  readonly canvas: HTMLCanvasElement | null;
  readonly options: Readonly<LiquidGlassElementOptions>;

  /** Merge options; `material` merges into the current material. */
  update(options: LiquidGlassElementOptions): this;
  /** Re-resolve selectors and repaint next frame. */
  refresh(): this;
  destroy(): void;
}
