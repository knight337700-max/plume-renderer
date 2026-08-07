# ADR-0025: Canvas와 FormatProfile Identity

- 상태: Accepted
- 분류: `[PROJECT]`
- 날짜: 2026-08-07

## 결정

Canvas width/height는 FormatProfile만 소유한다. CreativeLayoutPlan에는 canvas 값을
중복 저장하지 않고 `formatProfileId`만 둔다. 실행 시 Input, Plan, loaded Profile ID가
exact equality가 아니면 `KBR-FREEFORM-FORMAT-PROFILE-MISMATCH`로 차단한다.

현재 내부 contract test profile은 기존 1029×258을 사용하지만 `PROJECT_TEST_ONLY`다.
Native 1200은 실제 공식 dimensions를 추측하지 않고 `CATALOG_NOT_READY`로 유지한다.
PNG만 기존 encoder와 조합 가능한 계약 상태이며 FREEFORM JPG는 구현하지 않는다.

