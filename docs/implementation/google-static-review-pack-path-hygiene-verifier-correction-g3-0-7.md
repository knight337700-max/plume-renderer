# Google Static review-pack path-hygiene verifier correction (G3.0.7)

## Status

PASS — implementation and verification completed. This phase changes review-pack evidence generation and verification only; it does not change Renderer output, Golden bytes, canonical requests, or channel contracts.

## Confirmed defect

The prior G3.2.2 candidate contained a local absolute value in
`manifests/g3-0-6-completion-evidence.json` at `sourceArchive.path`. The value exposed both a Windows drive path and the local username. The former verifier scanned an incomplete payload set and therefore reported a false-clean result in its automated summary and pack-integrity report.

The rejected candidate archive remains external review evidence only. It was not edited, re-compressed, promoted, or used as a Golden source. Its archive bytes, SHA-256, frozen HEAD, and non-normative evidence class remain preserved in the traceability record.

## Source correction

`scripts/generate-g3-0-7-google-static-review-pack-evidence.mjs` normalizes the external archive reference to a basename-only pack-safe value and validates it with `assertPackRelativePath`. The correction record preserves the archive identity fields while recording the external-input location class. No local absolute path or username is serialized into the generated evidence.

## Final-payload verification

`scripts/google-review-pack-path-policy.mjs` now provides deterministic scanning and summary helpers for text payloads and ZIP entry names. The scanner rejects Windows drive paths, UNC paths, user homes, POSIX runtime paths, temporary paths, `file://`, local username tokens, parent traversal, external URLs, `NOT_EXPOSED`, absolute ZIP entries, backslash ZIP entries, and ZIP traversal entries. Repository-relative and pack-relative references remain allowed.

`scripts/verify-g3-2-2-google-static-review-pack-hygiene.mjs` scans the complete authoritative staging or extracted ZIP tree, including final summaries and integrity evidence, and compares independent counts with the internal reports. A dirty result is fail-closed and cannot receive `AWAITING_EXTERNAL_OUTPUT_REVIEW`.

`scripts/verify-g3-0-7-google-static-review-pack-path-hygiene.mjs` verifies the source correction, positive and negative policy fixtures, late-added evidence rejection, the historical rejected-candidate diagnostic, final-tree scan behavior, and all frozen invariants. It does not generate G3.2.3 output.

## Regression coverage

The review-pack policy integration tests cover basename-only and pack-relative references, repository-relative canonical-request links, each required local-path/privacy/URL/traversal class, ZIP entry hygiene, and a late-added `manifests/g3-0-6-completion-evidence.json` absolute-path injection. The late-added case must make the final pack gate non-zero; it is not allowlisted or excluded.

## Invariants

- Canonical document remains 1.31.1.
- Desktop/package remains 0.13.1.
- Renderer Core, Validator, export manifest, profile geometry, placement, encoder settings, and Golden registries are unchanged.
- Google, Kakao, NAVER, and META frozen output changes remain zero.
- Runtime network access remains prohibited and PLUME dependencies remain empty.
- G3.1 acceptance/freeze records remain unchanged.
- G3.2.3 is not started; this record only authorizes the next phase after all gates pass.

## Reproducible commands

```text
pnpm generate:g3-0-7-review-pack-evidence
pnpm verify:g3-0-7-google
pnpm verify:g3-2-2-pack-hygiene <extracted-pack-or-zip>
pnpm check
pnpm verify:handoff
```

