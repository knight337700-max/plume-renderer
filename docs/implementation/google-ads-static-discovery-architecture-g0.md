# Google Ads Static Capability Discovery and Renderer Architecture — G0

## Decision

G0 adds an architecture-only Google Ads capability boundary. It does not add Google
format profiles to the runtime registry, renderer code, Validator behavior, Desktop UI,
goldens, or upload integration. The repository was available at the exact requested
baseline, so the source prompt's unavailable-repository placeholder is resolved here as
`APPLIED_ARCHITECTURE_ONLY`.

## Baseline and frozen channels

- Baseline commit: `be0c4198e5f1d4b433f9654409021db34710e29c`
- Working tree at baseline: clean
- Existing frozen channels: KAKAO, NAVER, META_STATIC
- Frozen output changes: zero
- Runtime network access: prohibited
- Plume dependencies: none

The G0 architecture is additive documentation and machine-readable discovery metadata.
It deliberately does not create `GOOGLE_*` entries in the active FREEFORM format-profile
registry or add Google fixtures/goldens.

## Capability boundary

Google Ads is represented as separate delivery capabilities rather than one
`GOOGLE_STATIC` profile:

| Capability | Lifecycle | Composition | Delivery |
| --- | --- | --- | --- |
| `GOOGLE_RDA_ASSET_SET` | TRANSITIONAL | PLATFORM_COMPOSED | COLLECTION |
| `GOOGLE_PMAX_ASSET_GROUP_STATIC` | ACTIVE | PLATFORM_COMPOSED | COLLECTION |
| `GOOGLE_DEMAND_GEN_SINGLE_IMAGE` | ACTIVE_EVOLVING | PLATFORM_COMPOSED | COLLECTION |
| `GOOGLE_DEMAND_GEN_UPLOADED_DISPLAY_STATIC` | ACTIVE_EVOLVING | RENDERER_COMPOSED | COLLECTION |
| `GOOGLE_LEGACY_UPLOADED_DISPLAY_STATIC` | TRANSITIONAL | RENDERER_COMPOSED | COLLECTION |
| `GOOGLE_DEMAND_GEN_CAROUSEL` | ACTIVE_EVOLVING | PLATFORM_COMPOSED | DEFERRED |
| `GOOGLE_SEARCH_IMAGE_ASSET` | ACTIVE | PLATFORM_COMPOSED | DISCOVERY_ONLY |

Every image remains a `SINGLE` artifact. RDA, PMax, and Demand Gen delivery sets are
separate collection manifests. Renderer-owned pixels are image/logo pixels and the full
uploaded-static canvas; Google owns text, CTA, URL, serving composition, and preview UI.

## Geometry and size policy

The G0 asset geometry registry separates official ratio/minimum/recommendation metadata
from explicit project output presets. Presets are not claimed as mandatory Google pixel
sizes. The architecture records 1.91:1, 1:1, 4:5, RDA 9:16, Demand Gen 9:16, square logo,
landscape logo, seven Demand Gen uploaded-display recommended canvases, and the legacy
supported canvas list. All entries remain `PROPOSED_NOT_RUNTIME`.

Renderer G1 output is limited to PNG/JPEG. GIF may be platform-accepted for some targets,
but the Renderer does not emit GIF. Project byte caps are explicit decimal-byte decisions:
5,120,000 for RDA/PMax, 5,000,000 for Demand Gen marketing images, and 150,000 for
Demand Gen logos and uploaded display static. Official byte semantics remain unresolved
where the source says “KB”.

## Validation and provenance

The architecture separates `ARTIFACT`, `DELIVERY_SET`, and `PLATFORM_INTEGRATION` layers.
Artifact and delivery-set diagnostics may block local publish/download; Google account
eligibility, policy review, campaign creation, and upload behavior remain platform-owned.
All discovery sources are Google official domains. Source discrepancies and unresolved
rules fail closed: RDA vertical remains optional, Demand Gen/RDA safe-zone geometry is
INFO/source-required, no sunset date is invented, and no universal logo minimum is claimed.

## Out of scope

G0 does not implement Plume/Agent/Queue/Railway/database/cloud storage, Google upload
APIs, video, dynamic feeds, Merchant Center assembly, carousel UI, HTML5/AMPHTML bundles,
GIF animation, preview screenshots as final artifacts, Search image assets in G1, or exact
9:16 safe-zone enforcement.

## Machine-readable records

- `contracts/google/provenance.g0.json`
- `contracts/google/architecture.g0.json`
- `contracts/google/capabilities.g0.json`
- `contracts/google/asset-geometry.g0.json`
- `contracts/google/delivery-contracts.g0.json`
- `contracts/google/diagnostics.g0.json`
- `artifacts/g0/google-static-discovery-verification.json`
- `scripts/verify-g0-google-static.mjs`

## G1 gate

G1 requires the exact baseline lineage, clean frozen-channel regressions, acceptance of
this architecture, zero runtime network requests, and zero Plume dependencies. G1 may then
add provenance-backed Google contracts and exact project-preset profiles without changing
KAKAO, NAVER, or META frozen bytes.

**[PROJECT]**
