# ADR-0021: Template-Locked와 FREEFORM Layout Mode 분리

- 상태: Accepted
- 분류: `[PROJECT]`
- 날짜: 2026-08-07

## 결정

`LayoutMode`를 `TEMPLATE_LOCKED`와 `FREEFORM`으로 고정한다. 기존 Template mode는
`templateId`와 Registry Slot을 사용하고, FREEFORM은 `CreativeLayoutPlan`이 모든
Element bounds를 제공한다. Renderer는 Plan에 없는 배치를 생성하지 않는다.

기존 입력의 생략된 `layoutMode`는 `TEMPLATE_LOCKED`로 해석한다. 이 결정은 기존
Template Input과 Golden Pixel을 깨지 않는 additive Integration Contract v1.5.0이다.

## 결과

FREEFORM은 카카오 공식 규격 또는 자동 레이아웃 생성기가 아니며 Agent/User가 제출한
serializable plan을 검증할 준비만 한다. Raster 구현과 UI는 후속 Phase다.

