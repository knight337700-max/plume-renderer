# Crop Rect Decimal Precision Clarification

## 문제

Phase C5의 Core와 Integration Schema는 normalized Crop Rect를 JSON `number`로
표현하고 있었지만 Renderer Lab은 한 개의 tuple 입력만 제공했다. 필드별 edit
buffer와 미세 조정 단계가 없어 `0.123456` 같은 값을 안전하게 편집하기 어렵고,
중간 입력(`""`, `"0."`)을 Plan에 즉시 반영할 경계도 명시되어 있지 않았다.

## 결정

1. `NormalizedRect`의 `number` 타입과 `NORMALIZED_EPSILON=1e-9`를 유지한다.
2. Contract는 finite JSON number를 임의의 소수점 자리수로 허용한다. C5a는
   기존 Schema의 호환 범위를 줄이는 6자리 hard limit이나 새 precision 오류
   코드를 추가하지 않는다. UI는 최소 6자리 수동 입력을 보존하며 scientific
   notation은 직접 입력에서 허용하지 않는다.
3. Lab은 Box Right와 Multi의 각 Slot에 `x/y/width/height` 문자열 edit buffer를
   제공한다. 네 필드가 완성되고 Contract 검증을 통과할 때만 Plan을 갱신한다.
   빈 문자열이나 `0.`은 그대로 유지하며 기존 유효 Plan을 덮어쓰지 않는다.
4. 입력은 `type=number`, `min=0`, `max=1`, `step=0.001`, `inputMode=decimal`을
   사용한다. Contract 검증이 브라우저 stepMismatch보다 우선한다.
5. Fine/normal/coarse nudge는 각각 `0.0001/0.001/0.01`이다. 범위 밖 nudge는
   자동 clamp하지 않고 적용하지 않는다. Shift+Arrow/Alt+Arrow는 fine/coarse다.
6. Core의 floor/ceil normalized-to-pixel 변환과 기존 request/pixel fingerprint
   의미는 변경하지 않는다. Decimal 값은 변환 직전까지 보존한다.
7. Manual/Agent Plan, JSON Import/Export, Multi Slot mapping은 같은 parser와
   serializer를 사용한다. OBJECT_RIGHT에는 Crop UI를 추가하지 않는다.

## 근거

- `packages/renderer-contract/schema/*`의 rect 정의는 이미 `type: "number"`다.
- `validateNormalizedRect`는 finite/range/epsilon을 검사하고 clamp하지 않는다.
- `normalizedRectToPixelRect`는 요구된 `floor/ceil` 규칙을 이미 구현한다.
- C5 Golden은 기존 Crop 값으로 고정되어 있으며 출력 계약을 바꾸지 않아야 한다.

## 영향 범위

- Renderer Lab UI와 UI helper의 edit buffer, validation message, nudge controls
- C5a decimal contract tests, Desktop E2E, packaged smoke
- Canonical 문서 `1.6.0 → 1.6.1` patch
- Desktop package `0.5.0 → 0.5.1` patch
- Template Contract `1.3.0`, Integration Contract `1.1.0` 유지

Core 렌더링 알고리즘, Canvas 좌표, PNG bytes, trusted-root/atomic publish,
OBJECT_RIGHT 동작에는 변경이 없다.

## 호환성

기존 tuple 입력과 `crop-rect-input` test id는 호환 입력으로 남긴다. 기존 Plan JSON은
그대로 Import할 수 있고, decimal Plan은 canonical JSON에서 숫자 값으로 보존된다.
기존 `additionalProperties:false`, 오류 정렬, fingerprint, Golden 계약은 유지된다.

## 미해결 Blocker

없음. Spoqa 폰트와 기준 asset은 C5 기준선에서 검증되어 있으며 이번 단계에서
새로운 외부 asset이나 네트워크가 필요하지 않다.

## 원본 명세의 변경 섹션

- `docs/kakao-bizboard-renderer-spec-v1.md` 헤더 버전/상태
- 신규 `21. Phase C5a — Crop Rect decimal precision`
- `contracts/contract-versions.json`의 top-level document version 및
  `canonicalPhaseC5A`
