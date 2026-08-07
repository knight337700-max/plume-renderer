# FREEFORM Renderer Architecture (Contract-Only)

상태: `CONTRACT_FROZEN`, 실제 FREEFORM raster 구현은 시작하지 않았다.

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
  └─ (후속 Phase) deterministic PNG raster and artifact publish
```

## Adapter boundary

`TEMPLATE_LOCKED`는 현재 `ImagePlacementPlan`과 Template Registry adapter를 그대로
사용한다. FREEFORM은 Template Slot을 만들지 않고 Plan element bounds를 그대로
검증한다. 두 모드 사이에서 자동 layout, copy generation, image recommendation,
automatic crop inference, OpenAI/Plume/Queue/DB/remote call은 수행하지 않는다.

## Current capability status

| 기능 | F0 상태 |
|---|---|
| CreativeLayoutPlan schema/types/validation | FROZEN |
| PNG output profile | Contract-only; existing encoder reusable later |
| JPG output | NOT_IMPLEMENTED |
| Shape raster | CONTRACT_ONLY |
| Native 1200 | CATALOG_NOT_READY |
| Drag/resize Renderer Lab | EXCLUDED |

