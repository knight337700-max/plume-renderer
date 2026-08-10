# ADR-0056: SmartChannel final-alpha object normalization

- Status: Accepted for N7.4
- Date: 2026-08-10
- Scope: NAVER SmartChannel object validation only

## Context

Raw transparent object images are not template-sized canvases. Comparing their source canvas
or source-space bounds with a frozen template rejects valid sofa/logo assets and can select the
wrong left/right region.

## Decision

Normalize in final render space: detect alpha bounds, trim, contain-fit into the 260×160 DA 160
limit (max 1.5× upscale), place using the selected template region, then validate final bounds
and final alpha pixel count. Keep a compatibility branch only for exact legacy precomposed
template canvases. The persisted SmartChannel report records sourceCanvas, alphaBounds,
normalizedSize, finalBounds, targetRegion, opaquePixelCount, and maxOpaquePixelCount.

## Consequences

Raw source canvas dimensions no longer produce a dimension error by themselves. Final oversized,
translated, or >29,120-pixel object results still fail deterministically. Coordinates and the
Kakao/FREEFORM contracts are unchanged.
