// CPU mirror of the shape maths in FS_GLASS.
//
// The shader is the source of truth for what the glass looks like, but callers
// also need the same geometry on the CPU: to know which component the pointer
// is over, and to split a large element list into groups that cannot influence
// each other. Keeping both in this module - free of any WebGL or DOM
// dependency - is what makes those rules unit-testable.
//
// Every length here is in the same unit as the element coordinates (CSS pixels
// for the public API). The renderer applies `dpr` separately.

// The glass shader carries the group in uniform arrays of this length.
export const MAX_GLASS_SHAPES = 16;

// `sdGroup` weights each shape by exp(-(d - nearest) / scale). Past this many
// multiples of `scale` the contribution is below 1/3000 of a pixel of distance,
// which is far under the quantisation of the RGBA8 output. Shapes separated by
// more than that can be shaded in different draw calls without a visible seam.
const MERGE_INFLUENCE_SCALES = 8;

// Matches the shader: scale = max(mergeRadius * 0.36, 0.01).
const MERGE_SCALE_RATIO = 0.36;

// Apple's folder corner is capped at 23.5% of the short side.
const MAX_CORNER_RATIO = 0.235;

export const SHAPE_TYPES = Object.freeze({ rect: 0, folder: 0, pill: 1, circle: 2 });

export function shapeTypeOf(shape) {
  return SHAPE_TYPES[shape] ?? 0;
}

/** Corner radius the renderer will use for an element, before `dpr`. */
export function cornerRadiusOf(element, materialRadius = 0) {
  const short = Math.min(element.w ?? element.width ?? 0, element.h ?? element.height ?? 0);
  return Math.min(element.radius ?? materialRadius, short * MAX_CORNER_RATIO);
}

/** Superellipse rounded box, mirroring `sdSquircle` in the glass shader. */
export function sdSquircle(px, py, halfX, halfY, radius, exponent) {
  const qx = Math.abs(px) - halfX + radius;
  const qy = Math.abs(py) - halfY + radius;
  const mx = Math.max(qx, 0) + 1e-5;
  const my = Math.max(qy, 0) + 1e-5;
  const e = (mx ** exponent + my ** exponent) ** (1 / exponent);
  return Math.min(Math.max(qx, qy), 0) + e - radius;
}

/** Mirrors `sdPrimitive`: exact circle, exact capsule, or squircle folder. */
export function sdPrimitive(px, py, halfX, halfY, shapeType, radius, squircle = 2) {
  if (shapeType === 2) return Math.hypot(px, py) - Math.min(halfX, halfY);
  if (shapeType === 1) return sdSquircle(px, py, halfX, halfY, Math.min(halfX, halfY), 2);
  return sdSquircle(px, py, halfX, halfY, radius, Math.max(squircle, 2));
}

function toShape(element, material) {
  const w = element.w ?? element.width ?? element.size ?? 0;
  const h = element.h ?? element.height ?? element.size ?? w;
  return {
    cx: (element.x ?? 0) + w / 2,
    cy: (element.y ?? 0) + h / 2,
    halfX: w / 2,
    halfY: h / 2,
    type: shapeTypeOf(element.shape),
    radius: cornerRadiusOf({ ...element, w, h }, material.radius ?? 0),
  };
}

/**
 * Signed distance to the fused silhouette of `elements`, in element
 * coordinates. Mirrors `sdAppleShape`, including the global exponential
 * smooth-min, so a hit test agrees with the pixels the shader produced.
 *
 * The smooth-min pulls the surface inward by at most `scale * ln(2)`, which is
 * a quarter of `mergeRadius`. A gap between two components therefore only
 * closes into a bridge while it is narrower than about `mergeRadius / 2`;
 * beyond that the fusion distance only softens the approach.
 */
export function sdGroup(x, y, elements, material = {}, mergeRadius = material.mergeRadius ?? 0) {
  if (!elements.length) return Infinity;
  const shapes = elements.map((element) => toShape(element, material));
  const squircle = material.squircle ?? 2;

  let nearest = Infinity;
  const distances = shapes.map((shape) => {
    const d = sdPrimitive(x - shape.cx, y - shape.cy, shape.halfX, shape.halfY,
                          shape.type, shape.radius, squircle);
    if (d < nearest) nearest = d;
    return d;
  });

  if (!(mergeRadius >= 0.01) || shapes.length === 1) return nearest;

  const scale = Math.max(mergeRadius * MERGE_SCALE_RATIO, 0.01);
  let sum = 0;
  for (const d of distances) sum += Math.exp(-(d - nearest) / scale);
  return nearest - scale * Math.log(Math.max(sum, 1e-6));
}

/**
 * The element whose own primitive is nearest to the point, or `null` when the
 * point is outside the fused surface. `tolerance` grows the hit area, which is
 * what a coarse pointer (touch) wants.
 */
