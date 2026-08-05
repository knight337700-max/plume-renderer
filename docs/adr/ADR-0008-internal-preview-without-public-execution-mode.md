# ADR-0008: Internal Preview without a public execution mode

- Status: Accepted
- Date: 2026-08-05
- Classification: [PROJECT]

## Context

공개 Input Schema에는 `dryRun`과 `validateOnly`를 다시 추가할 수 없다. Desktop Preview와 최종 output이 다른 pipeline을 사용하면 화면과 export가 달라질 수 있다.

## Decision

- C1 Renderer 내부를 하나의 `prepare` pipeline으로 유지한다.
- `previewInternal()`은 동일 Schema validation, default, NFC/trim, asset digest, Alpha Trim, Layout, Raster, PNG Validator를 실행하고 publish만 생략한다.
- 기존 `render()`는 같은 prepared PNG를 manifest와 함께 C1 atomic publish로 저장한다.
- Preview PNG는 session temp에만 쓰고 token으로 읽으며 다운로드 권한으로 취급하지 않는다.
- Export는 현재 입력·asset을 다시 준비하고 Preview의 input/asset/PNG digest와 비교한 뒤 Core 전체 render와 download gate를 다시 실행한다.

## Consequences

- Preview와 export의 PNG byte equality를 자동 검증할 수 있다.
- 공개 JSON과 CLI 계약은 변경되지 않는다.
- Guide overlay는 React DOM layer이며 Core PNG에 합성되지 않는다.
