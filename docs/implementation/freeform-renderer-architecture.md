# FREEFORM Renderer Architecture

상태: `CONTRACT_FROZEN`, F4에서 Registry-driven multi-profile FREEFORM Renderer
Lab UI와 Desktop Core bridge가 구현되었다. 이 상태는 카카오의 공식 업로드 승인이나
디자인 의미 적합성 보장을 의미하지 않는다.

```text
Agent/User
  └─ CreativeLayoutPlan (v1.0.0, serializable JSON)
       ├─ FormatProfile identity
       ├─ CanvasBackground
       └─ CreativeElement[]
            ├─ IMAGE / LOGO → ImagePlacementSpec (no imageSlotId)
            ├─ TEXT → fontId + canonical color + wrap/overflow
            └─ SHAPE → RECTANGLE / ELLIPSE (contract-only)

Renderer boundary
  ├─ Schema + KBR error mapping
  ├─ FormatProfile identity and capability validation
  ├─ deterministic Font Registry / asset digest validation
  ├─ canonical JCS + pixel/request fingerprint material
  └─ FREEFORM Core Raster (F1 test Profile + F3A fixed catalog Profiles)
       ├─ normalized bounds → pixel rect
       ├─ stable zIndex composite
       ├─ IMAGE / LOGO placement primitives
       ├─ TEXT NO_WRAP / EXPLICIT_NEWLINES
       ├─ RGBA PNG encode
       ├─ deterministic JPEG encode (sRGB, 4:2:0, no metadata, non-progressive)
       ├─ Channel Compliance safe-zone / allowlist / opacity / byte gates
       └─ appliedElements + fingerprints + atomic publish

Desktop Renderer Lab boundary (F4)
  ├─ Layout Mode: TEMPLATE_LOCKED | FREEFORM
  ├─ Registry-driven 14-profile selector; Scroll disabled
  ├─ CreativeLayoutPlan editor: background, IMAGE/TEXT/LOGO, normalized geometry
  ├─ Safe Zone metadata overlay (UI-only) + Core issue/manual-review panels
  ├─ strict IPC: asset tokens, plan, output format/quality; no absolute paths
  └─ fresh Preview gate → Core revalidation → PNG/JPEG + manifest atomic publish
```

## Adapter boundary

`TEMPLATE_LOCKED`는 현재 `ImagePlacementPlan`과 Template Registry adapter를 그대로
사용한다. FREEFORM은 Template Slot을 만들지 않고 Plan element bounds를 그대로
검증한다. 두 모드 사이에서 자동 layout, copy generation, image recommendation,
automatic crop inference, OpenAI/Plume/Queue/DB/remote call은 수행하지 않는다.

## Current capability status

| 기능 | F4 상태 |
|---|---|
| CreativeLayoutPlan schema/types/validation | FROZEN; runtime validation active |
| PNG output profile | IMPLEMENTED for internal + fixed catalog Profiles |
| JPEG output | IMPLEMENTED; explicit Sharp/libvips quality ladder |
| Shape raster | CONTRACT_ONLY; explicit NOT_SUPPORTED error |
| Kakao fixed Format Catalog | 14 IMPLEMENTED Profiles; Scroll catalog-only |
| Desktop multi-profile FREEFORM Lab | IMPLEMENTED; plan editor and Core bridge |
| Drag/resize Renderer Lab | EXCLUDED; direct normalized decimal editing only |
| WORD_WRAP | NOT_IMPLEMENTED; explicit NOT_SUPPORTED error |
| IMAGE / LOGO raster | ALPHA_TRIM_CONTAIN, CENTER_CONTAIN, SEMANTIC_CROP_COVER, MANUAL_CROP |
| TEXT raster | NO_WRAP, EXPLICIT_NEWLINES; ERROR/CLIP overflow |

## F1/F3A dispatch and publish boundary

`createKakaoBizboardRenderer().render()` resolves `layoutMode` before legacy schema
execution. Omitted `layoutMode` continues down the unchanged `TEMPLATE_LOCKED` path;
`layoutMode: FREEFORM` requires a `CreativeLayoutPlan`, an exact loaded FormatProfile,
registered font digests, and project-relative asset references. FREEFORM never creates
Template slots or `imageSlotId` values.

F1 uses the existing RGBA PNG encoder and atomic staging publisher. F3A adds explicit
deterministic JPEG encoding and Profile byte/alpha gates. It writes a manifest
only after validation has zero errors; the manifest contains `appliedElements`,
`pixelFingerprint`, and `requestFingerprint`, but never a digest of itself. Any validation
error returns a blocked response and leaves no final PNG or manifest.

## F2/F3A validator and evidence boundary

```text
FREEFORM request
  ├─ PRE_RENDER: shape/profile/plan/assets/fonts/unsupported features
  │    └─ ERROR → no raster, no PNG, no staging/publish/download
  ├─ raster (F1/F3A path)
  └─ POST_RENDER: PNG/JPEG decode, canvas/bytes/alpha/appliedElements/checksum
       └─ ERROR → no publish/download
```

`src/core/freeform-validator.ts` owns the staged validation primitives. F3A Profile metadata
adds safe-zone and element allowlist checks. The raster path
creates `appliedElements` and the POST_RENDER validator checks that same evidence; it does not
reconstruct a second layout. All FREEFORM issues carry a stage and stable KBR code. Absolute
filesystem paths, AJV-native prose, aesthetic warnings, auto layout, clamp, crop inference,
font fallback and auto-shrink are outside the boundary. Legacy TEMPLATE_LOCKED dispatch and
Golden bytes are not routed through the new stage metadata by default. Baked IMAGE semantics
remain manual review; no OCR/CV/LLM inference is performed.

## F4 UI/IPC invariants

The renderer UI imports the same `contracts/freeform-format-profiles.json` metadata used
by Core; it does not maintain a second list of official formats. The public Desktop IPC
schema is strict at the envelope and allows only UUID asset tokens, a serializable
`CreativeLayoutPlan`, profile ID, and explicit PNG/JPEG output settings. Controller code
resolves those tokens to session-relative files before calling `renderFreeform`, so no
absolute path crosses the UI boundary. The existing Template Locked selectors and IPC
payloads remain untouched by the Freeform branch.
