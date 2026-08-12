# N7.7.4 macOS Original TTC Renderer Integration

## Outcome

Status: `PASS` pending manual approved-creative comparison. SmartChannel runtime now treats the renderer-owned macOS original `AppleSDGothicNeo.ttc` as source of truth. Windows font installation, system font lookup, browser fallback, and runtime network access are not required.

## Source integrity

- Path: `assets/fonts/naver-smartchannel/AppleSDGothicNeo.ttc`
- Size: `28427796` bytes
- SHA-256: `0452cde17bbdfe71106680879df943034a003c537c95a4137bab124b3cfa4b66`
- License: `UNCONFIRMED_REVIEW_REQUIRED_BEFORE_EXTERNAL_REDISTRIBUTION`
- Current scope: `PRIVATE_LOCAL_RENDERER_MODULE`

Required collection identities were re-inventoried with the Core read-only parser: Regular index 0, SemiBold index 4, Bold index 6; all are version `19.0d2e1`, unitsPerEm 1000, 18,662 glyphs, and CFF outlines.

## Backend decision

The renderer uses TypeScript/Node.js with `@napi-rs/canvas 1.0.3` and its Skia native backend. `GlobalFonts.register(Buffer, alias)` and `registerFromPath(path, alias)` expose no collection face-index parameter. An isolated actual local preflight with system-font loading disabled exposed only one weight-400 style; weight 400/600/700 requests all produced the same width as derived face index 0 Regular, while derived indices 4 and 6 produced distinct widths. It therefore cannot select SemiBold index 4 or Bold index 6 deterministically. The executable preflight is `scripts/probe-n7-7-4-direct-ttc.mjs`, and its result is embedded in `artifacts/n7-7-4/font-backend-audit.json`.

Integration mode is `VERIFIED_DERIVED_STANDALONE_FACE`. `scripts/extract-apple-sd-gothic-neo-ttc.mjs` copies the selected face's SFNT tables without a FontForge round trip, outline regeneration, name rewrite, metric change, or layout-table change. Only `head.checkSumAdjustment` is recomputed for valid standalone SFNT packaging. The Core verifies normalized table equality, collection SHA, face index, PostScript identity, version, glyph coverage, standalone SHA, unitsPerEm, glyph count, and weight before explicit registration.

| Role | Face | Runtime file | SHA-256 |
|---|---:|---|---|
| Regular | 0 | `AppleSDGothicNeo-macOS19-Regular.otf` | `f41058fdd3ccdf7233abcef16d8d22f66c7dc35c14a5b4f665043f1ab20c86ff` |
| SemiBold | 4 | `AppleSDGothicNeo-macOS19-SemiBold.otf` | `e6aa5c5757cdb7f1b790dd0bfe6d627a4db2bd90a6751b4290733ae21419ba73` |
| Bold | 6 | `AppleSDGothicNeo-macOS19-Bold.otf` | `ae71ed736249e8c07191e6b7ec81d7ec8898f51fdc7d00ea49d2a6592e386cd7` |

## Runtime and fingerprint

Logical token lookup resolves the source collection and verified derived face through the same trusted-root-relative provider. Fingerprints include token, collection asset ID, collection SHA, face index, face PostScript identity, and font contract version. Absolute physical paths are excluded. Missing bytes, wrong SHA, absent face, identity/version mismatch, unsupported collection, or provenance/table mismatch fail closed without fallback.

## Representative A/B

Template: `NAVER_SMARTCHANNEL_280_BASIC_STANDARD_LEFT_MAIN2_SUB_NONE`.

- Legacy N7.7 PNG SHA: `b8a120723c2fddf39c82946805fda662f95d0bb6b248a38d78dd5b24d521a463`
- Legacy decoded pixel SHA: `afbcbc45bbb1ca7f549d1264d1418ae63da0caf18538cef5abe846d4cd5a892c`
- macOS TTC PNG SHA: `78d7252b74c859fd07b5294ae705943299388892e469bb58844e19e6ac54c601`
- macOS TTC decoded pixel SHA: `d5695a5e67823c7f7db6d5e641a817c23564b13ab07f8cbc274948197704aae5`
- Changed pixels: 10,490 / 210,000 (`0.04995238095238095`)
- Mean absolute channel delta: `1.6306309523809523`

Font size, baseline, tracking, leading, text origin/box, template coordinates, object placement, and fixed-component geometry were not modified. `actualRasterBounds` is now computed from each role's isolated final raster instead of copying PSD/layout bounds. The macOS candidate was rendered three times; PNG and decoded-pixel SHA were byte-identical on all runs.

## Acceptance

- Provider parity: PASS across Core test, Desktop, and package/handoff providers.
- System-font independence: PASS with `DISABLE_SYSTEM_FONTS_LOAD=1` and explicit renderer-owned registration.
- SmartChannel 120 smoke: 120/120, font errors 0, new validator errors 0, crashes 0.
- Golden rebase: not performed.
- Manual approved-creative comparison: `NOT_REVIEWED`.
- Legacy N7.7 converted TTF: retained, `DEPRECATED_FOR_SMARTCHANNEL`; used only for A/B evidence unless another dependency is identified.

## Regression and packaging

- Contract, schema, registry, and historical N7.6/N7.7 verifiers: PASS.
- TypeScript, renderer-contract TypeScript, ESLint: PASS.
- Vitest: 41 files, 252 tests PASS; frozen Kakao goldens are unchanged.
- SmartChannel runtime historical golden preservation: 6/6 PASS.
- SmartChannel exhaustive render: 120/120 PASS with three-run determinism.
- Playwright Desktop: 26/26 PASS.
- Windows unpacked and portable package smoke: PASS; runtime network requests 0.
- Packaged source TTC and all three derived OTF digests: exact match.
- NAVER fixed components, NAVER non-SmartChannel, FREEFORM, and platform-composed contracts: unchanged/PASS.
- Portable package: `Kakao-Bizboard-Local-Renderer-0.9.8-x64.exe` generated and smoke-tested; its build-specific size and SHA-256 are recorded in the external handoff manifest and final report to avoid a package self-reference.
- Renderer Module handoff: 699/699 file hashes, 120/120 PSD hashes, source TTC digest, and N7.7.4 provenance PASS.

Evidence is in `artifacts/n7-7-4/`. Golden rebase remains blocked on manual/source visual acceptance, not on technical integration.
