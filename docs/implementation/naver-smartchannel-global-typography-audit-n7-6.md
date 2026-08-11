# N7.6 SmartChannel Global Typography Audit

- Phase: `N7_6_SMARTCHANNEL_GLOBAL_TYPOGRAPHY_AUDIT`
- Result: **MISMATCH_FOUND**
- Scope: actual source PSD metadata → frozen token registry → runtime font mapping → local raster probes
- Runtime changes: none; typography tokens, font sizes, baselines, leading, geometry, and goldens were not edited.

## 1. Repository and source inventory

Source root: `C:/Users/Lenovo/Desktop/SMARTCHANNEL_GUIDE 12`
PSD files: **120** (readable 120, unreadable 0)

| group | files | expected |
| --- | ---: | ---: |
| `스마트채널DA_160_제작용_PSD` | 32 | 32 |
| `스마트채널DA_200_제작용_PSD` | 32 | 32 |
| `스페셜DA_성과형280_제작용_PSD (260526)` | 56 | 56 |

No duplicate PSD basenames were found.

## 2. Actual source fonts and provenance

| PSD_SOURCE_FONT | layers | templates | runtime mapping | binary |
| --- | ---: | ---: | --- | --- |
| `AppleSDGothicNeo-Bold` | 957 | 120 | `NAVER_SC_NANUM_BARUN_GOTHIC_BOLD` | `AVAILABLE` |
| `AppleSDGothicNeo-Medium` | 8 | 8 | `NAVER_SC_NANUM_BARUN_GOTHIC_BOLD` | `AVAILABLE` |
| `AppleSDGothicNeo-Regular` | 195 | 88 | `NAVER_SC_NANUM_BARUN_GOTHIC_REGULAR` | `AVAILABLE` |
| `AppleSDGothicNeo-SemiBold` | 88 | 8 | `NAVER_SC_NANUM_BARUN_GOTHIC_BOLD` | `AVAILABLE` |
| `SFProDisplay-Bold` | 85 | 56 | `NAVER_SC_SAN_FRANCISCO_BOLD` | `NO_SOURCE_BINARY` |
| `SFUIDisplay-Bold` | 64 | 64 | `NAVER_SC_SAN_FRANCISCO_BOLD` | `NO_SOURCE_BINARY` |

The three provenance layers are kept separate: `PSD_SOURCE_FONT`, `NAVER_GUIDE_ALLOWED_FONT`, and `PROJECT_RUNTIME_FONT`. The approved runtime policy maps visible AppleSDGothicNeo roles to NanumBarunGothic; the source SF layers are source-only and remain fail-closed.

## 3. Frozen token and runtime mapping audit

Frozen token count: **25**; exact source-token linkage: **25**; conflicts: **0**; unresolved visible layers: **0**.

