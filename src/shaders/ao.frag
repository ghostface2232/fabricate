#version 300 es
precision highp float;

uniform sampler2D u_heightMap;
uniform vec2 u_texelSize;
uniform float u_radius;
uniform float u_intensity;

in vec2 v_uv;
out vec4 fragColor;

// 16-sample Poisson disc offsets (unit disc)
const vec2 poissonDisc[16] = vec2[16](
  vec2(-0.9465, -0.1724), vec2( 0.3310, -0.8643),
  vec2( 0.8256,  0.0169), vec2(-0.3856,  0.7939),
  vec2(-0.1667, -0.4593), vec2( 0.5765,  0.5327),
  vec2(-0.7063, -0.6254), vec2( 0.1435,  0.3249),
  vec2( 0.7545, -0.4872), vec2(-0.5509,  0.2106),
  vec2( 0.0312, -0.9843), vec2(-0.9025,  0.3996),
  vec2( 0.4647,  0.8853), vec2(-0.2563, -0.8356),
  vec2( 0.9134,  0.3917), vec2(-0.6486, -0.0295)
);

float sampleH(vec2 coord) {
  return texture(u_heightMap, mod(coord, 1.0)).r;
}

void main() {
  float centerH = sampleH(v_uv);

  // Cavity-based AO: 16 Poisson samples
  float occlusion = 0.0;
  for (int i = 0; i < 16; i++) {
    vec2 offset = poissonDisc[i] * u_radius * u_texelSize;
    float sH = sampleH(v_uv + offset);
    occlusion += max(sH - centerH, 0.0);
  }
  occlusion /= 16.0;

  float ao = 1.0 - clamp(occlusion * u_intensity, 0.0, 1.0);

  // 구조적 깊이 AO: 낮은 영역(틈새, 하부 원사)을 어둡게
  float depthFactor = smoothstep(0.0, 0.7, centerH);
  ao *= mix(0.25, 1.0, depthFactor);

  // 방향성 캐비티: 십자 샘플링으로 교차점 경계 강조
  float hL = sampleH(v_uv + vec2(-1.0, 0.0) * u_texelSize);
  float hR = sampleH(v_uv + vec2( 1.0, 0.0) * u_texelSize);
  float hU = sampleH(v_uv + vec2( 0.0, 1.0) * u_texelSize);
  float hD = sampleH(v_uv + vec2( 0.0,-1.0) * u_texelSize);
  float cavity = max((hL + hR + hU + hD) * 0.25 - centerH, 0.0);
  ao *= 1.0 - clamp(cavity * u_intensity * 3.0, 0.0, 0.5);

  ao = pow(ao, 1.4);
  ao = clamp(ao, 0.0, 1.0);

  fragColor = vec4(vec3(ao), 1.0);
}
