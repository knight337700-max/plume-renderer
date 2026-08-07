# Kakao FREEFORM Format Profiles v1

## Execution pipeline

```text
CreativeLayoutPlan
  → FormatProfile lookup
  → ChannelCompliance pre-render rules
  → existing FREEFORM raster primitives
  → PNG/JPEG encoder
  → artifact size/alpha/geometry post-render checks
  → manifest + atomic publish
```

F3A는 Layout을 생성하지 않는다. User/Agent가 제출한 element bounds, z-index,
crop, font reference를 그대로 실행하며 자동 배치·자동 crop·font fallback을
추가하지 않는다. `CreativeLayoutPlan` schema는 `1.0.0`으로 유지한다.

## Profile model

`contracts/freeform-format-profiles.json`의 기존 `allowedOutputFormats`는 F1
호환 필드다. F3A Profile은 다음 additive metadata를 사용한다.

- `officialSizeRule`, `officialRatio`: 공식 규격의 분류와 비율
- `outputConstraints`: renderer output, decimal byte limit/comparator, opaque policy
- `elementConstraints`: IMAGE/TEXT/LOGO/SHAPE allowlist
- `safeZonePolicy`: required/recommended/close-button/manual-review geometry
- `collectionRule`: single-item implemented, collection metadata/deferred 상태

Canvas가 같은 Channel이라도 Compliance가 다르면 Profile ID를 합치지 않는다.
예를 들어 1200×600 Display Native와 Bizboard Expandable은 서로 다른 ID다.

## JPEG encoder

`src/core/raster.ts`의 Sharp/libvips 경로는 RGBA PNG intermediate에서 JPEG를
생성한다. `metadata`를 추가하지 않고 `progressive:false`, `mozjpeg:false`,
`chromaSubsampling:"4:2:0"`을 명시한다. quality는 명시 숫자 또는 `AUTO_FIT`이다.
AUTO_FIT은 고정 ladder를 순서대로 시도하고 Profile comparator를 만족하는 첫
bytes를 선택한다. 모든 후보가 실패하면 publish하지 않고
`KBR-FREEFORM-JPEG-TARGET-SIZE-NOT-ACHIEVABLE`을 반환한다.

`outputEncoding`은 manifest와 response에서 확인할 수 있고, JPEG resolved option은
pixel fingerprint material에 포함된다. Request fingerprint에는 `AUTO_FIT` request
가 포함된다. PNG 기존 F1 path와 Template Goldens는 별도 encoder path로 보존한다.

## Fail-closed and review boundary

- ERROR 1개라도 있으면 artifact, manifest, download를 publish하지 않는다.
- `requiresOpaqueOutput:true`는 최종 pixels를 검사한다. `UNSPECIFIED`는 false로
  취급하지 않는다.
- required safe zone/close-button/element allowlist 위반은 ERROR,
  recommended safe zone 및 baked-image semantic은 WARNING/manual review다.
- 실제 IMAGE 내부의 텍스트·로고·shape semantics는 자동 추론하지 않는다.

## Verification

F3A tests should cover every `IMPLEMENTED` Profile at least once, repeated
PNG/JPEG bytes, profile canvas/ID, byte comparator, opaque gate, safe-zone gate,
Expandable Multi IMAGE-only gate, and Scroll catalog-only blocking. Existing
Template/F1 Goldens are regression invariants.
