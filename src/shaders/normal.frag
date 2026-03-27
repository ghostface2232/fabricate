#version 300 es
precision highp float;

uniform sampler2D u_heightMap;
uniform vec2 u_texelSize;
uniform float u_strength;
uniform int u_patternType;  // 0-2: fabric, 3-4: carbon

in vec2 v_uv;
out vec4 fragColor;

float sampleH(vec2 offset, float scale) {
  vec2 coord = mod(v_uv + offset * u_texelSize * scale, 1.0);
  return texture(u_heightMap, coord).r;
}

vec2 gradientAtScale(float scale) {
  float tl = sampleH(vec2(-1.0,  1.0), scale);
  float t  = sampleH(vec2( 0.0,  1.0), scale);
  float tr = sampleH(vec2( 1.0,  1.0), scale);
  float l  = sampleH(vec2(-1.0,  0.0), scale);
  float r  = sampleH(vec2( 1.0,  0.0), scale);
  float bl = sampleH(vec2(-1.0, -1.0), scale);
  float b  = sampleH(vec2( 0.0, -1.0), scale);
  float br = sampleH(vec2( 1.0, -1.0), scale);

  float gx;
  float gy;

  gx = -3.0 * tl + 3.0 * tr
     - 10.0 * l  + 10.0 * r
     - 3.0 * bl  + 3.0 * br;
  gy = -3.0 * tl - 10.0 * t - 3.0 * tr
     +  3.0 * bl + 10.0 * b + 3.0 * br;

  return vec2(gx, gy);
}

void main() {
  float carbonFactor = u_patternType >= 3 ? 1.0 : 0.0;

  float centerH = sampleH(vec2(0.0), 1.0);
  float hL = sampleH(vec2(-1.0, 0.0), 1.0);
  float hR = sampleH(vec2( 1.0, 0.0), 1.0);
  float hU = sampleH(vec2( 0.0, 1.0), 1.0);
  float hD = sampleH(vec2( 0.0,-1.0), 1.0);

  vec2 fineGrad = gradientAtScale(1.0);
  vec2 broadGrad = gradientAtScale(2.0);
  float broadSlope = length(broadGrad);
  float localSlope = length(fineGrad);
  float curvature = abs((hL + hR + hU + hD) - centerH * 4.0);

  float ridgeMask = smoothstep(0.28, 0.82, centerH) * (1.0 - smoothstep(0.12, 0.5, broadSlope));
  float cavityMask = smoothstep(0.01, 0.08, curvature);
  float broadMix = mix(0.28, 0.22, carbonFactor) + ridgeMask * mix(0.18, 0.02, carbonFactor);
  vec2 grad = mix(fineGrad, broadGrad, broadMix);
  vec2 detailGrad = fineGrad - broadGrad * 0.34;
  float detailMask = smoothstep(0.10, 0.62, centerH) * (1.0 - smoothstep(0.28, 0.92, broadSlope));
  grad += detailGrad * 0.5 * detailMask * carbonFactor;

  float depthAtten = mix(
    smoothstep(0.05, 0.30, centerH),
    smoothstep(0.04, 0.22, centerH),
    carbonFactor
  );
  float slopePreserve = smoothstep(0.06, 0.32, localSlope);
  float atten = mix(mix(0.42, 0.78, depthAtten), 1.0, max(slopePreserve * (1.0 - carbonFactor * 0.05), cavityMask * 0.56));
  grad *= atten;

  vec3 normal = vec3(-grad.x * u_strength, grad.y * u_strength, 1.0);
  normal.z = max(normal.z, 0.001);
  normal = normalize(normal);

  fragColor = vec4(normal * 0.5 + 0.5, 1.0);
}
