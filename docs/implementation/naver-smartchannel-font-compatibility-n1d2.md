# N1D.2 Implementation Record

## 범위

Renderer, Desktop UI, Golden PNG는 구현하지 않았다. 계약·registry·preflight·자동 검증만
갱신했다.

## 검증 구현

- `scripts/smartchannel-font-utils.mjs`: SFNT name, OS/2, head, hhea, hmtx, cmap, loca/glyf
  parser와 deterministic glyph/metric 계산
- `scripts/generate-naver-smartchannel-font-compatibility.mjs`: 네 local TTF의 controlled
  alias registry와 4개 representative metric fixture 생성
- `scripts/audit-naver-smartchannel-sf-font-layers.mjs`: effective visibility 및 composite
  contribution 감사
- `src/core/naver-smartchannel-font-preflight.ts`: source/runtime identity 분리와
  `fontToken` controlled alias preflight

## 결과

- source code point 135개, 네 폰트 모두 coverage PASS
- 네 파일 digest/glyf/hmtx style separation PASS
- metric fixture 4개 / PASS 4 / overflow 0
- SFProDisplay-Bold 85개, SFUIDisplay-Bold 64개 모두 `HIDDEN_SOURCE_TEXT`; export contribution 0
- N2 readiness `true`

local binaries는 `.local-fonts/naver-smartchannel/`에 남아 있지만 `.gitignore` 대상이며
commit/bundle하지 않는다. runtime network access와 arbitrary fallback은 금지된다.