export function hitTestElements(x, y, elements, material = {}, options = {}) {
  const mergeRadius = options.fusion === false
    ? 0
    : (options.mergeRadius ?? material.mergeRadius ?? 0);
  const tolerance = options.tolerance ?? 0;
  const squircle = material.squircle ?? 2;

  // Separate elements are separate draw calls. The last one painted owns every
  // overlapping pixel, regardless of how deeply the point lies inside an older
  // element. Picking the most-negative distance here would make a large card
  // steal clicks from a smaller button drawn on top of it.
  if (options.fusion === false) {
    for (let i = elements.length - 1; i >= 0; i--) {
      const shape = toShape(elements[i], material);
      const d = sdPrimitive(x - shape.cx, y - shape.cy, shape.halfX, shape.halfY,
                            shape.type, shape.radius, squircle);
      if (d <= tolerance) return elements[i];
    }
    return null;
  }

  // Mirror the renderer's connected-component splitting and 16-shape chunks.
  // In particular, do not invent a smooth-union bridge across a chunk boundary
  // that the GPU cannot draw. Iterate backwards because later passes composite
  // over earlier ones when separately rendered groups overlap.
  const groups = groupElements(elements, mergeRadius, MAX_GLASS_SHAPES).groups;
  for (let groupIndex = groups.length - 1; groupIndex >= 0; groupIndex--) {
    const group = groups[groupIndex];
    if (sdGroup(x, y, group, material, mergeRadius) > tolerance) continue;

    let best = null;
    let bestDistance = Infinity;
    for (let i = group.length - 1; i >= 0; i--) {
      const shape = toShape(group[i], material);
      const d = sdPrimitive(x - shape.cx, y - shape.cy, shape.halfX, shape.halfY,
                            shape.type, shape.radius, squircle);
      if (d < bestDistance) {
        bestDistance = d;
        best = group[i];
      }
    }
    return best;
  }
  return null;
}

/** Signed distance to the exact silhouette produced by the renderer's passes. */
export function sdRenderedGroups(
  x, y, elements, material = {}, mergeRadius = material.mergeRadius ?? 0,
) {
  const groups = groupElements(elements, mergeRadius, MAX_GLASS_SHAPES).groups;
  if (!groups.length) return Infinity;
  let bestDistance = Infinity;
  for (const group of groups) {
    const d = sdGroup(x, y, group, material, mergeRadius);
    if (d < bestDistance) bestDistance = d;
  }
  return bestDistance;
}

/** Axis-aligned gap between two element boxes; 0 when they overlap. */
function boxGap(a, b) {
  const box = (element) => {
    const w = Number(element.w ?? element.width ?? element.size ?? 0);
    const h = Number(element.h ?? element.height ?? element.size ?? w);
    return { x: Number(element.x ?? 0), y: Number(element.y ?? 0), w, h };
  };
  const aa = box(a);
  const bb = box(b);
  const dx = Math.max(0, Math.max(aa.x - (bb.x + bb.w), bb.x - (aa.x + aa.w)));
  const dy = Math.max(0, Math.max(aa.y - (bb.y + bb.h), bb.y - (aa.y + aa.h)));
  return Math.hypot(dx, dy);
}

/**
 * Split elements into sets that can be shaded independently.
 *
 * Two elements land in the same set when their boxes are close enough for the
 * smooth-min to bridge them. Elements further apart than the influence radius
 * contribute nothing measurable to each other's distance field, so drawing
 * them in separate passes is visually identical to one fused pass.
 */
export function connectedElementGroups(elements, mergeRadius = 0) {
  if (elements.length <= 1) return elements.length ? [elements.slice()] : [];
  const reach = Math.max(0, mergeRadius) * MERGE_SCALE_RATIO * MERGE_INFLUENCE_SCALES;

  const parent = elements.map((_, i) => i);
  const find = (i) => {
    while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; }
    return i;
  };
  for (let i = 0; i < elements.length; i++) {
    for (let j = i + 1; j < elements.length; j++) {
      if (boxGap(elements[i], elements[j]) <= reach) parent[find(i)] = find(j);
    }
  }

  const byRoot = new Map();
  elements.forEach((element, i) => {
    const root = find(i);
    if (!byRoot.has(root)) byRoot.set(root, []);
    byRoot.get(root).push(element);
  });

  return [...byRoot.values()];
}

/**
 * Connected sets, further chunked so no group exceeds the shader's uniform
 * arrays. A chunked set is the only lossy case: shapes that really do influence
 * each other end up in different passes, so callers should surface a warning
 * when `groupElements` reports it.
 */
export function groupElements(elements, mergeRadius = 0, maxPerGroup = MAX_GLASS_SHAPES) {
  const connected = connectedElementGroups(elements, mergeRadius);
  const groups = [];
  let truncated = false;
  for (const group of connected) {
    if (group.length > maxPerGroup) truncated = true;
    for (let i = 0; i < group.length; i += maxPerGroup) {
      groups.push(group.slice(i, i + maxPerGroup));
    }
  }
  return { groups, truncated };
}
