// The V2 clear/transparent optical model. This is intentionally a separate
// shader rather than a branch inside FS_GLASS: its controls have different
// units, profiles and compositing rules even where a public name looks alike.
export const FS_GLASS_V2 = `#version 300 es
precision highp float;
in vec2 vUV;
out vec4 outColor;

uniform sampler2D uSrc;
uniform vec2 uRes;
uniform float uMips;
const int MAX_SHAPES = 16;
uniform int uShapeCount;
uniform vec2 uShapeCenters[MAX_SHAPES];
uniform vec2 uShapeHalves[MAX_SHAPES];
uniform int uShapeTypes[MAX_SHAPES];
uniform float uShapeRadii[MAX_SHAPES];
uniform vec2 uLightDirs[MAX_SHAPES];
uniform float uRefraction;
uniform float uEdgePull;
uniform float uEdgeReach;
uniform float uEdgeWidth;
uniform float uDispersion;
uniform float uFrost;
uniform float uBody;
uniform float uAbsorption;
uniform float uTint;
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
  if (kind == 1) {
    float body = sdRoundBox(p - vec2(0.0, -halfSize.y * 0.11),
                            vec2(halfSize.x, halfSize.y * 0.78), radius);
    float tab = sdRoundBox(p - vec2(-halfSize.x * 0.37, halfSize.y * 0.60),
                           vec2(halfSize.x * 0.47, halfSize.y * 0.33), radius * 0.72);
    return smoothUnion(body, tab, min(halfSize.x, halfSize.y) * 0.15);
  }
  if (kind == 2) return sdRoundBox(p, halfSize, min(halfSize.x, halfSize.y));
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
  if (kind == 1) return sdfNormal;
  if (kind == 2) {
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

float colorDistance(vec3 a, vec3 b) {
  float valueDelta = abs(luminance(a) - luminance(b));
  return length(a - b) * 0.68 + valueDelta * 0.38;
}

float colorfulness(vec3 c) {
  return max(c.r, max(c.g, c.b)) - min(c.r, min(c.g, c.b));
}

vec3 interfaceColor(vec2 point, vec2 normal) {
  vec3 outsideColor = softBackdrop((point + normal * 2.4) / uRes, 2.6);
  vec3 insideColor = softBackdrop((point - normal * 2.4) / uRes, 2.6);
  float outsideChroma = colorfulness(outsideColor);
  float insideChroma = colorfulness(insideColor);
  float sourceMix = smoothstep(-0.08, 0.08, insideChroma - outsideChroma);
  vec3 source = mix(outsideColor, insideColor, sourceMix);
  float sourceLum = luminance(source);
  vec3 saturatedSource = mix(vec3(sourceLum), source, 1.38);
  float localLum = (luminance(outsideColor) + luminance(insideColor)) * 0.5;
  vec3 neutral = mix(vec3(0.985), vec3(0.012, 0.011, 0.016), smoothstep(0.38, 0.86, localLum));
  float transition = smoothstep(0.055, 0.30, colorDistance(outsideColor, insideColor));
  float chromaGate = smoothstep(0.025, 0.16, max(outsideChroma, insideChroma));
  return mix(neutral, clamp(saturatedSource * 1.13 + 0.018, 0.0, 1.0),
             transition * chromaGate * 0.86);
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
  float edgeCurve = pow(1.0 - smoothstep(0.0, max(14.0, minHalf * 0.50), -chosenD), 2.2);
  vec2 local = (point - center) / max(halfSize, vec2(1.0));

  float edgeDepth = max(-chosenD, 0.0);
  vec2 bendNormal = opticalNormal(chosen, point, normal);
  vec2 inward = -bendNormal;
  float causticSupport = max(8.0, minHalf * uEdgeWidth);
  float causticT = 1.0 - smoothstep(0.0, causticSupport, edgeDepth);
  float captureProfile = causticT * causticT * (3.0 - 2.0 * causticT);
  float captureDistance = uEdgeReach * uEdgePull * pow(captureProfile, 1.28);
  float shallowRefraction = uRefraction * edgeCurve * 0.32;
  vec2 lensShift = inward * (shallowRefraction + captureDistance);
  lensShift += -local * (uRefraction * 0.035) * smoothstep(0.16, 0.92, depth);
  vec2 chromaShift = bendNormal * uDispersion * (0.32 + edgeCurve * 0.95);
  vec2 uvR = (point + lensShift * (1.0 + uDispersion * 0.009) + chromaShift) / uRes;
  vec2 uvG = (point + lensShift) / uRes;
  vec2 uvB = (point + lensShift * (1.0 - uDispersion * 0.011) - chromaShift) / uRes;
  float causticBlur = min(3.2, 0.7 + captureDistance * 0.026);
  float blurRadius = max(uFrost * (0.55 + depth * 1.3), causticBlur);
  float blurMix = clamp(uFrost * 0.20 + captureProfile * 0.18, 0.0, 0.84);
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
  vec3 base = backdrop(point / uRes);
  float fieldLum = luminance(base);
  vec3 tintTarget = mix(vec3(0.055, 0.057, 0.066), vec3(0.965, 0.958, 0.94),
                        smoothstep(0.22, 0.50, fieldLum));
  float tintOpacity = smoothstep(0.0, 1.5, uTint) * 0.78;
  transmitted = mix(transmitted, tintTarget, tintOpacity * (0.88 + depth * 0.12));

  float mask = 1.0 - smoothstep(0.0, 1.35, chosenD);
  float thinRim = exp(-pow((chosenD + 0.65) / 1.4, 2.0));
  float innerRim = exp(-pow((chosenD + 6.2) / 3.8, 2.0));
  float fresnel = pow(clamp(edgeCurve, 0.0, 1.0), 0.72);
  vec3 reflected = backdrop((point + normal * (8.0 + uRefraction * 0.17)) / uRes);
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

  // Premultiplied layer composition exactly reproduces the prototype's two
  // sequential mixes when drawn over the supplied backdrop, and also allows
  // the same shader to work in overlay mode over a DOM/canvas backdrop.
  float hairAlpha = clamp(hairline * uHairline * (0.22 + uRim * 0.20), 0.0, 1.0);
  float alpha = hairAlpha + mask * (1.0 - hairAlpha);
  vec3 premultiplied = hairColor * hairAlpha + color * mask * (1.0 - hairAlpha);
  outColor = vec4(premultiplied, alpha);
}`;
