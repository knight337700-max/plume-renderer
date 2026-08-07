# FREEFORM Renderer Contract Freeze v1

상태: `CONTRACT_FROZEN` / `IMPLEMENTATION_NOT_STARTED`  
분류: `[PROJECT]` (카카오 공식 FREEFORM 규격을 주장하지 않음)

## 문제

현재 Renderer는 Template Registry의 절대 Slot 좌표를 실행하는 `TEMPLATE_LOCKED`
모델이다. 향후 자유 배치 지면을 추가하면 Template 좌표를 FREEFORM에 재사용하거나
가짜 `imageSlotId`를 만드는 순간 Agent/User가 만든 Layout Plan의 의미와 Renderer의
검증 경계가 섞인다. 폰트 fallback, 자동 줄바꿈, Canvas 중복, provenance가 섞인
fingerprint도 동일 입력의 결정성을 훼손할 수 있다.

## 결정

- `LayoutMode`는 `TEMPLATE_LOCKED | FREEFORM`으로 고정한다.
- 기존 입력에서 `layoutMode`가 생략되면 `TEMPLATE_LOCKED`로 해석하며 기존 필드와
  Template Golden은 변경하지 않는다.
- `FREEFORM`은 `CreativeLayoutPlan v1.0.0`을 필수로 하고 Template `templateId`,
  `imagePlacementPlans`, `cropCandidates` 또는 Slot 좌표에 의존하지 않는다.
- FREEFORM Image/Logo는 `ImagePlacementSpec`을 사용하며 `imageSlotId`를 생성하지
  않는다. 기존 `ImagePlacementPlan`은 public breaking change 없이 유지한다.
- `CreativeLayoutPlan`은 `formatProfileId`만 참조하고 Canvas 크기를 중복 저장하지
  않는다. `RendererInput`, Plan, loaded `FormatProfile` ID가 모두 exact equality여야
  한다.
- Text 색상은 `#RRGGBB` 또는 `#RRGGBBAA`만 허용한다. Named color, rgb(), hsl()은
  허용하지 않는다.
- Text는 Registry의 `fontId`만 사용한다. OS fallback, CSS generic fallback,
  remote font loading은 금지한다. 현재 registry는 승인된 Spoqa Han Sans
  Regular/Bold 두 파일만 포함한다.
- `NO_WRAP`과 `EXPLICIT_NEWLINES`만 FREEFORM v1에서 실행 가능한 wrap mode다.
  `WORD_WRAP`은 계약에 정의하지만 `NOT_IMPLEMENTED` 오류로 거부한다. 자동 shrink,
  자동 letter-spacing 축소, 자동 ellipsis, bounds 확대는 없다.
- Canvas는 FormatProfile의 단일 Source of Truth다. PNG만 기존 encoder를 활용할 수
  있는 계약 상태로 기록하고 FREEFORM JPG는 `NOT_IMPLEMENTED`다.
- `artifactChecksumSha256`, `pixelFingerprint`, `requestFingerprint`의 의미를
  분리한다. `MANUAL`과 `AGENT`가 같은 pixel-affecting plan을 제출하면 pixel
  fingerprint는 같고 provenance가 포함된 request fingerprint만 달라질 수 있다.
- 이번 Phase는 Raster/Native 1200/UI를 구현하지 않는다. Native 1200은 실제 공식
  width/height와 파일 용량이 확정될 때까지 `CATALOG_NOT_READY`다.

## 근거

- 기존 Integration Contract v1.4.0, Template Contract v1.6.0 및 현재 Golden SHA를
  baseline으로 읽고 additive minor 확장을 적용했다.
- 기존 `canonicalize` 기반 JCS와 C3 fingerprint 원칙을 유지했다.
- Spoqa 자산은 기존 `contracts/font-asset-registry.json`과 파일 SHA-256을 그대로
  참조한다. 새 폰트나 원격 자산을 추가하지 않았다.
- 기존 Template 좌표와 Golden bytes는 계약 검증 스크립트와 회귀 테스트로 확인한다.

## 영향 범위

- Canonical 문서: `1.9.0 → 1.10.0` (minor)
- Integration Contract: `1.4.0 → 1.5.0` (optional additive fields)
- CreativeLayoutPlan: 신규 `1.0.0`
- Template Contract: `1.6.0 유지`
- Desktop: `0.7.1 유지`
- 새 산출물: TypeScript interface, JSON Schema, FREEFORM Font/FormatProfile Registry,
  Error Registry code, fixture, verification script와 contract tests
- 기존 Renderer raster pipeline, UI, PNG Encoder, JPEG input/output 계약은 이번 Phase에서
  변경하지 않는다.

## 호환성

- `layoutMode`가 없는 기존 JSON은 기존 Template 흐름으로 남는다.
- 현재 Integration schema의 1.1.0/1.2.0/1.3.0/1.4.0 입력은 read-compatible로
  유지하고 공개 current schema는 1.5.0이다.
- 기존 `ImagePlacementPlan`은 그대로 export하며 FREEFORM 공통 내부 모델로만
  `ImagePlacementSpec`을 추가한다.
- 기존 OBJECT_RIGHT, THUMBNAIL_BOX_RIGHT, THUMBNAIL_MULTI_RIGHT, MASK_SEMICIRCLE_RIGHT
  Golden SHA는 byte-equal이어야 한다.

## 미해결 Blocker

- FREEFORM Native 1200의 공식 FormatProfile dimensions, file-size, channel compliance는
  아직 Canonical 공식값으로 확정되지 않았다. 따라서 profile은 `CATALOG_NOT_READY`다.
- FREEFORM Raster metrics 및 Shape raster의 실제 구현은 후속 Phase에서 결정한다.
- JPEG output deterministic encoder profile은 별도 계약이 필요하다.

## 원본 명세의 변경 섹션

- Canonical §26 `Phase F0 — FREEFORM Renderer Contract Freeze [PROJECT]` 추가
- Canonical §0의 현재 우선순위와 버전 표에 F0 상태 추가
- `contracts/contract-versions.json`에 `canonicalPhaseF0`, Integration 1.5.0,
  CreativeLayoutPlan 1.0.0 기록
- Integration schema는 `layoutMode`와 `creativeLayoutPlan`을 optional additive로
  수용하고 FREEFORM branch에서만 Plan을 필수화한다.

