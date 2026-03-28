#version 300 es
precision highp float;

uniform sampler2D u_weaveMatrix;
uniform vec2 u_matrixSize;
uniform float u_density;
uniform float u_yarnThickness;
uniform float u_twistAngle;
uniform float u_flattening;
uniform float u_edgeDefinition;
uniform float u_yarnLoft;
uniform float u_gapWidth;
uniform float u_repeatUnit;
uniform int u_patternType;  // 0-2: fabric, 3-4: carbon

in vec2 v_uv;
out vec4 fragColor;

const int MAX_FLOAT_SEARCH_STEPS = 24;

float saturate(float x) {
  return clamp(x, 0.0, 1.0);
}

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
  float crownBias = saturate(edgeDefinition * 0.7 + flattening * 0.35);
  float crown = 1.0 - mix(0.08, 0.18, crownBias) * pow(t, mix(2.0, 4.5, edgeDefinition));
  float topFlatten = mix(1.0, mix(0.93, 0.99, smoothstep(0.0, 0.45, t)), flattening);
  return max(body * crown * topFlatten, 0.0);
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

float underImprintFactor(vec3 info, float carbonFactor) {
  float span = info.y;
  float continuity = longFloatContinuity(span, carbonFactor);
  float baseImprint = mix(1.0, mix(0.018, 0.008, carbonFactor), continuity);
  float longFloatFade = pow(1.0 - continuity, 1.35);
  return baseImprint * longFloatFade;
}

float fiberDetail(float phase, float mask, float carbonFactor) {
  float coarseFreq = mix(34.0, 54.0, carbonFactor);
  float mediumFreq = mix(58.0, 88.0, carbonFactor);
  float fineFreq = mix(96.0, 132.0, carbonFactor);
  float detail = sin(phase * coarseFreq)
    + 0.5 * sin(phase * mediumFreq + 1.8)
    + 0.22 * sin(phase * fineFreq + 4.1);
  float amplitude = mix(0.009, 0.013, carbonFactor);
  return detail * amplitude * mask;
}

float carbonPerimeterLift(float d, float halfWidth, float edgeDefinition, float loft) {
  float width = max(halfWidth, 0.035);
  float t = clamp(abs(d) / width, 0.0, 1.0);
  float shoulder = smoothstep(0.24, 0.70, t) * (1.0 - smoothstep(0.76, 1.02, t));
  float amplitude = mix(0.006, 0.015, loft) * mix(0.9, 1.15, edgeDefinition);
  return 1.0 + shoulder * amplitude;
}

float carbonCushionProfile(float d, float halfWidth) {
  float width = max(halfWidth * 1.14, 0.045);
  float t = clamp(abs(d) / width, 0.0, 1.0);
  float body = pow(max(1.0 - t, 0.0), 0.72);
  float shoulder = 1.0 - smoothstep(0.62, 1.0, t);
  return max(body * (0.92 + 0.08 * shoulder), 0.0);
}

float carbonLine(float alongCoord, float freq, float halfWidth, float offset) {
  float x = alongCoord * freq + offset;
  float d = abs(fract(x) - 0.5);
  float aa = max(fwidth(x) * 0.7, 0.0015);
  return 1.0 - smoothstep(halfWidth, halfWidth + aa, d);
}

