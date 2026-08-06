# Renderer Integration Adapter

The adapter is implemented in `packages/renderer-contract/src/index.ts` as `renderWithIntegrationAdapter`.

1. Validate the Integration Input and selected Capability.
2. Resolve the referenced asset through `RendererAssetResolver`.
3. Compute the actual SHA-256 and inspect PNG/JPEG bytes, extension/MIME agreement, dimensions after EXIF orientation, decoder success, and alpha policy. Declared values are assertions, not trusted metadata.
4. Resolve the one placement plan without inventing crop values. Candidate crop rectangles are copied verbatim into the applied plan; no candidate is generated or re-ranked.
5. Dispatch OBJECT_RIGHT through the injected legacy Core boundary, or dispatch THUMBNAIL_BOX_RIGHT through the injected thumbnail renderer with its resolved Crop Rect and Candidate provenance.
6. Validate the returned PNG contract and create `RendererIntegrationOutputV1`. The artifact checksum is computed from the returned bytes.

The injected boundaries keep this package independent of the concrete Core implementation. The existing Core/CLI path remains the source of the OBJECT_RIGHT Golden pixels; the C4 thumbnail renderer uses the same serialized plan for Preview and Export. `OBJECT_RIGHT` accepts only alpha PNG; `THUMBNAIL_BOX_RIGHT` accepts PNG/JPEG without requiring alpha. A Desktop or integration adapter supplies a resolver and the applicable render callback; neither requires a Plume or OpenAI dependency.

Any ERROR returns `BLOCKED`, an empty applied-placement list, and no artifact metadata. The adapter does not repair input, clamp geometry, infer copy, or publish files.
