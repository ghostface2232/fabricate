#version 300 es
precision highp float;

uniform sampler2D u_weaveMatrix;
uniform vec2 u_matrixSize;
uniform float u_density;
uniform float u_yarnThickness;
uniform float u_twistAngle;
uniform float u_flattening;

in vec2 v_uv;
out vec4 fragColor;

// 매트릭스 셀의 over/under 값 (0.0 또는 1.0)
float sampleWeave(vec2 cellIdx) {
  vec2 uv = (mod(cellIdx, u_matrixSize) + 0.5) / u_matrixSize;
  return step(0.5, texture(u_weaveMatrix, uv).r);
}

// 원사 단면: C¹ smooth 다항식 (1-t²)²(1+1.5t²)
float yarnProfile(float d, float r) {
  float t = clamp(abs(d) / r, 0.0, 1.0);
  float s = t * t;
  float u = 1.0 - s;
  return u * u * (1.0 + 1.5 * s);
}

void main() {
  vec2 tiledUV = v_uv * u_density;
  float halfR = u_yarnThickness * 0.7;
  // shear 양자화: density * shear를 정수로 맞춰 타일링 이음새 제거
  float rawShear = sin(u_twistAngle);
  float shear = round(rawShear * u_density) / u_density;

  // shear 좌표 → 셀 분율 / 원사 중심 거리
  vec2 sh = vec2(
    tiledUV.x + tiledUV.y * shear,
    tiledUV.y + tiledUV.x * shear
  );
  vec2 cellIdx = floor(sh);
  vec2 f = fract(sh);        // 셀 내 분율 [0,1)
  vec2 dist = f - 0.5;       // 원사 중심까지 거리 [-0.5, 0.5)

  float hardOver = sampleWeave(cellIdx);

  // ── 셀 경계 AA (상태가 바뀌는 경계에서만) ──
  vec2 nDir = mix(vec2(-1.0), vec2(1.0), step(0.5, f));
  float nOverX = sampleWeave(cellIdx + vec2(nDir.x, 0.0));
  float nOverY = sampleWeave(cellIdx + vec2(0.0, nDir.y));

  vec2 dBnd = min(f, 1.0 - f);
  float fw = max(fwidth(sh.x), fwidth(sh.y));
  float aaX = mix(1.0, smoothstep(0.0, fw * 5.0, dBnd.x), abs(hardOver - nOverX));
  float aaY = mix(1.0, smoothstep(0.0, fw * 5.0, dBnd.y), abs(hardOver - nOverY));
  float overFactor = mix(0.5, hardOver, min(aaX, aaY));

  // ── 교차점 짓눌림 (pinch): 수직 원사 근접 시 반경 축소 ──
  vec2 prox = vec2(
    smoothstep(halfR, 0.0, abs(dist.y)),
    smoothstep(halfR, 0.0, abs(dist.x))
  );
  vec2 r = halfR * (1.0 - 0.03 * prox);

  // 원사 프로파일
  float warpP = yarnProfile(dist.x, r.x);
  float weftP = yarnProfile(dist.y, r.y);

  // 섬유 방향 기준 위상 (회전 기반 — 주름이 섬유에 항상 수직)
  float effTwist = u_twistAngle;
  float twC = cos(effTwist);
  float twS = sin(effTwist);
  float warpPhase = tiledUV.x * twS + tiledUV.y * twC;
  float weftPhase = tiledUV.x * twC + tiledUV.y * twS;

  // 미세 줄무늬 (다중 주파수 합성)
  float warpS = (sin(warpPhase * 40.0) + sin(warpPhase * 27.0 + 1.7) * 0.5) * 0.008 * warpP;
  float weftS = (sin(weftPhase * 40.0) + sin(weftPhase * 27.0 + 2.3) * 0.5) * 0.008 * weftP;

  // ── 높이 산출 ──
  float crossing = warpP * weftP;
  float topBase = mix(0.58, 0.95, crossing);
  float botBase = mix(0.22, 0.05, crossing);
  float flatten = 1.0 - u_flattening * crossing;

  // warp-over / weft-over 각각의 최종 height를 독립 계산 후 블렌딩
  float hw = mix(botBase * weftP + weftS, topBase * warpP * flatten + warpS, smoothstep(0.0, 0.45, warpP));
  float hf = mix(botBase * warpP + warpS, topBase * weftP * flatten + weftS, smoothstep(0.0, 0.45, weftP));

  float h = mix(hf, hw, overFactor);

  // ── 경계 크레바스: 상태 전환 경계에서 미세한 골 ──
  float valleyWidth = 0.12;
  float valleyX = smoothstep(valleyWidth, 0.0, dBnd.x) * abs(hardOver - nOverX);
  float valleyY = smoothstep(valleyWidth, 0.0, dBnd.y) * abs(hardOver - nOverY);
  h -= max(valleyX, valleyY) * 0.04;

  // ── 틈새 함몰: 원사 커버리지 낮은 영역 ──
  float coverage = max(warpP, weftP);
  h *= smoothstep(0.0, 0.15, coverage);

  fragColor = vec4(vec3(clamp(h, 0.0, 1.0)), 1.0);
}
