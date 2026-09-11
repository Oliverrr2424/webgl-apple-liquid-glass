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
  // A caller may provide a CSS-pixel radius for surfaces that must register
  // to an external frame (for example the iPhone screen mask).  Keep the V2
  // material ratio as the default for authored components, but honour an
  // explicit radius when exact geometry matters.
  if (Number.isFinite(element.radius)) {
    return Math.max(0, Math.min(Number(element.radius), Math.min(width, height) * 0.5));
  }
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

/**
 * Smooth maximum: `max(a, b)` with a ridge of width `k` rounded off.
 * Unbiased, so `softMaxV2(a, a, k) === a` and the interior term keeps the
 * sign that tells inside from outside.
 */
export function softMaxV2(a, b, k) {
  return 0.5 * (a + b + Math.sqrt((a - b) * (a - b) + k * k)) - k / 2;
}

/**
 * The field the shader differentiates for surface normals, mirroring
 * `shapeField` in v2-shaders.js.
 *
 * Inside a rounded box the exact distance is `max(qx, qy)`, whose gradient
 * switches axis across the corner diagonal. The rim, key highlight, echo and
 * the refraction near the edge all follow that gradient, so the switch folded
 * a 45-degree crease into every corner. Rounding the ridge with a soft
 * maximum leaves the silhouette untouched — outside the inner rectangle the
 * distance still comes from the exact term — and only bends directions.
 */
export function sdFieldV2(x, y, element, material = {}) {
  const width = Number(element.w ?? element.width ?? element.size ?? 0);
  const height = Number(element.h ?? element.height ?? element.size ?? width);
  const halfX = width / 2;
  const halfY = height / 2;
  const minHalf = Math.min(halfX, halfY);
  const px = x - Number(element.x ?? 0) - halfX;
  const py = y - Number(element.y ?? 0) - halfY;
  const kind = shapeTypeOfV2(element.shape);
  if (kind === 2) return Math.hypot(px, py) - minHalf;

  const radius = kind === 1
    ? minHalf
    : Math.min(cornerRadiusV2({ ...element, w: width, h: height }, material.roundness ?? 0.47), minHalf);
  const k = Math.max(1.5, Math.min(minHalf * 0.08, 12));
  const qx = Math.abs(px) - halfX + radius;
  const qy = Math.abs(py) - halfY + radius;
  return Math.min(softMaxV2(qx, qy, k), 0)
    + Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) - radius;
}

/** Unit surface normal at a point, from `sdFieldV2`. */
export function fieldNormalV2(x, y, element, material = {}, epsilon = 1.35) {
  const dx = sdFieldV2(x + epsilon, y, element, material) - sdFieldV2(x - epsilon, y, element, material);
  const dy = sdFieldV2(x, y + epsilon, element, material) - sdFieldV2(x, y - epsilon, element, material);
  const length = Math.hypot(dx, dy) || 1;
  return [dx / length, dy / length];
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
