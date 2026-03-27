#version 300 es
precision highp float;

uniform sampler2D u_heightMap;
uniform sampler2D u_weaveMatrix;
uniform vec2 u_texelSize;
uniform vec2 u_matrixSize;
uniform float u_density;
uniform float u_yarnThickness;
uniform float u_twistAngle;
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

  // Base roughness — carbon은 수지 코팅으로 더 매끈
  float base = u_roughnessBase;
  if (u_patternType >= 3) {
    base *= 0.5;
  }

  // ── 원사 방향 계산 ──
  vec2 tiledUV = v_uv * u_density;
  float rawShear = sin(u_twistAngle);
  float shear = round(rawShear * u_density) / u_density;
  vec2 sh = vec2(
    tiledUV.x + tiledUV.y * shear,
    tiledUV.y + tiledUV.x * shear
  );
  vec2 cellIdx = floor(sh);
  vec2 f = fract(sh);
  vec2 dist = f - 0.5;

  // 매트릭스 샘플
  vec2 matUV = (mod(cellIdx, u_matrixSize) + 0.5) / u_matrixSize;
  float overFactor = step(0.5, texture(u_weaveMatrix, matUV).r);

  // 원사 프로파일
  float halfR = u_yarnThickness * 0.7;
  float warpP = yarnProfile(dist.x, halfR);
  float weftP = yarnProfile(dist.y, halfR);

  // ── 이웃 높이 샘플 (slope + cavity 공용) ──
  float hL = sampleH(vec2(-1.0, 0.0));
  float hR = sampleH(vec2( 1.0, 0.0));
  float hU = sampleH(vec2( 0.0, 1.0));
  float hD = sampleH(vec2( 0.0,-1.0));
  float slope = length(vec2(hR - hL, hU - hD)) * 0.5;

  // ══════════════════════════════════════════
  // 지형 구역 분류: ridge / sidewall / valley
  // ══════════════════════════════════════════

  // Ridge: 높이 높고 + 경사 완만 (원사 정점)
  float ridgeMask = smoothstep(0.2, 0.85, height) * (1.0 - smoothstep(0.005, 0.2, slope));

  // Sidewall: 경사 급함 (원사 측면, 광 확산 영역)
  float sidewallMask = smoothstep(0.005, 0.15, slope) * smoothstep(0.0, 0.5, height);

  // Valley: 높이 낮음 (틈새, 교차 눌림부, 하부 원사)
  float valleyMask = 1.0 - smoothstep(0.0, 0.65, height);

  // ── 구역별 기본 러프니스 ──
  float ridgeRoughness = base * 0.96;
  float sidewallRoughness = base * 1.06;

  float valleyRoughness;
  if (u_patternType >= 3) {
    valleyRoughness = base * 0.82;
  } else {
    valleyRoughness = base * 1.04;
  }

  // 구역 블렌딩
  float zoneRoughness = base;
  zoneRoughness = mix(zoneRoughness, ridgeRoughness, ridgeMask);
  zoneRoughness = mix(zoneRoughness, sidewallRoughness, sidewallMask);
  zoneRoughness = mix(zoneRoughness, valleyRoughness, valleyMask);

  // ── 방향성 섬유 패턴 (회전 기반 — 섬유에 항상 수직) ──
  float effTwist = u_twistAngle;
  float twC = cos(effTwist);
  float twS = sin(effTwist);
  float warpFiberPhase = tiledUV.x * twS + tiledUV.y * twC;
  float weftFiberPhase = tiledUV.x * twC + tiledUV.y * twS;

  float warpFiber = sin(warpFiberPhase * 120.0) * 0.5 + 0.5;
  float weftFiber = sin(weftFiberPhase * 120.0) * 0.5 + 0.5;

  float warpVis = warpP * mix(0.3, 1.0, overFactor);
  float weftVis = weftP * mix(1.0, 0.3, overFactor);
  float totalVis = warpVis + weftVis + 0.001;
  float fiberPattern = (warpFiber * warpVis + weftFiber * weftVis) / totalVis;

  // Ridge: 섬유 패턴 약하게, Sidewall: 풀 스케일
  float fiberScale = mix(0.5, 1.0, sidewallMask) * (1.0 - 0.3 * valleyMask);
  float fiberVariation = (fiberPattern - 0.5) * u_roughnessVariation * fiberScale;

  // ── 구역별 미세 노이즈 ──
  float ridgeNoise = sin(sh.x * 200.0 + sh.y * 173.0) * 0.005 * ridgeMask;
  float valleyNoise = sin(sh.x * 47.0 + sh.y * 83.0) * 0.010 * valleyMask;

  // ── 캐비티 ──
  float cavity = max((hL + hR + hU + hD) * 0.25 - height, 0.0);
  float cavityContrib = clamp(cavity * u_cavityInfluence, 0.0, 0.15);

  float roughness = clamp(
    zoneRoughness + fiberVariation + ridgeNoise + valleyNoise + cavityContrib,
    0.05, 1.0
  );

  fragColor = vec4(vec3(roughness), 1.0);
}
