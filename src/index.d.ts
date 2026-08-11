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
  [key: string]: unknown;
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
export declare function getDefaultMaterial(): LiquidGlassMaterial;
export declare function makeMaterial(preset?: LiquidGlassPreset): LiquidGlassMaterial;

export declare class LiquidGlassWebGL {
  constructor(canvas: HTMLCanvasElement, options?: LiquidGlassOptions);
  compositeMode: LiquidGlassCompositeMode;
  running: boolean;
  elements: LiquidGlassElement[];
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
  start(): this;
  stop(): this;
  resize(width?: number, height?: number, dpr?: number): { width: number; height: number; dpr: number };
  render(): this;
  destroy(): void;
}
