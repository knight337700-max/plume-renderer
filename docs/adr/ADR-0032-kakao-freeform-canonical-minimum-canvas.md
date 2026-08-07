# ADR-0032: Canonical FREEFORM Canvas는 공식 최소 크기로 고정

- 상태: Accepted (F3A)
- 결정: `MINIMUM_WITH_RATIO` 공식 규격의 v1 Canvas를 공식 최소 크기와 비율로
  결정한다. `EXACT` 규격은 해당 exact Canvas를 사용한다.
- 근거: 공식 가이드의 `이상 + ratio`는 여러 출력 크기를 허용하지만 v1 byte
  deterministic renderer에는 하나의 Canvas가 필요하다. 이는 매체 허용범위를
  축소하는 업로드 정책이 아니라 `[PROJECT]` canonicalization이다.
- 영향: 후속 larger-canvas output은 별도 계약이 필요하며 기존 Template 좌표는
  변경하지 않는다.
