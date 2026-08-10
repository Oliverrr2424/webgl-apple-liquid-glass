// GLSL sources for the Liquid Glass replica.

export const VS_FULLSCREEN = `#version 300 es
in vec2 aPos;
out vec2 vUV;
void main() {
  vUV = aPos;
  gl_Position = vec4(aPos * 2.0 - 1.0, 0.0, 1.0);
}`;

// Vertex shader for one glass element: expands the unit quad to the element's
// bounding box (plus padding for the drop shadow) in pixel space.
export const VS_GLASS = `#version 300 es
in vec2 aPos;
uniform vec2 uRes;
uniform vec2 uCenter;
uniform vec2 uHalf;
uniform float uPad;
out vec2 vUV;
void main() {
  vec2 half2 = uHalf + uPad;
  vec2 px = uCenter + (aPos * 2.0 - 1.0) * half2;
  vUV = px / uRes;
  gl_Position = vec4(px / uRes * 2.0 - 1.0, 0.0, 1.0);
}`;

export const FS_BLIT = `#version 300 es
precision highp float;
in vec2 vUV;
uniform sampler2D uTex;
out vec4 outColor;
void main() { outColor = vec4(texture(uTex, vUV).rgb, 1.0); }`;

// Dual-filter downsample (13 tap) used to build a progressively blurred mip
// chain. Sampling that chain with textureLod() gives a cheap variable blur,
// which is the "frosted"/scattering part of the material.
export const FS_DOWN = `#version 300 es
precision highp float;
in vec2 vUV;
uniform sampler2D uTex;
uniform vec2 uTexel;   // texel size of the SOURCE level
out vec4 outColor;
void main() {
  vec2 t = uTexel;
  vec4 a = texture(uTex, vUV) * 0.125;
  vec4 b = (texture(uTex, vUV + vec2(-t.x, -t.y)) +
            texture(uTex, vUV + vec2( t.x, -t.y)) +
            texture(uTex, vUV + vec2(-t.x,  t.y)) +
            texture(uTex, vUV + vec2( t.x,  t.y))) * 0.125;
  vec4 c = (texture(uTex, vUV + vec2(-2.0 * t.x, 0.0)) +
            texture(uTex, vUV + vec2( 2.0 * t.x, 0.0)) +
            texture(uTex, vUV + vec2(0.0, -2.0 * t.y)) +
            texture(uTex, vUV + vec2(0.0,  2.0 * t.y))) * 0.0625;
  vec4 d = (texture(uTex, vUV + vec2(-2.0 * t.x, -2.0 * t.y)) +
            texture(uTex, vUV + vec2( 2.0 * t.x, -2.0 * t.y)) +
            texture(uTex, vUV + vec2(-2.0 * t.x,  2.0 * t.y)) +
            texture(uTex, vUV + vec2( 2.0 * t.x,  2.0 * t.y))) * 0.03125;
  // RGB stores radiance. Alpha stores normalized optical density, so the mip
  // chain can blur both representations with exactly the same footprint.
  outColor = a + b + c + d;
}`;

