# Phase M2 — META Artifact Audit + Manual Acceptance + Golden Candidates

상태: `PASS` (자동 감사)  
수동 검수: `NOT_REVIEWED`  
Production golden freeze: `false`

## 범위

M1에서 동결된 META static runtime을 변경하지 않고 실제 출력물을 감사했다. 공통 concept를
각 profile의 독립 layout plan으로 렌더링했고, Placement Set은 square → portrait → vertical
순서로 독립 child를 생성했다. 각 plan은 background, product image, alpha logo, headline,
subcopy, decorative shape를 포함한다.

후보 registry:

`contracts/audits/meta-golden-candidates-m2.json`

모든 후보의 상태는 `CANDIDATE_NOT_APPROVED`이며, 이 단계에서 최종 golden은 동결하지 않는다.

## Candidate outputs

| Candidate | Profile | Canvas | Artifact SHA-256 | Raw-pixel SHA-256 | Validator |
|---|---|---:|---|---|---|
| `META_GC_FEED_SQUARE_V1` | `META_STATIC_FEED_SQUARE` | 1080×1080 | `95575b887784b27eb054bce0873e3a99fc41b692299aa827f6689604df4243ba` | `0baca229b1a04f1f490d4b8d1ab91b76406c993296dfa832a97a4c77ef003943` | PASS |
| `META_GC_FEED_PORTRAIT_V1` | `META_STATIC_FEED_PORTRAIT` | 1080×1350 | `f5c1d4676591efe5c9dd79015bee8aa770ab5152268c8a6b69a1cf9a7c887eb3` | `5e12883d817ac4c4ca4ba7ec8c2ac19dfa922dc37ab33ebc62fc182000d7ef42` | PASS |
| `META_GC_VERTICAL_STORIES_V1` | `META_STATIC_VERTICAL_FULL` | 1080×1920 | `7cf8008730915ad74c24c598356fa1a5965a0c4918dbd43f102a3efe992e03d3` | `f7669884d38c2a2a760d28729d3ac5cd9f37341e91d07acaa3619cb8ca25523a` | PASS |
| `META_GC_VERTICAL_REELS_V1` | `META_STATIC_VERTICAL_FULL` | 1080×1920 | `dd9e63f5210e00a1e2f5ca83a83961ac8a3e8d891888c42599829ee66e836cd4` | `fc9f8deda0aa451b357257088d16ebdba83478b4722bd6c52d7669d30263adf1` | PASS + Reels INFO |

Placement Set:

- ID: `META_GC_PLACEMENT_SET_V1`
- Child order: `META_STATIC_FEED_SQUARE`, `META_STATIC_FEED_PORTRAIT`,
  `META_STATIC_VERTICAL_FULL`
- Child artifact count: `3`
- Collection fingerprint:
  `5851c7bcd268a62e9d49d316a0eadcd11b107e0b90475345e4136c52ca870022`
- Manifest: `artifacts/m2/golden-candidates/META_GC_PLACEMENT_SET_V1.manifest.json`

## Audit findings

- All candidate PNGs are exact RGBA PNG-32 and under the `300000` decimal-byte hard limit.
- No unexpected clipping, platform chrome, CTA rasterization, guide contamination, timestamp metadata,
  or absolute machine-path metadata was detected.
- `platformCopy` metadata-only A/B preserves artifact bytes and pixel fingerprint while changing the
  request fingerprint. Embedded creative text changes bytes and pixels.
- Manual crop is deterministic and records source crop, final placement, and actual raster bounds.
- Alpha is preserved, including partial-alpha product pixels; no matte or halo was detected.
- Stories safe candidate has warning count `0`; the separate boundary fixture deterministically emits
  `KBR-META-STORIES-SAFE-ZONE-WARNING` with no error. Guide preview is separate from the final artifact.
- Reels exact safe-zone geometry is `SOURCE_REQUIRED`; guessed geometry is `false`, artifact export
  passes, and the manifest contains the INFO code `KBR-META-REELS-SAFE-ZONE-SOURCE-REQUIRED`.
- Missing Placement Set variant is blocked by `KBR-META-PLACEMENT-SET-INCOMPLETE`.
- PNG and JPEG each pass three-run byte/pixel determinism; Placement Set fingerprint is deterministic.
- M1 fixture inventory contains six PASS entries and M1 baseline flags remain unchanged.
- Runtime network requests, system-font dependency, and absolute-path fingerprint dependency are all `0`.

## Evidence layout

```text
artifacts/m2/
├─ meta-m1-artifact-inventory.json
├─ meta-artifact-audit.json
├─ meta-platform-copy-separation.json
├─ meta-crop-audit.json
├─ meta-typography-audit.json
├─ meta-stories-safe-zone-audit.json
├─ meta-reels-audit.json
├─ meta-placement-set-audit.json
├─ meta-png-jpeg-determinism.json
├─ meta-desktop-ux-audit.json
├─ meta-regression.json
├─ manual-review/
└─ golden-candidates/
```

`artifacts/m2/manual-review/` contains the required six previews, the Stories guide preview,
five manifests, contact sheet, and README. It is a user-facing visual review package only.

## Reproduction and verification

```powershell
pnpm build
node scripts/generate-m2-meta-audit.mjs
pnpm verify:m2-meta
```

The verifier checks JSON parseability, candidate and manifest hashes, raw-pixel hashes, exact canvas
and RGBA PNG-32 properties, byte limits, clipping/contamination, alpha/crop/typography audits,
Stories/Reels semantics, Placement Set completeness/order, determinism, M1 inventory, review package
contents, and the not-frozen manual-acceptance state.

No package or runtime version was changed in M2. Current versions remain document `1.22.0`, renderer
Core `0.9.0`, Validator/Error Registry `1.9.0`, Desktop/package `0.10.0`, and the existing template
contract. The next phase is `M2_1_META_USER_VISUAL_ACCEPTANCE_AND_CORRECTION`.
