#version 300 es
precision highp float;

uniform sampler2D u_heightMap;
uniform sampler2D u_weaveMatrix;
uniform vec2 u_texelSize;
uniform vec2 u_matrixSize;
uniform float u_density;
uniform float u_yarnThickness;
uniform float u_twistAngle;
uniform float u_flattening;
uniform float u_edgeDefinition;
uniform float u_yarnLoft;
uniform float u_gapWidth;
uniform float u_repeatUnit;
uniform float u_roughnessBase;
uniform float u_roughnessVariation;
uniform float u_cavityInfluence;
uniform float u_glossiness;
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

float sampleH(vec2 offset) {
  return texture(u_heightMap, mod(v_uv + offset * u_texelSize, 1.0)).r;
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

float yarnCrossProfile(
  float d,
  float halfWidth,
  float edgeDefinition,
  float flattening,
  float widthScale,
  float carbonFactor
) {
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
  float body = pow(max(1.0 - pow(t, bodyPower), 0.0), shoulderPower);
  float crown = 1.0 - mix(0.08, 0.18, clamp(edgeDefinition * 0.7 + flattening * 0.35, 0.0, 1.0))
    * pow(t, mix(2.0, 4.5, edgeDefinition));
  return max(body * crown, 0.0);
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

float floatLoftFromInfo(
  vec3 info,
  float loft,
  float edgeDefinition,
  float carbonFactor
) {
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

float longFloatContinuity(float span, float carbonFactor) {
  return smoothstep(1.0, mix(2.2, 1.6, carbonFactor), span);
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
  float height = sampleH(vec2(0.0));
  float carbonFactor = u_patternType >= 3 ? 1.0 : 0.0;

  float density = max(u_repeatUnit, round(u_density / u_repeatUnit) * u_repeatUnit);
  vec2 tiledUV = fract(v_uv) * density;
  float rawShear = sin(u_twistAngle);
  float shear = round(rawShear * density / u_repeatUnit) * u_repeatUnit / density;
  vec2 sh = wrapRepeat(vec2(
    tiledUV.x + tiledUV.y * shear,
    tiledUV.y + tiledUV.x * shear
  ), density);
  float cellScale = weaveCellScale();
  vec2 gridSh = sh / cellScale;
  vec2 cellIdx = floor(gridSh);
  vec2 f = fract(gridSh);
  vec2 dist = f - 0.5;

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
  vec2 logicalMatrixSize = max(u_matrixSize / cellScale, vec2(1.0));
  vec2 cellMod = mod(cellIdx, logicalMatrixSize);
  float warpJitter = hash21(vec2(cellMod.x + 1.7, 8.1)) - 0.5;
  float weftJitter = hash21(vec2(9.3, cellMod.y + 2.4)) - 0.5;
  float warpPhase = gridSh.y + cellMod.x * 0.71 + warpJitter * 0.3;
  float weftPhase = gridSh.x + cellMod.y * 0.71 + weftJitter * 0.3;

  float halfWidth = u_yarnThickness * mix(0.66, 0.74, carbonFactor);
  if (carbonFactor > 0.5) {
    halfWidth *= 1.0 - u_gapWidth * 1.35;
  }
  float effectiveEdge = clamp(mix(u_edgeDefinition, u_edgeDefinition * 0.82 + 0.18, carbonFactor), 0.0, 1.0);
  float effectiveLoft = clamp(mix(u_yarnLoft, u_yarnLoft * 0.88 + 0.08, carbonFactor), 0.0, 1.0);
  float warpCross = yarnCrossProfile(dist.x, halfWidth, effectiveEdge, u_flattening, 1.0 + warpJitter * 0.08, carbonFactor);
  float weftCross = yarnCrossProfile(dist.y, halfWidth, effectiveEdge, u_flattening, 1.0 + weftJitter * 0.08, carbonFactor);
  if (carbonFactor > 0.5) {
    warpCross = carbonCrossSectionProfile(warpCross);
    weftCross = carbonCrossSectionProfile(weftCross);
  }

  vec3 warpInfo = floatSpanInfo(cellIdx, f.y, vec2(0.0, 1.0), 1.0, cellScale);
  vec3 weftInfo = floatSpanInfo(cellIdx, f.x, vec2(1.0, 0.0), 0.0, cellScale);
  float warpContinuity = longFloatContinuity(warpInfo.y, carbonFactor);
  float weftContinuity = longFloatContinuity(weftInfo.y, carbonFactor);
  float warpSpanFactor = warpInfo.z;
  float weftSpanFactor = weftInfo.z;
  float warpLongTop = floatLoftFromInfo(warpInfo, effectiveLoft, effectiveEdge, carbonFactor);
  float weftLongTop = floatLoftFromInfo(weftInfo, effectiveLoft, effectiveEdge, carbonFactor);
  float warpLongUnder = mix(1.0, warpLongTop, 0.18);
  float weftLongUnder = mix(1.0, weftLongTop, 0.18);
  float warpOppositionFade = 1.0 - 0.92 * warpContinuity;
  float weftOppositionFade = 1.0 - 0.92 * weftContinuity;
  float warpVisibleShape = mix(warpCross * warpLongUnder * weftOppositionFade, warpCross * warpLongTop, overFactor);
  float weftVisibleShape = mix(weftCross * weftLongTop, weftCross * weftLongUnder * warpOppositionFade, overFactor);

  float warpVis = warpVisibleShape * mix(0.35, 1.0, overFactor);
  float weftVis = weftVisibleShape * mix(1.0, 0.35, overFactor);
  float totalVis = warpVis + weftVis + 0.0001;

  float hL = sampleH(vec2(-1.0, 0.0));
  float hR = sampleH(vec2( 1.0, 0.0));
  float hU = sampleH(vec2( 0.0, 1.0));
  float hD = sampleH(vec2( 0.0,-1.0));
  float slope = length(vec2(hR - hL, hU - hD));
  float cavity = max((hL + hR + hU + hD) * 0.25 - height, 0.0);

  float base = u_roughnessBase;
  if (carbonFactor > 0.5) {
    float fiberBase = mix(0.34, 0.08, u_glossiness);
    base = mix(base, fiberBase, 0.82);
  }

  float ridgeMask = smoothstep(0.28, 0.82, height) * (1.0 - smoothstep(0.08, 0.26, slope));
  float sideMask = smoothstep(0.08, 0.30, slope) * smoothstep(0.05, 0.6, height);
  float valleyMask = 1.0 - smoothstep(0.08, 0.58, height);

  float roughness = base;
  roughness = mix(roughness, base * mix(0.97, 0.84, carbonFactor), ridgeMask);
  roughness = mix(roughness, base * mix(1.08, 1.02, carbonFactor), sideMask);
  roughness = mix(
    roughness,
    carbonFactor > 0.5
      ? mix(0.24, 0.045, u_glossiness) + u_gapWidth * 0.06
      : base * 1.05,
    valleyMask
  );

  float warpFiber = (
    sin(warpPhase * 38.0)
    + 0.45 * sin(warpPhase * 63.0 + 1.7)
    + 0.18 * sin(warpPhase * 108.0 + 4.2)
  ) / 1.63;
  float weftFiber = (
    sin(weftPhase * 38.0)
    + 0.45 * sin(weftPhase * 63.0 + 2.1)
    + 0.18 * sin(weftPhase * 108.0 + 3.6)
  ) / 1.63;
  float fiberPattern = (warpFiber * warpVis + weftFiber * weftVis) / totalVis;
  if (carbonFactor > 0.5) {
    float topTowMask = mix(weftCross * weftLongTop, warpCross * warpLongTop, overFactor);
    float topPhase = mix(weftPhase, warpPhase, overFactor);
    float topAcross = mix(dist.y, dist.x, overFactor);
    fiberPattern = carbonFiberTone(topPhase, topAcross, pow(clamp(topTowMask, 0.0, 1.0), 0.78), u_gapWidth);
  }
  float fiberScale = mix(0.55, 1.0, sideMask) * mix(1.0, 0.72, ridgeMask);
  float variation = fiberPattern * u_roughnessVariation * fiberScale * mix(1.0, 1.05, carbonFactor);
  if (carbonFactor > 0.5) {
    variation = -fiberPattern * u_roughnessVariation * fiberScale * 1.20;
  }

  float warpNoisePhase = sh.y * 4.3 + cellMod.x * 2.31;
  float weftNoisePhase = sh.x * 5.7 + cellMod.y * 3.17;
  float microNoise = (
    sin(warpNoisePhase * 9.0) * warpVis +
    sin(weftNoisePhase * 9.0) * weftVis
  ) / totalVis * mix(0.007, 0.004, carbonFactor) * (0.35 + 0.65 * sideMask);
  microNoise *= mix(1.0, 0.45, max(warpSpanFactor, weftSpanFactor));
  float cavityContrib = clamp(cavity * u_cavityInfluence, 0.0, 0.16);

  if (carbonFactor > 0.5) {
    float resinMask = 1.0 - smoothstep(0.04, 0.28 + u_gapWidth * 0.45, max(warpVisibleShape, weftVisibleShape));
    roughness = mix(roughness, mix(0.28, 0.05, u_glossiness), resinMask);
  }

  roughness = clamp(roughness + variation + microNoise + cavityContrib, 0.04, 1.0);
  fragColor = vec4(vec3(roughness), 1.0);
}
