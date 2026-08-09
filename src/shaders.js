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
  vec3 a = texture(uTex, vUV).rgb * 0.125;
  vec3 b = (texture(uTex, vUV + vec2(-t.x, -t.y)).rgb +
            texture(uTex, vUV + vec2( t.x, -t.y)).rgb +
            texture(uTex, vUV + vec2(-t.x,  t.y)).rgb +
            texture(uTex, vUV + vec2( t.x,  t.y)).rgb) * 0.125;
  vec3 c = (texture(uTex, vUV + vec2(-2.0 * t.x, 0.0)).rgb +
            texture(uTex, vUV + vec2( 2.0 * t.x, 0.0)).rgb +
            texture(uTex, vUV + vec2(0.0, -2.0 * t.y)).rgb +
            texture(uTex, vUV + vec2(0.0,  2.0 * t.y)).rgb) * 0.0625;
  vec3 d = (texture(uTex, vUV + vec2(-2.0 * t.x, -2.0 * t.y)).rgb +
            texture(uTex, vUV + vec2( 2.0 * t.x, -2.0 * t.y)).rgb +
            texture(uTex, vUV + vec2(-2.0 * t.x,  2.0 * t.y)).rgb +
            texture(uTex, vUV + vec2( 2.0 * t.x,  2.0 * t.y)).rgb) * 0.03125;
  outColor = vec4(a + b + c + d, 1.0);
}`;

// Procedural wallpapers. They only exist to give the glass something with hard,
// high contrast edges to bend -- exactly what the reference screenshots have.
export const FS_WALLPAPER = `#version 300 es
precision highp float;
in vec2 vUV;
uniform vec2 uRes;
uniform int uScene;
uniform float uZoom;
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

void main() {
  vec2 uv = (vUV - 0.5) / max(uZoom, 0.01) + 0.5;
  vec3 col = uScene == 0 ? sunsetBranches(uv)
           : uScene == 1 ? deepBlueCity(uv)
                         : islandOcean(uv);
  outColor = vec4(col, 1.0);
}`;

// ---------------------------------------------------------------------------
// The material itself.
//
// 1. shape          : squircle SDF d(p)  (continuous-curvature corners)
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
// 6. scattering     : variable blur via textureLod on the blurred mip chain,
//                     strong on the plateau, weak on the rim
// 7. reflection     : Fresnel-weighted environment + 2 specular lobes on the
//                     bevel -> the bright glass rim
// 8. shading        : adaptive tint / saturation + soft contact shadow
// ---------------------------------------------------------------------------
export const FS_GLASS = `#version 300 es
precision highp float;
in vec2 vUV;
out vec4 outColor;

uniform sampler2D uSrc;      // blurred mip chain of the backdrop
uniform vec2  uRes;
uniform vec2  uCenter;       // element centre, px (y up)
uniform vec2  uHalf;         // element half size, px
uniform float uRadius;       // corner radius, px
uniform float uSquircle;     // superellipse exponent (2 = circular corners)
uniform float uBevel;        // width of the refracting rim, px
uniform float uHeight;       // glass height / optical thickness, px
uniform float uIOR;
uniform float uDispersion;
uniform float uBlurPlateau;  // mip lod in the middle
uniform float uBlurRim;      // mip lod at the rim
uniform float uSpecular;
uniform float uSpecPower;
uniform float uFresnel;
uniform float uSat;
uniform float uBright;
uniform float uTintAmount;
uniform float uAdaptive;
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
uniform float uAvgLod;       // mip level whose texel covers the whole element

float sdSquircle(vec2 p, vec2 b, float r, float n) {
  vec2 q = abs(p) - b + r;
  vec2 m = max(q, 0.0) + 1e-5;
  float e = pow(pow(m.x, n) + pow(m.y, n), 1.0 / n);
  return min(max(q.x, q.y), 0.0) + e - r;
}

vec3 sampleBg(vec2 px, float lod) {
  vec2 uv = clamp(px / uRes, vec2(0.001), vec2(0.999));
  return textureLod(uSrc, uv, lod).rgb;
}

