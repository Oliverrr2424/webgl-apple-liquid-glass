import type { LiquidGlassV2Material } from './v2.js';

export interface LiquidGlassNavigationLens {
  outerWidth: number;
  outerHeight: number;
  innerLength: number;
  innerHeight: number;
}

export interface LiquidGlassNavbarItem<T = string> {
  value: T;
  label: string;
  icon?: string;
}

interface LiquidGlassControlOptions {
  /** Image/canvas/video painted behind the control and sampled by the glass. */
  backdrop?: string | CanvasImageSource | null;
  /** Resting track material. Pressed transmission uses PRESSED_CONTROL_MATERIAL_V2. */
  material?: Partial<LiquidGlassV2Material>;
  width?: number;
  height?: number;
  disabled?: boolean;
  ariaLabel?: string;
}

export interface LiquidGlassNavbarOptions<T = string> extends LiquidGlassControlOptions {
  /** Exactly two items. */
  items?: [LiquidGlassNavbarItem<T> | string, LiquidGlassNavbarItem<T> | string];
  value?: T;
  lens?: Partial<LiquidGlassNavigationLens>;
  labelColor?: string;
  fontSize?: number;
  onChange?: (value: T, index: number) => void;
}

export interface LiquidGlassSwitchOptions extends LiquidGlassControlOptions {
  checked?: boolean;
  onChange?: (checked: boolean) => void;
}

export declare const PRESSED_CONTROL_MATERIAL_V2:
  Readonly<Pick<LiquidGlassV2Material,
    'refraction' | 'edgeReach' | 'edgeWidth' | 'dispersion' | 'frost' |
    'backdropBlur' | 'body' | 'absorption' | 'tint'>>;
export declare const DEFAULT_NAVIGATION_LENS: Readonly<LiquidGlassNavigationLens>;
export declare function getPressedControlMaterialV2(
  material?: Partial<LiquidGlassV2Material>,
): LiquidGlassV2Material;

export declare class LiquidGlassNavbar<T = string> {
  constructor(container: HTMLElement, options?: LiquidGlassNavbarOptions<T>);
  readonly container: HTMLElement;
  readonly ready: Promise<this>;
  readonly supported: boolean;
  value: T;
  setValue(value: T, options?: { notify?: boolean }): this;
  setBackdrop(source: string | CanvasImageSource | null): Promise<this>;
  setMaterial(material: Partial<LiquidGlassV2Material>): this;
  setDisabled(disabled: boolean): this;
  updateBackdrop(): this;
  render(): this;
  destroy(): void;
}

export declare class LiquidGlassSwitch {
  constructor(container: HTMLElement, options?: LiquidGlassSwitchOptions);
  readonly container: HTMLElement;
  readonly ready: Promise<this>;
  readonly supported: boolean;
  readonly checked: boolean;
  setChecked(checked: boolean, options?: { notify?: boolean }): this;
  setBackdrop(source: string | CanvasImageSource | null): Promise<this>;
  setMaterial(material: Partial<LiquidGlassV2Material>): this;
  setDisabled(disabled: boolean): this;
  updateBackdrop(): this;
  render(): this;
  destroy(): void;
}
