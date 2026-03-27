#version 300 es
precision highp float;

uniform sampler2D u_weaveMatrix;
uniform vec2 u_matrixSize;
uniform float u_density;
uniform sampler2D u_heightMap;
uniform vec3 u_color1;  // warp color or fiber color
uniform vec3 u_color2;  // weft color or resin color
uniform float u_yarnThickness;
uniform float u_twistAngle;
uniform int u_patternType;  // 0-2: fabric, 3-4: carbon

in vec2 v_uv;
out vec4 fragColor;

float sampleWeave(vec2 cellIdx) {
  vec2 uv = (mod(cellIdx, u_matrixSize) + 0.5) / u_matrixSize;
  return step(0.5, texture(u_weaveMatrix, uv).r);
}

float yarnProfile(float d, float r) {
  float t = clamp(abs(d) / r, 0.0, 1.0);
  float s = t * t;
  float u = 1.0 - s;
  return u * u * (1.0 + 1.5 * s);
}

void main() {
  // ── Shear 좌표계 (Height Map과 동일) ──
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

  float hardOver = sampleWeave(cellIdx);

  // ── 셀 경계 AA (Height Map과 동일) ──
  vec2 nDir = mix(vec2(-1.0), vec2(1.0), step(0.5, f));
  float nOverX = sampleWeave(cellIdx + vec2(nDir.x, 0.0));
  float nOverY = sampleWeave(cellIdx + vec2(0.0, nDir.y));

  vec2 dBnd = min(f, 1.0 - f);
  float fw = max(fwidth(sh.x), fwidth(sh.y));
  float aaX = mix(1.0, smoothstep(0.0, fw * 3.0, dBnd.x), abs(hardOver - nOverX));
  float aaY = mix(1.0, smoothstep(0.0, fw * 3.0, dBnd.y), abs(hardOver - nOverY));
  float overFactor = mix(0.5, hardOver, min(aaX, aaY));

  // ── 원사 프로파일 (유기적 변형 적용) ──
  float halfR = u_yarnThickness * 0.7;

  // 섬유 방향 기준 위상 (회전 기반 — 디테일이 섬유에 항상 수직)
  float effTwist = u_twistAngle;
  float twC = cos(effTwist);
  float twS = sin(effTwist);
  float warpPhase = tiledUV.x * twS + tiledUV.y * twC;
  float weftPhase = tiledUV.x * twC + tiledUV.y * twS;

  // 원사 경계를 약간 물결치게: 셀마다 다른 위상
  float distortX = sin(warpPhase * 18.0 + cellIdx.x * 7.3) * 0.006
                 + sin(warpPhase * 31.0) * 0.004;
  float distortY = sin(weftPhase * 18.0 + cellIdx.y * 5.9) * 0.006
                 + sin(weftPhase * 31.0) * 0.004;
  vec2 organicDist = dist + vec2(distortX, distortY);

  float warpP = yarnProfile(organicDist.x, halfR);
  float weftP = yarnProfile(organicDist.y, halfR);

  // ── 프로파일 기반 색상 블렌딩 ──
  // 경사 위(warp-over): 경사색이 지배, 틈새로 위사 보임
  vec3 bgWarpOver = mix(vec3(0.02), u_color2, smoothstep(0.0, 0.25, weftP));
  vec3 colorWarpOver = mix(bgWarpOver, u_color1, smoothstep(0.0, 0.3, warpP));

  // 위사 위(weft-over): 위사색이 지배, 틈새로 경사 보임
  vec3 bgWeftOver = mix(vec3(0.02), u_color1, smoothstep(0.0, 0.25, warpP));
  vec3 colorWeftOver = mix(bgWeftOver, u_color2, smoothstep(0.0, 0.3, weftP));

  vec3 yarnColor = mix(colorWeftOver, colorWarpOver, overFactor);

  // 원사 길이 방향 섬유 톤 변화 (Height와 동일 주파수 — PBR 일관성)
  float warpToneRaw = (sin(warpPhase * 40.0) + sin(warpPhase * 27.0 + 1.7) * 0.5) / 1.5;
  float weftToneRaw = (sin(weftPhase * 40.0) + sin(weftPhase * 27.0 + 2.3) * 0.5) / 1.5;
  float warpVis = warpP * mix(0.3, 1.0, overFactor);
  float weftVis = weftP * mix(1.0, 0.3, overFactor);
  float totalVis = warpVis + weftVis + 0.001;
  float fiberTone = (warpToneRaw * warpVis + weftToneRaw * weftVis) / totalVis;
  yarnColor *= 1.0 + fiberTone * 0.035;

  // Height 기반 셀프 섀도
  float heightValue = texture(u_heightMap, v_uv).r;
  float darkening = mix(0.6, 1.0, heightValue);
  vec3 finalColor = yarnColor * darkening;

  // 카본 파이버 미세 줄무늬
  if (u_patternType >= 3) {
    float alongFiberUV = mix(f.x, f.y, overFactor);
    float fiberDetail = sin(alongFiberUV * 80.0) * 0.015;
    finalColor += fiberDetail;
  }

  fragColor = vec4(finalColor, 1.0);
}
