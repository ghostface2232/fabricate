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

// 원사 단면 프로파일 — (1-t²)²(1+1.5t²)
float yarnProfile(float d, float r) {
  float t = clamp(abs(d) / r, 0.0, 1.0);
  float s = t * t;
  float u = 1.0 - s;
  return u * u * (1.0 + 1.5 * s);
}

void main() {
  vec2 tiledUV = v_uv * u_density;
  float halfThickness = u_yarnThickness * 0.7;

  float shear = sin(u_twistAngle) * u_twistIntensity;

  float sheared_x = tiledUV.x + tiledUV.y * shear;
  float sheared_y = tiledUV.y + tiledUV.x * shear;
  float warpDist = fract(sheared_x) - 0.5;
  float weftDist = fract(sheared_y) - 0.5;

  // 매트릭스 룩업
  float warpIdx = floor(sheared_x);
  float weftIdx = floor(sheared_y);
  vec2 matCoord = mod(vec2(warpIdx, weftIdx), u_matrixSize);
  vec2 texCoord = (matCoord + 0.5) / u_matrixSize;
  float weaveVal = texture(u_weaveMatrix, texCoord).r;

  // ── 셀 경계 AA (상태 변경 경계에서만) ──
  float hardOver = step(0.5, weaveVal);
  float fx = fract(sheared_x);
  float fy = fract(sheared_y);

  float nIdxX = warpIdx + (fx >= 0.5 ? 1.0 : -1.0);
  float nIdxY = weftIdx + (fy >= 0.5 ? 1.0 : -1.0);
  vec2 nMatX = mod(vec2(nIdxX, weftIdx), u_matrixSize);
  vec2 nMatY = mod(vec2(warpIdx, nIdxY), u_matrixSize);
  float nWeaveX = step(0.5, texture(u_weaveMatrix, (nMatX + 0.5) / u_matrixSize).r);
  float nWeaveY = step(0.5, texture(u_weaveMatrix, (nMatY + 0.5) / u_matrixSize).r);

  float diffX = abs(hardOver - nWeaveX);
  float diffY = abs(hardOver - nWeaveY);
  float dBndX = min(fx, 1.0 - fx);
  float dBndY = min(fy, 1.0 - fy);
  float fw = max(fwidth(sheared_x), fwidth(sheared_y));
  float aaX = mix(1.0, smoothstep(0.0, fw * 3.0, dBndX), diffX);
  float aaY = mix(1.0, smoothstep(0.0, fw * 3.0, dBndY), diffY);
  float aa = min(aaX, aaY);
  float overFactor = mix(0.5, hardOver, aa);

  // ── 교차점 짓눌림 (pinch) ──
  float pinchAmount = 0.02;
  float weftProximity = smoothstep(halfThickness, 0.0, abs(weftDist));
  float warpProximity = smoothstep(halfThickness, 0.0, abs(warpDist));
  float warpR = halfThickness * (1.0 - pinchAmount * weftProximity);
  float weftR = halfThickness * (1.0 - pinchAmount * warpProximity);

  float warpProfile = yarnProfile(warpDist, warpR);
  float weftProfile = yarnProfile(weftDist, weftR);

  float warpStripe = sin(tiledUV.y * 40.0) * 0.012;
  float weftStripe = sin(tiledUV.x * 40.0) * 0.012;

  // ── 교차 전환 ──
  float crossing = warpProfile * weftProfile;
  float topBase = mix(0.58, 0.95, crossing);
  float bottomBase = mix(0.40, 0.05, crossing);
  float flattenFactor = 1.0 - u_flattening * crossing;

  // warp-over / weft-over 각각의 최종 height를 독립 계산
  float topH_w = topBase * warpProfile * flattenFactor + warpStripe * warpProfile;
  float botH_w = bottomBase * weftProfile + weftStripe * weftProfile;
  float blend_w = smoothstep(0.0, 0.45, warpProfile);
  float height_w = mix(botH_w, topH_w, blend_w);

  float topH_f = topBase * weftProfile * flattenFactor + weftStripe * weftProfile;
  float botH_f = bottomBase * warpProfile + warpStripe * warpProfile;
  float blend_f = smoothstep(0.0, 0.45, weftProfile);
  float height_f = mix(botH_f, topH_f, blend_f);

  // 최종: 두 완성된 height를 한 번만 블렌딩
  float height = mix(height_f, height_w, overFactor);

  fragColor = vec4(vec3(height), 1.0);
}
