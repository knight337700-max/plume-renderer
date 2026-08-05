# ADR-0005: Windows x64 Golden 결정성

- Status: Accepted
- Date: 2026-08-05
- Classification: `[PROJECT]`

## Context

Native raster dependency와 폰트 엔진은 OS와 아키텍처에 따라 픽셀 또는 PNG byte 결과가 달라질 수 있다. v1에서 cross-platform tolerance까지 계약하면 검증 범위가 불필요하게 확대된다.

## Decision

- 공식 지원 플랫폼은 Windows 10/11 x64다.
- 동일 입력, asset, dependency version, runtime 조건에서 byte-equal PNG를 목표로 한다.
- 같은 고정 환경에서 동일 입력을 3회 실행한 SHA-256이 모두 같아야 한다.
- macOS/Linux와 cross-platform pixel tolerance는 v1 Acceptance에서 제외한다.

## Consequences

- Golden은 Windows x64 환경 정보와 함께 버전 관리해야 한다.
- 다른 OS 지원은 별도 계약 버전과 Golden 세트가 필요하다.
- Phase C0에서는 raster 구현 라이브러리를 선택하지 않는다.
