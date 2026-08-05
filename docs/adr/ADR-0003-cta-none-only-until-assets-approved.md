# ADR-0003: 승인 자산 확보 전 CTA NONE만 활성화

- Status: Accepted
- Date: 2026-08-05
- Classification: `[PROJECT]`

## Context

`APP_DOWNLOAD`와 `KAKAO_SERVICE_ACTION`은 승인된 아이콘 원본·SHA-256, 전체 label 목록, landingType 호환 매트릭스가 없고 절대 좌표가 `[INFERRED]` 상태다.

## Decision

- `NONE`만 `enabled=true`로 둔다.
- 나머지 두 mode는 Registry에 보존하되 `enabled=false`와 `disabledReason`을 기록한다.
- 비활성 mode 입력은 `KBR-CTA-009` ERROR를 반환한다.
- 승인 아이콘은 제작하거나 다운로드하지 않는다.
- `contracts/approved-icons.json`은 자산이 확보되기 전 빈 배열을 유지한다.

## Consequences

- v1 자동 Acceptance는 CTA NONE만 대상으로 한다.
- 비활성 CTA의 `[INFERRED]` 좌표를 Golden 기준으로 승격하지 않는다.
- 자산과 매트릭스가 승인되면 문서·Registry·fixture를 함께 버전업한다.
