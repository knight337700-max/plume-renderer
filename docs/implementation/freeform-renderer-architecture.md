# FREEFORM Renderer Architecture

상태: `CONTRACT_FROZEN`, F1에서 내부 `KBR_FREEFORM_CONTRACT_TEST_1029X258`
Profile에 한해 deterministic Core Raster가 구현되었다. 이 상태는 카카오의 공식
FREEFORM 규격 승인이나 Native 1200 지원을 의미하지 않는다.

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
  └─ FREEFORM Core Raster (F1, test Profile only)
       ├─ normalized bounds → pixel rect
       ├─ stable zIndex composite
       ├─ IMAGE / LOGO placement primitives
       ├─ TEXT NO_WRAP / EXPLICIT_NEWLINES
       ├─ RGBA PNG encode
       └─ appliedElements + fingerprints + atomic publish
```

## Adapter boundary

`TEMPLATE_LOCKED`는 현재 `ImagePlacementPlan`과 Template Registry adapter를 그대로
사용한다. FREEFORM은 Template Slot을 만들지 않고 Plan element bounds를 그대로
검증한다. 두 모드 사이에서 자동 layout, copy generation, image recommendation,
automatic crop inference, OpenAI/Plume/Queue/DB/remote call은 수행하지 않는다.

## Current capability status

| 기능 | F0 상태 |
|---|---|
| CreativeLayoutPlan schema/types/validation | FROZEN; runtime validation active |
| PNG output profile | IMPLEMENTED for internal 1029×258 test Profile |
| JPG output | NOT_IMPLEMENTED |
| Shape raster | CONTRACT_ONLY; explicit NOT_SUPPORTED error |
| Native 1200 | CATALOG_NOT_READY |
| Drag/resize Renderer Lab | EXCLUDED |
| WORD_WRAP | NOT_IMPLEMENTED; explicit NOT_SUPPORTED error |
| IMAGE / LOGO raster | ALPHA_TRIM_CONTAIN, CENTER_CONTAIN, SEMANTIC_CROP_COVER, MANUAL_CROP |
| TEXT raster | NO_WRAP, EXPLICIT_NEWLINES; ERROR/CLIP overflow |

## F1 dispatch and publish boundary

`createKakaoBizboardRenderer().render()` resolves `layoutMode` before legacy schema
execution. Omitted `layoutMode` continues down the unchanged `TEMPLATE_LOCKED` path;
`layoutMode: FREEFORM` requires a `CreativeLayoutPlan`, an exact loaded FormatProfile,
registered font digests, and project-relative asset references. FREEFORM never creates
Template slots or `imageSlotId` values.

F1 uses the existing RGBA PNG encoder and atomic staging publisher. It writes a manifest
only after validation has zero errors; the manifest contains `appliedElements`,
`pixelFingerprint`, and `requestFingerprint`, but never a digest of itself. Any validation
error returns a blocked response and leaves no final PNG or manifest.