| token | source font(s) | roles | runtime | probe |
| --- | --- | --- | --- | --- |
| `PSD_TYPE_TOKEN_0027d7d620fb7ea6` | `AppleSDGothicNeo-Regular` | `DISCLOSURE_LINE_1` | `NanumBarunGothic` | `METRIC_DELTA` |
| `PSD_TYPE_TOKEN_074a21139bce706e` | `AppleSDGothicNeo-Medium` | `GUIDE_TEXT` | `NanumBarunGothicBold` | `METRIC_DELTA` |
| `PSD_TYPE_TOKEN_11da8bc29fd38e3c` | `SFProDisplay-Bold` | `HEADLINE_LINE_2` | `SOURCE_ONLY_NON_RUNTIME` | `NO_SOURCE_BINARY` |
| `PSD_TYPE_TOKEN_22c5bf7874458168` | `AppleSDGothicNeo-Regular` | `SUBCOPY, THIRD_LINE` | `NanumBarunGothic` | `METRIC_DELTA` |
| `PSD_TYPE_TOKEN_2a80735e8efd6150` | `AppleSDGothicNeo-Bold` | `GUIDE_TEXT` | `NanumBarunGothicBold` | `METRIC_DELTA` |
| `PSD_TYPE_TOKEN_3cb00cba41e436f4` | `AppleSDGothicNeo-Bold` | `HEADLINE, HEADLINE_LINE_2` | `NanumBarunGothicBold` | `METRIC_DELTA` |
| `PSD_TYPE_TOKEN_4071b2a0935f4ce9` | `AppleSDGothicNeo-Bold` | `HEADLINE_LINE_2` | `NanumBarunGothicBold` | `METRIC_DELTA` |
| `PSD_TYPE_TOKEN_5027c9a3665891d2` | `AppleSDGothicNeo-Regular` | `FOURTH_LINE` | `NanumBarunGothic` | `METRIC_DELTA` |
| `PSD_TYPE_TOKEN_62e7d0563dd8ebf7` | `AppleSDGothicNeo-Bold` | `GUIDE_TEXT` | `NanumBarunGothicBold` | `METRIC_DELTA` |
| `PSD_TYPE_TOKEN_6c383555cd6efbad` | `AppleSDGothicNeo-Bold` | `GUIDE_TEXT` | `NanumBarunGothicBold` | `METRIC_DELTA` |
| `PSD_TYPE_TOKEN_71ec8eca9b4b5e0e` | `AppleSDGothicNeo-Regular` | `DISCLOSURE_LINE_1, DISCLOSURE_LINE_2, THIRD_LINE` | `NanumBarunGothic` | `METRIC_DELTA` |
| `PSD_TYPE_TOKEN_72e630a8d073c3e9` | `SFProDisplay-Bold` | `HEADLINE, HEADLINE_LINE_2` | `SOURCE_ONLY_NON_RUNTIME` | `NO_SOURCE_BINARY` |
| `PSD_TYPE_TOKEN_73933ce581728014` | `AppleSDGothicNeo-Bold` | `GUIDE_TEXT` | `NanumBarunGothicBold` | `METRIC_DELTA` |
| `PSD_TYPE_TOKEN_79e976470940f3f4` | `SFUIDisplay-Bold` | `HEADLINE` | `SOURCE_ONLY_NON_RUNTIME` | `NO_SOURCE_BINARY` |
| `PSD_TYPE_TOKEN_a5c324cc30685123` | `AppleSDGothicNeo-Bold` | `HEADLINE` | `NanumBarunGothicBold` | `METRIC_DELTA` |
| `PSD_TYPE_TOKEN_aa2a6ba41ccadb3f` | `AppleSDGothicNeo-Regular` | `SUBCOPY, THIRD_LINE` | `NanumBarunGothic` | `METRIC_DELTA` |
| `PSD_TYPE_TOKEN_bc12c494a7415a90` | `AppleSDGothicNeo-Bold` | `GUIDE_TEXT` | `NanumBarunGothicBold` | `METRIC_DELTA` |
| `PSD_TYPE_TOKEN_bc953c80df8e103f` | `AppleSDGothicNeo-SemiBold` | `APP_CTA_TEXT` | `NanumBarunGothicBold` | `METRIC_DELTA` |
| `PSD_TYPE_TOKEN_c64ad67f1d080034` | `AppleSDGothicNeo-Bold` | `HEADLINE, HEADLINE_LINE_2` | `NanumBarunGothicBold` | `METRIC_DELTA` |
| `PSD_TYPE_TOKEN_ce52e7c527f0325f` | `AppleSDGothicNeo-Bold` | `HEADLINE_LINE_2` | `NanumBarunGothicBold` | `METRIC_DELTA` |
| `PSD_TYPE_TOKEN_ced0e771e9f9ad11` | `AppleSDGothicNeo-Bold` | `GUIDE_TEXT` | `NanumBarunGothicBold` | `METRIC_DELTA` |
| `PSD_TYPE_TOKEN_d13327659c99dcd2` | `AppleSDGothicNeo-Bold` | `GUIDE_TEXT` | `NanumBarunGothicBold` | `METRIC_DELTA` |
| `PSD_TYPE_TOKEN_f18bc981c21cc3c6` | `AppleSDGothicNeo-Regular` | `DISCLOSURE_LINE_1` | `NanumBarunGothic` | `METRIC_DELTA` |
| `PSD_TYPE_TOKEN_f7bcaf05f9bb0300` | `AppleSDGothicNeo-Bold` | `GUIDE_TEXT` | `NanumBarunGothicBold` | `METRIC_DELTA` |
| `PSD_TYPE_TOKEN_fc75e11aad212e08` | `AppleSDGothicNeo-Bold` | `HEADLINE` | `NanumBarunGothicBold` | `METRIC_DELTA` |

