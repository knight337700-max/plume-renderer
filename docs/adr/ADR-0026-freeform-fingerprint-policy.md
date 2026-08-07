# ADR-0026: FREEFORM Fingerprint 의미 분리

- 상태: Accepted
- 분류: `[PROJECT]`
- 날짜: 2026-08-07

## 결정

세 checksum/fingerprint를 분리한다.

- `artifactChecksumSha256`: 최종 artifact bytes
- `pixelFingerprint`: FormatProfile canvas, background, stable element order, bounds,
  zIndex, text metrics/color/font asset digest, image asset digest, placement/crop,
  opacity와 encoding처럼 pixel에 영향을 주는 값
- `requestFingerprint`: 전체 canonical request와 source/rationale/confidence/provenance

timestamp, absolute path, UI state, Agent metadata는 pixel fingerprint에서 제외한다.
동일한 Layout에서 MANUAL과 AGENT는 pixel fingerprint와 artifact가 같을 수 있고,
request fingerprint만 달라진다. 기존 `renderFingerprint`가 필요한 응답에서는 기존
pixelFingerprint alias 의미를 유지한다.

