# Renderer Integration Adapter

The adapter is implemented in `packages/renderer-contract/src/index.ts` as `renderWithIntegrationAdapter`.

1. Validate the Integration Input and selected Capability.
2. Resolve the referenced asset through `RendererAssetResolver`.
3. Compute the actual SHA-256 and inspect PNG MIME, dimensions, and alpha channel. Declared values are assertions, not trusted metadata.
4. Resolve the one placement plan without inventing crop values. Candidate crop rectangles are copied verbatim into the applied plan; no candidate is generated or re-ranked.
5. Map the valid OBJECT_RIGHT request to the legacy Core Input shape (`KAKAO_MOMENT / BIZBOARD / OBJECT_RIGHT`, CTA `NONE`, `1.2.0` canvas) through the injected `renderLegacy` boundary.
6. Validate the returned PNG contract and create `RendererIntegrationOutputV1`. The artifact checksum is computed from the returned bytes.

The injected boundary keeps this package independent of the concrete Core implementation. The existing Core/CLI path remains the source of the current Golden pixels. A future Desktop or integration adapter supplies a resolver and a legacy render callback; neither requires a Plume or OpenAI dependency.

Any ERROR returns `BLOCKED`, an empty applied-placement list, and no artifact metadata. The adapter does not repair input, clamp geometry, infer copy, or publish files.
