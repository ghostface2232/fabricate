#version 300 es
precision highp float;

uniform sampler2D u_weaveMatrix;
uniform vec2 u_matrixSize;
uniform float u_density;
uniform sampler2D u_heightMap;
uniform sampler2D u_aoMap;
uniform vec2 u_texelSize;
uniform vec3 u_color1;  // warp color or fiber color
uniform vec3 u_color2;  // weft color or resin color
uniform float u_yarnThickness;
uniform float u_twistAngle;
uniform float u_edgeDefinition;
uniform float u_yarnLoft;
uniform float u_gapWidth;
uniform float u_repeatUnit;
uniform int u_patternType;  // 0-2: fabric, 3-4: carbon

in vec2 v_uv;
out vec4 fragColor;

const int MAX_FLOAT_SEARCH_STEPS = 24;

float wrapRepeat(float value, float repeat) {
  return mod(mod(value, repeat) + repeat, repeat);
}

vec2 wrapRepeat(vec2 value, float repeat) {
  return vec2(
    wrapRepeat(value.x, repeat),
    wrapRepeat(value.y, repeat)
  );
}

float sampleWeave(vec2 cellIdx) {
  vec2 uv = (mod(cellIdx, u_matrixSize) + 0.5) / u_matrixSize;
  return step(0.5, texture(u_weaveMatrix, uv).r);
}

float weaveCellScale() {
  if (u_patternType == 3) return max(u_matrixSize.x * 0.5, 1.0);
  if (u_patternType == 4) return max(u_matrixSize.x * 0.25, 1.0);
  return 1.0;
}

float sampleWeaveScaled(vec2 cellIdx, float cellScale) {
  return sampleWeave(floor(cellIdx * cellScale));
}

float hash21(vec2 p) {
  p = fract(p * vec2(234.34, 435.35));
  p += dot(p, p + 34.23);
  return fract(p.x * p.y);
}

float yarnCrossProfile(float d, float halfWidth, float edgeDefinition, float widthScale, float carbonFactor) {
  float width = max(halfWidth * widthScale, 0.035);
  float t = clamp(abs(d) / width, 0.0, 1.0);
  float bodyPower = mix(
    mix(2.4, 6.1, edgeDefinition),
    mix(4.2, 8.0, edgeDefinition),
    carbonFactor
  );
  float shoulderPower = mix(
    mix(1.55, 0.82, edgeDefinition),
    mix(1.18, 0.68, edgeDefinition),
    carbonFactor
  );
  return pow(max(1.0 - pow(t, bodyPower), 0.0), shoulderPower);
}

float carbonCrossSectionProfile(float crossValue) {
  return clamp(pow(crossValue, 0.72) * 0.88, 0.0, 1.0);
}

int countConsecutive(vec2 cellIdx, vec2 dir, float targetState, float cellScale) {
  int count = 0;
  float maxSteps = max(u_matrixSize.x, u_matrixSize.y) / cellScale - 1.0;
  for (int i = 1; i <= MAX_FLOAT_SEARCH_STEPS; i++) {
    if (float(i) > maxSteps) {
      break;
    }
    float state = sampleWeaveScaled(cellIdx + dir * float(i), cellScale);
    if (abs(state - targetState) > 0.5) {
      break;
    }
    count++;
  }
  return count;
}

vec3 floatSpanInfo(vec2 cellIdx, float coord, vec2 dir, float targetState, float cellScale) {
  float currentState = sampleWeaveScaled(cellIdx, cellScale);
  int prevCount = countConsecutive(cellIdx, -dir, targetState, cellScale);
  int nextCount = countConsecutive(cellIdx, dir, targetState, cellScale);
  bool includesCurrent = abs(currentState - targetState) <= 0.5;

  if (includesCurrent) {
    float span = float(prevCount + 1 + nextCount);
    return vec3(float(prevCount) + coord, span, smoothstep(1.0, 4.0, span));
  }

  // When the current cell belongs to the opposite yarn, latch to the nearest
  // real float segment instead of inventing a one-cell extension across the boundary.
  if (prevCount > 0 && (nextCount == 0 || coord < 0.5)) {
    float span = float(prevCount);
    return vec3(float(prevCount) + coord, span, smoothstep(1.0, 4.0, span));
  }

  if (nextCount > 0) {
    float span = float(nextCount);
    return vec3(coord - 1.0, span, smoothstep(1.0, 4.0, span));
  }

  return vec3(coord, 0.0, 0.0);
}

