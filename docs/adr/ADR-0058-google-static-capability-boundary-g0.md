# ADR-0058: Google Ads static capability boundary for G0

- Status: Accepted for G0 architecture freeze candidate
- Date: 2026-08-14
- Scope: Google Ads static capability discovery and architecture only

## Context

Google Ads exposes several static-image delivery families with different lifecycle,
asset-cardinality, and composition semantics. Treating them as one `GOOGLE_STATIC`
renderer profile would blur the boundary between pixels produced locally and text,
CTA, URL, serving composition, and policy decisions owned by Google. The G0 prompt
also requires that discovery not activate runtime profiles or upload behavior.

## Decision

1. Register separate Google delivery capabilities and separate renderer asset profiles;
   do not merge Display, Demand Gen, RDA, or Performance Max into one profile.
2. Model RDA, Performance Max static AssetGroup assets, and Demand Gen single-image
   assets as `PLATFORM_COMPOSED`. The Renderer owns image/logo pixels only; Google owns
   platform text, CTA, URL, asset selection, serving layout, and preview UI.
3. Model Demand Gen uploaded display static and legacy uploaded display static as
   `RENDERER_COMPOSED` single-image artifacts. Their delivery is still represented by
   a separate collection manifest.
4. Keep every delivered image as a `SINGLE` artifact. A `COLLECTION` is a delivery
   manifest and is never a raster artifact.
5. Record lifecycle as `TRANSITIONAL` for legacy Display and RDA, `ACTIVE_EVOLVING`
   for Demand Gen, and `ACTIVE` for Performance Max. No future sunset date is invented.
6. Keep official ratios, minimums, and recommendations separate from explicit project
   output presets. Unresolved discrepancies fail closed and remain source-required or
   non-blocking until authoritative evidence is pinned.
7. Treat proposed Google diagnostics as architecture metadata only. They are not added
   to the active Error Registry or Validator runtime in G0.
8. G0 changes documentation, provenance, and machine-readable architecture records
   only. No Google runtime profile, renderer code, Desktop UI, golden, or upload/API
   integration is added.

## Consequences

- KAKAO, NAVER, and META static runtime behavior and frozen outputs remain unchanged.
- G1 can implement one capability at a time without changing the composition boundary.
- Local artifact and delivery-set checks can be deterministic; account eligibility,
  policy review, campaign creation, and upload acceptance remain Google-owned.
- The architecture must carry provenance and unresolved-rule status so a future profile
  cannot silently turn a project preset into an official acceptance claim.

## Rejected alternatives

- A merged `GOOGLE_STATIC` profile: rejected because platform-composed and
  renderer-composed semantics are incompatible.
- Rasterizing Google headlines, CTA, final URL, or preview screenshots: rejected because
  these are platform-owned and would create a false upload artifact.
- Activating all discovered formats in G0: rejected because the phase is discovery and
  architecture only; implementation belongs to a separately gated G1.

## Records

- `contracts/google/architecture.g0.json`
- `contracts/google/capabilities.g0.json`
- `contracts/google/asset-geometry.g0.json`
- `contracts/google/delivery-contracts.g0.json`
- `contracts/google/provenance.g0.json`
- `contracts/google/diagnostics.g0.json`

**[PROJECT]**
