import type { LiquidGlassV2Material } from './v2.js';
import type { LiquidGlassBackdropInput } from './dom.js';

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
  /** What is behind the control. Default `auto` (read from the page). */
  backdrop?: LiquidGlassBackdropInput | null;
  /** Resting track material. Pressed transmission uses PRESSED_CONTROL_MATERIAL_V2. */
  material?: Partial<LiquidGlassV2Material>;
  /**
   * Size in CSS px. The control fills its container; these set the
   * container's size, and are only needed when your CSS does not.
   */
  width?: number;
  height?: number;
  disabled?: boolean;
  ariaLabel?: string;
  /** Redraw every frame (a playing video/canvas backdrop). Default `auto`. */
  live?: boolean | 'auto';
}

export interface LiquidGlassNavbarOptions<T = string> extends LiquidGlassControlOptions {
  /** Two or more items. */
  items?: Array<LiquidGlassNavbarItem<T> | string>;
  value?: T;
  lens?: Partial<LiquidGlassNavigationLens>;
  /** Track tint, default 0.86 (the playground's white track). */
  tint?: number;
  /** `dark` also darkens the selection and defaults labels to white. */
  tintTone?: 'light' | 'dark' | 'auto';
  labelColor?: string;
  fontSize?: number;
  onChange?: (value: T, index: number) => void;
}

export interface LiquidGlassSwitchOptions extends LiquidGlassControlOptions {
  checked?: boolean;
  /** Track colour when on. Default iOS green. */
  color?: string;
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

declare class LiquidGlassControl {
  readonly container: HTMLElement;
  /** Resolves after the first frame with a loaded backdrop. */
  readonly ready: Promise<this>;
  readonly supported: boolean;
  /** Replace the backdrop; resolves once it has been drawn. */
  setBackdrop(backdrop: LiquidGlassBackdropInput | null): Promise<this>;
  setMaterial(material: Partial<LiquidGlassV2Material>): this;
  setDisabled(disabled: boolean): this;
  /** Re-resolve the backdrop and redraw next frame. */
  refresh(): this;
  /** Alias of refresh(). */
  updateBackdrop(): this;
  render(): this;
  destroy(): void;
}

export declare class LiquidGlassNavbar<T = string> extends LiquidGlassControl {
  static from(target: string | Element): LiquidGlassNavbar | LiquidGlassSwitch | null;
  constructor(container: string | HTMLElement, options?: LiquidGlassNavbarOptions<T>);
  readonly value: T;
  setValue(value: T, options?: { notify?: boolean }): this;
  setLens(lens: Partial<LiquidGlassNavigationLens>): this;
  setTintTone(tintTone: 'light' | 'dark' | 'auto'): this;
}

export declare class LiquidGlassSwitch extends LiquidGlassControl {
  static from(target: string | Element): LiquidGlassNavbar | LiquidGlassSwitch | null;
  constructor(container: string | HTMLElement, options?: LiquidGlassSwitchOptions);
  readonly checked: boolean;
  setChecked(checked: boolean, options?: { notify?: boolean }): this;
}
