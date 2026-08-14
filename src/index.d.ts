export type LiquidGlassShape = 'folder' | 'rect' | 'pill' | 'circle';
export type LiquidGlassPreset = 'regular' | 'clear' | 'lens';
export type LiquidGlassCompositeMode = 'replace' | 'overlay';
export type LiquidGlassBackdropUpdate = 'auto' | 'static' | 'live';

export interface LiquidGlassBackdropOptions {
  update?: LiquidGlassBackdropUpdate;
  autoStart?: boolean;
  shouldRender?: boolean;
}

export interface LiquidGlassMaterial {
  radius: number;
  squircle: number;
  mergeRadius: number;
  bevel: number;
  height: number;
  sizeAdaptation: number;
  ior: number;
  dispersion: number;
  refractScale: number;
  meniscus: number;
  blurPlateau: number;
  blurRim: number;
  opticalDensity: number;
  specular: number;
  specPower: number;
  lightX: number;
  lightY: number;
  highlightAdapt: number;
  highlightWidth: number;
  highlightSharpness: number;
  highlightBase: number;
  fresnel: number;
  saturation: number;
  brightness: number;
  tintAmount: number;
  tintColor: [number, number, number];
  tintAdapt: number;
  shadow: number;
  shadowSize: number;
  shadowOffset: number;
  edgeLine: number;
  edgeWidth: number;
  edgeDark: number;
  debug: number;
  [key: string]: unknown;
}

export interface LiquidGlassElement {
  id?: string;
  shape?: LiquidGlassShape;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  w?: number;
  h?: number;
  size?: number;
  radius?: number;
  [key: string]: unknown;
}

