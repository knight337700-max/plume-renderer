# FREEFORM Core Raster v1 fixtures

The F1 fixture set is intentionally small and reuses the pinned local assets already
in `fixtures/valid/`:

- `object-right__product__basic__pass.png` for IMAGE policies
- `mask-semicircle-right__logo__colored__pass.png` for LOGO alpha composition
- the pinned Spoqa Han Sans files in `assets/fonts/` for TEXT

The executable fixture names are covered by `tests/freeform-core/freeform-core.test.ts`:

`basic-image-text-logo`, `transparent-background`, `solid-background`,
`z-index-overlap`, `explicit-newlines`, `text-clip`, `text-overflow-error`,
`image-manual-crop`, `image-semantic-crop`, `logo-alpha-trim-contain`,
`manual-source`, `agent-source`, `invalid-bounds`, `duplicate-element-id`,
`unsupported-word-wrap`, `unsupported-shape`, and `unsupported-jpg`.

No external or brand asset is downloaded by these fixtures.