void main() {
  vec2 px = vUV * uRes;
  vec2 p  = px - uCenter;

  float d = sdSquircle(p, uHalf, uRadius, uSquircle);
  float aa = smoothstep(0.8, -0.8, d);

  // ---- gradient of the SDF = outward direction of the surface -------------
  float k = 1.0;
  float dx = sdSquircle(p + vec2(k, 0.0), uHalf, uRadius, uSquircle) -
             sdSquircle(p - vec2(k, 0.0), uHalf, uRadius, uSquircle);
  float dy = sdSquircle(p + vec2(0.0, k), uHalf, uRadius, uSquircle) -
             sdSquircle(p - vec2(0.0, k), uHalf, uRadius, uSquircle);
  vec2 g = normalize(vec2(dx, dy) + 1e-6);

  // ---- thickness field / bevel profile -----------------------------------
  float t  = clamp(-d / uBevel, 0.0, 1.0);   // 0 at the edge, 1 on the plateau
  float ct = 1.0 - t;
  float h  = sqrt(max(1.0 - ct * ct, 0.0));  // convex (circular) bevel
  float dhdt = ct / max(h, 0.10);            // slope, clamped at the silhouette
  float slope = (uHeight / uBevel) * dhdt;

  float curveSign = mix(1.0, -1.0, clamp(uMeniscus, 0.0, 1.0));
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

  // ---- scattering: rim stays readable, plateau is frosted ----------------
  float lod = mix(uBlurRim, uBlurPlateau, smoothstep(0.0, 0.85, t));

  vec3 col;
  col.r = sampleBg(px + dR, lod).r;
  col.g = sampleBg(px + dG, lod).g;
  col.b = sampleBg(px + dB, lod).b;

  // ---- reflection: environment + two specular lobes on the bevel ---------
  float fres = pow(1.0 - n.z, 3.0);
  vec2 nn = normalize(n.xy + 1e-6);
  vec3 env = mix(vec3(0.52, 0.57, 0.66), vec3(1.0), 0.30 + 0.70 * clamp(0.5 + 0.5 * nn.y, 0.0, 1.0));
  col = mix(col, env, clamp(fres * uFresnel, 0.0, 1.0));

  vec3 L1 = normalize(vec3(uLightDir, 0.62));
  vec3 L2 = normalize(vec3(-uLightDir, 0.50));
  float s1 = pow(max(dot(n, L1), 0.0), uSpecPower);
  float s2 = pow(max(dot(n, L2), 0.0), uSpecPower * 0.55) * 0.5;
  float rimBand = smoothstep(0.0, 0.30, t) * smoothstep(1.0, 0.55, t);
  col += uSpecular * (s1 + s2) * (0.35 + 0.65 * rimBand);

  // Dark contour right at the silhouette: at grazing angles the rim reflects
  // the surroundings instead of transmitting, so real glass edges read dark.
  float w = max(uEdgeWidth, 0.5);
  float contour = smoothstep(w, 0.0, abs(d + 0.55 * w));
  col *= 1.0 - uEdgeDark * contour;

  // crisp inner highlight line, brighter where the bevel faces the light
  float line = smoothstep(1.35 * w, 0.0, abs(d + 2.2 * w));
  float lit = 0.30 + 0.70 * max(dot(g, normalize(uLightDir)), 0.0);
  col += uEdgeLine * line * lit;

  // ---- adaptive tint -----------------------------------------------------
  float lum = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col = mix(vec3(lum), col, uSat);
  col = mix(col, uTintColor, uTintAmount);
  // Adaptive: the veil follows the AVERAGE luminance of the backdrop behind the
  // whole element (one low-res tap), not the per-pixel luminance. That is what
  // keeps dark details dark while still lightening the panel over dark
  // wallpapers -- per-pixel adaptation would grey out the content.
  float bgLum = dot(textureLod(uSrc, uCenter / uRes, uAvgLod).rgb,
                    vec3(0.2126, 0.7152, 0.0722));
  float dark = smoothstep(0.45, 0.05, bgLum);
  col = mix(col, vec3(1.0), uAdaptive * dark);
  col += uBright * dark;

  // ---- soft contact shadow ----------------------------------------------
  float ds = sdSquircle(p + vec2(0.0, uShadowOffset), uHalf, uRadius, uSquircle);
  float sh = exp(-max(ds, 0.0) / max(uShadowSize, 0.5)) * uShadow;

  if (uDebug == 1) col = vec3(h);
  if (uDebug == 2) col = vec3(0.5 + 0.5 * n.xy, n.z);
  if (uDebug == 3) col = vec3(length(dG) / max(uHeight, 1.0),
                              length(dR - dB) / max(uHeight, 1.0) * 6.0, 0.0);

  float a = aa + sh * (1.0 - aa);
  outColor = vec4(col * aa, a);   // premultiplied; shadow contributes black
}`;
