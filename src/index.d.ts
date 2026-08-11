export type LiquidGlassShape = 'folder' | 'rect' | 'pill' | 'circle';
export type LiquidGlassPreset = 'regular' | 'clear' | 'lens';

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
  elements?: LiquidGlassElement[];
}

export declare const SHAPES: {
  readonly FOLDER: 'folder';
  readonly RECT: 'rect';
  readonly PILL: 'pill';
  readonly CIRCLE: 'circle';
};

export declare const DEFAULT_MATERIAL: Readonly<LiquidGlassMaterial>;
export declare const PRESETS: Record<LiquidGlassPreset, Partial<LiquidGlassMaterial>>;
export declare function getDefaultMaterial(): LiquidGlassMaterial;
export declare function makeMaterial(preset?: LiquidGlassPreset): LiquidGlassMaterial;

export declare class LiquidGlassWebGL {
  constructor(canvas: HTMLCanvasElement, options?: LiquidGlassOptions);
  elements: LiquidGlassElement[];
  setElements(elements: LiquidGlassElement[]): this;
  addElement(element: LiquidGlassElement): string;
  updateElement(id: string, patch: LiquidGlassElement): this;
  removeElement(id: string): this;
  setMaterial(materialOrPreset: LiquidGlassPreset | Partial<LiquidGlassMaterial>): this;
  setFusion(enabled: boolean, mergeRadius?: number): this;
  setWallpapers(images: CanvasImageSource[]): this;
  loadWallpapers(sources: Array<string | CanvasImageSource>): Promise<this>;
  setWallpaper(source: string | CanvasImageSource): Promise<this>;
  setWallpaperIndex(index: number): this;
  resize(width?: number, height?: number, dpr?: number): { width: number; height: number; dpr: number };
  render(): this;
  destroy(): void;
}
