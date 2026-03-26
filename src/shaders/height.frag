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

// 원사 단면 프로파일 — smooth ellipse dome
float yarnProfile(float d, float r) {
  if (abs(d) >= r) return 0.0;
  return sqrt(max(0.0, 1.0 - (d * d) / (r * r)));
}

void main() {
  vec2 tiledUV = v_uv * u_density;
  float halfThickness = u_yarnThickness * 0.5;

  // twist shear
  float shear = sin(u_twistAngle) * u_twistIntensity;

  // 연속 shear 좌표에서 원사 중심선까지의 거리
  float sheared_x = tiledUV.x + tiledUV.y * shear;
  float sheared_y = tiledUV.y + tiledUV.x * shear;
  float warpDist = fract(sheared_x) - 0.5;
  float weftDist = fract(sheared_y) - 0.5;

  // 매트릭스 룩업: shear된 원사 인덱스 사용
  // 실제 교차 위치와 over/under 판정이 정확히 일치
  float warpIdx = floor(sheared_x);
  float weftIdx = floor(sheared_y);
  vec2 matCoord = mod(vec2(warpIdx, weftIdx), u_matrixSize);
  vec2 texCoord = (matCoord + 0.5) / u_matrixSize;
  float weaveVal = texture(u_weaveMatrix, texCoord).r;
  bool isWarpOver = weaveVal >= 0.5;

  // 원사 단면 프로파일
  float warpProfile = yarnProfile(warpDist, halfThickness);
  float weftProfile = yarnProfile(weftDist, halfThickness);

  // 미세 줄무늬 (연속 좌표, 길이 방향)
  float warpStripe = sin(tiledUV.y * 40.0) * 0.03;
  float weftStripe = sin(tiledUV.x * 40.0) * 0.03;

  // ── 교차 전환 ──
  // crossing = 두 프로파일의 곱. shear된 셀 경계에서 자연히 0.
  // isWarpOver가 전환되는 곳 = shear된 셀 경계 = crossing ≈ 0 → 제곱 불필요.
  float crossing = warpProfile * weftProfile;

  float topBase = mix(0.5, 0.9, crossing);
  float bottomBase = mix(0.5, 0.1, crossing);

  // 교차점 납작해짐
  float flattenFactor = 1.0 - u_flattening * crossing;

  // 위/아래 원사 높이
  float topHeight, bottomHeight;
  if (isWarpOver) {
    topHeight = topBase * warpProfile * flattenFactor + warpStripe * warpProfile;
    bottomHeight = bottomBase * weftProfile + weftStripe * weftProfile;
  } else {
    topHeight = topBase * weftProfile * flattenFactor + weftStripe * weftProfile;
    bottomHeight = bottomBase * warpProfile + warpStripe * warpProfile;
  }

  // 최종 합성
  float topProfile = isWarpOver ? warpProfile : weftProfile;
  float blend = smoothstep(0.0, 0.3, topProfile);
  float height = mix(bottomHeight, topHeight, blend);

  // 원사 경계 안티앨리어싱
  float warpEdge = smoothstep(0.0, 0.03, halfThickness - abs(warpDist));
  float weftEdge = smoothstep(0.0, 0.03, halfThickness - abs(weftDist));
  height *= max(warpEdge, weftEdge);

  fragColor = vec4(vec3(height), 1.0);
}
