// Legacy V1 compatibility entry point. The implementation remains available,
// but the package root now exposes the current transparent optical renderer.
export {
  LiquidGlassWebGLV1 as LiquidGlassWebGL,
  DEFAULT_MATERIAL_V1 as DEFAULT_MATERIAL,
  PRESETS_V1 as PRESETS,
  REDUCED_TRANSPARENCY_MATERIAL_V1 as REDUCED_TRANSPARENCY_MATERIAL,
  getDefaultMaterialV1 as getDefaultMaterial,
  makeMaterialV1 as makeMaterial,
  MAX_GLASS_SHAPES, MIPS, connectedElementGroups, groupElements,
  hitTestElementsV1 as hitTestElements, sdGroup,
} from './index.js';
