# N7.7.5 SmartChannel typography parity correction

Status: PASS  
Template: `NAVER_SMARTCHANNEL_280_BASIC_STANDARD_LEFT_MAIN2_SUB_NONE`  
Golden rebase: NOT PERFORMED

## Scope and root causes

This phase fixes the three currently known typography defects together. The previous overflow
path accumulated `measureText(character).width + tracking` and compared the fractional advance
from the PSD point-text origin with `boxX + boxWidth`. That advance is useful diagnostic data but
is not the final visible pixel boundary. It rejected the source-known Korean headline 14 and
subcopy 17 strings even though the PSD accepts them.

The Korean locale also omitted `naver_smartchannel.text_overflow`, so Desktop displayed its
missing-translation fallback. Finally, the pinned Bold face at the frozen fractional baselines
rasterized headline ink one pixel below the PSD source.

## Correction

Core now draws text on a 1500px-wide transparent diagnostic surface with the exact production
font, size, tracking, origin, fill and `fillText` loop. It scans alpha without layout-box clipping,
keeps `measuredWidth` as diagnostics, and compares the inclusive rightmost alpha pixel with the
PSD layer's source-effective `pixelBounds[2]`. Canvas or diagnostic-surface clipping is an error.
No character-count exception or arbitrary padding exists.

The typography registry defines one adapter:

- token: `PSD_TYPE_TOKEN_3cb00cba41e436f4`
- role: `HEADLINE`
- raster baseline delta: `-1`
- scope: token and role only

An exact-source audit covered all 83 visible non-guide layers sharing the token. Before the
adapter, every layer had top delta `+1`; afterward every layer had top delta `0`. Source baseline,
box, origin, font size 35, tracking -50, colors and font binaries are unchanged. `baselineY`
remains the source value; `rasterBaselineY` records the draw adapter result.

## Representative results

| Case | Measured advance | Actual raster bounds | Boundary | Right edge | Result |
|---|---:|---|---:|---:|---|
| Headline 14, H1 | 401.1700096130371 | 304,77,400,32 | 704 | 703 | PASS |
| Headline 14, H2 | 401.1700096130371 | 304,125,400,32 | 704 | 703 | PASS |
| Subcopy 17 | 403.3300025939938 | 305,177,401,27 | 705 | 705 | PASS |

Headline Korean 13/14/15 produces PASS/PASS/OVERFLOW; subcopy Korean 16/17/18 produces
PASS/PASS/OVERFLOW. A Latin 15-character sample passes, demonstrating the decision is raster
width-based rather than count-based. Korean localization is now
`텍스트가 스마트채널 허용 영역을 벗어났습니다.` and never reaches the missing-key fallback.

## Acceptance

- Representative 3-run PNG bytes: identical
- Representative 3-run pixel fingerprints: identical
- SmartChannel templates: 120 attempted, 120 passed
- Compact 160/200 CTA options: 11 each
- 280 CTA options: 11
- New font errors, validator errors, crashes: 0
- Runtime font binaries and four required SHA-256 values: unchanged
- Golden rebase: not performed; not ready pending further user feedback

Reproducible evidence is in `artifacts/n7-7-5/`. Run `pnpm evidence:n7-7-5-typography`
to regenerate it and `pnpm verify:n7-7-5-typography` to validate it.

