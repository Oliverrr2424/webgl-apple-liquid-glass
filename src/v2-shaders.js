// The V2 clear/transparent optical model. This is intentionally a separate
// shader rather than a branch inside FS_GLASS: its controls have different
// units, profiles and compositing rules even where a public name looks alike.
export const FS_GLASS_V2 = `#version 300 es
precision highp float;
in vec2 vUV;
out vec4 outColor;

uniform sampler2D uSrc;
uniform vec2 uRes;
uniform float uDpr;
uniform float uMips;
const int MAX_SHAPES = 16;
uniform int uShapeCount;
uniform vec2 uShapeCenters[MAX_SHAPES];
uniform vec2 uShapeHalves[MAX_SHAPES];
uniform int uShapeTypes[MAX_SHAPES];
uniform float uShapeRadii[MAX_SHAPES];
uniform float uShapeTints[MAX_SHAPES];
uniform float uShapeTintLights[MAX_SHAPES];
uniform vec2 uLightDirs[MAX_SHAPES];
uniform float uRefraction;
uniform float uEdgeReach;
uniform float uEdgeWidth;
uniform float uDispersion;
uniform float uFrost;
uniform float uBody;
uniform float uAbsorption;
uniform float uRim;
uniform float uReflection;
uniform float uHighlight;
uniform float uEcho;
uniform float uHairline;
uniform float uHairWidth;

vec3 linearToSrgb(vec3 c) {
  c = max(c, 0.0);
  return mix(1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055,
             12.92 * c,
             lessThanEqual(c, vec3(0.0031308)));
}

float sdRoundBox(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - r;
}

float smoothUnion(float d1, float d2, float k) {
  float h = clamp(0.5 + 0.5 * (d2 - d1) / k, 0.0, 1.0);
  return mix(d2, d1, h) - k * h * (1.0 - h);
}

float shapeSdf(int index, vec2 point) {
  vec2 p = point - uShapeCenters[index];
  vec2 halfSize = uShapeHalves[index];
  int kind = uShapeTypes[index];
  float radius = min(uShapeRadii[index], min(halfSize.x, halfSize.y));
  if (kind == 0) return sdRoundBox(p, halfSize, radius);
  if (kind == 1) return sdRoundBox(p, halfSize, min(halfSize.x, halfSize.y));
  return length(p) - min(halfSize.x, halfSize.y);
}

vec2 opticalNormal(int index, vec2 point, vec2 sdfNormal) {
  vec2 p = point - uShapeCenters[index];
  vec2 halfSize = max(uShapeHalves[index], vec2(1.0));
  int kind = uShapeTypes[index];

  if (kind == 0) {
    // The sixth-order superellipse is the optical field, while roundness only
    // controls the silhouette. This separation is part of the V2 model.
    vec2 q = p / halfSize;
    vec2 g = vec2(sign(q.x) * pow(abs(q.x), 5.0) / halfSize.x,
                  sign(q.y) * pow(abs(q.y), 5.0) / halfSize.y);
    return normalize(g + sdfNormal * 0.0001);
  }
  if (kind == 1) {
    vec2 closest;
    if (halfSize.x >= halfSize.y) {
      float segment = max(halfSize.x - halfSize.y, 0.0);
      closest = vec2(clamp(p.x, -segment, segment), 0.0);
    } else {
      float segment = max(halfSize.y - halfSize.x, 0.0);
      closest = vec2(0.0, clamp(p.y, -segment, segment));
    }
    return normalize(p - closest + sdfNormal * 0.0001);
  }
  return normalize(p + sdfNormal * 0.0001);
}

vec3 backdrop(vec2 uv) {
  // The shared backdrop pipeline stores linear radiance in SRGB8_ALPHA8.
  // V2's optical constants were authored in display space, so convert each
  // sample back before applying the V2 equations.
  return linearToSrgb(texture(uSrc, clamp(uv, vec2(0.001), vec2(0.999))).rgb);
}

vec3 softBackdrop(vec2 uv, float radius) {
  float lod = clamp(log2(max(radius * 0.9, 1.0)), 0.0, max(uMips - 1.0, 0.0));
  vec2 r = vec2(max(radius * 0.42, 0.35)) / uRes;
  vec2 center = clamp(uv, vec2(0.001), vec2(0.999));
  vec3 c = linearToSrgb(textureLod(uSrc, center, lod).rgb) * 0.44;
  c += linearToSrgb(textureLod(uSrc, clamp(center + vec2(r.x, 0.0), vec2(0.001), vec2(0.999)), lod).rgb) * 0.14;
  c += linearToSrgb(textureLod(uSrc, clamp(center - vec2(r.x, 0.0), vec2(0.001), vec2(0.999)), lod).rgb) * 0.14;
  c += linearToSrgb(textureLod(uSrc, clamp(center + vec2(0.0, r.y), vec2(0.001), vec2(0.999)), lod).rgb) * 0.14;
  c += linearToSrgb(textureLod(uSrc, clamp(center - vec2(0.0, r.y), vec2(0.001), vec2(0.999)), lod).rgb) * 0.14;
  return c;
}

float luminance(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }

vec3 interfaceColor(vec2 point, vec2 normal) {
  vec3 outsideColor = softBackdrop((point + normal * 1.8) / uRes, 2.0);
  vec3 insideColor = softBackdrop((point - normal * 1.8) / uRes, 2.0);
  // Apple's outer interface is a neutral contrast line rather than a copy of
  // the wallpaper colour. Include display-space value as well as luminance so
  // saturated blue/purple fields select a dark line even though their formal
  // luminance is modest. The outside carries more weight because that is the
  // field the silhouette must remain legible against.
  float outsideValue = max(outsideColor.r, max(outsideColor.g, outsideColor.b));
  float insideValue = max(insideColor.r, max(insideColor.g, insideColor.b));
  float outsideLight = max(luminance(outsideColor), outsideValue * 0.72);
  float insideLight = max(luminance(insideColor), insideValue * 0.72);
  float interfaceLight = outsideLight * 0.68 + insideLight * 0.32;
  float darkLine = smoothstep(0.40, 0.61, interfaceLight);
  return mix(vec3(0.92, 0.93, 0.96), vec3(0.014, 0.013, 0.018), darkLine);
}

void main() {
  vec2 point = vUV * uRes;
  int chosen = -1;
  float chosenD = 1e6;
  for (int i = 0; i < MAX_SHAPES; i++) {
    if (i >= uShapeCount) break;
    float d = shapeSdf(i, point);
    if (d <= 2.1) { chosen = i; chosenD = d; }
  }

  if (chosen < 0) {
    outColor = vec4(0.0);
    return;
  }

  vec2 center = uShapeCenters[chosen];
  vec2 halfSize = uShapeHalves[chosen];
  float minHalf = min(halfSize.x, halfSize.y);
  float e = 1.35;
  float dx = shapeSdf(chosen, point + vec2(e, 0.0)) - shapeSdf(chosen, point - vec2(e, 0.0));
  float dy = shapeSdf(chosen, point + vec2(0.0, e)) - shapeSdf(chosen, point - vec2(0.0, e));
  vec2 normal = normalize(vec2(dx, dy) + vec2(0.0001));
  float depth = clamp(-chosenD / max(12.0, minHalf * 0.62), 0.0, 1.0);
  float refractionSupport = max(14.0, minHalf * 0.50);
  float edgeCurve = pow(1.0 - smoothstep(0.0, refractionSupport, -chosenD), 2.2);
  vec2 local = (point - center) / max(halfSize, vec2(1.0));

  float edgeDepth = max(-chosenD, 0.0);
  float causticSupport = max(8.0, minHalf * uEdgeWidth);
  float captureX = clamp(edgeDepth / causticSupport, 0.0, 1.0);
  float causticT = 1.0 - smoothstep(0.0, causticSupport, edgeDepth);
  float causticShade = causticT * causticT * (3.0 - 2.0 * causticT);
  // The old double-smoothstep displacement flattened at the visible contour.
  // Its source-coordinate derivative therefore changed sign twice, making a
  // captured line turn back just before it touched the edge. A one-sided exit
  // profile keeps a finite slope at the contour and relaxes to zero only on
  // the inner side of the capture band, leaving a single optical fold.
  float captureProfile = pow(1.0 - captureX, 1.64);
  float refractionX = clamp(edgeDepth / refractionSupport, 0.0, 1.0);
  float refractionProfile = pow(1.0 - refractionX, 2.2);
  // The silhouette and optical superellipse deliberately differ in V2, but
  // the visible contour must still exit along the silhouette normal. Blend to
  // the broader optical field only after leaving the outer edge pixels.
  float opticalNormalMix = smoothstep(0.12, 0.55, captureX);
  vec2 bendNormal = normalize(mix(normal, opticalNormal(chosen, point, normal), opticalNormalMix));
  vec2 inward = -bendNormal;
  // Edge pull used to multiply Capture reach as a second public control. Keep
  // its original default as an internal calibration so the default material
  // retains the same displacement with one unambiguous capture parameter.
  const float CAPTURE_REACH_SCALE = 1.24;
  float captureDistance = uEdgeReach * CAPTURE_REACH_SCALE * captureProfile;
  float shallowRefraction = uRefraction * refractionProfile * 0.32;
  vec2 lensShift = inward * (shallowRefraction + captureDistance);
  lensShift += -local * (uRefraction * 0.035) * smoothstep(0.16, 0.92, depth);
  vec2 chromaShift = bendNormal * uDispersion * (0.32 + edgeCurve * 0.95);
  vec2 uvR = (point + lensShift * (1.0 + uDispersion * 0.009) + chromaShift) / uRes;
  vec2 uvG = (point + lensShift) / uRes;
  vec2 uvB = (point + lensShift * (1.0 - uDispersion * 0.011) - chromaShift) / uRes;
  // Reach controls where the sample comes from, not how fat a captured line
  // becomes. Preserve the tuned reach=35 softness while preventing larger
  // reaches from silently doubling the blur radius.
  float causticBlur = min(0.7 + 1.13 * uDpr, 0.7 + captureDistance * 0.026);
  float blurRadius = max(uFrost * (0.55 + depth * 1.3), causticBlur);
  float blurMix = clamp(uFrost * 0.20 + causticShade * 0.18, 0.0, 0.84);
  vec3 sr = mix(backdrop(uvR), softBackdrop(uvR, blurRadius), blurMix);
  vec3 sg = mix(backdrop(uvG), softBackdrop(uvG, blurRadius), blurMix);
  vec3 sb = mix(backdrop(uvB), softBackdrop(uvB, blurRadius), blurMix);
  vec3 transmitted = vec3(sr.r, sg.g, sb.b);

  float transmittedLum = luminance(transmitted);
  vec3 bodyTarget = mix(vec3(0.030, 0.031, 0.038), vec3(0.94, 0.95, 0.97),
                        smoothstep(0.58, 0.82, transmittedLum));
  transmitted = mix(transmitted, bodyTarget,
                    clamp(uBody * (0.034 + edgeCurve * 0.012), 0.0, 0.11));
  transmitted = mix(vec3(luminance(transmitted)), transmitted, 1.0 - uBody * 0.045);

  float opticalPath = 0.26 + sqrt(depth) * 0.74;
  transmitted *= exp(-vec3(0.018, 0.011, 0.004) * opticalPath * 2.4 * uAbsorption);
  // Tinted Liquid Glass chooses one light/dark material for the whole
  // component. Choosing per fragment lets high-contrast content punch a
  // checkerboard through the surface instead of producing the coherent milky
  // veil used by notifications and other legibility-first controls.
  vec3 tintTarget = mix(vec3(0.055, 0.057, 0.066), vec3(0.975, 0.970, 0.955),
                        clamp(uShapeTintLights[chosen], 0.0, 1.0));
  float tintOpacity = smoothstep(0.0, 1.5, uShapeTints[chosen]) * 0.78;
  transmitted = mix(transmitted, tintTarget, tintOpacity * (0.88 + depth * 0.12));

  float mask = 1.0 - smoothstep(0.0, 1.35, chosenD);
  float thinRim = exp(-pow((chosenD + 0.65) / 1.4, 2.0));
  float innerRim = exp(-pow((chosenD + 6.2) / 3.8, 2.0));
  float fresnel = pow(clamp(edgeCurve, 0.0, 1.0), 0.72);
  // A softened environment probe keeps moving video/feed edges from turning
  // into one-frame white flashes while preserving the local colour response.
  vec3 reflected = softBackdrop((point + normal * (8.0 + uRefraction * 0.17)) / uRes, 5.2);
  vec3 adaptiveRim = reflected * 1.45 + vec3(0.06, 0.035, 0.08);
  adaptiveRim = mix(adaptiveRim, vec3(0.96, 0.97, 1.0), 0.24);
  adaptiveRim = mix(adaptiveRim, vec3(0.035, 0.025, 0.045),
                    smoothstep(0.78, 0.98, luminance(reflected)) * 0.48);

  vec2 lightDir = normalize(uLightDirs[chosen] + vec2(0.0001));
  float key = pow(max(dot(normal, lightDir), 0.0), 7.0) * fresnel;
  float opposite = pow(max(dot(normal, -lightDir), 0.0), 5.0) * innerRim;
  vec3 color = transmitted;
  color = mix(color, adaptiveRim,
              clamp((thinRim * 0.42 + innerRim * 0.18 + fresnel * 0.10)
                    * uRim * uReflection, 0.0, 0.72));
  color += vec3(1.0, 0.82, 0.92) * key * 0.30 * uRim * uHighlight;
  color *= 1.0 - opposite * 0.12 * uRim;
  float echo = exp(-pow((chosenD + 11.0) / 5.5, 2.0));
  vec3 echoColor = backdrop((point - normal * 11.0) / uRes);
  color = mix(color, echoColor * 1.12, echo * 0.075 * uRim * uEcho);

  float edgeAA = max(fwidth(chosenD), 0.72);
  float lineWidth = mix(0.34, 1.08, clamp(uHairWidth, 0.0, 1.0));
  float strokeDistance = abs(chosenD + 0.10) - lineWidth * 0.5;
  float hairline = 1.0 - smoothstep(-edgeAA * 0.72, edgeAA * 0.72, strokeDistance);
  vec3 hairColor = interfaceColor(point, normal);
  // The contrast line is the default interface. On the light-facing arc the
  // specular key replaces it with the thin white highlight visible in the
  // native material instead of merely brightening the black line underneath.
  float hairHighlight = clamp(key * uHighlight * 2.5 * (0.65 + uRim * 0.60), 0.0, 0.96);
  hairColor = mix(hairColor, vec3(0.985, 0.99, 1.0), hairHighlight);

  // Premultiplied layer composition exactly reproduces the prototype's two
  // sequential mixes when drawn over the supplied backdrop, and also allows
  // the same shader to work in overlay mode over a DOM/canvas backdrop.
  float hairAlpha = clamp(hairline * uHairline * (0.22 + uRim * 0.20), 0.0, 1.0);
  float alpha = hairAlpha + mask * (1.0 - hairAlpha);
  vec3 premultiplied = hairColor * hairAlpha + color * mask * (1.0 - hairAlpha);
  outColor = vec4(premultiplied, alpha);
}`;
