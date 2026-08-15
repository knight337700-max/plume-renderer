# Google Static Transform & Raster Export Parity — G3.0.3

Status: IMPLEMENTED (G3.0.3 only; G3.1 acceptance/freeze not performed)

## Baseline and scope

- Baseline commit: `b1b001bcce893ef7a97017be202323026eda297a`
- Baseline Canonical: `1.28.1`, SHA-256 `9c78a538618a31460d7f0b402bfd006858334687bd0de92a5e3769d678cc2ab5`
- Target Canonical: `1.29.0`
- Target Desktop/package: `0.12.0`
- Frozen G2.1 registry SHA-256: `00dabc5d94ffc0c225d17d22b3b5527d0b0c7488aa11495da4a79e1327d37359`
- `OBJECT_RIGHT.png` SHA-256 remains `33204a082327bf14fead6dbc50fd2139f46f7f7156d14ac221c3212368927a3b`.

No upload/API/OAuth, platform screenshot, remote asset, network, Plume, G3.1 review, acceptance, or
freeze artifact was added.

## Source-of-truth and parity inventory

| Item | Existing evidence | G3.0.3 implementation |
|---|---|---|
| Placement model | `packages/renderer-contract/src/index.ts` `ImagePlacementPlan`, normalized crop/focal/anchor rules | Google request has optional `placementPlan`; marketing drag/zoom serializes `MANUAL_CROP` and `cropRect`; logo/uploaded retain profile policy and use bounded destination rect |
| PNG | `src/core/google-static-render.ts` pinned PNG options | Reused without changing G2 defaults |
| JPEG | `src/core/raster.ts` and G2 Sharp options | Reused deterministic `quality=88`, `4:2:0`, progressive false, mozjpeg false; no quality slider |
| Canonical identity | G3.0.2 shared builder and Main stale guard | Builder normalizes placement, format, finite numeric values, and metadata; Preview/Export call the same builder |
| UI | Existing Google profile/asset/plan/Preview/Export flow | Format selector, normalized X/Y/Scale, drag surface, zoom controls, Reset, STALE state |
| Validation | Google artifact validator and Core plan validation | IPC strict schema plus Main/Core placement/policy/asset digest checks and actual encoded bytes |

### Format matrix

`contracts/google/format-capability.g3-0-3.json` records all 14 runtime profiles. Each profile
allows PNG and JPEG; its default is the MIME of the corresponding G2.1 Frozen Golden. PNG uses
`.png` and JPEG uses `.jpg`. This is an additive Desktop capability record; the frozen G1 profile
meaning is not changed.

## Request and raster path

```text
GoogleStaticEditor state
  -> buildCanonicalGoogleStaticRequest
  -> preload IPC strict schema
  -> Main buildCanonicalGoogleStaticRequest
  -> placementPlan validation + normalized crop conversion
  -> renderGoogleStaticCandidate (Core)
  -> actual PNG/JPEG signature, canvas, MIME and byte-cap validation
  -> PASS preview identity + bytes
  -> Export repeats the same builder/render and compares identity + bytes
```

The preview surface only receives pointer events and updates canonical values. CSS transforms,
handles, grids, checkerboards, and borders are never captured or passed to Core. A format or
placement change invalidates the previous PASS result and requires a new Preview/Validator run.

## Version decisions

| Contract | Previous | Current | Reason |
|---|---:|---:|---|
| Canonical document | 1.28.1 | 1.29.0 | G3.0.3 production parity contract |
| Desktop/package | 0.11.1 | 0.12.0 | New Google transform and raster controls |
| Google architecture | 1.0.0 | 1.0.0 | frozen architecture reused |
| Renderer Core | 0.11.0 | 0.11.0 | existing renderer/encoder reused; only fail-closed format guard is additive implementation detail |
| Validator | 1.11.0 | 1.11.0 | existing canvas/MIME/byte-cap rules reused |
| Input/Output/Manifest/Response | 1.2.0/2.0.0/1.0.0/1.0.0 | unchanged | legacy schemas remain compatible |
| Error registry | 1.10.0 | 1.10.0 | existing stale/download and Google diagnostics reused |

## Verification plan

- `pnpm verify:g3-0-3-google`
- `pnpm verify:g3-0-2-google`
- `pnpm verify:g3-0-1-google`
- `pnpm verify:g3-google`
- `pnpm verify:contract`
- full `pnpm check`
- Vitest integration coverage for PNG/JPEG, stale format/placement, and Preview/Export bytes
- actual Electron Playwright coverage for format switch, drag, zoom, numeric controls, and Reset
- final handoff verifier and source SHA match

The G2.1 Frozen Golden registry is never regenerated. Default plans continue to render all 14
Frozen Golden bytes exactly.
