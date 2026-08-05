# ADR-0001: Persisted manifest와 response envelope 분리

- Status: Accepted
- Date: 2026-08-05
- Classification: `[PROJECT]`

## Context

기존 Output Schema는 저장 manifest 내부에 manifest 자체의 SHA-256을 요구하여 자기참조 해시 문제가 있었다. 실패 응답과 성공 산출물의 의미도 하나의 구조에 섞여 있었다.

## Decision

- 성공 시 `output.png`와 `render-manifest.json` 두 파일만 publish한다.
- `render-manifest.json`은 자신의 digest를 포함하지 않는다.
- `manifestDigest`, `pngDigest`, 두 경로, gate 상태와 issue 목록은 비영속 response envelope에만 둔다.
- ERROR가 하나라도 있으면 두 최종 파일을 publish하지 않고 response envelope만 반환한다.
- Output Schema는 `2.0.0`, 새 manifest와 response schema는 각각 `1.0.0`으로 시작한다.

## Consequences

- 자기참조 해시가 사라진다.
- manifest 파일 hash는 파일 작성 후 계산할 수 있다.
- 기존 Output Schema 소비자는 구조 변경에 대응해야 한다.
- response envelope는 세 번째 저장 산출물로 계산하지 않는다.