// Procedural wallpapers. They only exist to give the glass something with hard,
// high contrast edges to bend -- exactly what the reference screenshots have.
export const FS_WALLPAPER = `#version 300 es
precision highp float;
in vec2 vUV;
uniform vec2 uRes;
uniform int uScene;
uniform float uZoom;
uniform sampler2D uWallpaper;
uniform int uUseImage;
out vec4 outColor;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x),
             mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
}
float fbm(vec2 p) {
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { s += a * noise(p); p *= 2.02; a *= 0.5; }
  return s;
}
// distance to a quadratic bezier (iterative, good enough for a backdrop)
float sdBezier(vec2 p, vec2 a, vec2 b, vec2 c) {
  float best = 1e9;
  vec2 prev = a;
  for (int i = 1; i <= 40; i++) {
    float t = float(i) / 40.0;
    vec2 q = mix(mix(a, b, t), mix(b, c, t), t);
    vec2 pa = p - prev, ba = q - prev;
    float u = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-9), 0.0, 1.0);
    best = min(best, length(pa - ba * u));
    prev = q;
  }
  return best;
}

vec3 sunsetBranches(vec2 uv) {
  // dusk gradient: cool grey-mauve at the top, warm amber near the horizon
  vec3 top = vec3(0.62, 0.55, 0.55);
  vec3 mid = vec3(0.85, 0.63, 0.53);
  vec3 low = vec3(0.94, 0.70, 0.52);
  vec3 col = mix(mid, top, smoothstep(0.45, 1.0, uv.y));
  col = mix(col, low, smoothstep(0.45, 0.0, uv.y));
  col += (fbm(uv * 3.0) - 0.5) * 0.05;

  vec2 p = uv * vec2(uRes.x / uRes.y, 1.0);
  float sc = uRes.x / uRes.y;
  vec3 bark = vec3(0.17, 0.10, 0.09);
  // main trunk + a few branches, thick and dark like the reference photo
  float d = sdBezier(p, vec2(0.42 * sc, -0.1), vec2(0.52 * sc, 0.45), vec2(0.36 * sc, 1.1));
  float m = smoothstep(0.060, 0.040, d);
  d = sdBezier(p, vec2(0.40 * sc, 0.30), vec2(0.62 * sc, 0.44), vec2(0.95 * sc, 0.26));
  m = max(m, smoothstep(0.034, 0.020, d));
  d = sdBezier(p, vec2(0.44 * sc, 0.62), vec2(0.25 * sc, 0.80), vec2(0.05 * sc, 0.72));
  m = max(m, smoothstep(0.022, 0.010, d));
  d = sdBezier(p, vec2(0.46 * sc, 0.80), vec2(0.72 * sc, 0.95), vec2(1.05 * sc, 0.78));
  m = max(m, smoothstep(0.016, 0.007, d));
  d = sdBezier(p, vec2(0.12 * sc, -0.05), vec2(0.18 * sc, 0.5), vec2(0.06 * sc, 1.05));
  m = max(m, smoothstep(0.038, 0.022, d));
  // seed pods
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    vec2 c = vec2((0.14 + 0.02 * fi) * sc, 0.30 + 0.26 * fi);
    m = max(m, smoothstep(0.035, 0.022, length((p - c) * vec2(1.0, 0.8))));
  }
  return mix(col, bark, m * 0.94);
}

vec3 deepBlueCity(vec2 uv) {
  vec3 col = mix(vec3(0.06, 0.14, 0.55), vec3(0.02, 0.06, 0.34), smoothstep(0.0, 1.0, uv.y));
  col += (fbm(uv * vec2(90.0, 90.0)) - 0.5) * 0.05;   // fabric-like dither
  // bright vertical tower strip
  float x = abs(uv.x - 0.5);
  float tower = smoothstep(0.035, 0.012, x) * smoothstep(0.02, 0.25, uv.y);
  col = mix(col, vec3(0.72, 0.58, 0.52), tower * 0.85);
  float glow = smoothstep(0.16, 0.0, x) * smoothstep(0.0, 0.5, uv.y) * 0.18;
  col += vec3(0.5, 0.42, 0.36) * glow;
  col = mix(col, vec3(0.10, 0.14, 0.26), smoothstep(0.16, 0.02, uv.y));
  return col;
}

vec3 islandOcean(vec2 uv) {
  float ar = uRes.x / uRes.y;
  vec3 deep = vec3(0.03, 0.26, 0.52);
  vec3 shallow = vec3(0.20, 0.74, 0.82);
  float waves = fbm(vec2(uv.x * ar * 6.0, uv.y * 22.0) + 3.0);
  vec3 col = mix(deep, shallow, smoothstep(0.30, 0.78, waves * 0.7 + uv.y * 0.5));

  vec2 p = (uv - vec2(0.5, 0.40)) * vec2(ar, 1.0);
  float isl = (fbm(p * 2.2 + 11.0) - 0.5) * 0.34;
  float d = length(p * vec2(0.62, 1.25)) - (0.42 + isl);
  // shallow reef ring around the land
  col = mix(col, vec3(0.42, 0.86, 0.86), smoothstep(0.14, 0.03, d) * 0.75);
  col = mix(col, vec3(0.94, 0.90, 0.72), smoothstep(0.035, 0.0, d));        // beach
  vec3 jungle = mix(vec3(0.04, 0.26, 0.09), vec3(0.24, 0.55, 0.20),
                    fbm(p * 9.0 + 5.0));
  col = mix(col, jungle, smoothstep(0.005, -0.02, d));                      // jungle
  return col;
}

vec2 coverUV(vec2 uv) {
  vec2 imageSize = vec2(textureSize(uWallpaper, 0));
  float imageAspect = imageSize.x / max(imageSize.y, 1.0);
  float viewportAspect = uRes.x / max(uRes.y, 1.0);
  vec2 p = uv;
  if (imageAspect > viewportAspect) {
    float crop = (imageAspect / viewportAspect - 1.0) * 0.5;
    p.x = p.x * (1.0 - 2.0 * crop) + crop;
  } else {
    float crop = (viewportAspect / imageAspect - 1.0) * 0.5;
    p.y = p.y * (1.0 - 2.0 * crop) + crop;
  }
  return clamp(p, vec2(0.001), vec2(0.999));
}

void main() {
  vec2 uv = (vUV - 0.5) / max(uZoom, 0.01) + 0.5;
  vec3 col;
  if (uUseImage == 1) {
    col = texture(uWallpaper, coverUV(uv)).rgb;
  } else {
    col = uScene == 0 ? sunsetBranches(uv)
         : uScene == 1 ? deepBlueCity(uv)
                       : islandOcean(uv);
  }
  // Beer-Lambert representation of backdrop darkness. A value of 4 optical
  // density units already corresponds to ~1.8% transmission, enough for the
  // near-black branches while retaining useful precision in RGBA8.
  float lum = max(dot(col, vec3(0.2126, 0.7152, 0.0722)), 0.018);
  float density = clamp(-log(lum) / 4.0, 0.0, 1.0);
  outColor = vec4(col, density);
}`;

