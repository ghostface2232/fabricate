#version 300 es
precision highp float;

uniform sampler2D u_heightMap;
uniform vec2 u_texelSize;
uniform float u_strength;
uniform int u_filter;       // 0 = Sobel, 1 = Scharr
uniform int u_patternType;  // 0-2: fabric, 3-4: carbon

in vec2 v_uv;
out vec4 fragColor;

float sampleH(vec2 offset) {
  vec2 coord = mod(v_uv + offset * u_texelSize, 1.0);
  return texture(u_heightMap, coord).r;
}

void main() {
  float tl = sampleH(vec2(-1.0,  1.0));
  float t  = sampleH(vec2( 0.0,  1.0));
  float tr = sampleH(vec2( 1.0,  1.0));
  float l  = sampleH(vec2(-1.0,  0.0));
  float r  = sampleH(vec2( 1.0,  0.0));
  float bl = sampleH(vec2(-1.0, -1.0));
  float b  = sampleH(vec2( 0.0, -1.0));
  float br = sampleH(vec2( 1.0, -1.0));

  float gx, gy;

  if (u_filter == 1) {
    // Scharr
    gx = -3.0 * tl + 3.0 * tr
       - 10.0 * l  + 10.0 * r
       - 3.0 * bl  + 3.0 * br;
    gy = -3.0 * tl - 10.0 * t - 3.0 * tr
       +  3.0 * bl + 10.0 * b + 3.0 * br;
  } else {
    // Sobel
    gx = -1.0 * tl + 1.0 * tr
       - 2.0 * l  + 2.0 * r
       - 1.0 * bl + 1.0 * br;
    gy = -1.0 * tl - 2.0 * t - 1.0 * tr
       +  1.0 * bl + 2.0 * b + 1.0 * br;
  }

  vec3 normal = vec3(-gx * u_strength, gy * u_strength, 1.0);
  normal.z = max(normal.z, 0.001);
  normal = normalize(normal);

  // ── 깊이 감쇠: 하부 영역의 노멀 강도 조절 ──
  float centerH = texture(u_heightMap, v_uv).r;

  if (u_patternType >= 3) {
    // 카본: 최소 감쇠 — 선명한 노멀 유지
    float depthAtten = smoothstep(0.03, 0.20, centerH);
    normal.xy *= mix(0.65, 1.0, depthAtten);
  } else {
    // 패브릭: 평탄한 하부 영역은 감쇠, 이음새 경사면은 보존
    float slope = length(vec2(gx, gy));
    float slopePreserve = smoothstep(0.1, 0.5, slope);
    float depthAtten = smoothstep(0.05, 0.45, centerH);
    float atten = mix(mix(0.25, 1.0, depthAtten), 1.0, slopePreserve);
    normal.xy *= atten;
  }
  normal = normalize(normal);

  fragColor = vec4(normal * 0.5 + 0.5, 1.0);
}
