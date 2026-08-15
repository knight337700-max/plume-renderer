# ADR-0065: Share Google Static Preview and Export request identity (G3.0.2)

- Status: Accepted and implemented
- Date: 2026-08-15
- Phase: G3.0.2

## Context

The Google Desktop UI included `deliveryMetadata` in Preview but omitted it when constructing
Export. The trusted Main/Core stale guard correctly included metadata in the fingerprint, making a
PASS Preview impossible to export even when the user had not changed any input.

## Decision

Use one shared `buildCanonicalGoogleStaticRequest` builder for Preview and Export. Normalize only
the metadata representation (recursive object-key order and NFC strings, preserving array order),
keep it outside rasterization, and apply the same builder at the Main/Core trust boundary. Keep the
`DESKTOP-EXPORT-003` comparison unchanged so any real identity change remains fail-closed.

## Consequences

- Unchanged Google Static Preview requests can export their local artifact pair.
- Delivery metadata changes remain deterministic stale blocks.
- No Google Golden bytes, render fingerprints, schema versions, template coordinates, or upload
  boundaries change.
- G3.0.1's exact eight-path allowlist remains intact; G3.0.2 has its own exact production-path
  record and verifier.

## Rejected alternatives

- Removing delivery metadata from the fingerprint: would weaken stale protection.
- Copying metadata only in the UI without a shared builder: would leave Preview/Export drift likely.
- Disabling `DESKTOP-EXPORT-003`: would allow stale artifacts to publish.
