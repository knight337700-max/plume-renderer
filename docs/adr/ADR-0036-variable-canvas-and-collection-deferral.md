# ADR-0036: variable canvas와 collection orchestration은 F3B로 연기

- 상태: Accepted (F3A)
- 결정: fixed single-item artifact만 F3A에서 구현한다. collection min/max는
  registry metadata로 기록하고, AdView Scroll은 `CONTRACT_BLOCKED_VARIABLE_CANVAS`
  catalog-only로 둔다.
- 근거: 기존 `FormatProfile.canvas`는 fixed integer Canvas이고, multi-artifact
  publish/combined-height 계약이 아직 동결되지 않았다.
- 영향: Scroll render request는 `KBR-FREEFORM-FORMAT-NOT-IMPLEMENTED`로
  fail-closed한다. 기존 fixed profile schema를 범위형으로 변경하지 않는다.
