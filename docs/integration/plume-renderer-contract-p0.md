# PLUME → Renderer Contract Boundary (P0)

PLUME is an upstream producer, never a Renderer dependency. The only render input is a
fully materialized, schema-valid canonical placement plan and the referenced bytes.
Manual and agent-authored plans are equivalent when their pixel-affecting fields and
asset/font digests are equivalent.

`PlacementCapabilityHints 1.0.0` describes what an authoring surface may offer. It is
not a source of truth; a frozen profile contract and Validator have final authority.
`PlacementProvenanceEnvelope 1.0.0` carries neutral, optional provenance outside the
core input. Vendor names are advisory and cannot select a render branch.

The Renderer never calls PLUME during render. It rejects unknown schema versions and
policies, profile/capability conflicts, non-finite or out-of-range geometry, digest
mismatches, locked-profile transforms, platform ownership mismatches, cardinality
errors, fit/crop contradictions, and missing contract references. A final artifact is
publishable only when validation has zero ERROR diagnostics.

See `contracts/p0-plume-architecture-freeze.json`,
`contracts/p0-plume-capability-matrix.json`, and the two versioned schemas for the
machine-readable freeze.
