# N1D.2 SmartChannel Compatible Font Resolution & SF Export Audit Clarification

상태: `PASS` — project-compatible runtime typography verified; N2 readiness is true.

## 문제

N1D.1은 PSD PostScript name과 runtime PostScript name의 문자열 일치를 N2의 유일한
조건으로 사용했다. 사용자 제공 archive TTF는 실제 내부 PostScript가
`AppleSDGothicNeoB00/M00/R00/SB00`이므로 source exact가 아니었다. 또한 hidden SF
English variants를 guide-only 여부만으로 판단해 export requirement로 남겼다.

## 결정

- source identity와 runtime compatibility를 분리한다.
- `SOURCE_EXACT` 또는 `SOURCE_DIFFERENT_BUILD + PROJECT_COMPATIBLE_VERIFIED`만 N2를 허용한다.
- runtime lookup key는 source PostScript가 아닌 controlled `fontToken`이다.
- 네 archive TTF는 `SOURCE_DIFFERENT_BUILD`로 유지하되, name/full-name/OS/2/head/hhea/hmtx/cmap/glyf,
  135개 source code point coverage, style-role separation, representative metric fixtures를
  통과한 `PROJECT_COMPATIBLE_VERIFIED` runtime asset으로 승인한다.
- `sourceFontBinaryExact=false`, `sourceLayoutMetadataPreserved=true`,
  `photoshopBytePixelParityClaim=false`를 고정한다.
- SF audit는 layer/ancestor/layer-comp/clipping effective visibility와 actual composite
  contribution을 계산한다. SFProDisplay-Bold 85개와 SFUIDisplay-Bold 64개는 모두
  `HIDDEN_SOURCE_TEXT`, contribution 0, runtime non-required다.

## 근거

- [N1C PSD metadata](../../contracts/naver-smartchannel-psd-metadata.json)
- [font compatibility registry](../../contracts/naver-smartchannel-font-compatibility.json)
- [metric fixtures](../../contracts/naver-smartchannel-font-metric-fixtures.json)
- [effective SF audit](../../contracts/naver-smartchannel-sf-font-audit.json)
- [local runtime policy](../../contracts/naver-smartchannel-runtime-font-policy.json)

## 영향 범위

SmartChannel template registry/schema는 `1.2.0 → 1.3.0`, typography registry는
`1.2.0 → 1.3.0`, runtime font policy는 `1.1.0 → 1.2.0`, SF audit는 `1.0.0 → 1.1.0`,
font preflight schema는 `1.0.0 → 1.1.0`, Canonical 문서는 `1.15.0 → 1.16.0`으로
minor bump한다. 전역 Template Contract `1.9.0`, 120-template mapping, geometry,
Integration `1.8.0`, Desktop `0.8.2`는 변경하지 않는다.

## 호환성

기존 source PSD identity와 layout metadata는 보존된다. 기존 exact runtime preflight는
runtime alias/digest를 검증하는 방식으로 확장되며 arbitrary fallback, network fetch,
binary commit/bundle은 계속 금지한다. Photoshop byte/pixel parity 또는 네이버 업로드
승인은 주장하지 않는다.

## 미해결 Blocker

N1D.2에서 해소됨: `runtime_font_exact_match_to_psd`.

후속 N2는 여전히 SmartChannel Renderer/UI/Golden 구현을 별도 단계에서 수행해야 한다.

## 원본 명세의 변경 섹션

- Canonical `34.5`와 `34.7`: N1D.1 당시 blocker 판정으로 명시하고 N1D.2에 의해 supersede
- Canonical 신규 `34.8`: compatibility split, glyph/metric contract, effective SF audit
- Canonical 신규 `34.9`: N1D.2 version 및 acceptance
