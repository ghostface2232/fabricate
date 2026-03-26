#version 300 es
precision highp float;

uniform sampler2D u_heightMap;
uniform sampler2D u_weaveMatrix;
uniform vec2 u_texelSize;
uniform vec2 u_matrixSize;
uniform float u_density;
uniform float u_yarnThickness;
uniform float u_twistAngle;
uniform float u_twistIntensity;
uniform float u_roughnessBase;
uniform float u_roughnessVariation;
uniform float u_cavityInfluence;
uniform int u_patternType;  // 0-2: fabric, 3-4: carbon

in vec2 v_uv;
out vec4 fragColor;

float sampleH(vec2 offset) {
  return texture(u_heightMap, mod(v_uv + offset * u_texelSize, 1.0)).r;
}

float yarnProfile(float d, float r) {
  float t = clamp(abs(d) / r, 0.0, 1.0);
  float s = t * t;
  float u = 1.0 - s;
  return u * u * (1.0 + 1.5 * s);
}

void main() {
  float height = sampleH(vec2(0.0));

  // (a) Base roughness — carbon은 수지 코팅으로 더 매끈
  float base = u_roughnessBase;
  if (u_patternType >= 3) {
    base *= 0.5;
  }

  // ── 원사 방향 계산 ──
  vec2 tiledUV = v_uv * u_density;
  float shear = sin(u_twistAngle) * u_twistIntensity;
  vec2 sh = vec2(
    tiledUV.x + tiledUV.y * shear,
    tiledUV.y + tiledUV.x * shear
  );
  vec2 cellIdx = floor(sh);
  vec2 f = fract(sh);
  vec2 dist = f - 0.5;

  // 매트릭스 샘플: 1.0 = 경사 위, 0.0 = 위사 위
  vec2 matUV = (mod(cellIdx, u_matrixSize) + 0.5) / u_matrixSize;
  float overFactor = step(0.5, texture(u_weaveMatrix, matUV).r);

  // 원사 프로파일 → 가시 영역
  float halfR = u_yarnThickness * 0.7;
  float warpP = yarnProfile(dist.x, halfR);
  float weftP = yarnProfile(dist.y, halfR);

  // ── 방향성 섬유 러프니스 ──
  // 경사(warp) 섬유는 Y 방향, 위사(weft) 섬유는 X 방향
  float warpFiber = sin(sh.y * 120.0) * 0.5 + 0.5;
  float weftFiber = sin(sh.x * 120.0) * 0.5 + 0.5;

  // 가시성 가중 블렌딩: 위에 있는 원사 패턴이 지배
  float warpVis = warpP * mix(0.3, 1.0, overFactor);
  float weftVis = weftP * mix(1.0, 0.3, overFactor);
  float totalVis = warpVis + weftVis + 0.001;
  float fiberPattern = (warpFiber * warpVis + weftFiber * weftVis) / totalVis;

  float fiberVariation = (fiberPattern - 0.5) * u_roughnessVariation;

  // (c) 캐비티: 오목 영역은 러프니스 증가
  float hL = sampleH(vec2(-1.0, 0.0));
  float hR = sampleH(vec2( 1.0, 0.0));
  float hU = sampleH(vec2( 0.0, 1.0));
  float hD = sampleH(vec2( 0.0,-1.0));
  float cavity = max((hL + hR + hU + hD) * 0.25 - height, 0.0);
  float cavityContrib = clamp(cavity * u_cavityInfluence, 0.0, 0.15);

  // (d) 틈새 러프니스: 노출된 기저면은 더 거침
  float coverage = max(warpP, weftP);
  float gapRoughness = (1.0 - smoothstep(0.0, 0.2, coverage)) * 0.1;

  float roughness = clamp(base + fiberVariation + cavityContrib + gapRoughness, 0.05, 1.0);

  fragColor = vec4(vec3(roughness), 1.0);
}
