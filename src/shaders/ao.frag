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

  // Gamma correction for contrast
  ao = pow(ao, 1.2);

  // 3x3 Gaussian blur in same pass for smoother result
  float blurSum = 0.0;
  float blurW = 0.0;

  for (int dy = -1; dy <= 1; dy++) {
    for (int dx = -1; dx <= 1; dx++) {
      vec2 off = vec2(float(dx), float(dy)) * u_texelSize;
      vec2 coord = mod(v_uv + off, 1.0);
      float sH = sampleH(coord);

      // Recompute AO for this neighbor
      float nOcc = 0.0;
      for (int i = 0; i < 16; i++) {
        vec2 pOff = poissonDisc[i] * u_radius * u_texelSize;
        float pH = sampleH(coord + pOff);
        nOcc += max(pH - sH, 0.0);
      }
      nOcc /= 16.0;
      float nAo = 1.0 - clamp(nOcc * u_intensity, 0.0, 1.0);
      nAo = pow(nAo, 1.2);

      // Gaussian weight: center=4, edge=2, corner=1
      float w = (dx == 0 && dy == 0) ? 4.0 :
                (dx == 0 || dy == 0) ? 2.0 : 1.0;
      blurSum += nAo * w;
      blurW += w;
    }
  }

  ao = blurSum / blurW;

  fragColor = vec4(vec3(ao), 1.0);
}
