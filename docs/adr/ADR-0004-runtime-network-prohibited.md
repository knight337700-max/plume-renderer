# ADR-0004: Runtime network access 금지

- Status: Accepted
- Date: 2026-08-05
- Classification: `[PROJECT]`

## Context

Renderer는 기존 plume 및 모든 외부 서비스와 분리된 로컬 도구여야 한다. 다만 신규 PC에서 package store 없이 최초 의존성을 설치하는 과정까지 완전 오프라인이라고 주장할 수는 없다.

## Decision

- Runtime network access: `PROHIBITED`
- 외부 API, 원격 폰트, CDN, telemetry, analytics, update check, Railway, plume 서버, 카카오 업로드를 금지한다.
- Build dependency resolution은 lockfile로 고정한다.
- Offline install은 필요한 pnpm store가 준비된 환경에서만 보장한다.
- 런타임 네트워크 시도는 `KBR-SYSTEM-006` ERROR다.

## Consequences

- 설치 가능성과 런타임 네트워크 금지를 구분한다.
- 앱 기능은 로컬 파일과 번들 자산만으로 동작해야 한다.
- 자동 업데이트와 원격 telemetry를 추가할 수 없다.
