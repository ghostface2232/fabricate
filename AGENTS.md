# Fabricate — PBR Fabric Pattern Generator

## 프로젝트 개요
산업 디자인 렌더링용 PBR 재질 패턴 생성기.
직조 패브릭(평직, 능직, 수자직)과 카본 파이버(평직, 능직) 패턴을
Procedural하게 생성하고, Full PBR 텍스처 세트를 PNG로 내보내는 웹 도구.

## 아키텍처 핵심 규칙
1. 패턴 생성 엔진(src/engine/)은 React 의존성이 없어야 한다. 독립 실행 가능해야 한다.
2. 엔진과 UI 사이의 인터페이스는 PatternParams 타입 객체 하나로 통일한다.
3. 모든 PBR 맵은 Height Map에서 셰이더 체인으로 파생한다. Height가 single source of truth.
4. UI 상태는 Zustand 단일 스토어로 관리한다.
5. 직조 매트릭스 생성은 CPU(TypeScript)에서 하고, 결과를 WebGL2 데이터 텍스처로 업로드한다.
6. WebGL2 컨텍스트를 사용한다. GLSL 300 es 문법.
7. GLSL 셰이더 파일은 src/shaders/에 .vert/.frag 확장자로 관리하고
   Vite의 ?raw import로 문자열로 불러온다.
8. 3D 프리뷰는 Three.js를 직접 제어한다 (React Three Fiber 사용하지 않음).
9. 카본 파이버 프리뷰에는 MeshPhysicalMaterial (clearcoat + anisotropy).
   패브릭 프리뷰에는 MeshStandardMaterial.
10. 다크 모드 고정. 라이트 모드는 지원하지 않는다.
11. Export 시 Diffuse만 sRGB, 나머지 맵은 linear data.
12. Normal Map은 OpenGL 기준 기본, DirectX 반전 옵션 제공.

## 기술 스택
- Vite 8 + React 19 + TypeScript strict
- shadcn/ui (CLI v4) + Tailwind CSS v4
- Three.js r183 (직접 제어)
- WebGL2 네이티브 GLSL 셰이더
- Zustand 5 (상태 관리)
- browser-fs-access (외부 파일 입출력)
- sonner (토스트 알림)
- JSZip (ZIP 내보내기)
- OPFS (내부 워크스페이스, 프리셋 저장, 자동 저장)

## 코드 스타일
- 컴포넌트 파일명: PascalCase.tsx
- 유틸리티/훅: camelCase.ts
- GLSL 파일: kebab-case.vert / kebab-case.frag
- import 경로에 @/ 별칭 사용
- 함수형 컴포넌트 + hooks

## 셰이더 파일 목록
- fullscreen-quad.vert: 공용 풀스크린 쿼드 버텍스 셰이더
- height.frag: 직조 매트릭스 + 원사 단면 → Height Map
- normal.frag: Height → Normal (Sobel 기본, Scharr 옵션)
- ao.frag: Height → AO (cavity 기반)
- roughness.frag: Height + 재질 파라미터 → Roughness (4요소 합성)
- diffuse.frag: 매트릭스 + Height + 컬러 → Diffuse (self-shadow 포함)
- opacity.frag: 메쉬 패턴 전용 (2차 목표)

## 상태 구조 (Zustand)
PatternStore:
  patternType: 'plainWeave' | 'twillWeave' | 'satinWeave' | 'carbonPlain' | 'carbonTwill'
  warpColor: [number, number, number] (RGB 0-1)
  weftColor: [number, number, number]
  density: number (1-80)
  yarnThickness: number (0.1-1.0)
  twistAngle: number (0-90)
  twistIntensity: number (0-1)
  flattening: number (0-1, 교차점에서 원사가 납작해지는 정도)
  carbonK: 1 | 3 | 6 (카본 전용, 토우 크기)
  carbonGlossiness: number (0-1, 카본 전용)
  pbrSettings: { normalStrength, normalFilter, aoRadius, aoIntensity,
                 roughnessBase, roughnessVariation, roughnessCavityInfluence }
  exportSettings: { resolution, normalDirection, selectedMaps, filenamePrefix }

## Export 파이프라인
- TextureExporter(src/engine/): 렌더링 → readPixels → flipVertically → PNG Blob 변환. React 의존성 없음.
- fileAccess(src/utils/): browser-fs-access 래핑. showDirectoryPicker 지원 시 폴더 저장, 미지원 시 순차 다운로드.
- ExportDialog(src/components/export/): 해상도·Normal 방향·맵 선택 UI. 진행률 표시.
- Export 시 엔진을 export 해상도로 렌더링 → 전체 픽셀 동기 읽기 → 프리뷰 해상도 복원 → 비동기 PNG 변환.
  renderAtResolution()은 픽셀 읽기 전에 복원해버리므로 사용하지 않는다.

## 주의사항
- WebGL2 데이터 텍스처(R8)로 매트릭스 업로드 시 UNPACK_ALIGNMENT를 1로 설정해야 한다.
- FBO 텍스처를 다른 셰이더의 입력으로 쓸 때 같은 FBO에서 동시에 읽고 쓰면 안 된다.
- readPixels 결과는 Y축이 뒤집혀 있으므로 행 단위로 반전해야 한다.
- Three.js DataTexture 생성 시 flipY를 false로 설정한다.
- Normal Map 생성 시 texelSize를 반드시 1.0 / 렌더 해상도로 계산한다.
- Normal Map 내보내기 시 flipVertically 후 R(X)·G(Y) 채널 보정이 필요하다.
  OpenGL: R·G 모두 반전, DirectX: R만 반전. (WebGL UV 공간 → 이미지 공간 좌표계 차이)