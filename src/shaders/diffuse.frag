#version 300 es
precision highp float;

uniform sampler2D u_weaveMatrix;
uniform vec2 u_matrixSize;
uniform float u_density;
uniform sampler2D u_heightMap;
uniform vec3 u_color1;  // warp color or fiber color
uniform vec3 u_color2;  // weft color or resin color
uniform float u_yarnThickness;
uniform int u_patternType;  // 0-2: fabric, 3-4: carbon

in vec2 v_uv;
out vec4 fragColor;

void main() {
  // Tiled UV to determine which matrix cell we're in
  vec2 tiledUV = v_uv * u_density;
  vec2 cellIdx = floor(tiledUV);

  // Sample weave matrix: 1.0 = warp-over, 0.0 = weft-over
  vec2 matUV = (mod(cellIdx, u_matrixSize) + 0.5) / u_matrixSize;
  float overFactor = step(0.5, texture(u_weaveMatrix, matUV).r);

  // Select color based on matrix value
  vec3 selectedColor = mix(u_color2, u_color1, overFactor);

  // Height-based self-shadow
  float heightValue = texture(u_heightMap, v_uv).r;
  float darkening = mix(0.65, 1.0, heightValue);
  vec3 finalColor = selectedColor * darkening;

  // Carbon fiber detail: micro-stripes along fiber direction
  if (u_patternType >= 3) {
    vec2 f = fract(tiledUV);
    // Along-fiber UV: warp runs vertically, weft runs horizontally
    float alongFiberUV = mix(f.x, f.y, overFactor);
    float fiberDetail = sin(alongFiberUV * 80.0) * 0.015;
    finalColor += fiberDetail;
  }

  fragColor = vec4(finalColor, 1.0);
}
