# Google Static Desktop QA Enablement (G3)

Status: IMPLEMENTED · Phase `G3_GOOGLE_STATIC_DESKTOP_QA_ENABLEMENT`

## Scope

This phase adds a local Desktop QA surface for the fourteen G2.1-frozen Google Static profiles.
The surface is deliberately additive: KAKAO, NAVER, and META routing remains unchanged, and the
frozen Google profile, target, diagnostic, core-render, validator, and Golden contracts remain the
source of truth.

The UI groups profiles as follows:

- Geometry: seven profile IDs from `static-asset-profiles.g1.json`.
- Uploaded Display Static: seven profile IDs from the same registry.

Every request has one explicit `GoogleStaticCandidateRenderPlan`. The Main/Core boundary resolves
the local asset token, loads the G1 contracts, renders the plan, validates the encoded artifact,
and stores a preview only when there are no ERROR diagnostics. The output folder is a Desktop
trusted-root token. Publish uses the existing staging/flush/close/same-volume rename helper and
does not overwrite an existing result.

## Metadata and pixels

`deliveryMetadata` is an explicit metadata-only object. It is included in the request identity so
stale previews cannot be exported after a delivery change, but it is never passed to
`renderGoogleStaticCandidate` and cannot change raster bytes. The UI labels this boundary and does
not render platform-owned fields or Google platform chrome.

## QA controls

- `Fit` scales the artifact to the available preview surface.
- `100% actual pixels` uses the profile's encoded width and height as CSS pixels in a scrollable
  surface.
- Diagnostics show severity, frozen code, localized message key, and input path. INFO notes are
  visible but do not disable Export.
- Export is disabled until a fresh Preview exists, the Validator has zero ERRORs, and a trusted
  output directory is selected.

## Exclusions and known limits

Google Ads upload/API, OAuth, telemetry, remote fonts, update checks, platform screenshot chrome,
and runtime network access are out of scope. This is not an assertion of Google policy approval.
The G3 UI provides project preset labels and an editable explicit plan; the G2.1 Golden files are
not rewritten by the Desktop flow.

## Verification

`scripts/verify-g3-google-static-desktop-qa.mjs` verifies version lineage, exact frozen registry
hash, all fourteen Golden source/plan/render identities, profile grouping, active diagnostics,
message keys, OBJECT_RIGHT reference integrity, Desktop scope, and the zero-legacy-profile rule.
