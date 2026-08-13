# Phase M1 — META static asset profiles and placement-set renderer

Status: IMPLEMENTED_RUNTIME_CANDIDATE · manual acceptance `NOT_REVIEWED`

M1 reuses the existing FREEFORM renderer. The three META profiles are project output presets:

- `META_STATIC_FEED_SQUARE` — 1080×1080, 1:1
- `META_STATIC_FEED_PORTRAIT` — 1080×1350, 4:5
- `META_STATIC_VERTICAL_FULL` — 1080×1920, 9:16

The ratio classification is source-backed; the pixel dimensions are explicitly project-owned and
are not represented as a Meta mandatory upload-size claim. `src/core/meta-static.ts` dispatches
SINGLE requests to FREEFORM and composes `META_STATIC_PLACEMENT_SET_V1` in the fixed order square,
portrait, vertical. Child plans remain independent. Missing variants and child ERRORs fail closed.

Stories uses the normalized top 14% / bottom 20% guide as a WARNING for key creative content. It is
not baked into final PNG/JPEG output. Reels remains `SOURCE_REQUIRED` and emits INFO without guessed
geometry. Platform copy is retained in provenance and manifests only; it is never rasterized.

The Desktop renderer now exposes a META channel, project profile selector, SINGLE/COLLECTION mode,
placement context, platform-copy metadata fields, and Stories/Reels guide state. Runtime requests
remain network-free and use the existing trusted-root and atomic publish policies.

Candidate fixtures live under `fixtures/meta/`; they are not frozen pixel goldens. A future phase may
add manually accepted goldens after source and creative review.
