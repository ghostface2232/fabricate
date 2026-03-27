#version 300 es
precision highp float;

uniform sampler2D u_heightMap;
uniform vec2 u_texelSize;
uniform float u_radius;
uniform float u_intensity;

in vec2 v_uv;
out vec4 fragColor;

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
  float nearOcclusion = 0.0;
  float farOcclusion = 0.0;

  for (int i = 0; i < 16; i++) {
    vec2 baseOffset = poissonDisc[i] * u_radius * u_texelSize;
    float nearH = sampleH(v_uv + baseOffset * 0.6);
    float farH = sampleH(v_uv + baseOffset * 1.2);
    nearOcclusion += max(nearH - centerH, 0.0);
    farOcclusion += max(farH - centerH, 0.0);
  }

  nearOcclusion /= 16.0;
  farOcclusion /= 16.0;

  float hL = sampleH(v_uv + vec2(-1.0, 0.0) * u_texelSize);
  float hR = sampleH(v_uv + vec2( 1.0, 0.0) * u_texelSize);
  float hU = sampleH(v_uv + vec2( 0.0, 1.0) * u_texelSize);
  float hD = sampleH(v_uv + vec2( 0.0,-1.0) * u_texelSize);

  float cavity = max((hL + hR + hU + hD) * 0.25 - centerH, 0.0);
  float slope = length(vec2(hR - hL, hU - hD));
  float valleyMask = 1.0 - smoothstep(0.10, 0.68, centerH);

  float occlusion = nearOcclusion * 1.15 + farOcclusion * 0.85;
  float ao = 1.0 - clamp(occlusion * u_intensity * 1.25, 0.0, 1.0);
  ao *= 1.0 - clamp(cavity * (0.8 + u_intensity * 1.6), 0.0, 0.42);
  ao *= mix(0.58, 1.0, 1.0 - valleyMask);
  ao = mix(ao, ao * 0.96, smoothstep(0.08, 0.28, slope));

  ao = pow(clamp(ao, 0.0, 1.0), 1.18);
  fragColor = vec4(vec3(ao), 1.0);
}
