# THUMBNAIL_MULTI_RIGHT Template Contract Clarification v1

## 문제

C4는 단일 `THUMBNAIL_BOX_RIGHT` Slot만 실행했다. C5에서는 동일 Canvas 안의 두 이미지
Slot을 지원해야 하므로 Plan 배열 순서, Asset 재사용, Candidate의 Slot 연결, 최종
Applied placement 순서가 명시되지 않으면 Manual과 Agent 입력이 서로 다른 결과를
만들 수 있다.

## 결정

- 기준 fixture는 `reference/kakao-tool/THUMBNAIL_MULTI_RIGHT.png`를 원본 그대로 사용하며 SHA-256은 `ea6a6ca53faba1215e45e7aa54ddcae33c5d75bbe6244e3aa6a3b2465656a57b`다.
- `IMAGE_PRIMARY (621,43,172,172,r12)`와 `IMAGE_SECONDARY (809,43,172,172,r12)`를 고정한다. Slot gap은 16px, 우측 margin은 48px이다.
- 각 Slot에 Plan 정확히 하나가 필요하다. Plan 배열 순서가 아니라 `imageSlotId`로 연결하고 실행/출력은 Template Slot 순서로 정렬한다.
- Asset은 1개를 두 Slot에서 재사용하거나 2개를 독립적으로 사용할 수 있다. PNG/JPG/JPEG를 혼합할 수 있다.
- `SEMANTIC_CROP_COVER`와 `MANUAL_CROP`만 활성화한다. Crop을 자동 생성·clamp·중앙 대체하지 않는다.
- Candidate와 protected subject는 Slot과 Asset ID가 모두 일치할 때만 사용한다.
- 두 Slot의 rounded mask, Crop, Subject Protection은 서로 독립이며 ERROR가 하나라도 있으면 artifact와 download를 차단한다.
- `pixelFingerprint`와 artifact bytes는 Slot 순서로 canonicalize하고 `requestFingerprint`는 실제 입력 배열과 source provenance를 보존한다.

## 근거

기준 PNG의 측정 좌표는 `[TOOL_OUTPUT]`, 슬롯 간격과 radius 산술은 `[DERIVED]`, Slot ID·정렬·재사용·오류 차단은 `[PROJECT]`다. Radius 12는 공식 카카오 수치로 주장하지 않는다.

## 영향 범위

Integration Adapter, Renderer Contract Capability Registry, 다중 슬롯 Core rasterizer,
Desktop Session/IPC token 경계, Renderer Lab, manifest placement metadata, fixtures,
Golden/Integration/Desktop/E2E/Security 테스트 및 Windows portable package가 영향을 받는다.

## 호환성

기존 OBJECT_RIGHT와 THUMBNAIL_BOX_RIGHT 입력, Golden bytes, MIME 정책, Download Gate는
변경하지 않는다. Integration schema는 기존 배열 구조가 다중 placement를 표현하므로
`1.1.0`을 유지한다. Desktop package는 `0.4.1`에서 `0.5.0`으로 증가한다.

## 미해결 Blocker

없음. Spoqa Han Sans Bold/Regular과 승인된 C0 기준 자산은 이미 Registry에서 검증된다.
CTA는 기존과 같이 NONE만 활성화된다.

## 원본 명세의 변경 섹션

- Canonical Spec §0 header/Target
- Canonical Spec §20 Phase C5 — THUMBNAIL_MULTI_RIGHT two-slot execution
- `contracts/template-capabilities.json`
- `contracts/contract-versions.json`의 `canonicalPhaseC5`
