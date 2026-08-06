# OBJECT_RIGHT 텍스트 기준선 및 카피 제한 Clarification

- 상태: `ACCEPTED_PROJECT_AMENDMENT`
- Canonical 문서: `1.2.0 → 1.3.0`
- Template Contract: `1.1.0 → 1.2.0`
- Desktop app: `0.2.0 → 0.2.1`
- 적용일: 2026-08-06 (KST)

## 문제

C2 baseline 비교에서 기존 Renderer의 Headline alpha 중심 Y가 검수 통과 소재보다 약 `4.1983px`, Subcopy가 약 `3.9018px` 위였다. 기존 layout은 advance width와 hard edge만 사용했고, Unicode grapheme·한글 환산 unit·내부 연속 공백 warning 계약이 없었다.

## 결정

1. CTA `NONE`의 Headline baseline을 `116 → 120`, Subcopy baseline을 `174 → 178`로 각각 정확히 +4px 이동한다.
2. X `48`, hard right edge exclusive `633`, object slot, 제품 좌표, 폰트 파일·weight·size·color, Alpha Trim, PNG encoder와 CTA Registry는 변경하지 않는다.
3. Core 단일 `TextContract`가 NFC 후 `Intl.Segmenter(grapheme)`를 사용해 한글 환산 unit을 계산한다. Headline 최대는 `12.0`, Subcopy 최대는 `15.0`이다.
4. `U+0020`은 unit 0이지만 raster advance에는 반영한다. 앞뒤 공백은 trim하고, 중간 연속 공백은 삭제하지 않고 `KBR-TEXT-SPACING-001` WARNING을 반환한다. 탭·줄바꿈은 기존 `KBR-TEXT-002` ERROR를 유지한다.
5. 실제 pinned font raster alpha ink bbox로 `occupiedWidthPx = rightExclusive - 48`을 계산한다. `0..526` PASS, `527..585` WARNING, `586+` 또는 `rightExclusive > 633` ERROR다. 기존과 의미가 같은 hard-edge 오류는 `KBR-TEXT-004/005`를 재사용한다.
6. Preview와 Export는 동일 Core pipeline과 metrics를 사용한다. UI는 Core 결과를 표시만 하며 브라우저 `maxlength`를 계약 강제로 사용하지 않는다.

## 근거

- 기준선 delta는 Phase C2 동일 카피 비교 측정의 `+4px` 보정값이다. 공식 카카오 절대 baseline으로 주장하지 않으며 `[INFERRED][PROJECT]`로 분류한다.
- 최대 폭 `633 - 48 = 585px`은 기존 hard edge와 text start의 산술 관계다 `[DERIVED][PROJECT]`.
- 실제 raster alpha bbox를 사용해야 공백 advance와 glyph side bearing을 포함한 최종 right edge를 검증할 수 있다.

## 영향 범위

- Core `constants`, `text-contract`, `layout`, `normalize`, `types`, `raster`의 shared path
- Internal Preview IPC payload의 `measurements`
- React 입력 하단 metrics 표시와 ERROR/Warning 색상
- Error Registry, contract version registry, Canonical 문서, 테스트, Windows package version

## 호환성

- Input Schema `1.2.0`, Output Schema `2.0.0`, Manifest `1.0.0`, Response `1.0.0` 구조는 유지한다.
- 기존 input 필드는 그대로 사용한다. 단, baseline이 바뀌므로 기존 Golden PNG SHA는 새 SHA로 갱신된다.
- PNG는 여전히 RGBA PNG-32 `1029×258`이며 제품 영역과 우측 48px 투명 계약은 유지한다.
- Warning-only는 Export 허용, ERROR는 publish와 Export를 모두 차단한다.

## 미해결 Blocker

- 기술 구현 Blocker 없음.
- M-001~M-005 사람 수동 Acceptance 및 M-006 카카오모먼트 외부 UAT는 별도 기록 대상으로 남긴다.

## 원본 명세의 변경 섹션

- 문서 상단 버전·상태
- 3.2 Template 식별자
- 3.6.1 CTA 없음 텍스트 영역 profile
- 4.1 Input 예시의 template contract
- 13. Phase C0 절의 역사적 기준선 표기 및 Font 상태 보정
- 14. Phase C2a Text Baseline and Copy Limit 신규 절

이 결정은 `[OFFICIAL]`을 추가하거나 reference PNG를 수정하지 않는다.
