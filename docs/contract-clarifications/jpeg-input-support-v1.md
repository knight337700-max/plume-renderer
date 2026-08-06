# C4 Amendment — JPG/JPEG Input Support

## 문제

`THUMBNAIL_BOX_RIGHT`의 기존 실행 경계는 PNG bytes를 기준으로만 검증했다. 실제
제작 입력에 필요한 JPG/JPEG, 확장자 위조 방지, EXIF Orientation, opaque PNG 수용,
session metadata가 명시되어 있지 않았다.

## 결정

- `OBJECT_RIGHT`는 `image/png`와 alpha channel만 허용한다.
- `THUMBNAIL_BOX_RIGHT`는 `image/png`와 `image/jpeg`를 허용하고 alpha를 요구하지 않는다.
- PNG/JPEG MIME은 bytes signature와 decoder 결과로 감지한다. `.png`, `.jpg`, `.jpeg`
  확장자와 실제 MIME이 다르면 `KBR-ASSET-MIME-EXTENSION-MISMATCH`다.
- JPEG EXIF Orientation 1..8을 명시적으로 적용하고, normalized crop은 orientation 보정
  후 dimensions 기준으로 계산한다.
- 최종 output은 기존과 동일한 RGBA PNG-32다.
- WebP, GIF, AVIF, BMP, TIFF, SVG는 Production Capability에서 허용하지 않는다.

## 근거

사용자 승인 Amendment `phase-c4-jpeg-input-support.md`의 템플릿별 MIME 정책,
Main byte validation, EXIF Orientation, Session Workspace 및 Acceptance 요구를 반영했다.

## 영향 범위

Integration Contract는 `1.0.0 → 1.1.0`, Desktop/Renderer package는 `0.4.0 → 0.4.1`,
Canonical 문서는 `1.5.0 → 1.5.1` patch다. Template Contract `1.3.0`, canvas, 좌표,
OBJECT_RIGHT Golden SHA는 변경하지 않는다.

## 호환성

기존 PNG OBJECT_RIGHT 입력과 output/manifest/response schema는 유지된다. 기존
Integration Input은 새 `schemaVersion: 1.1.0`으로 materialize해야 하며, asset MIME은
PNG/JPEG enum만 남긴다.

## 미해결 Blocker

없음. Spoqa Han Sans assets와 기준 PNG는 기존 C4 registry/hash를 그대로 사용한다.

## 원본 명세 변경 섹션

- Canonical Spec §19 `Phase C4 Amendment — JPG/JPEG 입력 지원`
- `contracts/template-capabilities.json`
- `packages/renderer-contract/schema/*`
- `contracts/integration-error-registry.json`
