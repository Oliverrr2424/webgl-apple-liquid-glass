// CPU mirror of the V2 transparent shader's geometry. V2 keeps its independent
// optical material and non-fusing passes, but uses the same three visual
// primitives as V1: folder/rect, capsule and circle.

export const SHAPE_TYPES_V2 = Object.freeze({ rect: 0, folder: 0, pill: 1, circle: 2 });

export function shapeTypeOfV2(shape) {
  return SHAPE_TYPES_V2[shape] ?? 0;
}

export function sdRoundBoxV2(px, py, halfX, halfY, radius) {
  const r = Math.min(radius, halfX, halfY);
  const qx = Math.abs(px) - halfX + r;
  const qy = Math.abs(py) - halfY + r;
  return Math.min(Math.max(qx, qy), 0) + Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) - r;
}

export function smoothUnionV2(d1, d2, radius) {
  if (!(radius > 0)) return Math.min(d1, d2);
  const h = Math.max(0, Math.min(1, 0.5 + 0.5 * (d2 - d1) / radius));
  return d2 * (1 - h) + d1 * h - radius * h * (1 - h);
}

export function cornerRadiusV2(element, roundness = 0.47) {
  const width = Number(element.w ?? element.width ?? element.size ?? 0);
  const height = Number(element.h ?? element.height ?? element.size ?? width);
  return Math.min(width, height) * 0.5 * roundness;
}

export function sdElementV2(x, y, element, material = {}) {
  const width = Number(element.w ?? element.width ?? element.size ?? 0);
  const height = Number(element.h ?? element.height ?? element.size ?? width);
  const halfX = width / 2;
  const halfY = height / 2;
  const px = x - Number(element.x ?? 0) - halfX;
  const py = y - Number(element.y ?? 0) - halfY;
  const kind = shapeTypeOfV2(element.shape);
  const radius = cornerRadiusV2({ ...element, w: width, h: height }, material.roundness ?? 0.47);

  if (kind === 1) return sdRoundBoxV2(px, py, halfX, halfY, Math.min(halfX, halfY));
  if (kind === 2) return Math.hypot(px, py) - Math.min(halfX, halfY);
  return sdRoundBoxV2(px, py, halfX, halfY, radius);
}

export function distanceToElementsV2(x, y, elements, material = {}) {
  let nearest = Infinity;
  for (const element of elements) nearest = Math.min(nearest, sdElementV2(x, y, element, material));
  return nearest;
}

export function hitTestElementsV2(x, y, elements, material = {}, options = {}) {
  const tolerance = options.tolerance ?? 0;
  // The V2 shader resolves overlap by taking the last matching surface.
  for (let i = elements.length - 1; i >= 0; i--) {
    if (sdElementV2(x, y, elements[i], material) <= tolerance) return elements[i];
  }
  return null;
}
