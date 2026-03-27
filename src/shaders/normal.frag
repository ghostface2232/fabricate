#version 300 es
precision highp float;

uniform sampler2D u_heightMap;
uniform vec2 u_texelSize;
uniform float u_strength;
uniform int u_filter;  // 0 = Sobel, 1 = Scharr

in vec2 v_uv;
out vec4 fragColor;

float sampleH(vec2 offset) {
  vec2 coord = mod(v_uv + offset * u_texelSize, 1.0);
  return texture(u_heightMap, coord).r;
}

void main() {
  // 주변 8개 텍셀 높이 샘플링
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

  vec3 normal = vec3(-gx * u_strength, -gy * u_strength, 1.0);
  normal.z = max(normal.z, 0.001);
  normal = normalize(normal);

  // 하부 원사 노멀 감쇠: 낮은 영역은 위 원사 그림자에 묻혀 디테일이 약해짐
  float centerH = texture(u_heightMap, v_uv).r;
  float depthAtten = smoothstep(0.1, 0.55, centerH);
  normal.xy *= mix(0.35, 1.0, depthAtten);
  normal = normalize(normal);

  // 탄젠트 공간 노멀 → 색상 공간
  fragColor = vec4(normal * 0.5 + 0.5, 1.0);
}
