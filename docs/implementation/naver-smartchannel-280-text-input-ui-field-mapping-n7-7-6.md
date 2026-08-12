# N7.7.6 SmartChannel 280 text input schema / UI field mapping correction

Status: PASS  
Canonical document: unchanged at `1.21.4`  
Renderer Core: unchanged at `0.8.6`  
Golden rebase: NOT PERFORMED

## Root cause

The canonical input schema and exact PSD metadata were already correct. Core orders each visible
text layer by its source `boxY`, assigns role occurrences to canonical input keys, validates those
keys, and reports the same `inputKey` after rasterization. Desktop did not consume that metadata.
Its local `templateFields` function interpreted `textVariant` names and only added a second
headline when `variant.includes("MAIN2")`. `MAIN_TWO_LINES` and `FOUR_LINE` do not contain that
substring, so `headlineLine2` was missing even though Core required it.

## Correction

Electron Main now derives an ordered `textInputFields` descriptor array for every catalog template
from `contracts/naver-smartchannel-psd-metadata.json`. The derivation uses visible text-layer role
and source vertical order; it does not inspect template or mode names. Desktop renders those
descriptors and uses the same descriptor keys when constructing Preview and Export requests.

Each descriptor records canonical key, role, required status, order, localization key, and source
layer name. Labels are localized Korean UX strings rather than raw internal keys. Form state stays
keyed by canonical input key, while each request includes only fields valid for the selected
template. Hidden values remain available when returning to a compatible mode and never migrate
between roles.

## 280 inventory

- 56 source-backed 280 templates were checked.
- 8 `MAIN_TWO_LINES` templates expose both `headline` and `headlineLine2` (plus `ctaOption` only
  where the template contract enables APP CTA).
- 5 ordinary emphasis `FOUR_LINE` templates expose `headline`, `headlineLine2`, `subcopy`, and
  `subcopyLine4`.
- 1 bottom-disclosure source template also carries the catalog label `FOUR_LINE`; its exact fourth
  PSD role is disclosure, so its fourth canonical key remains `disclosureLine1`. No template-name
  exception or contract rewrite was introduced.
- All 56 templates have zero missing fields, zero extra fields, and zero ordering mismatches.

The 64 compact 160/200 templates were also derived from their own metadata and were not changed to
match 280 semantics.

## Acceptance evidence

Reproducible artifacts are under `artifacts/n7-7-6/`. BASIC and EMPHASIS `MAIN_TWO_LINES` and an
ordinary `FOUR_LINE` template were exercised in Electron. Distinct values reached distinct Core
text roles and exported manifest input keys. Mode switching preserved compatible keys and produced
zero cross-wired values.

N7.7.5 font binaries, typography, validator, actual-raster overflow rule, source origins, object
placement, and Golden files are outside this change and remain frozen.

Full regression passed with 43 Vitest files / 261 tests and 28 Playwright tests. Windows package,
package smoke, and the unpacked/portable 120-template Desktop matrix also passed.
