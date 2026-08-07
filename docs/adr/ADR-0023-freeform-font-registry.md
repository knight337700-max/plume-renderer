# ADR-0023: 결정적 FREEFORM Font Registry

- 상태: Accepted
- 분류: `[PROJECT]`
- 날짜: 2026-08-07

## 결정

Text는 임의 `fontFamily`가 아니라 Registry의 `fontId`만 참조한다. Registry entry는
family, numeric weight, style, project-relative assetPath, SHA-256과 licenseId를
고정한다. OS font lookup, CSS generic fallback, remote font/CDN loading은 금지한다.

현재 v1 registry는 실제 SHA-256이 검증된 Spoqa Han Sans Regular/Bold만 포함하며,
미등록·missing·digest mismatch는 각각 안정적인 KBR 오류로 처리한다.

