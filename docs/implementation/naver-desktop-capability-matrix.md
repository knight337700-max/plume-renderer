# NAVER Desktop Capability Matrix — N7

| Placement | Composition | Editor | Artifact | Status |
|---|---|---|---|---|
| `NAVER_SMARTCHANNEL` | `RENDERER_COMPOSED` | Template Locked | PNG + manifest | `IMPLEMENTED`, 120 whitelist |
| `NAVER_MOBILE_DA` | `RENDERER_COMPOSED` | Shared FREEFORM | PNG + manifest | `IMPLEMENTED` |
| `NAVER_IMAGE_BANNER_1_1` | `RENDERER_COMPOSED` | Shared FREEFORM | PNG + manifest | `IMPLEMENTED` |
| `NAVER_MOBILE_NATIVE` | `PLATFORM_COMPOSED` | Source | SourceSpec + manifest | `IMPLEMENTED`, final UI NAVER-owned |
| `NAVER_PC_NATIVE` | `PLATFORM_COMPOSED` | Source | SourceSpec + manifest | `IMPLEMENTED`, final UI NAVER-owned |
| `NAVER_SHOPPING_NEWS` | `PLATFORM_COMPOSED` | Source | SourceSpec + manifest | `IMPLEMENTED`, platform-owned notification state |
| `NAVER_COMMUNICATION_AD` | `PLATFORM_COMPOSED` | LIST/COMMENT Source | SourceSpec + manifest | `IMPLEMENTED` |
| `NAVER_MOBILE_DA_FEED` / `IMAGE` | `PLATFORM_COMPOSED` | Source | SourceSpec + manifest | `IMPLEMENTED`, no final UI |
| `NAVER_MOBILE_DA_FEED` / `COLLECTION` | `PLATFORM_COMPOSED` | Ordered Collection | Multi-artifact + manifest | `IMPLEMENTED`, 4–10 atomic |
| `NAVER_MOBILE_DA_FEED` / `VIDEO` | `PLATFORM_COMPOSED` | — | — | `DISABLED`, out of static renderer scope |

Machine-readable source of truth: `contracts/desktop-capability-registry.json`. This matrix is
descriptive; it does not add official NAVER geometry or upload behavior.
