# MASK_SEMICIRCLE_RIGHT Contract Clarification — C6b

Status: FROZEN · Canonical document `1.9.0` · Template Contract `1.6.0`

## 문제

C6 v2가 logo guide를 analytic mask의 rectangular cutout으로 구현해, 로고가 없을 때
반원 우측 상단 외곽이 직각으로 파였다. 기준 PNG의 `logo` 표시는 최종 shape를
도려내라는 계약이 아니라 overlay 위치 가이드다. 또한 v2의 black-only 제한은
브랜드 컬러와 white transparent PNG를 불필요하게 거부했다.

## 결정

- circle center `(801,225)`, radius `180`과 `IMAGE_PRIMARY` destination
  `(621,45,360,213)`을 유지한다.
- runtime mask는 circle-only analytic alpha로 재생성한다. logo cutout은 삭제하고,
  기존 shape에서 사라진 영역만 동일 원호로 복원한다.
- `LOGO_PRIMARY`는 `required: false`인 별도 overlay slot이다. container는
  `(839,16,142,60)`, safe box는 `(847,24,126,44)`다.
- logo는 PNG, alpha channel, transparent background가 필수이며 색상 제한은 없다.
  black/white/brand-color을 원본 그대로 유지하고 자동 recolor/grayscale 변환을 하지
  않는다.
- plan은 `ALPHA_TRIM_CONTAIN`, `CONTAIN`, `CENTER`, `DETERMINISTIC`으로 고정하며
  cropRect, cropCandidate, focalPoint, 수동 위치 조정은 금지한다.
- 로고 없음은 정상 PASS, logo asset만 있거나 plan만 있으면 deterministic ERROR다.
  opaque background와 empty transparent PNG는 각각
  `KBR-LOGO-TRANSPARENT-BACKGROUND-REQUIRED`, `KBR-LOGO-EMPTY`다.
- `KBR-LOGO-COLOR-NOT-BLACK`, `blackMonochromeRequired`, `whiteMonochromeRequired`,
  `blackValidation`은 현재 계약에서 제거한다.

## 근거

`reference/kakao-tool/MASK_SEMICIRCLE_RIGHT.png`는 SHA-256
`90a2e948d979b204867c837485ca0d4b391de4ca44c22ca36e9f3f53862ac75e`인 immutable
TOOL_OUTPUT이다. 원호 좌표와 guide 위치는 `[TOOL_OUTPUT]`/`[DERIVED]`, mask 재생성,
safe box, alpha thresholds, color-unrestricted overlay는 `[PROJECT]` 결정이다. 이
문서는 카카오 공식 업로드 승인이나 원격 자산 확보를 의미하지 않는다.

## 영향 범위

Core mask generator/renderer, Integration Contract v1.4.0, template capability registry,
mask asset digest, Desktop Lab copy/diagnostics, C6b fixtures and Golden, package smoke,
and Canonical/README documentation. Existing OBJECT_RIGHT, THUMBNAIL_BOX_RIGHT, and
THUMBNAIL_MULTI_RIGHT coordinates and Golden bytes are unchanged.

## 호환성

Canonical `1.8.0 → 1.9.0`, Template Contract `1.5.0 → 1.6.0`, Desktop `0.7.0 → 0.7.1`,
Integration `1.3.0 → 1.4.0`. Integration input plans `1.1.0`, `1.2.0`, and `1.3.0` remain
read-compatible; newly emitted output/capability schemas use `1.4.0`. Persisted manifest
schema remains `1.0.0`, output schema remains `2.0.0`, and template coordinates do not
change. The MASK Golden changes because the runtime mask bytes and composition change.

## 미해결 Blocker

- CTA remains `NONE` only; no approved Kakao icon source or compatibility matrix exists.
- Cross-platform pixel tolerance remains outside v1; official Golden execution is Windows
  10/11 x64.
- This local Renderer does not claim Kakao upload or review approval.

## 원본 명세의 변경 섹션

- Canonical header and new Phase C6b §25
- Historical C6 v2 §24 marker
- `contracts/reference-fixture.json`, `mask-assets.json`, `template-capabilities.json`,
  `integration-error-registry.json`, and Integration schemas
- `docs/implementation/mask-semicircle-right-rendering.md`
- `docs/implementation/renderer-lab-placement-plan.md`
