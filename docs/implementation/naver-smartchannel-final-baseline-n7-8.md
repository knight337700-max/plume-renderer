# NAVER SmartChannel Final Baseline — N7.8

Status: PASS

Phase: `N7_8_SMARTCHANNEL_GOLDEN_REBASE_FINAL_PACKAGE_QA`
Source runtime commit: `a6318e0df7940290743b455a26cc168d985e9bee`

## Decision and scope

The user directly revalidated the corrected Desktop runtime after N7.7.4–N7.7.6, reported no additional errors, and explicitly authorized the N7.8 Golden rebase. That instruction resolves the earlier `NOT_REVIEWED` rebase blocker for this freeze. The production renderer is the source of truth; no image was externally edited.

N7.8 changes only the six representative SmartChannel Golden PNGs/manifests, their registry/evidence, verification tooling, and Desktop/package patch metadata. Canonical `1.21.4`, Core `0.8.6`, SmartChannel Template `1.10.0`, Typography `1.6.0`, Validator `1.8.1`, geometry, object placement, UI field mapping, colors, and raster behavior remain frozen.

## Font provenance

| Resource | SHA-256 |
|---|---|
| `AppleSDGothicNeo.ttc` | `0452cde17bbdfe71106680879df943034a003c537c95a4137bab124b3cfa4b66` |
| Regular derived face | `f41058fdd3ccdf7233abcef16d8d22f66c7dc35c14a5b4f665043f1ab20c86ff` |
| SemiBold derived face | `e6aa5c5757cdb7f1b790dd0bfe6d627a4db2bd90a6751b4290733ae21419ba73` |
| Bold derived face | `ae71ed736249e8c07191e6b7ec81d7ec8898f51fdc7d00ea49d2a6592e386cd7` |

Runtime uses the renderer-owned TTC provenance and verified standalone faces, with system lookup, fallback, absolute-path fingerprinting, and runtime network access prohibited.

## Coverage and frozen parity

- PSD/template inventory: 120/120.
- Full renderer validation: 120/120, each template rendered three times, font/validator errors and crashes 0.
- Representative Golden topology: six existing N2 representative Goldens; no 120-file Golden expansion.
- N7.7.5: `ACTUAL_RASTER_BOUNDARY` remains active. Headline 14 ends at 703 with boundary 704; subcopy 17 ends at boundary 705. Headline tops remain 77/125 and subcopy top remains 177.
- N7.7.6: 56 height-280 templates, missing/extra/order errors 0; representative UI/request mapping PASS for BASIC/EMPHASIS MAIN_TWO_LINES and ordinary/bottom-disclosure FOUR_LINE.

## Intentional Golden rebase

| ID | Old PNG SHA-256 | N7.8 PNG SHA-256 | Changed pixels | Reason |
|---|---|---|---:|---|
| N2-REP-001 | `137539fde736a384df8419437306768a0694cd1e179dc48b88dce46df957eaee` | `4ad95c055c3ab60dbc2aed433833f20607d56be48489582bc19aad3050892d85` | 9,355 | Source font/raster parity correction |
| N2-REP-002 | `9864041dd041944c75720f820afc51f193e0f7b115b38eed1d8bbbecccaadd36` | `2358a7235667baa29edc3e74da74c19ab50178b4fae2e1ecbdb6824e8d9340ba` | 7,364 | Source font/raster parity correction |
| N2-REP-003 | `53aeb385f04720a799c725ef9f5c9a971f2d0bb347da0362e91a0082df18866c` | `944107f9b344a4f1a146bf986e6095902806b47e818bfae31acb4ebe3eda639a` | 5,481 | Source font/raster parity correction |
| N2-REP-004 | `791a757c89e9e87da679066fc5c2e8de41d72ec9261994e49e8c19c1d1250479` | `fc8c54b6cab21ce2e9e9324a16a6eac714f36e4dcbd4ca032c27ddec3af42db2` | 14,315 | Source font/raster/headline parity correction |
| N2-REP-005 | `9c6a3d65734979f3f829ab86e4a48bf205bd3c2800b52ac6ae38c8d0e5b43c26` | `bd0f155f2e4f451c245f29bbb333c138061d50f412a38e57f55140073cfce127` | 15,673 | Source font/raster/headline parity correction |
| N2-REP-006 | `3ff0f84ce4820a8ee7966b833e465eafe3f4701a61120111a99ae55f07e132e8` | `627d7f5ca263f01c8389f90a4cc238e547c005b80ffad028b2f255a1265b472c` | 11,340 | Source font/raster/headline parity correction |

Every changed pixel is inside the union of old/new text or CTA-text regions with a deterministic 4 px diagnostic allowance; all six have `changedOutsideAllowedRegions=0`. N7.7.6 was UI-only and did not cause a pixel change. Per-Golden old/new/diff PNGs and metrics are under `artifacts/n7-8/golden-diffs/`.

## Non-SmartChannel frozen hashes

| Golden | SHA-256 |
|---|---|
| OBJECT_RIGHT | `20dc9d62b8650a72115a8d584846399d9cd6dd2c8a0996b4889edb596feb68b1` |
| THUMBNAIL_BOX_RIGHT | `f1111ee8f36fe1d8ccc7aaa445b175906e8a6432027d3e65764158ad40c52996` |
| THUMBNAIL_MULTI_RIGHT | `ec3689f320a20bb242f649759228bae27cec1ea74fe9ff4f3fbcea0988f3cd55` |
| MASK_SEMICIRCLE_RIGHT | `ad5448b368badcf1e5c304dadb8a93d3cbf4fab6f2e4d7d90334a44628d7d145` |

NAVER fixed components, NAVER non-SmartChannel, FREEFORM, and platform-composed paths have no changes against the N7.7.6 source commit. Final test, package, and Renderer Module results are recorded in `artifacts/n7-8/` after their gates pass.

## Version decision

Canonical/Core/Template/Typography/Validator receive no bump because runtime and contract semantics are unchanged. Representative Golden registry `1.0.0 → 1.0.1` and Desktop/package `0.9.10 → 0.9.11` are patch changes for the frozen baseline, verification material, and package contents.
