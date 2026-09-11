export type LiquidGlassV2Shape = 'folder' | 'rect' | 'pill' | 'circle';
export type LiquidGlassV2CompositeMode = 'replace' | 'overlay';
export type LiquidGlassV2BackdropUpdate = 'auto' | 'static' | 'live';

export interface LiquidGlassV2Material {
  refraction: number;
  /** Capture distance / component short side (0.17 = 15.3px on a 90px surface). */
  edgeReach: number;
  edgeWidth: number;
  dispersion: number;
  /** Softness ratio: backdrop pre-blur radius as a fraction of each component's short side. */
  frost: number;
  /** Absolute backdrop pre-blur radius in CSS pixels; combines with frost. Default 0. */
  backdropBlur: number;
  body: number;
  absorption: number;
  tint: number;
  rim: number;
  reflection: number;
  highlight: number;
  lightAngle: number;
  echo: number;
  hairline: number;
  hairWidth: number;
  roundness: number;
}

export interface LiquidGlassV2Element {
  id?: string;
  shape?: LiquidGlassV2Shape;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  w?: number;
  h?: number;
  size?: number;
  /** Override the material tint opacity for this surface. This lets a tinted
   * notification share a renderer with clear folders and controls. */
  tint?: number;
  /** Override the softness (size-relative pre-blur) ratio for this surface. */
  frost?: number;
  /** Premultiplied surface opacity. Primarily useful for seamless transitions
   * between a live glass pass and a cheaper resting representation. */
  opacity?: number;
  /** Pressed-in optical squash while held, from 0 (resting) to 1 (pressed). */
  pressure?: number;
  /** Per-axis weight of the pressed squash, `[x, y]` each 0..1 (default `[1, 1]`).
   * Lower x keeps a wide capsule's length while pressed; lower y keeps its height. */
  pressureAxes?: [number, number];
  /** Select a coherent light or dark tint for the whole surface. The default
   * is `light`, matching the switch material. `auto` derives its tone from a
   * fixed-size backdrop probe below the component, independent of its size. */
  tintTone?: 'auto' | 'light' | 'dark';
  [key: string]: unknown;
}

export interface ResolvedLiquidGlassV2Element extends LiquidGlassV2Element {
  id: string;
  shape: LiquidGlassV2Shape;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface LiquidGlassV2BackdropOptions {
  update?: LiquidGlassV2BackdropUpdate;
  autoStart?: boolean;
  shouldRender?: boolean;
}

export interface LiquidGlassV2Options {
  material?: Partial<LiquidGlassV2Material>;
  wallpaperZoom?: number;
  wallpapers?: CanvasImageSource[];
  backdrop?: CanvasImageSource;
  backdropUpdate?: LiquidGlassV2BackdropUpdate;
  compositeMode?: LiquidGlassV2CompositeMode;
  autoStart?: boolean;
  elements?: LiquidGlassV2Element[];
  preserveDrawingBuffer?: boolean;
  autoResize?: boolean;
  respectReducedTransparency?: boolean;
  onContextLost?: (event: Event) => void;
  onContextRestored?: (event: Event) => void;
}

export declare const DEFAULT_MATERIAL_V2: Readonly<LiquidGlassV2Material>;
export declare const REDUCED_TRANSPARENCY_MATERIAL_V2:
  Readonly<Partial<LiquidGlassV2Material>>;
export declare const SLIDERS_V2:
  ReadonlyArray<readonly [keyof LiquidGlassV2Material, number, number, number]>;

export declare function getDefaultMaterialV2(): LiquidGlassV2Material;
export declare function makeMaterialV2(
  overrides?: Partial<LiquidGlassV2Material>,
): LiquidGlassV2Material;
export declare function distanceToElementsV2(
  x: number,
  y: number,
  elements: LiquidGlassV2Element[],
  material?: Partial<LiquidGlassV2Material>,
): number;
export declare function hitTestElementsV2<T extends LiquidGlassV2Element>(
  x: number,
  y: number,
  elements: T[],
  material?: Partial<LiquidGlassV2Material>,
  options?: { tolerance?: number },
): T | null;

export declare class LiquidGlassWebGLV2 {
  static isSupported(): boolean;
  constructor(canvas: HTMLCanvasElement, options?: LiquidGlassV2Options);
  readonly version: 'v2';
  compositeMode: LiquidGlassV2CompositeMode;
  running: boolean;
  dirty: boolean;
  backdropDirty: boolean;
  material: LiquidGlassV2Material;
  elements: ResolvedLiquidGlassV2Element[];
  readonly contextLost: boolean;
  readonly reducedTransparency: boolean;
  readonly effectiveMaterial: LiquidGlassV2Material;
  markDirty(): this;
  markBackdropDirty(): this;
  setElements(elements: LiquidGlassV2Element[], shouldRender?: boolean): this;
  addElement(element: LiquidGlassV2Element, shouldRender?: boolean): string;
  updateElement(id: string, patch: LiquidGlassV2Element, shouldRender?: boolean): this;
  removeElement(id: string, shouldRender?: boolean): this;
  setMaterial(material: Partial<LiquidGlassV2Material>, shouldRender?: boolean): this;
  setWallpapers(images: CanvasImageSource[], shouldRender?: boolean): this;
  loadWallpapers(sources: Array<string | CanvasImageSource>, shouldRender?: boolean): Promise<this>;
  setWallpaper(source: string | CanvasImageSource, shouldRender?: boolean): Promise<this>;
  setBackdrop(source: CanvasImageSource, options?: LiquidGlassV2BackdropOptions): this;
  loadBackdrop(source: string | CanvasImageSource, options?: LiquidGlassV2BackdropOptions): Promise<this>;
  updateBackdrop(shouldRender?: boolean): this;
  setWallpaperIndex(index: number, shouldRender?: boolean): this;
  distanceAt(x: number, y: number): number;
  hitTest(x: number, y: number, options?: { tolerance?: number }): ResolvedLiquidGlassV2Element | null;
  hitTestEvent(
    event: PointerEvent | MouseEvent | TouchEvent,
    options?: { tolerance?: number },
  ): ResolvedLiquidGlassV2Element | null;
  pointerPosition(event: PointerEvent | MouseEvent | TouchEvent): { x: number; y: number };
  start(): this;
  stop(): this;
  resize(width?: number, height?: number, dpr?: number): { width: number; height: number; dpr: number };
  /** Draw a frame. `dpr` can temporarily lower the rendering resolution for
   * an expensive live transition without changing CSS-space geometry. */
  render(options?: { force?: boolean; dpr?: number }): this;
  destroy(): void;
}
