#version 300 es
precision highp float;

uniform sampler2D u_heightMap;
uniform vec2 u_texelSize;
uniform float u_roughnessBase;
uniform float u_roughnessVariation;
uniform float u_cavityInfluence;
uniform int u_patternType;  // 0-2: fabric, 3-4: carbon

in vec2 v_uv;
out vec4 fragColor;

float sampleH(vec2 offset) {
  return texture(u_heightMap, mod(v_uv + offset * u_texelSize, 1.0)).r;
}

void main() {
  float height = sampleH(vec2(0.0));

  // (a) Base roughness — carbon is smoother (resin coating)
  float base = u_roughnessBase;
  if (u_patternType >= 3) {
    base *= 0.5;
  }

  // (b) Height influence: high → lower roughness, low → higher roughness
  float variation = (0.5 - height) * u_roughnessVariation;

  // (c) Cavity influence: concave areas accumulate more roughness
  float hL = sampleH(vec2(-1.0, 0.0));
  float hR = sampleH(vec2( 1.0, 0.0));
  float hU = sampleH(vec2( 0.0, 1.0));
  float hD = sampleH(vec2( 0.0,-1.0));
  float avgNeighbor = (hL + hR + hU + hD) * 0.25;
  float cavity = avgNeighbor - height;
  float cavityContrib = clamp(cavity * u_cavityInfluence, 0.0, 0.15);

  // (d) Micro-variation: high-frequency noise
  float noise = sin(v_uv.x * 127.3 + v_uv.y * 311.7) * 0.02;

  float roughness = clamp(base + variation + cavityContrib + noise, 0.05, 1.0);

  fragColor = vec4(vec3(roughness), 1.0);
}
