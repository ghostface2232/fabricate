#version 300 es
precision highp float;

uniform sampler2D u_weaveMatrix;
uniform vec2 u_matrixSize;
uniform float u_density;
uniform float u_yarnThickness;
uniform float u_twistAngle;
uniform float u_twistIntensity;
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
  float shear = sin(u_twistAngle) * u_twistIntensity;

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
  float aaX = mix(1.0, smoothstep(0.0, fw * 3.0, dBnd.x), abs(hardOver - nOverX));
  float aaY = mix(1.0, smoothstep(0.0, fw * 3.0, dBnd.y), abs(hardOver - nOverY));
  float overFactor = mix(0.5, hardOver, min(aaX, aaY));

  // ── 교차점 짓눌림 (pinch): 수직 원사 근접 시 반경 축소 ──
  vec2 prox = vec2(
    smoothstep(halfR, 0.0, abs(dist.y)),
    smoothstep(halfR, 0.0, abs(dist.x))
  );
  vec2 r = halfR * (1.0 - 0.02 * prox);

  // 원사 프로파일
  float warpP = yarnProfile(dist.x, r.x);
  float weftP = yarnProfile(dist.y, r.y);

  // 미세 줄무늬 (프로파일에 곱해서 원사 위에서만)
  float warpS = sin(tiledUV.y * 40.0) * 0.012 * warpP;
  float weftS = sin(tiledUV.x * 40.0) * 0.012 * weftP;

  // ── 높이 산출 ──
  float crossing = warpP * weftP;
  float topBase = mix(0.58, 0.95, crossing);
  float botBase = mix(0.40, 0.05, crossing);
  float flatten = 1.0 - u_flattening * crossing;

  // warp-over / weft-over 각각의 최종 height를 독립 계산 후 블렌딩
  float hw = mix(botBase * weftP + weftS, topBase * warpP * flatten + warpS, smoothstep(0.0, 0.45, warpP));
  float hf = mix(botBase * warpP + warpS, topBase * weftP * flatten + weftS, smoothstep(0.0, 0.45, weftP));

  fragColor = vec4(vec3(mix(hf, hw, overFactor)), 1.0);
}
