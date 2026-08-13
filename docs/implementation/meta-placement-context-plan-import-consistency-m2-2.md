# META M2.2 Placement Context and Plan Import Consistency Hotfix

Status: IMPLEMENTED / CANDIDATE_NOT_APPROVED
Canonical document: `1.23.1` (patch from `1.23.0`)
Template contract: `1.9.0`, coordinates unchanged

## Root causes

1. `placementContext` was interpreted from the legacy nested `metaStatic` path while the canonical
   Render Request already exposed a top-level field. This allowed a UI or caller to lose explicit
   Stories/Reels intent.
2. The Desktop editor initialized every META profile to `FACEBOOK_FEED`, including the generic
   vertical profile. Placement-specific validation therefore depended on a hidden UI default.
3. Placement-set child requests could inherit a collection context into a vertical child. The editor
   also selected a cached variant through a stale state snapshot during profile changes, which could
   replace an imported image placement with the default `CENTER_CONTAIN` plan.

## Contract boundary and propagation

`CreativeLayoutPlan` owns only pixel/layout semantics: bounds, ordering, image placement policy,
fit mode, crop rectangle, anchor, and opacity. `placementContext` is owned by the Render Request.
The plan schema continues to reject a root `placementContext`; the request schema accepts the existing
context enum and fails closed for unknown strings. A nested `metaStatic.placementContext` read path is
kept for older callers, but when both paths are present they must agree and the top-level path wins.

Core resolves and records `requested`, `resolved`, `source`, and `path` in
`metaStaticReport.placementContextResolution`. A generic `META_STATIC_VERTICAL_FULL` request with no
explicit context resolves to `null` / `DEFAULT_NONE`. Stories routing is enabled only for explicit
Stories contexts. Reels emits the existing source-required INFO only for explicit Reels contexts;
exact Reels geometry is not guessed.

The Desktop request builder now serializes top-level context. The editor presents an explicit neutral
vertical option, clears the old feed default on vertical selection, and retains imported placement-set
variants through a ref-backed cache. Imported plan fields remain the source of truth.

## Validator semantics

Stories safe-zone exclusions remain advisory. Full-bleed photo occupancy is not a warning target;
managed text/logo overlays and explicit `KEY_CREATIVE` elements can produce the existing warning.
The M2.2 candidates mark the hero photo `DECORATIVE`, so Stories has zero warnings. A boundary fixture
with an explicit `KEY_CREATIVE` hero demonstrates the warning path. The unpinned META `300000` byte
rule remains absent.

## Candidate and evidence package

The generator `scripts/generate-m2-2-meta-candidates.mjs` writes four independent JPEG candidates,
per-candidate manifests and crop plans, a separate Stories guide, and deterministic evidence under
`artifacts/m2-2/`. The corrected Square and Portrait manifests show `MANUAL_CROP + COVER` and full
canvas alpha bounds. Stories resolves to `INSTAGRAM_STORIES`; Reels resolves to `INSTAGRAM_REELS`
with `SOURCE_REQUIRED` INFO. The request fingerprint differs between Stories and Reels while pixel
and artifact digests remain equal for the same plan/source/output.

Manual acceptance is deliberately `NOT_REVIEWED`; the candidate registry remains
`CANDIDATE_NOT_APPROVED` and `finalGoldenFrozen=false`. M2.3 is reserved for visual review and Golden
freeze.

## Verification

`scripts/verify-m2-2-meta.mjs` checks schema boundary, neutral defaults, validator routing, imported
placement fidelity, candidate dimensions/hashes, stale-byte-rule absence, three-run determinism,
and Kakao/NAVER regression evidence. Existing M1 and M2.1 verifiers remain runnable against their
historical phase records. Runtime network access remains prohibited.