float floatLoftFromInfo(vec3 info, float loft, float edgeDefinition, float carbonFactor) {
  float span = info.y;
  float spanFactor = info.z;
  float t = clamp(info.x / max(span, 1.0), 0.0, 1.0);
  float edgePower = mix(
    mix(1.9, 3.5, edgeDefinition),
    mix(3.2, 5.0, edgeDefinition),
    carbonFactor
  );
  float endMask = pow(abs(t - 0.5) * 2.0, edgePower);
  float edgeDip = mix(0.16, 0.30, loft) * mix(1.0, 0.72, spanFactor);
  float centerLift = mix(0.0, 0.08, loft) * mix(1.0, 0.62, spanFactor);
  return 1.0 - edgeDip * endMask + centerLift * (1.0 - endMask);
}

float carbonLine(float alongCoord, float freq, float halfWidth, float offset) {
  float x = alongCoord * freq + offset;
  float d = abs(fract(x) - 0.5);
  float aa = max(fwidth(x) * 0.7, 0.0015);
  return 1.0 - smoothstep(halfWidth, halfWidth + aa, d);
}

float carbonFiberTone(float alongPhase, float acrossCoord, float mask, float gapWidth) {
  float across = pow(clamp(1.0 - abs(acrossCoord) * (1.95 + gapWidth * 1.05), 0.0, 1.0), 1.0);
  float primary = carbonLine(alongPhase, 16.0, 0.088, 0.0);
  float secondary = carbonLine(alongPhase, 24.0, 0.052, 0.29);
  float tertiary = carbonLine(alongPhase, 34.0, 0.030, 0.12);
  float quaternary = carbonLine(alongPhase, 11.0, 0.115, 0.41);
  float strand = primary * 0.90
    + secondary * 0.56
    + tertiary * 0.26
    + quaternary * 0.16;
  float softClipped = strand / (1.0 + strand * 0.48);
  float rounded = pow(clamp(softClipped, 0.0, 1.0), 1.0)
    * (0.72 + 0.16 * primary + 0.08 * secondary);
  return rounded * across * mask;
}

