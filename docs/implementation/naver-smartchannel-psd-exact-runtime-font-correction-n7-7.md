# N7.7 SmartChannel PSD-exact runtime font correction

## Outcome

N7.7 changes only the SmartChannel token-to-runtime-font mapping. The renderer now
resolves three renderer-owned, SHA-256-pinned Apple SD Gothic Neo binaries through a
trusted-root resource provider, verifies the bytes and recorded OpenType identity, checks
the required glyph sample, and explicitly registers the binary before text rendering.
Resolution is fail-closed: a missing, altered, undecodable, identity-mismatched, or
uncovered font produces `NAVER_SMARTCHANNEL_FONT_UNAVAILABLE` (or the corresponding
canonical font identity/version error) and no render starts.

The N7.6 audit remains unchanged at
`contracts/audits/naver-smartchannel-typography-audit.json` with status
`MISMATCH_FOUND`. Its source typography, 25 PSD type token IDs, text boxes, baselines,
leading, and geometry are the evidence baseline; this correction record is additive at
`contracts/audits/naver-smartchannel-runtime-font-correction-n7-7.json`.

## Runtime mapping

| Visible role | Logical token | Renderer resource | SHA-256 |
| --- | --- | --- | --- |
| `HEADLINE`, `HEADLINE_LINE_2` | `NAVER_SC_APPLE_SD_GOTHIC_NEO_BOLD` | `assets/fonts/naver-smartchannel/AppleSDGothicNeo-Bold.ttf` | `a652ea0a3c4bf8658845f044b5d6f40c39ecf03207e43f325c1451127528402b` |
| `SUBCOPY`, `THIRD_LINE`, `FOURTH_LINE`, `DISCLOSURE_LINE_1`, `DISCLOSURE_LINE_2` | `NAVER_SC_APPLE_SD_GOTHIC_NEO_REGULAR` | `assets/fonts/naver-smartchannel/AppleSDGothicNeo-Regular.ttf` | `f44eec027992b99dc25de0229c5726fe209a6cb80761aaef98d050cdc0bc6cfe` |
| `APP_CTA_TEXT` | `NAVER_SC_APPLE_SD_GOTHIC_NEO_SEMIBOLD` | `assets/fonts/naver-smartchannel/AppleSDGothicNeo-SemiBold.ttf` | `a9c5ffb4dadce253d8748b18019954a8af19b7cfcc3b586fce64ef1f6bd71492` |

The supplied binaries' actual OpenType name-table PostScript identities are recorded
without alteration: `AppleSDGothicNeoB00`, `AppleSDGothicNeoR00`, and
`AppleSDGothicNeoSB00`. The PSD-declared labels remain source labels; canonical runtime
aliases are registered explicitly. No name or digest is fabricated. The separate source
binary license/redistribution status is recorded as unconfirmed and is not represented as
an official redistribution grant.

`AppleSDGothicNeo-Medium`, `SFProDisplay-Bold`, and `SFUIDisplay-Bold` are recorded as
`SOURCE_ONLY_NON_RUNTIME` because they have no final visible contribution. Historical
Nanum assets remain available only for non-SmartChannel consumers and are not required by
the SmartChannel runtime.

## Frozen geometry and representative values

The correction does not alter the project `templateContractVersion` (`1.9.0`), the
SmartChannel template contract (`1.10.0`), PSD type token IDs,
font sizes, baselines, line gaps, text boxes, object placement, or fixed-component
coordinates. For `NAVER_SMARTCHANNEL_280_BASIC_STANDARD_LEFT_MAIN2_SUB_NONE` the frozen
values remain:

- headline 1: `y=77`, baseline `106.45703125`, size `35`
- headline 2: `y=125`, baseline `154.45703125`, size `35`
- subcopy: `y=177`, baseline `201.45703125`, size `29`
- line gaps: headline `48`, subcopy `47`

The same frozen source-to-contract checks were retained for the 160px, 200px, and 280px
groups. The 120-template contract remains a one-to-one source PSD mapping (`32 + 32 + 56`),
and no size group received a coordinate, text-box, baseline, leading, or font-size edit.

## Provider and fingerprint policy

Desktop and test deployment providers resolve the same trusted-root-relative resources.
The provider rejects URLs, traversal, UNC paths, symlinks/reparse points, and missing
files. The renderer fingerprint includes the logical font token and verified digest; it
never includes an absolute physical path. The parity test confirms identical font digests,
pixel fingerprints, and PNG digests for the Desktop and TestDeployment providers.
Runtime network access remains zero and no system-font lookup or fallback is permitted.

Desktop is a QA harness over the Core provider contract. A deployment adapter for a future
production module can supply the same trusted-root-relative resource bytes; it is not a
separate font implementation and does not use OS-installed fonts.

## Acceptance evidence

- all 120 SmartChannel templates rendered and passed;
- font resolution failures: `0`;
- new validation errors: `0`;
- three repeated runs are deterministic;
- provider parity: PASS;
- N7.5 fixed-component assets/placement: unchanged;
- non-SmartChannel outputs: unchanged;
- verification: `scripts/verify-n7-7-smartchannel-runtime-font-correction.mjs`.

The SmartChannel text pixel output is expected to change because the runtime font mapping
is corrected. This is recorded as a golden migration; existing goldens are not silently
overwritten. SmartChannel golden rebase and packaged Windows QA are deferred to N7.8.

## Version changes

| Contract | Previous | Current | Reason |
| --- | ---: | ---: | --- |
| Canonical document | `1.21.1` | `1.21.2` | renderer-owned PSD-exact runtime font mapping |
| Renderer Core | `0.8.3` | `0.8.4` | provider, digest/identity/glyph preflight, explicit registration |
| Desktop package | `0.9.6` | `0.9.7` | bundle the three runtime resources |
| Runtime font policy | `1.3.0` | `1.4.0` | exact renderer-owned resource contract |
| Font compatibility | `1.1.0` | `1.2.0` | Apple role mapping and fail-closed modes |
| Font contract | `1.0.0` | `1.1.0` | required Apple logical tokens |
| Typography registry | `1.3.0` | `1.4.0` | additive correction mapping |

`templateContractVersion` remains `1.1.0`; no coordinate contract changed.
