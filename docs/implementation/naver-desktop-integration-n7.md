# NAVER Desktop Integration N7

Status: `[PROJECT] IMPLEMENTED`
Desktop: `0.9.0`
Platform: Windows 10/11 x64

N7 connects the frozen NAVER contracts to the standalone Electron Desktop. The primary
navigation is Channel → Placement → capability-selected editor; renderer mode is never the
first user decision.

## Implemented paths

- `NAVER_SMARTCHANNEL`: 120 whitelisted templates, dynamic text fields, object/logo session
  assets, exact local-font preflight, Core Preview, validation panel, and atomic PNG/manifest
  export.
- `NAVER_MOBILE_DA` and `NAVER_IMAGE_BANNER_1_1`: the existing registry-driven
  `FreeformEditor` is reused; no second freeform editor exists.
- Native, Shopping News, Communication Ad, and Feed Image: dynamic source fields/assets,
  platform-owned readonly fields, normalized SourceSpec preview, validation, and source
  artifact/manifest export.
- Communication `LIST`/`COMMENT`: profile-specific field limits and asset rules.
- Feed Collection: ordered 4–10 item controls, Add/Remove/Reorder, per-item URL/description,
  and N6 multi-artifact atomic publish. Feed VIDEO is disabled as static-scope runtime.

All preview/export requests travel through strict IPC schemas and Main/Core session tokens.
Platform-composed results always carry `finalUiRendered=false`; no final NAVER UI geometry or
upload is fabricated. Runtime network access remains prohibited.

## Verification

- `tests/e2e/naver-desktop.spec.ts`: SmartChannel rendered PNG, source-only export, collection
  controls and VIDEO boundary.
- Existing KAKAO and FREEFORM Electron E2E and all Naver Core/contract checks remain regression
  gates.
