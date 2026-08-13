# META M2.1 — Visual candidate correction and output-compliance audit

## Scope

M2.1 audits the existing META static renderer output and corrects only the candidate layout and
provenance defect identified in M2. The renderer engine, Desktop UI, Kakao contracts, NAVER
contracts, Stories ratios, and Reels `SOURCE_REQUIRED` state remain unchanged.

The historical M2 candidates used valid `CENTER_CONTAIN` behavior. They are retained as renderer
evidence, but are not visual Goldens because their layout was not full-bleed. M2.1 candidates use
independent normalized `MANUAL_CROP` plans for the same supplied sofa/stool source.

## Output-constraint decision

The three META profiles previously inherited `maximumBytes=300000` with an `LTE` hard ERROR. The
M2.1 audit could not pin that value to an accessible current official Meta source, so the value is
removed from META profiles. The generic optional byte validator remains implemented and all
Kakao/NAVER profile limits remain untouched. No replacement maximum is invented.

The current official entry points checked were:

- [Meta Ads Guide](https://www.facebook.com/business/ads-guide)
- [Photo ads](https://www.facebook.com/business/ads/photo-ad-format)
- [Stories ads](https://www.facebook.com/business/ads/stories-ad-format)
- [Facebook and Instagram Reels ads](https://www.facebook.com/business/ads/facebook-instagram-reels-ads)
- [Instagram ads](https://www.facebook.com/business/ads/instagram-ad)
- [Instagram Stories guidance](https://www.facebook.com/help/instagram/192168966243613)

The accessible responses were login/temporary-block pages and did not expose an exact
placement-specific static-image maximum. The machine-readable result is therefore
`NO_EXACT_MAX_PINNED`, classification `UNKNOWN`, enforcement `NOT_MACHINE_ENFORCED`.

## Candidate source and crop plans

The checked-in user asset is the black sofa with stool from `TEST_SOURCE`. The original
7652×5102 JPEG is preserved with its SHA-256; a deterministic 2048×1365 JPEG derivative is used as
the renderer fixture and records the original digest. Four independent plans use exact pixel crop
frames corresponding to 1:1, 4:5, and 9:16 output ratios. Each plan fills the entire canvas with
`MANUAL_CROP` + `COVER`; the audit checks crop/destination ratio and no dominant white edge band.

Subject recognizability is intentionally `MANUAL_REVIEW_REQUIRED`; the evidence does not claim a
human visual approval.

Stories keeps the existing 14% top and 20% bottom advisory guide. The guide is a separate PNG
preview, never part of the final JPEG. Photo/background occupancy is not converted into an ERROR.
Reels remains exact-geometry `SOURCE_REQUIRED`; no guessed overlay is generated.

## Evidence and verification

- `artifacts/m2-1/meta-output-constraint-provenance.json`
- `artifacts/m2-1/meta-300kb-rule-audit.json`
- `artifacts/m2-1/meta-manual-crop-candidate-audit.json`
- `artifacts/m2-1/meta-output-format-audit.json`
- `artifacts/m2-1/meta-validator-isolation.json`
- `artifacts/m2-1/meta-determinism.json`
- `artifacts/m2-1/meta-regression.json`
- `artifacts/m2-1/manual-review/`
- `contracts/audits/meta-golden-candidates-m2-1.json`

Run:

```powershell
pnpm build
node scripts/generate-m2-1-meta-candidates.mjs
node scripts/verify-m2-1-meta.mjs
```

The old rule reproduction records `KBR-FREEFORM-FILE-SIZE-EXCEEDED` under the temporary legacy
profile, while the corrected META profile renders without that error. The manual-review registry
remains `CANDIDATE_NOT_APPROVED`, `NOT_REVIEWED`, and `finalGoldenFrozen=false`.

## Version impact

`templateContractVersion=1.9.0`, Renderer Core `0.9.0`, Validator `1.9.0`, and Desktop/package
`0.10.0` remain unchanged. The Canonical document advances `1.22.0 → 1.23.0` and the FREEFORM
Format Profile registry advances `1.3.0 → 1.4.0` because the unsupported META byte constraint is
removed. No coordinates or official upload acceptance claims changed.
