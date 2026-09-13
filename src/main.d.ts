/** Public API for the current transparent optical renderer. */
export {
  LiquidGlassWebGLV2 as LiquidGlassWebGL,
  DEFAULT_MATERIAL_V2 as DEFAULT_MATERIAL,
  REDUCED_TRANSPARENCY_MATERIAL_V2 as REDUCED_TRANSPARENCY_MATERIAL,
  SLIDERS_V2 as SLIDERS,
  getDefaultMaterialV2 as getDefaultMaterial,
  makeMaterialV2 as makeMaterial,
  distanceToElementsV2 as distanceToElements,
  hitTestElementsV2 as hitTestElements,
  // Compatibility names from the period when this renderer was called V2.
  LiquidGlassWebGLV2,
  DEFAULT_MATERIAL_V2,
  REDUCED_TRANSPARENCY_MATERIAL_V2,
  SLIDERS_V2,
  getDefaultMaterialV2,
  makeMaterialV2,
  distanceToElementsV2,
  hitTestElementsV2,
} from './v2.js';
export { SHAPES, COMPOSITE_MODES, BACKDROP_UPDATES } from './index.js';
export type {
  LiquidGlassV2Shape as LiquidGlassShape,
  LiquidGlassV2CompositeMode as LiquidGlassCompositeMode,
  LiquidGlassV2BackdropUpdate as LiquidGlassBackdropUpdate,
  LiquidGlassV2Material as LiquidGlassMaterial,
  LiquidGlassV2Element as LiquidGlassElement,
  ResolvedLiquidGlassV2Element as ResolvedLiquidGlassElement,
  LiquidGlassV2BackdropOptions as LiquidGlassBackdropOptions,
  LiquidGlassV2Options as LiquidGlassOptions,
  LiquidGlassV2Shape,
  LiquidGlassV2CompositeMode,
  LiquidGlassV2BackdropUpdate,
  LiquidGlassV2Material,
  LiquidGlassV2Element,
  ResolvedLiquidGlassV2Element,
  LiquidGlassV2BackdropOptions,
  LiquidGlassV2Options,
} from './v2.js';

/** Explicit names for the retained legacy renderer. */
export {
  LiquidGlassWebGL as LiquidGlassWebGLV1,
  DEFAULT_MATERIAL as DEFAULT_MATERIAL_V1,
  PRESETS as PRESETS_V1,
  REDUCED_TRANSPARENCY_MATERIAL as REDUCED_TRANSPARENCY_MATERIAL_V1,
  getDefaultMaterial as getDefaultMaterialV1,
  makeMaterial as makeMaterialV1,
  MAX_GLASS_SHAPES,
  MIPS,
  connectedElementGroups,
  groupElements,
  hitTestElements as hitTestElementsV1,
  sdGroup,
} from './index.js';
export type {
  LiquidGlassPreset as LiquidGlassV1Preset,
  LiquidGlassMaterial as LiquidGlassV1Material,
  LiquidGlassElement as LiquidGlassV1Element,
  ResolvedLiquidGlassElement as ResolvedLiquidGlassV1Element,
  LiquidGlassHitTestOptions as LiquidGlassV1HitTestOptions,
  LiquidGlassOptions as LiquidGlassV1Options,
} from './index.js';

export { LiquidGlass } from './dom.js';
export type {
  LiquidGlassElementOptions, LiquidGlassBackdropInput, LiquidGlassBackdropSource,
  LiquidGlassBackdropPainter, LiquidGlassSurfaceStyle, LiquidGlassTarget, LiquidGlassRegion,
} from './dom.js';
export {
  LiquidGlassNavbar, LiquidGlassSwitch,
  PRESSED_CONTROL_MATERIAL_V2, DEFAULT_NAVIGATION_LENS,
  getPressedControlMaterialV2,
} from './controls.js';
export type {
  LiquidGlassNavbarItem, LiquidGlassNavbarOptions, LiquidGlassSwitchOptions,
  LiquidGlassNavigationLens,
} from './controls.js';
