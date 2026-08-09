# ADR-0048: Freeze NAVER SmartChannel Object Placement Contract

- Status: Accepted
- Date: 2026-08-10
- Phase: N2A

## Context

The N2 SmartChannel template engine had a 120-template source registry and frozen
object/text regions, but no contract for how a user object asset enters a PSD-defined
object frame. Reusing Kakao or FREEFORM fit/crop semantics would be an unverified
cross-channel assumption.

## Decision

Add a channel-scoped source-backed placement registry. STANDARD uses a pre-composed
full-canvas 1:1 input with no clip. THUMBNAIL uses the source vector mask as a fixed
slot-local frame (195×130, 210×140, or current 200×200). PERSON_MOVIE is separate:
160 uses its positioned pixel-layer canvas boundary; 200/280 use the PSD Smart Object
frame and exact `PLACED_LAYER2` transform. Every template receives a deterministic
`objectPlacementToken`.

No automatic trim, crop, focal crop, resize, background removal, padding, or left/right
mirror generation is permitted. Unknown source semantics remain unresolved and reject
runtime start. This ADR changes contract metadata only; it does not implement rendering,
Golden PNGs, or Desktop UI.

## Consequences

- 39 placement tokens and 120 mappings unblock N2 representative policy checks.
- 200B right thumbnail source path variants remain separately evidenced rather than
  silently normalized.
- SmartChannel-scoped template contract moves from 1.9.0 to 1.10.0; registry/schema
  moves from 1.3.0 to 1.4.0. Global Kakao/FREEFORM core remains 1.9.0.
- Future Renderer work must consume tokens and must not invent a fitting heuristic.

## Evidence

`contracts/naver-smartchannel-object-placement.json` records the 120-PSD audit,
mask path digests, Smart Object frame sizes/transforms, and representative candidate
proof. The official guide is [NAVER SmartChannel guide](https://ads.naver.com/adguide/1475).
