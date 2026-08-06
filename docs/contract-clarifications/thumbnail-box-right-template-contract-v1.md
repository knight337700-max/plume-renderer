# THUMBNAIL_BOX_RIGHT Template Contract Clarification v1

## 문제

C3는 Agent-independent Placement Plan과 Capability Registry를 정의했지만 실제 렌더링 대상은 OBJECT_RIGHT 하나였다. THUMBNAIL_BOX_RIGHT 제작툴 PNG에는 `IMAGE_PRIMARY`의 회색 가이드가 존재하나, 가이드와 최종 출력 레이어의 의미가 문서에 분리되어 있지 않았고 Crop Rect, Candidate, Subject Protection을 실행하는 Renderer 경계도 없었다.

## 결정 [PROJECT]

- Template ID는 `KAKAO_MOMENT_BIZBOARD_THUMBNAIL_BOX_RIGHT`, format profile은 `KAKAO_BIZBOARD_THUMBNAIL_BOX_RIGHT`로 고정한다.
- Canvas는 1029×258, `IMAGE_PRIMARY`는 `(666,36,315,186)`, right-exclusive 981, bottom-exclusive 222, radius 12px이다.
- 실제 정책은 `SEMANTIC_CROP_COVER`와 `MANUAL_CROP`만 허용한다. 둘 다 `COVER`이며, Crop이 없을 때 중심 Crop을 추정하지 않는다.
- Candidate를 참조하면 Candidate의 normalized `cropRect`를 그대로 사용한다. 자동 Candidate 생성·재점수화·Subject Detection은 범위 밖이다.
- REQUIRED/PREFERRED/NONE Subject Protection의 ERROR/WARNING/무이슈 동작은 Preview와 Export 양쪽에서 동일하게 적용한다.
- 회색 `#D9D9D9`/`Image` placeholder는 기준 가이드일 뿐 최종 PNG에 그리지 않는다. 최종 image slot은 radius clip으로만 마스킹한다.
- OBJECT_RIGHT Core 입력, 좌표, PNG Golden은 변경하지 않는다.

## 근거

기준 파일 `reference/kakao-tool/THUMBNAIL_BOX_RIGHT.png`의 검증 SHA-256은 `bde09ea925ede612c814868d90f9595fc29137b1183309123f02fd76dedff030`이다. 파일은 1029×258 RGBA PNG이며, 회색 영역 bbox와 텍스트 측정값은 Canonical Spec에 `[TOOL_OUTPUT]`/`[DERIVED][PROJECT]`로 기록했다.

## 영향 범위

`packages/renderer-contract` Capability/Adapter, Core Thumbnail Renderer, Desktop Main Preview/Export, Renderer Lab Template/Crop controls, C4 fixtures/golden, verification scripts, schemas/versions, Canonical 문서와 ADR에 영향을 준다. Runtime 네트워크, Plume, Agent 호출, 자동 모델은 추가하지 않는다.

## 호환성

Canonical 문서는 1.4.0에서 1.5.0, Template Contract는 1.2.0에서 1.3.0, Desktop은 0.3.0에서 0.4.0으로 minor bump한다. Input 1.2.0, Output 2.0.0, Manifest 1.0.0, Response 1.0.0, Integration Contract 1.0.0 구조는 유지한다. 기존 OBJECT_RIGHT 출력 SHA `20dc9d62b8650a72115a8d584846399d9cd6dd2c8a0996b4889edb596feb68b1`은 회귀 기준으로 고정한다.

## 미해결 Blocker

없음. Spoqa Han Sans Bold/Regular은 고정 asset registry와 SHA로 이미 해결되어 있으며, 승인된 CTA 아이콘은 계속 없어 CTA NONE만 활성이다. 카카오 공식 업로드 승인 여부는 이 계약의 범위가 아니다.

## 원본 명세의 변경 섹션

- Template Capability / `template-capabilities.json`
- Template 좌표 계약
- Integration Input/Output 및 Crop 실행
- Renderer Lab 범위
- Acceptance와 버전 이력
