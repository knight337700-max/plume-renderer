# Google Static verification gate and cross-channel regression repair (G3.0.6)

Status: COMPLETED · authoritative G3.2.1 case traceability resolved from the verified review archive

## Baseline reproduction

The requested baseline was present at `69994ba31af528d224d8b2fc665be4abfc2245b9` with a clean tracked
working tree. Before edits, G0.1 reported 20/21 and G3.0.4 reported 66/67 because the G3.0.5 geometry
helper and review evidence were not in their exact historical allowlists. G3.0.5 itself reported 13/13.
The retry-0 Electron suite reported 38/48: one Freeform strict-locator failure and nine NAVER cases
whose only captured stderr was Node's `NO_COLOR`/`FORCE_COLOR` warning.

## Root causes and minimal repairs

- `scripts/verify-g0-1-google-architecture-freeze.mjs` now has an exact one-file G3.0.5 production
  allowlist for `apps/desktop/renderer-ui/src/features/google/google-preview-geometry.ts`.
- `scripts/verify-g3-0-4-google-static-geometry-placement-manifest.mjs` resolves frozen files from the
  accepted baseline with exact path sets. The G3.0.5 Google evidence file is no longer classified as a
  KAKAO/NAVER/META frozen-path change.
- NAVER's Electron test launch normalizes `FORCE_COLOR=0` and removes `NO_COLOR`, preventing a Node
  diagnostic from being treated as a renderer error. No runtime channel code or assertion was weakened.
- The Electron harness used a shared default user-data directory and only closed the root process. That
  left descendant GPU/network processes behind and caused intermittent Windows worker crashes. Every
  production test launch now uses an isolated user-data directory and the test-only close helper terminates
  the owned process tree after the normal close. The launch also disables GPU acceleration for this
  headless Windows verification path; no production runtime setting changed.
- NAVER Feed IMAGE asset selection is asynchronous. The test now waits on the selected asset metadata span
  (not the static rule/canvas text) before requesting validation, so the 16:9 asset cannot be validated
  against a previous token.
- The Freeform asset assertion is exact, selecting the option text rather than the duplicate status notice.
- G3.0.5 UI coverage now asserts that Fit/Actual and resize preserve canonical request, render fingerprint,
  and placement plan, and sends a wheel event to every locked Uploaded Display profile as a no-op.
- A controller-level G3.0.6 test covers deterministic PNG/JPEG export bytes across five representative
  Geometry and Uploaded Display profiles.
- The verified `google-g3-2-1-final-output-pack-d23bd344-2.zip` is 15,391,331 bytes with SHA-256
  `eaba20cbfe073a2166b6be6738be62862f8acad8dcea5bb9cc1d141c4083075c`. Its central directory,
  `pack-manifest.json`, `SHA256SUMS.txt`, final summary, 11 case JSON files, 11 canonical requests,
  and 11 render requests all passed digest and cross-reference checks.

## Final stability evidence

After the repairs, the same production desktop build completed two consecutive retry-0, one-worker
Playwright runs with 48/48 tests passed in each run. The targeted NAVER Feed IMAGE test also passed in
five repeated executions. Vitest completed 296/296, including the new controller determinism and review-pack path-policy tests.
The full `pnpm check` completed with exit code 0, G3.0.5 completed 13/13, and the existing handoff
verifier completed 139/139 with `MANIFEST.json.sourceSha` equal to the unchanged repository HEAD.

The dedicated G3.0.6 verifier now completes 11/11 checks. D02–D06 are linked to the constrained viewport
test; T03–T08 are linked to the transform test; T03, T05, and T08 additionally link to pointer parity.
The traceability record is explicitly non-normative and scoped only to executed case IDs and inputs.

The review-pack contract test uses an in-memory canonical-request fixture and verifies zero absolute
Windows paths, `file://`/external URI findings, `NOT_EXPOSED` placeholders, valid relative links, and
parent traversal rejection. Official G3.2.2 ZIP path hygiene remains deferred to that phase.

## Authority resolution

`artifacts/g3-0-6/google-static-case-traceability.json` records all 11 mappings from the verified archive,
including repository-relative source path, source SHA-256, format, placement/target, canonical request,
render request, connected test title, case evidence digest, and archive SHA-256. The record contains
`normative: false`, authority scope `CASE_ID_AND_EXECUTED_INPUT_TRACEABILITY_ONLY`, and evidence class
`NON_NORMATIVE_REVIEW_EVIDENCE`; it does not change any renderer contract.

Canonical 1.31.1 and Desktop/package 0.13.1 remain unchanged because only verifier, test, and documentation
behavior was edited; no normative runtime behavior or raster contract changed.
