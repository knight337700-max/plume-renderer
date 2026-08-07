# FREEFORM Validator v1 — Phase F2

상태: `HARDENED_PRE_RENDER_POST_RENDER`  
분류: `[PROJECT]` 구현 계약  
기준 버전: Canonical `1.10.0`, Integration `1.5.0`, CreativeLayoutPlan `1.0.0`, Template `1.6.0`

이 문서는 F0/F1에서 동결한 FREEFORM 계약을 실행 시점에 검사하는 경계를 기록한다.
카카오 공식 FREEFORM 매체 규격이나 업로드 승인을 의미하지 않는다.

## Pipeline

```text
request
  → request shape / FormatProfile / LayoutMode
  → CreativeLayoutPlan / element / background
  → asset resolver / MIME / decode / dimensions / font registry
  → PRE_RENDER gate
  → raster
  → PNG / appliedElements / checksum POST_RENDER
  → manifest schema / atomic publish
```

`PRE_RENDER` 또는 `POST_RENDER`의 `ERROR`가 하나라도 있으면 최종 PNG, manifest,
download를 반환하지 않는다. PRE_RENDER 오류에서는 raster와 PNG encode도 호출하지 않는다.
`downloadAllowed=true`는 ERROR 0의 publish 완료 응답에만 사용한다.

## Validation stages

`ValidationIssue.stage`는 FREEFORM 실행 결과에서 항상 `PRE_RENDER` 또는 `POST_RENDER`다.
공통 Issue 순서는 severity → stage → input JSON pointer → KBR code → message key와
식별자 기준으로 정렬한다. AJV/Sharp/NAPI의 원문 영어 메시지와 absolute path는 외부
안정 계약으로 사용하지 않는다.

### PRE_RENDER

- request object와 허용 property, FREEFORM layoutMode, formatProfileId
- loaded Profile 존재, `layoutMode=FREEFORM`, canvas, implementation status, Profile/Plan ID
- Plan `schemaVersion=1.0.0`, source/background/elements, unknown property, duplicate ID
- normalized bounds의 finite 및 0..1 containment, integer zIndex, opacity
- PNG/JPEG MIME 및 byte signature, resolver 결과, decode, dimensions, declared digest/dimensions
- IMAGE/LOGO asset reference와 placement policy/fit/crop 관계
- LOGO PNG alpha, non-empty layout-visible pixel, opaque-background suspicion
- registered font만 허용, registry path/status/SHA-256, text metrics/color/alignment/wrap
- `WORD_WRAP`, `SHAPE`, `JPG`와 미지원 Profile의 명시적 차단

### POST_RENDER

- PNG signature/IHDR, decode, exact Profile canvas, RGBA color type 6, bit depth 8
- non-zero artifact와 recomputed artifact checksum
- applied element count, z/order, IDs/types, normalized bounds, opacity
- destination/source pixel rect의 integer containment과 deterministic crop/placement 결과
- asset digest, placement policy, requested/resolved crop
- font digest와 text metrics/color/wrap/overflow evidence

## Compliance boundary

Validator는 다음을 평가하지 않는다: 제품이 충분히 커 보이는지, 오른쪽에 있는지,
카피가 예쁜지, 로고가 눈에 띄는지, 구도/브랜딩/색상 대비가 좋은지. 자동 Layout,
silent clamp, crop inference, fallback, auto-shrink, invalid color correction은 없다.

`CLIP`은 raster ink가 bounds를 벗어난 경우 `overflowDetected=true`, `clipped=true`를
기록하고 clipping된 결과를 통과시킨다. `ERROR`는 동일 상황에서
`KBR-FREEFORM-TEXT-OVERFLOW` POST_RENDER ERROR로 차단한다.

## Applied evidence

Renderer가 실제 적용한 값만 `appliedElements`로 만들고 Validator는 그 evidence를
검증한다. 별도 추정값으로 manifest를 생성하지 않는다. `IMAGE`/`LOGO`는 asset digest,
placement policy, fit mode, requested crop, resolved source crop을 기록한다. `TEXT`는
font ID/digest, font size, line height, color, wrap/overflow mode와 clip flags를 기록한다.

## Stable error groups

기존 `KBR-ASSET-*`, `KBR-IMAGE-*`, `KBR-FONT-*`, `KBR-CROP-*`, `KBR-OUTPUT-*`를 우선
재사용한다. F2에서 추가된 FREEFORM 고유 경계는 다음과 같다.

- `KBR-FREEFORM-FORMAT-PROFILE-NOT-FOUND`
- `KBR-FREEFORM-LAYOUT-MODE-MISMATCH`
- `KBR-FREEFORM-BACKGROUND-TYPE-NOT-SUPPORTED`
- `KBR-FREEFORM-APPLIED-RECT-MISMATCH`
- `KBR-FREEFORM-APPLIED-ELEMENT-MISMATCH`
- `KBR-FREEFORM-VALIDATION-INTERNAL-MISMATCH`
- `KBR-LOGO-ALPHA-REQUIRED`, `KBR-LOGO-TRANSPARENT-BACKGROUND-REQUIRED`, `KBR-LOGO-EMPTY`

## Acceptance mapping

| 영역 | 자동 검증 |
|---|---|
| Profile/Plan | valid profile, mismatch, wrong mode, duplicate ID, bounds, zIndex, background |
| Asset | missing, MIME/signature mismatch, decode, dimensions, duplicate IDs |
| Placement | contain crop forbidden, manual crop required, semantic request required, no inference |
| Text | registered font, color, NO_WRAP/EXPLICIT_NEWLINES, WORD_WRAP block, ERROR/CLIP overflow |
| Logo | colored transparent pass, opaque block, empty block |
| Unsupported | SHAPE, WORD_WRAP, JPG fail closed before raster |
| Integrity | applied rect tamper, font digest tamper, output dimension/signature, checksum |
| Determinism | invalid validation repeated three times, MANUAL/AGENT pixel equality |
| Regression | F1 basic digest and all Template Goldens unchanged |

실행 명령은 `pnpm test:freeform-validator`이며 전체 회귀는 `pnpm check`로 수행한다.