// ---------------------------------------------------------------------------
// The material itself.
//
// 1. shape          : square/rect folder / exact capsule / exact circle SDF
// 2. thickness      : t = clamp(-d / bevel), height h(t) = a convex bevel
//                     profile -> flat plateau in the middle, steep rim
// 3. normal         : n = normalize(vec3(s * H/bevel * dh/dt * grad(d), 1))
//                     s = -1 -> MENISCUS rim (concave, like a liquid climbing
//                     the wall of a glass): normals lean inward, refraction
//                     pushes the sample point OUTWARD, so the surroundings get
//                     squeezed into the rim. This is the Apple signature.
//                     s = +1 -> convex lens rim: magnifies the interior instead.
// 4. refraction     : Snell (refract()) through that surface, screen-space
//                     displacement = R.xy / -R.z * optical path length
// 5. dispersion     : R/G/B refracted with slightly different IOR
// 6. scattering     : variable-radius blur (multi-tap disc on the blurred mip
//                     chain), strong on the plateau, weak on the rim
// 7. reflection     : Schlick-Fresnel environment + 2 specular lobes on the
//                     bevel -> the bright glass rim
// 8. shading        : saturation boost / tint / soft contact shadow
// ---------------------------------------------------------------------------
export const FS_GLASS = `#version 300 es
precision highp float;
in vec2 vUV;
out vec4 outColor;

uniform sampler2D uSrc;      // blurred mip chain of the backdrop
uniform vec2  uRes;
uniform vec2  uCenter;       // element centre, px (y up)
uniform vec2  uHalf;         // element half size, px
const int MAX_SHAPES = 16;
uniform int   uShapeCount;
uniform vec2  uShapeCenters[MAX_SHAPES];
uniform vec2  uShapeHalves[MAX_SHAPES];
uniform int   uShapeTypes[MAX_SHAPES]; // 0 square/rect, 1 capsule, 2 circle
uniform float uShapeRadii[MAX_SHAPES];
uniform float uMergeRadius;  // smooth-union reach, px
uniform float uSquircle;     // superellipse exponent (2 = circular corners)
uniform float uBevel;        // width of the refracting rim, px
uniform float uHeight;       // glass height / optical thickness, px
uniform float uIOR;
uniform float uDispersion;
uniform float uBlurPlateau;  // blur radius in the middle, px
uniform float uBlurRim;      // blur radius at the rim, px
uniform float uOpticalDensity;// dark-detail preservation; 0 = linear radiance
uniform float uMips;         // number of levels in the blurred chain
uniform float uSpecular;
uniform float uSpecPower;
uniform float uHighlightAdapt;
uniform float uHighlightWidth;
uniform float uHighlightSharpness;
uniform float uHighlightBase;
uniform float uFresnel;
uniform float uSat;
uniform float uBright;
uniform float uTintAmount;
uniform vec3  uTintColor;
uniform float uShadow;
uniform float uShadowSize;
uniform float uShadowOffset;
uniform vec2  uLightDir;
uniform float uEdgeLine;
uniform float uEdgeWidth;
uniform float uEdgeDark;
uniform float uRefractScale;
uniform float uMeniscus;     // 1 = concave meniscus rim, 0 = convex lens rim
uniform int   uDebug;        // 0 final, 1 thickness, 2 normals, 3 displacement

float sdSquircle(vec2 p, vec2 b, float r, float n) {
  vec2 q = abs(p) - b + r;
  vec2 m = max(q, 0.0) + 1e-5;
  float e = pow(pow(m.x, n) + pow(m.y, n), 1.0 / n);
  return min(max(q.x, q.y), 0.0) + e - r;
}

float sdPrimitive(vec2 p, vec2 halfSize, int shapeType, float radius) {
  if (shapeType == 2) {
    // Circle is invariant: layout cannot turn it into an ellipse.
    return length(p) - min(halfSize.x, halfSize.y);
  }
  if (shapeType == 1) {
    // Apple's capsule rule: end-cap radius is exactly half the short side.
    return sdSquircle(p, halfSize, min(halfSize.x, halfSize.y), 2.0);
  }
  // Square and rectangular folders share the same fixed-radius corner model;
  // only their bounding boxes differ. The default exponent is 2 per reference.
  return sdSquircle(p, halfSize, radius, max(uSquircle, 2.0));
}

// One distance field represents the complete component group. Because the
// normal is derived from this same field below, the meniscus, refraction and
// highlight bend continuously through the bridge instead of exposing two
// composited glass layers.
float sdAppleShape(vec2 px) {
  float nearest = 1e8;
  for (int i = 0; i < MAX_SHAPES; i++) {
    if (i >= uShapeCount) break;
    float next = sdPrimitive(px - uShapeCenters[i], uShapeHalves[i],
                             uShapeTypes[i], uShapeRadii[i]);
    nearest = min(nearest, next);
  }

  if (uMergeRadius < 0.01) return nearest;

  // Global exponential smooth-min is associative and C-infinity. Pairwise
  // polynomial unions are only C1 and become order-dependent with 3+ shapes;
  // their curvature boundaries show up as diagonal tears under sharp glass
  // highlights. 0.36 matches the polynomial union's depth at equal distances.
  float scale = max(uMergeRadius * 0.36, 0.01);
  float sum = 0.0;
  for (int i = 0; i < MAX_SHAPES; i++) {
    if (i >= uShapeCount) break;
    float next = sdPrimitive(px - uShapeCenters[i], uShapeHalves[i],
                             uShapeTypes[i], uShapeRadii[i]);
    sum += exp(-(next - nearest) / scale);
  }
  return nearest - scale * log(max(sum, 1e-6));
}

vec4 sampleBg(vec2 px, float lod) {
  vec2 uv = clamp(px / uRes, vec2(0.001), vec2(0.999));
  return textureLod(uSrc, uv, lod);
}

float luminance(vec3 c) {
  return dot(c, vec3(0.2126, 0.7152, 0.0722));
}

vec2 softLimitOffset(vec2 offset, float limit) {
  float magnitude = length(offset);
  if (magnitude < 1e-4) return offset;
  float limited = tanh(magnitude / max(limit, 1.0)) * limit;
  return offset * (limited / magnitude);
}

// Variable-radius blur, radius in device px.
//
// A single textureLod() tap on the mip chain is not enough. The chain only
// offers radii in powers of two, and on the top levels one texel is tens of
// pixels wide, so a lone bilinear tap (a) averages in a huge slab of the
// screen, which drags the colour toward the frame mean -> washed out, and
// (b) reconstructs as a handful of big diamonds -> the "too few samples" mush.
// Instead take the level whose own radius is about a third of what we want and
// spread TAPS samples over the remainder on a golden-angle spiral. Neighbouring
// taps then land roughly one texel apart at that level, which is exactly the
// spacing at which the level's own filtering makes the disc continuous, so the
// result is a real wide Gaussian that keeps its local colour.
const int TAPS = 12;
const float GOLDEN_ANGLE = 2.39996323;

vec3 blurBg(vec2 px, float radius) {
  if (radius < 1.0) return sampleBg(px, 0.0).rgb;
  float lod = clamp(log2(radius) - 1.585, 0.0, uMips - 1.0);   // 2^lod ~ r/3
  vec3 acc = vec3(0.0);
  float densityAcc = 0.0;
  float wsum = 0.0;
  for (int i = 0; i < TAPS; i++) {
    float fi = float(i) + 0.5;
    float r  = sqrt(fi / float(TAPS));       // equal-area spacing over the disc
    float a  = fi * GOLDEN_ANGLE;
    float w  = exp(-1.8 * r * r);
    vec4 s = sampleBg(px + vec2(cos(a), sin(a)) * r * radius, lod);
    acc += s.rgb * w;
    densityAcc += s.a * w;
    wsum += w;
  }
  vec3 linearCol = acc / wsum;

  // A pure radiance average spreads a dark branch but also dilutes it toward
  // the pale sky. The density channel averages -log(luminance), equivalent to
  // geometrically averaging transmission. That preserves the visual weight of
  // dark occluders while keeping uniform light regions unchanged. We retain
  // the linear RGB hue and only restore the missing luminance contrast.
  float linearLum = max(dot(linearCol, vec3(0.2126, 0.7152, 0.0722)), 0.001);
  float densityLum = exp(-4.0 * densityAcc / wsum);
  float densityGap = max(linearLum - densityLum, 0.0);
  float radiusGate = smoothstep(1.0, 8.0, radius);
  float targetLum = max(linearLum * 0.22,
                        linearLum - densityGap * uOpticalDensity * radiusGate);
  return linearCol * (targetLum / linearLum);
}

void main() {
  vec2 px = vUV * uRes;

  float d = sdAppleShape(px);
  float aa = smoothstep(0.8, -0.8, d);

  // ---- gradient of the SDF = outward direction of the surface -------------
  float k = max(1.0, 0.06 * uBevel);
  float dx = sdAppleShape(px + vec2(k, 0.0)) -
             sdAppleShape(px - vec2(k, 0.0));
  float dy = sdAppleShape(px + vec2(0.0, k)) -
             sdAppleShape(px - vec2(0.0, k));
  vec2 g = normalize(vec2(dx, dy) + 1e-6);

  // ---- thickness field / bevel profile -----------------------------------
  float t  = clamp(-d / uBevel, 0.0, 1.0);   // 0 at the edge, 1 on the plateau
  float ct = 1.0 - t;
  float h  = sqrt(max(1.0 - ct * ct, 0.0));  // convex (circular) bevel
  float dhdt = ct / max(h, 0.10);            // slope, clamped at the silhouette
  float slope = (uHeight / uBevel) * dhdt;

  // 0 = convex lens, 1 = the default Apple-like concave rim. Values above 1
  // deliberately exaggerate the inward normal for exploratory tuning.
  float curveSign = 1.0 - 2.0 * uMeniscus;
  vec3 n = normalize(vec3(curveSign * g * slope, 1.0));
  vec3 I = vec3(0.0, 0.0, -1.0);

  // ---- refraction (Snell) + dispersion -----------------------------------
  float path = uHeight * mix(0.25, 1.0, h) * uRefractScale;
  vec2 dR, dG, dB;
  {
    float e = 1.0 / max(uIOR - uDispersion, 1.0);
    vec3 R = refract(I, n, e);
    dR = (R == vec3(0.0)) ? vec2(0.0) : R.xy / max(-R.z, 0.25) * path;
    e = 1.0 / max(uIOR, 1.0);
    R = refract(I, n, e);
    dG = (R == vec3(0.0)) ? vec2(0.0) : R.xy / max(-R.z, 0.25) * path;
    e = 1.0 / max(uIOR + uDispersion, 1.0);
    R = refract(I, n, e);
    dB = (R == vec3(0.0)) ? vec2(0.0) : R.xy / max(-R.z, 0.25) * path;
  }

  // Strong concave meniscus normals can make the screen-space mapping fold
  // over itself at multi-shape junctions. On hard-edged wallpapers that reads
  // as triangular tearing rather than refraction. Compress only the extreme
  // tail; ordinary offsets remain almost linear while caustic spikes stay
  // within a bevel-sized optical footprint.
  float maxDisplacement = max(1.15 * uBevel, 12.0);
  dR = softLimitOffset(dR, maxDisplacement);
  dG = softLimitOffset(dG, maxDisplacement);
  dB = softLimitOffset(dB, maxDisplacement);

  // ---- scattering: rim stays readable, plateau is frosted ----------------
  float radius = mix(uBlurRim, uBlurPlateau, smoothstep(0.0, 0.85, t));

  vec3 col;
  col.r = blurBg(px + dR, radius).r;
  col.g = blurBg(px + dG, radius).g;
  col.b = blurBg(px + dB, radius).b;

  // Saturation is boosted on the TRANSMITTED backdrop only (this is what
  // UIVisualEffectView's saturationDeltaFactor does). Any wide blur averages
  // colours toward grey; without this the frosted panel reads pale even though
  // the wallpaper behind it is saturated. Doing it before the reflections keeps
  // the specular/Fresnel highlights neutral.
  col = mix(vec3(dot(col, vec3(0.2126, 0.7152, 0.0722))), col, uSat);

  // ---- reflection: backdrop environment + narrow specular lobes -----------
  // Schlick: F0 for glass is ~4%, and the (1-cos)^5 falloff keeps the mirror
  // term confined to the steepest part of the bevel. A softer exponent smears
  // a grey wash across the whole rim and bleaches the refracted image there.
  float fres = 0.04 + 0.96 * pow(1.0 - n.z, 5.0);
  vec2 nn = normalize(n.xy + 1e-6);

  // Probe the wallpaper around this fragment rather than around either the
  // union bounds or a selected primitive. The field is continuous in screen
  // space, so there are no Voronoi ownership seams through fused components;
  // and a remote component moving cannot affect samples under this one.
  float probeLod = min(3.5, uMips - 1.0);
  float probeRadius = max(1.35 * uBevel, 18.0);
  vec3 envL = sampleBg(px + vec2(-probeRadius, 0.0), probeLod).rgb;
  vec3 envR = sampleBg(px + vec2( probeRadius, 0.0), probeLod).rgb;
  vec3 envB = sampleBg(px + vec2(0.0, -probeRadius), probeLod).rgb;
  vec3 envT = sampleBg(px + vec2(0.0,  probeRadius), probeLod).rgb;
  float lumL = luminance(envL), lumR = luminance(envR);
  float lumB = luminance(envB), lumT = luminance(envT);
  vec2 envGradient = vec2(lumR - lumL, lumT - lumB);
  float envContrast = length(envGradient);
  vec2 fallbackLight = normalize(uLightDir + vec2(1e-5));
  float lightAdapt = clamp(uHighlightAdapt, 0.0, 1.0) *
                     smoothstep(0.025, 0.22, envContrast);
  // Keep the lobe direction material-local. Steering it with the wallpaper
  // gradient creates a rapidly rotating direction field around hard colour
  // edges, which appears as diagonal tears and lets unrelated components alter
  // each other's highlights. The environment still adapts strength and colour.
  vec2 lightDir = fallbackLight;

  // Reflect the colour seen in the surface-normal direction. A local sample
  // keeps small bright structures (tower lights, clouds, coastlines) attached
  // to the nearby rim instead of turning every frame into the same white ring.
  float wx = clamp(0.5 + 0.5 * nn.x, 0.0, 1.0);
  float wy = clamp(0.5 + 0.5 * nn.y, 0.0, 1.0);
  vec3 envX = mix(envL, envR, wx);
  vec3 envY = mix(envB, envT, wy);
  vec3 ringEnv = (envX * abs(nn.x) + envY * abs(nn.y)) /
                 max(abs(nn.x) + abs(nn.y), 1e-3);
  vec3 localEnv = sampleBg(px + g * max(0.55 * uBevel, 6.0),
                           min(2.0, uMips - 1.0)).rgb;
  vec3 env = mix(ringEnv, localEnv, 0.58);
  float envLum = luminance(env);
  env = mix(env, vec3(envLum), 0.10); // retain wallpaper hue, tame neon spikes
  float envStrength = mix(0.58, 1.0, smoothstep(0.08, 0.75, envLum));
  col = mix(col, env, clamp(fres * uFresnel * envStrength, 0.0, 0.82));

  vec3 L1 = normalize(vec3(lightDir, 0.58));
  vec3 L2 = normalize(vec3(-lightDir, 0.48));
  float sharpness = max(uHighlightSharpness, 0.1);
  float s1 = pow(max(dot(n, L1), 0.0),
                 max(uSpecPower * sharpness, 1.0));
  float s2 = pow(max(dot(n, L2), 0.0),
                 max(uSpecPower * sharpness * 0.78, 1.0)) * 0.18;
  float highlightWidth = clamp(uHighlightWidth, 0.16, 1.0);
  float riseEnd = min(0.10, 0.25 * highlightWidth);
  float specBand = smoothstep(0.015, riseEnd, t) *
                   (1.0 - smoothstep(0.61 * highlightWidth,
                                     highlightWidth, t));
  float baseHighlight = clamp(uHighlightBase, 0.0, 1.0);
  float sourceStrength = baseHighlight + (1.0 - baseHighlight) * lightAdapt;
  vec3 sourceEnv = mix(mix(envL, envR, 0.5 + 0.5 * lightDir.x),
                       mix(envB, envT, 0.5 + 0.5 * lightDir.y), 0.5);
  float sourceLum = max(luminance(sourceEnv), 0.08);
  vec3 specColor = clamp(mix(vec3(1.0), sourceEnv / sourceLum, 0.42),
                         vec3(0.45), vec3(2.2));
  col += uSpecular * (s1 + s2) * specBand * sourceStrength * specColor;

  // Dark contour right at the silhouette: at grazing angles the rim reflects
  // the surroundings instead of transmitting, so real glass edges read dark.
  float w = max(uEdgeWidth, 0.5);
  float contour = smoothstep(w, 0.0, abs(d + 0.55 * w));
  col *= 1.0 - uEdgeDark * contour;

  // Crisp inner highlight line; direction and colour follow the local probe.
  float line = smoothstep(1.35 * w, 0.0, abs(d + 2.2 * w));
  float lit = 0.26 + 0.74 * max(dot(g, lightDir), 0.0);
  vec3 lineColor = mix(vec3(1.0), env / max(envLum, 0.12), 0.28);
  col += uEdgeLine * line * lit * lineColor;

  // ---- tint --------------------------------------------------------------
  // Tint and brightness are properties of the GLASS, so they must not depend on
  // what happens to be behind the element. An earlier version drove a white
  // veil (and gated brightness) off the average backdrop luminance, which made
  // one folder go pale as soon as something dark passed behind it while an
  // identically configured neighbour stayed clear -- same parameters, two
  // different materials. Every element now gets exactly the same treatment.
  col = mix(col, uTintColor, uTintAmount);
  col += uBright;

  // ---- soft contact shadow ----------------------------------------------
  float ds = sdAppleShape(px + vec2(0.0, uShadowOffset));
  float sh = exp(-max(ds, 0.0) / max(uShadowSize, 0.5)) * uShadow;

  if (uDebug == 1) col = vec3(h);
  if (uDebug == 2) col = vec3(0.5 + 0.5 * n.xy, n.z);
  if (uDebug == 3) col = vec3(length(dG) / max(uHeight, 1.0),
                              length(dR - dB) / max(uHeight, 1.0) * 6.0, 0.0);

  float a = aa + sh * (1.0 - aa);
  outColor = vec4(col * aa, a);   // premultiplied; shadow contributes black
}`;
