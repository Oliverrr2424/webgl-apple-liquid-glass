// CPU mirror of the V2 transparent shader's geometry. V2 intentionally does
// not reuse the V1 squircle/fusion helpers: folders have a real tab, rounded
// rectangles use a ratio, and surfaces remain separate instead of merging.

export const SHAPE_TYPES_V2 = Object.freeze({ rect: 0, folder: 1, pill: 2, circle: 3 });

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

export function cornerRadiusV2(element, roundness = 0.5) {
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
  const radius = cornerRadiusV2({ ...element, w: width, h: height }, material.roundness ?? 0.5);

  if (kind === 1) {
    // The shader works bottom-up. These centres are flipped into the public
    // API's top-down CSS coordinate system.
    const body = sdRoundBoxV2(px, py - halfY * 0.11, halfX, halfY * 0.78, radius);
    const tab = sdRoundBoxV2(
      px + halfX * 0.37,
      py + halfY * 0.60,
      halfX * 0.47,
      halfY * 0.33,
      radius * 0.72,
    );
    return smoothUnionV2(body, tab, Math.min(halfX, halfY) * 0.15);
  }
  if (kind === 2) return sdRoundBoxV2(px, py, halfX, halfY, Math.min(halfX, halfY));
  if (kind === 3) return Math.hypot(px, py) - Math.min(halfX, halfY);
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
