export type LiquidGlassShape = 'folder' | 'rect' | 'pill' | 'circle';
export type LiquidGlassPreset = 'regular' | 'clear' | 'lens';

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
  material?: LiquidGlassPreset | Record<string, unknown>;
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

export declare const DEFAULT_MATERIAL: Record<string, unknown>;
export declare const PRESETS: Record<LiquidGlassPreset, Record<string, unknown>>;
export declare function makeMaterial(preset?: LiquidGlassPreset): Record<string, unknown>;

export declare class LiquidGlassWebGL {
  constructor(canvas: HTMLCanvasElement, options?: LiquidGlassOptions);
  elements: LiquidGlassElement[];
  setElements(elements: LiquidGlassElement[]): this;
  addElement(element: LiquidGlassElement): string;
  updateElement(id: string, patch: LiquidGlassElement): this;
  removeElement(id: string): this;
  setMaterial(materialOrPreset: LiquidGlassPreset | Record<string, unknown>): this;
  setFusion(enabled: boolean, mergeRadius?: number): this;
  setWallpapers(images: CanvasImageSource[]): this;
  loadWallpapers(sources: Array<string | CanvasImageSource>): Promise<this>;
  setWallpaper(source: string | CanvasImageSource): Promise<this>;
  setWallpaperIndex(index: number): this;
  resize(width?: number, height?: number, dpr?: number): { width: number; height: number; dpr: number };
  render(): this;
  destroy(): void;
}
