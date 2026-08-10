# N5/N6 Platform-Composed fixtures

These fixtures exercise source validation only. They do not contain a final NAVER UI or
renderer-generated PNG. Binary source assets are represented by deterministic metadata and
`pathRef`; the official guide PDFs are pinned separately under
`source-guides/naver/platform-composed/`.

The required fixture inventory is machine-readable in `fixture-manifest.json`:

- one valid `MOBILE_NATIVE` source and one `landingButton: NONE` source;
- one `finalCanvas` rejection;
- one minimum/maximum boundary case for each source field and asset rule;
- one invalid fixture requirement for every N5 Error Registry code;
- `MOBILE_DA_FEED` source safe-area boundaries;
- CTA `PLATFORM_DEFINED` unresolved-list coverage;
- collection item-count 3/4/10/11 boundary requirements;
- representative ordered collection fixtures (`collection/valid-4.json`, `collection/valid-10.json`,
  order-change cases, and per-item error cases).

N6 collection fixtures are source payloads only. They deliberately do not contain an official
sample creative or a final Feed carousel screenshot. Runtime tests generate deterministic local
RGB images under a trusted temporary input root and verify byte checksums, pixel fingerprints,
ordered collection fingerprints, and atomic publish behavior.

Large binary and 100-item datasets are implementation-phase work and are not Contract Freeze
prerequisites.
