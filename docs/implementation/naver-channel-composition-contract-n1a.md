# N1A Implementation Boundary

N1A implements the contract surface only. The exported capability helpers are
`isChannelId`, `isCompositionMode`, `isArtifactCardinality`,
`isNaverGfaPlacement`, `validateChannelPlacementCapability`,
`materializeFormatProfileCapability`, and `guardCompositionDispatch`.

`contracts/channel-capabilities.json` is a semantic catalog. It intentionally has no
canvas dimensions, coordinates, PSD paths, font files, icon digests, or Golden image.
The only production raster profiles remain the existing Kakao and FREEFORM entries.

The Core FREEFORM path treats an omitted composition mode as the legacy
`RENDERER_COMPOSED` default. An explicitly `PLATFORM_COMPOSED` profile is rejected
before asset loading and cannot create or publish an output artifact.

N1B owns the evidence-backed SmartChannel template contract. Later phases own Naver
component schemas, Feed/Collection orchestration, and Desktop UI.
