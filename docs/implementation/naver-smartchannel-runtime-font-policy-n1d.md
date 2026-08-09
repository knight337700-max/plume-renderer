# N1D implementation note — SmartChannel runtime font policy

## Delivered

- `contracts/naver-smartchannel-runtime-font-policy.json`: six exact source identities, PSD/token/language evidence, runtime matrix, Windows/Apple guard, external resource contract, and N2 blocker.
- `contracts/naver-smartchannel-font-preflight.schema.json`: blocked/pass report shape and canonical N1D error codes.
- `src/core/naver-smartchannel-font-preflight.ts`: SFNT identity inspection and trusted external exact-font preflight. It does not dispatch a renderer.
- `scripts/verify-naver-smartchannel-font-policy.mjs`: policy/schema/inventory/security verification.

## Deterministic preflight

The resolver accepts only trusted local references. It rejects URLs, absolute/UNC paths,
parent traversal, symlink/reparse traversal, undecodable fonts, PostScript mismatch, digest
mismatch, and declared-version mismatch. Any issue returns `BLOCKED` with
`renderStartAllowed=false`; no fallback is attempted.

## Scope boundary

No SmartChannel raster, Canvas/Sharp/Skia choice, Desktop UI/file picker, font installation,
download, network call, or Golden PNG was added. Kakao/FREEFORM rendering and registries remain
the existing implementation surface.

## Verification

Run `pnpm verify:naver-font-policy`, `pnpm verify:naver-contract -- --strict-source`,
`pnpm typecheck`, and the full repository test command after the source policy is regenerated.
