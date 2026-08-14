# META Desktop QA Request Context + Preview Bridge — M2.2a

## Scope and baseline

M2.2a is a Desktop QA-harness hotfix on top of M2.2. It does not redesign the
FREEFORM renderer, change CreativeLayoutPlan, add a platform mockup, or freeze META
Goldens. The M2.2 Core contract remains the source of truth:

- `placementContext` belongs to the Render Request, not `CreativeLayoutPlan`.
- A vertical request with no context resolves to `null` / `DEFAULT_NONE`.
- Stories validation is routed only for Stories contexts.
- Reels uses `SOURCE_REQUIRED` INFO metadata only; geometry is not guessed.

Canonical document, Core, input, output, and template versions remain unchanged in
this phase. The Desktop/package patch advances from `0.10.0` to `0.10.1`.

## Root causes and fixes

### Feed Safe Zone message

The Desktop editor used the generic Safe Zone fallback for META profiles even when
the selected context was Feed. The QA bridge now derives guide capability from the
selected META profile/context pair. Feed Square and Feed Portrait hide the guide and
do not render the missing-geometry message. Stories exposes the existing 14% / 20%
advisory guide. Reels disables the guide and shows the existing `SOURCE_REQUIRED`
INFO hint without inventing coordinates.

### Preview no-op

Preview results are now classified visibly as `PREVIEW_RENDERED`,
`VALIDATION_BLOCKED`, or `RUNTIME_ERROR`. The async IPC handler catches schema,
asset, validator, and renderer failures and writes a stable code/message to the UI.
The Core in-memory manifest is carried through the Desktop preview response for
read-only QA inspection. A successful render can therefore be reviewed without
performing a publish/export.

The META E2E harness waits for the asynchronous asset-selection IPC result before
starting Preview. This closes a race where an in-flight image selection could apply a
late Plan update and correctly mark an otherwise valid Preview stale.

The bridge also compares the returned request sequence with the current request
sequence. A late result is rejected visibly as `VALIDATION_BLOCKED` with
`DESKTOP-PREVIEW-003`, rather than leaving an `IDLE`/silent canvas.

### Request/Plan boundary

The editor displays a `Canonical META Render Request` panel containing the selected
`formatProfileId`, nullable `placementContext`, imported/edited Plan, and output
options. The Plan textarea remains a Plan-only editor. Import rejects a root-level
`placementContext` with `KBR-FREEFORM-PLAN-SCHEMA-INVALID` and remediation text,
then preserves placement policy, fit mode, crop rectangle, bounds, z-index, and
opacity when a valid Plan is imported.

## UI capability matrix

| Profile/context | Guide | Validator/manifest behavior |
| --- | --- | --- |
| Feed Square/Portrait + Feed or `null` | Disabled | No Stories warning, no Reels INFO |
| Vertical + Stories | Enabled | 14% top / 20% bottom advisory; warning-only semantics |
| Vertical + Reels | Disabled | `SOURCE_REQUIRED` INFO; no guessed geometry |
| Vertical + `null` | Disabled | `DEFAULT_NONE`; no Feed default, Stories warning, or Reels INFO |

Context options are sourced from `src/core/meta-placement-context.ts`; incompatible
profile/context pairs are disabled and are also fail-closed in the preview builder.

## Manifest viewer

After Preview, `Last Render Manifest` is displayed separately from
`Imported CreativeLayoutPlan JSON`. The viewer exposes `formatProfileId` and both
`metaStaticReport.placementContextResolution.requested` and `.resolved`. It is
read-only and does not become a second input source.

## Verification and acceptance

Required M2.2a evidence is under `artifacts/m2-2a/`:

- request state and builder audits
- Safe Zone capability matrix
- Preview outcome/error handling audit
- Plan-versus-manifest separation audit
- profile/context state-switching audit
- regression summary

`tests/e2e/meta-static.spec.ts` covers Feed Square, Feed Portrait, Stories, Reels,
vertical `null`, the Safe Zone matrix, manifest context, imported crop/placement
fidelity, and invalid Plan roots. META candidate status remains
`CANDIDATE_NOT_APPROVED`; manual acceptance remains `NOT_REVIEWED` and no Golden is
frozen.

## Out of scope

No plume dependency, remote service, network request, platform upload, Core geometry
change, CreativeLayoutPlan schema change, Reels geometry guess, or Golden approval is
introduced by M2.2a.
