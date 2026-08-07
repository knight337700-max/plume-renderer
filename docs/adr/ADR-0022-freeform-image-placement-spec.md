# ADR-0022: FREEFORM ImagePlacementSpec과 Template Slot 분리

- 상태: Accepted
- 분류: `[PROJECT]`
- 날짜: 2026-08-07

## 결정

FREEFORM IMAGE/LOGO element는 `assetId`, normalized `bounds`, `zIndex`, 공통
`ImagePlacementSpec`을 가진다. `ImagePlacementSpec`에는 policy, source, fitMode,
crop/focal, anchor, subjectProtection과 provenance 보조값이 포함되지만
`imageSlotId`는 포함하지 않는다.

기존 public `ImagePlacementPlan`은 Template adapter를 위해 유지한다. 두 계약을
breaking change로 합치지 않는다. FREEFORM의 stable composite 순서는 `zIndex` 오름차순,
동률이면 원래 elements 배열 순서다.

