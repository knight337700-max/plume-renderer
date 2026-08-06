# THUMBNAIL_BOX_RIGHT Rendering Implementation

The Core renderer decodes the resolved asset to RGBA with Sharp, resolves a normalized Crop Rect through the Integration Contract, and resizes it with a deterministic cover scale. Oversized pixels are selected using the requested anchor; the resulting 315×186 RGBA tile is composited through a 12px rounded mask at `(666,36)`. Text is rendered with the pinned Spoqa Han Sans assets at the existing C2a baselines. The gray guide and `Image` label from the tool fixture are never rendered.

The Adapter validates capability, policy, asset token/checksum/dimensions, crop/candidate consistency, and Subject Protection before invoking this renderer. The renderer returns an `AppliedImagePlacement` with resolved normalized and pixel crops, destination rectangle, scale, anchor, and `changedFromRequestedPlan: false`. Preview stores the exact returned PNG bytes; Export re-runs the same Adapter and publishes atomically through the existing staging path.

The implementation does not infer a crop, generate Candidates, detect subjects, call a remote service, or modify the source asset. Unsupported templates remain blocked by the Capability Registry.