void main() {
  float density = max(u_repeatUnit, round(u_density / u_repeatUnit) * u_repeatUnit);
  vec2 tiledUV = fract(v_uv) * density;
  float rawShear = sin(u_twistAngle);
  float shear = round(rawShear * density / u_repeatUnit) * u_repeatUnit / density;
  float carbonFactor = u_patternType >= 3 ? 1.0 : 0.0;
  float cellScale = weaveCellScale();

  vec2 sh = wrapRepeat(vec2(
    tiledUV.x + tiledUV.y * shear,
    tiledUV.y + tiledUV.x * shear
  ), density);
  vec2 gridSh = sh / cellScale;
  vec2 cellIdx = floor(gridSh);
  vec2 f = fract(gridSh);
  vec2 dist = f - 0.5;
  vec2 logicalMatrixSize = max(u_matrixSize / cellScale, vec2(1.0));
  vec2 cellMod = mod(cellIdx, logicalMatrixSize);

  float hardOver = sampleWeaveScaled(cellIdx, cellScale);
  vec2 nDir = mix(vec2(-1.0), vec2(1.0), step(0.5, f));
  float nOverX = sampleWeaveScaled(cellIdx + vec2(nDir.x, 0.0), cellScale);
  float nOverY = sampleWeaveScaled(cellIdx + vec2(0.0, nDir.y), cellScale);
  vec2 dBnd = min(f, 1.0 - f);
  float fw = max(fwidth(sh.x), fwidth(sh.y));
  float aaWidth = mix(4.8, 2.8, carbonFactor);
  float aaX = mix(1.0, smoothstep(0.0, fw * aaWidth, dBnd.x), abs(hardOver - nOverX));
  float aaY = mix(1.0, smoothstep(0.0, fw * aaWidth, dBnd.y), abs(hardOver - nOverY));
  float overFactor = mix(0.5, hardOver, min(aaX, aaY));
  float warpJitter = hash21(vec2(cellMod.x + 1.7, 8.1)) - 0.5;
  float weftJitter = hash21(vec2(9.3, cellMod.y + 2.4)) - 0.5;
  float halfWidth = u_yarnThickness * mix(0.66, 0.74, carbonFactor);
  if (carbonFactor > 0.5) {
    halfWidth *= 1.0 - u_gapWidth * 0.85;
  }

  float effectiveEdge = clamp(mix(u_edgeDefinition, u_edgeDefinition * 0.82 + 0.18, carbonFactor), 0.0, 1.0);
  float effectiveLoft = clamp(mix(u_yarnLoft, u_yarnLoft * 0.88 + 0.08, carbonFactor), 0.0, 1.0);

  float warpCross = yarnCrossProfile(dist.x, halfWidth, effectiveEdge, 1.0 + warpJitter * 0.08, carbonFactor);
  float weftCross = yarnCrossProfile(dist.y, halfWidth, effectiveEdge, 1.0 + weftJitter * 0.08, carbonFactor);
  if (carbonFactor > 0.5) {
    warpCross = carbonCrossSectionProfile(warpCross);
    weftCross = carbonCrossSectionProfile(weftCross);
  }
  vec3 warpInfo = floatSpanInfo(cellIdx, f.y, vec2(0.0, 1.0), 1.0, cellScale);
  vec3 weftInfo = floatSpanInfo(cellIdx, f.x, vec2(1.0, 0.0), 0.0, cellScale);
  float warpLongTop = floatLoftFromInfo(warpInfo, effectiveLoft, effectiveEdge, carbonFactor);
  float weftLongTop = floatLoftFromInfo(weftInfo, effectiveLoft, effectiveEdge, carbonFactor);
  float warpLongUnder = mix(1.0, warpLongTop, 0.18);
  float weftLongUnder = mix(1.0, weftLongTop, 0.18);

  float warpTopShape = warpCross * warpLongTop;
  float weftTopShape = weftCross * weftLongTop;
  float warpVisibleShape = mix(warpCross * warpLongUnder, warpTopShape, overFactor);
  float weftVisibleShape = mix(weftTopShape, weftCross * weftLongUnder, overFactor);

  float warpVis = warpVisibleShape * mix(0.35, 1.0, overFactor);
  float weftVis = weftVisibleShape * mix(1.0, 0.35, overFactor);
  float totalVis = warpVis + weftVis + 0.0001;

  vec3 yarnColor;
  if (carbonFactor > 0.5) {
    float topTowMask = mix(weftTopShape, warpTopShape, overFactor);
    float visibleTow = max(warpVisibleShape, weftVisibleShape);
    float towMask = smoothstep(0.12 + u_gapWidth * 0.18, 0.82 - u_gapWidth * 0.08, topTowMask);
    float resinMask = 1.0 - smoothstep(0.03, 0.26 + u_gapWidth * 0.42, visibleTow);
    vec3 resinBase = mix(u_color2 * 0.74, u_color2 * 1.14, resinMask);
    float orientationMask = smoothstep(0.35, 0.65, overFactor);
    vec3 warpTowColor = u_color1 * 0.90;
    vec3 weftTowColor = u_color1 * 1.08;
    vec3 towColor = mix(weftTowColor, warpTowColor, orientationMask);
    yarnColor = mix(resinBase, towColor, towMask);
  } else {
    vec3 warpOverColor = mix(mix(vec3(0.02), u_color2, smoothstep(0.0, 0.24, weftVisibleShape)), u_color1, smoothstep(0.08, 0.78, warpVisibleShape));
    vec3 weftOverColor = mix(mix(vec3(0.02), u_color1, smoothstep(0.0, 0.24, warpVisibleShape)), u_color2, smoothstep(0.08, 0.78, weftVisibleShape));
    yarnColor = mix(weftOverColor, warpOverColor, overFactor);
  }

  float warpPhase = gridSh.y + cellMod.x * 0.71 + warpJitter * 0.3;
  float weftPhase = gridSh.x + cellMod.y * 0.71 + weftJitter * 0.3;
  float warpTone = (
    sin(warpPhase * 34.0)
    + 0.45 * sin(warpPhase * 58.0 + 1.7)
    + 0.15 * sin(warpPhase * 104.0 + 3.9)
  ) / 1.6;
  float weftTone = (
    sin(weftPhase * 34.0)
    + 0.45 * sin(weftPhase * 58.0 + 2.3)
    + 0.15 * sin(weftPhase * 104.0 + 4.6)
  ) / 1.6;
  float fiberTone = (warpTone * warpVis + weftTone * weftVis) / totalVis;
  if (carbonFactor > 0.5) {
    float topTowMask = mix(weftTopShape, warpTopShape, overFactor);
    float topPhase = mix(weftPhase, warpPhase, overFactor);
    float topAcross = mix(dist.y, dist.x, overFactor);
    fiberTone = carbonFiberTone(topPhase, topAcross, pow(clamp(topTowMask, 0.0, 1.0), 0.78), u_gapWidth);
  }
  yarnColor *= 1.0 + fiberTone * mix(0.038, 0.40, carbonFactor);
  if (carbonFactor > 0.5) {
    float topTowMask = mix(weftTopShape, warpTopShape, overFactor);
    float centerBand = pow(clamp(topTowMask, 0.0, 1.0), 1.15);
    float strandMix = smoothstep(0.03, 0.26, fiberTone);
    yarnColor *= mix(0.96, 1.18, strandMix) * mix(0.96, 1.05, centerBand);
  }

  vec2 baseUV = fract(v_uv);
  float centerH = texture(u_heightMap, baseUV).r;
  float ao = texture(u_aoMap, baseUV).r;
  float hL = texture(u_heightMap, mod(baseUV + vec2(-1.0, 0.0) * u_texelSize, 1.0)).r;
  float hR = texture(u_heightMap, mod(baseUV + vec2( 1.0, 0.0) * u_texelSize, 1.0)).r;
  float hU = texture(u_heightMap, mod(baseUV + vec2( 0.0, 1.0) * u_texelSize, 1.0)).r;
  float hD = texture(u_heightMap, mod(baseUV + vec2( 0.0,-1.0) * u_texelSize, 1.0)).r;
  vec3 pseudoNormal = normalize(vec3(-(hR - hL) * 5.0, (hU - hD) * 5.0, 1.0));
  vec3 lightDir = normalize(vec3(-0.45, 0.65, 0.62));
  float ndl = dot(pseudoNormal, lightDir) * 0.5 + 0.5;

  float structuralShade = mix(0.85, 1.03, centerH);
  float directionalShade = mix(0.94, 1.04, ndl);
  float aoShade = mix(0.80, 1.0, ao);
  if (carbonFactor > 0.5) {
    float resinSpecHint = 1.0 - smoothstep(0.06, 0.34 + u_gapWidth * 0.4, max(warpVisibleShape, weftVisibleShape));
    yarnColor = mix(yarnColor, yarnColor * 1.10, resinSpecHint * 0.42);
  }
  vec3 finalColor = yarnColor * structuralShade * directionalShade * aoShade;

  fragColor = vec4(clamp(finalColor, 0.0, 1.0), 1.0);
}
