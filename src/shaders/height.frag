#version 300 es
precision highp float;

uniform sampler2D u_weaveMatrix;
uniform vec2 u_matrixSize;
uniform float u_density;
uniform float u_yarnThickness;
uniform float u_twistAngle;
uniform float u_flattening;
uniform int u_patternType;  // 0-2: fabric, 3-4: carbon

in vec2 v_uv;
out vec4 fragColor;

float sampleWeave(vec2 cellIdx) {
  vec2 uv = (mod(cellIdx, u_matrixSize) + 0.5) / u_matrixSize;
  return step(0.5, texture(u_weaveMatrix, uv).r);
}

// 패브릭 원사 단면: C¹ smooth (1-t²)²(1+1.5t²)
float yarnProfile(float d, float r) {
  float t = clamp(abs(d) / r, 0.0, 1.0);
  float s = t * t;
  float u = 1.0 - s;
  return u * u * (1.0 + 1.5 * s);
}

// 카본 토우 단면: 볼록 dome + 날카로운 에지 컷
float carbonProfile(float d, float r) {
  float t = clamp(abs(d) / r, 0.0, 1.0);
  float dome = 1.0 - 0.3 * t * t;          // 중앙 볼록 (30% 높이 차)
  float edge = smoothstep(1.0, 0.75, t);    // 75%부터 급격 드롭
  return dome * edge;
}

void main() {
  // density를 매트릭스 크기의 배수로 스냅
  float density = max(u_matrixSize.x, round(u_density / u_matrixSize.x) * u_matrixSize.x);
  vec2 tiledUV = v_uv * density;
  float halfR = u_yarnThickness * 0.7;
  float rawShear = sin(u_twistAngle);
  float shear = round(rawShear * density / u_matrixSize.x) * u_matrixSize.x / density;

  vec2 sh = vec2(
    tiledUV.x + tiledUV.y * shear,
    tiledUV.y + tiledUV.x * shear
  );
  vec2 cellIdx = floor(sh);
  vec2 f = fract(sh);
  vec2 dist = f - 0.5;

  float hardOver = sampleWeave(cellIdx);
  bool isCarbon = u_patternType >= 3;

  // ── 이웃 셀 샘플링 ──
  vec2 nDir = mix(vec2(-1.0), vec2(1.0), step(0.5, f));
  float nOverX = sampleWeave(cellIdx + vec2(nDir.x, 0.0));
  float nOverY = sampleWeave(cellIdx + vec2(0.0, nDir.y));

  // ── 셀 경계 AA ──
  vec2 dBnd = min(f, 1.0 - f);
  float fw = max(fwidth(sh.x), fwidth(sh.y));
  float aaEdge = isCarbon ? 3.0 : 5.0;
  float aaX = mix(1.0, smoothstep(0.0, fw * aaEdge, dBnd.x), abs(hardOver - nOverX));
  float aaY = mix(1.0, smoothstep(0.0, fw * aaEdge, dBnd.y), abs(hardOver - nOverY));
  float overFactor = mix(0.5, hardOver, min(aaX, aaY));

  // ── 원사/토우 프로파일 ──
  float warpP, weftP;
  if (isCarbon) {
    warpP = carbonProfile(dist.x, halfR);
    weftP = carbonProfile(dist.y, halfR);
  } else {
    // 교차점 짓눌림: 수직 원사 근접 시 반경 축소
    vec2 prox = vec2(
      smoothstep(halfR, 0.0, abs(dist.y)),
      smoothstep(halfR, 0.0, abs(dist.x))
    );
    vec2 r = halfR * (1.0 - 0.04 * prox);
    warpP = yarnProfile(dist.x, r.x);
    weftP = yarnProfile(dist.y, r.y);
  }

  float h;

  if (isCarbon) {
    // ════════════════════════════════════════
    // 카본: 볼록 dome + 날카로운 에지 + 미세 결
    // ════════════════════════════════════════
    float topH = 0.80;
    float botH = 0.18;

    // warp-over / weft-over
    float hWarpOver = topH * warpP + botH * weftP * (1.0 - warpP);
    float hWeftOver = topH * weftP + botH * warpP * (1.0 - weftP);
    h = mix(hWeftOver, hWarpOver, overFactor);

    // 카본 섬유 결: 토우 방향 미세 grain (타일링 안전)
    vec2 mc = mod(cellIdx, u_matrixSize);
    float warpGrain = sin(f.y * 50.0 + mc.y * 2.91) * 0.012 * warpP;
    float weftGrain = sin(f.x * 50.0 + mc.x * 2.91) * 0.012 * weftP;
    h += mix(weftGrain, warpGrain, overFactor);

    // 토우 사이 날카로운 갭
    float coverage = max(warpP, weftP);
    h *= smoothstep(0.0, 0.05, coverage);

  } else {
    // ════════════════════════════════════════
    // 패브릭: 넓은 blend로 자연스러운 전환
    // ════════════════════════════════════════

    // ── 섬유 줄무늬 ──
    float twC = cos(u_twistAngle);
    float twS = sin(u_twistAngle);
    vec2 mc = mod(cellIdx, u_matrixSize);
    float warpPhase = f.x * twS + f.y * twC + mc.x * 1.37 + mc.y * 0.73;
    float weftPhase = f.x * twC + f.y * twS + mc.x * 0.73 + mc.y * 1.37;
    float warpS = (sin(warpPhase * 40.0) + sin(warpPhase * 27.0 + 1.7) * 0.5) * 0.007 * warpP;
    float weftS = (sin(weftPhase * 40.0) + sin(weftPhase * 27.0 + 2.3) * 0.5) * 0.007 * weftP;

    float crossing = warpP * weftP;
    float flatten = 1.0 - u_flattening * crossing;

    // ── 종방향 아치: 미세 dome ──
    float warpTransY = abs(hardOver - nOverY);
    float warpArch = mix(mix(0.99, 0.93, warpTransY), 1.02, smoothstep(0.0, 0.5, dBnd.y));
    float weftTransX = abs(hardOver - nOverX);
    float weftArch = mix(mix(0.99, 0.93, weftTransX), 1.02, smoothstep(0.0, 0.5, dBnd.x));

    // ── 상부/하부 기본 높이 ──
    float topBase = mix(0.55, 0.90, crossing);
    float botBase = mix(0.25, 0.08, crossing);

    // ── warp-over / weft-over 높이 (넓은 blend=0.40으로 lip 최소화) ──
    float hw = mix(
      botBase * weftP + weftS,
      topBase * warpP * flatten * warpArch + warpS,
      smoothstep(0.0, 0.40, warpP)
    );
    float hf = mix(
      botBase * warpP + warpS,
      topBase * weftP * flatten * weftArch + weftS,
      smoothstep(0.0, 0.40, weftP)
    );

    h = mix(hf, hw, overFactor);

    // ── Gap mask ──
    float coverage = max(warpP, weftP);
    h *= smoothstep(0.0, 0.12, coverage);
  }

  fragColor = vec4(vec3(clamp(h, 0.0, 1.0)), 1.0);
}