## 4. Font-size, leading, baseline, and geometry

FontSize, style runs, box geometry, origin, and baseline are re-extracted from each PSD and compared with the frozen metadata. The runtime SmartChannel path consumes those frozen layer placements, so source↔frozen geometry is exact where reported below. PSD point-size and raster-pixel measurements are not declared interchangeable; raster probes are diagnostics only.

### 160 (160px)

- Templates: 32; geometry exact: 149/149; size exact: 149/149; baseline exact: 149/149.
- Grammars: `APP_CTA` (4), `BOTTOM_DISCLOSURE` (6), `LANDING_ICON` (8), `MAIN_SUB` (6), `ONE_LINE` (4), `THREE_LINE` (4).

### 200 (200px)

- Templates: 32; geometry exact: 149/149; size exact: 149/149; baseline exact: 149/149.
- Grammars: `APP_CTA` (4), `BOTTOM_DISCLOSURE` (6), `LANDING_ICON` (8), `MAIN_SUB` (6), `ONE_LINE` (4), `THREE_LINE` (4).

### 280 (280px)

- Templates: 56; geometry exact: 432/432; size exact: 432/432; baseline exact: 432/432.
- Grammars: `APP_CTA` (8), `BOTTOM_DISCLOSURE` (11), `FOUR_LINE` (4), `LANDING_ICON` (13), `MAIN_SUB` (6), `MAIN_TWO_LINES` (6), `ONE_LINE` (4), `THREE_LINE` (4).

## 5. Representative 280 template

Template: `NAVER_SMARTCHANNEL_280_BASIC_STANDARD_LEFT_MAIN2_SUB_NONE`; PSD: `스페셜DA_성과형280_제작용_PSD (260526)/01_기본형_280/01_기본형_280A_오브젝트_좌측형_3줄.psd`

| role | source font | runtime font | source size | runtime size | source baselines | runtime baselines | geometry | typography |
| --- | --- | --- | ---: | ---: | --- | --- | --- | --- |
| `HEADLINE` | `AppleSDGothicNeo-Bold` | `NanumBarunGothicBold` | 35.0 | 35.0 | `[106.45703125]` | `[106.45703125]` | `MATCH` | `MATCH` |
| `HEADLINE_LINE_2` | `AppleSDGothicNeo-Bold` | `NanumBarunGothicBold` | 35.0 | 35.0 | `[154.45703125]` | `[154.45703125]` | `MATCH` | `MATCH` |
| `SUBCOPY` | `AppleSDGothicNeo-Regular` | `NanumBarunGothic` | 29.0 | 29.0 | `[201.45703125]` | `[201.45703125]` | `MATCH` | `MATCH` |

Probable visual mismatch cause: **PROJECT_RUNTIME_FONT_METRIC_DELTA**

## 6. 120-template impact and root cause

Audited **120 / 120** templates. Source↔frozen linkage is exact for 120 templates; 120 templates have a runtime raster metric delta; unresolved 0.

- Coordinate/box/baseline root cause: not detected in the source↔frozen comparison.
- Typography root cause: runtime NanumBarunGothic is intentionally project-compatible rather than the AppleSDGothicNeo source identity; local raster probes quantify the resulting metric delta.
- Source-only SFProDisplay/SFUIDisplay layers are hidden English variants and are recorded as `NO_SOURCE_BINARY`/source-only, not silently mapped.

## 7. Correction recommendation (not applied)

Required for exact source-font fidelity: **True**. Next phase: `N7_7_SMARTCHANNEL_TYPOGRAPHY_CORRECTION_REVIEW`.

- `runtimeFontMapping`: True
- `typographyTokens`: False
- `fontSizes`: False
- `baselines`: False
- `leading`: False
- Estimated templates affected: 120; goldens/fingerprints: all SmartChannel templates that use the mapped source roles; Desktop/package: only after a separately approved runtime-font contract change.

## 8. Verification and regression boundary

The audit verifier checks JSON validity, every source PSD inventory row, all 120 current templates, all frozen typography tokens, and explicit unresolved accounting. Renderer outputs, fingerprints, Kakao, FREEFORM, and N7.5 fixed-component behavior are not modified by this audit.