float carbonFiberDetail(float alongPhase, float acrossCoord, float visibleMask, float gapWidth) {
  float across = pow(clamp(1.0 - abs(acrossCoord) * (1.95 + gapWidth * 1.05), 0.0, 1.0), 0.98);
  float primary = carbonLine(alongPhase, 16.0, 0.088, 0.0);
  float secondary = carbonLine(alongPhase, 24.0, 0.052, 0.29);
  float tertiary = carbonLine(alongPhase, 34.0, 0.030, 0.12);
  float quaternary = carbonLine(alongPhase, 11.0, 0.115, 0.41);
  float strand = primary * 0.94
    + secondary * 0.60
    + tertiary * 0.32
    + quaternary * 0.18;
  float softClipped = strand / (1.0 + strand * 0.40);
  float rounded = pow(clamp(softClipped, 0.0, 1.0), 0.98)
    * (0.72 + 0.18 * primary + 0.10 * secondary);
  return rounded * 0.072 * visibleMask * across;
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

  float wobbleAmp = mix(0.010, 0.005, carbonFactor);
  float warpEdgeWobble = (
    sin(warpPhase * 17.0 + warpJitter * 6.283)
    + 0.6 * sin(warpPhase * 31.0 + 1.7)
  ) * wobbleAmp;
  float weftEdgeWobble = (
    sin(weftPhase * 17.0 + weftJitter * 6.283)
    + 0.6 * sin(weftPhase * 31.0 + 2.3)
  ) * wobbleAmp;
  vec2 organicDist = dist + vec2(warpEdgeWobble, weftEdgeWobble);

  float halfWidth = u_yarnThickness * mix(0.66, 0.74, carbonFactor);
  if (carbonFactor > 0.5) {
    halfWidth *= 1.0 - u_gapWidth * 0.85;
  }

  float effectiveEdge = saturate(mix(u_edgeDefinition, u_edgeDefinition * 0.82 + 0.18, carbonFactor));
  float effectiveLoft = saturate(mix(u_yarnLoft, u_yarnLoft * 0.88 + 0.08, carbonFactor));

  float warpWidthScale = 1.0 + warpJitter * mix(0.10, 0.05, carbonFactor);
  float weftWidthScale = 1.0 + weftJitter * mix(0.10, 0.05, carbonFactor);

  float warpCross = yarnCrossProfile(
    organicDist.x,
    halfWidth,
    effectiveEdge,
    u_flattening,
    warpWidthScale,
    carbonFactor
  );
  float weftCross = yarnCrossProfile(
    organicDist.y,
    halfWidth,
    effectiveEdge,
    u_flattening,
    weftWidthScale,
    carbonFactor
  );
  if (carbonFactor > 0.5) {
    float warpCushion = carbonCushionProfile(organicDist.x, halfWidth * warpWidthScale);
    float weftCushion = carbonCushionProfile(organicDist.y, halfWidth * weftWidthScale);
    warpCross = clamp(warpCross * 0.76 + warpCushion * 0.34, 0.0, 1.0);
    weftCross = clamp(weftCross * 0.76 + weftCushion * 0.34, 0.0, 1.0);
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
  float warpOppositionFade = 1.0 - mix(0.92, 0.96, carbonFactor) * warpContinuity;
  float weftOppositionFade = 1.0 - mix(0.92, 0.96, carbonFactor) * weftContinuity;

  float warpTopShape = warpCross * warpLongTop;
  float weftTopShape = weftCross * weftLongTop;
  float warpUnderShape = warpCross * warpLongUnder;
  float weftUnderShape = weftCross * weftLongUnder;

  if (carbonFactor > 0.5) {
    warpTopShape *= carbonPerimeterLift(organicDist.x, halfWidth * warpWidthScale, effectiveEdge, effectiveLoft);
    weftTopShape *= carbonPerimeterLift(organicDist.y, halfWidth * weftWidthScale, effectiveEdge, effectiveLoft);
  }

  float crossing = saturate(warpCross * weftCross);
  float topContinuity = mix(weftContinuity, warpContinuity, overFactor);
  float topFloatSuppression = 1.0 - mix(0.72, 0.92, carbonFactor) * topContinuity;
  float crossingInfluence = crossing * topFloatSuppression;

  float topLevel = mix(
    mix(0.72, 0.90, effectiveLoft),
    mix(0.68, 0.76, effectiveLoft),
    carbonFactor
  );
  float bottomLevel = mix(
    mix(0.14, 0.24, 1.0 - u_flattening),
    mix(0.07, 0.16, 1.0 - u_flattening),
    carbonFactor
  );
  float overCompression = 1.0 - mix(0.12, 0.34, carbonFactor) * u_flattening * crossingInfluence;
  float underCompression = 1.0 - mix(0.30, 0.60, carbonFactor) * u_flattening * crossingInfluence;

  float warpReveal = 1.0 - smoothstep(0.16, 0.88, warpTopShape);
  float weftReveal = 1.0 - smoothstep(0.16, 0.88, weftTopShape);

  float warpUnderImprint = underImprintFactor(warpInfo, carbonFactor);
  float weftUnderImprint = underImprintFactor(weftInfo, carbonFactor);
  float hWarpOver = topLevel * warpTopShape * overCompression
    + bottomLevel * weftUnderShape * underCompression * warpReveal * warpUnderImprint * warpOppositionFade;
  float hWeftOver = topLevel * weftTopShape * overCompression
    + bottomLevel * warpUnderShape * underCompression * weftReveal * weftUnderImprint * weftOppositionFade;
  float h = mix(hWeftOver, hWarpOver, overFactor);

  float topSpanFactor = mix(weftSpanFactor, warpSpanFactor, overFactor);
  float saddle = crossingInfluence * u_flattening * mix(0.08, 0.12, carbonFactor) * mix(1.0, 0.58, topSpanFactor);
  h -= saddle;
  if (carbonFactor > 0.5) {
    h = mix(h, smoothstep(0.0, 1.0, h), 0.18);
  }

  float warpVisibleShape = mix(warpUnderShape * weftOppositionFade, warpTopShape, overFactor);
  float weftVisibleShape = mix(weftTopShape, weftUnderShape * warpOppositionFade, overFactor);
  float warpMask = pow(saturate(warpVisibleShape), 0.85) * mix(0.32, 1.0, overFactor);
  float weftMask = pow(saturate(weftVisibleShape), 0.85) * mix(1.0, 0.32, overFactor);
  float warpFiber = fiberDetail(warpPhase, warpMask, carbonFactor);
  float weftFiber = fiberDetail(weftPhase, weftMask, carbonFactor);

  if (carbonFactor > 0.5) {
    float topMask = mix(weftTopShape, warpTopShape, overFactor);
    float topPhase = mix(weftPhase, warpPhase, overFactor);
    float topAcross = mix(organicDist.y, organicDist.x, overFactor);
    float dominantFiber = carbonFiberDetail(topPhase, topAcross, pow(saturate(topMask), 0.72), u_gapWidth);
    warpFiber = mix(warpFiber * 0.12, dominantFiber, smoothstep(0.55, 0.95, overFactor));
    weftFiber = mix(weftFiber * 0.12, dominantFiber, 1.0 - smoothstep(0.05, 0.45, overFactor));
  }

  h += warpFiber + weftFiber;

  float coverage = max(max(warpTopShape, weftTopShape), max(warpUnderShape, weftUnderShape));
  float gapThreshold = mix(0.09, 0.035 + u_gapWidth * 0.9, carbonFactor);
  h *= smoothstep(0.0, gapThreshold, coverage);
  if (carbonFactor > 0.5) {
    float resinGap = (1.0 - smoothstep(0.06, 0.34 + u_gapWidth * 0.35, coverage)) * (0.05 + u_gapWidth * 0.26);
    h -= resinGap;
  }

  fragColor = vec4(vec3(clamp(h, 0.0, 1.0)), 1.0);
}
