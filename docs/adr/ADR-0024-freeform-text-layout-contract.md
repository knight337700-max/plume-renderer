# ADR-0024: FREEFORM Text Wrap과 Overflow 계약

- 상태: Accepted
- 분류: `[PROJECT]`
- 날짜: 2026-08-07

## 결정

Text color는 canonical `#RRGGBB` 또는 `#RRGGBBAA`다. 단위는 px이며 fontSizePx와
lineHeightPx는 양수, letterSpacingPx는 finite다. `NO_WRAP`, `EXPLICIT_NEWLINES`,
`WORD_WRAP`을 계약에 기록하되 v1 실행 허용값은 NO_WRAP/EXPLICIT_NEWLINES다.

`NO_WRAP`은 newline을 허용하지 않고, EXPLICIT_NEWLINES는 입력 `\n`만 줄바꿈한다.
WORD_WRAP의 Unicode segmentation 버전이 고정되기 전에는 구현하지 않는다.
Overflow는 `ERROR` 또는 deterministic `CLIP`이며 자동 shrink, ellipsis, bounds 확대는
금지한다. ERROR overflow의 실제 pixel 판정은 Raster Phase에서 도달 가능해진다.

