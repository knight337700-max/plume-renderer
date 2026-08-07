# Kakao Moment FREEFORM Format Catalog — Contract Clarification v1

## 문제

F0/F1/F2에는 내부 1029×258 PNG test Profile만 있었고, 카카오모먼트의 여러
정적 이미지 규격을 동일 FREEFORM 엔진으로 실행할 canonical Profile identity가
없었다. 또한 기존 PNG-only path는 공식 400KB/500KB/1MB 이미지 제한과 JPEG
입력을 표현하지 못했다. Safe Zone 중에는 정확한 위치가 확인되지 않은 항목도
있어 자동 판정과 수동 검토의 경계가 필요했다.

## 결정

1. 공식 최소 크기+비율 규격은 v1 canonical fixed Canvas를 공식 최소 크기로
   물질화한다. 이는 `[PROJECT] OFFICIAL_MINIMUM_SIZE`이며 공식 `MINIMUM_WITH_RATIO`
   의미를 변경하지 않는다.
2. Channel Compliance가 다른 같은 pixel Canvas는 별도 `formatProfileId`로
   유지한다.
3. 14개 fixed static image Profile은 single-item render를 `IMPLEMENTED`로,
   AdView Scroll은 `CONTRACT_BLOCKED_VARIABLE_CANVAS` catalog-only로 둔다.
4. Profile output은 명시적 PNG/JPEG만 허용한다. JPEG는 Sharp/libvips의 고정
   옵션과 고정 quality ladder를 사용하고 transparent background는 차단한다.
5. Profile metadata의 `requiresOpaqueOutput`, element allowlist, required/
   recommended safe zone을 Validator에 연결한다. baked image content와 위치가
   catalog되지 않은 UI/CTA geometry는 `MANUAL_REVIEW_REQUIRED`다.
6. collection min/max는 registry metadata로만 기록한다. Multi-artifact input은
   F3A 범위가 아니다.

## 근거

Phase F3A prompt에 명시된 Kakao Developers/Business 공식 조사값(Source A–E)을
`[OFFICIAL]` 수치로 사용했다. 500KB/1MB/400KB의 decimal byte 해석과 minimum
size를 deterministic canvas로 선택한 것은 `[PROJECT_CONSERVATIVE]`다. CTA 영역,
4:5 right-bottom occlusion, AdView safe-zone y offset은 공식 좌표가 없어
추정하지 않았다 `[INFERRED]` 금지 / `[MANUAL]` 기록.

## 영향 범위

- `contracts/freeform-format-profiles.json`에 fixed profiles, collection metadata,
  safe-zone policy, output constraints를 추가한다.
- renderer-contract FormatProfile과 Integration Contract는 additive minor로
  `1.6.0`이 된다. `CreativeLayoutPlan 1.0.0`, Template `1.6.0`, Desktop `0.7.1`은
  유지한다.
- manifest/response에는 `outputEncoding`, artifact digest/path metadata가
  optional로 추가된다. 기존 `outputPngDigest`, `pngDigest`, `pngPath`는 F1
  호환을 위해 유지한다.
- 기존 Template 및 F1 PNG Goldens는 변경하지 않는다.

## 호환성

기존 `allowedOutputFormats:["PNG"]` Profile과 `JPG` request alias는 계속
동작한다. 새 Profile은 canonical `JPEG`를 사용한다. 기존 public Template
input/output semantics와 `CreativeLayoutPlan` shape에는 변경이 없다.

## 미해결 Blocker / 후속

- 카카오 업로드 승인, 실제 account-side byte semantics, baked image semantic
  compliance는 이 저장소가 보장하지 않는다.
- AdView Scroll variable canvas와 모든 collection artifact orchestration은 F3B로
  이관한다.
- Renderer Lab Profile selector와 safe-zone overlay UI는 F4로 이관한다.

## 원본 명세 변경 섹션

Canonical 문서에 Phase F3A 섹션 29–31을 추가하고, 상단 문서 버전을 `1.10.0 →
1.11.0`으로 minor bump했다. Integration Contract는 `1.5.0 → 1.6.0`으로
minor bump했으며 Template 좌표/버전은 변경하지 않았다.