/** An element after normalization: `id`, `shape`, `x`, `y`, `w` and `h` are set. */
export interface ResolvedLiquidGlassElement extends LiquidGlassElement {
  id: string;
  shape: LiquidGlassShape;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface LiquidGlassHitTestOptions {
  /** Override the component's fusion mode for this query. */
  fusion?: boolean;
  /** Override the material's merge radius for this query. */
  mergeRadius?: number;
  /** Extra CSS pixels of slack around the surface. */
  tolerance?: number;
}

export interface LiquidGlassOptions {
  material?: LiquidGlassPreset | Partial<LiquidGlassMaterial>;
  fusion?: boolean;
  wallpaperZoom?: number;
  wallpapers?: Array<CanvasImageSource>;
  backdrop?: CanvasImageSource;
  backdropUpdate?: LiquidGlassBackdropUpdate;
  compositeMode?: LiquidGlassCompositeMode;
  autoStart?: boolean;
  elements?: LiquidGlassElement[];
  /** Keep the drawing buffer readable after compositing. Needed for pixel
   *  read-back and screenshots; costs memory bandwidth. Defaults to false. */
  preserveDrawingBuffer?: boolean;
  /** Redraw when the canvas element is resized. Defaults to true. */
  autoResize?: boolean;
  /** Fall back to a near-opaque material under
   *  `prefers-reduced-transparency: reduce`. Defaults to true. */
  respectReducedTransparency?: boolean;
  onContextLost?: (event: Event) => void;
  onContextRestored?: (event: Event) => void;
}

export declare const SHAPES: {
  readonly FOLDER: 'folder';
  readonly RECT: 'rect';
  readonly PILL: 'pill';
  readonly CIRCLE: 'circle';
};

export declare const COMPOSITE_MODES: {
  readonly REPLACE: 'replace';
  readonly OVERLAY: 'overlay';
};

export declare const BACKDROP_UPDATES: {
  readonly AUTO: 'auto';
  readonly STATIC: 'static';
  readonly LIVE: 'live';
};

export declare const DEFAULT_MATERIAL: Readonly<LiquidGlassMaterial>;
export declare const PRESETS: Record<LiquidGlassPreset, Partial<LiquidGlassMaterial>>;
export declare const REDUCED_TRANSPARENCY_MATERIAL: Readonly<Partial<LiquidGlassMaterial>>;
export declare const MAX_GLASS_SHAPES: number;
export declare const MIPS: number;
export declare function getDefaultMaterial(): LiquidGlassMaterial;
export declare function makeMaterial(preset?: LiquidGlassPreset): LiquidGlassMaterial;

/** Signed distance to the fused silhouette; the CPU mirror of the shader. */
export declare function sdGroup(
  x: number,
  y: number,
  elements: LiquidGlassElement[],
  material?: Partial<LiquidGlassMaterial>,
  mergeRadius?: number,
): number;

export declare function hitTestElements<T extends LiquidGlassElement>(
  x: number,
  y: number,
  elements: T[],
  material?: Partial<LiquidGlassMaterial>,
  options?: LiquidGlassHitTestOptions,
): T | null;

/** Sets of elements close enough for the smooth union to bridge them. */
export declare function connectedElementGroups<T extends LiquidGlassElement>(
  elements: T[],
  mergeRadius?: number,
): T[][];

/** Connected sets chunked to the shader's shape limit. */
export declare function groupElements<T extends LiquidGlassElement>(
  elements: T[],
  mergeRadius?: number,
  maxPerGroup?: number,
): { groups: T[][]; truncated: boolean };

export declare class LiquidGlassWebGL {
  /** Whether WebGL2 is usable here, without throwing. */
  static isSupported(): boolean;
  constructor(canvas: HTMLCanvasElement, options?: LiquidGlassOptions);
  compositeMode: LiquidGlassCompositeMode;
  running: boolean;
  dirty: boolean;
  backdropDirty: boolean;
  material: LiquidGlassMaterial;
  elements: ResolvedLiquidGlassElement[];
  readonly contextLost: boolean;
  readonly reducedTransparency: boolean;
  readonly effectiveMaterial: LiquidGlassMaterial;
  markDirty(): this;
  markBackdropDirty(): this;
  setElements(elements: LiquidGlassElement[], shouldRender?: boolean): this;
  addElement(element: LiquidGlassElement, shouldRender?: boolean): string;
  updateElement(id: string, patch: LiquidGlassElement, shouldRender?: boolean): this;
  removeElement(id: string, shouldRender?: boolean): this;
  setMaterial(materialOrPreset: LiquidGlassPreset | Partial<LiquidGlassMaterial>, shouldRender?: boolean): this;
  setFusion(enabled: boolean, mergeRadius?: number, shouldRender?: boolean): this;
  setWallpapers(images: CanvasImageSource[], shouldRender?: boolean): this;
  loadWallpapers(sources: Array<string | CanvasImageSource>, shouldRender?: boolean): Promise<this>;
  setWallpaper(source: string | CanvasImageSource, shouldRender?: boolean): Promise<this>;
  setBackdrop(source: CanvasImageSource, options?: LiquidGlassBackdropOptions): this;
  loadBackdrop(source: string | CanvasImageSource, options?: LiquidGlassBackdropOptions): Promise<this>;
  updateBackdrop(shouldRender?: boolean): this;
  setWallpaperIndex(index: number, shouldRender?: boolean): this;
  distanceAt(x: number, y: number, options?: LiquidGlassHitTestOptions): number;
  hitTest(x: number, y: number, options?: LiquidGlassHitTestOptions): ResolvedLiquidGlassElement | null;
  hitTestEvent(event: PointerEvent | MouseEvent | TouchEvent, options?: LiquidGlassHitTestOptions): ResolvedLiquidGlassElement | null;
  pointerPosition(event: PointerEvent | MouseEvent | TouchEvent): { x: number; y: number };
  start(): this;
  stop(): this;
  resize(width?: number, height?: number, dpr?: number): { width: number; height: number; dpr: number };
  render(options?: { force?: boolean }): this;
  destroy(): void;
}
